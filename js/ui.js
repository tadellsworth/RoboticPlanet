'use strict';
/*
 * Terrafall — HTML interface: menus, HUD, build menu, info sheets, objectives, messages.
 */

/** Version of the remembered new-game settings: 2 brought new defaults for the rival doctrine, Nuclear race and Planetary events. */
const SETTINGS_V = 3;

const UI = {
  inGame: false, paused: false, plan: false, speed: 1, overShown: false,
  menu: { mode: 'versus', diff: 'normal', seed: randomSeed(), size: { ...DEFAULT_SIZE }, rough: DEFAULT_ROUGH, rich: DEFAULT_RICH, shape: 0, style: 1, styles: [null, null, null, null], nuke: 1, mega: 1, upwin: 0, events: 0, murmur: 'active', unlimited: 0, victory: 'capture', mods: [] },
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
  // (a site or a road planned while paused to plan: a mission's goal counts it, see Hot Metal in js/missions.js)
  if (planning() && S.mission && ((name === 'place' && r && r.ok) || (name === 'paths' && r && r.laid > 0))) S.mission.planned = (S.mission.planned || 0) + 1;
  if (cb) cb(r);
}

/*
 * Plan while paused (single player only): the game stands still, time of day and all, but the pause menu is shut, so
 * the map, the minimap, panels, the build menu, Paths and orders all work. Orders are done at once as always (a
 * single-player game runs no turns), so a site placed now is in the game straight away: the next placement sees it,
 * a save keeps it, and Haulers and Workers set off for it the moment the game resumes. The banner over the map (and
 * the dimmed pause button) says so, with Resume and the full menu. Space (or Shift+Space, or Pause) resumes.
 */
function planning() { return !!(UI.plan && UI.paused && UI.inGame && !(typeof MP !== 'undefined' && MP.on)); }
/** Does the game stand still in a way that keeps the map from taking orders? (Not while planning.) */
function uiFrozen() { return UI.paused && !planning(); }
function planPause() {
  if (!UI.inGame || !S || (typeof MP !== 'undefined' && MP.on) || UI.watch || S.winner >= 0 || UI.briefing) return false;
  if (UI.menuSettings) closeMenuSettings();
  $('screen-pause').hidden = true;
  UI.paused = true; UI.plan = true;
  syncPlanBanner();
  sfx('click');
  return true;
}
function syncPlanBanner() {
  if (!UI.paused) UI.plan = false;
  const on = planning() && $('screen-pause').hidden && !UI.photo;
  const el = $('plan-banner');
  if (el && el.hidden === on) el.hidden = !on;
  document.body.classList.toggle('plan-paused', on);
  // (just under the top bar and the goal card, the messages moved down below it: body.plan-paused #toasts)
  if (on && el) el.style.top = Math.round($('topbar').getBoundingClientRect().bottom + 6) + 'px';
}

function randomSeed() { return 1 + Math.floor(Math.random() * 999998); }

function iconFor(type, owner) {
  const key = type + '@' + artTeam(owner || 0);
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
    // Tap (or click) opens the Economy panel on this good: stock, rates, its chain, makers, users and problems (js/economy.js).
    el.onclick = () => { hideGoodTip(); sfx('click'); if (UI.sheetKind === 'econ' && UI.ecTab === 'good' && UI.ecGood === g) closeSheet(); else openEconomy('good', g); };
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
    for (const k of ['size', 'rough', 'rich', 'shape', 'nuke', 'mega', 'upwin', 'biome', 'biome2', 'players', 'diff', 'style', 'styles', 'events', 'murmur', 'unlimited', 'victory', 'shapeRnd', 'biomeRnd', 'mods', 'hgoal']) if (saved[k] !== undefined) UI.menu[k] = saved[k];
    // (The Murmur were a Colony switch, `wild`, before they came to every game: switched off, they stay off.)
    if (saved.murmur === undefined && saved.wild !== undefined) UI.menu.murmur = saved.wild ? 'active' : 'off';
  } catch (e) { /* defaults */ }
  checkMenuSettings();
  initMenu();
  initMulti();
  $('m-continue').onclick = () => { audioUnlock(); continueNewest(); }; // (the newest of the autosave and the save slots: js/qol.js)
  $('m-import').onclick = () => { audioUnlock(); $('m-import-msg').hidden = true; $('m-import-file').value = ''; $('m-import-file').click(); };
  $('m-import-file').onchange = () => { const f = $('m-import-file').files && $('m-import-file').files[0]; if (f) importSaveFile(f); };
  $('p-export').onclick = () => { sfx('click'); downloadSave(); };
  $('m-help').onclick = () => showHelp();
  $('h-close').onclick = () => { $('screen-help').hidden = true; UI.paused = !$('screen-pause').hidden || planning(); };
  // The illustrated manual is a page beside this one: the single-file build has none, so there the link is left out.
  if ($('h-manual')) $('h-manual').hidden = !!window.TOD_BUNDLE;
  // The How to play shows one section at a time: the contents first, then a section with a bar above it that stays
  // put (Contents, a picker, previous and next) and Previous / Next buttons at its end (see helpPage).
  helpMarkKeys(); // (before the pager is built: it rewrites the Help text once)
  helpPagerInit();
  initLore();
  initFeedback(); // (Send feedback: main menu and pause menu, js/feedback.js)
  initQol(); // (camera spots, recent alerts, goods a minute, save slots: js/qol.js)
  initPolish(); // (health bars switch, Idle button, Surrender, Rematch: js/polish.js)
  initAlly(); // (commands for a computer ally: js/ally.js)
  initPolish3(); // (the Daily Planet, chat, team pings, Ready and colours in the lobby: js/polish3.js)
  initCloud(); // (cloud saves: Save to the cloud in the pause menu, Load from a code on the main menu, js/cloud.js)
  initMeta(); // (Colony goals, Records and achievements: js/goals.js)
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
  $('p-difficulty').onchange = () => {
    const select = $('p-difficulty'), value = select.value;
    select.value = S.difficulty;
    if (value !== S.difficulty) act('rivalDifficulty', [value], (ok) => {
      syncRivalDifficulty();
      if (!ok) toast('The rival difficulty could not be changed.', 'warn');
    });
  };
  $('btn-pause').onclick = () => { if (UI.menuSettings) closeMenuSettings(); UI.paused = !MP.on; UI.mpQuitArm = false; mpSyncPauseMenu(); pauseView('main'); $('screen-pause').hidden = false; showCheckpoints(); syncSaved(); syncGfx(); sfx('click'); };
  $('p-keys').onclick = openKeys;
  $('keys-close').onclick = closeKeys;
  $('screen-keys').onclick = (e) => { if (e.target === $('screen-keys')) closeKeys(); };
  $('p-resume').onclick = () => { UI.paused = false; UI.plan = false; $('screen-pause').hidden = true; syncPlanBanner(); };
  // Plan while paused (Shift+Space): the menu shuts, the game stays still, and the map takes orders (planPause).
  $('p-plan').onclick = () => planPause();
  $('plan-resume').onclick = () => { sfx('click'); $('p-resume').click(); };
  $('plan-menu').onclick = () => $('btn-pause').click();
  $('p-withdraw').onclick = () => { sfx('click'); contWithdraw(); }; // (js/contingency-battle.js)
  // Settings: the pause menu's second view (Back, or Esc, returns to the first).
  $('p-settings').onclick = () => { sfx('click'); pauseView('settings', true); };
  $('p-back').onclick = () => { sfx('click'); if (UI.menuSettings) closeMenuSettings(); else pauseView('main', true); };
  // The same Settings from the main menu (its Settings pill): over the menu, Back or Esc returns to it.
  $('m-settings').onclick = () => { sfx('click'); openMenuSettings(); };
  // Menu background (js/menuplanet.js): Classic (the demo game) or Planet, at once.
  UI.syncMenuBg = () => { for (const b of $('p-menubg').children) { const on = b.dataset.v === menuBg(); b.classList.toggle('on', on); b.setAttribute('aria-checked', on ? 'true' : 'false'); } };
  UI.syncMenuBg();
  for (const b of $('p-menubg').children) b.onclick = () => { setMenuBg(b.dataset.v); UI.syncMenuBg(); sfx('click'); };
  // Its choices (Graphics, Time of day) are radio groups: ← → (↑ ↓) pick the next one, as anywhere else.
  for (const id of ['p-gfx', 'p-daynight', 'p-scars', 'p-menubg']) {
    $(id).addEventListener('keydown', (e) => {
      const d = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }[e.key];
      if (!d) return;
      e.preventDefault();
      const opts = [...$(id).children].filter((b) => b.getAttribute('aria-disabled') !== 'true');
      const b = opts[(opts.findIndex((o) => o.classList.contains('on')) + d + opts.length) % opts.length];
      if (b) { b.click(); b.focus(); }
    });
  }
  // The hidden rival boost: tap the clock three times quickly (or press ` on a keyboard).
  $('clock').addEventListener('click', () => {
    const now = performance.now();
    UI.clockTaps = (UI.clockTaps || []).filter((t) => now - t < 1200);
    UI.clockTaps.push(now);
    if (UI.clockTaps.length >= 3) { UI.clockTaps = []; openBoost(); }
  });
  $('bo-close').onclick = () => closeBoost();
  // Music, Effects and Ambience volume (remembered on this device).
  const syncVol = () => {
    for (const [id, k] of [['p-music', 'music'], ['p-fx', 'fx'], ['p-amb', 'amb']]) {
      $(id).value = Math.round(AUDIO[k] * 100);
      $(id + '-v').textContent = AUDIO[k] > 0 ? Math.round(AUDIO[k] * 100) + '%' : 'Off';
    }
  };
  $('p-music').oninput = () => { setVolume('music', $('p-music').value / 100); syncVol(); };
  $('p-fx').oninput = () => { setVolume('fx', $('p-fx').value / 100); syncVol(); };
  $('p-fx').onchange = () => sfx('place');
  $('p-amb').oninput = () => { setVolume('amb', $('p-amb').value / 100); syncVol(); };
  // Graphics (render.js setGfxStep): Saver, Auto, High or Ultra, at once.
  for (const btn of $('p-gfx').children) btn.onclick = () => { setGfxStep(btn.dataset.v); syncGfx(); sfx('click'); };
  syncGfx();
  // Time of day (a display setting): Cycle, Day (always day) or Night (always night). In a game with the Murmur, Day
  // can't be picked (they live by the night: see todForced), and on an always-night map (the Hollow) it stays night;
  // the line under the choices says why.
  const todLocked = (v, f) => (f === 'night' ? v !== 'night' : f === 'murmur' && v === 'day');
  UI.syncTod = () => {
    const f = UI.inGame ? todForced() : '', now = todMode();
    for (const b of $('p-daynight').children) {
      const v = b.dataset.v, locked = todLocked(v, f);
      b.classList.toggle('on', v === now);
      b.setAttribute('aria-checked', v === now ? 'true' : 'false');
      b.classList.toggle('na', locked);
      b.setAttribute('aria-disabled', locked ? 'true' : 'false');
      b.title = locked ? (f === 'night' ? 'Always night here: this map lies underground.' : 'No Always day in this game: the Murmur live by the night.') : TOD_INFO[v];
    }
    $('p-daynight-note').hidden = !f;
    $('p-daynight-note').textContent = f === 'night' ? 'Always night here: this map lies underground.' : f === 'murmur' ? 'No Always day in this game: the Murmur live by the night. Always night only changes the look: they still come out at the game clock\'s nightfall, after the dusk warning.' : '';
  };
  UI.syncTod();
  for (const b of $('p-daynight').children) {
    b.onclick = () => {
      const f = UI.inGame ? todForced() : '';
      if (todLocked(b.dataset.v, f)) { sfx('error'); UI.syncTod(); return; }
      if (b.dataset.v === todMode() && f) return; // (already so, and the game holds it there: nothing to change)
      setTodMode(b.dataset.v); UI.syncTod(); sfx('click');
    };
  }
  // What the game overrules (read by daynight.js's todForced): the Murmur keep the cycle on. (An always-night map, the
  // Hollow, is night whatever happens: todForced sees to that itself.)
  TOD.force = () => (UI.inGame && S && S.wildlife ? 'murmur' : '');
  // War scars (scarsPref): Off, Light or Full, for the next game (a game keeps the one it started with).
  UI.syncScars = () => {
    const v = scarsPref();
    for (const b of $('p-scars').children) { b.classList.toggle('on', b.dataset.v === v); b.setAttribute('aria-checked', b.dataset.v === v ? 'true' : 'false'); b.title = SCARS_INFO[b.dataset.v]; }
    const cur = UI.inGame && S && S.settings ? SCARS.levels[scarLevel()] : null;
    $('p-scars-note').textContent = SCARS_INFO[v] + (cur && cur !== v ? ` From your next game: this one keeps ${SCARS_NAMES[cur]}.` : '');
  };
  UI.syncScars();
  for (const b of $('p-scars').children) b.onclick = () => { setScarsPref(b.dataset.v); UI.syncScars(); sfx('click'); };
  const syncWx = () => pauseSwitch('p-weather', weatherOn());
  syncWx();
  $('p-weather').onclick = () => { setWeatherOn(!weatherOn()); syncWx(); sfx('click'); };
  // Voice lines (js/voice.js): the machine voice with its subtitles, on or off (remembered on this device); a tap on
  // the subtitle skips the line.
  const syncVoice = () => pauseSwitch('p-voice', VOICE.on);
  syncVoice();
  $('p-voice').onclick = () => { setVoiceOn(!VOICE.on); syncVoice(); sfx('click'); };
  $('voice-sub').addEventListener('pointerdown', (e) => { e.preventDefault(); e.stopPropagation(); voiceStop(); });
  // Scout reports on the rivals (js/scout.js), on or off (remembered on this device).
  const syncScouts = () => pauseSwitch('p-scouts', SCOUT.on);
  syncScouts();
  $('p-scouts').onclick = () => { setScoutsOn(!SCOUT.on); syncScouts(); sfx('click'); };
  // Blueprints (js/blueprint.js): off unless switched on here (remembered on this device).
  const syncBp = () => pauseSwitch('p-blueprints', bpOn());
  syncBp();
  $('p-blueprints').onclick = () => { setBpOn(!bpOn()); syncBp(); sfx('click'); if (typeof refreshSheet === 'function') refreshSheet(); };
  // Vibration (input.js haptic): on a touch screen that can vibrate; on, a buzz says so.
  const syncHaptics = () => pauseSwitch('p-haptics', HAPTIC.on);
  const touchScreen = (typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches) || navigator.maxTouchPoints > 0;
  $('p-haptics').hidden = !hapticsSupported() || !touchScreen;
  syncHaptics();
  $('p-haptics').onclick = () => { setHaptics(!HAPTIC.on); syncHaptics(); sfx('click'); if (HAPTIC.on) try { navigator.vibrate(HAPTIC_PATTERNS.order); } catch (e) { /* not allowed here */ } };
  // The custom mouse cursor (js/cursor.js): with a mouse only.
  initCursor();
  const syncCursor = () => pauseSwitch('p-cursor', CURSOR.on);
  $('p-cursor').hidden = !CURSOR.ok;
  syncCursor();
  $('p-cursor').onclick = () => { setCursorOn(!CURSOR.on); syncCursor(); sfx('click'); };
  // (Weather can be switched in Custom Game's Rules too: the switches are read again as Settings opens.)
  UI.syncSwitches = () => { syncWx(); syncVoice(); syncScouts(); syncHaptics(); syncCursor(); };
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
  $('o-keep').onclick = () => { sfx('click'); keepPlaying(); };
  $('o-menu').onclick = () => { $('screen-over').hidden = true; if (MP.on) mpQuit(); toMenu(); if (UI.overMenu) UI.overMenu(); };
  $('m-missions').onclick = () => { sfx('click'); openMissions(); };
  $('ms-close').onclick = () => { sfx('click'); if (UI.msSel != null) { UI.msSel = null; renderMissions(); } else $('screen-missions').hidden = true; };
  $('o-statsbtn').onclick = () => { sfx('click'); openStats(); };
  // (in a game: the Economy panel's History tab, the game paused to plan; observing, or once it's over, the Statistics screen)
  $('p-stats').onclick = () => { sfx('click'); statsHere(); };
  $('st-close').onclick = () => { sfx('click'); $('screen-stats').hidden = true; };

  // HUD tools
  $('btn-build').onclick = () => { sfx('click'); if (UI.sheetKind === 'build') closeSheet(); else { setMode('normal'); openBuildMenu(); } };
  $('btn-road').onclick = () => { sfx('click'); setMode(R.mode === 'road' || crossingPlacing() ? 'normal' : 'road'); };
  $('btn-attack').onclick = () => { sfx('click'); if (UI.sheetKind === 'army' || R.mode === 'attack') { setMode('normal'); closeSheet(); } else { setMode('normal'); openArmySheet(); } };
  $('btn-home').onclick = () => {
    const L = getE(S.players[ME].lander);
    if (L) { centerOn(L.x + 0.5, L.y + 0.5); openBuildingSheet(L); }
  };
  $('btn-speed').onclick = (e) => { e.stopPropagation(); sfx('click'); toggleSpeedMenu(); };
  // (the Workers count opens the Workforce panel, js/workforce.js; the rest of it Your robots)
  $('pop').onclick = (e) => { sfx('click'); const wf = !!e.target.closest('.pn-w'); if (UI.sheetKind === (wf ? 'wf' : 'pop')) closeSheet(); else if (wf) openWorkforce(); else { setMode('normal'); openPopSheet(); } };
  window.addEventListener('pointerdown', (e) => {
    if (!$('speed-menu').hidden && !$('speed-menu').contains(e.target) && e.target !== $('btn-speed')) $('speed-menu').hidden = true;
  });
  // The Paths tools picker (an upright phone's Tool button) shuts at a touch anywhere else; one on the map does nothing more.
  window.addEventListener('pointerdown', (e) => {
    if (!UI.toolPick || $('banner-seg').contains(e.target) || $('banner-tool').contains(e.target)) return;
    const shown = $('banner-tool').getClientRects().length > 0;
    toolPicker(false);
    if (shown && e.target === $('game')) e.stopPropagation();
  }, true);
  $('objective').onclick = () => { UI.objCollapsed = !UI.objCollapsed; UI.objManual = true; UI.hudT = 0; };
  $('btn-msgs').onclick = () => { sfx('click'); if (UI.sheetKind === 'msgs') closeSheet(); else { setMode('normal'); openMsgSheet(); } };
  $('sheet-close').onclick = () => closeSheet();
  $('banner-cancel').onclick = () => setMode(UI.planKept ? 'road' : 'normal'); // (a Viaduct or Ropeway placed from Paths with a plan there: back to it)
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
  $('mm-cmd').onclick = () => toggleCmdView(); // (Army Groups' command view)
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
    if (/^#save=/i.test(location.hash)) return; // (a cloud save link sent to the open game isn't Back: js/cloud.js asks about it)
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
  easy: 'Settler: a slow, forgiving rival that builds up and attacks late.',
  medium: 'Pioneer: between Settler and Colonist. It attacks later, with smaller armies, and raids less.',
  normal: 'Colonist: a fair fight. The rival expands, raids your roads and attacks in force.',
  hard: 'Commander: a fast rival that lands with extra goods and attacks early and often.',
  warlord: 'Warlord: the hardest. Much faster, with twice the extra goods, it attacks within two minutes and never lets up. For a strong player.',
};
/** What each Horde level plays like (the Match section's line, Horde mode: the Waves row). */
const HORDE_DIFF_INFO = {
  easy: 'Settler waves: small and slow to grow, with long gaps between them. Brutes join at wave 4, the first young Harrow leads wave 5.',
  medium: 'Pioneer waves: a little bigger, the gaps a little shorter.',
  normal: 'Colonist waves: a fair fight. About 20 Murmur by wave 5, near 50 by wave 10 and over 100 by wave 20, three minutes apart at first, a minute and a half by the end.',
  hard: 'Commander waves: big, fast-growing and close together, with two Harrows in the boss waves from wave 15.',
  warlord: 'Warlord waves: relentless and almost unsurvivable. Always Endless: huge waves that never stop growing, under a minute apart from wave 13 on.',
};
/** What each Horde goal means (the Goal row). */
const HORDE_GOAL_INFO = {
  fixed: `Fixed: survive ${HORDE.waves} waves (clear the last one) to win, or wreck the Maw.`,
  endless: 'Endless: the waves never stop. How far you get is your score: the best wave on each level is kept on this device. Wreck the Maw to end it with a win.',
};
/** What each Graphics step does (the line under it in the pause menu, and the new-game Rules line). */
const GFX_INFO = {
  saver: 'Saver: for older phones and long sessions. Drawn at 1×, 30 frames a second, with fewer effects and plainer night lights (kept on this device).',
  auto: 'Auto: as sharp as the screen allows up to 2× (4K’s worth of pixels), less while frames come slowly (kept on this device).',
  high: 'High: for a strong computer. A big screen at its full 2×, sharper ground up close, more smoke and sparks (kept on this device).',
  ultra: 'Ultra: the most there is. The screen’s full sharpness, the densest effects and weather, the richest night light (kept on this device).',
};
const TOD_INFO = { cycle: 'Time of day: morning to night, 12 minutes round (looks only; kept on this device).', day: 'Time of day: always day (looks only; kept on this device).', night: 'Time of day: always night, every colony lit up (looks only; kept on this device).' };

/** The Graphics choice as it is now, in the pause menu and the new-game Rules (and the pause menu's lines: how sharp the map is drawn now, and what the step does). */
function syncGfx() {
  const v = gfxStep();
  for (const id of ['p-gfx', 'm-gfx']) for (const b of $(id).children) { b.classList.toggle('on', b.dataset.v === v); b.setAttribute('aria-checked', b.dataset.v === v ? 'true' : 'false'); }
  $('p-gfx-v').textContent = `drawn at ${+R.dpr.toFixed(2)}×`;
  $('p-gfx-note').textContent = GFX_INFO[v];
}

/**
 * The pause menu's view: 'main' (Resume, Statistics, the saves...) or 'settings' (the volumes, Graphics, the switches,
 * Time of day). It opens on the main view each time (btn-pause). With `focus` (Settings or Back pressed, or Esc), the
 * keyboard's focus goes with it: into Settings (its Back), or back to the Settings button.
 */
function pauseView(v, focus) {
  const set = v === 'settings';
  UI.pauseView = set ? 'settings' : 'main';
  $('p-main').hidden = set;
  $('p-setview').hidden = !set;
  $('screen-pause').querySelector('.card').classList.toggle('p-set', set);
  $('screen-pause').scrollTop = 0;
  if (set) { syncGfx(); if (UI.syncTod) UI.syncTod(); if (UI.syncSwitches) UI.syncSwitches(); if (UI.syncScars) UI.syncScars(); if (UI.syncMenuBg) UI.syncMenuBg(); }
  if (focus) $(set ? 'p-back' : 'p-settings').focus({ preventScroll: true });
}

/**
 * Settings from the main menu: the pause menu's Settings view, opened on its own over the menu (#screen-pause.from-menu,
 * which also hides its first view). Everything there is a device setting, so all of it applies here too. Back or Esc
 * closes it and the focus returns to the menu's Settings pill.
 */
function openMenuSettings() {
  if (UI.inGame) return;
  UI.menuSettings = true;
  $('screen-pause').classList.add('from-menu');
  pauseView('settings');
  $('screen-pause').hidden = false; // (initDialogs moves the focus in, and back to the pill on the way out)
}
function closeMenuSettings() {
  UI.menuSettings = false;
  $('screen-pause').hidden = true;
  $('screen-pause').classList.remove('from-menu');
  pauseView('main');
  if (!UI.inGame && !$('screen-menu').hidden) $('m-settings').focus({ preventScroll: true });
}

/*
 * War scars (SCARS): this device's setting, Full unless changed in Settings. A new game, a mission, a game to watch and a
 * multiplayer game (the host's) take it as they start (newGame's opts.scars: S.settings.scars), and keep it.
 */
const SCARS_KEY = 'botfall.scars';
const SCARS_NAMES = { off: 'Off', light: 'Light', full: 'Full' };
const SCARS_INFO = {
  off: 'Off: battles leave only marks that fade, and remains that grow over.',
  light: 'Light: only big blasts leave lasting craters, and scorched ground grows back; scrap and bones stay.',
  full: 'Full: every blast leaves its crater, ash and charred stumps stay, and scrap and bones pile up for good.',
};
function scarsPref() { try { const v = localStorage.getItem(SCARS_KEY); return scarsOk(v) ? v : 'full'; } catch (e) { return 'full'; } }
function setScarsPref(v) { try { localStorage.setItem(SCARS_KEY, v); } catch (e) { /* storage unavailable: this session only */ } }

/** One of the pause menu's on/off settings (Full screen, Weather, Scout reports, Custom cursor, Vibration): its switch, On or Off. */
function pauseSwitch(id, on) {
  const b = $(id);
  b.setAttribute('aria-checked', on ? 'true' : 'false');
  b.querySelector('.p-sw-v').textContent = on ? 'On' : 'Off';
}

/** Keep remembered settings inside what the data offers now (a map type or biome may have gone). */
function checkMenuSettings() {
  const m = UI.menu, ok = (v, n) => Number.isInteger(v) && v >= 0 && v < n;
  if (!ok(m.shape, SHAPE_PRESETS.length)) m.shape = 0;
  if (!ok(m.biome || 0, BIOME_ORDER.length) || !biomeAllowed(BIOME_ORDER[m.biome || 0], m.shapeRnd ? -1 : m.shape || 0)) m.biome = 0;
  if (!BIOME_ORDER.includes(m.biome2)) m.biome2 = null;
  if (!ok(m.rough, TERRAIN_PRESETS.length)) m.rough = DEFAULT_ROUGH;
  if (!ok(m.rich, RESOURCE_PRESETS.length)) m.rich = DEFAULT_RICH;
  if (!m.size || typeof m.size !== 'object') m.size = { ...DEFAULT_SIZE };
  for (const k in DEFAULT_SIZE) if (!ok(m.size[k], SIZE_PRESETS.length)) m.size[k] = DEFAULT_SIZE[k];
  if (!Object.prototype.hasOwnProperty.call(DIFFICULTY, m.diff)) m.diff = 'normal';
  if (!Object.prototype.hasOwnProperty.call(VICTORY, m.victory)) m.victory = 'capture';
  // (a value another version or a damaged store left: one the menu can't show stopped the game booting)
  m.mode = m.mode === 'colony' || m.mode === 'horde' ? m.mode : 'versus';
  m.hgoal = m.hgoal === 'endless' ? 'endless' : 'fixed'; // (Horde: Fixed or Endless)
  m.players = ok(m.players, 5) && m.players >= 2 ? m.players : 2;
  m.style = ok(m.style, PERSONALITY_ORDER.length + 1) ? m.style : 1;
  // Each computer player's own doctrine (null: as the Rival doctrine chips say), by player slot 0 to 3. (A list of three
  // is how an earlier build kept them, for players 1 to 3.)
  const st = Array.isArray(m.styles) ? (m.styles.length === 3 ? [null, ...m.styles] : m.styles) : [];
  m.styles = [0, 1, 2, 3].map((p) => (ok(st[p], PERSONALITY_ORDER.length + 1) ? st[p] : null));
  for (const k of ['nuke', 'upwin', 'events', 'unlimited', 'shapeRnd', 'biomeRnd']) m[k] = m[k] ? 1 : 0;
  if (!murmurLevelOk(m.murmur)) m.murmur = 'active';
  m.mods = modList(m.mods); // the challenge modifiers picked (MODS), Rival head start kept for Versus in Colony too
  // (Teams isn't remembered: on a map made for 2 vs 2 it starts on.)
  if (m.teams === undefined && !m.shapeRnd && SHAPE_PRESETS[m.shape].teamDefault) m.teams = 1;
}

/** Remember the new-game settings on this device. */
function saveSettings() {
  const m = UI.menu, keep = m.mode === 'horde' && m.shapeKeep; // (Horde's Long haul isn't the map type picked: the one before it is)
  try {
    localStorage.setItem('botfall.settings', JSON.stringify({ v: SETTINGS_V, size: m.size, rough: m.rough, rich: m.rich, shape: keep ? keep.shape : m.shape, nuke: m.nuke, mega: m.mega, upwin: m.upwin, biome: m.biome, biome2: m.biome2, players: m.players,
      diff: m.diff, style: m.style, styles: m.styles, events: m.events, murmur: m.murmur, unlimited: m.unlimited, victory: m.victory, shapeRnd: (keep ? keep.rnd : m.shapeRnd) ? 1 : 0, biomeRnd: m.biomeRnd ? 1 : 0, mods: m.mods, hgoal: m.hgoal }));
  } catch (e) { /* storage unavailable */ }
}

/** Can the Great Uplink win be on with the menu as it is (Megastructures on, not the Hollow)? */
function menuUpWinOk() { const m = UI.menu; return !!m.mega && !(!m.shapeRnd && noSkyShape(m.shape)); }
/** Does map type `shape` have no Uplinks and no Great Uplink win (the Hollow, which the Pathfinder never mapped, and Half underground's caves)? */
function noSkyShape(shape) { const P = SHAPE_PRESETS[shape || 0] || {}; return !!(P.hollow || P.caves); }
/** Why map type `shape` has no Uplinks: the sentence for the menus. */
function noUplinksWhy(shape) { return (SHAPE_PRESETS[shape || 0] || {}).caves ? 'No Uplinks on Half underground: the Pathfinder never mapped the caves.' : 'No Uplinks in the Hollow: the Pathfinder never mapped it.'; }
/** Is the Great Uplink win on for the game the menu would start (Versus)? */
function menuUpWin() { return UI.menu.mode === 'versus' && !!UI.menu.upwin && menuUpWinOk(); }
const menuSizePlayers = () => UI.menu.mode !== 'versus' && !UI.menu.shapeRnd ? minPlayers(UI.menu.shape || 0) : menuPlayers();
const menuSize = () => mapSizeForPlayers(UI.menu.size[UI.menu.mode] ?? DEFAULT_SIZE[UI.menu.mode], menuSizePlayers());

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
  if (UI.menu.mode !== 'versus') return [];
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
function menuMurmur() { return (UI.menu.shapeRnd || murmurShape(UI.menu.shape || 0)) && (UI.menu.biomeRnd || murmurGround(BIOME_ORDER[UI.menu.biome || 0])); } // (nor a map type without room for nests: murmurShape)
/** The Murmur as the menu has them: 'off', 'quiet' or 'active' (off on Argos, whatever the setting, which is kept for the next biome). */
function menuMurmurLevel() { if (UI.menu.mode === 'horde') return 'active'; return menuMurmur() && murmurLevelOk(UI.menu.murmur) ? UI.menu.murmur : 'off'; }
/** What each Murmur setting does (the Rules line). */
const MURMUR_INFO = {
  off: 'The Murmur: off. No nests, no tunnels, no raids.',
  quiet: 'The Murmur: quiet. Fewer nests; by night their tunnels creep toward your power and a few small packs come up through the exits.',
  active: 'The Murmur: active. Nests out in the wilds; every night their tunnels spread toward power, new exits open and packs come up to raid every colony. The longer the game, the more of them. Keeps the day-and-night cycle on.',
};
/** The time of day as the menu shows it: always day isn't on offer with the Murmur in the game (they live by the night). */
function menuTodMode() { const m = todStored(); return m === 'day' && menuMurmurLevel() !== 'off' ? 'cycle' : m; }
const mapGroupName = (g) => { const G = MAP_GROUPS.find((x) => x.key === g); return G ? G.name : ''; };
/**
 * How many players the menu is set to (Versus): you and one to three rivals, as many as the map type
 * has room for (Random picks a map type with room for them all).
 */
/**
 * The Mode choice: Versus, Colony or Horde. Horde is played on Long haul only: picking it puts the map type there (the
 * one picked before is kept, UI.menu.shapeKeep, and comes back when another mode is picked).
 */
function setMenuMode(v) {
  const m = UI.menu, was = m.mode;
  m.mode = v === 'colony' || v === 'horde' ? v : 'versus';
  if (m.mode === 'horde' && was !== 'horde') { m.shapeKeep = { shape: m.shape, rnd: m.shapeRnd }; m.shape = hordeShape(); m.shapeRnd = 0; }
  else if (m.mode !== 'horde' && was === 'horde' && m.shapeKeep) { m.shape = m.shapeKeep.shape; m.shapeRnd = m.shapeKeep.rnd; m.shapeKeep = null; }
}
function menuPlayers() {
  const m = UI.menu, want = clamp(Math.round(m.players) || 2, 2, 4);
  if (m.mode !== 'versus') return 2;
  return m.shapeRnd ? want : snapPlayers(m.shape || 0, clamp(want, minPlayers(m.shape || 0), maxPlayers(m.shape || 0)));
}
/** A team game: four colonies, two against two (the Teams choice, with four players)? */
function menuTeams() { return UI.menu.mode === 'versus' && !!UI.menu.teams && menuPlayers() === 4; }
/** Is this a free-for-all (Versus, three or four players)? */
function menuThree() { return menuPlayers() > 2; }
/** The Crossroads map type (four quarters: three or four players get one corner quarter each). */
const crossIdx = () => Math.max(0, SHAPE_PRESETS.findIndex((P) => P.cross));
function modeInfo(mode, n, teams) {
  const m = UI.menu, SH = SHAPE_PRESETS[m.shape || 0], quad = !m.shapeRnd && !!(SH.cross || SH.quad4), onCross = n === 4 || quad;
  const haul = !m.shapeRnd && !!SH.haul4; // (Long Haul 2v2: two colonies side by side at each end)
  const where = m.shapeRnd ? 'a square planet' : quad || SH.city || SH.dam || SH.std4 ? SH.name : 'a square planet';
  const town = !m.shapeRnd && !!SH.city; // (Passenger Town: four on the edges of a square town, three round a round one)
  const dam = !m.shapeRnd && !!SH.dam; // (The Dam: a colony on each side of the high ground, a reservoir over each valley)
  const win = 'Take a rival\'s Command Base and all it built is yours; the last colony standing wins.';
  if (mode === 'horde') return `Horde: no rival, only the Murmur. You land at one end of Long haul; at the far end the Maw sends ever bigger waves down the map at you, a countdown between them. Hold the line: ${UI.menu.diff === 'warlord' ? 'on Warlord the waves never end' : UI.menu.hgoal === 'endless' ? 'Endless, how far can you get' : `survive ${HORDE.waves} waves`}, or wreck the Maw. Lose your Command Base and it's over.${UI.mpSetup ? ` In multiplayer it's co-op: you and your partner land side by side on ${HORDE.pair.shape}, a colony each, against waves ${HORDE.pair.mul} times as big (or share one colony: tap them in the lobby).` : ''}`;
  return mode === 'colony'
    ? (menuMurmurLevel() !== 'off' ? 'Colony: no rival, but the Murmur burrow in the wilds and raid what you build near them, and come up through their tunnels by night. Build, research and spread across the planet.'
      : 'Colony: no rival. Settle the planet at your own pace: build, research and spread across the planet.')
    : n === 4 && teams ? (haul ? `Teams · 2 vs 2 on ${SH.name}: you and your red ally land side by side at the south end, green and purple at the far north end. Take both of their Command Bases to win.`
      : `Teams · 2 vs 2${m.shapeRnd ? '' : ' on ' + SH.name}: you and the red colony beside you against green and purple. Take both of their Command Bases to win.`)
    : n === 4 && haul ? `Free-for-all · 4 players on ${SH.name}: you and red side by side at the south end, green and purple at the far north end. ${win}`
    : n >= 3 && dam ? `Free-for-all · ${n} players: you and ${n === 4 ? 'three rival colonies (red, green and purple)' : 'two rival colonies'} round the high ground of ${SH.name}, each valley under its own reservoir and dam. ${win}`
    : n === 4 && town ? `Free-for-all · 4 players: you and three rival colonies (red, green and purple) on ${where}, one on each side of the town, each with an old avenue running into it. ${win}`
    : n === 4 ? `Free-for-all · 4 players: you and three rival colonies (red, green and purple) on ${where}, one in each corner quarter. ${win}`
      : n === 3 && town ? `Free-for-all: you and two rival colonies round ${where}, a round town in the middle with an old avenue from each colony to its heart. ${win}`
      : n === 3 && onCross ? `Free-for-all · 3 players: you and two rival colonies on ${where}, each in a corner quarter; the quarter beside you is free and rich. ${win}`
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

/** The challenge modifiers the menu has on, as a new game takes them (none that need a rival in Colony). */
function menuMods() { return modList(UI.menu.mods, UI.menu.mode === 'versus' ? 'versus' : 'colony'); }

/** The setup in a line (and what isn't the default in a second one), under Play and in Start's bar. */
function menuSummary() {
  const m = UI.menu, colony = m.mode !== 'versus', three = menuThree(), horde = m.mode === 'horde';
  const otherBiome = chosenSecondBiome(m, menuSize());
  const main = [horde ? `Horde · ${DIFFICULTY[m.diff].label} waves · ${m.diff === 'warlord' || m.hgoal === 'endless' ? 'Endless' : `${HORDE.waves} waves`}` : colony ? 'Colony' : menuTeams() ? 'Teams · 2 vs 2' : three ? `Free-for-all · ${menuPlayers()} players` : 'Versus'];
  if (!colony) main.push(`${DIFFICULTY[m.diff].label} rival${three ? 's' : ''}`);
  if (!colony && !menuTeams() && m.victory && m.victory !== 'capture') main.push(VICTORY[m.victory].name);
  if (menuUpWin()) main.push('Great Uplink win');
  main.push(m.shapeRnd ? 'Random map' : SHAPE_PRESETS[menuShownShape()].name, m.biomeRnd ? 'Random biome' : biomeName(m.biome || 0), ...(otherBiome ? [BIOMES[otherBiome].name] : []), SIZE_PRESETS[menuSize()].name);
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
  if (!m.mega) extra.push('no Megastructures');
  extra.push(menuMurmurLevel() === 'off' ? 'no Murmur' : `Murmur: ${MURMUR_NAMES[menuMurmurLevel()]}`);
  if (m.events) extra.push('Planetary events');
  if (menuTodMode() !== 'cycle') extra.push(menuTodMode() === 'day' ? 'always day' : 'always night');
  if (!weatherOn()) extra.push('no weather');
  if (m.unlimited) extra.push('Unlimited resources');
  const mods = menuMods();
  if (mods.length) extra.push('Challenge: ' + mods.map((k) => MODS[k].name).join(', '));
  return { main: main.join(' · '), extra: extra.join(' · ') };
}

/**
 * The main menu's four views, in the one card: 'home' (what shows on load), 'setup' (Custom Game), 'camps' (Campaigns:
 * a card per campaign) and 'extra' (More: Observer, Records, the two ways to load a game). Back or Esc returns Home,
 * the focus going back to the button that opened the view.
 */
const MENU_VIEW_OPENER = { setup: 'm-customise', camps: 'm-campaigns', extra: 'm-extras' };
function showMenuView(v, focus) {
  if (!['home', 'setup', 'camps', 'extra'].includes(v)) v = 'home';
  if (UI.menuView === v) return;
  const from = UI.menuView, setup = v === 'setup', home = v === 'home';
  UI.menuView = v;
  $('m-more').hidden = !setup;
  $('m-camps').hidden = v !== 'camps';
  $('m-extra').hidden = v !== 'extra';
  $('m-home').hidden = !home;
  $('m-home-foot').hidden = !home;
  $('m-go').hidden = !home && !setup;
  $('menu-card').classList.toggle('is-setup', setup);
  $('screen-menu').classList.toggle('is-setup', setup);
  $('screen-menu').classList.toggle('is-home', home);
  $('menu-card').dataset.view = v;
  $('m-new-label').textContent = UI.mpSetup ? 'Done' : setup ? 'Start' : 'Play';
  $('m-setup-title').textContent = UI.mpSetup ? 'Multiplayer game' : 'Custom Game';
  if (!setup) { closePicker(false); closeSetPop(false); }
  else { $('m-body').scrollTop = 0; }
  // Play / Start: the first cell of Home's dock, or Custom Game's bar.
  if (setup && $('m-go').parentElement !== $('m-more')) $('m-more').appendChild($('m-go'));
  else if (!setup && $('m-go').parentElement !== $('m-dock')) $('m-dock').prepend($('m-go'));
  $('screen-menu').scrollTop = 0;
  if (v === 'camps') renderCampaignHub();
  if (home) syncCampaignTile();
  syncMenu();
  if (!focus) return;
  if (setup) $('m-back').focus();
  else if (v === 'camps') $('m-missions').focus();
  else if (v === 'extra') ([...document.querySelectorAll('#m-extra .mx-row')].find((b) => !b.hidden) || $('m-extra-back')).focus();
  else $(MENU_VIEW_OPENER[from] || 'm-new').focus();
}

/** The Missions' progress: how many are finished (at any level) and the next to play. */
function missionsProgress() {
  const c = typeof loadCampaign === 'function' ? loadCampaign() : { done: {} };
  const fin = (m) => (c.done[m.id] || []).some(Boolean);
  const done = MISSIONS.filter(fin).length, next = MISSIONS.find((m) => !fin(m));
  return { done, n: MISSIONS.length, next: next ? next.name : null };
}

/** Home's Campaigns tile: a line of where you are. */
function syncCampaignTile() {
  const el = $('m-campaigns-sub');
  if (!el) return;
  const p = missionsProgress();
  el.textContent = `Missions ${p.done} of ${p.n}`;
}

/**
 * The Campaigns view: the Missions (the tutorial) with their progress; the Main Campaign, in preparation; Contingency,
 * which opens with openContingency() once that is built (and says it's coming until then; its status line may come from
 * contingencyMenuLine() when that exists); and room for co-op scenarios later.
 */
function renderCampaignHub() {
  const p = missionsProgress();
  $('m-missions-prog').innerHTML = `<span class="mh-bar" aria-hidden="true"><i style="width:${Math.round((100 * p.done) / Math.max(1, p.n))}%"></i></span>`
    + `${p.done} of ${p.n} done${p.next ? ` · Next up: <b>${p.next}</b>` : ' · All finished'}`;
  const ready = typeof openContingency === 'function';
  $('m-contingency').classList.toggle('is-soon', !ready);
  $('m-contingency').setAttribute('aria-disabled', ready ? 'false' : 'true');
  $('m-contingency-tag').hidden = ready;
  let line = null;
  try { line = ready && typeof contingencyMenuLine === 'function' ? contingencyMenuLine() : null; } catch (e) { line = null; }
  $('m-contingency-prog').textContent = line || 'Territory by territory, a year a turn. Every run a different war.';
}

/** Contingency's card: open it, or say it's coming. */
function menuOpenContingency() {
  if (typeof openContingency === 'function') { sfx('click'); audioUnlock(); openContingency(); return; }
  const tag = $('m-contingency-tag');
  tag.classList.remove('nudge'); void tag.offsetWidth; tag.classList.add('nudge');
}

/**
 * Arrow keys on the main menu's Home, Campaigns and More (a keyboard or a controller's d-pad mapped to them): the focus
 * moves to the nearest button that way. (Custom Game keeps its arrows: they pick within its choices.)
 */
function menuArrowKey(e) {
  const dirs = { ArrowUp: [0, -1], ArrowDown: [0, 1], ArrowLeft: [-1, 0], ArrowRight: [1, 0] }, d = dirs[e.key];
  if (!d || UI.inGame || $('screen-menu').hidden || UI.menuView === 'setup' || e.ctrlKey || e.metaKey || e.altKey || e.shiftKey) return;
  if (topScreen() !== $('screen-menu') || UI.picker) return;
  const a = document.activeElement, card = $('menu-card');
  if (a && /^(INPUT|SELECT|TEXTAREA)$/.test(a.tagName)) return;
  const all = [...card.querySelectorAll('button')].filter((b) => !b.disabled && b.offsetParent && b.getClientRects().length);
  if (!all.length) return;
  e.preventDefault();
  if (!a || !card.contains(a) || !all.includes(a)) { all[0].focus(); return; }
  const r = a.getBoundingClientRect(), cx = r.left + r.width / 2, cy = r.top + r.height / 2;
  let best = null, bs = Infinity;
  for (const b of all) {
    if (b === a) continue;
    const q = b.getBoundingClientRect(), bx = q.left + q.width / 2, by = q.top + q.height / 2;
    const along = (bx - cx) * d[0] + (by - cy) * d[1], across = Math.abs((bx - cx) * d[1] + (by - cy) * d[0]);
    // (that way at all: past the edge it leaves from, so a button beside it doesn't count as below it)
    const out = d[0] ? (d[0] > 0 ? q.left >= r.right - 2 : q.right <= r.left + 2) : (d[1] > 0 ? q.top >= r.bottom - 2 : q.bottom <= r.top + 2);
    if (along <= 0 || !out) continue;
    const score = along + across * 2;
    if (score < bs) { bs = score; best = b; }
  }
  if (best) best.focus();
}

/**
 * A row of choice buttons (all the options in view), shared by Custom Game and Observer mode: one per label, value its
 * index; `info(v)` gives each its data-info line, `meter` draws Terrain and Resources as level meters (a bar per step).
 * `onPick(v)` runs on a tap; `get()` (kept as el._get) is the value markSeg lights up.
 */
function segChoice(el, labels, get, onPick, info, meter) {
  el.innerHTML = '';
  labels.forEach((lab, v) => {
    const b = document.createElement('button');
    b.type = 'button'; b.dataset.v = v; b.setAttribute('role', 'radio');
    if (meter) { b.innerHTML = `<i style="height:${Math.round(28 + (72 * v) / Math.max(1, labels.length - 1))}%"></i>`; b.setAttribute('aria-label', lab); b.title = lab; }
    else b.textContent = lab;
    if (info) b.dataset.info = info(v);
    b.onclick = () => onPick(v);
    el.appendChild(b);
  });
  el._get = get;
}
/** A segChoice row lit up for its value: the choice on (and, on a meter, every bar up to it). */
function markSeg(el) {
  const v = el._get();
  for (const b of el.children) {
    const on = +b.dataset.v === v;
    b.classList.toggle('on', on); b.setAttribute('aria-checked', on ? 'true' : 'false'); b.classList.toggle('lit', +b.dataset.v <= v);
  }
}
/**
 * One line per section about the option under the mouse, or focused (its data-info), shared by Custom Game and
 * Observer mode: show(el or null) runs as that changes.
 */
function hoverInfo(sec, show) {
  const pickEl = (t) => { const k = t && t.closest && t.closest('[data-info]'); return k && sec.contains(k) ? k : null; };
  sec.addEventListener('pointerover', (e) => { if (e.pointerType === 'mouse') show(pickEl(e.target)); });
  sec.addEventListener('pointerleave', (e) => { if (e.pointerType === 'mouse') show(sec.contains(document.activeElement) && document.activeElement.matches(':focus-visible') ? pickEl(document.activeElement) : null); });
  sec.addEventListener('focusin', (e) => show(pickEl(e.target)));
  sec.addEventListener('focusout', (e) => { if (!sec.contains(e.relatedTarget)) show(null); });
}

function initMenu() {
  UI.menuHover = {};
  const pick = (fn) => () => { fn(); syncMenu(); saveSettings(); sfx('click'); };
  for (const btn of $('m-mode').children) btn.onclick = () => { setMenuMode(btn.dataset.v); syncMenu(); sfx('click'); };
  for (const btn of $('m-hgoal').children) btn.onclick = () => { if (btn.disabled) return; UI.menu.hgoal = btn.dataset.v; syncMenu(); saveSettings(); sfx('click'); };
  for (const btn of $('m-diff').children) { btn.dataset.info = DIFF_INFO[btn.dataset.v] || ''; btn.onclick = pick(() => { UI.menu.diff = btn.dataset.v; }); }
  for (const btn of $('m-players').children) btn.onclick = pick(() => { UI.menu.players = +btn.dataset.v; });
  for (const btn of $('m-teams').children) btn.onclick = pick(() => { UI.menu.teams = +btn.dataset.v; });
  for (const btn of $('m-coop').children) btn.onclick = pick(() => { UI.menu.coop = +btn.dataset.v; UI.mpCoopOf = {}; });
  // Custom Game's Host a co-op game: a multiplayer game with these settings, whoever joins sharing your colony.
  $('m-coophost').onclick = () => {
    sfx('click'); audioUnlock();
    if (UI.menu.mode !== 'horde') UI.menu.coop = 1; // (Horde: the partner gets a colony beside yours: mpCoopSeats)
    UI.mpCoopOf = {};
    saveSettings();
    showMenuView('home');
    openMulti();
    if (netName() && relayUrl()) $('mp-host').click();
  };
  for (const btn of $('m-victory').children) { btn.dataset.info = VICTORY[btn.dataset.v].info; btn.onclick = pick(() => { UI.menu.victory = btn.dataset.v; }); }
  const choice = (id, labels, get, set, info, meter) => segChoice($(id), labels, get, (v) => pick(() => set(v))(), info, meter);
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
  // The Murmur: Off, Quiet or Active (none on Argos: there a tap says why, in the Rules line).
  for (const btn of $('m-murmur').children) btn.onclick = () => {
    if (!menuMurmur() || UI.menu.mode === 'horde') { UI.menuHover['m-sec-rules'] = $('m-murmur-row'); syncInfo(); sfx('error'); return; }
    UI.menu.murmur = btn.dataset.v; UI.menuHover['m-sec-rules'] = btn; syncMenu(); saveSettings(); sfx('click');
  };
  // The Great Uplink win (beside Victory): it needs Megastructures, and there is no sky in the Hollow; a tap then says why.
  $('m-upwin-row').dataset.base = $('m-upwin-row').dataset.info;
  $('m-upwin').onchange = () => {
    if (!menuUpWinOk()) { $('m-upwin').checked = !!UI.menu.upwin; UI.menuHover['m-sec-match'] = $('m-upwin-row'); syncInfo(); sfx('error'); return; }
    UI.menu.upwin = $('m-upwin').checked ? 1 : 0; syncMenu(); saveSettings(); sfx('click');
  };
  for (const [id, k] of [['m-nuke', 'nuke'], ['m-mega', 'mega'], ['m-events', 'events'], ['m-unlimited', 'unlimited']]) {
    $(id).onchange = () => { UI.menu[k] = $(id).checked ? 1 : 0; syncMenu(); saveSettings(); sfx('click'); };
  }
  // Challenge modifiers (MODS): a switch each, mixed freely.
  $('m-mods').innerHTML = MOD_ORDER.map((k) => `<label class="tchip" id="m-mod-${k}-row" data-info="${esc(MODS[k].desc)}"><input type="checkbox" id="m-mod-${k}" role="switch"><span>${MODS[k].name}</span></label>`).join('');
  for (const k of MOD_ORDER) {
    $('m-mod-' + k).onchange = () => { const l = UI.menu.mods.filter((x) => x !== k); UI.menu.mods = modList($('m-mod-' + k).checked ? l.concat(k) : l); syncMenu(); saveSettings(); sfx('click'); };
  }
  // Time of day (looks only). Always day isn't on offer while the Murmur are on: a tap on it says why.
  for (const btn of $('m-daynight').children) {
    btn.dataset.info = TOD_INFO[btn.dataset.v];
    btn.onclick = () => {
      if (btn.dataset.v === 'day' && menuMurmurLevel() !== 'off') { UI.menuHover['m-sec-rules'] = btn; syncInfo(); sfx('error'); return; }
      setTodMode(btn.dataset.v); syncMenu(); sfx('click');
    };
  }
  $('m-weather').onchange = () => { setWeatherOn($('m-weather').checked); syncMenu(); sfx('click'); };
  for (const btn of $('m-gfx').children) { btn.dataset.info = GFX_INFO[btn.dataset.v]; btn.onclick = () => { setGfxStep(btn.dataset.v); syncMenu(); sfx('click'); }; }
  $('m-reroll').onclick = () => { UI.menu.seed = randomSeed(); syncMenu(); sfx('click'); };
  $('m-saveplanet').onclick = () => {
    savePlanet(menuPlanet()); sfx('place'); toast(`Saved Planet #${UI.menu.seed}: pick it from Saved planets any time.`, 'good'); syncMenu();
    // (Toasts belong to the game screen: say it on the button too.)
    const b = $('m-saveplanet'); b.textContent = 'Saved ✓'; clearTimeout(UI.savedFlash); UI.savedFlash = setTimeout(() => { b.textContent = 'Save'; }, 1600);
  };
  // The views. Tests and older code open Customise with $('m-more').open = true (it was a <details>).
  $('m-customise').onclick = () => { sfx('click'); showMenuView('setup', true); };
  $('m-campaigns').onclick = () => { sfx('click'); showMenuView('camps', true); };
  $('m-extras').onclick = () => { sfx('click'); showMenuView('extra', true); };
  $('m-camps-back').onclick = () => { sfx('click'); showMenuView('home', true); };
  $('m-extra-back').onclick = () => { sfx('click'); showMenuView('home', true); };
  $('m-contingency').onclick = menuOpenContingency;
  window.addEventListener('keydown', menuArrowKey);
  $('m-back').onclick = () => { sfx('click'); if (UI.mpSetup) mpSetupDone(); else showMenuView('home', true); };
  Object.defineProperty($('m-more'), 'open', { configurable: true, get: () => UI.menuView === 'setup', set: (v) => showMenuView(v ? 'setup' : 'home') });
  $('m-new').onclick = () => { audioUnlock(); if (UI.mpSetup) mpSetupDone(); else startNewGame(); };
  // Map type and Biome open their pickers.
  $('m-shape').onclick = () => { if (UI.menu.mode === 'horde') { UI.menuHover['m-sec-planet'] = $('m-shape'); syncInfo(); sfx('error'); return; } sfx('click'); openPicker('shape'); }; // (Horde: Long haul only)
  $('m-biome').onclick = () => { sfx('click'); openPicker('biome'); };
  $('m-biome2').onchange = () => { UI.menu.biome2 = $('m-biome2').value || null; syncMenu(); saveSettings(); };
  $('m-picker-close').onclick = () => closePicker();
  // Tapping outside the sheet closes it (on click, so the tap can't land on the menu underneath).
  $('m-picker').addEventListener('click', (e) => { if (e.target === $('m-picker')) closePicker(); });
  $('m-picker').addEventListener('keydown', pickerKey);
  // Esc: close the picker, then go back from Customise to Home.
  window.addEventListener('keydown', (e) => {
    if (UI.inGame || e.key !== 'Escape' || $('screen-menu').hidden) return;
    if (UI.menuSettings) { e.preventDefault(); closeMenuSettings(); return; }
    if (!$('screen-feedback').hidden) { e.preventDefault(); closeFeedback(); return; }
    if (!$('screen-lore').hidden) { e.preventDefault(); closeLore(); return; }
    if (UI.picker) { e.preventDefault(); closePicker(); return; }
    if (UI.setPop) { e.preventDefault(); closeSetPop(); return; }
    if (!$('screen-help').hidden) { e.preventDefault(); $('h-close').click(); return; }
    // (Multiplayer's first screen: Esc is its Back; in a lobby it's left alone, as Back there leaves the lobby)
    if (!$('screen-mp').hidden) { if (NET.state !== 'lobby' && !$('mp-back').hidden) { e.preventDefault(); $('mp-back').click(); } return; }
    // (the Missions over the menu: Esc steps back as their Back does, from a mission to the list, then to the menu)
    if (!$('screen-missions').hidden && $('screen-help').hidden && $('screen-stats').hidden) { e.preventDefault(); $('ms-close').click(); return; }
    const over = !$('screen-help').hidden || !$('screen-missions').hidden || !$('screen-stats').hidden;
    if (!over && topScreen() === $('screen-menu') && UI.menuView !== 'home') { e.preventDefault(); if (UI.menuView === 'setup') $('m-back').click(); else showMenuView('home', true); }
  });
  initSetPop();
  // One line per section about the option under the mouse, or focused, or else what's chosen.
  for (const sec of ['m-sec-match', 'm-sec-planet', 'm-sec-rules', 'm-sec-challenge']) hoverInfo($(sec), (k) => { UI.menuHover[sec] = k; syncInfo(); });
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
  const P = SHAPE_PRESETS[menuShownShape()];
  $('m-mode-desc').textContent = line('m-sec-match', modeInfo(m.mode, menuPlayers(), menuTeams()));
  const note = $('m-style-note'), html = doc ? docHTML(doc) : docNoteDefault();
  if (note.innerHTML !== html) note.innerHTML = html;
  $('m-planet-info').textContent = line('m-sec-planet', m.shapeRnd ? $('m-shape').dataset.info : `${P.name}: ${P.blurb || ''}`);
  // (On Lunar the Rules line says why the Murmur are off, a touch screen having no hover to ask with)
  $('m-rules-info').textContent = line('m-sec-rules', $('m-murmur-row').dataset.info);
  const mods = menuMods(), names = mods.map((k) => MODS[k].name);
  $('m-challenge-info').textContent = line('m-sec-challenge', mods.length === 1 ? MODS[mods[0]].desc
    : mods.length ? `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}. Win a Versus game with them on to earn their badges (Records).`
      : 'Challenge modifiers make a game harder: mix them as you like. Win a Versus game with one on and it earns a badge (Records).');
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
  const lines = [['m-sec-match', 'm-mode-desc'], ['m-sec-planet', 'm-planet-info'], ['m-sec-rules', 'm-rules-info'], ['m-sec-challenge', 'm-challenge-info'], [null, 'm-style-note']];
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

/** Size buttons shared by Custom Game and Observer. */
function syncSizeChoices(el, shape, players, random) {
  for (const button of el.children) {
    const size = +button.dataset.v, preset = SIZE_PRESETS[size];
    button.disabled = mapSizeForPlayers(size, players) !== size;
    if (button.disabled) {
      button.dataset.info = button.title = 'Planetary supports up to two colonies.';
      continue;
    }
    button.title = '';
    const { W, H } = mapDims({ size, shape, players });
    button.dataset.info = `${preset.name}: ${random ? 'about ' : ''}${W}×${H} tiles${random ? ' (map types differ a little)' : ''}.`;
  }
}

/** Bring every control in the menu up to date with UI.menu (and the device's time of day and weather). */
function syncMenu() {
  if (typeof ensureBiomeArt === 'function') ensureBiomeArt(BIOME_ORDER[UI.menu.biome || 0]); // the chosen biome's swatch
  const m = UI.menu, colony = m.mode !== 'versus', three = menuThree(), horde = m.mode === 'horde';
  const mark = (b, on) => { b.classList.toggle('on', on); if (b.getAttribute('role') === 'radio') b.setAttribute('aria-checked', on ? 'true' : 'false'); };
  for (const btn of $('m-mode').children) { mark(btn, btn.dataset.v === m.mode); btn.dataset.info = modeInfo(btn.dataset.v, false); }
  // Multiplayer settings (the host, from the lobby): Versus only; Players counts everyone, people first, computer rivals after.
  const mps = !!UI.mpSetup;
  // (Versus or Colony in multiplayer too: Colony is co-op, everyone sharing the host's colony)
  // Co-op: Custom Game hosts a co-op game; the multiplayer settings say whether people who join share the colony.
  // (Horde: co-op side by side, a colony each on Long Haul 2v2: see mpHordeSettings)
  $('m-coophost').hidden = mps;
  $('m-coophost').dataset.info = horde ? `Co-op Horde: you host a multiplayer game with these settings; a friend lands beside you with a colony of their own, allies at one end of ${HORDE.pair.shape}, the Maw at the other, and the waves ${HORDE.pair.mul} times as big. (In the lobby you can have them share your colony instead.)`
    : 'Two of you run this one colony together, each on their own device: you host a multiplayer game with these settings, and whoever joins shares your colony.';
  $('m-coop').hidden = !mps || colony;
  $('m-coop-row').hidden = mps && colony;
  for (const btn of $('m-coop').children) mark(btn, +btn.dataset.v === (m.coop ? 1 : 0));
  $('m-unlimited-row').hidden = mps;
  $('m-l-diff').textContent = horde ? 'Waves' : mps ? 'Computer rivals' : 'Rival';
  for (const btn of $('m-diff').children) { mark(btn, btn.dataset.v === m.diff); btn.dataset.info = (horde ? HORDE_DIFF_INFO : DIFF_INFO)[btn.dataset.v] || ''; }
  $('m-diff-field').hidden = colony && !horde;
  // Horde's goal: Fixed (survive HORDE.waves waves) or Endless; Warlord is always Endless.
  $('m-hgoal-field').hidden = !horde;
  for (const btn of $('m-hgoal').children) {
    const off = btn.dataset.v === 'fixed' && m.diff === 'warlord';
    mark(btn, btn.dataset.v === (m.diff === 'warlord' ? 'endless' : m.hgoal));
    btn.disabled = off;
    btn.dataset.info = off ? 'Warlord waves never end: always Endless.' : HORDE_GOAL_INFO[btn.dataset.v];
  }
  // (The Hollow has no Uplinks, the Pathfinder never having mapped it: that choice is greyed out, and the game is Capture.)
  const noUplinks = !m.shapeRnd && noSkyShape(m.shape), vic = noUplinks && m.victory === 'uplinks' ? 'capture' : m.victory || 'capture';
  for (const btn of $('m-victory').children) {
    mark(btn, btn.dataset.v === vic);
    const off = noUplinks && btn.dataset.v === 'uplinks';
    btn.disabled = off;
    btn.title = off ? noUplinksWhy(m.shape) : '';
  }
  // Teams (four colonies, two against two, Capture only): the Victory choice gives way to it.
  const teams = menuTeams();
  $('m-teams-field').hidden = colony || menuPlayers() !== 4;
  for (const btn of $('m-teams').children) { mark(btn, +btn.dataset.v === (teams ? 1 : 0)); btn.dataset.info = +btn.dataset.v ? '2 vs 2: you and the colony beside you against the other two. Take both of their Command Bases to win.' : 'Every colony for itself: the last one standing wins.'; }
  $('m-victory-field').hidden = colony || teams;
  $('m-victory-note').hidden = colony || teams;
  // The Great Uplink win: Versus only, any Victory (teams too); greyed out without Megastructures or in the Hollow.
  const upOk = menuUpWinOk();
  $('m-upwin-field').hidden = colony;
  $('m-upwin').checked = !!m.upwin && upOk;
  $('m-upwin-row').classList.toggle('on', !!m.upwin && upOk);
  $('m-upwin-row').classList.toggle('na', !upOk);
  $('m-upwin').setAttribute('aria-disabled', upOk ? 'false' : 'true');
  $('m-upwin-row').dataset.info = upOk ? $('m-upwin-row').dataset.base
    : !m.mega ? 'Great Uplink win: it needs Megastructures (Rules) on: the Great Uplink is one of them.' : 'Great Uplink win: not in the Hollow or Half underground, which have no open sky to transmit to.';
  $('m-victory-note').textContent = noUplinks && m.victory === 'uplinks' ? noUplinksWhy(m.shape).replace(/\.$/, '') + ': this game is won by Capture.' : (VICTORY[vic] || VICTORY.capture).note;
  // Free-for-all: you and two rivals on the map types with room for three, or three rivals on
  // Crossroads (Random picks a map type with room for them all).
  const shape = m.shape || 0, SH = SHAPE_PRESETS[shape], room = m.shapeRnd ? 4 : maxPlayers(shape), want = clamp(Math.round(m.players) || 2, 2, 4);
  $('m-players-field').hidden = colony;
  for (const btn of $('m-players').children) {
    const v = +btn.dataset.v;
    mark(btn, v === menuPlayers());
    if (!btn.dataset.lbl) btn.dataset.lbl = btn.textContent;
    btn.textContent = mps ? String(v) : btn.dataset.lbl; // (multiplayer: how many colonies, people and computers together)
    btn.disabled = v > room || (!m.shapeRnd && (v < minPlayers(shape) || !playersFit(shape, v)));
    btn.dataset.info = v === 2 ? '2 players: you and one rival colony, landing at the far end of the planet.'
      : !m.shapeRnd && v === 3 && !playersFit(shape, 3) ? `${SH.name} takes two or four colonies, not three (for now).`
      : modeInfo('versus', v) + (v <= room ? (m.shapeRnd || v >= minPlayers(shape) ? '' : ` (Not on ${SH.name}: it is for ${minPlayers(shape)} or more.)`)
        : v === 4 ? ` (Not on ${SH.name}: it has room for ${room === 3 ? 'three' : 'two'}. Pick a map type marked “3–4 players”.)` : ` (Not on ${SH.name}: pick a map type marked “3 players” or “3–4 players”.)`);
    if (mps) btn.dataset.info = `${v} colonies: the people in the lobby take the first, computer rivals the rest (more people than this, and they all play).` + (v <= room ? '' : ` (${SH.name} has room for ${room}.)`);
  }
  const few = !m.shapeRnd && want < minPlayers(shape);
  $('m-players-note').hidden = colony || (want <= room && !few);
  $('m-players-note').textContent = few ? `${SH.name} is made for ${minPlayers(shape) === room ? ['', '', 'two', 'three', 'four'][room] : 'three or four'} players: you'll play ${menuTeams() ? 'with an ally against two rivals' : `with ${minPlayers(shape) - 1} rivals`}.`
    : want === 4 ? `${SH.name} has room for ${room === 3 ? 'three players' : 'two players only'}: pick a map type marked “3–4 players” for four.`
    : `${SH.name} is for two players only: pick a map type marked “3 players” or “3–4 players” for a free-for-all.`;
  $('m-seed').textContent = 'Planet #' + m.seed;
  renderPlanets();
  if (menuDocAll() !== -1) UI.docPeek = null; // (a chip looked at before a tap gives it to them all: only while they differ)
  for (const id of ['m-size', 'm-rough', 'm-rich', 'm-style']) markSeg($(id));
  for (const b of $('m-style').children) b.classList.toggle('peek', UI.docPeek === +b.dataset.v);
  // (Random map type: sizes as on a Standard map; the others differ a little.)
  const players = mpHordePair() ? 4 : menuSizePlayers(), dShape = m.shapeRnd ? (players === 4 ? crossIdx() : 0) : menuShownShape(), dims = mapDims({ size: menuSize(), shape: dShape, players });
  syncSizeChoices($('m-size'), dShape, players, m.shapeRnd);
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
  // The Murmur: none on Lunar (Argos, the moon, is silent ground), so there it shows Off and can't be changed (the
  // setting itself is kept for the next biome).
  const silent = !menuMurmur(), mur = menuMurmurLevel();
  $('m-murmur-row').classList.toggle('na', silent || horde);
  // (The Hollow is their lair: it picks Active, and Off there says what's missing. Whether Off belongs there at all is the
  // owner's call: see IDEAS.md.)
  const lair = !m.shapeRnd && !!(SHAPE_PRESETS[m.shape || 0] || {}).hollow;
  const info = (v) => (lair && v === 'off' ? 'The Murmur: off. The Hollow is the Murmur\'s lair, and it plays best with them: with them off its nests stand empty and no surges come.' : MURMUR_INFO[v]);
  const noRoom = !m.shapeRnd && !murmurShape(m.shape || 0);
  $('m-murmur-row').dataset.info = horde ? 'The Murmur: always Active in Horde (the waves are theirs). There are no nests or nightly tunnels: only the Maw.' : silent ? (noRoom ? `The Murmur: none on ${SHAPE_PRESETS[m.shape || 0].name} (its land has no room for their nests: no tunnels, no raids).` : 'The Murmur: none on Argos, the moon (no nests, no tunnels, no raids).') : info(mur);
  for (const btn of $('m-murmur').children) { mark(btn, btn.dataset.v === mur); btn.dataset.info = silent || horde ? $('m-murmur-row').dataset.info : info(btn.dataset.v); }
  for (const [id, on] of [['m-nuke', m.nuke], ['m-mega', m.mega], ['m-events', m.events], ['m-unlimited', m.unlimited], ['m-weather', weatherOn()]]) {
    $(id).checked = !!on;
    $(id + '-row').classList.toggle('on', !!on);
  }
  // Time of day: with the Murmur on, Always day is off (they live by the night), and says so.
  for (const btn of $('m-daynight').children) {
    mark(btn, btn.dataset.v === menuTodMode());
    const locked = btn.dataset.v === 'day' && mur !== 'off';
    btn.classList.toggle('na', locked);
    btn.setAttribute('aria-disabled', locked ? 'true' : 'false');
    btn.dataset.info = locked ? 'Always day is off while the Murmur are in the game: they live by the night, so the day-and-night cycle stays on. Set The Murmur to Off to have it.'
      : btn.dataset.v === 'night' && mur !== 'off' ? 'Time of day: always night (looks only: the Murmur still come out at the game clock\'s nightfall, after the dusk warning; kept on this device).' : TOD_INFO[btn.dataset.v];
  }
  syncGfx();
  for (const k of MOD_ORDER) {
    const on = m.mods.includes(k);
    $('m-mod-' + k).checked = on;
    $('m-mod-' + k + '-row').classList.toggle('on', on);
    $('m-mod-' + k + '-row').hidden = colony && MODS[k].versus; // (Rival head start: Versus only)
  }
  syncPvMods();
  syncPickRows();
  // Random can't be saved as a planet: pick a map type and biome first.
  const rnd = !!(m.shapeRnd || m.biomeRnd);
  $('m-saveplanet').disabled = rnd;
  $('m-saveplanet').title = rnd ? 'Pick a map type and biome (not Random) to save this planet' : 'Keep this planet (with its map settings) to play again';
  const sum = menuSummary();
  $('m-more-sum').innerHTML = `<span class="sum-main">${sum.main}</span>` + (sum.extra ? `<span class="sum-extra"><span class="vh"> · </span>${sum.extra}</span>` : '');
  syncContinue(); // (the Continue card and Saved games: js/qol.js)
  if (UI.menuView === 'home') showCheckpoints('m');
  syncSetupRows();
  syncInfo();
  if (UI.setPop) placeSetPop();
  schedulePreview();
}

/**
 * The planet card's challenge modifiers (under its number): the ones on, each with a badge (◆) once you've won a game
 * with it (see metaModBadges in js/goals.js).
 */
function syncPvMods() {
  const el = $('m-pv-mods'), mods = menuMods(), won = typeof metaModBadges === 'function' ? metaModBadges() : {}, mur = menuMurmurLevel();
  // (the Murmur setting first, on its own line: Off, Quiet or Active)
  const html = `<span class="pvm-line"><span class="pvm-title">The Murmur</span><span class="pvm mur" title="${esc(MURMUR_INFO[mur])}">${MURMUR_NAMES[mur]}</span></span>` +
    (mods.length ? '<span class="pvm-line"><span class="pvm-title">Challenge</span>' + mods.map((k) => `<span class="pvm${won[k] ? ' won' : ''}" title="${esc(MODS[k].desc + (won[k] ? ' You have won with it: its badge is in Records.' : ''))}">${won[k] ? '<i aria-hidden="true">◆</i>' : ''}${MODS[k].name}</span>`).join('') + '</span>' : '');
  el.hidden = false;
  if (el.innerHTML !== html) el.innerHTML = html;
}

/** The Map type and Biome rows: the choice, with a thumbnail (redrawn as art arrives). */
function syncPickRows() {
  const m = UI.menu;
  shapePickRow($('m-shape'), m.shapeRnd, menuShownShape(), mpHordePair() ? 2 : menuPlayers());
  biomePickRow($('m-biome'), m.biomeRnd, m.biome || 0, biomeForced(m.shapeRnd, m.shape));
  syncSecondBiome('m', m, menuSize());
}

function secondBiomeChoices(m, size) {
  if (m.shapeRnd || m.biomeRnd) return [];
  return BIOME_ORDER.filter((key) => secondBiomeAllowed(key, BIOME_ORDER[m.biome || 0], size, m.shape || 0));
}

function chosenSecondBiome(m, size) {
  return m.biome2 && secondBiomeChoices(m, size).includes(m.biome2) ? m.biome2 : null;
}

function syncSecondBiome(prefix, m, size) {
  const choices = secondBiomeChoices(m, size), sel = $(prefix + '-biome2'), signature = choices.join(' ');
  $(prefix + '-biome2-row').hidden = !choices.length;
  if (sel.dataset.choices !== signature) {
    sel.replaceChildren(new Option('None', ''), ...choices.map((key) => new Option(BIOMES[key].name, key)));
    sel.dataset.choices = signature;
  }
  sel.value = choices.includes(m.biome2) ? m.biome2 : '';
  if (sel.value) ensureBiomeArt(sel.value);
}
/**
 * A Map type row (.m-pick), shared by Custom Game and Observer mode: Random (rnd, for np players) or map type `shape`.
 * `when` says when Random picks ('when you land').
 */
function shapePickRow(row, rnd, shape, np, when = 'when you land') {
  const SH = SHAPE_PRESETS[shape], three = np > 2;
  row.querySelector('.m-pick-name').textContent = rnd ? 'Random' : SH.name;
  row.querySelector('.m-pick-meta').textContent = rnd ? (np === 4 ? 'any for 4 players' : three ? 'any for 3 players' : 'any map type') : mapGroupName(SH.group);
  row.dataset.info = rnd ? `Random map type: ${np === 4 ? 'one with room for four players' : three ? 'one with room for three players' : 'any made for two'}, picked ${when}.` : `${SH.name}: ${SH.blurb || ''}`;
  row.setAttribute('aria-label', `Map type: ${rnd ? 'Random' : SH.name}. Change`);
  drawThumbOnce(row.querySelector('canvas'), 'shape:' + (rnd ? 'rnd' : shape), (cv) => drawShapeThumb(cv, rnd ? null : SH));
}
/** Does map type `shape` set its own look, whatever the biome picked? 'hollow' (The Hollow), 'ring' (The Ring: Argos's), 'orbital' (Orbital platforms: Argos's rules), or false. */
function biomeForced(rnd, shape) { const P = rnd ? null : SHAPE_PRESETS[shape || 0]; return P ? (P.hollow ? 'hollow' : P.asteroids ? 'ring' : P.orbital ? 'orbital' : false) : false; }
/** A Biome row (.m-pick), shared likewise: Random or BIOME_ORDER[biome] (`forced`: 'hollow' or 'ring', the map type sets its own look). */
function biomePickRow(row, rnd, biome, forced, when = 'when you land') {
  const ring = forced === 'ring' || forced === 'orbital', hollow = !!forced && !ring, mapName = forced === 'orbital' ? 'Orbital platforms' : 'The Ring';
  if (ring) { rnd = false; biome = BIOME_ORDER.indexOf('lunar'); }
  const bk = BIOME_ORDER[biome];
  row.querySelector('.m-pick-name').textContent = rnd ? 'Random' : biomeName(biome);
  row.querySelector('.m-pick-meta').textContent = rnd ? 'any biome' : (BIOMES[bk] && BIOMES[bk].kind) || '';
  row.dataset.info = rnd ? `Random biome: any of them, picked ${when}.` : `${biomeName(biome)} (${((BIOMES[bk] && BIOMES[bk].kind) || '').toLowerCase()}): ${(BIOMES[bk] && BIOMES[bk].desc) || ''}`;
  // (The Hollow has its own underground look: the Biome setting waits for another map.)
  if (hollow) {
    row.querySelector('.m-pick-meta').textContent = 'set by the map: The Hollow';
    row.dataset.info = `The Hollow has its own look, whatever the biome: ${BIOMES.hollow.desc} (The biome you pick here is for other maps.)`;
  }
  // (The Ring is on Argos's ground, in space: its look and its rules.)
  if (ring) {
    row.querySelector('.m-pick-meta').textContent = `set by the map: ${mapName}`;
    row.dataset.info = `${mapName} has Argos's rules (no Murmur, no weather), whatever the biome: ${BIOMES.lunar.desc} (The biome you pick here is for other maps.)`;
  }
  row.setAttribute('aria-label', `Biome: ${rnd ? 'Random' : biomeName(biome)}. Change`);
  drawThumbOnce(row.querySelector('canvas'), 'biome:' + (rnd ? 'rnd' : bk) + ':' + artCount(), (cv) => drawBiomeSwatch(cv, rnd ? null : bk));
}

/* ------------------------------------------------------------------ Custom Game's list and its pickers */

/**
 * Custom Game shows Match and Planet as a list: each row (.m-prow, data-pop the id of its control) says what the setting
 * is, and opens a picker for it (openSetPop). The control itself (the radio row, the doctrine chips, the Second biome
 * dropdown) lives hidden in the row (.m-ctl) and is moved into the picker while it is open, so every option keeps its
 * own handlers, info lines and greying out. syncSetupRows (from syncMenu) writes each row's value and hides a row whose
 * control is hidden.
 */
function setRowValue(id) {
  const el = $(id), m = UI.menu;
  if (!el) return ['', ''];
  if (el.tagName === 'SELECT') return [el.selectedOptions[0] ? el.selectedOptions[0].textContent : '', ''];
  if (id === 'm-style') {
    const all = menuDocAll();
    if (all === -1) return ['Each its own', menuCpuSlots().map((p) => docNameOf(menuSlotStyle(p))).join(' · ')];
    if (all === 0) return ['Random', menuCpuSlots().length > 1 ? 'a different one each' : 'picked when you land'];
    const k = docKeyOf(all), P = PERSONALITIES[isDoctrine(k) ? k : 'balanced'];
    return [P.name, P.plain];
  }
  const on = [...el.children].find((b) => b.classList.contains('on'));
  const name = on ? (on.getAttribute('aria-label') || on.textContent).trim() : '';
  if (id === 'm-size') return [name, ''];
  if (id === 'm-mode') return [name, m.mode === 'colony' ? 'no rival' : m.mode === 'horde' ? 'the Murmur\'s waves' : ''];
  if (id === 'm-hgoal') return [name, m.diff === 'warlord' ? 'Warlord' : m.hgoal === 'fixed' ? `${HORDE.waves} waves` : 'best wave kept'];
  if (id === 'm-diff' && m.mode === 'horde') return [name, 'waves'];
  if (id === 'm-victory') return [name, menuUpWin() ? '+ Great Uplink win' : ''];
  if (id === 'm-diff') return [name, menuThree() ? `${menuPlayers() - 1} rivals` : ''];
  return [name, ''];
}
function syncSetupRows() {
  for (const row of document.querySelectorAll('#m-more .m-prow[data-pop]')) {
    const ctl = $(row.dataset.pop);
    row.hidden = !ctl || ctl.hidden;
    const [v, sub] = setRowValue(row.dataset.pop), vEl = row.querySelector('.m-pv-v'), sEl = row.querySelector('small.m-pv-s');
    if (vEl.textContent !== v) vEl.textContent = v;
    if (sEl && sEl.textContent !== sub) sEl.textContent = sub;
    row.setAttribute('aria-label', `${row.querySelector('.m-rl').textContent}: ${v}${sub ? ' (' + sub + ')' : ''}. Change`);
  }
  syncAdvanced();
}

/** Advanced (Rules and Challenge): open or folded (UI.advOpen; open at first only on a screen big enough to show it beside Match and
 * Planet with no scrolling, 1700x1000 up). Folded, its line says what's set. */
function syncAdvanced() {
  if (UI.advOpen == null) UI.advOpen = innerWidth >= 1700 && innerHeight >= 1000;
  const t = $('m-adv-toggle'), m = UI.menu;
  t.setAttribute('aria-expanded', UI.advOpen ? 'true' : 'false');
  $('m-adv-body').hidden = !UI.advOpen;
  $('m-adv').classList.toggle('open', !!UI.advOpen);
  const rules = [['nuke', 'Nuclear race'], ['mega', 'Megastructures'], ['events', 'Planetary events'], ['unlimited', 'Unlimited resources']].filter(([k]) => m[k] && !(k === 'unlimited' && UI.mpSetup)).length + (weatherOn() ? 1 : 0);
  const mods = menuMods().length, mur = menuMurmurLevel();
  $('m-adv-sum').textContent = UI.advOpen ? '' : `Murmur ${MURMUR_NAMES[mur]} · ${rules} rule${rules === 1 ? '' : 's'} on · ${mods ? mods + ' challenge' + (mods > 1 ? 's' : '') : 'no challenge'}`;
}
function toggleAdvanced() {
  UI.advOpen = !UI.advOpen; sfx('click'); syncAdvanced(); sizeInfoLines();
  if (UI.advOpen) $('m-adv').scrollIntoView({ block: 'nearest' });
}

/** Is the picker a sheet from the bottom (a phone), or a popover beside its row? */
const setPopSheet = () => innerWidth < 700 || innerHeight < 500;
/** Open the picker for a row (its .m-prow button). */
function openSetPop(row) {
  if (UI.setPop) { const same = UI.setPop.row === row; closeSetPop(false); if (same) { row.focus(); return; } }
  const ctlWrap = row.parentElement.querySelector('.m-ctl'), kids = [...ctlWrap.children];
  const id = row.dataset.pop, ctl = $(id), pop = $('m-pop'), body = $('m-pop-body');
  UI.setPop = { row, ctlWrap, kids, id, sel: ctl && ctl.tagName === 'SELECT' ? ctl : null };
  $('m-pop-title').textContent = row.querySelector('.m-rl').textContent;
  body.replaceChildren(...kids);
  // (a dropdown becomes a list of choices, as the rest: the select stays behind, kept in step)
  if (UI.setPop.sel) {
    const sel = UI.setPop.sel, list = document.createElement('div');
    list.className = 'seg m-optlist'; list.setAttribute('role', 'radiogroup'); list.setAttribute('aria-labelledby', 'm-pop-title');
    for (const o of sel.options) {
      const b = document.createElement('button');
      b.type = 'button'; b.setAttribute('role', 'radio'); b.dataset.v = o.value; b.textContent = o.textContent;
      const on = o.value === sel.value; b.classList.toggle('on', on); b.setAttribute('aria-checked', on ? 'true' : 'false');
      b.onclick = () => { sel.value = o.value; sel.dispatchEvent(new Event('change')); sfx('click'); for (const x of list.children) { const y = x === b; x.classList.toggle('on', y); x.setAttribute('aria-checked', y ? 'true' : 'false'); } };
      list.appendChild(b);
    }
    sel.hidden = true;
    body.prepend(list);
  }
  pop.dataset.for = id;
  pop.classList.toggle('sheet', setPopSheet());
  $('m-pop-scrim').hidden = !setPopSheet();
  pop.hidden = false;
  row.setAttribute('aria-expanded', 'true');
  row.classList.add('open');
  setPopInfo(null);
  sizeInfoLines();
  placeSetPop();
  const first = popChoices().find((b) => b.classList.contains('on')) || popChoices()[0] || $('m-pop-close');
  first.focus({ preventScroll: true });
}
/** The choices in the open picker (enabled radios, then the rest of its buttons and fields). */
function popChoices() {
  return [...$('m-pop-body').querySelectorAll('button, select, input')].filter((b) => !b.disabled && b.getClientRects().length);
}
function placeSetPop() {
  const P = UI.setPop, pop = $('m-pop');
  if (!P) return;
  if (pop.classList.contains('sheet')) { pop.style.left = pop.style.top = pop.style.width = ''; return; }
  const r = P.row.getBoundingClientRect(), w = Math.min(380, innerWidth - 32);
  pop.style.width = w + 'px';
  let x = r.right + 12, y = r.top - 8;
  if (x + w > innerWidth - 16) { x = Math.max(16, Math.min(r.left, innerWidth - 16 - w)); y = r.bottom + 6; }
  pop.style.left = x + 'px'; pop.style.top = '0px';
  const h = pop.offsetHeight;
  if (y + h > innerHeight - 16) y = Math.max(16, (y > r.bottom ? r.top - 6 - h : innerHeight - 16 - h));
  pop.style.top = Math.max(16, y) + 'px';
}
function closeSetPop(restore = true) {
  const P = UI.setPop;
  if (!P) return;
  UI.setPop = null;
  if (P.sel) { P.sel.hidden = false; $('m-pop-body').querySelector('.m-optlist').remove(); }
  P.ctlWrap.replaceChildren(...P.kids);
  $('m-pop').hidden = true; $('m-pop-scrim').hidden = true;
  P.row.setAttribute('aria-expanded', 'false');
  P.row.classList.remove('open');
  syncSetupRows();
  if (restore && P.row.isConnected) P.row.focus({ preventScroll: true });
}
/** The picker's line: the option under the pointer or focused, or else the one chosen (the doctrine has its own line). */
function setPopInfo(el) {
  const P = UI.setPop, info = $('m-pop-info');
  if (!P) return;
  const own = P.id === 'm-style' || P.id === 'm-victory';
  const k = el && el.closest && el.closest('#m-pop-body [data-info]');
  const on = $('m-pop-body').querySelector('.on[data-info]');
  const t = own ? '' : (k || on) ? (k || on).dataset.info : '';
  info.textContent = t || '';
  info.hidden = !t;
}
/** Keys in a picker: ← → ↑ ↓ pick the next choice (as a radio group does), Enter (or Space) picks and closes, Esc closes,
 * Tab stays inside. */
function setPopKey(e) {
  if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); closeSetPop(); return; }
  const all = [$('m-pop-close'), ...popChoices()];
  if (e.key === 'Tab') {
    const i = all.indexOf(document.activeElement);
    if (e.shiftKey ? i <= 0 : i === all.length - 1) { e.preventDefault(); all[e.shiftKey ? all.length - 1 : 0].focus(); }
    return;
  }
  const a = document.activeElement, grp = a && a.getAttribute('role') === 'radio' && a.parentElement;
  const d = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }[e.key];
  if (d && grp) {
    e.preventDefault();
    const opts = [...grp.children].filter((b) => !b.disabled && b.getAttribute('aria-disabled') !== 'true' && !b.hidden);
    const b = opts[(opts.indexOf(a) + d + opts.length) % opts.length];
    if (b && b !== a) { UI.popArrow = true; b.click(); UI.popArrow = false; b.focus(); setPopInfo(b); }
    return;
  }
  if (e.key === 'Enter' && grp && UI.setPop.id !== 'm-style') {
    e.preventDefault(); a.click(); closeSetPop();
  }
}
function initSetPop() {
  const scrim = document.createElement('div');
  scrim.className = 'm-pop-scrim'; scrim.id = 'm-pop-scrim'; scrim.hidden = true;
  $('m-pop').before(scrim);
  for (const row of document.querySelectorAll('#m-more .m-prow[data-pop]')) row.onclick = () => { sfx('click'); openSetPop(row); };
  $('m-adv-toggle').onclick = toggleAdvanced;
  $('m-pop-close').onclick = () => closeSetPop();
  $('m-pop').addEventListener('keydown', setPopKey);
  $('m-pop').addEventListener('pointerover', (e) => { if (e.pointerType === 'mouse') setPopInfo(e.target); });
  $('m-pop').addEventListener('focusin', (e) => setPopInfo(e.target));
  // A pick in a single-choice picker closes it (after a moment, so the choice is seen lighting up); the doctrines stay open.
  $('m-pop-body').addEventListener('click', (e) => {
    const b = e.target.closest && e.target.closest('[role="radio"]');
    if (!b || UI.popArrow || !UI.setPop || UI.setPop.id === 'm-style' || b.disabled || b.getAttribute('aria-disabled') === 'true' || !b.classList.contains('on')) return;
    const P = UI.setPop; setTimeout(() => { if (UI.setPop === P) closeSetPop(); }, 140);
  });
  // The doctrine's line follows the pointer in the picker as it did in the list (UI.menuHover: syncInfo).
  hoverInfo($('m-pop'), (k) => { if (UI.setPop) { UI.menuHover['m-sec-match'] = k; syncInfo(); } });
  // A tap or click outside closes it (the row it came from toggles it itself).
  document.addEventListener('pointerdown', (e) => {
    if (!UI.setPop || $('m-pop').contains(e.target) || UI.setPop.row.contains(e.target)) return;
    closeSetPop(false);
  }, true);
  if (window.ResizeObserver) new ResizeObserver(() => { if (UI.setPop) placeSetPop(); }).observe($('m-pop'));
  window.addEventListener('resize', () => { if (UI.setPop) { $('m-pop').classList.toggle('sheet', setPopSheet()); $('m-pop-scrim').hidden = !setPopSheet(); placeSetPop(); } });
  $('m-body').addEventListener('scroll', () => { if (UI.setPop && !setPopSheet()) placeSetPop(); }, { passive: true });
}

/* ------------------------------------------------------------------ map type and biome pickers */

/**
 * The map type or biome picker. `ctx` says what it picks for: { shape, shapeRnd, biome, biomeRnd, want (players),
 * pick(kind, v) } (v a number, or 'rnd'); Custom Game's by default (Observer mode passes its own: js/watch.js).
 */
function openPicker(kind, ctx = menuPickCtx()) {
  if (kind === 'biome' && typeof ensureBiomeArt === 'function') for (const b of BIOME_ORDER) ensureBiomeArt(b); // their swatches fill in as it arrives
  const m = ctx, body = $('m-picker-body'), want = ctx.want;
  UI.picker = { kind, ctx, opener: document.activeElement };
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
        const P = SHAPE_PRESETS[i], badges = (P.evenOnly ? '<span class="badge ffa">2 or 4 players</span>' : maxPlayers(i) > 2 ? `<span class="badge ffa">${minPlayers(i) === maxPlayers(i) ? maxPlayers(i) : `${Math.max(3, minPlayers(i))}–${maxPlayers(i)}`.replace('3–3', '3')} players${minPlayers(i) > 2 ? ' only' : ''}</span>` : '') + (P.naval && !P.river ? '<span class="badge naval">Naval</span>' : '');
        return card(i, !m.shapeRnd && i === (m.shape || 0), text(P.name, badges, P.blurb || ''), '', P.blurb);
      }).join('') + '</div></section>';
    }
  } else {
    const inner = (name, desc) => `<canvas class="pc-swatch" aria-hidden="true"></canvas><span class="pc-name">${name}</span><span class="pc-blurb">${desc}</span>`;
    h += '<div class="pgrid">' + card('rnd', m.biomeRnd, inner('Random', 'Any biome, picked when you land.'), 'rnd')
      + BIOME_ORDER.map((k, i) => biomeAllowed(k, m.shapeRnd ? -1 : m.shape) ? card(i, !m.biomeRnd && i === (m.biome || 0), inner(BIOMES[k].name, `<b>${BIOMES[k].kind}.</b> ${BIOMES[k].desc || ''}`), '', `${BIOMES[k].kind}: ${BIOMES[k].desc}`) : '').join('') + '</div>';
  }
  body.innerHTML = h;
  for (const b of body.querySelectorAll('.pcard')) {
    b.setAttribute('aria-pressed', b.hasAttribute('aria-current') ? 'true' : 'false');
    b.onclick = () => { sfx('click'); closePicker(); ctx.pick(kind, b.dataset.v); };
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

/** Custom Game's picker context (see openPicker). */
function menuPickCtx() {
  const m = UI.menu;
  return { shape: m.shape || 0, shapeRnd: m.shapeRnd, biome: m.biome || 0, biomeRnd: m.biomeRnd, want: m.mode === 'versus' ? clamp(Math.round(m.players) || 2, 2, 4) : 2, pick: choosePicked };
}
function choosePicked(kind, v) {
  const m = UI.menu, rnd = v === 'rnd';
  if (kind === 'shape') { m.shapeRnd = rnd ? 1 : 0; if (!rnd) m.shape = +v; } else { m.biomeRnd = rnd ? 1 : 0; if (!rnd) m.biome = +v; }
  if (!biomeAllowed(BIOME_ORDER[m.biome || 0], m.shapeRnd ? -1 : m.shape || 0)) m.biome = 0;
  if (kind === 'shape' && !rnd && SHAPE_PRESETS[m.shape].teamDefault) { m.teams = 1; m.players = 4; } // (a map made for 2 vs 2: four players, Teams on, which you can still turn off)
  if (kind === 'shape' && !rnd && murmurLevelOk(SHAPE_PRESETS[m.shape].murmur)) m.murmur = SHAPE_PRESETS[m.shape].murmur; // (a map type with its own Murmur: the Hollow)
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

/** A map type at random with room for `want` players (Random, in Custom Game and Observer mode). */
function randomShape(want) {
  const pool = SHAPE_PRESETS.map((_, i) => i).filter((i) => playersFit(i, want));
  return pool.length ? pool[Math.floor(Math.random() * pool.length)] : 0;
}
function randomBiomeFor(shape, needsMurmur = false) {
  const list = BIOME_ORDER.filter((k) => biomeAllowed(k, shape) && (!needsMurmur || murmurGround(k)));
  return list[Math.floor(Math.random() * list.length)];
}

/** Random map type and biome: a concrete pick for the game about to start (3 players: map types with room for three). */
function resolveRandom() {
  const m = UI.menu, out = { shape: m.shape || 0, biome: m.biome || 0 };
  if (m.shapeRnd) out.shape = randomShape(m.mode === 'versus' ? clamp(Math.round(m.players) || 2, 2, 4) : 2);
  if (m.biomeRnd) out.biome = BIOME_ORDER.indexOf(randomBiomeFor(out.shape));
  else if (!biomeAllowed(BIOME_ORDER[out.biome], out.shape)) out.biome = 0;
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
  } else if (P.asteroids) {
    // The Ring: grey asteroids in space (a home rock at each end, stepping stones, a rich rock in the middle with a rock to each side),
    // the short gaps between them spanned (dashes: a Viaduct), a few stars and a few resource dots on the rocks.
    ctx.fillStyle = '#070a14'; ctx.fillRect(x0, y0, mw, mh);
    ctx.fillStyle = 'rgba(214,226,255,0.7)';
    for (let k = 0; k < 22; k++) ctx.fillRect(X(rnd()), Y(rnd()), Math.max(1, U * 0.012), Math.max(1, U * 0.012));
    const rock = (u, v, rx, ry) => blob(u, v, rx, ry, '#8b8d96', '#c3c5ce', true);
    const span = (u, v0, v1) => { line([[u, v0], [u, v1]], '#f2d27a', Math.max(1, U * 0.03), [U * 0.03, U * 0.03]); line([[1 - u, 1 - v0], [1 - u, 1 - v1]], '#f2d27a', Math.max(1, U * 0.03), [U * 0.03, U * 0.03]); };
    span(0.5, 0.58, 0.77); span(0.5, 0.64, 0.53);
    rock(0.5, 0.88, 0.32, 0.085); rock(0.5, 0.7, 0.1, 0.045); rock(0.15, 0.7, 0.1, 0.04); rock(0.5, 0.5, 0.17, 0.06); rock(0.14, 0.5, 0.08, 0.045);
    for (const [u, v, k] of [[0.34, 0.9, 1], [0.66, 0.84, 2], [0.5, 0.56, 3], [0.17, 0.7, 0], [0.16, 0.5, 1]]) { ctx.fillStyle = THUMB.res[k]; for (const [uu, vv] of [[u, v], [1 - u, 1 - v]]) { ctx.beginPath(); ctx.arc(X(uu), Y(vv), Math.max(1, U * 0.026), 0, 7); ctx.fill(); } }
    crags = 0;
  } else if (P.orbital) {
    // Orbital platforms: station decks over the planet's curve (a cloudy blue below, the dark of space above), a home deck at each end,
    // a middle deck and a side deck each side, the bridges between them (dashes) with their control boxes (dots).
    const gr = ctx.createLinearGradient(0, y0, 0, y0 + mh); gr.addColorStop(0, '#060b18'); gr.addColorStop(0.35, '#16386b'); gr.addColorStop(1, '#2c6aa8');
    ctx.fillStyle = gr; ctx.fillRect(x0, y0, mw, mh);
    ctx.fillStyle = 'rgba(255,255,255,0.22)'; for (const [u, v, rx] of [[0.2, 0.55, 0.12], [0.75, 0.7, 0.14], [0.55, 0.42, 0.09], [0.3, 0.85, 0.1], [0.85, 0.5, 0.07]]) { ctx.beginPath(); ctx.ellipse(X(u), Y(v), U * rx, U * rx * 0.34, 0, 0, 7); ctx.fill(); }
    ctx.fillStyle = 'rgba(214,226,255,0.7)'; for (let k = 0; k < 14; k++) ctx.fillRect(X(rnd()), Y(rnd() * 0.3), Math.max(1, U * 0.012), Math.max(1, U * 0.012));
    const deck = (u, v, rx, ry) => { for (const [uu, vv] of [[u, v], [1 - u, 1 - v]]) blob(uu, vv, rx, ry, '#6c7a90', '#a9b6c8', true); };
    const bridge = (u0, v0, u1, v1) => { for (const [a, b, c, d] of [[u0, v0, u1, v1], [1 - u0, 1 - v0, 1 - u1, 1 - v1]]) line([[a, b], [c, d]], '#f2d27a', Math.max(1.5, U * 0.04), [U * 0.03, U * 0.025]); };
    bridge(0.5, 0.56, 0.5, 0.77); bridge(0.18, 0.58, 0.18, 0.77); bridge(0.3, 0.46, 0.42, 0.46);
    deck(0.5, 0.88, 0.34, 0.075); deck(0.15, 0.62, 0.11, 0.07);
    blob(0.5, 0.5, 0.16, 0.12, '#6c7a90', '#a9b6c8', true);
    for (const [u, v, k] of [[0.34, 0.9, 1], [0.66, 0.86, 2], [0.5, 0.58, 3], [0.14, 0.62, 0], [0.45, 0.46, 2]]) { ctx.fillStyle = THUMB.res[k]; for (const [uu, vv] of [[u, v], [1 - u, 1 - v]]) { ctx.beginPath(); ctx.arc(X(uu), Y(vv), Math.max(1, U * 0.024), 0, 7); ctx.fill(); } }
    crags = 0;
  } else if (P.caves) {
    // Half underground: the caves dark in the top half (Ore and Crystal dots, rock pillars), the surface below (green fields), the wall
    // between with its middle gate and its two side mouths.
    ctx.fillStyle = '#1b1822'; ctx.fillRect(x0, y0, mw, mh * 0.5);
    ctx.fillStyle = THUMB.ground; ctx.fillRect(x0, y0 + mh * 0.5, mw, mh * 0.5);
    for (const [uu, vv, rr] of [[0.3, 0.7, 0.09], [0.7, 0.78, 0.09], [0.5, 0.62, 0.06]]) blob(uu, vv, rr, rr * 0.7, THUMB.green, null, false);
    ctx.fillStyle = '#4a4458'; for (const [uu, vv] of [[0.3, 0.2], [0.7, 0.3], [0.5, 0.35], [0.2, 0.36], [0.8, 0.12]]) { ctx.beginPath(); ctx.arc(X(uu), Y(vv), U * 0.05, 0, 7); ctx.fill(); }
    ctx.fillStyle = THUMB.res[1]; for (const [uu, vv] of [[0.34, 0.1], [0.66, 0.4], [0.15, 0.24], [0.85, 0.2]]) { ctx.beginPath(); ctx.arc(X(uu), Y(vv), Math.max(1, U * 0.03), 0, 7); ctx.fill(); }
    ctx.fillStyle = THUMB.res[2]; for (const [uu, vv] of [[0.66, 0.1], [0.34, 0.4], [0.45, 0.22], [0.55, 0.16]]) { ctx.beginPath(); ctx.arc(X(uu), Y(vv), Math.max(1, U * 0.03), 0, 7); ctx.fill(); }
    const wy = 0.5, wl = Math.max(2, U * 0.07);
    line([[0, wy], [0.14, wy]], THUMB.rock, wl); line([[0.26, wy], [0.46, wy]], THUMB.rock, wl); line([[0.54, wy], [0.74, wy]], THUMB.rock, wl); line([[0.86, wy], [1, wy]], THUMB.rock, wl);
    crags = 0;
  } else if (P.hollow) {
    // The Hollow: solid rock, caverns joined by passages, a chasm with its floating Crystal on each side, the Deep's
    // mound in the middle and the breaches' daylight (gold) over the bases and the flank caverns.
    ctx.fillStyle = '#16121a'; ctx.fillRect(x0, y0, mw, mh);
    const lw = Math.max(1.5, U * 0.05), cave = '#3a2d44', pair = (pts) => { line(pts, cave, lw); line(pts.map(([u, v]) => [1 - u, 1 - v]), cave, lw); };
    pair([[0.5, 0.86], [0.52, 0.66]]); pair([[0.52, 0.62], [0.5, 0.5]]); pair([[0.38, 0.88], [0.18, 0.72]]); pair([[0.66, 0.86], [0.84, 0.66]]);
    pair([[0.18, 0.68], [0.15, 0.55]]); pair([[0.84, 0.62], [0.85, 0.55]]); pair([[0.15, 0.52], [0.4, 0.52]]);
    for (const [u, v, rx, ry] of [[0.5, 0.86, 0.24, 0.1], [0.52, 0.64, 0.17, 0.06], [0.17, 0.72, 0.12, 0.06], [0.84, 0.66, 0.11, 0.06]]) blob(u, v, rx, ry, cave, null, true);
    blob(0.15, 0.5, 0.11, 0.13, cave, null, true);
    ctx.beginPath(); ctx.arc(X(0.5), Y(0.5), U * 0.16, 0, 7); ctx.fillStyle = cave; ctx.fill();
    for (const k of [1, -1]) { // the chasm, its arch and the floating mass
      const v = 0.5 + k * 0.14;
      line([[0.36, v], [0.68, v]], '#050307', Math.max(2, U * 0.05));
      line([[0.6, v - 0.025], [0.6, v + 0.025]], cave, Math.max(1.5, U * 0.05));
      ctx.beginPath(); ctx.arc(X(k > 0 ? 0.43 : 0.57), Y(v), U * 0.035, 0, 7); ctx.fillStyle = '#b98cff'; ctx.fill();
    }
    ctx.beginPath(); ctx.arc(X(0.5), Y(0.5), U * 0.045, 0, 7); ctx.fillStyle = '#7a2e6e'; ctx.fill();
    ctx.shadowColor = '#ffd98a'; ctx.shadowBlur = U * 0.12;
    for (const [u, v, r] of [[0.5, 0.88, 0.07], [0.5, 0.12, 0.07], [0.15, 0.44, 0.045], [0.15, 0.56, 0.045], [0.85, 0.44, 0.045], [0.85, 0.56, 0.045]]) {
      ctx.beginPath(); ctx.arc(X(u), Y(v), U * r, 0, 7); ctx.fillStyle = 'rgba(255,217,138,0.5)'; ctx.fill();
      ctx.beginPath(); ctx.arc(X(u), Y(v), Math.max(1, U * r * 0.45), 0, 7); ctx.fillStyle = '#ffe2a0'; ctx.fill();
    }
    ctx.shadowBlur = 0;
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
  } else if (P.haul4) {
    // Long Haul 2v2: two colonies side by side at each end, the riches strung along the long middle, the plaza with its
    // Trade Post at the very centre and more posts down the middle line (all mirrored both ways).
    const four = (u, v, f) => { for (const [uu, vv] of [[u, v], [1 - u, v], [1 - u, 1 - v], [u, 1 - v]]) f(uu, vv); };
    four(0.1, 0.66, (u, v) => blob(u, v, 0.07, 0.025, THUMB.rock, THUMB.rockHi));
    four(0.36, 0.78, (u, v) => blob(u, v, 0.08, 0.03, THUMB.hi));
    line([[0.5, 0.82], [0.5, 0.18]], THUMB.sand, Math.max(1, U * 0.035), [U * 0.06, U * 0.05]);
    ctx.beginPath(); ctx.arc(X(0.5), Y(0.5), U * 0.11, 0, 7); ctx.fillStyle = THUMB.hi; ctx.fill();
    for (const [u, v, k] of [[0.2, 0.6, 1], [0.38, 0.56, 2], [0.28, 0.68, 0], [0.4, 0.62, 1]]) four(u, v, (uu, vv) => { ctx.fillStyle = THUMB.res[k]; ctx.beginPath(); ctx.arc(X(uu), Y(vv), Math.max(1, U * 0.035), 0, 7); ctx.fill(); });
    for (const v of [0.5, 0.34, 0.66]) { ctx.fillStyle = '#ffd166'; ctx.fillRect(X(0.5) - U * 0.03, Y(v) - U * 0.03, U * 0.06, U * 0.06); }
    marks = [[0.28, 0.9], [0.72, 0.9], [0.72, 0.1], [0.28, 0.1]]; crags = 0;
  }
  if (P.grandCanyon) {
    const river = [[-0.05, 0.46], [0.14, 0.43], [0.34, 0.48], [0.5, 0.5], [0.66, 0.52], [0.86, 0.57], [1.05, 0.54]];
    line(river, THUMB.rock, U * 0.44);
    line(river, THUMB.lo, U * 0.32);
    line(river, THUMB.floor, U * 0.21);
    line(river, THUMB.waterHi, U * 0.09);
    line(river, THUMB.water, U * 0.055);
    const trail = [[0.55, 0.73], [0.49, 0.65], [0.55, 0.59], [0.48, 0.55]];
    line(trail, THUMB.ramp, Math.max(1, U * 0.024));
    line(trail.map(([u, v]) => [1 - u, 1 - v]), THUMB.ramp, Math.max(1, U * 0.024));
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
    // A mesa in each corner (its inner corner rounded), the lowland between them a cross of arms meeting at the plaza in
    // the middle, and three slopes off each mesa: one down each inner face and one off the corner, toward the plaza.
    ctx.fillStyle = THUMB.lo; ctx.fillRect(x0, y0, mw, mh);
    const m = 0.38, R = U * 0.12, rs = U * 0.055, ramp = (x, y) => { ctx.fillStyle = THUMB.ramp; ctx.fillRect(x - rs / 2, y - rs / 2, rs, rs); };
    for (const [sx, sy] of [[0, 1], [0, 0], [1, 0], [1, 1]]) {
      const fx = X(sx ? 1 - m : m), fy = Y(sy ? 1 - m : m), ox = sx ? X(1) + R : X(0) - R, oy = sy ? Y(1) + R : Y(0) - R;
      const rx = Math.min(fx, ox), ry = Math.min(fy, oy), rw = Math.abs(fx - ox), rh = Math.abs(fy - oy);
      ctx.save(); ctx.translate(U * 0.02, U * 0.03); ctx.fillStyle = 'rgba(0,0,0,0.45)'; roundRect(ctx, rx, ry, rw, rh, R); ctx.fill(); ctx.restore();
      ctx.fillStyle = THUMB.hi; roundRect(ctx, rx, ry, rw, rh, R); ctx.fill(); ctx.strokeStyle = THUMB.rockHi; ctx.lineWidth = Math.max(1, U * 0.015); ctx.stroke();
      const dx = sx ? 1 : -1, dy = sy ? 1 : -1;
      ramp(fx, (fy + (sy ? Y(1) : Y(0))) / 2); ramp((fx + (sx ? X(1) : X(0))) / 2, fy); ramp(fx + dx * 0.29 * R, fy + dy * 0.29 * R);
    }
    ctx.beginPath(); ctx.arc(X(0.5), Y(0.5), U * 0.1, 0, 7); ctx.fillStyle = THUMB.ground; ctx.fill();
    for (let k = 0; k < 4; k++) { ctx.fillStyle = THUMB.res[k % 3 + 1]; ctx.beginPath(); ctx.arc(X(0.5) + Math.cos(k * 1.6 + 0.8) * U * 0.06, Y(0.5) + Math.sin(k * 1.6 + 0.8) * U * 0.06, Math.max(1, U * 0.03), 0, 7); ctx.fill(); }
    marks = [[0.19, 0.81], [0.19, 0.19], [0.81, 0.19], [0.81, 0.81]]; crags = 0;
  }
  if (P.volcano) {
    for (const [r, c] of [[0.3, '#3a2620'], [0.22, '#5a3a2c'], [0.13, '#7a4a34']]) { ctx.beginPath(); ctx.arc(X(0.5), Y(0.5), U * r, 0, 7); ctx.fillStyle = c; ctx.fill(); }
    ctx.shadowColor = THUMB.lava; ctx.shadowBlur = U * 0.12;
    for (let k = 0; k < 6; k++) { const t = (k / 6) * Math.PI * 2 + rnd() * 0.4, r1 = 0.07, r2 = 0.24 + rnd() * 0.12; line([[0.5 + (Math.cos(t) * r1 * U) / mw, 0.5 + (Math.sin(t) * r1 * U) / mh], [0.5 + (Math.cos(t + 0.15) * (r1 + r2) * 0.5 * U) / mw, 0.5 + (Math.sin(t + 0.15) * (r1 + r2) * 0.5 * U) / mh], [0.5 + (Math.cos(t) * r2 * U) / mw, 0.5 + (Math.sin(t) * r2 * U) / mh]], THUMB.lava, Math.max(1, U * 0.03)); }
    ctx.beginPath(); ctx.arc(X(0.5), Y(0.5), U * 0.06, 0, 7); ctx.fillStyle = THUMB.lavaHi; ctx.fill();
    ctx.shadowBlur = 0;
    crags = 0;
  }
  if (P.city) {
    // Passenger Town: a band of blocks across the middle, a street grid through it.
    const nx = 6, ny = 4, v0 = 0.3, v1 = 0.7;
    for (let a = 0; a < nx; a++) for (let b = 0; b < ny; b++) {
      const u = 0.02 + (a / nx) * 0.96, v = v0 + (b / ny) * (v1 - v0), bw = 0.96 / nx * 0.72, bh = (v1 - v0) / ny * 0.7;
      ctx.fillStyle = (a * 7 + b * 3) % 5 === 0 ? '#9aa3a8' : '#6c7378'; ctx.fillRect(X(u), Y(v), bw * mw, bh * mh);
      if ((a + b) % 3 === 0) { ctx.fillStyle = '#ffcf7a'; ctx.fillRect(X(u + bw * 0.3), Y(v + bh * 0.3), Math.max(1, bw * mw * 0.15), Math.max(1, bh * mh * 0.15)); }
    }
    crags = 0;
  }
  if (P.walker) {
    // The Walking Factory: its yard and loop round the middle, and the machine on its legs in the cradle.
    const cx = X(0.5), cy = Y(0.5), R = U * 0.22;
    ctx.fillStyle = 'rgba(236,210,154,0.28)'; ctx.beginPath(); ctx.arc(cx, cy, R * 1.35, 0, 7); ctx.fill();
    ctx.strokeStyle = 'rgba(70,52,36,0.8)'; ctx.lineWidth = Math.max(1, U * 0.035); ctx.beginPath(); ctx.arc(cx, cy, R, 0, 7); ctx.stroke();
    ctx.strokeStyle = '#d8b04a'; ctx.lineWidth = Math.max(1, U * 0.03);
    for (const k of [-1, 0, 1]) for (const sd of [-1, 1]) { ctx.beginPath(); ctx.moveTo(cx + k * U * 0.06, cy); ctx.lineTo(cx + k * U * 0.075, cy + sd * U * 0.08); ctx.stroke(); }
    ctx.fillStyle = '#5b6066'; ctx.fillRect(cx - U * 0.1, cy - U * 0.055, U * 0.2, U * 0.11);
    ctx.fillStyle = '#d8b04a'; ctx.fillRect(cx - U * 0.1, cy - U * 0.055, U * 0.2, U * 0.02);
    crags = 0;
  }
  if (P.dam) {
    // The Dam: the high shelf down the middle, a lake on it toward each base behind a dam, the valley below fanning out.
    ctx.fillStyle = THUMB.hi; ctx.fillRect(X(0.32), Y(0.2), 0.36 * mw, 0.6 * mh);
    for (const [v, s] of [[0.66, 1], [0.34, -1]]) {
      ctx.fillStyle = '#3f7fae'; ctx.beginPath(); ctx.ellipse(X(0.5), Y(v), 0.14 * mw, 0.07 * mh, 0, 0, 7); ctx.fill();
      ctx.fillStyle = '#d8d2c2'; ctx.fillRect(X(0.45), Y(v + s * 0.1) - Math.max(1, U * 0.02), 0.1 * mw, Math.max(2, U * 0.04));
      ctx.fillStyle = THUMB.ramp; for (const u of [0.36, 0.6]) ctx.fillRect(X(u), Y(v + s * 0.12) - U * 0.02, U * 0.05, U * 0.04);
    }
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
  if (!P.maze && !P.sky && !P.hollow && !P.asteroids && !P.orbital && !P.caves && !marks) for (let k = 0; k < 3; k++) { const u = 0.15 + rnd() * 0.7, v = 0.6 + rnd() * 0.12; ctx.fillStyle = THUMB.res[k % 4]; for (const [uu, vv] of [[u, v], [1 - u, 1 - v]]) { ctx.beginPath(); ctx.arc(X(uu), Y(vv), Math.max(1, U * 0.03), 0, 7); ctx.fill(); } }
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
  b = artBiome(b); // (a biome drawn with another's art: the Hollow)
  const own = b === 'desert' ? ART.ground : ART['ground-' + b];
  if (own || !biomeLook(b) || typeof biomeTexture !== 'function') return own || null;
  try { return biomeTexture(b, 'ground'); } catch (e) { return null; }
}
function biomeLook(b) { b = artBiome(b); return typeof BIOME_LOOK === 'object' && BIOME_LOOK[b] ? BIOME_LOOK[b] : null; }

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
  const spots = b === 'springs' ? [[0.29, 0.47, 1.12, 1], [0.71, 0.58, 0.96, 2], [0.55, 0.36, 0.46, 4]]
    : w / h > 1.4 ? [[0.22, 0.6, 0.95, 1], [0.58, 0.42, 0.8, 3], [0.84, 0.72, 0.6, 6]] : [[0.32, 0.4, 0.95, 1], [0.72, 0.68, 0.7, 3]];
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
  if (typeof watchPickRows === 'function' && !$('screen-watch').hidden) watchPickRows(); // (Observer mode's setup: js/watch.js)
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
/**
 * Horde in the multiplayer settings: is the co-op game side by side (Long Haul 2v2, a colony each: true) or one shared
 * colony (Long haul: false)? Side by side once a partner is in, and before anyone has joined; null outside them.
 */
function mpHordePair() {
  if (UI.menu.mode !== 'horde' || !UI.mpSetup || typeof mpHordeSettings !== 'function') return null;
  const H = mpHordeSettings(false), alone = !NET.seats || NET.seats.filter((x) => x.on).length < 2;
  return !!(H.horde.pair || (alone && !mpCoopSeats().length));
}
/** The map type the setup screen shows: the one picked, or Horde co-op's (mpHordePair). */
function menuShownShape() { const pair = mpHordePair(); return pair === null ? UI.menu.shape || 0 : hordeShape(pair); }
function previewSettings() {
  const m = UI.menu, mode = m.mode !== 'versus' ? 'colony' : 'versus';
  const st = { size: clamp(menuSize(), 0, SIZE_PRESETS.length - 1), rough: clamp(m.rough ?? DEFAULT_ROUGH, 0, TERRAIN_PRESETS.length - 1), rich: clamp(m.rich ?? DEFAULT_RICH, 0, RESOURCE_PRESETS.length - 1) };
  st.shape = clamp(m.shape || 0, 0, SHAPE_PRESETS.length - 1);
  st.players = playerCount(mode, st.shape, m.players);
  // Horde in the multiplayer settings: the map the co-op game will be played on. Side by side (the default once a partner
  // is in, and before anyone has joined) is Long Haul 2v2 with four places; a partner tapped to share the host's colony
  // makes it one colony on Long haul (mpHordeSettings).
  if (mpHordePair() !== null) { const pair = mpHordePair(); st.shape = hordeShape(pair); st.players = pair ? 4 : 2; st.size = clamp(mapSizeForPlayers(st.size, st.players), 0, SIZE_PRESETS.length - 1); }
  st.nuke = !!m.nuke;
  if (mode === 'versus' && m.teams && st.players === 4) st.teams = true; // (Four Isles: the allies' sandbars)
  st.biome = m.biomeRnd ? 'desert' : BIOME_ORDER[m.biome || 0] || 'desert';
  st.biome2 = chosenSecondBiome(m, st.size);
  return { seed: m.seed >>> 0, mode, st };
}
function previewKey() {
  const p = previewSettings(), s = p.st;
  return UI.menu.shapeRnd ? 'rnd' : [p.seed, UI.menu.mode, s.shape, s.size, s.rough, s.rich, s.players, s.nuke ? 1 : 0, s.biome, s.biome2, s.teams ? 1 : 0].join(':');
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
  const bio = (SHAPE_PRESETS[p.st.shape || 0] || {}).hollow ? 'hollow' : (SHAPE_PRESETS[p.st.shape || 0] || {}).asteroids || (SHAPE_PRESETS[p.st.shape || 0] || {}).orbital ? 'lunar' : p.st.biome; // (the Hollow has its own look; The Ring is on Argos's ground)
  const look = biomeLook(bio) || biomeLook('desert'), mm = (look && look.mm) || {};
  const C = { ground: mm.ground || [169, 113, 74], water: mm.water || [28, 75, 93], rock: mm.rock || [74, 51, 41], ramp: mm.ramp || [235, 205, 150],
    chasm: (SHAPE_PRESETS[p.st.shape || 0] || {}).asteroids || (SHAPE_PRESETS[p.st.shape || 0] || {}).orbital ? [7, 10, 20] : [18, 12, 10], fertile: [92, 98, 40] }; // (space, on The Ring)
  if (!look || !look.mm) { const G = biomeGround(bio); const c = G && typeof avgColor === 'function' ? avgColor(G) : null; if (c) C.ground = c; }
  const caveMask = m.cave || null; // (Half underground: the caves are the Hollow's look over their tiles)
  const other = caveMask ? biomeLook('hollow')?.mm : p.st.biome2 ? biomeLook(p.st.biome2)?.mm : null;
  const boundary = other && !caveMask ? biomeBoundary(m.terrain, W, H, p.seed) : 0;
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
    if (other) {
      const key = terr === T_GROUND && c === C.ground ? 'ground' : terr === T_WATER ? 'water' : terr === T_ROCK ? 'rock' : null;
      if (key && other[key]) c = mixBiomeRGB(c, other[key], caveMask ? (caveMask[t] ? 1 : 0) : biomeMixAt(i, j, W, H, p.seed, boundary));
    }
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
  // Horde: the Maw at the far end, in the Murmur's violet.
  if (UI.menu.mode === 'horde' && m.bases[1]) {
    const b = m.bases[1], cx = x0 + (b.x + 0.5) * k, cy = y0 + (b.y + 0.5) * k;
    ctx.beginPath(); ctx.arc(cx, cy, k * 6, 0, Math.PI * 2);
    ctx.fillStyle = WILD_COLOR + '40'; ctx.fill();
    ctx.setLineDash([4, 3]); ctx.strokeStyle = '#ff5a6a'; ctx.lineWidth = 1.4; ctx.stroke(); ctx.setLineDash([]);
    ctx.shadowColor = WILD_COLOR; ctx.shadowBlur = 10;
    ctx.fillStyle = WILD_COLOR; ctx.beginPath(); ctx.arc(cx, cy, Math.max(4, k * 1.6), 0, Math.PI * 2); ctx.fill();
    ctx.shadowBlur = 0;
  }
  ctx.restore();
  ctx.strokeStyle = 'rgba(255,255,255,0.16)'; ctx.lineWidth = 1; roundRect(ctx, x0 + 0.5, y0 + 0.5, mw - 1, mh - 1, 6); ctx.stroke();
}

/* ------------------------------------------------------------------ autosave */

// Continue keeps its own save. Restore points are optional if the device is short on space.
const AUTOSAVE_EVERY = 60, CHECKPOINT_LIMIT = 5, CHECKPOINT_KEY = 'terrafall.restorePoints.v1';
let checkpointDB;

function readCheckpoints() {
  try {
    const book = JSON.parse(localStorage.getItem(CHECKPOINT_KEY));
    if (typeof book?.run === 'string' && Array.isArray(book.entries)) return book;
  } catch (e) { /* blocked or damaged history */ }
  return null;
}

function removeCheckpointBook() {
  try { localStorage.removeItem(CHECKPOINT_KEY); return true; } catch (e) { return false; }
}

// Read the previous version's history until a localStorage book is available for this game.
function legacyCheckpoints(run) {
  if (!checkpointDB) {
    checkpointDB = new Promise((resolve, reject) => {
      const req = indexedDB.open('terrafall.checkpoints', 1);
      req.onupgradeneeded = () => req.result.createObjectStore('history');
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }
  return checkpointDB.then((db) => new Promise((resolve, reject) => {
    const read = db.transaction('history', 'readonly').objectStore('history').get('recent');
    read.onsuccess = () => {
      const book = read.result;
      resolve(book && (run === null || book.run === run) ? book.entries : []);
    };
    read.onerror = () => reject(read.error);
  }));
}

function canRestoreCheckpoint() {
  return S && UI.inGame && !UI.watch && !MP.on && !S.players[ME].ai;
}

function canChooseCheckpoint(prefix) {
  if (prefix === 'm') return !UI.inGame && UI.menuView === 'home' && !$('screen-menu').hidden;
  return canRestoreCheckpoint();
}

function canCheckpoint() {
  return canRestoreCheckpoint() && !UI.saveHold && S.winner < 0;
}

function checkpointTick() {
  if (!canCheckpoint() || UI.paused || S.time + 1e-6 < UI.nextCheckpoint) return;
  const time = S.time, run = S.checkpointRun;
  UI.nextCheckpoint = (Math.floor((time + 1e-6) / AUTOSAVE_EVERY) + 1) * AUTOSAVE_EVERY;
  const json = serializeGame(), prior = readCheckpoints();
  if (typeof contIronman === 'function' && contIronman()) { autoSave(json); return; } // (Ironman: the autosave alone)
  const earlier = prior?.run === run ? prior.entries.filter((e) => e.time < time) : [];
  const entries = [{ time, json, at: Date.now() }, ...earlier].slice(0, CHECKPOINT_LIMIT);
  autoSave(json, prior ? removeCheckpointBook : undefined);
  // Keep the newest snapshots first. A failed setItem leaves the previous book intact.
  while (entries.length) {
    try {
      localStorage.setItem(CHECKPOINT_KEY, JSON.stringify({ run, entries }));
      UI.checkpointFailed = false;
      return;
    } catch (e) { entries.pop(); }
  }
  if (!UI.checkpointFailed && !UI.saveFailed) {
    UI.checkpointFailed = true;
    toast('This browser couldn’t keep a restore point. Continue is still available.', 'warn');
  }
}

/** How long ago a restore point was kept, in real time ("just now", "3 min ago", "2 h ago", "yesterday"). */
function checkpointAgo(ms) {
  const min = Math.floor(Math.max(0, ms) / 60000);
  if (min < 1) return 'just now';
  if (min < 60) return `${min} min ago`;
  const h = Math.floor(min / 60);
  if (h < 24) return `${h} h ago`;
  const d = Math.floor(h / 24);
  return d === 1 ? 'yesterday' : `${d} days ago`;
}

/** A restore point's line in the list: its game time, and how long ago it was kept (game minutes, for one kept before `at`). */
function checkpointLabel(e, now) {
  const ago = Number.isFinite(e.at) ? checkpointAgo(Date.now() - e.at)
    : ((m) => (m > 0 ? `${m} game min ago` : 'just now'))(Math.floor((now - e.time + 1e-6) / AUTOSAVE_EVERY));
  return `${fmtClock(e.time)} in game · ${ago}`;
}

async function showCheckpoints(prefix = 'p') {
  const game = S, row = $(prefix + '-checkpoint-row'), select = $(prefix + '-checkpoint');
  const fromMenu = prefix === 'm';
  const run = fromMenu ? null : game?.checkpointRun;
  // The pause menu's Restore points item: shown in a solo game (none in multiplayer, watching or Ironman), with a line
  // saying when the first comes while there's none yet.
  const group = prefix === 'p' ? $('p-checkpoint-group') : null, hint = group && $('p-checkpoint-hint');
  row.hidden = true;
  if (group) group.hidden = true;
  if (!canChooseCheckpoint(prefix) || (!fromMenu && !run)) return;
  if (!fromMenu && typeof contIronman === 'function' && contIronman(game)) return; // (Ironman: none to choose)
  if (group) {
    group.hidden = false;
    hint.textContent = `None yet: one is kept every game minute (the first at ${fmtClock(UI.nextCheckpoint || AUTOSAVE_EVERY)}), the last ${CHECKPOINT_LIMIT} on this device.`;
  }
  try {
    const book = readCheckpoints();
    const stored = book && (fromMenu || book.run === run) ? book.entries : await legacyCheckpoints(run);
    if ((!fromMenu && S !== game) || !canChooseCheckpoint(prefix)) return;
    const entries = stored.filter((e) => typeof e?.json === 'string' && Number.isFinite(e.time) &&
      (fromMenu || e.time <= game.time + 1e-6)).slice(0, CHECKPOINT_LIMIT);
    if (!entries.length) return;
    if (fromMenu) {
      let seed;
      try { seed = JSON.parse(entries[0].json)?.seed; } catch (e) { /* The selected entry is checked when restored. */ }
      $('m-checkpoint-game').textContent = Number.isInteger(seed) ? `Recent restore points for Planet #${seed}` : 'Recent solo restore points';
    }
    const now = fromMenu ? entries[0].time : game.time;
    select.replaceChildren(...entries.map((e, i) => new Option(fromMenu || prefix === 'p' ? checkpointLabel(e, now) : `Restore point: ${checkpointLabel(e, now)}`, i)));
    if (hint) hint.textContent = `The last ${entries.length === 1 ? 'one' : entries.length}, a game minute apart: pick one and Restore to go back to it.`;
    $(prefix + '-checkpoint-restore').onclick = () => restoreCheckpoint(entries[+select.value], prefix);
    row.hidden = false;
  } catch (e) { /* history is unavailable; Continue remains independent */ }
}

function restoreCheckpoint(entry, prefix) {
  if (entry && typeof contIronmanSave === 'function' && (contIronmanSave(entry.json) || (prefix !== 'm' && contIronman()))) { if (prefix === 'm') menuMsg(CONT_IRONMAN_NO); else toast(CONT_IRONMAN_NO, 'warn'); return; }
  if (!entry || !canChooseCheckpoint(prefix) || !window.confirm(`Go back to the restore point at ${fmtClock(entry.time)} in game? What happened since then is lost.`)) return;
  if (prefix === 'm') audioUnlock();
  if (loadSaveText(entry.json, 'Restore point loaded.')) {
    $('screen-pause').hidden = true;
    $('screen-over').hidden = true;
  } else if (prefix === 'm') menuMsg('That restore point couldn’t be loaded.');
  else toast('That restore point couldn’t be loaded.', 'warn');
}

function autoSave(json, makeRoom) {
  // (UI.saveHold: the game keeps failing, see `stage` in main.js. The last good save is left alone.)
  if (!canCheckpoint()) return;
  if (saveGame(json) || (makeRoom?.() && saveGame(json))) { UI.savedAt = Date.now(); UI.saveFailed = false; }
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
  const stops = (scr) => [...scr.querySelectorAll('button, a[href], input, select, textarea, summary, #keys-body')].filter((el) => !el.disabled && el.tabIndex >= 0 && el.offsetParent);
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
    if (a && a.closest && a.closest('[aria-modal="true"]:not(.screen), .m-pop')) return; // (a dialog of its own, such as the menu's pickers, keeps its Tab)
    if (!f.length) { e.preventDefault(); return; }
    if (!scr.contains(a)) { e.preventDefault(); (e.shiftKey ? last : first).focus(); }
    else if (e.shiftKey ? a === first || !f.includes(a) : a === last) { e.preventDefault(); (e.shiftKey ? last : first).focus(); }
  }, true);
}

function syncRivalDifficulty() {
  const diff = $('p-difficulty');
  // (hidden where the level is fixed, a mission, a Contingency battle or a watched game, and for everyone but the host)
  $('p-difficulty-row').hidden = !S || S.winner >= 0 || rivalDifficultyFixed() || !!UI.watch ||
    (MP.on && !mpIsHost()) || !rivalDifficultyTargets().length;
  if (S) diff.value = S.difficulty;
}

function syncSaved() {
  syncRivalDifficulty();
  $('p-withdraw').hidden = !(S && S.contingency && S.winner < 0); // (a Contingency battle: js/contingency-battle.js)
  syncPauseMods();
  if (UI.syncTod) UI.syncTod();
  syncCloud(); // (Save to the cloud: not in multiplayer or Observer mode)
  const el = $('p-saved');
  if (!el) return;
  if (UI.watch) { el.textContent = 'Observer mode: nothing here is saved, and your own game stays as it was.'; $('p-quit').textContent = 'Back to the menu'; return; }
  const iron = typeof contIronman === 'function' && contIronman();
  $('p-export').hidden = $('p-slots').hidden = iron;
  if (iron) { el.textContent = CONT_IRONMAN_NO; return; }
  const s = UI.savedAt ? Math.round((Date.now() - UI.savedAt) / 1000) : -1;
  el.textContent = UI.saveHold ? 'Saving is paused: something in the game keeps going wrong. Reload the page to carry on from your last save.'
    : UI.saveFailed ? 'Saving isn’t working in this browser right now. Keep this tab open or choose Save → File to keep a copy.'
    : 'Your game saves itself every in-game minute'  + (s >= 0 ? ` (last saved ${s < 5 ? 'just now' : s < 60 ? s + ' s ago' : Math.round(s / 60) + ' min ago'})` : '') + '. If it closes, tap Continue on the main menu.';
}

/** The pause menu's line of this game's challenge modifiers (each named in full when pointed at), and the Murmur setting. */
function syncPauseMods() {
  const el = $('p-mods'), mods = S ? gameMods() : [], mur = S && !S.mission ? murmurLevel() : 'off';
  if (!el) return;
  const parts = [];
  if (S && !S.mission) parts.push(`<b>The Murmur:</b> <span title="${esc(mur === 'off' ? MURMUR_INFO.off : MURMUR_INFO[mur])}">${MURMUR_NAMES[mur]}</span>`);
  if (mods.length) parts.push('<b>Challenge:</b> ' + mods.map((k) => `<span title="${esc(MODS[k].desc)}">${MODS[k].name}</span>`).join(' · '));
  el.hidden = !parts.length;
  el.innerHTML = parts.join('<br>');
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
    pauseSwitch('p-full', on);
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
  tip.innerHTML = `<b>${GOOD[g].name}</b> <em>${el.lastChild.textContent}</em><span>${GOOD[g].desc}</span>${UI.inGame ? goodRateTip(g) : ''}`;
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
 * it: R roads, G bridges and tunnels, V ramps, E pave, O one-way arrows, L junctions, T traffic map, Shift+T goods flow map) · Q army · H base · F select every warbot · 1–9 control groups (Ctrl or
 * Shift + digit to save) · Shift+F a Bot Foundry's Order bots list · J jump to the latest alert (again: the one before) ·
 * F1–F4 a camera spot (Shift+F1–F4 keeps one: js/qol.js) · Esc back / clear selection / pause ·
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
    toast(all.length ? 'Your Bot Foundry is still being built.' : 'You have no Bot Foundry yet: Build (B) → Make (2) → Bot Foundry (B).', 'warn');
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
 * 4 Defend, 5 Mega (the megastructures), 6 Terraform (its tools and buildings); Tab steps through them), then a building's letter on that tab starts placing it. Letters
 * are per tab, so there's room for every building without number or Fn keys. W, A, S and D always pan the
 * map, and B closes the menu except on the Make tab, where B is the Bot Foundry (Build, 2, B). R lays roads (the Move tab's Roads card) except on a tab with a
 * building on R (Gather: Ore Mine; Make: Refinery), where R picks that building; the
 * Defend tab's Walls card is X, as in Paths.
 */
const BUILD_KEYS = {
  gather: { harvester: 'h', quarry: 'q', mine: 'r', tap: 'c', grower: 'g', farm: 'f', pump: 'p', fueltank: 't' },
  make: { kiln: 'c', smelter: 'm', fab: 'f', refinery: 'r', tarworks: 't', foundry: 'b', armory: 'i', munitions: 'n', reactor: 'y', lab: 'l', generator: 'g' },
  move: { charger: 'f', depot: 'e', roadworks: 'o', station: 'n', magterm: 'g', mdriver: 'v', catcher: 'c', port: 'p', airfield: 'i', mast: 't', terminal: 'm' },
  defend: { outpost: 'o', turret: 't', minigun: 'g', bunker: 'u', keep: 'k', disruptor: 'z', mortar: 'm', flak: 'f', repair: 'r', silo: 'i', nukesilo: 'n' },
  mega: { lance: 'l', sunder: 'y', dome: 'h', city: 'c', lift: 'o', atmos: 'n', deepcore: 'e', gup: 'u' }, // (the Deep Core: E, for dEep; D pans; the Sundering Ray: Y, for raY: S pans too; the Atmosphere Engine: N, for eNgine: A pans)
  // The Terraform tab's tools (not buildings: tf-<tool>, see TF_TOOLS_UI in js/terraform.js): Raise, Lower, Flatten, fill sHallows, dig Channel.
  // Then stage 2: Spread sOil, rEclaim, and its buildings: the CoMposter (M), the Tree Nursery (N), the Water Pump (P);
  // and stage 3's: the Seam drIll (I), the Seed Mast (G, for Grow: S pans), the Thermal Plant (T); stage 4's: the Earth banK (K),
  // the Fire Trench (X, as Walls), Dragon's Teeth (Z), caVe in (V), the slUice (U) and the Sap Head (Q).
  terra: { 'tf-raise': 'r', 'tf-lower': 'l', 'tf-flatten': 'f', 'tf-fill': 'h', 'tf-dig': 'c', 'tf-soil': 'o', 'tf-reclaim': 'e', composter: 'm', nursery: 'n', wpump: 'p', seamdrill: 'i', seedmast: 'g', thermal: 't', 'tf-bank': 'k', 'tf-trench': 'x', 'tf-teeth': 'z', 'tf-cave': 'v', sluice: 'u', saphead: 'q' },
};
const BUILD_TAB_KEYS = { gather: '1', make: '2', move: '3', defend: '4', mega: '5', terra: '6' };
/**
 * The Paths tools on Shift and a letter, from anywhere: Viaducts, Ropeways and Maglev lines (placed with two taps, see
 * enterPlaceMode). Every plain letter already has a job, so they're Shift with the letters they had in the
 * build menu (Move, V and Y), V beside Ramps, and M for the Maglev. (Shift+F is the Bot Foundry's Order bots.)
 */
const PATHS_SHIFT_KEYS = { v: 'viaduct', y: 'ropeway', m: 'maglev', e: 'express' };
/** The Paths tools placed with two taps like a building (R.mode 'place'): Viaducts, Ropeways and Maglev lines. */
const CROSSING_TOOLS = ['viaduct', 'ropeway', 'maglev'];
/** Is a Viaduct, Ropeway or Maglev line being placed (a Paths tool, though it's placed like a building: R.mode 'place')? */
function crossingPlacing() { return R.mode === 'place' && CROSSING_TOOLS.includes(UI.placeType); }
/**
 * Keys for the buttons on a building's or robot's panel, by button id. While that panel is open they win over
 * the same letter's usual job (the key is shown on the button on a computer). Delete or Backspace dismantles,
 * pressed twice like the button.
 */
const SHEET_KEYS = {
  'sh-send': ['q', 'Send warbots'],
  'sh-bombard': ['q', 'Bombard a building'],
  'sh-fire': ['f', 'Fire missile'],
  'sh-aim': ['f', 'Aim missiles or the Lance'],
  'sh-rgo': ['g', 'Drive somewhere'],
  'sh-crawl': ['g', 'Drive somewhere'],
  'sh-deploy': ['e', 'Deploy here'],
  'sh-gate': ['g', 'Make a Gate'],
  'sh-move': ['m', 'Move or cancel move'],
  'sh-pack': ['m', 'Pack up to move'],
  'sh-pause': ['p', 'Pause or resume production'],
  'sh-fixbtn': ['e', 'Repair'],
  'ag-resume': ['b', 'Back to order (Army Group)'],
  'ag-order-hold': ['h', 'Hold (Army Group)'],
  'ag-order-defend': ['g', 'Defend area (Army Group)'],
  'ag-order-patrol': ['p', 'Patrol (Army Group)'],
  'ag-order-attack': ['q', 'Attack (Army Group)'],
  'ag-order-follow': ['f', 'Follow (Army Group)'],
  'ag-order-raid': ['r', 'Raid (Army Group)'],
  'ag-select': ['v', 'Select the group'],
  'ag-goto': ['c', 'Go to the group'],
  'sh-layroad': ['r', 'Lay road'],
  'sh-pipe': ['k', 'Pipe it in'],
  'sh-recall': ['c', 'Call back this squad'],
  'sh-unpost': ['c', 'Send back stationed warbots'],
  'sh-lstop': ['c', 'Stand down the Lance'],
  'sh-sdeep': ['f', 'Sundering Ray: Strike the Deep'],
  'sh-squake': ['q', 'Sundering Ray: Quake'],
  'sh-sstop': ['c', 'Stand down the Sundering Ray'],
  'sh-storm': ['f', 'Atmosphere Engine: Storm Front'],
  'sh-sluice': ['o', 'Open or shut the Sluice'],
  'sh-sap': ['t', 'Plan the sap'],
  'sh-stormoff': ['c', 'Call the storm off'],
  'rl-recall': ['c', 'Call back a rally'],
  'sh-land': ['l', 'Choose the beach'],
  'sh-st-send': ['v', 'Station here'],
  'nk-evac': ['v', 'Evacuate a strike zone'],
  'sh-bomb': ['z', 'Bomb it'],
  'sh-napalm': ['n', 'Napalm'],
  'sh-scorch': ['x', 'Scorch the earth'],
  'sh-strike': ['q', 'Pick a target'],
  'sh-fsail': ['g', 'Sail somewhere'],
  'sh-fembark': ['e', 'Take warbots aboard'],
  'sh-fland': ['l', 'Put them ashore'],
  'sh-fhome': ['h', 'Back to its line'],
  'sh-found': ['p', 'Found a Port'],
  'sh-fout': ['o', 'Sail out of the Port'],
  'sh-tarmor': ['r', 'Armor this train'],
  'ar-attack': ['q', 'Attack'],
  'al-attack': ['q', 'Ally: Attack here'],
  'al-defend': ['g', 'Ally: Defend this area'],
  'al-help': ['h', 'Ally: Help me'],
  'al-hold': ['b', 'Ally: Hold back'],
  'al-cancel': ['c', 'Ally: Back to its own plan'],
  'ar-hold': ['g', 'Hold ground'],
  'ar-station': ['v', 'Station'],
  'ar-recall': ['c', 'Recall all'],
  'ar-select': ['f', 'Select all warbots'],
  'ar-n2': ['1', 'Group of 2'],
  'ar-n4': ['2', 'Group of 4'],
  'ar-n8': ['3', 'Group of 8'],
  'ar-nall': ['4', 'Group of all'],
  'ar-tab-army': ['z', 'Army tab'],
  'ar-tab-air': ['x', 'Air tab'],
  'ar-strike': ['e', 'Strike: pick a target'],
  'sh-tgo': ['g', 'Start or change a trade route'],
  'sh-tstop': ['x', 'Stop trade route'],
  'sh-escort': ['o', 'Toggle trade escort'], // (O, not E: E is Repair, on the same panel when the Terminal is damaged)
  'sh-mlink': ['l', 'Link Mooring Masts'],
  'sh-munlink': ['l', 'Unlink Mooring Masts'],
  'sh-magline': ['l', 'Plan a Maglev line'],
  'sh-magrebuild': ['b', 'Rebuild the missing Terminal'], // (B, not L: L is Add a line, on the same panel)
  'sh-lf-security': ['z', 'Call down Security'],
  'sh-lf-crew': ['x', 'Call down Crew'],
  'sh-lf-alloy': ['c', 'Call down Alloy'],
  'sh-lf-chips': ['v', 'Call down Chips'],
  'sh-gup-begin': ['t', 'Begin Uplink transmission'],
  'sh-gup-stop': ['c', 'Stand down the Uplink'],
  'sh-strip': ['s', 'Passenger Town: Strip for salvage'],
  'sh-unstrip': ['s', 'Passenger Town: Stop stripping'],
  'sh-board': ['e', 'The Walking Factory: Send warbots aboard'],
  'sh-damwreck': ['d', 'The Dam: Demolish the dam'],
  'sh-mwreck': ['d', 'Megastructure: Demolish it, or seize it'],
  'sh-damstop': ['d', 'The Dam: Stop demolishing'],
  'sh-dammend': ['u', 'The Dam: Shore it up'],
  'sh-focus': ['t', 'Aim a defence at an enemy'],
  'sh-focus-clear': ['x', 'Clear a defence\'s aim'],
  'sh-damunmend': ['u', 'The Dam: Stop shoring up'],
};
const ARMY_SIZE_KEYS = Object.fromEntries(Object.entries(SHEET_KEYS)
  .filter(([id]) => id.startsWith('ar-n')).map(([id, [key]]) => [key, id]));
/** Mark the open panel's buttons with their keys (SHEET_KEYS), for the hints shown on a computer. */
function markSheetKeys() {
  for (const id in SHEET_KEYS) { const el = $(id); if (el && !el.dataset.key) el.dataset.key = SHEET_KEYS[id][0].toUpperCase(); }
  const d = $('sh-demolish') || $('sh-recycle'); if (d && !d.dataset.key) d.dataset.key = 'Del';
}
/**
 * SHEET_KEYS buttons that live outside the panels (the incoming-nuke card's Evacuate): their key works with no panel
 * open too, and with one open when that panel has no button of its own on the key (nor the build menu's tab a card on it).
 */
const LOOSE_SHEET_KEYS = new Set(['nk-evac']);
/** The open panel's button for key k, if it's showing and can be pressed (else a loose one's: LOOSE_SHEET_KEYS). */
function sheetKeyButton(k) {
  const open = !!UI.sheetKind && UI.sheetKind !== 'build';
  if (k === 'delete' || k === 'backspace') { if (!open) return null; const d = $('sh-demolish') || $('sh-recycle'); return d && !d.disabled && d.offsetParent ? d : null; }
  let loose = null;
  for (const id in SHEET_KEYS) {
    if (SHEET_KEYS[id][0] !== k) continue;
    const el = $(id);
    if (!el || el.disabled || el.hidden || !el.offsetParent) continue;
    if (LOOSE_SHEET_KEYS.has(id)) { loose = loose || el; continue; }
    if (open) return el;
  }
  if (loose && UI.sheetKind === 'build' && Object.values(BUILD_KEYS[UI.buildTab] || {}).includes(k)) return null;
  return loose;
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

/**
 * Open Paths on one of its tools (roads, bridges, ramps, arrows, junctions...). Viaducts and Ropeways are placed with
 * two taps, like a building (enterPlaceMode), with the Paths tools still showing and a plan sketched kept for after.
 */
function openPaths(v) {
  if (CROSSING_TOOLS.includes(v)) { enterPlaceMode(v); sfx('click'); return; }
  if (R.mode !== 'road') setMode('road');
  UI.roadMode = v;
  showRoadBanner();
  sfx('click');
}

// Each row names the action bound on the map, before an individual tool or panel takes precedence.
const MAP_KEYS = [
  { keys: ['b'], group: 'build', label: 'Toggle Build', run: () => { $('btn-build').click(); } },
  { keys: ['p'], group: 'paths', label: 'Toggle Paths on the last tool', run: () => { $('btn-road').click(); } },
  { keys: ['r'], group: 'paths', label: 'Toggle Paths on Roads', run: () => {
    if (R.mode === 'road' && UI.roadMode === 'road' && !UI.route) $('btn-road').click(); else openRoadDraw();
  } },
  { keys: ['o'], group: 'paths', label: 'Arrows', run: () => openPaths('arrows') },
  { keys: ['g'], group: 'paths', label: 'Bridges', run: () => openPaths('bridge') },
  { keys: ['v'], group: 'paths', label: 'Ramps', run: () => openPaths('ramp') },
  { keys: ['e'], group: 'paths', label: 'Pave', run: () => openPaths('pave') },
  { keys: ['t'], group: 'paths', label: 'Traffic map', run: () => togglePathsMap('traffic', R.traffic) },
  { keys: ['l'], group: 'paths', label: 'Junctions and traffic lights', run: () => openPaths('lights') },
  { keys: ['x'], group: 'paths', label: 'Walls (Versus)', run: () => { if (warOn()) openPaths('wall'); } },
  { keys: ['n'], group: 'paths', label: 'Rail', run: () => openPaths('rail') },
  { keys: ['k'], group: 'paths', label: 'Pipes', run: () => openPaths('pipe') },
  { keys: ['z'], group: 'paths', label: 'Toggle Route to', run: toggleRoute },
  { keys: ['q'], group: 'army', label: 'Toggle Army panel', run: () => { if (!$('btn-attack').hidden) $('btn-attack').click(); } },
  { keys: ['c'], group: 'army', label: 'Recall all warbots', run: () => { if (warOn()) recallAllWarbots(); } },
  { keys: ['h', 'home'], group: 'camera', label: 'Go to your Command Base', run: () => { $('btn-home').click(); } },
  { keys: ['m'], group: 'camera', label: 'Toggle minimap', run: () => setMinimap(!MM.on) },
  { keys: ['f'], group: 'selection', label: 'Select all warbots', run: () => {
    selectBots(armyIds(ME), false);
    if (UI.sel.length) toast(`${UI.sel.length} warbots selected: right-click to give orders.`, 'info');
  } },
  { keys: ['i'], group: 'panels', label: 'Statistics: the Economy panel\'s History', run: () => { if (UI.sheetKind === 'econ' && UI.ecTab === 'hist') closeSheet(); else if ($('screen-stats').hidden) statsHere(); } },
  { keys: ['u'], group: 'panels', label: 'Your robots', run: () => { $('pop').click(); } },
  { keys: ['y'], group: 'panels', label: 'Toggle Economy: your goods, their chains and bottlenecks', run: () => {
    if (UI.sheetKind === 'econ') closeSheet(); else openEconomy();
  } },
  { keys: ['j'], group: 'camera', label: 'Jump to the latest alert (again: the one before)', run: () => jumpAlert() },
  { keys: ['['], group: 'game', label: 'Slow down', run: () => { stepSpeed(-1); } },
  { keys: [']'], group: 'game', label: 'Speed up', run: () => { stepSpeed(1); } },
  { keys: ['+', '='], group: 'camera', label: 'Zoom in', run: () => zoomBy(1.25) },
  { keys: ['-', '_'], group: 'camera', label: 'Zoom out', run: () => zoomBy(0.8) },
  { keys: ['?'], group: 'panels', label: 'How to play', run: showHelp },
  { keys: [','], group: 'army', label: 'Pick idle warbots (again: the next group)', run: () => nextIdleArmy() },
  { keys: ['tab'], group: 'army', label: 'Command view: your Army Groups from above (drag one to send it, tap it for its panel)', run: () => toggleCmdView() },
  { keys: ['.'], group: 'army', label: 'Ping under the pointer for your team (multiplayer; Alt+click too)', run: () => typeof coopPingHere === 'function' && !!coopPingHere(true) },
];
const SHIFT_KEYS = {
  f: { group: 'panels', label: 'Order bots (again for the next Foundry)', run: openFoundryOrders },
  w: { group: 'panels', label: 'Workforce: what your Workers are doing, and who gets them first', run: () => { if (UI.sheetKind === 'wf') closeSheet(); else openWorkforce(); } },
  t: { group: 'paths', label: 'Toggle Goods flow', run: () => togglePathsMap('goods', R.goodsMap) },
  a: { group: 'army', label: 'Ally: command your computer teammate (team games)', run: () => openAllySheet(), when: () => myAiAllies().length > 0 }, // (else Shift+A pans, as A does)
  ...Object.fromEntries(Object.entries(PATHS_SHIFT_KEYS).map(([k, tool]) => [k, {
    group: 'paths', label: { viaduct: 'Viaducts', ropeway: 'Ropeways', maglev: 'Maglev lines', express: 'Express' }[tool],
    run: () => openPaths(tool),
  }])),
};
function togglePathsMap(map, on) {
  if (R.mode !== 'road') setMode('road');
  setRoadMap(on ? '' : map);
  showRoadBanner();
  sfx('click');
}

const SHORTCUT_SHEET_KEY = '/';
let keysWasPaused = null;

function openKeys() {
  const top = topScreen();
  if (!UI.inGame || UI.briefing || (top && top.id !== 'screen-pause')) return false;
  if (!MP.on) { keysWasPaused = UI.paused; UI.paused = true; }
  R.keys.clear();
  renderKeys();
  $('screen-keys').hidden = false;
  $('keys-body').scrollTop = 0;
  return true;
}

function closeKeys() {
  $('screen-keys').hidden = true;
  if (!MP.on && keysWasPaused !== null) UI.paused = keysWasPaused;
  keysWasPaused = null;
}

/** Show context-specific bindings alongside the ones used on the map. */
function renderKeys() {
  const names = { home: 'Home', tab: 'Tab', arrowleft: '←', arrowright: '→', arrowup: '↑', arrowdown: '↓' };
  const caps = (keys) => keys.map((key) => `<kbd>${names[key] || (key.length === 1 ? key.toUpperCase() : key)}</kbd>`).join(' ');
  const row = ([keys, label]) => `<div class="ks-row"><dt>${caps(keys)}</dt><dd>${label}</dd></div>`;
  const section = (title, rows, intro = '') => `<section class="ks-group"><h3>${title}</h3>${intro}<dl>${rows.map(row).join('')}</dl></section>`;
  const sub = (title, rows) => `<h4>${title}</h4><dl>${rows.map(row).join('')}</dl>`;
  const map = (group) => [
    ...MAP_KEYS.filter((b) => b.group === group).map(({ keys, label }) => [keys, label]),
    ...Object.entries(SHIFT_KEYS).filter(([, b]) => b.group === group).map(([key, { label }]) => [[`Shift+${key.toUpperCase()}`], label]),
  ];
  // Use the panel button bindings, combining actions that share a key on different panels.
  const panel = (prefix) => {
    const byKey = new Map();
    for (const [id, [key, label]] of Object.entries(SHEET_KEYS)) {
      if (id.startsWith('ar-') !== (prefix === 'army')) continue;
      if (!byKey.has(key)) byKey.set(key, new Set());
      byKey.get(key).add(label);
    }
    return [...byKey].sort(([a], [b]) => a.localeCompare(b)).map(([key, labels]) => [[key], [...labels].join(' · ')]);
  };
  const tabs = Object.entries(BUILD_TAB_KEYS).map(([group, key]) => {
    const def = BUILD_GROUPS.find(({ key }) => key === group);
    const title = `${caps([key])} ${def ? def.name : 'Terraform'}`;
    const rows = Object.entries(BUILD_KEYS[group] || {}).map(([type, letter]) => [[letter], BDEFS[type] ? BDEFS[type].name : TF_TOOLS_UI[type.slice(3)].name]);
    if (def?.roads) rows.unshift([['r'], 'Roads']);
    if (def?.walls) rows.unshift([['x'], 'Walls']);
    return sub(title, rows);
  });
  const col = (...sections) => `<div class="ks-column">${sections.join('')}</div>`;
  $('keys-body').innerHTML = col(
    section('Camera', [
      [Object.keys(PAN_KEYS), 'Pan the map'],
      ...map('camera'),
      [['Shift + scroll'], 'Pan sideways with a trackpad'],
      [['F1–F4'], 'Go to a camera spot'],
      [['Shift+F1–F4'], 'Keep this view as a camera spot'],
      [['F'], 'Follow the action (Observer)'],
    ]),
    section('Selection and control groups', [
      ...map('selection'),
      [['Shift + drag'], 'Add warbots to selection'],
      [['Ctrl/Cmd/Shift+1–9'], 'Save selected warbots or the open building'],
      [['1–9'], 'Recall a group or building; twice to center'],
      [['Alt/⌥+1–6'], 'Select Army Group 1–6; twice to go to it'],
      [['Alt/⌥+Shift+1–6'], 'Open Army Group 1–6’s panel'],
    ]),
    section('Game', [
      [['Space'], 'Pause or resume. Save from the pause menu.'],
      [['Shift+Space', 'Pause'], 'Plan while paused: build and give orders, the game still (Space resumes)'],
      [['Esc'], 'Step back or open Pause'],
      ...map('game'),
      [['Alt+Enter'], 'Toggle full screen'],
      [['Shift+P'], 'Enter or leave Photo mode'],
      [['`'], 'Toggle Boosts'],
    ]),
  ) + col(
    section('Build menu', [
      ...map('build'),
      [['Tab', 'Shift+Tab'], 'Next or previous build tab'],
      [['Ctrl/Cmd+Z'], 'Undo a just-placed site'],
      [['R'], 'Rotate a blueprint, Mass Driver or Orbital Lift'],
      [['Shift+R'], 'Turn Orbital Lift the other way'],
    ]),
    `<section class="ks-group ks-build" aria-label="Build tabs">${tabs.join('')}</section>`,
  ) + col(
    section('Paths tools', [
      ...map('paths'),
      [['Shift + drag'], 'Draw a single Express lane'],
      [['Esc', 'Ctrl/Cmd+Z'], 'Undo last Paths stroke'],
    ]),
    section('Army (Q) and orders', [
      ...map('army'),
      [['Enter'], 'Confirm the map banner’s main action (multiplayer, with none: open the chat)'],
      [['B', 'N'], 'Bomb or Napalm (while choosing a target)'],
    ]),
      `<section class="ks-group" aria-label="Army panel keys">${sub('In the Army panel', panel('army'))}</section>`,
  ) + col(
    section('Panels', map('panels')),
    section('Building and unit panels', [
      [['Delete', 'Backspace'], 'Press twice to dismantle or recycle'],
      ...panel('building'),
    ], '<p>When a panel is open, its available buttons take priority.</p>'),
  );
}

function initKeyboard() {
  window.addEventListener('keydown', (e) => {
    const tag = (e.target && e.target.tagName) || '';
    if (tag === 'TEXTAREA' || tag === 'SELECT') return;
    // A slider or switch keeps its own keys (arrows, Home, End); Esc and Space still reach the game from one.
    if (tag === 'INPUT' && !(/^(range|checkbox)$/.test(e.target.type) && (e.key === 'Escape' || e.key === ' '))) return;
    if (!UI.inGame) return;
    const key = e.key.toLowerCase(), bare = !e.ctrlKey && !e.metaKey && !e.altKey;
    if (!$('screen-keys').hidden) {
      if (key === 'escape' || (bare && key === SHORTCUT_SHEET_KEY)) {
        e.preventDefault();
        if (!e.repeat) closeKeys();
      }
      return;
    }
    if (bare && key === SHORTCUT_SHEET_KEY) {
      if (!e.repeat && openKeys()) e.preventDefault();
      return;
    }
    // Send feedback open: no key is the game's (its own keys stop there; this is one from outside it, the focus lost).
    if (!$('screen-feedback').hidden) { if (e.key === 'Escape') { e.preventDefault(); closeFeedback(); } return; }
    // Control groups: Cmd/Ctrl (or Shift; Option/Alt for 7–9, since Option/Alt + 1–6 is the Army Groups') + 1–9 saves the
    // selected warbots and Howitzers as a group, 1–9 selects it again (press twice to jump to it). Shift always reaches the game;
    // a browser tab on a Mac may keep Cmd+1–9 for itself (it switches tabs).
    const digit = /^Digit([1-9])$/.exec(e.code || '');
    // In the build menu a plain number picks a tab instead (1 Gather, 2 Make, 3 Move, 4 Defend, 5 Mega, 6 Terraform).
    if (digit && UI.sheetKind === 'build' && !e.ctrlKey && !e.metaKey && !e.shiftKey && !e.altKey) {
      const g = Object.keys(BUILD_TAB_KEYS).find((t) => BUILD_TAB_KEYS[t] === digit[1]);
      const tab = g && $('build-tabs') && $('build-tabs').querySelector(`[data-g="${g}"]`);
      e.preventDefault();
      if (tab) tab.click();
      return;
    }
    // In the Army panel a plain 1-4 picks the group size (2, 4, 8, All).
    if (digit && UI.sheetKind === 'army' && !e.ctrlKey && !e.metaKey && !e.shiftKey && !e.altKey && ARMY_SIZE_KEYS[digit[1]]) {
      const btn = $(ARMY_SIZE_KEYS[digit[1]]);
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
    // Army Groups: Alt/Option + 1–6 selects group N (twice: goes to it); with Shift, its panel.
    if (digit && $('screen-pause').hidden && e.altKey && !e.ctrlKey && !e.metaKey && +digit[1] <= AGROUP.max) {
      e.preventDefault();
      if (!e.repeat) agKey(+digit[1], e.shiftKey);
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
    // Ctrl+Z (Cmd+Z) on the map, for a few seconds after placing a building: the Undo chip (takes the site back).
    if ((e.ctrlKey || e.metaKey) && !e.altKey && !e.shiftKey && e.key.toLowerCase() === 'z' && R.mode === 'normal' && !topScreen() && siteUndoNow()) {
      e.preventDefault();
      undoLastSite();
      return;
    }
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    const k = e.key.toLowerCase();
    if (k === 'escape') { e.preventDefault(); escapeKey(); return; }
    if (k === '`' && $('screen-over').hidden) { e.preventDefault(); if ($('screen-boost').hidden) openBoost(); else closeBoost(); return; }
    const overlay = !$('screen-pause').hidden || !$('screen-help').hidden || !$('screen-stats').hidden || !$('screen-over').hidden || !$('screen-boost').hidden;
    // Space: the pause menu, or Resume. Shift+Space (or the Pause key): plan while paused, menu shut (planPause); while
    // planning, Space resumes.
    if (k === ' ' || k === 'spacebar' || k === 'pause') {
      e.preventDefault();
      if (e.repeat) return;
      const plan = e.shiftKey || k === 'pause';
      if (!$('screen-pause').hidden) { if (plan && !MP.on) planPause(); else $('p-resume').click(); }
      else if (!overlay) { if (planning()) $('p-resume').click(); else if (plan && !MP.on) planPause(); else $('btn-pause').click(); }
      return;
    }
    if (overlay) return;
    // Camera spots (js/qol.js): Shift+F1–F4 keeps the view, F1–F4 goes back to it.
    const fk = /^f([1-4])$/.exec(k);
    if (fk) { e.preventDefault(); if (e.shiftKey) saveCamSpot(+fk[1]); else goCamSpot(+fk[1]); return; }
    const shifted = e.shiftKey && SHIFT_KEYS[k] && (!SHIFT_KEYS[k].when || SHIFT_KEYS[k].when()) && SHIFT_KEYS[k];
    if (shifted) { e.preventDefault(); shifted.run(); return; }
    // Enter confirms the banner's main button (Build here, Fire, Lay roads...).
    if (k === 'enter' && !$('banner').hidden && !$('banner-ok').hidden && !$('banner-ok').disabled) { e.preventDefault(); $('banner-ok').click(); return; }
    // Picking a bomber's target: B and N switch its payload (Bomb or Napalm).
    if (R.mode === 'strike' && (k === 'b' || k === 'n')) { e.preventDefault(); setStrikeKind(k === 'n' ? 'napalm' : 'bomb'); return; }
    // In the Terraform mode a tool's letter switches to it (R, L, F, H, C: js/terraform.js).
    if (tfKey(k)) { e.preventDefault(); return; }
    // A key on the open panel's buttons (SHEET_KEYS) presses that button.
    const sk = sheetKeyButton(k);
    if (sk) { e.preventDefault(); sk.click(); return; }
    // In the build menu, a building's letter on the tab that's showing picks it, R goes straight to
    // laying roads and X to Walls. W, A, S and D still pan the map (no building uses them).
    if (UI.sheetKind === 'build' && k === 'r' && !(BUILD_KEYS[UI.buildTab] && Object.values(BUILD_KEYS[UI.buildTab]).includes('r'))) { e.preventDefault(); openRoadDraw(); return; }
    if (UI.sheetKind === 'build' && k === 'x' && $('build-walls')) { e.preventDefault(); $('build-walls').click(); return; }
    // A letter that's no building's on this tab does what it does elsewhere (Q army, H base, M minimap...).
    if (UI.sheetKind === 'build' && /^[a-z]$/.test(k) && !PAN_KEYS[k] && (k !== 'b' || (BUILD_KEYS[UI.buildTab] && Object.values(BUILD_KEYS[UI.buildTab]).includes('b')))) {
      const keys = BUILD_KEYS[UI.buildTab];
      const type = keys && Object.keys(keys).find((t) => keys[t] === k);
      const card = type && $('sheet-body').querySelector(type.startsWith('tf-') ? `.bcard[data-tf="${type.slice(3)}"]` : `.bcard[data-t="${type}"]`);
      if (card && !card.hidden) { e.preventDefault(); if (card.disabled) sfx('error'); else card.click(); return; }
    }
    // Placing a blueprint: R turns it.
    if (R.mode === 'bpplace' && k === 'r') { e.preventDefault(); bpRotate(); return; }
    // Placing a Mass Driver: R turns its two tiles (east-west or north-south).
    if (R.mode === 'place' && UI.placeType && BDEFS[UI.placeType] && BDEFS[UI.placeType].long && k === 'r') { e.preventDefault(); mdTurn(); return; }
    if (R.mode === 'place' && UI.placeType && BDEFS[UI.placeType] && BDEFS[UI.placeType].lift && k === 'r') { e.preventDefault(); liftTurn(e.shiftKey ? -1 : 1); return; }
    // WASD and the arrow keys pan the map while held.
    if (PAN_KEYS[k]) { e.preventDefault(); R.keys.add(k); return; }
    const binding = MAP_KEYS.find(({ keys }) => keys.includes(k));
    if (!binding || binding.run() === false) return;
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

/**
 * The selection bar's parts, made once: what's selected and doing what, the mouse's hint, and a finger's buttons. Under a
 * finger the buttons are two rows that fit the bar without scrolling (style.css): who to select (All in view, Whole army,
 * Box, Info), then what to do with them (Undo, Recycle, Save as group). The words in .sl-long go where the bar is narrow.
 */
function initSelBar() {
  $('selbar').innerHTML = `<div class="sel-top"><div class="sel-text"><b id="sel-title"></b> <span id="sel-notes"></span></div>
      <button class="btn small ghost" id="selbar-clear" aria-label="Clear selection">✕</button></div>
    <span class="hint" id="sel-status"></span>
    <span class="hint sel-mouse">Right-click open ground to hold it, a rival building, robot or earthwork to attack, your Outpost to station them, or a Repair Station to get them fixed. Esc clears.</span>
    <div class="sel-tools"><button class="btn small" id="sel-view">All in view</button><button class="btn small" id="sel-army">Whole army</button><button class="btn small" id="sel-box">Box</button><button class="btn small" id="sel-info">Info</button><i class="sel-br"></i><button class="btn small primary" id="sel-undo" hidden>Undo</button><button class="btn small" id="sel-scorch" hidden>Scorch the earth</button><button class="btn small danger" id="sel-recycle" hidden></button><button class="btn small ghost" id="selbar-group" title="Save them as a control group (or ⌘/Ctrl or Shift + 1–9)"></button><button class="btn small ghost" id="sel-agroup" title="Add them to an Army Group, or make a new one">Army group</button></div>`;
  $('selbar-clear').onclick = () => { sfx('click'); selectBots([], false); };
  $('selbar-group').onclick = () => saveGroup(nextGroupNo());
  $('sel-agroup').onclick = () => { sfx('click'); openAgSelSheet(); };
  $('sel-undo').onclick = () => undoOrder();
  $('sel-view').onclick = () => { sfx('click'); selectBots(unitsInView(), false); if (!UI.sel.length) toast('None of your warbots are in view.', 'info'); };
  $('sel-army').onclick = () => { sfx('click'); selectBots(armyIds(ME).concat(S.bots.filter((u) => !u.dead && u.owner === ME && BOTS[u.type].siege).map((u) => u.id)), false); };
  $('sel-info').onclick = () => { sfx('click'); const us = selectable(ME, UI.sel).filter((u) => !u.inside); if (us.length === 1) openBotSheet(us[0]); else openPopSheet(); };
  $('sel-scorch').onclick = () => { const us = orderable(ME, UI.sel).filter((u) => BOTS[u.type].flame); if (!us.length) return; sfx('click'); startScorch(us.map((u) => u.id)); };
  $('sel-recycle').onclick = () => recycleSelection();
  // Box: the next one-finger drag on the map draws a selection box (input.js), then it's off again. Tap Box again to call it off.
  $('sel-box').onclick = () => { sfx('click'); INPUT.boxArmed = !INPUT.boxArmed; refreshSelection(); };
}

/** The selected robots that Recycle on the selection bar would send (not those already on their way). */
function selRecyclable() { return selectable(ME, UI.sel).filter((u) => recycleOffered(u) && !recycling(u)); }

/**
 * Recycle on the selection bar: the selected robots go to the nearest Bot Foundry to be taken apart. Several at once
 * take a second tap to confirm. Undo (or any other order) sends them back to what they were doing.
 */
function recycleSelection() {
  const us = selRecyclable();
  if (!us.length) return;
  if (us.length > 1 && !(UI.recycleArm && performance.now() - UI.recycleArm < 3000)) { sfx('click'); UI.recycleArm = performance.now(); refreshSelection(); return; }
  UI.recycleArm = 0;
  const was = us.map(orderSnapshot);
  act('recycle', [us.map((u) => u.id)], (r) => {
    if (typeof r === 'string') { sfx('error'); toast(r, 'warn'); refreshSelection(); return; }
    sfx('order');
    UI.undo = { was, until: performance.now() + ORDER_UNDO, text: `${r === 1 ? 'It\'s' : `${r} are`} on the way to be recycled.` };
    toast(`${r === 1 ? `The ${BOTS[us[0].type].name} is` : `${r} robots are`} on the way to the Bot Foundry to be taken apart. Any other order calls it off.`, 'info');
    refreshSelection();
  });
}

/** Has the player warbots or Howitzers out in the open? (Then a finger held on the map draws a selection box: see input.js.) */
function fieldUnits() {
  return UI.inGame && !uiFrozen() && S.bots.some((u) => !u.dead && u.owner === ME && !u.inside && (isArmy(u) || BOTS[u.type].siege));
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
  onMapCommand(i, j, wx, wy, () => { haptic('order'); UI.undo = { was, until: performance.now() + ORDER_UNDO, text: 'Order given.' }; refreshSelection(); });
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

/*
 * Placement undo. For SITE_UNDO seconds after you place a building, the Undo chip at the foot of the map (or Ctrl+Z / Cmd+Z
 * on the map, outside Paths, whose Ctrl+Z is its own) takes the construction site back, with everything paid or
 * delivered for it refunded in full (ORDERS.undoSite, which checks the time by the game's clock). Each site placed
 * is noted here; the newest still in its time is the one taken back, then the one before it.
 */
function noteSiteUndo(id) {
  if (!id) return;
  UI.siteUndo = (UI.siteUndo || []).filter((e) => e.of === S).concat([{ id, of: S }]);
  siteUndoTick();
}

/** How much sooner than the rules' SITE_UNDO the chip goes: in multiplayer an order is done a few turns after it's given. */
function siteUndoLead() { return typeof MP !== 'undefined' && MP.on ? ((MP.d || LS.DELAY) + 1) * LS.TURN * SIM_STEP + 0.25 : 0; }

/** The newest site of yours that Undo can still take back, and the seconds left ({ b, left }), or null. */
function siteUndoNow() {
  const L = UI.siteUndo;
  if (!L || !L.length || !S) return null;
  const lead = siteUndoLead();
  while (L.length) {
    const e = L[L.length - 1], b = e.of === S ? getE(e.id) : null;
    const left = b && !b.dead && !b.built && b.owner === ME && typeof b.placedAt === 'number' ? SITE_UNDO - lead - (S.time - b.placedAt) : -1;
    if (left > 0) return { b, left };
    L.pop();
  }
  return null;
}

/** The Undo chip (#undo-site): on show on the map (no mode, no screen over it) while a site can be taken back, its bar running down. */
function siteUndoTick() {
  const el = $('undo-site');
  if (!el) return;
  const U = UI.inGame && R.mode === 'normal' ? siteUndoNow() : null;
  if (el.hidden !== !U) el.hidden = !U;
  if (!U) return;
  if (!el.onclick) el.onclick = () => undoLastSite();
  const key = `${U.b.id}:${Math.ceil(U.left)}`;
  if (el.dataset.key !== key) {
    el.dataset.key = key;
    const mac = /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent || '');
    el.innerHTML = `<b>Undo</b><span class="us-name">${BDEFS[U.b.type].name}</span><span class="us-n">${Math.ceil(U.left)}s</span><kbd>${mac ? '⌘Z' : 'Ctrl+Z'}</kbd><i class="us-bar"></i>`;
    el.title = `Take the ${BDEFS[U.b.type].name} back: everything spent on it comes back`;
  }
  el.style.setProperty('--us-left', (U.left / SITE_UNDO).toFixed(3));
}

/** Undo on the chip (or Ctrl+Z): the newest site placed is taken back, its goods refunded. False if there's none to take back. */
function undoLastSite() {
  const U = siteUndoNow();
  if (!U) return false;
  UI.siteUndo.pop();
  const id = U.b.id, name = BDEFS[U.b.type].name;
  act('undoSite', [id], (r) => {
    if (!r || r.why) { sfx('error'); toast((r && r.why) || 'That site is gone.', 'warn'); return; }
    sfx('click');
    const back = Object.keys(r.back || {}).filter((g) => r.back[g] >= 1).map((g) => `${Math.floor(r.back[g])} ${goodN(g, Math.floor(r.back[g]))}`);
    toast(`Took back the ${name}: ` + (back.length ? `${back.join(', ')} back in storage.` : 'nothing had been spent on it yet.'), 'info');
    if (UI.sheetKind === 'bld' && UI.sheetFor === id) closeSheet();
    if (R.selected === id) R.selected = 0;
  });
  siteUndoTick();
  return true;
}

/* ------------------------------------------------------------------ now playing */

/*
 * Now playing (#now-playing), on a computer only: when the music turns to a new theme a card in the bottom left corner,
 * level with the tools, shows its title (MUSIC_TITLES in audio.js) for NP_SHOW ms, then fades away; nothing stays there
 * between themes (the owner's choice). A title shown in the last NP_AGAIN ms isn't shown again (the war theme comes and
 * goes with the fighting). Nothing shows with the Music off, in photo mode or under a full screen (the main menu is
 * fine: it has music too). Nor where it would run into the tools (they move left for a panel on a smaller screen) or
 * the main menu's card (Custom Game fills the screen): a new theme's card waits until it can be seen. Display only: it
 * reads MUSIC and changes nothing in the game.
 */
const NP_SHOW = 6000, NP_AGAIN = 60000;
const NP = { mood: '', due: false, until: 0, shown: {}, mq: null, covers: null };

/** A computer: a mouse, not a finger, and the wide layout (the tools along the bottom, not down the side). */
function nowPlayingDesk() {
  if (typeof matchMedia !== 'function') return false;
  NP.mq = NP.mq || matchMedia('(pointer: fine) and (min-width: 1000px) and (min-height: 520px)');
  return NP.mq.matches && !onTouch();
}

/** A full screen or dialog over the game (not the main menu itself). */
function nowPlayingCovered() {
  NP.covers = NP.covers || [...document.querySelectorAll('.screen:not(#screen-menu), #briefing, #m-picker')];
  return NP.covers.some((el) => !el.hidden);
}

function nowPlayingTick() {
  const el = $('now-playing');
  if (!el) return;
  const title = MUSIC_TITLES[MUSIC.mood] || '';
  if (MUSIC.mood !== NP.mood) { NP.mood = MUSIC.mood; NP.due = !!title; }
  const ac = AUDIO.ctx;
  let on = !!title && AUDIO.on && AUDIO.music > 0 && !!ac && ac.state === 'running' && !UI.photo && nowPlayingDesk() && !nowPlayingCovered();
  let room = false;
  if (on) {
    // Clear of the tools (in a game) and the menu's card (on the menu): the card needs room for its title.
    const H = innerHeight, obs = [$('bottombar').getBoundingClientRect(), $('menu-card').getBoundingClientRect()];
    room = obs.every((r) => !r.width || r.left >= 24 + 56 + el.lastElementChild.scrollWidth || r.bottom <= H - 64);
  }
  const shown = !el.hidden;
  if (el.hidden !== !on) el.hidden = !on;
  if (!on) { el.classList.remove('open'); return; }
  if ($('np-title').textContent !== title) $('np-title').textContent = title;
  const now = performance.now();
  if (NP.due && room && shown) {
    NP.due = false;
    if (now - (NP.shown[title] ?? -Infinity) >= NP_AGAIN) { NP.shown[title] = now; NP.until = now + NP_SHOW; }
  }
  // (opened a frame after it appears, so the card fades in; it's invisible the rest of the time)
  el.classList.toggle('open', room && shown && now < NP.until);
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
  if (!['sel-title', 'sel-notes', 'sel-status', 'sel-box', 'sel-undo', 'sel-scorch', 'sel-recycle', 'selbar-group', 'sel-agroup'].every((id) => $(id)) || !bar.querySelector('.sel-mouse')) initSelBar();
  $('sel-scorch').hidden = !orderable(ME, UI.sel).some((u) => BOTS[u.type].flame); // (Torches selected: Scorch the earth)
  $('sel-agroup').hidden = !orderable(ME, UI.sel).length || !!UI.watch; // (army units selected: Army group)
  $('sel-box').classList.toggle('on', INPUT.boxArmed);
  let inside = 0, empty = 0;
  for (const u of orderable(ME, UI.sel)) { if (u.inside) inside++; if (!botArmed(u)) empty++; }
  const undo = UI.undo && performance.now() < UI.undo.until ? UI.undo : (UI.undo = null);
  const set = (id, html) => { const el = $(id); if (el.dataset.html !== html) { el.dataset.html = html; el.innerHTML = html; } };
  set('sel-title', `${groupWords(UI.sel)} selected`);
  set('sel-notes', (inside ? `<span class="muted">(${inside} in garrisons)</span> ` : '') + (empty ? `<span class="err">${empty} out of Ammo or Fuel</span>` : ''));
  set('sel-status', INPUT.boxArmed ? '<b>Box:</b> drag a finger round warbots (two fingers move the map)'
    : undo ? `<span class="ok">${esc(undo.text)}</span> Undo takes it back.` : (touch ? '<b>Tap the map</b> to send them · ' : '') + esc(selStatus(selectable(ME, UI.sel))));
  set('selbar-group', `Save<span class="sl-long"> as</span> group ${nextGroupNo()}`);
  $('sel-undo').hidden = !undo;
  // Recycle: these robots to the Bot Foundry, to be taken apart (several: a second tap within 3 s).
  const rec = selRecyclable(), armed = rec.length > 1 && UI.recycleArm && performance.now() - UI.recycleArm < 3000;
  $('sel-recycle').hidden = !rec.length;
  set('sel-recycle', armed ? `Tap again<span class="sl-long">: recycle ${rec.length}</span>` : rec.length === 1 ? 'Recycle<span class="sl-long"> this unit</span>' : `Recycle <span class="sl-long">these </span>${rec.length}<span class="sl-long"> units</span>`);
  if (rec.length) $('sel-recycle').title = rec.length === 1 ? `Take it to the Bot Foundry to be taken apart (${recycleText(rec[0].type)} back)` : 'Take them to the Bot Foundry to be taken apart: about half their parts come back';
  refreshGroupBar();
}

/**
 * A drag box (screen pixels) selects your warbots inside it; with Shift it adds to the selection. `armed`: it
 * was drawn after Box on the selection bar. A finger's box drawn by holding and dragging that catches nothing
 * changes nothing (it was most likely meant to move the map).
 */
function onSelectBox(box, add, armed) {
  if (R.mode === 'bppick') { bpPickBox(box); return; } // (picking buildings for a blueprint: js/blueprint.js)
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
  // No warbots, but buildings of yours: the chip at the foot of the map offers to keep them as a blueprint.
  if (!ids.length && (armed || !onTouch()) && bpBoxOffer(box)) { if (!add) selectBots([], false); return; }
  if (!ids.length && !armed && onTouch()) { refreshSelection(); return; }
  selectBots(ids, add);
  if (ids.length) sfx('click'); else if (onTouch()) toast('No warbots of yours in that box.', 'info');
}

/**
 * Right-click (or, under a finger, a tap with the selection bar showing): order the selected warbots to whatever is
 * under the pointer. done() runs once an order has gone to them.
 */
function onMapCommand(i, j, wx, wy, done) {
  if (!UI.inGame || uiFrozen() || R.mode !== 'normal') return;
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
  // One of your defences, its panel open (nothing else picked): right-click an enemy to aim it there (Shift: every
  // defence of yours that reaches it).
  const dpick = !UI.sel.length && UI.sheetKind === 'bld' ? getE(UI.sheetFor) : null;
  if (dpick && !dpick.dead && dpick.owner === ME && dpick.built && canFocus(BDEFS[dpick.type])) { focusAt(dpick, i, j, wx, wy, !!INPUT.shift, null, done); return; }
  if (!UI.sel.length) return;
  const b = buildingAtTap(i, j, wx, wy);
  // (Passenger Town: a building tapped by its upper floors or roof, in front of what's on the tile, is the one meant)
  const tw = !b && S.town && typeof townAtTap === 'function' ? townAtTap(wx, wy) : null;
  if (tw) { i = tw.r.x; j = tw.r.y; }
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
  // (an earthwork tile: a foe's is attacked; your own or an ally's with Ctrl, Alt or Cmd held: js/terraform4.js)
  const ew = !foe && !b && typeof ewOrderAt === 'function' ? ewOrderAt(i, j, !!INPUT.force) : 0;
  const spec = foe ? { foe: foe.id } : b ? { b: b.id } : ew ? { i, j, ew: 1 } : { i, j };
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
    if (r.kind === 'ewshoot') {
      if (!r.n) { sfx('error'); toast(r.blocked ? 'None of them can get within reach of it.' : 'None of the selected warbots have Ammo: they reload in a garrison first.', 'warn'); return; }
      sfx('order'); addFx('ring', rx, ry, { color: '#ff5a6e' });
      toast(`${r.n} warbot${r.n > 1 ? 's' : ''} shooting the ${EW_NAMES[ew]}${r.blocked ? ` (no way within reach for ${r.blocked})` : ''}. Light warbots wear it down slowly; heavy robots and blasts breach it fast.`, 'info');
      if (done) done();
      refreshSelection();
      return;
    }
    const n = r.n, nr = r.nr;
    const what = r.kind === 'hunt' ? `going after the rival's ${foeName}` : r.kind === 'attack' ? `attacking the ${bName}` : r.kind === 'station' ? `heading to the ${bName}` : 'moving to hold that ground';
    const blocked = r.blocked ? ` No route for ${r.blocked} warbot${r.blocked === 1 ? '' : 's'}.` : '';
    if (nr && !n) {
      sfx('order');
      addFx('ring', rx, ry, { color: theirs ? '#ff5a6e' : '#7dffa0' });
      toast(`${nr} Howitzer${nr > 1 ? 's' : ''} ${theirs ? `shelling the ${bName}` : 'on the move'}.${blocked}`, blocked ? 'warn' : 'info');
      if (done) done();
      refreshSelection();
      return;
    }
    if (!n) {
      sfx('error');
      toast(blocked ? `No route to that destination for ${r.blocked === 1 ? 'the selected warbot' : `the ${r.blocked} selected warbots`}.`
        : mine ? 'That garrison is full.' : 'None of the selected warbots have Ammo: they reload in a garrison first.', 'warn');
      return;
    }
    sfx('order');
    addFx('ring', rx, ry, { color: theirs ? '#ff5a6e' : '#7dffa0' });
    toast(`${n} warbot${n > 1 ? 's' : ''} ${what}.${blocked}`, blocked ? 'warn' : 'info');
    if (done) done();
    refreshSelection();
  });
}

/** Control groups: Ctrl/Shift + digit saves the selection; the digit selects it again, twice to jump there. */
/** Control groups (kept with the game, so they're there after Continue): group number → robot ids. */
function ctrlGroups() { if (!S.groups) S.groups = {}; return S.groups; }
/** Buildings kept on a number key (S.bgroups: { k: building id }): one building a key, a key a group of robots or a building. */
function bldGroups() { if (!S.bgroups) S.bgroups = {}; return S.bgroups; }
/** The building on key k, if it's still yours, or null. */
function bldGroup(k) { const b = getE(bldGroups()[k]); return b && !b.dead && b.owner === ME && BDEFS[b.type] ? b : null; }

/** What a list of selected robots is, in words ("2 Howitzers", "5 warbots and 1 Howitzer"). */
function groupWords(ids) {
  const us = selectable(ME, ids), n = {};
  for (const u of us) n[u.type] = (n[u.type] || 0) + 1;
  const words = Object.keys(n).map((k) => `${n[k]} ${k === 'warbot' ? (n[k] > 1 ? 'warbots' : 'warbot') : n[k] > 1 ? BOTS[k].plural : BOTS[k].name}`);
  return words.length > 1 ? words.slice(0, -1).join(', ') + ' and ' + words[words.length - 1] : words.join('');
}

function saveGroup(k) {
  const mac = /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent || '');
  // No robots selected but a building of yours open: that building goes on the key.
  const open = !UI.sel.length && UI.sheetKind === 'bld' ? getE(UI.sheetFor) : null;
  if (open && !open.dead && open.owner === ME && !S.watch) {
    const B = bldGroups();
    for (const g in B) if (B[g] === open.id) delete B[g]; // (a building is on one key at a time)
    B[k] = open.id;
    delete ctrlGroups()[k];
    sfx('click');
    toast(`Key ${k}: your ${BDEFS[open.type].name}. Press ${k} to open it (twice to go to it).`, 'info');
    refreshGroupBar();
    return;
  }
  if (!UI.sel.length) { toast(onTouch() ? `Select ${BOTS_OFF.has('rocket') ? 'warbots' : 'warbots or Howitzers'} first (tap one), then Save as group.` : `Select ${BOTS_OFF.has('rocket') ? 'warbots' : 'warbots or Howitzers'} first (drag a box round them), then ${mac ? '⌘ or Shift' : 'Ctrl or Shift'}+${k} saves them as group ${k}.`, 'info'); return; }
  const G = ctrlGroups();
  // A robot is in one group at a time: putting it in this one takes it out of any other.
  for (const g in G) G[g] = G[g].filter((id) => !UI.sel.includes(id));
  G[k] = UI.sel.slice();
  delete bldGroups()[k]; // (a key holds robots or a building, not both)
  sfx('click');
  toast(`Group ${k}: ${groupWords(G[k])}. ${onTouch() ? `Tap its chip ${k}` : `Press ${k}`} to select them again (twice to go to them).`, 'info');
  refreshGroupBar();
}

function recallGroup(k) {
  const bk = bldGroup(k);
  if (bk) {
    const twice = UI.lastGroup.k === k && performance.now() - UI.lastGroup.at < 450;
    UI.lastGroup = { k, at: performance.now() };
    sfx('click');
    if (UI.sel.length) selectBots([], false);
    openBuildingSheet(bk);
    if (twice) centerOn(bk.x + 0.5, bk.y + 0.5);
    return;
  }
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
    const bk = bldGroup(k);
    if (bk) { const nm = BDEFS[bk.type].short || BDEFS[bk.type].name; chips.push(`<button class="gchip${UI.sheetKind === 'bld' && UI.sheetFor === bk.id ? ' on' : ''}" data-g="${k}" title="Key ${k}: your ${BDEFS[bk.type].name} (press ${k} to open it; twice to go to it)"><kbd>${k}</kbd>${nm}</button>`); continue; }
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
  // (A building, a robot, then a Viaduct's deck or a Ropeway's cable overhead: as a tap picks them.)
  const b0 = buildingAtTap(i, j, w.x, w.y);
  let bot = null;
  if (!b0) {
    let bd = 0.3;
    for (const u of S.bots) {
      if (u.dead || u.inside || (u.under && !murmurInSight(u))) continue; // (nor a Sapper underground out of the colony's sight)
      const d = dist2(u.x, u.y, w.x, w.y);
      if (d < bd) { bd = d; bot = u; }
    }
  }
  const b = b0 || (bot ? null : crossingAtTap(i, j, w.x, w.y));
  if (b) {
    const def = BDEFS[b.type];
    key = 'b' + b.id;
    html = `<b>${b.owner === ME ? '' : playerName(b.owner) + ' '}${def.name}</b>` + (b.owner === ME && b.status ? `<em>${b.status}</em>` : '') +
      (def.mil && !(b.owner === ME && b.status) ? `<em>${b.garrison.length} warbot${b.garrison.length === 1 ? '' : 's'} inside</em>` : '') +
      (b.armor < def.armor ? `<em>Armor ${Math.ceil(b.armor)}/${def.armor}</em>` : '');
  } else if (bot) {
    key = 'u' + bot.id;
    html = `<b>${bot.owner === ME ? '' : playerName(bot.owner) + ' '}${BOTS[bot.type].name}</b>` + (bot.owner === ME ? `<em>${botActivity(bot)}</em>` : '') +
      `<em>Health ${Math.ceil(bot.hp)}/${bot.maxHp}${bot.owner === ME ? ` · battery ${Math.round(bot.bat ?? 100)}%` : ''}</em>`;
  } else if (inMap(i, j) && S.res[tIdx(i, j)]) {
    const t = tIdx(i, j);
    key = 'r' + t;
    html = `<b>${richRes(t) ? 'Rich ' + RES[S.res[t]].name.toLowerCase() : RES[S.res[t]].name}</b><em>${S.amt[t]} ${GOOD[RES[S.res[t]].good].name} left</em>`;
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
/** The speeds on offer now: a game being watched runs up to 8× (WATCH_SPEEDS, js/watch.js). */
function speedList() { return UI.watch ? WATCH_SPEEDS : SPEEDS; }

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
  const L = speedList(), k = L.indexOf(UI.speed);
  setSpeed(L[clamp((k < 0 ? L.indexOf(1) : k) + d, 0, L.length - 1)]);
  toast(`Game speed ${UI.speed}×`, 'info');
}

/** The speed menu under the speed chip in the top bar. */
function toggleSpeedMenu(refresh) {
  const m = $('speed-menu');
  if (!refresh && !m.hidden) { m.hidden = true; return; }
  m.innerHTML = speedList().map((v) => `<button role="menuitemradio" aria-checked="${v === UI.speed}" class="${v === UI.speed ? 'on' : ''}" data-v="${v}">${v}×</button>`).join('');
  for (const b of m.children) b.onclick = () => { setSpeed(+b.dataset.v); m.hidden = true; };
  const r = $('btn-speed').getBoundingClientRect();
  m.hidden = false;
  m.style.top = Math.round(r.bottom + 6) + 'px';
  m.style.left = Math.round(clamp(r.left + r.width / 2 - m.offsetWidth / 2, 8, window.innerWidth - m.offsetWidth - 8)) + 'px';
}

/** Esc steps back: close a panel, leave a mode, close a screen, or open the pause menu. */
function escapeKey() {
  if (!$('screen-keys').hidden) { closeKeys(); return; }
  if (maglevDragCancel()) return; // (a bend being dragged goes back; the edit stays open)
  if (UI.photo) { photoExit(); return; } // (photo mode: back where it was opened from, js/photo.js)
  if (!$('screen-feedback').hidden) { closeFeedback(); return; } // (over the pause menu: back to it)
  if (!$('screen-cloud').hidden) { closeCloud(); return; } // (cloud saves: over the pause menu, or a link's question)
  if (!$('screen-saves').hidden) { closeSaves(); return; } // (Saved games: over the pause menu, js/qol.js)
  if (!$('speed-menu').hidden) { $('speed-menu').hidden = true; return; }
  if (!$('screen-help').hidden) { $('h-close').click(); return; }
  if (!$('screen-stats').hidden) { $('st-close').click(); return; }
  if (!$('screen-boost').hidden) { closeBoost(); return; }
  if (!$('screen-pause').hidden) { if (UI.pauseView === 'settings') pauseView('main', true); else $('p-resume').click(); return; }
  if (!$('screen-over').hidden) return;
  if (UI.sheetKind) { closeSheet(); return; }
  if (UI.cmdView) { toggleCmdView(false); return; }
  if (UI.toolPick && !$('banner').hidden) { toolPicker(false); return; } // (the Paths tools picker of an upright phone)
  // In Paths with a plan sketched, Esc takes back the last stroke (again for the one before); with none left it leaves Paths.
  if (R.mode === 'road' && !draftEmpty()) { draftUndo(); showRoadBanner(draftEmpty() ? 'Plan cleared.' : 'Last stroke taken back (Esc again for the one before; Clear drops the whole plan).', true); return; }
  if (R.mode !== 'normal') { setMode(UI.planKept ? 'road' : 'normal'); return; }
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

/**
 * Messages: near the top of the screen. On a wide screen they sit in the top row's gap, beside the goal card and short
 * of the minimap (and of a panel docked on the right), just under the goods; where that gap is too narrow, and on a
 * phone, just under the whole top bar. (Under the top bar they could land in the middle of the map when the goal, an
 * event's card and the Domination card stacked up there.)
 */
function placeToasts() {
  const box = $('toasts'), st = box.style;
  const under = () => { st.left = st.width = st.transform = ''; st.top = Math.round($('topbar').getBoundingClientRect().bottom + 6) + 'px'; };
  if (!isWide()) return under();
  const goods = Math.max($('goods').getBoundingClientRect().bottom, document.querySelector('.toprow').getBoundingClientRect().bottom);
  let left = 12;
  for (const el of document.querySelectorAll('#topbar .objrow, #topbar > .event-card')) {
    const r = el.getBoundingClientRect();
    if (r.width && r.height && r.top < goods + 80) left = Math.max(left, r.right + 12);
  }
  let right = window.innerWidth - 12;
  const mm = $('minimap'), sh = $('sheet');
  if (mm && !mm.hidden) { const r = mm.getBoundingClientRect(); if (r.width) right = Math.min(right, r.left - 12); }
  if (sh && !sh.hidden) { const r = sh.getBoundingClientRect(); if (r.width && r.top < goods + 200 && r.left > left) right = Math.min(right, r.left - 12); }
  const w = Math.min(460, right - left);
  if (w < 320) return under();
  st.top = Math.round(goods + (document.body.classList.contains('deck') ? 12 : 6)) + 'px';
  st.left = Math.round(left + (right - left - w) / 2) + 'px'; st.width = Math.round(w) + 'px'; st.transform = 'none';
}

/** Keep the minimap just under the top bar, and make room for it beside the goal and messages. */
function placeMinimap() {
  const inGame = UI.inGame;
  $('minimap').hidden = !inGame || !MM.on;
  $('mm-show').hidden = !inGame || MM.on;
  document.body.classList.toggle('mm-on', inGame && MM.on);
  document.body.classList.toggle('mm-off', inGame && !MM.on);
  if (!inGame) return;
  placeToasts();
  // (Under the lower of the goods and the robot counts: on a wide screen they share a row, and the Command Deck's glass bar
  // reaches 6 px past it, so a panel docked on the right starts below the bar, not over its speed and pause buttons.)
  const rowB = Math.max($('goods').getBoundingClientRect().bottom, document.querySelector('.toprow').getBoundingClientRect().bottom);
  const top = Math.round(rowB + (document.body.classList.contains('deck') && isWide() ? 12 : 6)) + 'px';
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
    fits(p.shape, SHAPE_PRESETS) && fits(p.size, SIZE_PRESETS) && fits(p.rough, TERRAIN_PRESETS) && fits(p.rich, RESOURCE_PRESETS) && fits(p.biome, BIOME_ORDER) &&
    (p.biome2 == null || secondBiomeAllowed(p.biome2, BIOME_ORDER[p.biome || 0], p.size, p.shape || 0));
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
const planetKey = (p) => [p.seed, p.shape, p.size, p.rough, p.rich, p.biome, p.biome2, p.players].join(':');
function savePlanet(p) { if (planetOk(p)) writePlanets([{ ...p, rv: RES_V, at: Date.now() }].concat(savedPlanets().filter((q) => planetKey(q) !== planetKey(p)))); }
/** The planet the new-game menu is set to. */
function menuPlanet() {
  return { seed: UI.menu.seed, shape: UI.menu.shape || 0, size: menuSize(), rough: UI.menu.rough, rich: UI.menu.rich,
    biome: UI.menu.biome || 0, biome2: chosenSecondBiome(UI.menu, menuSize()), players: menuPlayers() };
}
/** The planet being played. */
function gamePlanet() {
  const st = S.settings || {}; // (a very old save has none)
  return { seed: S.seed, shape: st.shape || 0, size: st.size, rough: st.rough, rich: st.rich, biome: Math.max(0, BIOME_ORDER.indexOf(st.biome)), biome2: st.biome2, players: st.players || 2 };
}
function planetLabel(p) {
  const bits = [SHAPE_PRESETS[p.shape] ? SHAPE_PRESETS[p.shape].name : 'Standard', SIZE_PRESETS[p.size] ? SIZE_PRESETS[p.size].name : '', biomeName(p.biome || 0)];
  if (p.biome2) bits.push(BIOMES[p.biome2].name);
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
    Object.assign(UI.menu, { seed: p.seed, shape: p.shape, rough: p.rough, rich: p.rich, biome: p.biome, biome2: p.biome2 || null, players: p.players || 2, shapeRnd: 0, biomeRnd: 0 });
    UI.menu.size[UI.menu.mode] = p.size;
    if (SHAPE_PRESETS[p.shape] && SHAPE_PRESETS[p.shape].teamDefault) UI.menu.teams = 1; // (a planet of a map made for 2 vs 2: Teams on)
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
    const who = allies(P.id, ME) ? `Your ally ${callsign(P.id, true)}` : nColonies() > 2 ? callsign(P.id, true) : `Your rival, ${callsign(P.id, true)},`;
    if (st) postMsg(ME, `${who} is ${st.noun} (${st.plain}): it ${st.desc}.`, 0, 0, 'info');
  }
}

/** The briefing's word on the challenge modifiers on in this game (MODS), in one line. */
function modsBriefing() {
  const l = gameMods().map((k) => `${MODS[k].name} (${MODS[k].brief})`);
  if (l.length) postMsg(ME, `Challenge: ${l.length > 1 ? l.slice(0, -1).join(', ') + ' and ' + l[l.length - 1] : l[0]}. The pause menu lists them.`, 0, 0, 'warn');
}

/**
 * Start a game from the new-game menu; or, given `again` (the options a game was started with: UI.lastGame), the same
 * game over again (the end screen's Rematch: the same seed, map, mode, rivals and rules).
 */
function startNewGame(again) {
  UI.buildTab = 'gather'; // (a new game's build menu opens on Gather, the owner's call; picking another tab is remembered as before)
  clearSave();
  closePicker(false);
  // Random map type or biome: picked now (see resolveRandom); the menu keeps Random for next time.
  const pick = again ? null : resolveRandom();
  const horde = UI.menu.mode === 'horde';
  const opts = again || {
    seed: UI.menu.seed, difficulty: UI.menu.diff, mode: horde ? 'colony' : UI.menu.mode,
    horde: horde ? { level: UI.menu.diff, goal: UI.menu.diff === 'warlord' ? 'endless' : UI.menu.hgoal } : undefined,
    size: menuSize(), rough: UI.menu.rough, rich: UI.menu.rich, shape: pick.shape,
    nuke: !!UI.menu.nuke, mega: !!UI.menu.mega, upWin: menuUpWin(), biome: BIOME_ORDER[pick.biome], biome2: chosenSecondBiome(UI.menu, menuSize()), players: clamp(Math.round(UI.menu.players) || 2, 2, 4),
    style: docKeyOf(menuStyle()), styles: menuStyleKeys(), events: !!UI.menu.events, murmur: UI.menu.murmur, unlimited: !!UI.menu.unlimited,
    victory: UI.menu.victory, teams: menuTeams(), mods: menuMods(), scars: scarsPref(),
  };
  newGame(opts);
  UI.lastGame = { s: S, opts }; // (for Rematch: this game, while it's the one being played)
  enterGame();
  updateHUD();
  placeMinimap();
  postMsg(ME, S.horde ? hordeBriefing() : opts.mode === 'colony'
    ? (BIOMES[S.settings.biome] && BIOMES[S.settings.biome].silent ? `Your bots have landed on ${regionName(S.settings.biome)}. Build, expand and make this moon home.`
      : `Your bots have landed in ${regionName(S.settings.biome)}. Build, expand and make this planet home.`)
    : nColonies() > 2 ? `Your bots have landed. ${rivalsLanded()} Build up fast!`
      : `Your bots have landed. A rival colony, ${callsign(1, true)}, landed to the north. Build up fast!`, 0, 0, 'info');
  if (!again && (UI.menu.shapeRnd || UI.menu.biomeRnd)) postMsg(ME, `Random pick: ${[UI.menu.shapeRnd ? SHAPE_PRESETS[pick.shape].name : '', UI.menu.biomeRnd ? biomeName(pick.biome) : ''].filter(Boolean).join(', ')}.`, 0, 0, 'info');
  doctrineLines();
  modsBriefing();
  if (S.wildlife && !S.horde) {
    // Pointed at the nest nearest home (J jumps there), the rest are violet on the minimap.
    const L = getE(S.players[ME].lander), nests = S.buildings.filter((b) => !b.dead && isNestB(b));
    const near = L && nests.length ? nests.reduce((a, b) => (dist2(b.x, b.y, L.x, L.y) < dist2(a.x, a.y, L.x, L.y) ? b : a)) : null;
    const where = `(violet on the minimap; the nearest is ${near ? dirText(L, near) : 'out there'}${near ? ': press J or tap here to look' : ''})`;
    const every = alwaysNightMap() ? 'every surge' : 'every night';
    postMsg(ME, S.mode === 'colony'
      ? `The Murmur live here (${MURMUR_NAMES[murmurLevel()]}): ${nests.length} nests sit out in the wilds ${where}. By day they keep to their nests; ${every} their tunnels spread toward your power and packs come up through the exits. Pulse Turrets (with Crystal) and warbots keep them off; collapse an exit with warbots; clear a nest to win the goods it hoards.`
      : `The Murmur (${MURMUR_NAMES[murmurLevel()]}): ${nests.length} nests sit out in the wilds ${where}. They are nobody's side: ${every} their tunnels spread toward the colonies' power, and packs come up through the exits to raid all of you. Collapse an exit with warbots; wreck a nest by day and its tunnels die back.`, near ? near.x : 0, near ? near.y : 0, 'warn');
  } else if (opts.murmur !== 'off' && !murmurGround(S.settings.biome)) postMsg(ME, 'Argos is silent ground: no Murmur live on the moon.', 0, 0, 'info');
  else if (opts.murmur !== 'off' && !S.mission && !murmurShape(S.settings.shape)) postMsg(ME, `No Murmur on ${SHAPE_PRESETS[S.settings.shape].name}: its land has no room for their nests.`, 0, 0, 'info');
  if (S.posts && S.posts.length) {
    // Pointed at the post nearest home (J or a tap jumps there); the rest are gold on the minimap.
    const L = getE(S.players[ME].lander), near = L ? S.posts.reduce((a, p) => (dist2(p.x, p.y, L.x, L.y) < dist2(a.x, a.y, L.x, L.y) ? p : a)) : null;
    postMsg(ME, `${S.posts.length} neutral Trade Posts (gold on the minimap${near ? ', nearest ' + dirText(L, near) : ''}): lay a road out and dock a Trade Terminal to trade.` + (S.mode !== 'colony' ? ` Hold the land round one to shut ${nColonies() > 2 ? 'the rivals' : 'your rival'} out.` : ''), near ? near.x : 0, near ? near.y : 0, 'info');
  }
  if (opts.victory === 'uplinks' && S.mode !== 'colony' && !S.teams && (S.hollow || S.caves)) postMsg(ME, noUplinksWhy(S.settings.shape) + ' This game is won by Capture.', 0, 0, 'info');
  if (S.victory === 'uplinks' && S.uplinks) {
    const L = getE(S.players[ME].lander), near = L ? S.uplinks.reduce((a, u) => (dist2(u.x, u.y, L.x, L.y) < dist2(a.x, a.y, L.x, L.y) ? u : a)) : null;
    postMsg(ME, `Uplinks: ${S.uplinks.length} neutral Uplink towers stand across the planet (ringed dots on the minimap${near ? ', nearest ' + dirText(L, near) : ''}). One is yours while it stands in your land: build an Outpost or a Keep near it. They come online ${UPLINK.online / 60} minutes in: from then on, hold ${uplinkGoal()} and your clock runs, and a total of ${UPLINK.hold / 60} minutes wins. Enemy warbots right beside an Uplink jam it.`, near ? near.x : 0, near ? near.y : 0, 'info');
  }
  if (S.victory === 'domination') postMsg(ME, `Domination: hold ${Math.round(domShare() * 100)}% of the land anyone holds (and ${Math.round(DOM.min * 100)}% of the planet) for ${DOM.hold / 60} minutes straight to win. The card at the top shows where everyone stands. Outposts and Keeps claim the most land.`, 0, 0, 'info');
  if (nukeOn()) postMsg(ME, `Nuclear race: a few uranium deposits glow green across the planet. Dig them with Ore Mines, enrich them at a Nuclear Reactor and build the bomb${S.mode === 'colony' ? ' (no rival here, so it is yours to try out)' : ` before ${nColonies() > 2 ? 'the rivals do' : 'the rival does'}`}.`, 0, 0, 'warn');
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
  if (typeof contIronman === 'function' && contIronman()) { $('p-saved').textContent = CONT_IRONMAN_NO; return; }
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

/** An ordinary browser download of `text` (or a Blob: photo mode's picture) as `name`; false if this page can't. */
function plainDownload(name, text) {
  try {
    const url = URL.createObjectURL(text instanceof Blob ? text : new Blob([text], { type: 'application/json' }));
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
    if (!loadSaveText(r.result, 'Save file loaded. Welcome back.')) menuMsg('That isn\'t a Terrafall save file (or it\'s from a version this one can\'t read).');
  };
  r.readAsText(file);
}

/**
 * A save file's text (or a bare save) into play, as Load a save file does: checked (checkSave), started, then this
 * device's save, with the one it replaces kept as the backup. False (nothing changed) if it can't be read or started.
 * (Also how a cloud save loads: js/cloud.js.)
 */
function loadSaveText(text, welcome) {
  let json = String(text || '');
  const prev = S;
  try {
    const o = JSON.parse(json);
    if (o && o.terrafall && typeof o.game === 'string') json = o.game; // a save file; a bare save works too
    if (typeof contIronmanSave === 'function' && contIronmanSave(json)) { toast(CONT_IRONMAN_NO, 'warn'); return false; } // (Ironman: never reloaded)
    deserializeGame(json);
  } catch (e) { S = prev; return false; }
  if (!enterLoaded(prev)) return false;
  try { const old = localStorage.getItem(SAVE_KEY); if (old) localStorage.setItem(SAVE_BACKUP_KEY, old); } catch (e) { /* storage unavailable or full: it still plays */ }
  if (saveGame()) {
    UI.savedAt = Date.now();
    postMsg(ME, welcome, 0, 0, 'info');
  } else {
    UI.saveFailed = true;
    toast('Game loaded for this tab. Continue couldn’t be updated. Use Save → File in the pause menu to keep a copy.', 'warn');
  }
  return true;
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
  UI.inGame = true; UI.paused = false; UI.plan = false; UI.overShown = false;
  UI.sel = []; UI.groups = {}; UI.lastAlert = null;
  UI.msgLog = []; $('btn-msgs').hidden = true;
  UI.objAuto = false; UI.objManual = false; UI.objStep = undefined;
  UI.saveHold = false;
  UI.savedAt = 0; UI.saveFailed = false; UI.checkpointFailed = false;
  if (!MP.on && !UI.watch && !S.checkpointRun) S.checkpointRun = `${Date.now()}-${randomSeed()}`;
  UI.nextCheckpoint = (Math.floor((S.time + 1e-6) / AUTOSAVE_EVERY) + 1) * AUTOSAVE_EVERY;
  UI.nextTransmission = unsaved ? (Math.floor(S.time / 480) + 1) * 480 : S.time + 1;
  UI.transmission = unsaved ? 1 + Math.floor(S.time / 480) : 0;
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
  closeKeys();
  if (UI.photo) photoExit();
  if (UI.watch) watchEnd();
  if (MP.on || MPJ.on) mpQuit();
  ME = 0;
  hideGoodTip();
  UI.inGame = false;
  UI.paused = false; UI.plan = false;
  disarmBack();
  syncWakeLock();
  closeSheet();
  setMode('normal');
  $('hud').hidden = true;
  placeMinimap();
  $('screen-menu').hidden = false;
  showMenuView('home');
  syncCampaignTile(); // (a mission may have been finished)
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
  if (P.unzoom) P.unzoom(); // (the Lore guide's atlas, enlarged, goes back on a page turn)
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
 * While it's open the music is the campaign theme, The Long Silence (musicLore in audio.js).
 */
function openLore(at) {
  const scr = $('screen-lore');
  // (In the one-file copy of the game the pictures are a bundle beside the page, lore.js, fetched the first time.)
  const show = () => { for (const img of scr.querySelectorAll('img[data-src]')) { const d = window.LORE_DATA; img.src = (d && d[img.dataset.src]) || img.dataset.src; img.removeAttribute('data-src'); } };
  if (window.LORE_BUNDLE && !window.LORE_DATA && scr.querySelector('img[data-src]')) {
    const s = document.createElement('script');
    s.src = 'lore.js';
    s.onload = s.onerror = show;
    document.head.appendChild(s);
  } else show();
  if (typeof lmLoreLogs === 'function') lmLoreLogs(); // (the wrecks' logs found on this device: js/landmarks.js)
  scr.hidden = false;
  pagerShow(LORE_PAGER, at && $(at) ? at : pagerSections(LORE_PAGER)[0].id); // (`at`: a page to open on, from the Records screen)
  musicLore(true); // (the campaign theme while it's open: musicLore in audio.js)
  try { history.pushState({ lore: 1 }, ''); } catch (e) { /* no history to add to (a sandboxed frame) */ }
}

function closeLore(fromBack) {
  if ($('screen-lore').hidden) return;
  $('screen-lore').hidden = true;
  if (LORE_PAGER.unzoom) LORE_PAGER.unzoom();
  musicLore(false);
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
  // The atlas (The atlas page): a tap enlarges it over the whole screen, to pan with a finger; a tap or Esc closes it.
  const zoom = $('screen-lore').querySelector('.lore-zoom');
  if (zoom) {
    const fig = zoom.parentElement, set = (on) => { fig.classList.toggle('open', on); zoom.setAttribute('aria-expanded', on ? 'true' : 'false'); };
    zoom.onclick = () => { sfx('click'); set(!fig.classList.contains('open')); };
    window.addEventListener('keydown', (e) => { if (e.key === 'Escape' && fig.classList.contains('open')) { e.preventDefault(); e.stopImmediatePropagation(); set(false); } }, true);
    LORE_PAGER.unzoom = () => set(false);
  }
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
  showCheckpoints('o');
  $('o-rematch').hidden = true;
  if (UI.watch) { watchOver(); return; } // (a game being watched has its own end, and saves nothing: js/watch.js)
  if (S.contingency && typeof contBattleOver === 'function') { // (a Contingency battle: its result goes back to the globe, after the word in the Command Deck's blue)
    const cwon = S.winner === ME || allies(S.winner, ME);
    sfx(cwon ? 'win' : 'lose');
    overFlare(cwon ? 'Victory' : 'Defeat', cwon ? 'Battle won' : 'Battle lost', cwon ? 'win' : 'loss', () => { $('screen-over').hidden = true; if (S && S.contingency) contBattleOver(false); });
    return;
  }
  clearSave();
  UI.overNew = null; UI.overMenu = null;
  $('o-new').textContent = 'New game'; $('o-menu').textContent = 'Main menu';
  $('o-code').hidden = true;
  $('o-keep').hidden = true;
  $('o-log').hidden = true;
  $('o-report').hidden = true;
  if (S.mission) { showMissionOver(); return; }
  if (S.horde) { showHordeOver(); return; } // (Horde: the waves survived, the best kept)
  const won = S.winner === ME || allies(S.winner, ME), how = S.endHow || 'capture', many = nColonies() > 2;
  const The = S.players[S.winner] ? playerName(S.winner) : 'The rival'; // (its callsign; a person, in multiplayer: by name)
  // The narrator's last line (LORE.md): the region secured, or the command core lost.
  // (lost while the colony stands: on the Uplinks another colony speaks for the planet; else, settlement priority)
  // (Contact, the Great Uplink win: what answered, the same for every colony; see GUP_ANSWER.)
  $('o-log').textContent = how === 'contact' ? GUP_ANSWER : won ? NARRATOR[how === 'domination' || how === 'uplinks' ? how : 'victory'] : NARRATOR[S.players[ME].out ? 'defeat' : how === 'uplinks' ? 'uplinksLost' : 'outranked'];
  $('o-log').hidden = false;
  // (Contact: silence, then one answering tone, the same for everyone: see gupSilence.)
  if (how === 'contact') gupSilence(); else sfx(won ? 'win' : 'lose');
  // (the heading, the word that flares in: overFlare; under it, how it was won or lost)
  const word = won ? (how === 'contact' ? 'Contact' : 'Victory') : 'Defeat';
  const kick = won ? (S.teams ? 'Your team wins' : { domination: 'Domination', uplinks: 'Uplinks held', contact: 'The planet is yours', surrender: 'The rivals surrendered', nuke: 'Nuclear strike' }[how] || 'Capture')
    : how === 'surrender' && S.players[ME].out ? 'You surrendered' : how === 'contact' ? 'A rival made contact' : how === 'domination' ? 'Rival domination' : how === 'uplinks' ? 'A rival held the Uplinks'
      : S.players[ME].out ? 'Command Base lost' : 'The planet is lost';
  $('o-text').textContent = won
    ? (how === 'contact' ? `Your Great Uplink held its transmission for ${GUP.hold / 60} minutes and made contact. The planet is yours.`
      : how === 'domination' ? `You held most of the planet's land for ${DOM.hold / 60} minutes. The planet is yours.`
      : how === 'uplinks' ? `You led on the Uplinks for ${UPLINK.hold / 60} minutes. The planet is yours.`
      : how === 'surrender' ? (many ? 'The last rival surrendered: the planet is yours.' : `${playerName(S.players.findIndex((P, k) => k !== ME))} surrendered. The planet is yours.`)
      : how === 'nuke' ? (many ? 'Your nuclear missile destroyed the last rival Command Base. The planet is yours.' : `Your nuclear missile destroyed ${playerName(S.players.findIndex((P, k) => k !== ME))}'s Command Base. The planet is yours.`)
        : many ? `${nColonies() > 3 ? 'All three' : 'Both'} rival Command Bases are yours: the last colony standing. The planet is yours.` : `Your warbots captured ${playerName(S.players.findIndex((P, k) => k !== ME))}'s Command Base. The planet is yours.`)
    : how === 'contact' ? `${The} held its Great Uplink's transmission for ${GUP.hold / 60} minutes and made contact. Regroup and try again.`
    : how === 'domination' ? `${The} held most of the planet's land for ${DOM.hold / 60} minutes. Regroup and try again.`
      : how === 'uplinks' ? `${The} led on the Uplinks for ${UPLINK.hold / 60} minutes. Regroup and try again.`
      : how === 'surrender' && S.players[ME].out ? `You surrendered to ${The === 'The rival' ? 'the rival' : The}: everything you built is theirs. Regroup and try again.`
      : `${The} ${S.players[ME].out ? (how === 'nuke' ? 'destroyed your Command Base with a nuclear missile' : 'captured your Command Base') : 'took the planet'}. Regroup and try again.`;
  if (S.teams && how === 'contact') $('o-text').textContent = won ? `${S.winner === ME ? 'Your' : `${playerName(S.winner)}'s`} Great Uplink held its transmission for ${GUP.hold / 60} minutes and made contact: your team wins.`
    : `The rival team's Great Uplink held its transmission for ${GUP.hold / 60} minutes and made contact. Regroup and try again.`;
  else if (S.teams) $('o-text').textContent = won ? `Your team took ${how === 'surrender' ? 'the planet (the last of them surrendered)' : 'both rival Command Bases'}: the planet is yours${S.players[ME].out ? ', though your own colony fell on the way' : ''}.`
    : how === 'surrender' && S.players[ME].out ? 'You surrendered: the rival team takes everything you built. Regroup and try again.'
    : `The rival team ${S.players[ME].out ? (how === 'nuke' ? 'destroyed your Command Base with a nuclear missile' : 'captured your Command Base') : 'took the planet'}. Regroup and try again.`;
  const st = S.players[ME].stats;
  $('o-stats').innerHTML = [
    ['Time', fmtTime(S.time)], ['Buildings completed', st.built], ['Bots built', st.bots - (st.startBots || 0)],
    ['Enemy buildings captured', st.captured], ['Bots lost', st.lost],
  ].map(([k, v]) => `<span>${k}</span><span>${v}</span>`).join('');
  // The report: the moments that mattered, where goods were lost, a tip for next time (js/insight.js).
  $('o-report').innerHTML = gameReport(won);
  $('o-report').hidden = !$('o-report').innerHTML;
  // Won a game against the computer: you can play on (keepPlaying), if it was a fun one and there's more fighting to do.
  $('o-keep').hidden = !(won && !MP.on);
  metaGameOver(); // (records that fell and achievements earned: js/goals.js)
  dailyOver(won); // (the Daily Planet's best time: js/polish3.js)
  syncRematch(); // (js/polish.js)
  overFlare(word, kick, won ? 'win' : 'loss');
}

/**
 * Keep playing past a victory (a game against the computer only: in multiplayer everyone would have to agree): the
 * end screen goes, the game runs on, and nothing wins any more (S.endless, see eliminate and the checks in simStep):
 * rivals still standing fight on and no longer surrender; Domination and the Uplinks stop counting. Losing your own
 * colony still ends it. The victory is in the past: its screen isn't shown again.
 */
function keepPlaying() {
  if (MP.on || S.winner < 0 || !(S.winner === ME || allies(S.winner, ME))) return;
  S.endless = true;
  S.winner = -1; S.endHow = null;
  UI.overShown = false;
  $('screen-over').hidden = true;
  UI.paused = false;
  const foesLeft = S.players.some((Q) => !Q.absent && !Q.out && foes(Q.id, ME));
  toast(foesLeft ? 'Playing on: the war goes on, and the game won\'t end until you leave it (or lose your colony).' : 'Playing on: no rivals left, so the planet is yours to build on. The game won\'t end until you leave it.', 'info');
  if (typeof saveGame === 'function') saveGame(); // (the victory cleared the save: this game is worth keeping again)
}

/* ------------------------------------------------------------------ missions */

function openMissions() {
  UI.msSel = null;
  $('screen-missions').hidden = false;
  renderMissions();
}

/** What each level does to a mission (the line under the mission picker's level buttons; DIFF_ORDER's order). */
const MISSION_DIFF_INFO = [
  'Settler: half as much again in the Command Base, the smallest goals, the mildest rival, no clock.',
  'Pioneer: a little extra in the Command Base, goals between Settler and Colonist, no clock.',
  'Colonist: the mission as designed. No clock.',
  'Commander: less in the Command Base, bigger goals, a tougher rival and (on most) a clock.',
  'Warlord: less again, the biggest goals, the rival a level above Commander, the same clock. For a strong player.',
];

/** The planet and rules of a mission at level diff, in a line: mode, map type, size, terrain, rival, extras, clock. */
function missionMeta(def, diff) {
  const size = SIZE_PRESETS[def.size].name, terr = TERRAIN_PRESETS[def.rough].name, shape = (SHAPE_PRESETS[def.shape || 0] || SHAPE_PRESETS[0]).name;
  const lim = mLimit(def, diff), limit = lim ? ` · ${lim} min limit` : '';
  // What the mission switches on that missions otherwise leave out.
  const extras = [def.victory && VICTORY[def.victory] && VICTORY[def.victory].name, def.mode === 'colony' && def.war && 'Warbots', (def.murmur || def.wildlife) && 'The Murmur', def.events && 'Planet events', def.nuke && 'Nuclear race', def.mega && 'Megastructures', def.lab && 'Research Lab'].filter(Boolean);
  const more = extras.length ? ` · ${extras.join(', ')}` : '';
  if (def.mode === 'colony') return `Colony · ${shape} · ${size} · ${terr}${more}${limit}`;
  const n = playerCount('versus', def.shape || 0, def.players) - 1, style = isDoctrine(def.style) ? ` ${PERSONALITIES[def.style].name}` : '';
  const rival = `${n > 1 ? n + ' ' : ''}${DIFFICULTY[mPick(def.rival, diff)].label}${style} rival${n > 1 ? 's' : ''}${def.style === 'random' ? ` (random doctrine${n > 1 ? 's' : ''})` : ''}${def.passive && mPick(def.passive, diff) ? ' (passive)' : ''}`;
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
    body.innerHTML = `<p class="desc">${MISSIONS.length} missions, each with its own goals and the five difficulty levels, Settler to Warlord. Play them in order to learn the game, or pick any.</p>
      <div class="ms-list">${MISSIONS.map((m, k) => {
        const done = c.done[m.id] || [];
        const marks = MISSION_DIFF_NAMES.map((n, d) => (done[d] ? `<span class="ms-done">${n} ✓</span>` : '')).filter(Boolean).join(' ');
        const head = m.chapter && m.chapter !== chapter ? `<div class="section-label ms-chapter">${(chapter = m.chapter)}</div>` : '';
        return `${head}<button class="ms-item${k === next ? ' next' : ''}" data-k="${k}"><span class="ms-num">${k + 1}</span>
          <span class="ms-name">${m.name}</span><span class="ms-meta">${marks || (k === next ? '<b class="ms-up">Next up</b> · ' : '') + (m.mode === 'colony' ? 'Colony' : 'Versus')}</span></button>`;
      }).join('')}</div>${msg ? `<p class="hint">${msg}</p>` : ''}`;
    for (const el of body.querySelectorAll('.ms-item')) el.onclick = () => { sfx('click'); UI.msSel = +el.dataset.k; UI.msDiff = UI.msDiff ?? MISSION_DIFF_DEFAULT; renderMissions(); };
    return;
  }
  const k = UI.msSel, def = MISSIONS[k], diff = UI.msDiff ?? MISSION_DIFF_DEFAULT;
  const done = c.done[def.id] || [];
  body.innerHTML = `<p class="hint" style="margin-top:6px">Mission ${k + 1} of ${MISSIONS.length}</p>
    <h3 style="margin:2px 0 6px;font-size:20px">${def.name}</h3>${def.chapter ? `<p class="hint" style="margin:0 0 4px">${def.chapter}</p>` : ''}
    <p class="desc">${def.brief}</p>
    <div class="section-label" style="margin-top:12px" id="ms-l-diff">Difficulty</div>
    <div class="seg" id="ms-diff" role="radiogroup" aria-labelledby="ms-l-diff">${MISSION_DIFF_NAMES.map((n, d) => `<button type="button" role="radio" aria-checked="${d === diff}" data-d="${d}" data-v="${MISSION_DIFFS[d]}" class="${d === diff ? 'on' : ''}">${n}${done[d] ? ' ✓' : ''}</button>`).join('')}</div>
    <p class="hint" id="ms-diff-info">${MISSION_DIFF_INFO[diff]}</p>
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
  newGame({ ...missionOptions(k, diff), scars: scarsPref() });
  UI.lastGame = { s: S, mission: [k, diff] }; // (for Rematch)
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
  // (Rivals dealt a doctrine at random: which they got.)
  if (def.style === 'random') {
    const dealt = S.players.filter((P) => P.id !== ME && !P.absent && isDoctrine(P.style)).map((P) => `${callsign(P.id, true)} is ${PERSONALITIES[P.style].noun} (${PERSONALITIES[P.style].plain})`);
    if (dealt.length) postMsg(ME, `Dealt: ${dealt.join('; ')}.`, 0, 0, 'info');
  }
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
      // (A goal's `focus` can name the exact building or robot and the buttons for its current step.)
      const g0 = def.goals[now], pick = g0.focus?.(S);
      const g = pick ? { ...g0, site: pick.e || pick, ui: pick.ui || g0.ui, one: true } : g0;
      const sites = goalSites(g, M.diff), lone = sites.find(siteNeedsRoad);
      const onSite = (g.ui || '').split(',').filter((p) => /#sh-/.test(p) && !/#sh-layroad/.test(p)).join(',');
      const c = lone ? coachTarget({ ui: '#sh-layroad', site: lone }) : sites.length ? coachTarget({ ...g, ui: onSite, site: sites[0] }) : coachTarget(g);
      sel = c.sel;
      // A panel button whose panel isn't open: a ring pulses on the building to tap (every 1.5 s of game time).
      // (A later time than now is from an earlier game this session: ring again at once.)
      if (c.ring && (S.time - (UI.coachRingT ?? -9) >= 1.5 || S.time < UI.coachRingT)) {
        UI.coachRingT = S.time;
        const bot = !!BOTS[c.ring.type]; // (a robot stands at its own x, y; a building or Trade Post on its tile)
        addFx('ring', c.ring.x + (bot ? 0 : 0.5), c.ring.y + (bot ? 0 : 0.5), { color: '#38d4ff', r: bot ? 1.1 : 1.6, life: 1.1 });
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
const COACH_OPENERS = [[/\.bcard|#build-tabs/, '#btn-build'], [/#banner-/, '#btn-road'], [/#ar-/, '#btn-attack'], [/#pop-/, '#pop'],
  // (A pause-menu button: the pause button while the menu is shut; in it, Settings or Back, whichever view has it.)
  [/#p-(?!plan)/, () => ($('screen-pause').hidden ? '#btn-pause' : UI.pauseView === 'settings' ? '#p-back' : '#p-settings')],
  // (Plan while paused: the pause button to reach it; once planning, Build, where the site to place is.)
  [/#p-plan/, () => (planning() ? '#btn-build' : $('screen-pause').hidden ? '#btn-pause' : '#p-back')]];

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
  // (So too a Viaduct or Ropeway, picked in Paths: Paths and its tool are done with.)
  const placing = (p) => (p.match(/\.bcard\[data-t=['"]?(\w+)/) || p.match(/#banner-seg \[data-v=['"]?(viaduct|ropeway)/) || [])[1] === UI.placeType;
  if (R.mode === 'place' && sel.split(',').some(placing)) {
    const done = crossingPlacing() ? /\.bcard|#build-tabs|#btn-build|#banner-ok|#btn-road|#banner-seg/ : /\.bcard|#build-tabs|#btn-build|#banner-ok/;
    const rest = sel.split(',').filter((p) => !done.test(p));
    return { sel: [...rest, '#banner-ok'].join(','), ring: null };
  }
  const c = coachTargetAll(g, sel);
  let left = coachLeft(c.sel);
  // (In Paths with a sketch drawn, for a goal done there: its Build makes the sketch real.)
  if (R.mode === 'road' && /#btn-road|#banner-/.test(sel) && !/#banner-ok/.test(left) && !$('banner-ok').hidden) left = left ? `${left}, #banner-ok` : '#banner-ok';
  // (An upright phone keeps the Paths tools behind the Tool button: with the picker shut, the button lights for a goal's
  // tool that isn't the one in use. Open, the tool's own button in it lights, as in the row elsewhere.)
  const tools = [...sel.matchAll(/#banner-seg \[data-v=['"]?(\w+)/g)].map((m) => m[1]);
  if (tools.length && !tools.some(pathsToolOn) && toolButtonShut()) left = left ? `${left}, #banner-tool` : '#banner-tool';
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
    if (q === '#btn-road') return R.mode !== 'road' && !crossingPlacing();
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
  if (want && (g.one ? want !== shown : want.type !== shown.type)) { // (`one`: that very building, not any of its type)
    const rest = sel.split(',').filter((p) => !/#sh-/.test(p)).join(',');
    return { sel: rest ? coachTarget({ ...g, ui: rest }).sel : '', ring: want };
  }
  if (els.some((el) => el.getClientRects().length > 0)) return { sel, ring: null };
  const open = [];
  let panel = false;
  for (const part of sel.split(',')) {
    for (const [re, to] of COACH_OPENERS) { const opener = typeof to === 'function' ? to() : to; if (re.test(part) && !open.includes(opener)) open.push(opener); }
    // (A card on another tab of the open build menu: that tab.)
    const card = part.match(/\.bcard\[data-t=['"]?(\w+)/), tab = card && ((BUILD_GROUPS.find((gr) => gr.types.includes(card[1])) || buildKeyOf(card[1]) && { key: buildKeyOf(card[1]).tab }) || {}).key;
    if (tab && !open.includes(`#build-tabs [data-g="${tab}"]`)) open.push(`#build-tabs [data-g="${tab}"]`);
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
  if (g.site) return g.site.dead ? null : g.site; // (a given building, robot or Trade Post: see missionCoach)
  const live = S.buildings.filter((b) => !b.dead && BDEFS[b.type]);
  if (g.at) return live.find((b) => b.owner === ME && b.type === g.at) || live.find((b) => b.type === g.at) || null;
  const hint = plainHint(g.hint);
  if (!hint) return null;
  // ("Tap a gold Trade Post": the post nearest your Command Base where you have no Terminal yet. Posts aren't buildings.)
  const pk = hint.indexOf('Trade Post'), L = S.players[ME] && getE(S.players[ME].lander);
  if (pk >= 0 && L && S.posts && S.posts.length && !live.some((b) => { const k = hint.indexOf(BDEFS[b.type].name); return k >= 0 && k < pk; })) {
    const free = S.posts.filter((p) => !live.some((b) => b.owner === ME && BDEFS[b.type].terminal && nearPost(b.x, b.y) === p));
    if (free.length) return free.reduce((a, p) => (dist2(p.x, p.y, L.x, L.y) < dist2(a.x, a.y, L.x, L.y) ? p : a));
  }
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
  $('o-text').textContent = won
    ? `${def.name} (${MISSION_DIFF_NAMES[M.diff]}) done in ${fmtTime(S.time)}.`
    : M.why === 'time' ? `${def.name}: time ran out before every goal was met.`
      : M.why === 'lander' ? `${def.name}: ${S.players.length > 2 && S.players[S.winner] ? playerName(S.winner) : 'the rival'} captured your Command Base.`
        : M.why === 'uplinks' ? `${def.name}: ${playerName(S.winner)} held the Uplinks for ${UPLINK.hold / 60} minutes.` : `${def.name}: the game ended before every goal was met.`;
  $('o-stats').innerHTML = states.map((s) => { return `<span>${s.done ? '✓' : '✗'} ${s.text}</span><span>${s.need > 1 ? `${s.have}/${s.need}` : s.done ? 'Done' : '–'}</span>`; }).join('');
  $('o-report').innerHTML = gameReport(won); // (the moments that mattered, where goods went, a tip: js/insight.js)
  $('o-report').hidden = !$('o-report').innerHTML;
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
  metaGameOver(); // (achievements earned: js/goals.js)
  syncRematch(); // (js/polish.js)
  overFlare(won ? 'Complete' : 'Failed', `Mission ${k + 1} · ${def.name}`, won ? 'win' : 'loss');
}

/* ------------------------------------------------------------------ statistics screen */

/**
 * Statistics from the pause menu or I: in your own game the Economy panel on History (from the pause menu, paused to
 * plan, so the panel can be used; in multiplayer the game runs on), otherwise (observing) the Statistics screen.
 */
function statsHere() {
  if (!UI.inGame || !S || !S.players[ME] || UI.watch || S.winner >= 0) { openStats(); return; }
  if (!$('screen-pause').hidden && !planPause()) $('p-resume').click();
  openEconomy('hist');
}

function openStats() {
  UI.stats = UI.stats || { good: 'alloy', type: null };
  UI.stats.econ = UI.stats.econ || 'output';
  UI.stats.mil = UI.stats.mil || 'army';
  $('screen-stats').hidden = false;
  renderStats();
}

/** The statistics, into `into` (the Economy panel's History tab), or the Statistics screen. */
function renderStats(into) {
  const H = S.hist || newHistory(S.players.length);
  const versus = S.mode !== 'colony';
  const P = S.players[ME], st = P.stats;
  const made = Object.values(P.made || {}).reduce((a, v) => a + v, 0);
  const tiles = [['Time', fmtTime(S.time)], ['Buildings built', st.built], ['Bots built', st.bots - (st.startBots || 0)],
    ['Goods produced', made.toLocaleString()], versus ? ['Rival buildings taken', st.captured] : ['Land claimed', Math.floor(landShare(ME) * 100) + '%'],
    ['Bots lost', st.lost]];
  const players = versus ? S.players.filter((P) => !P.absent).map((P) => P.id) : [0]; // (not the Murmur's slot)
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
    army: { label: 'Army', sub: 'Warbots and the other fighters: Bulwarks, Torches, Vulcan Bombers.', fn: (h) => h.war || [] },
    def: { label: 'Defences', sub: 'Forts and guns: Outposts, Bunkers, Keeps, turrets, Mortar Pits, Silos and the rest.', fn: (h) => h.def || [] },
  };
  const war = warOn();
  if (!ECON[UI.stats.econ]) UI.stats.econ = 'output';
  if (!MIL[UI.stats.mil]) UI.stats.mil = 'army';
  const econSer = () => ser((h) => pad(ECON[UI.stats.econ].fn(h)));
  const milSer = () => ser((h) => pad(MIL[UI.stats.mil].fn(h)));
  const landSer = ser((h) => h.land || []);
  const goodSer = ser((h) => (h.goods && h.goods[UI.stats.good]) || []);
  (into || $('st-body')).innerHTML = `
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

function setMode(mode, keepPlan) {
  // Leaving Paths drops a plan that was never built (it cost nothing). Placing a Viaduct or Ropeway from Paths keeps it
  // (keepPlan; UI.planKept while it's placed) for when you're back in Paths; leaving that for anywhere else drops it.
  if ((R.mode === 'road' || UI.planKept) && mode !== 'road' && !keepPlan) dropDraft();
  if (R.mode === 'road' && mode !== 'road') UI.routeGhost = null;
  UI.planKept = !!keepPlan && !draftEmpty();
  UI.toolPick = false; // (the Paths tools picker of an upright phone: see toolPicker)
  R.mode = mode;
  for (const m of ['road', 'place', 'attack', 'aim', 'land', 'airdrop']) document.body.classList.toggle('mode-' + m, mode === m);
  document.body.classList.toggle('mode-on', mode !== 'normal'); // (any mode: on an upright phone its banner takes the bottom bar's place)
  if (mode !== 'aim') { R.aim = null; UI.aimSilo = 0; }
  if (mode !== 'aim' && mode !== 'land' && mode !== 'airdrop' && mode !== 'strike' && mode !== 'scorch' && mode !== 'mastlink' && mode !== 'mdaim' && mode !== 'allyaim' && mode !== 'focusaim') R.aimHover = null;
  if (mode !== 'focusaim') UI.focusB = 0;
  if (mode !== 'allyaim') UI.allyAim = null;
  if (mode !== 'mastlink') UI.linkMast = 0;
  if (mode !== 'mdaim') { UI.mdAim = 0; UI.mdKit = false; }
  if (mode !== 'strike') R.napalmAt = null;
  if (mode !== 'scorch') { R.scorchAt = null; UI.scorchIds = null; }
  if (mode !== 'land') { R.landAt = null; UI.landFerry = 0; }
  if (mode !== 'airdrop') { R.dropAt = null; UI.dropPlane = 0; }
  if (mode !== 'attack') UI.armyCmd = null;
  if (mode !== 'agpick') UI.agPick = null; // (picking an Army Group's points or home)
  R.ghost = null;
  R.overlay = null;
  R.ropeEnd = null;
  UI.ropeA = null;
  UI.bendDrag = null; // (a bend being dragged, editing a Maglev line's bends)
  if (UI.pick) { UI.pick = 0; UI.pickDeck = null; R.selected = 0; UI.selBot = 0; } // (a strike or shelling target picked by a finger and not confirmed)
  UI.placeType = null;
  UI.moveFrom = 0;
  if (mode !== 'bppick') UI.bpPick = null; // (blueprints: picking buildings, placing one: js/blueprint.js)
  if (mode !== 'bpplace') UI.bpPlace = null;
  if (mode !== 'terra') UI.tf = null; // (a Terraform plan never sent is dropped: it cost nothing)
  if (UI.bpOffer && mode !== 'normal') { UI.bpOffer = null; bpOfferShow(); }
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

/** A Ferry of yours tied up at Port b, free for a beach landing: a spare first, before the one working a ferry line (lineFerry). */
function portFerry(b) {
  const here = S.bots.filter((u) => !u.dead && u.owner === b.owner && BOTS[u.type].ferry && u.inside === b.id && !u.landing);
  const far = b.ferryTo ? getE(b.ferryTo) : null, onLine = far && !far.dead ? lineFerry(b, far) : null;
  return here.find((u) => u !== onLine) || here[0] || null;
}

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

/** Your Vulcan Bombers, and the first that's parked, rearmed and free to fly a sortie (optionally: at `t`). */
function myBombers() { return S.bots.filter((u) => !u.dead && u.owner === ME && BOTS[u.type].bomber); }
function readyBomber(t) { return myBombers().find((u) => !u.mission && !u.flight && !(u.rearmUntil > S.time) && planeBase(u) && u.inside === planeBase(u).id && (!t || !strikeBlocked(ME, u, t))) || null; }

/** Pick a target for bomber u on the map: its payload first (Bomb or Napalm, on the banner; the last one picked stays). */
function startStrike(u) {
  closeSheet(); setMode('strike'); UI.bomber = u.id;
  UI.strikeKind = UI.strikeKind === 'napalm' ? 'napalm' : 'bomb';
  R.napalmAt = null;
  showStrikeBanner();
}

/** The strike banner's payload switch: Bomb (B) or Napalm (N). */
function strikeSeg() {
  const nap = UI.strikeKind === 'napalm';
  return `<span class="keep-all">Payload <span class="seg" id="strike-kind"><button data-v="bomb" class="${nap ? '' : 'on'}">Bomb<kbd>B</kbd></button><button data-v="napalm" class="${nap ? 'on' : ''}">Napalm<kbd>N</kbd></button></span></span>`;
}

/** A banner while picking a bomber's target, with the payload switch under it. */
function strikeBanner(html, okLabel) {
  showBanner(html + strikeSeg(), okLabel, 'Cancel');
  for (const btn of $('banner-text').querySelectorAll('#strike-kind button')) btn.onclick = (e) => { e.stopPropagation(); setStrikeKind(btn.dataset.v); };
}

/** Switch the bomber's payload while picking its target (anything picked so far is let go). */
function setStrikeKind(k) {
  if (R.mode !== 'strike' || (k !== 'bomb' && k !== 'napalm')) return;
  if (UI.strikeKind === k) return;
  UI.strikeKind = k;
  if (UI.pick) { UI.pick = 0; UI.pickDeck = null; R.selected = 0; UI.selBot = 0; }
  R.napalmAt = null;
  sfx('click');
  showStrikeBanner();
}

function showStrikeBanner(problem) {
  const u = getE(UI.bomber);
  if (!u || u.dead) { setMode('normal'); return; }
  const err = problem ? `<span class="err">${problem}</span> ` : '';
  if (UI.strikeKind !== 'napalm') {
    strikeBanner(err + `Tap an enemy building (or the deck of an enemy Viaduct), or an enemy vehicle or robot out in the open: the <b>Vulcan Bomber</b> loads ${BOMBER.ammo} Ammo and ${BOMBER.fuel} Fuel (on top of its tank), flies out and drops its bomb, then comes home to rearm. It reaches ${planeReach(u)} tiles from its Airfield.`);
    return;
  }
  const at = R.napalmAt, n = at ? napalmSoil(at.i, at.j) : 0;
  strikeBanner(err + (at
    ? `<b>Drop napalm here?</b> ${n ? `It burns ${n} patch${n === 1 ? '' : 'es'} of fertile soil for good (no Bio Farm grows crops there again), and` : 'There\'s no fertile soil here: it'} sets the ground on fire for ${NAPALM.burn} seconds.`
    : `Tap any ground in reach. <b>Napalm</b> (${BOMBER.fuel + NAPALM.fuel} Fuel on top of its tank, the sortie's ${BOMBER.fuel} and ${NAPALM.fuel} more; no Ammo) sets everything within ${NAPALM.radius} tiles on fire for ${NAPALM.burn} seconds, burning enemy robots and buildings a little, and scorches fertile soil there <b>for good</b>: no Bio Farm grows crops on it again. It reaches ${planeReach(u)} tiles from its Airfield.`), at ? 'Napalm' : null);
}

/** A tap or click on the map with Napalm picked: a click (or the banner's Napalm, under a finger) sends the bomber. */
function napalmTap(i, j) {
  const u = getE(UI.bomber);
  if (!u || u.dead) { setMode('normal'); return; }
  const why = napalmBlocked(ME, u, i, j);
  if (why) { sfx('error'); R.napalmAt = null; showStrikeBanner(why); return; }
  if (INPUT.mouse) { sendNapalm(i, j); return; }
  R.napalmAt = { i, j };
  sfx('click');
  showStrikeBanner();
}

function sendNapalm(i, j) {
  const u = getE(UI.bomber);
  if (!u || u.dead) { sfx('error'); showStrikeBanner('That bomber is gone.'); return; }
  const n = napalmSoil(i, j);
  act('napalm', [u.id, i, j], (why) => {
    if (why) { sfx('error'); R.napalmAt = null; showStrikeBanner(why); return; }
    sfx('order'); setMode('normal');
    addFx('ring', i + 0.5, j + 0.5, { color: '#ff8a2a', r: NAPALM.radius + 0.3 });
    toast(`Napalm ordered: the bomber loads ${BOMBER.fuel + NAPALM.fuel} Fuel and takes off.${n ? ` ${n} patch${n === 1 ? '' : 'es'} of fertile soil will burn for good.` : ''}`, 'good');
  });
}

/** A Vulcan Bomber ready on the ground that can drop napalm on tile (i, j), or null. */
function readyNapalm(i, j) { return myBombers().find((u) => !u.mission && !u.flight && !(u.rearmUntil > S.time) && !napalmBlocked(ME, u, i, j)) || null; }

/**
 * The Air strike section of a fertile soil or crop panel: shown whenever you have a Vulcan Bomber, whoever farms the
 * soil (on your own farmland the button says so). refreshNapalmSection keeps its button and hint current.
 */
function napalmSection(t) {
  if (!myBombers().length) return '';
  const own = soilHolder(t) === ME;
  return `<div class="section-label">Air strike</div><p class="hint" id="sh-nap-hint"></p>` +
    `<button class="btn big${own ? ' danger' : ''}" id="sh-napalm">${own ? 'Napalm your own farmland' : 'Napalm it'}</button>`;
}

function refreshNapalmSection(t) {
  const btn = $('sh-napalm');
  if (!btn) return;
  const i = t % S.W, j = (t / S.W) | 0, u = readyNapalm(i, j), n = napalmSoil(i, j), who = soilHolder(t), any = myBombers();
  btn.disabled = !u;
  const farm = who === ME ? ' <b>This is your own farmland</b>: what burns, your Bio Farms lose for good.'
    : who >= 0 ? ` It's ${playerName(who, true)}'s farmland.` : '';
  const why = u ? '' : !any.length ? 'You have no Vulcan Bombers left.'
    : any.some((v) => !v.mission && !v.flight && !(v.rearmUntil > S.time)) ? napalmBlocked(ME, any.find((v) => !v.mission && !v.flight && !(v.rearmUntil > S.time)), i, j)
      : any.some((v) => v.rearmUntil > S.time && !v.mission && !v.flight) ? `Your bombers are rearming (${Math.ceil(Math.min(...any.filter((v) => v.rearmUntil > S.time).map((v) => v.rearmUntil - S.time)))} s).`
        : 'Your bombers are out on sorties.';
  $('sh-nap-hint').innerHTML = `Napalm here: ${BOMBER.fuel + NAPALM.fuel} Fuel at the Airfield and no Ammo. It burns ${n} patch${n === 1 ? '' : 'es'} of fertile soil within ${NAPALM.radius} tiles for good (crops on it too), and whatever stands there for ${NAPALM.burn} seconds.${farm}` +
    (why ? ` <span class="err">${why}</span>` : '');
}

/** A panel's Napalm button: the first ready bomber drops napalm on tile (i, j) (`what`: for the toast). */
function napalmFromPanel(i, j, what) {
  const u = readyNapalm(i, j);
  if (!u) { sfx('error'); toast('No Vulcan Bomber is ready that can reach it.', 'warn'); return; }
  const n = napalmSoil(i, j);
  act('napalm', [u.id, i, j], (why) => {
    if (why) { sfx('error'); toast(why, 'warn'); return; }
    sfx('order'); toast(`Napalm ordered on ${what}: a bomber loads ${BOMBER.fuel + NAPALM.fuel} Fuel and takes off.${n ? ` ${n} patch${n === 1 ? '' : 'es'} of fertile soil will burn for good.` : ''}`, 'good');
    refreshSheet();
  });
}

/* ------------------------------------------------------------------ Torches: Scorch the earth */

/** Your Torches among the selection (when Torch u is one of them), else u alone: the ones a Scorch the earth goes to. */
function scorchGroup(u) {
  const sel = UI.sel.includes(u.id) ? orderable(ME, UI.sel).filter((v) => BOTS[v.type].flame) : [];
  return sel.length ? sel : [u];
}

/** Scorch the earth: pick the patch of fertile soil on the map for these Torches (each takes a patch). */
function startScorch(ids) {
  closeSheet(); setMode('scorch');
  UI.scorchIds = ids.slice();
  R.scorchAt = null;
  showScorchBanner();
}

function showScorchBanner(problem) {
  const us = orderable(ME, UI.scorchIds || []).filter((v) => BOTS[v.type].flame);
  if (!us.length) { setMode('normal'); return; }
  const ready = us.filter(scorchReady).length, n = us.length;
  const err = problem ? `<span class="err">${problem}</span> ` : '';
  const who = n === 1 ? 'the <b>Torch</b> walks there and sprays its whole tank into it'
    : `your <b>${n} Torches</b> (${ready} with a full enough tank) each take a patch, there and round it, and spray their whole tanks into it`;
  showBanner(err + (R.scorchAt
    ? `<b>Scorch this soil?</b> It's burned for good: no Bio Farm grows crops there again.`
    : `Tap fertile soil (the dark farmland Bio Farms grow crops on): ${who}, ${TORCH.scorch} seconds of fire. The soil is <b>burned for good</b>: no Bio Farm grows crops there again. Then ${n === 1 ? 'it goes' : 'they go'} back to refill (1 Fuel a tank).`), R.scorchAt ? 'Scorch' : null, 'Cancel');
}

/** A tap or click on the map while picking soil to scorch: a click (or the banner's Scorch, under a finger) sends them. */
function scorchTap(i, j) {
  if (!inMap(i, j)) return;
  const why = scorchTileWhy(tIdx(i, j), ME);
  if (why) { sfx('error'); R.scorchAt = null; showScorchBanner(why); return; }
  if (INPUT.mouse) { sendScorch(i, j); return; }
  R.scorchAt = { i, j };
  sfx('click');
  showScorchBanner();
}

function sendScorch(i, j) {
  act('scorch', [(UI.scorchIds || []).slice(), i, j], (r) => {
    if (!r || !r.n) { sfx('error'); R.scorchAt = null; showScorchBanner((r && r.why) || 'Those Torches are gone.'); return; }
    sfx('order'); setMode('normal');
    addFx('ring', i + 0.5, j + 0.5, { color: '#ff8a2a' });
    toast(r.n === 1 ? 'The Torch is off to scorch the soil: it empties its tank into it, then goes back to refill.'
      : `${r.n} Torches are off to scorch the soil there, a patch each: they empty their tanks into it, then go back to refill.`, 'good');
  });
}

/** The Scorch the earth button on a Torch's panel: on while it (or a Torch selected with it) has a full enough tank. */
function refreshScorchButton(u) {
  const btn = $('sh-scorch'), hint = $('sh-scorch-hint');
  if (!btn) return;
  const us = scorchGroup(u), ready = us.filter(scorchReady).length, busy = u.task && u.task.type === 'scorch';
  btn.disabled = !ready || u.owner !== ME;
  btn.textContent = us.length > 1 ? `Scorch the earth (${us.length} Torches)` : 'Scorch the earth';
  hint.textContent = busy ? 'It\'s on its way to burn a patch of farmland.'
    : ready ? `Tap fertile soil: ${us.length > 1 ? 'each Torch walks to a patch' : 'it walks there'} and sprays its whole tank into it (${TORCH.scorch} seconds), burning the soil for good so no Bio Farm grows crops there again. Then it refills (1 Fuel).`
      : `It takes a nearly full tank (${Math.round(TORCH.scorchMin * 100)}%): it has ${Math.round(u.gel ?? TORCH.tank)} of ${TORCH.tank} seconds of fire. It refills with Fuel at storage or a Fuel Station.`;
}

/** Whose a building or robot is, on its panel: Yours, or a colony's name (in Observer mode, with its doctrine). */
function ownerLabel(p) {
  if (p === ME && !S.watch) return 'Yours';
  const n = playerName(p), P = S.players[p];
  return S.watch && n !== 'Murmur' && P && isDoctrine(P.style) ? `${n}, the ${PERSONALITIES[P.style].name}` : n;
}

/** A Cargo Plane parked at Airfield b with nothing to do, or null. */
function freePlane(b) { return basePlanes(b).find((u) => !BOTS[u.type].bomber && u.inside === b.id && !u.mission && !u.flight) || null; }

/** Is bomber u's strike still on the ground (rearming, loading, waiting for Ammo or Fuel), so it can be called off? */
function strikeWaiting(u) { return !!(u && BOTS[u.type].bomber && u.owner === ME && u.mission && u.mission.kind === 'strike' && u.mission.phase === 'load' && !u.flight); }

/** Call off bomber `id`'s strike (its Cancel strike button). */
function callOffStrike(id) {
  act('strikeCancel', [id], (why) => {
    if (why) { sfx('error'); toast(why, 'warn'); return; }
    sfx('click'); toast('Strike called off: the bomber stays on the ground, and any Ammo it loaded is back in its Airfield.', 'info');
    const el = $('sh-air-bombers'); if (el) el.dataset.sig = '';
  });
}

/** What a plane is doing, in a few words. */
function planeStatus(u) {
  if (BOTS[u.type].bomber) {
    const M = u.mission, nap = !!(M && M.napalm), tg = M && !nap && getE(M.target), what = tg ? (BDEFS[tg.type] ? `the ${BDEFS[tg.type].name}` : `a ${BOTS[tg.type].name}`) : 'its target';
    const job = nap ? 'to drop napalm' : `to bomb ${what}`;
    if (u.flight) return M && M.phase === 'out' ? `flying out ${job}` : 'flying home';
    if (M && M.phase === 'load') return u.rearmUntil > S.time ? `rearming (${Math.ceil(u.rearmUntil - S.time)} s), then off ${job}` : M.noAmmo ? `waiting for ${BOMBER.ammo} Ammo at its Airfield` : M.noFuel ? `waiting for ${M.noFuel} Fuel at its Airfield (a ${nap ? 'napalm ' : ''}sortie takes ${BOMBER.fuel + (nap ? NAPALM.fuel : 0)} on top of its tank)` : nap ? 'loading napalm' : `loading its bomb for ${what}`;
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
    (bomb ? ` A bomber sortie takes ${BOMBER.fuel} Fuel on top of its tank (${BOMBER.fuel + NAPALM.fuel} with napalm), and it can't take off without it.` : '');
}

/** The Airfield panel's sections: its Fuel, its planes, air drops, and the places it supplies by air. */
function airfieldSection(b) {
  const planes = basePlanes(b), f = freePlane(b);
  let html = '<div class="section-label">Fuel</div><div class="bar battery" id="sh-air-fbar"><div></div></div><p class="hint" id="sh-air-fuel"></p>';
  html += '<div class="section-label">Cargo Plane</div><p class="hint" id="sh-air-planes"></p><div id="sh-air-pgauge"></div>';
  if (warOn()) html += '<div class="section-label">Vulcan Bombers</div><div id="sh-air-bombers"></div>';
  html += '<div class="section-label">Air drop <span class="label-note">by parachute</span></div>';
  if (f) {
    html += `<div class="air-drops" id="sh-air">
      <button class="btn primary" data-k="outpost">Drop Outpost ${costInline(BDEFS.dropost.cost)}</button>
      ${warOn() ? '<button class="btn" data-k="warbot">Drop 2 Warbots</button>' : ''}<button class="btn" data-k="worker">Drop 2 Workers</button></div>
      <p class="hint">Then tap the spot. A Drop Outpost lands on any open ground nobody else holds (paid from storage now): it claims a little land, holds 2 warbots, stores goods, charges 2 bots and is supplied by air until a road from home reaches it. Robots board here first (Warbots from your garrisons, idle Workers) and can be dropped anywhere, the enemy's land too. A full tank reaches ${planeReach(f)} tiles out and back.</p>`;
  } else html += `<p class="hint">${planes.some((u) => !BOTS[u.type].bomber) ? 'Its Cargo Plane is out on a flight.' : 'No Cargo Plane is based here yet: order one in the hangar below.'}</p>`;
  html += '<div class="section-label">Supplied by air</div><p class="hint" id="sh-air-places"></p>';
  // Airships built here wait in the hangar (in no spot of it) until there's a line for them.
  const waiting = S.bots.filter((u) => !u.dead && u.owner === b.owner && BOTS[u.type].airship && u.inside === b.id);
  if (waiting.length) html += `<div class="section-label">Airships</div><p class="hint">${waiting.length === 1 ? 'An Airship waits' : `${waiting.length} Airships wait`} here for a line: link two Mooring Masts (a Mast's panel: <b>Link to another Mast</b>), and with just one line ${waiting.length === 1 ? 'it goes' : 'they go'} there by ${waiting.length === 1 ? 'itself' : 'themselves'}; or pick a line on its panel.</p>` +
    `<div class="actions">${waiting.map((u) => `<button class="btn small" data-bot="${u.id}" id="sh-air-ship-${u.id}">Airship ›</button>`).join('')}</div>`;
  return html;
}

function airPlacesText(b) {
  const list = S.buildings.filter((c) => !c.dead && c.built && c.owner === b.owner && c.airSupply && airSuppliable(c) && airBaseNear(c.owner, c.x, c.y) === b);
  const keep = airKeep(b), short = Object.keys(keep).filter((g) => keep[g] > 0).map((g) => `${keep[g]} ${GOOD[g].name}`);
  return (list.length ? `From here: ${list.map((c) => `the ${BDEFS[c.type].short || BDEFS[c.type].name} ${dirText(b, c)}`).join(', ')}. ` : 'Nothing yet: switch on Supply by air in a Depot\'s or Outpost\'s panel (a Drop Outpost has it on). ') +
    `A plane flies them what they're short of (their supply orders, Ammo for their warbots, a site's materials), ${BOTS.cargoplane.carry} goods a flight, taking them in turn (one that has run out of something first).` + (short.length ? ` This Airfield keeps ${short.join(', ')} for its planes and those places: haulers bring it.` : '');
}


/* ------------------------------------------------------------------ Maglev lines */

/** "the Terminal 14 tiles east of the Command Base" (or "the Terminal" with no Command Base). */
function magWhere(m) {
  const L = getE(S.players[m.owner] && S.players[m.owner].lander);
  return L && !L.dead ? `the Terminal ${dirText(L, m)} of the Command Base` : 'the Terminal';
}

/** What Maglev Pod u is doing, in a few words. */
function podStatus(u) {
  const here = u.inside ? getE(u.inside) : null, goods = u.cargo ? sumValues(u.cargo) : 0;
  if (u.magTo) { const to = getE(u.magTo); return `${u.crawl ? 'crawling (no power)' : 'running'} to ${to && !to.dead ? magWhere(to) : 'a Terminal'}${goods ? ` with ${goods} goods` : ', empty'}`; }
  if (here && BDEFS[here.type].magterm) {
    const ps = magPartners(here);
    if (!ps.length) return `docked at ${magWhere(here)}, waiting for a line`;
    if (ps.every((o) => magPairCut(here, o))) return `docked at ${magWhere(here)}: the line is cut`;
    return `docked at ${magWhere(here)}, loading when there's a trip worth making`;
  }
  return 'off its guideway';
}

/** The Maglev Terminal panel's section (filled in by renderMagSection), with the Auto supply switch. */
function magSection() {
  return `<div class="section-label">Maglev line</div><div id="sh-mag"></div>
    <div class="seg" id="sh-auto"><button data-v="1">Auto supply</button><button data-v="0">Off</button></div>
    <p class="hint">Auto supply: the far Terminals (further from your Command Base) stock what the buildings round them need, each Terminal nearer home keeps what the ones beyond it want, ready for the next pod, and the far Terminals' spare goods come home: ${BOTS.magpod.carry} goods a pod, several kinds at once, line by line through a hub. Buildings touching a Terminal are joined to it by conveyor; Haulers bring the rest. Supply orders you set below come on top.</p>`;
}

/** Terminal b's lines: their other ends, power and cuts, its network's pods, a lost end to rebuild, a line going up (rebuilt only when something changes). */
function renderMagSection(b) {
  const el = $('sh-mag');
  if (!el) return;
  const ps = magPartners(b), net = ps.length ? magNet(b) : [b], site = magPending(b), miss = magMiss(b);
  const pods = ps.length ? linePods(b) : S.bots.filter((u) => !u.dead && u.owner === b.owner && BOTS[u.type].magpod && u.home === b.id);
  const lines = ps.map((o) => { const K = magKey(b, o); return { o, cut: magPairCut(b, o), powered: magPairPowered(b, o), fix: K.magFix }; });
  const sig = JSON.stringify([lines.map((l) => [l.o.id, l.cut, l.powered, l.fix && l.fix.u, l.fix && l.fix.paid, magPowered(l.o), (() => { const es = magEditSiteOf(b, l.o); return es ? Math.round(es.progress * 100) : -1; })()]), net.length, b.home, pods.map((u) => [u.id, podStatus(u)]), site && Math.round(site.progress * 100), !!b.magFrom, miss, b.magRelay, magPowered(b), flareOn(), b.auto, b.autoOff, sumValues(b.inc), magSlots(b), b.magThrough || 0]);
  if (el.dataset.sig === sig) return;
  el.dataset.sig = sig;
  let h = '';
  const others = net.length > ps.length + 1 ? `, in a network of ${net.length} Terminals` : '';
  if (ps.length) {
    if (ps.length === 1) h += `<div class="status">On a line to ${magWhere(ps[0])} (${dirText(b, ps[0])} from here, ${Math.round(dist(b.x, b.y, ps[0].x, ps[0].y))} tiles)${others}.</div>`;
    else h += `<div class="status">A hub: ${ps.length} lines meet here${others}.</div>`;
    for (const l of lines) {
      const state = l.cut ? '<span class="err">Cut: a pylon is down</span>' : l.powered ? 'Powered: pods run at speed' : '<span class="err">Unpowered: pods crawl</span>';
      h += `<div class="kv"><span>${ps.length === 1 ? 'Line' : `Line ${dirText(b, l.o)}`}</span><span>${state}</span></div>`;
      const es = magEditSiteOf(b, l.o);
      h += es ? `<div class="kv"><span>New bends going up</span><span>${Math.round(es.progress * 100)}%${es.progress >= 0.9 ? ' (pods held at the Terminals)' : ''}</span></div>`
        : `<div class="kv"><span></span><span><button class="btn small" data-edit="${l.o.id}">Edit bends</button></span></div>`;
    }
    const cut = lines.find((l) => l.cut);
    if (cut) h += `<p class="hint">${cut.fix && cut.fix.u ? 'A Worker is riding out to rebuild the pylon.' : cut.fix && !cut.fix.paid ? `Waiting for ${costText(magLineCost(MAGLEV.spacing))} in storage to rebuild the pylon; then a Worker rides out from the nearer Terminal.` : 'A Worker from the nearer Terminal rides out to rebuild it.'} The pods keep off that line until then.</p>`;
    else if (lines.some((l) => !l.powered)) { const o = lines.find((l) => !l.powered).o; h += `<p class="hint">${flareOn() ? 'A solar flare: the line crawls until it passes.' : `${!magPowered(b) ? 'This end' : `The Terminal ${dirText(b, o)}`} has no Generator with Fuel within ${BDEFS.generator.burner.radius} tiles (or Thermal Plant within ${THERMAL.radius}): build one, and keep a Generator fuelled. Both ends of a line need power.`}</p>`; }
    const bent = ps.map((o) => { const K = magKey(b, o); return (K.magBends || []).length; }).reduce((a, n) => a + n, 0);
    if (bent) h += `<div class="kv"><span>Bends</span><span>${bent} (pods slow round the sharp ones)</span></div>`;
    if (ps.length > 1) h += `<div class="kv"><span>Pods through without stopping</span><span>${b.magThrough || 0}</span></div>`;
    h += `<p class="hint">${ps.length > 1 ? 'Pods carry goods on through this hub without stopping: what the Terminals beyond it want stays aboard, the rest is unloaded here, and they top up as they pass.' : farStation(b) ? 'This is the far Terminal: it stocks what the buildings round it need, and sends their spare goods home.' : 'This is the home Terminal (nearer your Command Base): it keeps what the far Terminal wants, ready to load.'} The line draws power from the Generators in reach of each Terminal.</p>`;
    h += pods.length ? `<div class="kv"><span>${net.length > 2 ? 'Pods on the network' : 'Pods on the line'}</span><span>${pods.length} of ${magPodCap(b)}</span></div>` + pods.map((u) => `<div class="kv army-row"><span>${podStatus(u)}</span><span><button class="btn small ghost" data-pod="${u.id}">Pod ›</button></span></div>`).join('')
      : '<p class="hint"><b>No pods yet:</b> order them in the pod bay below (4 Alloy, 2 Chips each).</p>';
  }
  miss.forEach((m, k) => {
    const check = magLineCheck(ME, b, m.x, m.y);
    h += `<div class="status err">Service suspended: the Terminal ${dirText(b, m)} is down.</div><p class="hint">Its guideway and pylons still stand, the line broken until a Terminal goes up on that tile again: on its old foundation it costs half (${costText(magRebuildCost())}), and the guideway is free. The pods wait at this end.</p>`;
    if (site && site.x === m.x && site.y === m.y) h += `<p class="hint">Replacement Terminal: ${Math.round(site.progress * 100)}% complete.</p>`;
    else if (check.why) h += `<p class="hint">${check.why}</p>`;
    else h += `<button class="btn primary" id="sh-magrebuild${k ? k : ''}" data-miss="${k}">Rebuild the missing Terminal (${costText(magRebuildCost())})</button>`;
  });
  if (site && !magRebuildSite(b, site)) {
    h += `<div class="status">A line is going up from here: ${Math.round(site.progress * 100)}%.</div><p class="hint">A Worker standing here builds it out, pylon by pylon; the far Terminal goes up last. It is paid from storage as the goods come in (${costText(stillOwed(site))} still owed).${site.magNext ? ' Once that Terminal is up, the line goes on from it (a hub) to the far end.' : ''}</p>`;
  } else if (b.magFrom) {
    h += '<div class="status">A line is coming to it from another Terminal.</div>';
  } else if (!ps.length && !miss.length && !site) {
    h += `<div class="status">Not on a line.</div><p class="hint">Plan one in Paths (<b>Maglev</b>, <kbd>Shift</kbd>+<kbd>M</kbd>): tap this Terminal, then the far end ${MAGLEV.min} to ${MAGLEV.max} tiles away in any direction, straight across water, cliffs and chasms. ${costText(magLineCost(1))} a tile, paid from storage.</p><button class="btn primary" id="sh-magline">Plan a line from here</button>`;
  } else if (!site && magSlots(b) < MAGLEV.hub) {
    h += `<p class="hint">A Terminal joins up to ${MAGLEV.hub} lines: add one from here and it's a <b>hub</b>, the pods carrying goods on through it.</p><button class="btn" id="sh-magline">Add a line from here (hub)</button>`;
  }
  const relay = getE(b.magRelay);
  if (relay) h += `<p class="hint">This Terminal exchanges freight by conveyor with the Terminal ${dirText(b, relay)}.</p>`;
  const served = S.buildings.filter((c) => !c.dead && c.railBy === b.id).length;
  if (served) h += `<p class="hint">It serves ${served} building${served > 1 ? 's' : ''} round it.</p>`;
  const auto = b.auto && !b.autoOff ? Object.entries(b.auto).map(([g, n]) => goodTag(g, `${Math.min(b.stock[g] || 0, n)}/${n} ${GOOD[g].name}`, (b.stock[g] || 0) < n / 3)).join(' ') : '';
  if (auto) h += `<div class="goodlist">${auto}</div>`;
  const coming = Object.keys(b.inc).filter((g) => b.inc[g] > 0 && S.bots.some((u) => !u.dead && u.cargoTo === b.id && u.cargo && u.cargo[g] && BOTS[u.type].magpod));
  if (coming.length) h += `<p class="hint">On their way by pod: ${coming.map((g) => `${b.inc[g]} ${GOOD[g].name}`).join(', ')}.</p>`;
  el.innerHTML = h;
  for (const btn of el.querySelectorAll('button[data-miss]')) btn.onclick = () => {
    const m = magMiss(b)[+btn.dataset.miss];
    if (!m) return;
    const { x, y } = m;
    sfx('click');
    act('magLine', [b.id, x, y], (result) => {
      if (!result?.ok) { toast(result?.reason || 'The Terminal could not be rebuilt.', 'warn'); return; }
      centerOn(x + 0.5, y + 0.5);
      openBuildingSheet(getE(result.id) || b);
    });
  };
  if ($('sh-magline')) $('sh-magline').onclick = () => { sfx('click'); openMaglevFrom(b); };
  for (const btn of el.querySelectorAll('button[data-edit]')) btn.onclick = () => { const o = getE(+btn.dataset.edit); if (o && !o.dead) { sfx('click'); openMagEdit(b, o); } };
  for (const btn of el.querySelectorAll('button[data-pod]')) btn.onclick = () => { const u = getE(+btn.dataset.pod); if (u && !u.dead) { sfx('click'); openBotSheet(u); } };
}

/** The Maglev tool with Terminal b picked as the near end: tap the far end next. */
function openMaglevFrom(b) {
  closeSheet();
  enterPlaceMode('maglev');
  UI.ropeA = { i: b.x, j: b.y, id: b.id }; UI.ropeBends = []; UI.magEdit = null;
  R.overlay = null;
  showBanner(maglevFarText(b), null, 'Cancel');
}

function maglevFarText(b) {
  if (b.magMissing && magSlots(b) >= MAGLEV.hub) return 'Tap the original end of the guideway to reconnect the line. You only pay for a replacement Terminal.';
  return `Now tap the <b>far end</b>: ${MAGLEV.min} to ${MAGLEV.max} tiles away in any direction, a clear spot (the far Terminal goes up there) or another Maglev Terminal of yours${magPartners(b).length ? ' (this one becomes a hub)' : ''}; or tap a spot on the way and <b>Bend here</b> (up to ${MAGLEV.bends} bends).${b.magMissing ? ' Tap the lost Terminal\'s tile to rebuild it instead.' : ''} The preview rings each pylon spot: <span style="color:${MAG_SPOT.ok}">a pylon</span>, <span style="color:${MAG_SPOT.road}">over a road (it stays open)</span>, <span style="color:${MAG_SPOT.moved}">shifted a tile</span>, <span style="color:${MAG_SPOT.bad}">blocked</span>. ${costText(magLineCost(1))} a tile, from storage.`;
}

/**
 * The preview of a line from the near Terminal picked to (i, j): R.ropeEnd (drawMaglevs draws it); `via`: a route
 * through a hub there; `bends`: the tiles it bends at (the bends placed so far, UI.ropeBends, by default).
 */
function maglevPreview(i, j, tapped, via, bends) {
  const A = getE(UI.ropeA && UI.ropeA.id);
  if (!A || !inMap(i, j)) { R.ropeEnd = null; return null; }
  if (via) {
    const one = magLineCheck(ME, A, via.i, via.j), two = magLineCheck(ME, magGhost(ME, via.i, via.j, one.key === -1), i, j);
    R.ropeEnd = { i, j, ok: true, why: '', spots: [...one.spots, ...two.spots], far: two.far ? two.far.id : 0, tapped: !!tapped, via, bends: [], L: one.L + two.L };
    return R.ropeEnd;
  }
  bends = bends || UI.ropeBends || [];
  const chk = magLineCheck(ME, A, i, j, bends);
  R.ropeEnd = { i, j, ok: !chk.why, why: chk.why, spots: chk.spots, far: chk.far ? chk.far.id : 0, tapped: !!tapped, rebuild: !!chk.miss, bends: chk.miss ? [] : bends, L: chk.L };
  return R.ropeEnd;
}

/** The bend buttons for the Maglev banner: Bend here (at tile (i, j), when a bend can go there) and Undo bend. */
function maglevBendButtons(A, i, j) {
  const why = magBendTry(ME, A, UI.ropeBends || [], i, j), n = (UI.ropeBends || []).length;
  return ` <span class="mag-bends">${!why ? '<button class="btn small" id="mag-bend">Bend here</button>' : ''}${n ? ` <button class="btn small ghost" id="mag-unbend">Undo bend (${n})</button>` : ''}</span>`;
}
function maglevBendWire(A, i, j) {
  if ($('mag-bend')) $('mag-bend').onclick = () => {
    sfx('click');
    (UI.ropeBends = UI.ropeBends || []).push([i, j]);
    R.ropeEnd = null;
    showBanner(`Bend ${UI.ropeBends.length} at that pylon: now tap the next bend or the <b>far end</b>. Each stretch runs ${MAGLEV.seg} to ${MAGLEV.max} tiles, ${MAGLEV.maxBent} in all, turning ${MAGLEV.turn}° at most.${maglevBendButtons(A, -1, -1)}`, null, 'Cancel');
    maglevBendWire(A, -1, -1);
  };
  if ($('mag-unbend')) $('mag-unbend').onclick = () => {
    sfx('click');
    (UI.ropeBends || []).pop();
    R.ropeEnd = null;
    showBanner(`${UI.ropeBends.length ? `${UI.ropeBends.length} bend${UI.ropeBends.length > 1 ? 's' : ''} so far: tap` : 'Tap'} the next bend or the <b>far end</b>.${maglevBendButtons(A, -1, -1)}`, null, 'Cancel');
    maglevBendWire(A, -1, -1);
  };
}

/**
 * Placing a Maglev line: the first tap picks the near Terminal, the second the far end (tap it again to build), or a
 * bend on the way (Bend here; Undo bend). A far end that can't be had snaps to a good tile beside it; a line that can't
 * go straight there (a blocked stretch, or too far) is offered with a bend or two round it, or else via a hub Terminal.
 */
function maglevTap(i, j) {
  if (!UI.ropeA) {
    const b = inMap(i, j) && S.bAt[tIdx(i, j)] ? getE(S.bAt[tIdx(i, j)]) : null;
    const why = !b || b.owner !== ME || !BDEFS[b.type].magterm ? 'Tap one of your Maglev Terminals (highlighted) for the near end.' : !b.built ? 'That Terminal is still going up: the line starts from a finished one.'
      : magPending(b) ? 'That Terminal\'s line is still going up.' : b.magFrom ? 'A line is coming to that Terminal already.' : magSlots(b) >= MAGLEV.hub && !b.magMissing ? `That Terminal is on ${MAGLEV.hub} lines already: a hub joins ${MAGLEV.hub} at most.` : '';
    if (why) { sfx('error'); showBanner(`<span class="err">${why}</span>`, null, 'Cancel'); return; }
    UI.ropeA = { i, j, id: b.id }; UI.ropeBends = []; UI.magEdit = null;
    R.overlay = null; R.ghost = null;
    sfx('click');
    showBanner(maglevFarText(b), null, 'Cancel');
    return;
  }
  const A = getE(UI.ropeA.id);
  if (!A || A.dead) { setMode('normal'); return; }
  if (UI.magEdit) { maglevEditTap(A, i, j); return; }
  UI.ropeBends = UI.ropeBends || [];
  if (R.ropeEnd && R.ropeEnd.tapped && R.ropeEnd.ok && ((R.ropeEnd.i === i && R.ropeEnd.j === j) || (R.ropeEnd.via && R.ropeEnd.via.i === i && R.ropeEnd.via.j === j) || (R.ropeEnd.snapFrom === tIdx(i, j)))) { confirmBanner(); return; }
  let E = maglevPreview(i, j, true), note = '';
  const tapped = inMap(i, j) && S.bAt[tIdx(i, j)] ? getE(S.bAt[tIdx(i, j)]) : null, bendBtns = maglevBendButtons(A, i, j);
  if (E && !E.ok && !E.rebuild && !(E.spots && E.spots.length) && !(tapped && BDEFS[tapped.type].magterm) && !/Too far|Too close|bend/i.test(E.why)) {
    // the far end itself is bad (a road, a building, rough ground): snap to the nearest good tile beside it
    const near = FEED_NB.map(([di, dj]) => [i + di, j + dj]).filter(([x, y]) => inMap(x, y)).sort(([a, b], [c, d]) => dist2(a, b, A.x, A.y) - dist2(c, d, A.x, A.y))
      .find(([x, y]) => !magLineCheck(ME, A, x, y, UI.ropeBends).why);
    if (near) { const why = E.why; E = maglevPreview(near[0], near[1], true); E.snapFrom = tIdx(i, j); note = `<span class="hint">${why} The far end moved a tile, to a spot that works.</span> `; }
  }
  if (E && !E.ok && !E.rebuild && !UI.ropeBends.length) {
    // no straight line there: offer one with a bend or two round what's in the way, else a route via a hub
    const why = E.why, bends = magRouteBend(ME, A, E.i, E.j);
    if (bends) {
      E = maglevPreview(E.i, E.j, true, null, bends);
      const n = Math.round(E.L), far = E.far ? getE(E.far) : null, cost = magLineCost(n);
      if (!far) for (const g in BDEFS.magterm.cost) cost[g] = (cost[g] || 0) + BDEFS.magterm.cost[g];
      sfx('click');
      showBanner(`<span class="err">${why}</span> <b>Route with ${bends.length === 1 ? 'a bend' : `${bends.length} bends`}</b>: a line ${n} tiles long round it, bending at ${bends.length === 1 ? 'a pylon' : `${bends.length} pylons`} (no Terminal on the way)? ${costInline(cost, playerGoods(ME))}${bendBtns}`, 'Build', 'Cancel');
      maglevBendWire(A, i, j);
      return;
    }
    const via = magRouteVia(ME, A, E.i, E.j);
    if (via) {
      E = maglevPreview(E.i, E.j, true, via);
      const n = via.n1 + via.n2, cost = magLineCost(via.n1);
      const c2 = magLineCost(via.n2);
      for (const g in c2) cost[g] = (cost[g] || 0) + c2[g];
      for (const g in BDEFS.magterm.cost) cost[g] = (cost[g] || 0) + BDEFS.magterm.cost[g] * (E.far ? 1 : 2);
      sfx('click');
      showBanner(`<span class="err">${why}</span> <b>Route via a hub</b>: two lines, ${via.n1} and ${via.n2} tiles (${n} in all), through a new hub Terminal on the way? ${costInline(cost, playerGoods(ME))} (the second line is planned once the hub is up)${bendBtns}`, 'Build', 'Cancel');
      maglevBendWire(A, i, j);
      return;
    }
  }
  if (!E || !E.ok) { sfx('error'); showBanner(`<span class="err">${E ? E.why : 'Outside the map.'}</span> Tap another far end${UI.ropeBends.length ? ', or undo a bend' : ''}.${bendBtns}`, null, 'Cancel'); maglevBendWire(A, i, j); return; }
  const fi = E.i, fj = E.j, n = Math.round(E.L || dist(A.x, A.y, fi, fj)), far = E.far ? getE(E.far) : null, cost = E.rebuild ? magRebuildCost() : magLineCost(n);
  if (!far && !E.rebuild) for (const g in BDEFS.magterm.cost) cost[g] = (cost[g] || 0) + BDEFS.magterm.cost[g];
  if (E.rebuild) {
    showBanner(far?.built ? 'Reconnect the surviving guideway to this Terminal?' : `Rebuild the missing Terminal? ${far ? 'Continue its construction.' : `${costInline(cost, playerGoods(ME))} (half a Terminal's cost, on its old foundation: the guideway stands)`}`, far?.built ? 'Reconnect' : 'Build', 'Cancel');
    return;
  }
  const pyl = E.spots.filter((s) => s.kind === 'ok').length, gaps = E.spots.filter((s) => s.kind === 'skip').length, roads = E.spots.filter((s) => s.kind === 'ok' && s.road).length, moved = E.spots.filter((s) => s.kind === 'ok' && s.moved != null).length;
  const nb = E.bends.length, extra = [nb ? `bending ${nb === 1 ? 'once' : `${nb} times`}` : '', gaps ? `${gaps} gap${gaps > 1 ? 's' : ''} spanned` : '', roads ? `${roads} over a road or track` : '', moved ? `${moved} shifted a tile` : ''].filter(Boolean).join(', ');
  showBanner(`${note}A <b>Maglev line</b> ${n} tiles long, ${pyl} pylon${pyl === 1 ? '' : 's'}${extra ? ` (${extra})` : ''}${far ? far.built ? ', to your Terminal there' : ', to your Terminal site there' : ', the far Terminal included'}${magPartners(A).length || (far && magPartners(far).length) ? ': a hub, pods carry on through it' : ''}? ${costInline(cost, playerGoods(ME))} (${canPay(ME, cost) ? 'paid now' : 'paid from storage as the goods come in'})${bendBtns}`, 'Build', 'Cancel');
  maglevBendWire(A, i, j);
}

/*
 * Edit bends (a Terminal's panel, for one of its lines): the Maglev tool on that line, its bends in order from the
 * Terminal (UI.ropeBends), UI.magEdit { to: the other Terminal, sel: the bend picked to move, or -1 }. Tap a bend to
 * pick it, then tap where it goes (or Remove bend); tap a spot near the line to add a bend there; Straighten takes them
 * all away. The preview and the banner check it as placing a line does (magEditCheck); Build sends the magRebend order.
 */
function openMagEdit(b, o) {
  closeSheet();
  enterPlaceMode('maglev');
  const K = magKey(b, o), kb = (K.magBends || []).map((q) => q.slice());
  UI.ropeA = { i: b.x, j: b.y, id: b.id };
  UI.ropeBends = K === b ? kb : kb.reverse();
  UI.magEdit = { to: o.id, sel: -1 };
  R.overlay = null;
  maglevEditShow();
}

/** The edit's preview (R.ropeEnd, to the other Terminal) and its banner, with `note` first. */
function maglevEditShow(note) {
  const A = getE(UI.ropeA && UI.ropeA.id), O = getE(UI.magEdit && UI.magEdit.to);
  if (!A || !O || A.dead || O.dead) { setMode('normal'); return; }
  const bends = UI.ropeBends, chk = magEditCheck(ME, A, O, bends), sel = UI.magEdit.sel;
  R.ropeEnd = { i: O.x, j: O.y, ok: !chk.why, why: chk.why, spots: chk.spots, far: O.id, tapped: true, bends, L: chk.L, edit: chk };
  const n = bends.length;
  let h = note ? `${note} ` : '';
  const drag = UI.bendDrag && UI.bendDrag.k === sel && (UI.bendDrag.i !== UI.bendDrag.from[0] || UI.bendDrag.j !== UI.bendDrag.from[1]); // (a bend being dragged, off its tile)
  h += drag ? `<b>Bend ${sel + 1}</b>${chk.why ? ' can\'t go here: let go and it goes back.' : ': let go to put it here (Esc puts it back).'}` : sel >= 0 ? `<b>Bend ${sel + 1}</b> picked: tap where it goes, or remove it.` : `<b>Editing this line's bends</b> (${n} now): tap a bend to move it, or a spot near the line to add one (up to ${MAGLEV.bends}).`;
  if (chk.why) h += ` <span class="err">${chk.why}</span>`;
  else {
    const back = Object.keys(chk.refund).filter((g) => chk.refund[g] >= 1);
    h += ` A ${Math.round(chk.L)}-tile line, ${chk.fresh.length} new pylon${chk.fresh.length === 1 ? '' : 's'}${chk.added ? `, ${chk.added} tile${chk.added === 1 ? '' : 's'} longer` : chk.cut ? `, ${chk.cut} tile${chk.cut === 1 ? '' : 's'} shorter` : ''}: ${chk.fresh.length || chk.added ? costInline(chk.cost, playerGoods(ME)) : 'nothing to pay'}${back.length ? `; back as crates: ${costText(chk.refund)}` : ''}. A Worker builds it from the Terminal; the old guideway runs until it's done (the pods wait at the Terminals for the switch-over).`;
  }
  h += ` <span class="mag-bends">${sel >= 0 ? '<button class="btn small" id="mag-rmbend">Remove bend</button>' : ''}${n ? ' <button class="btn small ghost" id="mag-straight">Straighten</button>' : ''}</span>`;
  showBanner(h, chk.why ? null : 'Build', 'Cancel');
  if ($('mag-rmbend')) $('mag-rmbend').onclick = () => { sfx('click'); UI.ropeBends.splice(UI.magEdit.sel, 1); UI.magEdit.sel = -1; maglevEditShow(); };
  if ($('mag-straight')) $('mag-straight').onclick = () => { sfx('click'); UI.ropeBends = []; UI.magEdit.sel = -1; maglevEditShow(); };
}

/** A tap while editing bends: pick a bend, put the picked one down, or add one where the line runs nearest. */
function maglevEditTap(A, i, j) {
  const E = UI.magEdit, bends = UI.ropeBends, O = getE(E.to);
  if (!O) { setMode('normal'); return; }
  const at = bends.findIndex(([x, y]) => x === i && y === j);
  if (at >= 0) { sfx('click'); E.sel = E.sel === at ? -1 : at; maglevEditShow(); return; }
  if (E.sel >= 0) { sfx('click'); bends[E.sel] = [i, j]; E.sel = -1; maglevEditShow(); return; }
  if (bends.length >= MAGLEV.bends) { sfx('error'); maglevEditShow(`<span class="err">A line bends at ${MAGLEV.bends} pylons at most.</span>`); return; }
  // where the new bend goes in the list: on the stretch passing nearest the tap
  const pts = [[A.x, A.y], ...bends, [O.x, O.y]];
  let best = 0, bd = Infinity;
  for (let k = 1; k < pts.length; k++) {
    const [ax, ay] = pts[k - 1], [bx, by] = pts[k], L2 = dist2(ax, ay, bx, by) || 1e-9, f = clamp(((i - ax) * (bx - ax) + (j - ay) * (by - ay)) / L2, 0, 1);
    const d = dist2(ax + (bx - ax) * f, ay + (by - ay) * f, i, j);
    if (d < bd) { bd = d; best = k - 1; }
  }
  sfx('click');
  bends.splice(best, 0, [i, j]);
  maglevEditShow();
}

/*
 * With a mouse, a bend's diamond can be dragged (input.js onGrab, from mapGrab): the preview and the banner follow the
 * pointer tile by tile, checked as a tap is (magEditCheck, run only when the tile changes); let go on a tile where the
 * line can go and the bend is put down there as a second tap would; let go where it can't, or press Esc
 * (maglevDragCancel), and it goes back. A drag that ends on the tile it started on is a tap (it picks the bend). A
 * finger keeps tap-to-pick and tap-to-place: its drags move the map. UI.bendDrag { k, from: the bend's tile,
 * sel: what was picked before, i, j: the tile it's over }.
 */
const BEND_GRAB = 14; // px round a bend's diamond that take hold of it (at least the diamond itself)
/** The bend whose diamond is under screen point (x, y) while editing a line's bends, or -1. */
function magBendAt(x, y) {
  if (!(R.mode === 'place' && UI.placeType === 'maglev' && UI.magEdit && UI.ropeA && UI.ropeBends)) return -1;
  const z = R.cam.z, H = MAGLEV.head * z, reach = Math.max(BEND_GRAB, z * 0.36);
  let best = -1, bd = Infinity;
  UI.ropeBends.forEach(([i, j], k) => {
    const p = worldToScreen(i + 0.5, j + 0.5), d = Math.hypot(p.x - x, p.y - H - y);
    if (d <= reach && d < bd) { bd = d; best = k; }
  });
  return best;
}
function magBendGrab(x, y) {
  const k = magBendAt(x, y);
  if (k < 0) return null;
  const [i0, j0] = UI.ropeBends[k], p = worldToScreen(i0 + 0.5, j0 + 0.5), dx = p.x - x, dy = p.y - y; // (keeps the pointer's offset from the bend's tile: the diamond floats at deck height)
  const D = UI.bendDrag = { k, from: [i0, j0], sel: UI.magEdit.sel, i: i0, j: j0 };
  const live = () => UI.bendDrag === D && UI.magEdit && UI.ropeBends && UI.ropeBends.length > k;
  const tileAt = (mx, my) => { const w = screenToWorld(mx + dx, my + dy); return [Math.floor(w.x), Math.floor(w.y)]; };
  const f = (mx, my) => {
    if (!live()) return;
    const [i, j] = tileAt(mx, my);
    if ((i === D.i && j === D.j) || !inMap(i, j)) return; // (the check runs only as the pointer reaches a new tile)
    D.i = i; D.j = j;
    UI.ropeBends[k] = [i, j]; UI.magEdit.sel = k;
    maglevEditShow();
  };
  f.tap = () => { if (!live()) return; UI.bendDrag = null; maglevEditTap(getE(UI.ropeA.id), i0, j0); };
  f.end = (mx, my) => {
    if (!live()) return;
    UI.bendDrag = null;
    const [i, j] = tileAt(mx, my);
    UI.ropeBends[k] = [i0, j0]; UI.magEdit.sel = D.sel;
    if (i === i0 && j === j0) { maglevEditTap(getE(UI.ropeA.id), i0, j0); return; } // (a drag that never left the tile: a tap)
    const A = getE(UI.ropeA.id), O = getE(UI.magEdit.to), b2 = UI.ropeBends.map((q, n) => (n === k ? [i, j] : q));
    const why = !inMap(i, j) ? 'Outside the map.' : A && O ? magEditCheck(ME, A, O, b2).why : 'That line is gone.';
    if (why) { sfx('error'); maglevEditShow(`<span class="err">${why}</span> The bend went back.`); return; }
    sfx('click'); UI.ropeBends[k] = [i, j]; UI.magEdit.sel = -1; maglevEditShow();
  };
  f.cancel = () => maglevDragCancel();
  return f;
}
/** A bend drag called off (Esc, a second finger, the pointer lost): the bend back where it was. True if one was. */
function maglevDragCancel() {
  const D = UI.bendDrag;
  if (!D) return false;
  UI.bendDrag = null;
  if (UI.magEdit && UI.ropeBends && UI.ropeBends.length > D.k) { UI.ropeBends[D.k] = D.from; UI.magEdit.sel = D.sel; maglevEditShow('The bend went back.'); }
  return true;
}

/* ------------------------------------------------------------------ Mooring Masts and Airships */

/** "the Mast 14 tiles east of the Command Base" (or "the Mast" with no Command Base). */
function mastWhere(m) {
  const L = getE(S.players[m.owner] && S.players[m.owner].lander);
  return L && !L.dead ? `the Mast ${dirText(L, m)} of the Command Base` : 'the Mast';
}

/** What Airship u is doing, in a few words (its panel, the Mast's, the Army panel's Air tab). */
function shipStatus(u) {
  const here = u.inside ? getE(u.inside) : null, line = shipLine(u);
  const goods = u.cargo ? sumValues(u.cargo) : 0, riders = ferryAboard(u).length;
  const load = [goods ? `${goods} goods` : '', riders ? `${riders} rider${riders === 1 ? '' : 's'}` : ''].filter(Boolean).join(' and ');
  if (u.flight) {
    const to = getE(u.flight.to);
    return `flying to ${to && !to.dead ? (BDEFS[to.type].mast ? mastWhere(to) : 'the Airfield') : 'a Mast'}` + (load ? ` with ${load}` : line ? ', empty' : '');
  }
  if (here && BDEFS[here.type].airfield) return 'in the Airfield\'s hangar, waiting for a line: link two Mooring Masts';
  if (here && BDEFS[here.type].mast) {
    if (!line) return `moored at ${mastWhere(here)}, waiting for a line`;
    if (line[0] !== here && line[1] !== here) return `moored at ${mastWhere(here)}, off to its line`;
    if (u.noFuel) return `moored at ${mastWhere(here)}, waiting for ${u.noFuel} more Fuel to cross`;
    if (riders) return `moored at ${mastWhere(here)}, boarding riders (${riders} of ${BOTS[u.type].seats})`;
    return `moored at ${mastWhere(here)}, loading when there's a trip worth making`;
  }
  return 'waiting for a Mooring Mast';
}

/** An Airship's panel rows: its load (goods and riders), its line, its Fuel. */
function airshipRows(u) {
  const riders = ferryAboard(u), kinds = {};
  for (const v of riders) kinds[v.type] = (kinds[v.type] || 0) + 1;
  const line = shipLine(u), legs = line ? Math.ceil(shipLegFuel(line[0], line[1]) / planeFill(u)) : 0;
  return `<div class="kv"><span>Riders</span><span>${riders.length ? Object.keys(kinds).map((k) => `${kinds[k]} ${kinds[k] === 1 ? BOTS[k].name : BOTS[k].plural}`).join(', ') : 'none'} (${BOTS[u.type].seats} seats)</span></div>` +
    `<div class="kv"><span>Hold</span><span>${u.cargo ? sumValues(u.cargo) : 0} of ${BOTS[u.type].carry} goods${u.cargo && u.cargo !== null && getE(u.cargoTo) ? `, for ${mastWhere(getE(u.cargoTo))}` : ''}</span></div>` +
    `<div class="kv"><span>Fuel</span><span>fills up at either Mast of its line, one Fuel ${planeFill(u)}% of the tank${legs ? `; a crossing of its line takes about ${legs}` : ''}</span></div>`;
}

/** An Airship's panel: which line it serves (buttons for each of your lines), or none. */
function renderShipLine(u) {
  const el = $('sh-sline');
  if (!el) return;
  const lines = mastLines(ME), cur = shipLine(u);
  const sig = JSON.stringify([lines.map(([a, b]) => [a.id, b.id, lineShips(a).length]), cur && cur[0].id]);
  if (el.dataset.sig === sig) return;
  el.dataset.sig = sig;
  el.innerHTML = (lines.length ? lines.map((ln) => {
    const on = !!cur && (cur[0] === ln[0] || cur[0] === ln[1]), n = lineShips(ln[0]).length;
    const L = getE(S.players[ME].lander), at = L && !L.dead ? `Masts ${dirText(L, ln[0])} and ${dirText(L, ln[1])} of the Command Base` : 'two Masts';
    return `<button class="btn${on ? ' primary' : ''}" data-m="${ln[0].id}"${!on && n >= AIRSHIP.perLine ? ' disabled' : ''}>${on ? 'On the line' : 'Serve the line'}: ${at} (${n} of ${AIRSHIP.perLine})</button>`;
  }).join('') : '<p class="hint">No Airship line yet: build two Mooring Masts and link them (a Mast\'s panel: Link).</p>') +
    (cur ? '<button class="btn ghost" data-m="0">Off the line: wait at its Mast</button>' : '') +
    `<p class="hint">An Airship serves one line, ${AIRSHIP.perLine} to a line at most. With exactly one line, a new Airship goes to it by itself.</p>`;
  for (const btn of el.querySelectorAll('button[data-m]')) btn.onclick = () => act('shipLine', [u.id, +btn.dataset.m], (why) => {
    if (why) { sfx('error'); toast(why, 'warn'); } else sfx('order');
    el.dataset.sig = ''; refreshSheet();
  });
}

/** The Mass Driver's or Catcher's panel section (filled in by renderMdSection). */
function mdSection(b) {
  return `<div class="section-label">${BDEFS[b.type].mdriver ? 'Mass Driver' : 'Catcher'}</div><div id="sh-md"></div>`;
}

/** Where Catcher (or fort) c is, for a panel: from the Command Base. */
function mdWhere(c) {
  const L = getE(S.players[c.owner] && S.players[c.owner].lander);
  return L && !L.dead ? `the ${BDEFS[c.type].name} ${dirText(L, c)} of the Command Base` : `the ${BDEFS[c.type].name}`;
}

/** A Mass Driver's or Catcher's line: its other end (or ends), which end it is, its power, its supply (Auto or a goods list) and its counts (rebuilt only when something changes). */
function renderMdSection(b) {
  const el = $('sh-md');
  if (!el) return;
  const M = MASSDRIVER, def = BDEFS[b.type], drv = !!def.mdriver, pow = magPowered(b), list = b.mdSend || null;
  const T = drv && b.mdTo ? getE(b.mdTo) : null, live = T && !T.dead && T.owner === b.owner && (BDEFS[T.type].catcher || mdFortType(T.type)) ? T : null;
  const fort = !!(live && mdFortType(live.type)), ps = mdPartners(b), far = !!b.mdFar, manual = !!list || UI.mdList === b.id;
  const ships = mdSendGoods(b).map((g) => [g, list ? Math.floor(b.stock[g] || 0) : mdAutoN(b, g)]);
  const served = far ? S.buildings.filter((c) => !c.dead && c.owner === b.owner && !BDEFS[c.type].store && b.auto && needsOf(c).some(([g]) => b.auto[g]) && dist(c.x, c.y, b.x, b.y) <= STATION_REACH).length : 0;
  const rates = ps.map((o) => mdReload(b, o));
  const full = [...new Set(ps.flatMap((o) => mdFullGoods(b, o)))], kit = drv ? (b.mdKit ? 'load' : (S.cans || []).some((m) => m.kit && m.from === b.id) ? 'fly' : '') : '';
  const sig = JSON.stringify([b.mdTo, live && live.built, ps.map((o) => o.id), rates, pow, far, list, manual, ships, b.auto, served, b.mdSent || 0, b.mdGot || 0, full, kit, b.mdKit, b.mdKit ? Object.keys(BDEFS.catcher.cost).map((g) => Math.floor(b.stock[g] || 0)) : 0]);
  if (el.dataset.sig === sig) return;
  el.dataset.sig = sig;
  const gl = (o) => Object.keys(o).map((g) => `<span class="gtag"><i class="gi ${g}"></i>${o[g]} ${GOOD[g].name}</span>`).join(' ');
  let h = '';
  // The line: where the other end is.
  if (drv) {
    if (live) h += `<div class="status">Aimed at ${mdWhere(live)} (${dirText(b, live)} from here)${live.built ? '' : ': still going up'}.</div><div class="actions"><button class="btn" id="sh-mdaim">Aim elsewhere</button><button class="btn ghost" id="sh-mdoff">Stand down</button></div>`;
    else h += `<div class="status">${b.mdTo ? 'Its far end is gone.' : 'Not aimed yet.'}</div><p class="hint">Tap <b>Aim</b>, then one of your Catchers ${M.min} to ${M.max} tiles away (over anything: water, cliffs, rivals' ground), or an Outpost or Keep to keep its Ammo topped up.</p><button class="btn primary" id="sh-mdaim">Aim</button>`;
    // A Catcher kit: thrown to open ground with no foothold, it assembles itself into a Catcher there.
    if (kit === 'load') h += `<div class="kv"><span>Catcher kit</span><span>for the ground ${dirText(b, { x: b.mdKit[0], y: b.mdKit[1] })} from here: ${mdKitLoaded(b) ? 'loaded, it flies when the coils can fire' : `loading ${Object.keys(BDEFS.catcher.cost).map((g) => `${Math.min(BDEFS.catcher.cost[g], Math.floor(b.stock[g] || 0))}/${BDEFS.catcher.cost[g]} ${GOOD[g].name}`).join(', ')} (Haulers bring them)`}</span></div><button class="btn ghost" id="sh-mdkitoff">Call off the kit</button>`;
    else if (kit === 'fly') h += '<div class="kv"><span>Catcher kit</span><span>in flight</span></div>';
    else h += `<button class="btn" id="sh-mdkit">Throw a Catcher kit <small>${costText(BDEFS.catcher.cost)}</small></button><p class="hint">For an island or a mesa with no foothold: tap open ground ${M.min} to ${M.max} tiles away that no one else holds. Haulers bring the Catcher's cost to the Driver, loaded into the kit; it flies, lands, assembles itself into a Catcher in ${M.kitBuild} s (no Worker needed), claims the land ${M.kitClaim} tiles round it, and this Driver aims at it.</p>`;
  } else {
    h += ps.length ? ps.map((d) => `<div class="kv army-row"><span>Mass Driver ${dirText(b, d)} from here</span><span><button class="btn small ghost" data-md="${d.id}">Driver ›</button></span></div>`).join('')
      : `<p class="hint"><b>No Mass Driver is aimed here yet.</b> Build one ${M.min} to ${M.max} tiles away (Build → Move → Mass Driver), then on its panel: <b>Aim</b>, and tap this one.</p>`;
    h += `<div class="kv"><span>Drivers</span><span>${ps.length} of ${M.drivers} at most</span></div>`;
  }
  // The rate, and why: a shortcut over land fires slower than a crossing (mdOverland).
  ps.forEach((o, k) => {
    const land = rates[k] === M.reloadLand, who = ps.length > 1 ? ` to the Driver ${dirText(b, o)}` : '';
    h += `<div class="kv"><span>Rate${who}</span><span>a shot every ${rates[k]} s each way: ${land ? `over land (a robot could walk between the ends; ${M.reload} s over water, a chasm or cliffs)` : `a crossing (no walking way between the ends; ${M.reloadLand} s over land)`}</span></div>`;
  });
  h += `<div class="kv"><span>Power</span><span>${pow ? (thermalNear(b) ? 'A Thermal Plant in reach: no Fuel a shot' : 'A Generator in reach: half a Fuel a shot') : `<span class="err">None: it catches, but doesn't fire</span>`}</span></div>`;
  if (!pow) h += `<p class="hint">It fires only with a <b>Generator</b> (with Fuel) within ${BDEFS.generator.burner.radius} tiles, and each shot draws half a Fuel from it, or a <b>Thermal Plant</b> within ${THERMAL.radius} on hot ground, which needs none. Fuel can fly here by canister, in sealed drums.</p>`;
  if (fort) {
    h += `<p class="hint">One way: it keeps the ${BDEFS[live.type].name}'s Ammo${live.type === 'keep' ? ' and its cannon\'s Crystal' : ''} topped up for the warbots stationed there, out of what your colony holds beyond ${M.reserve} at home.${ships.length ? ` On its way: ${gl(Object.fromEntries(ships))}.` : ''}</p>`;
  } else if (ps.length) {
    h += `<div class="kv"><span>This end</span><span>${far ? `the far end: it stocks what ${served} building${served === 1 ? '' : 's'} round it need${served === 1 ? 's' : ''}` : 'the near end: it ships what the far end needs'}</span></div>`;
    if (far && b.auto) h += `<div class="kv"><span>Keeps here</span><span>${gl(b.auto)}</span></div>`;
    h += `<div class="section-label">Goods to send <span class="label-note">${manual ? `a goods list: up to ${M.goods}; the number is what stays home` : 'Auto: what the other end needs'}</span></div>`;
    h += `<div class="seg" id="sh-mdmode"><button data-v="auto" class="${manual ? '' : 'on'}">Auto</button><button data-v="list" class="${manual ? 'on' : ''}">Goods list</button></div>`;
    if (!manual) h += `<p class="hint">${ships.length ? `Shipping now: ${gl(Object.fromEntries(ships))}.` : far ? 'Nothing to ship: the other end needs nothing, and nothing here is spare.' : 'Nothing to ship: the far end needs nothing yet.'} ${far ? 'What this end holds beyond its own needs, and nothing round it uses, goes home.' : `Haulers bring it what your colony holds beyond ${M.reserve} of each (Fuel beyond ${M.fuelReserve}, for the far end's Generator).`}</p>`;
    else {
      const gs = Object.keys(list || {});
      h += gs.length ? `<div class="keep-list" id="sh-mdlist">${gs.map((g) => `<div class="keep-cell on" data-g="${g}"><span class="kname"><i class="gi ${g}"></i>${GOOD[g].name} <small>(${Math.floor(b.stock[g] || 0)} loaded)</small></span><b class="n">${list[g]}</b>
      <button class="btn" data-d="-${M.reserveStep}" aria-label="Keep less ${GOOD[g].name} at home">−${M.reserveStep}</button><button class="btn" data-d="${M.reserveStep}" aria-label="Keep more ${GOOD[g].name} at home">+${M.reserveStep}</button><button class="btn ghost" data-x="1" aria-label="Stop sending ${GOOD[g].name}">✕</button></div>`).join('')}</div>`
        : '<p class="hint"><b>Nothing on the list yet:</b> add a good below. It sends just these, instead of what the other end needs.</p>';
      if (gs.length < M.goods) {
        const opts = GOODS.filter((g) => g !== 'crude' && !(list && list[g] !== undefined) && (warOn() || !WAR_GOODS.includes(g)) && (nukeOn() || !NUKE_GOODS.includes(g)));
        h += `<div class="goodlist" id="sh-mdadd">${opts.map((g) => `<button class="gtag toggle" data-g="${g}"><i class="gi ${g}"></i><span>${GOOD[g].name}</span></button>`).join('')}</div>`;
      }
    }
  }
  if (full.length) h += `<div class="kv"><span>Far end full</span><span class="err">${full.map((g) => GOOD[g].name).join(', ')}: nothing there collects ${full.length === 1 ? 'it' : 'them'}, so no more is sent (${M.full} at most of each, or what it keeps)</span></div>`;
  h += `<div class="kv"><span>Goods thrown</span><span>${b.mdSent || 0}</span></div><div class="kv"><span>Goods caught</span><span>${b.mdGot || 0}</span></div>`;
  h += `<p class="hint">A canister of ${M.load} goods flies every ${M.reload} s from each end over water, a chasm or cliffs, every ${M.reloadLand} s when a robot could walk between the ends (a part load after ${M.partWait} s), in an arc over everything; buildings touching it hand over their output and are fed by conveyor. A Catcher takes ${M.drivers} Drivers at most. An enemy Flak Gun can burst one in flight; its goods fall as crates.</p>`;
  el.innerHTML = h;
  const done = (why) => { if (why) { sfx('error'); toast(why, 'warn'); } else sfx('click'); el.dataset.sig = ''; refreshSheet(); };
  if ($('sh-mdaim')) $('sh-mdaim').onclick = () => { sfx('click'); startMdAim(b); };
  if ($('sh-mdoff')) $('sh-mdoff').onclick = () => act('mdAim', [b.id, 0], done);
  if ($('sh-mdkit')) $('sh-mdkit').onclick = () => { sfx('click'); startMdAim(b, true); };
  if ($('sh-mdkitoff')) $('sh-mdkitoff').onclick = () => act('mdKit', [b.id, -1, -1], done);
  for (const btn of el.querySelectorAll('button[data-md]')) btn.onclick = () => { const d = getE(+btn.dataset.md); if (d && !d.dead) { sfx('click'); openBuildingSheet(d); } };
  if ($('sh-mdmode')) for (const btn of $('sh-mdmode').querySelectorAll('button')) btn.onclick = () => {
    if (btn.dataset.v === 'auto') { UI.mdList = 0; if (b.mdSend) act('mdAuto', [b.id], done); else done(''); } else { UI.mdList = b.id; done(''); }
  };
  if ($('sh-mdlist')) for (const btn of $('sh-mdlist').querySelectorAll('button')) btn.onclick = () => {
    const g = btn.parentElement.dataset.g;
    if (btn.dataset.x) act('mdSend', [b.id, g, false], done); else act('mdReserve', [b.id, g, +btn.dataset.d], done);
  };
  if ($('sh-mdadd')) for (const btn of $('sh-mdadd').querySelectorAll('button')) btn.onclick = () => act('mdSend', [b.id, btn.dataset.g, true], done);
}

/**
 * An Orbital Lift's panel (its owner's): the Carrier's six lamps, the climber, the four loads to call down (Z X C V), and
 * Restock the Carrier, the goods it sends up with what stays home (rebuilt only when something changes).
 */
function renderLiftSection(b) {
  const el = $('sh-lift');
  if (!el) return;
  const list = b.lfSend || {}, res = b.lfRes ?? LIFT.reserve, why = liftCallWhy(b, 'alloy'), mul = liftMul(b);
  const sig = JSON.stringify([res, b.lfBoost || 0, b.lfMove || 0, Math.ceil(b.lfCd || 0), Math.ceil(b.lfT || 0), b.lfPaid || 0, list, liftLoaded(b), liftFuel(b) >= LIFT.fuel, b.lfUps || 0, b.lfDrops || 0]);
  if (el.dataset.sig === sig) return;
  el.dataset.sig = sig;
  let h = `<div class="kv"><span>The Carrier's reserve</span><span class="lift-lamps" title="${res} of ${LIFT.reserve} drops">${Array.from({ length: LIFT.reserve }, (_, k) => `<i class="${k < res ? 'on' : ''}"></i>`).join('')} ${res} of ${LIFT.reserve}</span></div>`;
  if (b.lfMove) h += `<div class="kv"><span>Climber</span><span>${b.lfMove === 1 ? `coming down with ${LIFT.drops[b.lfLoad] ? LIFT.drops[b.lfLoad].name.toLowerCase() : 'its load'}` : `going up with ${LIFT.load} goods`}: ${b.lfPaid ? `${fmtSecs(Math.max(0, LIFT.climb - (b.lfT || 0)))} to go` : '<span class="err">waiting for power</span>'}</span></div><div class="bar"><div style="width:${Math.round(Math.min(1, (b.lfT || 0) / LIFT.climb) * 100)}%"></div></div>`;
  else if ((b.lfCd || 0) > 0) h += `<div class="kv"><span>Next call</span><span>in ${fmtSecs(b.lfCd)}</span></div><div class="bar"><div style="width:${Math.round((1 - b.lfCd / LIFT.cooldown) * 100)}%"></div></div>`;
  h += `<div class="section-label">Call down <span class="label-note">${mul > 1 ? `the next drop is ${Math.round((mul - 1) * 100)}% bigger` : `${LIFT.climb} s down; every colony hears it`}</span></div><div class="lift-loads">`;
  for (const k in LIFT.drops) {
    const d = liftDropOf(k, mul), what = Object.keys(d.bots).map((t) => `${d.bots[t]} ${BOTS[t].plural}`).concat(Object.keys(d.goods).map((g) => `${d.goods[g]} ${goodN(g, d.goods[g])}`)).join(', ');
    h += `<button class="btn" id="sh-lf-${k}" data-load="${k}"${why ? ' disabled' : ''}><b>${LIFT.drops[k].name}</b><small>${what}</small></button>`;
  }
  h += '</div>';
  h += `<p class="hint">${why || `Calls a climber down from the Carrier: it lands at the anchor in ${LIFT.climb} s, then ${Math.round(LIFT.cooldown / 60)} minutes to the next call.`} Each climb burns ${LIFT.fuel} Fuel from a Generator within ${LIFT.reach} tiles${liftFuel(b) >= LIFT.fuel ? '.' : ': <span class="err">none in reach now</span>.'}</p>`;
  const gs = Object.keys(list);
  h += `<div class="section-label">Restock the Carrier <span class="label-note">${liftLoaded(b)} of ${LIFT.load} loaded; the number is what stays home</span></div>`;
  h += gs.length ? `<div class="keep-list" id="sh-lflist">${gs.map((g) => `<div class="keep-cell on" data-g="${g}"><span class="kname"><i class="gi ${g}"></i>${GOOD[g].name}</span><b class="n">${list[g]}</b>
      <button class="btn" data-d="-${LIFT.sendStep}" aria-label="Keep less ${GOOD[g].name} at home">−${LIFT.sendStep}</button><button class="btn" data-d="${LIFT.sendStep}" aria-label="Keep more ${GOOD[g].name} at home">+${LIFT.sendStep}</button><button class="btn ghost" data-x="1" aria-label="Stop sending ${GOOD[g].name}">✕</button></div>`).join('')}</div>`
    : '<p class="hint"><b>Nothing to send up yet:</b> tick a good below.</p>';
  if (gs.length < LIFT.goods) {
    const opts = LIFT_GOODS.filter((g) => !list[g] && (warOn() || !WAR_GOODS.includes(g)) && (nukeOn() || !NUKE_GOODS.includes(g)));
    h += `<div class="goodlist" id="sh-lfadd">${opts.map((g) => `<button class="gtag toggle" data-g="${g}"><i class="gi ${g}"></i><span>${GOOD[g].name}</span></button>`).join('')}</div>`;
  }
  h += `<p class="hint">Haulers (Tankers for Fuel) bring it what you hold of these beyond the number kept home, and buildings touching the pad feed it by conveyor. At ${LIFT.load} goods the climber goes up (${LIFT.climb} s; never while one is coming down): each load puts a drop back in the Carrier and makes the next drop half again bigger, up to double. Sent up so far: ${b.lfUps || 0}; called down: ${b.lfDrops || 0}.</p>`;
  el.innerHTML = h;
  markSheetKeys();
  const done = (why2) => { if (why2) { sfx('error'); toast(why2, 'warn'); } else sfx('click'); el.dataset.sig = ''; refreshSheet(); };
  for (const btn of el.querySelectorAll('[data-load]')) btn.onclick = () => act('liftCall', [b.id, btn.dataset.load], (why2) => { if (why2) { sfx('error'); toast(why2, 'warn'); } else { sfx('order'); toast(`Climber called: ${LIFT.drops[btn.dataset.load].name.toLowerCase()} lands at the anchor in ${LIFT.climb} seconds. Every colony hears it coming.`, 'good'); } el.dataset.sig = ''; refreshSheet(); });
  if ($('sh-lflist')) for (const btn of $('sh-lflist').querySelectorAll('button')) btn.onclick = () => {
    const g = btn.parentElement.dataset.g;
    if (btn.dataset.x) act('liftSend', [b.id, g, false], done); else act('liftReserve', [b.id, g, +btn.dataset.d], done);
  };
  if ($('sh-lfadd')) for (const btn of $('sh-lfadd').querySelectorAll('button')) btn.onclick = () => act('liftSend', [b.id, btn.dataset.g, true], done);
}

/**
 * A Great Uplink's Transmission section (GUP): its clock, its power and jamming, and (its owner's) Begin transmission.
 * Anyone tapping it sees how its transmission stands.
 */
function renderGupSection(b) {
  const el = $('sh-gup');
  if (!el) return;
  const mine = b.owner === ME, why = gupBlocked(b), gens = megaGens(b, GUP.reach).length, T = b.gT || 0;
  const src = b.gOn ? b.gSrc || '' : gupPower(b), rx = gupReactor(b);
  const sig = JSON.stringify([b.gOn || 0, Math.floor(T), b.gJam || 0, b.gPow || 0, gens, why, mine, src, Math.ceil(b.gU || 0), rx ? (rx.stock.uranium || 0) + '/' + (rx.stock.fissile || 0) : '']);
  if (el.dataset.sig === sig) return;
  el.dataset.sig = sig;
  const col = PLAYER_COLORS[b.owner] || '#ffffff';
  let h = '';
  if (b.gOn) {
    const st = b.gJam ? `<b class="err">Jammed</b> by ${playerName(b.gJam - 1, true)}: its clock runs back at half speed` : !b.gPow ? '<b class="err">No power</b>: its clock runs back at half speed' : 'Transmitting';
    h += `<div class="kv"><span>Contact in</span><span>${fmtClock(GUP.hold - T)} of ${fmtClock(GUP.hold)}</span></div><div class="bar"><div style="width:${Math.round((T / GUP.hold) * 100)}%;background:${col}"></div></div>`;
    h += `<div class="kv"><span>Signal</span><span>${st}</span></div>`;
  } else h += `<div class="kv"><span>Signal</span><span>${gupWinOn() ? 'Silent' : 'Silent: the Great Uplink win is off in this game'}</span></div>`;
  if (mine) {
    const ru = rx ? `${rx.stock.uranium || 0} Uranium${rx.stock.fissile ? `, ${rx.stock.fissile} Enriched` : ''} in its Reactor` : '';
    h += `<div class="kv"><span>Power</span><span>${src === 'gen' ? `${gens} Generators with Fuel: each burns a Fuel every ${GUP.genFuel} s while it transmits`
      : src === 'reactor' ? `Reactor and ${gens} Generator${gens === 1 ? '' : 's'}: a Uranium every ${GUP.uEvery / 60} minutes of transmission (an Enriched Uranium lasts ${GUP.uEvery / 30}), ${ru}${b.gU > 0 ? `, ${fmtSecs(b.gU)} paid for` : ''}; the Generator a Fuel every ${GUP.genFuel} s`
      : `<b>None</b>: ${gens} of ${GUP.gens} Generators with Fuel within ${GUP.reach} tiles, or a Nuclear Reactor with Uranium and ${GUP.rGens} Generator there${rx ? '' : ' (no Reactor with Uranium in reach)'}`}</span></div>`;
    if (!b.gOn) h += `<button class="btn primary big danger-glow" id="sh-gup-begin"${why ? ' disabled' : ''}>Begin transmission</button>`;
    else h += `<button class="btn" id="sh-gup-stop">Stand down (the transmission is lost)</button>`;
    h += `<p class="hint">${!b.gOn && why ? why + ' ' : ''}Hold the transmission for ${GUP.hold / 60} minutes and you make contact: your colony${S.teams ? ' and your team' : ''} win${S.teams ? '' : 's'}. Every colony sees the countdown and where it is. An enemy warbot within ${GUP.jam} tiles jams it; jammed or without power its clock runs back at half speed. Destroyed, the transmission is lost.</p>`;
  } else if (b.gOn) h += `<p class="hint">${allies(b.owner, ME) ? 'Your team wins when it makes contact: guard it.' : `Warbots within ${GUP.jam} tiles of it jam it and wind its clock back; destroy it and the transmission is lost.`}</p>`;
  el.innerHTML = h;
  markSheetKeys();
  if ($('sh-gup-begin')) $('sh-gup-begin').onclick = () => act('gupBegin', [b.id], (why2) => { if (why2) { sfx('error'); toast(why2, 'warn'); } else sfx('order'); el.dataset.sig = ''; refreshSheet(); });
  if ($('sh-gup-stop')) $('sh-gup-stop').onclick = () => act('gupStop', [b.id], (why2) => { if (why2) { sfx('error'); toast(why2, 'warn'); } else sfx('click'); el.dataset.sig = ''; refreshSheet(); });
}

/** Aim a Mass Driver: pick its far end on the map (a tap on a Catcher, an Outpost or a Keep aims the Driver). */
function startMdAim(b, kit) {
  closeSheet();
  setMode('mdaim');
  UI.mdAim = b.id;
  UI.mdKit = !!kit; // (aiming a Catcher kit: a tap on open ground)
  showMdAimBanner();
}

function showMdAimBanner(problem) {
  if (UI.mdKit) { showBanner((problem ? `<span class="err">${problem}</span> ` : '') + `Tap open ground ${MASSDRIVER.min} to ${MASSDRIVER.max} tiles away (inside the ring) that no one else holds: a <b>Catcher kit</b> (${costText(BDEFS.catcher.cost)}, loaded at the Driver) flies there and assembles itself.`, null, 'Cancel'); return; }
  showBanner((problem ? `<span class="err">${problem}</span> ` : '') + `Tap one of your <b>Catchers</b> ${MASSDRIVER.min} to ${MASSDRIVER.max} tiles away (ringed) to make a line with it, or an <b>Outpost</b> or <b>Keep</b> to keep its Ammo topped up.`, null, 'Cancel');
}

function mdAimTap(i, j, wx, wy) {
  const a = getE(UI.mdAim);
  if (!a || a.dead) { setMode('normal'); return; }
  if (UI.mdKit) {
    const why = mdKitWhy(ME, a, i, j);
    if (why) { sfx('error'); showMdAimBanner(why); return; }
    act('mdKit', [a.id, i, j], (r) => {
      if (r) { sfx('error'); showMdAimBanner(r); return; }
      sfx('order');
      toast(`Catcher kit ordered: Haulers bring the Driver its goods, it flies as soon as it's loaded and the coils can fire, and it assembles itself where it lands in ${MASSDRIVER.kitBuild} s.`, 'good');
      setMode('normal');
      openBuildingSheet(a);
    });
    return;
  }
  const c = inMap(i, j) ? buildingAtTap(i, j, wx, wy) : null;
  const why = mdAimWhy(ME, a, c && (BDEFS[c.type].catcher || mdFortType(c.type)) ? c : null);
  if (why) { sfx('error'); showMdAimBanner(why); return; }
  act('mdAim', [a.id, c.id], (r) => {
    if (r) { sfx('error'); showMdAimBanner(r); return; }
    sfx('order');
    toast(mdFortType(c.type) ? `Aimed: it keeps the ${BDEFS[c.type].name}'s Ammo topped up, once it has power.` : 'Aimed: the two ends now supply each other, once each has power.', 'good');
    setMode('normal');
    openBuildingSheet(a);
  });
}

/* Aiming a defence (ORDERS.focus): its panel's Aim, then a tap on an enemy; or, its panel open, a right-click on one. */

/** What enemy t is called on a defence's panel and in its toasts. */
function focusName(t) { return BDEFS[t.type] ? BDEFS[t.type].name : BOTS[t.type].name; }
/** What defence b can aim at, in a few words. */
function focusKinds(b) { const d = BDEFS[b.type]; return d.flak ? 'aircraft' : d.mortar ? 'robot or building' : 'robot'; }

/** The enemy under a tap at (wx, wy) for defence b: a robot (in the air first for a Flak Gun, on the ground first otherwise), else a building. */
function focusFoeAt(b, i, j, wx, wy) {
  const air = !!BDEFS[b.type].flak, x = wx ?? i + 0.5, y = wy ?? j + 0.5;
  let best = null, bd = 1.3 * 1.3, any = null, ad = 1.3 * 1.3;
  for (const u of S.bots) {
    if (u.dead || u.inside || u.owner < 0 || !foes(u.owner, ME) || u.dropping || u.under) continue;
    const d = dist2(u.x, u.y, x, y), flying = !!(BOTS[u.type].air && u.flight);
    if (flying === air && d < bd) { bd = d; best = u; }
    if (d < ad) { ad = d; any = u; }
  }
  if (best || any) return best || any;
  const t = inMap(i, j) ? buildingAtTap(i, j, wx, wy) : null;
  return t && t.owner >= 0 && foes(t.owner, ME) ? t : null;
}

/** Aim: pick the enemy on the map (a tap on one aims defence b at it). */
function startFocusAim(b) {
  closeSheet();
  setMode('focusaim');
  UI.focusB = b.id;
  showFocusBanner(b);
}

function showFocusBanner(b, problem) {
  const R2 = focusReach(b);
  showBanner((problem ? `<span class="err">${problem}</span> ` : '') + `Tap an enemy <b>${focusKinds(b)}</b> ${R2.min ? `${R2.min} to ${Math.round(R2.max * 10) / 10}` : `within ${Math.round(R2.max * 10) / 10}`} tiles (ringed) to aim this ${BDEFS[b.type].name} at it.`, null, 'Cancel');
}

/**
 * Aim defence b at the enemy under (i, j): with `group`, every one of your defences that can reach it. Shows why not
 * (fail(why), or a toast); done() once the order has gone through.
 */
function focusAt(b, i, j, wx, wy, group, fail, done) {
  const no = fail || ((why) => { sfx('error'); toast(why, 'warn'); });
  const t = focusFoeAt(b, i, j, wx, wy);
  if (!t) { no(`${onTouch() || R.mode === 'focusaim' ? 'Tap' : 'Right-click'} an enemy ${focusKinds(b)} to aim the ${BDEFS[b.type].name} at it.`); return; }
  const why = focusWhy(b, t);
  const ids = group ? S.buildings.filter((o) => !o.dead && o.owner === ME && o.built && canFocus(BDEFS[o.type]) && (o === b || !focusWhy(o, t))).map((o) => o.id) : [b.id];
  if (why && ids.length < 2) { no(why); return; }
  act('focus', [ids, t.id], (r) => {
    if (!r || !r.n) { no((r && r.why) || 'That target is gone.'); return; }
    sfx('order');
    const c = BDEFS[t.type] ? bCentre(t) : t;
    addFx('ring', c.x, c.y, { color: '#ff5a6e' });
    toast(r.n > 1 ? `${r.n} defences aiming at the ${focusName(t)}.` : `Aiming at the ${focusName(t)}: it fires at nothing else while it's in reach.`, 'good');
    if (done) done();
    refreshSheet();
  });
}

function focusAimTap(i, j, wx, wy) {
  const b = getE(UI.focusB);
  if (!b || b.dead || b.owner !== ME) { setMode('normal'); return; }
  focusAt(b, i, j, wx, wy, false, (why) => { sfx('error'); showFocusBanner(b, why); }, () => { setMode('normal'); openBuildingSheet(b); });
}

/** The Mooring Mast panel's section (filled in by renderMastSection), with the Auto supply switch. */
function mastSection() {
  return `<div class="section-label">Airship line</div><div id="sh-mast"></div>
    <div class="seg" id="sh-auto"><button data-v="1">Auto supply</button><button data-v="0">Off</button></div>
    <p class="hint">Auto supply: the far Mast (the one further from your Command Base) stocks what the buildings round it need, the Mast nearer home keeps that ready for the line, and the far Mast's spare goods come home: ${BOTS.airship.carry} goods a trip, several kinds at once. Haulers bring the goods to a Mast and take away what arrives. Supply orders you set below come on top.</p>`;
}

/** Mast b's line, its Airships, its Fuel and its automatic stock (rebuilt only when something changes). */
function renderMastSection(b) {
  const el = $('sh-mast');
  if (!el) return;
  const o = mastPartner(b), ships = o ? lineShips(b) : [], keep = mastFuelKeep(b), fuel = Math.floor((b.stock.fuel || 0) - (b.res.fuel || 0));
  const idle = S.bots.filter((u) => !u.dead && u.owner === b.owner && BOTS[u.type].airship && u.inside === b.id && !ships.includes(u));
  const sig = JSON.stringify([o && o.id, b.home, ships.map((u) => [u.id, shipStatus(u)]), idle.map((u) => u.id), keep, fuel, !!b.fuelByPipe, b.auto, b.autoOff, sumValues(b.inc)]);
  if (el.dataset.sig === sig) return;
  el.dataset.sig = sig;
  let h = '';
  if (o) {
    h += `<div class="status">Linked to ${mastWhere(o)} (${dirText(b, o)} from here).</div><p class="hint">${farStation(b) ? 'This is the far Mast: it stocks what the buildings round it need, and sends their spare goods home.' : 'This is the home Mast (nearer your Command Base): it keeps what the far Mast wants, ready to load.'} Your Workers and Warbots ride the line whenever it's the shorter way.</p>`;
    h += ships.length ? `<div class="kv"><span>Airships on the line</span><span>${ships.length} of ${AIRSHIP.perLine}</span></div>` + ships.map((u) => `<div class="kv army-row"><span>${shipStatus(u)}</span><span><button class="btn small ghost" data-ship="${u.id}">Airship ›</button></span></div>`).join('')
      : `<p class="hint"><b>No Airship serves it yet:</b> order one in an Airfield's hangar. With just this line, it comes here by itself.</p>`;
    h += '<button class="btn" id="sh-munlink">Unlink</button>';
  } else {
    h += `<div class="status">Not on a line.</div><p class="hint">Tap <b>Link</b>, then another of your Mooring Masts at least ${AIRSHIP.minDist} tiles away: an Airship line runs straight between them, over water, cliffs and rock. A Mast is on one line at most.</p><button class="btn primary" id="sh-mlink">Link to another Mast</button>`;
  }
  if (idle.length) h += idle.map((u) => `<div class="kv army-row"><span>${shipStatus(u)}</span><span><button class="btn small ghost" data-ship="${u.id}">Airship ›</button></span></div>`).join('');
  h += `<div class="kv"><span>Fuel for its Airships</span><span>${fuel}${keep ? ` (it keeps ${keep})` : ' (it keeps some once an Airship serves its line)'}</span></div>`;
  const auto = b.auto && !b.autoOff ? Object.entries(b.auto).map(([g, n]) => goodTag(g, `${Math.min(b.stock[g] || 0, n)}/${n} ${GOOD[g].name}`, (b.stock[g] || 0) < n / 3)).join(' ') : '';
  const coming = Object.keys(b.inc).filter((g) => b.inc[g] > 0 && S.bots.some((u) => !u.dead && u.cargoTo === b.id && u.cargo && u.cargo[g]));
  const served = S.buildings.filter((c) => !c.dead && c.railBy === b.id).length;
  if (served) h += `<p class="hint">It serves ${served} building${served > 1 ? 's' : ''} round it.</p>`;
  if (auto) h += `<div class="goodlist">${auto}</div>`;
  if (coming.length) h += `<p class="hint">On their way by Airship: ${coming.map((g) => `${b.inc[g]} ${GOOD[g].name}`).join(', ')}.</p>`;
  el.innerHTML = h;
  if ($('sh-mlink')) $('sh-mlink').onclick = () => { sfx('click'); startMastLink(b); };
  if ($('sh-munlink')) $('sh-munlink').onclick = () => act('mastLine', [b.id, 0], (why) => {
    if (why) { sfx('error'); toast(why, 'warn'); return; }
    sfx('click'); toast('Unlinked: its Airships wait at their Masts for a line.', 'info'); el.dataset.sig = ''; refreshSheet();
  });
  for (const btn of el.querySelectorAll('button[data-ship]')) btn.onclick = () => { const u = getE(+btn.dataset.ship); if (u && !u.dead) { sfx('click'); openBotSheet(u); } };
}

/** Link: pick the other Mast on the map (a tap on it links them). */
function startMastLink(b) {
  closeSheet();
  setMode('mastlink');
  UI.linkMast = b.id;
  showMastLinkBanner();
}

function showMastLinkBanner(problem) {
  showBanner((problem ? `<span class="err">${problem}</span> ` : '') + `Tap another of your <b>Mooring Masts</b> (at least ${AIRSHIP.minDist} tiles away) to link this one to it: an Airship line runs straight between them, over anything.`, null, 'Cancel');
}

function mastLinkTap(i, j, wx, wy) {
  const a = getE(UI.linkMast);
  if (!a || a.dead) { setMode('normal'); return; }
  const b = inMap(i, j) ? buildingAtTap(i, j, wx, wy) : null;
  const why = mastLineWhy(ME, a, b && BDEFS[b.type].mast ? b : null);
  if (why) { sfx('error'); showMastLinkBanner(why); return; }
  act('mastLine', [a.id, b.id], (r) => {
    if (r) { sfx('error'); showMastLinkBanner(r); return; }
    sfx('order');
    toast(lineShips(a).length ? 'Linked: the Airship line is open.' : 'Linked. Order an Airship in an Airfield\'s hangar to fly the line (with just this line, it goes there by itself).', 'good');
    setMode('normal');
    openBuildingSheet(a);
  });
}

/** The "Supply by air" switch for one of your Depots, Outposts and the like, once you have an Airfield. */
function airSupplySection(b) {
  if (!airSuppliable(b) || !b.built || b.owner !== ME || !S.buildings.some((o) => !o.dead && o.built && o.owner === ME && BDEFS[o.type].airfield)) return '';
  return '<div class="section-label">Supply by air</div><div class="seg" id="sh-airsup"><button data-v="1">On</button><button data-v="0">Off</button></div><p class="hint" id="sh-airsup-hint"></p>';
}

/** Can't be switched on here: a road from home reaches it (Haulers supply it; see the airSupply order). */
function airSupplyRoad(b) { return !b.airSupply && onHomeNet(b); }

function airSupplyHint(b) {
  const base = airBaseNear(b.owner, b.x, b.y);
  if (airSupplyRoad(b)) return 'A road from home reaches this place: Haulers supply it. Supply by air is for places no road reaches.';
  if (!b.airSupply) return 'On: a Cargo Plane from your nearest Airfield keeps this place stocked by parachute (its supply orders, Ammo for its warbots), wherever it is. For a place no road reaches: it switches off by itself once a road from home reaches it.';
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

function startAim(silo, mode) {
  setMode('aim');
  UI.aimSilo = silo.id;
  R.selected = silo.id;
  // The Lance of Corvane: no ring (it reaches across the map); the view stays, and the line follows the pointer.
  if (BDEFS[silo.type].lance) { if (silo.lAim) R.aim = { i: silo.lAim[0], j: silo.lAim[1] }; showAimBanner(); return; }
  // The Atmosphere Engine's Storm Front: anywhere on the map (the view stays); its own circle, kept clear, is shown.
  if (BDEFS[silo.type].atmos) { R.aim = null; showAimBanner(); return; }
  // The Sundering Ray: Strike the Deep reaches anywhere (the view stays); a Quake shows its reach round the Ray.
  const ray = !!BDEFS[silo.type].sunder;
  if (ray) {
    UI.aimMode = mode === 'deep' ? 'deep' : 'quake';
    if (silo.sAim && silo.sMode === UI.aimMode) R.aim = { i: silo.sAim[0], j: silo.sAim[1] };
    if (UI.aimMode === 'deep') { showAimBanner(); return; }
  }
  const range = ray ? SUNDER.range : BDEFS[silo.type].nukeSilo ? NUKE.range : BDEFS.silo.missile.range;
  showAimBanner();
  // Fit the whole range ring in the map area left between the top bar and the banner (or the tools, where they
  // lie across the bottom). Under a finger it never zooms out further than AIM_TILE px a tile: at the 9 px a
  // tile it took to fit the ring on a phone a fingertip covered twenty tiles. The ring then runs off the screen:
  // move the map to the target, tap to drop the crosshair, drag the crosshair to adjust, and Fire.
  const top = $('topbar').getBoundingClientRect().bottom + 8, bn = $('banner').getBoundingClientRect(), bb = $('bottombar').getBoundingClientRect();
  const bottom = Math.min(bn.height && bn.top > R.h / 2 ? bn.top : R.h, bb.height && bb.width > R.w / 2 ? bb.top : R.h) - 8;
  const avail = Math.max(120, Math.min(R.w - 16, bottom - top));
  R.cam.z = clamp(avail / (2 * range + 2), Math.max(minZoom(), onTouch() ? AIM_TILE : 0), maxZoom());
  const sc = ray ? bCentre(silo) : { x: silo.x + 0.5, y: silo.y + 0.5 };
  centerOn(sc.x, sc.y + (R.h / 2 - (top + bottom) / 2) / R.cam.z);
}
const AIM_TILE = 20;

/**
 * Under a finger a drag that starts on the aiming crosshair moves it, keeping the distance the finger had from
 * it (so it can be taken hold of from just below and stay in view); a drag anywhere else moves the map, as
 * always. Returns what to do with the finger's moves, or null when there is nothing to take hold of there.
 */
const AIM_GRAB = 56; // px round the crosshair that take hold of it
function mapGrab(x, y, mouse) {
  const cmd = cmdGrab(x, y);
  if (cmd) return cmd;
  if (mouse) return magBendGrab(x, y); // (a bend's diamond, editing a Maglev line's bends)
  if (mouse || R.mode !== 'aim' || !R.aim) return null;
  const p = worldToScreen(R.aim.i + 0.5, R.aim.j + 0.5), dx = p.x - x, dy = p.y - y;
  if (Math.hypot(dx, dy) > AIM_GRAB) return null;
  return (mx, my) => {
    const w = screenToWorld(mx + dx, my + dy), i = Math.floor(w.x), j = Math.floor(w.y), silo = getE(UI.aimSilo);
    if (!silo || !inMap(i, j) || (R.aim.i === i && R.aim.j === j)) return;
    // Out of range or onto ground it can't strike: the crosshair waits at the last good spot and the banner says why.
    const why = aimBlocked(silo, i, j);
    if (!why) R.aim = { i, j };
    showAimBanner(why || undefined);
  };
}

/** Why the weapon being aimed (a Silo, a Nuclear Silo, the Lance) can't strike tile (i, j) ('' if it can). */
function aimBlocked(silo, i, j) { const d = BDEFS[silo.type]; return d.atmos ? atmosStormBlocked(silo, i, j) : d.sunder ? sunderAimBlocked(silo, i, j, UI.aimMode) : d.lance ? lanceAimBlocked(silo, i, j) : d.nukeSilo ? nukeBlocked(silo, i, j) : missileBlocked(silo, i, j); }

function showAimBanner(problem) {
  const silo = getE(UI.aimSilo), md = BDEFS.silo.missile;
  if (!silo) { setMode('normal'); return; }
  let html = '', ok = null;
  if (problem) html = `<span class="err">${problem}</span> `;
  if (BDEFS[silo.type].lance) {
    html += R.aim
      ? `<b>${silo.lOn ? 'Turn the Lance onto this line?' : 'Charge the Lance along this line?'}</b> ${silo.lOn ? `It fires in ${fmtSecs(lanceTime(silo) - silo.lCharge)}.` : `It charges for ${lanceTime(silo)} s (your lights dim, your factories slow, and every rival hears it), then fires.`} Everything in the red core (2 tiles wide) is destroyed, yours too; the fainter edge either side is scorched to half armor.`
      : 'Tap a spot anywhere on the map: the beam runs from the gun through it, right across the map.';
    showBanner(html + (R.aim && onTouch() ? ' Drag the crosshair to move it.' : ''), R.aim ? (silo.lOn ? 'Aim here' : 'Charge') : null, 'Cancel');
    return;
  }
  if (BDEFS[silo.type].atmos) {
    const st = silo.aeStage || 2;
    html += R.aim
      ? `<b>${silo.aeStorm ? 'Move the storm here?' : 'Set the storm down here?'}</b> A ${STORM.r}-tile storm sits here while the Engine has power: enemy robots under it move at ${Math.round(STORM.slow * 100)}% speed, their sites go up at ${Math.round(STORM.build * 100)}%, their guns reach ${Math.round(STORM.range * 100)}% as far${st >= 3 ? `, their crops stop growing and wither after ${Math.round(STORM.drought / 60)} minutes` : ''}${st >= 4 ? ', and lightning strikes one of their buildings about once a minute' : ''}. Everyone sees it. It can be moved again in ${Math.round(STORM.cd)} s.`
      : `Tap a spot anywhere on the map, clear of the Engine's own circle (${ATMOS.r[st - 1] + STORM.r} tiles from its middle) and outside any other Engine's: the ${STORM.r}-tile circle the storm sits on.`;
    showBanner(html + (R.aim && onTouch() ? ' Drag the crosshair to move it.' : ''), R.aim ? (silo.aeStorm ? 'Move it' : 'Storm') : null, 'Cancel');
    return;
  }
  if (BDEFS[silo.type].sunder) {
    const deep = UI.aimMode === 'deep', T = sunderTime(silo);
    html += R.aim
      ? (deep ? `<b>${silo.sOn ? 'Turn the Ray here?' : 'Strike the Deep here?'}</b> ${silo.sOn ? `It fires in ${fmtSecs(T - silo.sCharge)}.` : `It winds up for ${T} s (everyone hears it), then a ripple runs through the ground to the spot.`} In the ${SUNDER.deep}-tile circle every Murmur tunnel caves in, the exits are sealed for ${SUNDER.sealNights} nights and the nests are shaken. The Murmur will come for the Ray the next night.`
        : `<b>${silo.sOn ? 'Turn the Quake here?' : 'Quake here?'}</b> ${silo.sOn ? `It fires in ${fmtSecs(T - silo.sCharge)}.` : `It winds up for ${T} s; a ring shows here for everyone ${SUNDER.warn} s before it lands.`} In the ${SUNDER.quake}-tile circle buildings lose ${Math.round(SUNDER.dmg * 100)}% of their armor (never below ${Math.round(SUNDER.floor * 100)}%, yours too) and crack, roads and track crack, robots are stunned. A Shield Dome doesn't stop it.`)
      : deep ? `Tap a spot anywhere on the map: the ${SUNDER.deep}-tile circle where the Murmur's tunnels cave in.` : `Tap a spot inside the ring (${SUNDER.range} tiles from the Ray): the ${SUNDER.quake}-tile circle the Quake lands on.`;
    showBanner(html + (R.aim && onTouch() ? ' Drag the crosshair to move it.' : ''), R.aim ? (silo.sOn ? 'Aim here' : deep ? 'Strike' : 'Quake') : null, 'Cancel');
    return;
  }
  if (BDEFS[silo.type].nukeSilo) {
    html += R.aim
      ? `<b>Launch the nuclear missile here?</b> Everything within ${NUKE.radius} tiles is destroyed, yours included, and the ground stays scorched for ${Math.round(NUKE.scorch / 60)} minutes. It lands ${NUKE.flight} seconds after launch, and the rival sees it coming.`
      : `Tap where to strike, inside the red ring (${NUKE.range} tiles). The red circle shows the ${NUKE.radius}-tile blast.`;
    showBanner(html + (R.aim && onTouch() ? ' Drag the crosshair to move it.' : ''), R.aim ? 'Launch' : null, 'Cancel');
    return;
  }
  if (R.aim) {
    const t = missileTargetAt(ME, R.aim.i, R.aim.j), dm = t ? null : missileDamAt(R.aim.i, R.aim.j), u = t || dm ? null : missileBotAt(ME, R.aim.i, R.aim.j);
    html += t ? `Fire at the ${playerName(t.owner)} <b>${BDEFS[t.type].name}</b>? ${BDEFS[t.type].mil ? 'Its armor drops to almost nothing, ready for warbots to capture.' : 'A hit wrecks it.'}`
      : dm ? (foes(dm.k, ME) ? `Fire at <b>the dam</b> over ${damWhose(dm, ME)} valley? A Missile takes ${DAM.missile} of its ${DAM.hp} strength (it has ${Math.ceil(dm.hp)}); at 0 it bursts and the lake floods that valley.` : `That dam holds the lake over ${damWhose(dm, ME)} valley: your own Missiles never hurt it. The blast still hurts rival robots within ${md.splash} tiles.`)
      : u ? `Fire at the ${playerName(u.owner)} <b>${BOTS[u.type].name}</b>? The Missile flies to where it is now: if it moves off, it misses. The blast hurts rival buildings and bots within ${md.splash} tiles.`
      : 'Fire at this spot? The blast hurts rival buildings and bots within ' + md.splash + ' tiles.';
    if (onTouch()) html += ' Drag the crosshair to move it.';
    ok = 'Fire';
  } else {
    const w = silo.stock.warhead || 0;
    html += `Tap where to fire, inside the red ring (${md.range} tiles): a building, a rival robot or vehicle (aimed where it stands: it can move out of the way)${S.dam ? ', a rival\'s dam' : ''} or any patch of ground. A hit wrecks most buildings; the blast hurts everything rival within ${md.splash} tiles. <b>${w}</b> Missile${w === 1 ? '' : 's'} loaded.`;
  }
  showBanner(html, ok, 'Cancel');
}

/** A tap while aiming: the first picks the spot; Fire launches, and so does a second click on the spot with a mouse (not a second tap: a finger's double tap is too easily made). */
function aimTap(i, j) {
  const silo = getE(UI.aimSilo);
  if (!silo) { setMode('normal'); return; }
  if (!inMap(i, j)) return;
  const why = aimBlocked(silo, i, j);
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
  if (BDEFS[silo.type].lance) {
    const was = silo.lOn;
    act('lanceAim', [sid, i, j], (why) => {
      if (!why) { setMode('normal'); sfx(was ? 'click' : 'alert'); toast(was ? 'The Lance turns onto the new line.' : `The Lance is charging: it fires in ${lanceTime(silo)} seconds.`, 'info'); return; }
      sfx('error'); showAimBanner(why);
    });
    return;
  }
  if (BDEFS[silo.type].atmos) {
    const was = !!silo.aeStorm;
    act('atmosStorm', [sid, i, j], (why) => {
      if (!why) { setMode('normal'); sfx('order'); toast(was ? 'The storm front moves: it settles over the new spot.' : 'The storm front rolls out: it settles over the spot while the Engine has power.', 'info'); return; }
      sfx('error'); showAimBanner(why);
    });
    return;
  }
  if (BDEFS[silo.type].sunder) {
    const was = silo.sOn, mode = UI.aimMode === 'deep' ? 'deep' : 'quake';
    act('sunderAim', [sid, i, j, mode], (why) => {
      if (!why) { setMode('normal'); sfx(was ? 'click' : 'alert'); toast(was ? 'The Sundering Ray turns to the new aim.' : `The Sundering Ray is winding up: it fires in ${sunderTime(silo)} seconds.`, 'info'); return; }
      sfx('error'); showAimBanner(why);
    });
    return;
  }
  if (BDEFS[silo.type].nukeSilo) {
    act('nukeAt', [sid, i, j], (ok) => {
      if (ok) { setMode('normal'); sfx('alert'); return; }
      const s = getE(sid);
      sfx('error'); showAimBanner(s ? nukeBlocked(s, i, j) : 'That Silo is gone.');
    });
    return;
  }
  const t = missileTargetAt(ME, i, j), dm = t ? null : missileDamAt(i, j), lu = t || dm ? null : missileBotAt(ME, i, j), tName = t ? BDEFS[t.type].name : dm ? 'dam' : lu ? BOTS[lu.type].name : '';
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

/**
 * Under a finger: the target of a bomber's strike or a Howitzer's shelling, picked by a tap and ringed, waiting for the
 * banner's button (confirmBanner). `deck`: the tile of a Viaduct's deck a bomb is aimed at ({ i, j }), ringed too.
 */
function pickTarget(t, html, okLabel, deck) {
  UI.pick = t.id;
  UI.pickDeck = deck || null;
  if (deck) addFx('ring', deck.i + 0.5, deck.j + 0.5, { color: '#ff5a6e' });
  if (BDEFS[t.type]) { R.selected = t.id; UI.selBot = 0; } else { UI.selBot = t.id; R.selected = 0; }
  sfx('click');
  if (R.mode === 'strike') strikeBanner(html, okLabel); else showBanner(html, okLabel, 'Cancel');
}

/** Send the bomber being given a target (UI.bomber) at t (`deck`: { i, j }, a tile of the deck of the Viaduct t is an end of). */
function strikePicked(t, deck) {
  const u = getE(UI.bomber);
  if (!u || u.dead) { sfx('error'); showBanner('<span class="err">That bomber is gone.</span>', null, 'Cancel'); return; }
  if (!t || t.dead) { sfx('error'); UI.pick = 0; UI.pickDeck = null; strikeBanner('<span class="err">That target is gone: tap another.</span>'); return; }
  const tName = deck ? `the ${BDEFS[t.type].name}'s deck` : BDEFS[t.type] ? `the ${BDEFS[t.type].name}` : `a ${BOTS[t.type].name}`;
  act('strike', deck ? [u.id, t.id, deck.i, deck.j] : [u.id, t.id], (why) => {
    if (why) { sfx('error'); strikeBanner(`<span class="err">${why}</span>`); return; }
    sfx('order'); setMode('normal');
    toast(`Strike ordered on ${tName}: the bomber loads up and takes off.`, 'good');
  });
}

function showBanner(html, okLabel, cancelLabel) {
  $('banner').hidden = false;
  $('banner-seg').hidden = true;
  $('banner-tool').hidden = true;
  $('banner').classList.remove('picking');
  $('banner-traffic').hidden = true;
  $('banner-goods').hidden = true;
  $('banner-route').hidden = true;
  $('banner-undo').hidden = true;
  $('banner-clear').hidden = true;
  $('banner-ok').disabled = false;
  $('banner').classList.remove('noplan');
  $('banner-text').innerHTML = html;
  $('banner-ok').hidden = !okLabel;
  if (okLabel) $('banner-ok').textContent = okLabel;
  $('banner-cancel').textContent = cancelLabel || 'Cancel';
  if (crossingPlacing()) crossingTools();
}

/** How it works, for the Viaducts and Ropeways tools in Paths. */
const CROSSING_HOW = {
  viaduct: () => `A Viaduct is a level bridge straight across a valley, canyon or water, from one clifftop to another ${VIA_MIN} to ${VIA_MAX} tiles away in the same row or column, no more than ${VIA_RISE} levels up or down, over ground lower than both ends${S.settings && SHAPE_PRESETS[S.settings.shape || 0].sky ? ' (on Sky islands, mesa top to mesa top)' : ''}. ` +
    `It costs ${costText(BDEFS.viaduct.cost)} for every tile it spans (the Alloy rounded up), paid straight from storage as the goods come in, so no Hauler or road is needed and it doesn't count against the site limit; a Worker builds it out from the near end. ` +
    'Everything drives across, trucks and Road Trains included (and trains, with track laid onto both ends), while life below carries on underneath. It\'s open to both sides, so enemy bots can cross it too, and a Vulcan Bomber can bomb its deck: two bombs bring it down.',
  ropeway: () => `A Ropeway is a cable line with gondolas from a station by your roads straight across anything (cliffs, water, rock, down to a canyon floor) to a far end ${ROPE_MIN} to ${ROPE_MAX} tiles away on clear ground no rival holds. ` +
    `It's an ordinary site (${costText(BDEFS.ropeway.cost)}): Haulers bring the goods to the near station, so lay a road to it. Once it's built the cable goes across and the far station goes up. ` +
    'Haulers, Workers and warbots ride it as part of your road network; Freight Trucks, Road Trains and Crawlers are too heavy and keep to the roads.',
  maglev: () => `A Maglev line is an elevated guideway on pylons between two Maglev Terminals (Build → Move → Maglev Terminal, ${costText(BDEFS.magterm.cost)}), ${MAGLEV.min} to ${MAGLEV.max} tiles apart in any direction, straight across water, cliffs and chasms. Tap a finished Terminal of yours, then the far end: a clear spot where the far Terminal goes up, or another Terminal of yours. ` +
    `A pylon stands every ${MAGLEV.spacing} tiles, on open ground or in shallow water, or over a road or track with its feet at the side (the way stays open). A blocked spot shifts to a tile beside it. A chasm under one spot is spanned (a gap of up to ${MAGLEV.gap} tiles). The preview rings each spot: green a pylon, blue over a road, yellow shifted a tile, red blocked (the reason beside it); a far end on a road or building snaps to a good tile beside it, a line can bend at up to ${MAGLEV.bends} pylons (tap a spot on the way, then <b>Bend here</b>; each stretch ${MAGLEV.seg} to ${MAGLEV.max} tiles, ${MAGLEV.maxBent} in all, turning ${MAGLEV.turn}° at most), and where no straight line can go (or it's over ${MAGLEV.max} tiles) the tool offers <b>Route with a bend</b>, else a <b>Route via a hub</b>: two lines through a new Terminal on the way. Pods slow round sharp bends. It costs ${costText(magLineCost(1))} a tile (and the far Terminal its own cost when it's new), paid from storage as the goods come in; a Worker standing at the near Terminal builds it out, pylon by pylon, the far Terminal last. ` +
    `Order Maglev Pods on a Terminal's panel (4 Alloy, 2 Chips each, ${MAGLEV.perLine} to a line): ${BOTS.magpod.carry} goods a trip, several kinds, both ways, at three times a Freight Train's speed, with a Generator within ${BDEFS.generator.burner.radius} tiles of each Terminal (without, or in a solar flare, they crawl). Pylons can be shot down (a Wall's toughness): the line is cut until a Worker rides out and rebuilds it. A Terminal joins up to ${MAGLEV.hub} lines (a <b>hub</b>): tap one already on a line and the new line meets it there, and pods carry goods on through it without stopping (${MAGLEV.perLine} pods for each line of the network). Terminals of two lines side by side also pass freight by conveyor. If a Terminal falls, its lines stand broken until you rebuild it on the same tile (half a Terminal's cost from its panel; the guideway is free).`,
};

/**
 * Placing a Viaduct or Ropeway, a Paths tool: the Paths tools stay on show with it picked, How it works for it, and in
 * a mission the goal's hint (the goal list is hidden, as in Paths).
 */
function crossingTools() {
  const type = UI.placeType;
  $('banner-text').insertAdjacentHTML('beforeend', `<details class="how"${UI.howOpen === type ? ' open' : ''}><summary>How it works</summary><div class="how-text">${CROSSING_HOW[type]()}</div></details>`);
  const det = $('banner-text').querySelector('details.how');
  det.ontoggle = () => { UI.howOpen = det.open ? type : null; };
  pathsSeg(type);
  $('banner').classList.toggle('noplan', $('banner-ok').hidden);
  bannerMissionHint();
  toolFit();
}

function enterPlaceMode(type, moveFrom) {
  // (Viaducts and Ropeways are Paths tools: the Paths banner's place and look, Paths lit, and a plan sketched there kept.)
  const crossing = CROSSING_TOOLS.includes(type);
  closeSheet();
  setMode('place', crossing);
  UI.placeType = type;
  UI.moveFrom = moveFrom || 0;
  if (BDEFS[type] && BDEFS[type].long) { const f = moveFrom ? getE(moveFrom) : null; UI.mdAxis = (f && f.mdAxis) || UI.mdAxis || 'ew'; }
  if (BDEFS[type] && BDEFS[type].lift) UI.liftDir = liftDirOf(UI.liftDir);
  document.body.classList.toggle('mode-road', crossing);
  $('btn-road').classList.toggle('on', crossing);
  refreshOverlay(type);
  const have = playerGoods(ME);
  showBanner(type === 'maglev' ? `Tap one of your finished <b>Maglev Terminals</b> (highlighted) for the line's near end. Then tap the far end, ${MAGLEV.min} to ${MAGLEV.max} tiles away. ${costInline(magLineCost(1), have)} a tile, paid from storage as the goods come in.`
    : type === 'ropeway' ? `Tap a highlighted spot for the Ropeway's <b>near station</b>, where your roads are. Then tap the far end. ${costInline(BDEFS.ropeway.cost, have)}`
    : type === 'viaduct' ? `Tap a highlighted spot on a clifftop for the Viaduct's <b>near end</b>, where your roads are. Then tap the far end, across the valley. ${costInline(BDEFS.viaduct.cost, have)} a tile spanned, paid from storage as the goods come in.`
    : moveFrom ? `Tap a highlighted spot to move the <b>${BDEFS[type].name}</b> to. It's put together there for free (it takes its build time), and the old one keeps working until then.`
    : `Tap a highlighted spot to place ${/^[AEIOU]/i.test(BDEFS[type].name) ? 'an' : 'a'} <b>${BDEFS[type].name}</b>.`, null, 'Cancel');
  if (BDEFS[type] && BDEFS[type].long) mdTurnBanner();
  if (BDEFS[type] && BDEFS[type].lift) liftTurnBanner();
  if (type === 'maglev' && !R.overlay.valid.some((v) => v)) { showBanner(`<span class="err">No Maglev Terminal to start a line from: build one first (Build → Move → <b>Maglev Terminal</b>, <kbd>G</kbd>; ${costText(BDEFS.magterm.cost)}), finished, with a line to spare (a hub joins ${MAGLEV.hub}).</span>`, null, 'Close'); return; }
  if (!R.overlay.valid.some((v) => v)) {
    const near = BDEFS[type].gather ? ' near the right resource' : BDEFS[type].farm ? ' near fertile soil' : BDEFS[type].pump ? ' on an oil seep' : '';
    const how = DEFENCE_TYPES.has(type) ? `inside your border${near}. Defences only go on your own land: an Outpost or Keep extends it.` : `within ${BUILD_REACH} tiles of your buildings, roads or track${near}. Lay a road out toward where you want it.`;
    showBanner(`<span class="err">There is no valid spot for ${aOrAn(BDEFS[type].name)} ${how}</span>`, null, 'Close');
  }
}

/** Placing a Mass Driver: its two tiles lie east-west or north-south; the banner says which and offers Turn (R). */
function mdTurnBanner() {
  const t = $('banner-text');
  if (!t || t.querySelector('#md-turn')) return;
  t.insertAdjacentHTML('beforeend', ` <span class="md-turn">It is two tiles long, lying <b>${UI.mdAxis === 'ns' ? 'north-south' : 'east-west'}</b>: <button class="btn small" id="md-turn">Turn <kbd>R</kbd></button></span>`);
  $('md-turn').onclick = (e) => { e.stopPropagation(); mdTurn(); };
}

/** Turn the Mass Driver being placed: east-west ↔ north-south (the spots where it fits, and the ghost, follow). */
function mdTurn() {
  UI.mdAxis = UI.mdAxis === 'ns' ? 'ew' : 'ns';
  sfx('click');
  refreshOverlay(UI.placeType);
  if (R.ghost && BDEFS[R.ghost.type] && BDEFS[R.ghost.type].long) R.ghost.ok = !!R.overlay.valid[tIdx(R.ghost.x, R.ghost.y)];
  const s = document.querySelector('#banner-text .md-turn'); if (s) s.remove();
  mdTurnBanner();
}

/**
 * Placing an Orbital Lift: its fall line (drawn on the map from the ghost) points one of 8 ways; the banner says which and
 * offers Turn (R; Shift+R the other way). The spots where it fits follow the line.
 */
function liftTurnBanner() {
  const t = $('banner-text');
  if (!t || t.querySelector('#lift-turn')) return;
  t.insertAdjacentHTML('beforeend', ` <span class="lift-turn">If it is destroyed by an enemy its cable falls <b>${LIFT_DIR_NAMES[liftDirOf(UI.liftDir)]}</b>, ${liftLen()} tiles: <button class="btn small" id="lift-turn">Turn <kbd>R</kbd></button></span>`);
  $('lift-turn').onclick = (e) => { e.stopPropagation(); liftTurn(1); };
}
/** Turn the fall line of the Lift being placed an eighth round (k 1 clockwise, -1 back). */
function liftTurn(k) {
  UI.liftDir = (liftDirOf(UI.liftDir) + (k < 0 ? 7 : 1)) % 8;
  sfx('click');
  refreshOverlay(UI.placeType);
  if (R.ghost && BDEFS[R.ghost.type] && BDEFS[R.ghost.type].lift) R.ghost.ok = !!R.overlay.valid[tIdx(R.ghost.x, R.ghost.y)];
  const s = document.querySelector('#banner-text .lift-turn'); if (s) s.remove();
  liftTurnBanner();
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
  if (R.mode === 'terra') { tfConfirm(); return; }
  if (R.mode === 'aim') { fireAimed(); return; }
  if (R.mode === 'bppick') { if (UI.bpPick && UI.bpPick.size) bpSave([...UI.bpPick]); return; }
  if (R.mode === 'bpplace') { bpPlaceNow(); return; }
  if (R.mode === 'strike' && UI.strikeKind === 'napalm' && R.napalmAt) { sendNapalm(R.napalmAt.i, R.napalmAt.j); return; }
  if (R.mode === 'strike' && UI.pick) { strikePicked(getE(UI.pick), UI.pickDeck); return; }
  if (R.mode === 'scorch' && R.scorchAt) { sendScorch(R.scorchAt.i, R.scorchAt.j); return; }
  if (R.mode === 'bombard' && UI.pick) {
    const u = getE(UI.rocket), b = getE(UI.pick);
    if (!u || u.dead || !b || !rocketTarget(u, b)) { sfx('error'); UI.pick = 0; showBanner('<span class="err">That target is gone.</span> Tap an enemy building.', null, 'Cancel'); return; }
    act('bombard', [[u.id], b.id]);
    toast(`The Howitzer is off to shell the ${BDEFS[b.type].name}.`, 'info');
    sfx('order'); addFx('ring', b.x + 0.5, b.y + 0.5, { color: '#ff5a6e' });
    setMode('normal');
    return;
  }
  if (R.mode === 'agpick') { agPickDone(); return; }
  if (R.mode === 'land') { confirmLanding(); return; }
  if (R.mode === 'airdrop') { confirmAirdrop(); return; }
  if (R.mode === 'attack') { if (UI.armyCmd) { setMode('normal'); openArmySheet(); } else recallAllTap(); return; }
  if (R.mode === 'road') { commitDraft(); return; }
  if (R.mode === 'place' && UI.placeType === 'maglev' && UI.magEdit && UI.ropeA) {
    const A = UI.ropeA, E = R.ropeEnd, to = UI.magEdit.to;
    if (!E || !E.ok) return;
    act('magRebend', [A.id, to, UI.ropeBends.map((q) => q.slice())], (res) => {
      if (!res.ok) { sfx('error'); maglevEditShow(`<span class="err">${res.reason}</span>`); return; }
      sfx('place'); haptic('order');
      toast(res.id ? 'New bends planned: a Worker builds them from the Terminal; the line runs as it is until they\'re done.' : 'The line\'s bends are changed.', 'good');
      UI.magEdit = null;
      setMode('normal');
    });
    return;
  }
  if (R.mode === 'place' && UI.placeType === 'maglev') {
    const A = UI.ropeA, E = R.ropeEnd;
    if (!A || !E || !E.ok) return;
    act('magLine', E.via ? [A.id, E.i, E.j, E.via.i, E.via.j] : E.bends && E.bends.length ? [A.id, E.i, E.j, null, null, E.bends] : [A.id, E.i, E.j], (res) => {
      if (!res.ok) { sfx('error'); showBanner(`<span class="err">${res.reason}</span>`, null, 'Cancel'); return; }
      sfx('place'); haptic('order');
      addFx('ring', A.i + 0.5, A.j + 0.5, { color: PLAYER_COLORS[ME] });
      toast(E.via ? 'Maglev route planned via a hub: the first line goes up from the near Terminal, the second from the hub once it stands.' : E.rebuild ? 'The lost Terminal will be rebuilt: the guideway joins it again when it stands.' : 'Maglev line planned: a Worker builds it out from the near Terminal, paid from storage as the goods come in.', 'good');
      if (UI.planKept) { setMode('road'); showRoadBanner('Maglev line placed. Your plan is still here: tap Build for it.', true); } else setMode('normal');
    });
    return;
  }
  if (R.mode === 'place' && (UI.placeType === 'ropeway' || UI.placeType === 'viaduct')) {
    const A = UI.ropeA, E = R.ropeEnd, type = UI.placeType;
    if (!A || !E || !E.ok) return;
    act('link', [type, A.i, A.j, E.i, E.j], (res) => {
      if (!res.ok) { sfx('error'); showBanner(`<span class="err">${res.reason}</span>`, null, 'Cancel'); return; }
      sfx('place'); haptic('order');
      addFx('ring', A.i + 0.5, A.j + 0.5, { color: PLAYER_COLORS[ME] });
      // (Back to Paths when a plan sketched there is waiting for its Build, else to the map.)
      if (UI.planKept) { setMode('road'); showRoadBanner(`${BDEFS[type].name} placed. Your plan is still here: tap Build for it.`, true); } else setMode('normal');
    });
    return;
  }
  if (R.mode !== 'place' || !R.ghost || !R.ghost.ok) return;
  const { type, x, y } = R.ghost;
  const from = UI.moveFrom ? getE(UI.moveFrom) : null;
  const ax = BDEFS[type].long ? [UI.mdAxis || 'ew'] : BDEFS[type].lift ? [liftDirOf(UI.liftDir)] : []; // (a Mass Driver: which way its two tiles lie; an Orbital Lift: its fall line)
  act(from ? 'moveBuilding' : 'place', from ? [from.id, x, y, ...ax] : [type, x, y, ...ax], (res) => {
    if (!res.ok) { sfx('error'); showBanner(`<span class="err">${res.reason}</span>`, null, 'Cancel'); return; }
    if (from) toast(`Moving the ${BDEFS[type].name}: workers put it together here (no goods needed), and the old one keeps working until it's ready.`, 'good');
    else noteSiteUndo(res.id);
    UI.moveFrom = 0;
    sfx('place'); haptic('order');
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
  let at = inMap(i, j) && S.bAt[tIdx(i, j)] ? getE(S.bAt[tIdx(i, j)]) : null;
  if (!at) for (const b of S.buildings) {
    if (!b.dead && b.type === 'lander' && dist2(b.x + 0.5, b.y + 0.5, wx, wy) < 1.1) { at = b; break; }
  }
  // A tall one's upper floors and roof (its picture above its tiles): it, when it stands in front of what's on the tile.
  const up = wx === undefined ? null : buildingUpperAt(wx, wy);
  return up && (!at || bldSortY(up) > bldSortY(at)) ? up : at;
}

/** Where building b sorts among the robots and buildings as they're drawn (render.js's sortY): further down is in front. */
function bldSortY(b) { const F = BDEFS[b.type] && BDEFS[b.type].foot; return b.y + (F ? F - 0.5 : 0.5); }

/**
 * The building whose picture is drawn over map point (wx, wy) above its own tiles (a Keep's walls, a tower's top, a
 * Mooring Mast's cup): the solid pixels of its art as drawArt places it, over its tiles' width; the one in front where
 * several are. Null if none. (On its own tiles S.bAt answers; the megastructures drawn in code have their big squares.)
 */
const UPPER_HEADS = new Set(['turret', 'mortar', 'keep', 'flak', 'minigun', 'lance']);
function buildingUpperAt(wx, wy) {
  let best = null;
  for (const b of S.buildings) {
    if (b.dead || !b.built || wy >= b.y || wy < b.y - 3 || wx < b.x || wx > b.x + 4) continue;
    const d = BDEFS[b.type];
    if (!d || ['crawlerbase', 'wall', 'gate', 'magpylon', 'viaduct', 'ramp', 'city', 'lift', 'gup', 'sunder', 'deepcore', 'atmos'].includes(b.type)) continue; // (drawn in code, or low)
    const w = d.foot || (d.long && b.mdAxis !== 'ns' ? 2 : 1);
    if (wx >= b.x + w) continue;
    const art = artFor(b.type, b.owner);
    if (!art || !art.img) continue;
    // (and a turning head on top: a Keep's roof cannon, a turret's, a Flak Gun's barrels...)
    const head = UPPER_HEADS.has(b.type) && (b.type !== 'turret' || art.anchor) ? turretHead(b.owner, b.aim !== undefined ? b.aim : -Math.PI / 4, b.type) : null;
    const c = bCentre(b), on = (a) => {
      if (!a || !a.img) return false;
      const s = b.type === 'lander' && !a.scale ? 1.6 : 1, sz = s * (a.scale || 1);
      let x0 = c.x - sz / 2, y0 = c.y - sz / 2;
      if (Array.isArray(a.anchor)) { x0 = c.x - a.anchor[0] * sz; y0 = c.y - a.anchor[1] * sz; } else if (a.anchor === 'bottom') y0 += (s - sz) / 2;
      return artSolidAt(a.img, x0, y0, x0 + sz, y0 + sz, wx, wy);
    };
    if (!on(art) && !on(head)) continue;
    if (!best || bldSortY(b) > bldSortY(best)) best = b;
  }
  return best;
}

/**
 * A crossing under a tap that isn't on one of its ends: a Viaduct whose deck runs over the tile (its end nearer the
 * tap: viaductOver), or a Ropeway whose cable passes within half a tile (its station nearer the tap); or null. It's
 * picked after any building or robot there (it spans what's below it).
 */
function crossingAtTap(i, j, wx, wy) {
  const v = inMap(i, j) ? viaductOver(i, j) : null;
  if (v) return v;
  let best = null, bd = 0.25;
  for (const b of S.buildings) {
    if (b.dead || b.far || b.type !== 'ropeway' || !b.link) continue;
    const o = getE(b.link);
    if (!o || o.dead) continue;
    const ax = b.x + 0.5, ay = b.y + 0.5, dx = o.x - b.x, dy = o.y - b.y;
    const k = clamp(((wx - ax) * dx + (wy - ay) * dy) / (dx * dx + dy * dy || 1), 0, 1), d = dist2(ax + dx * k, ay + dy * k, wx, wy);
    if (d < bd) { bd = d; best = k > 0.5 ? o : b; }
  }
  return best;
}

function onMapTap(i, j, wx, wy) {
  if (!UI.inGame || uiFrozen()) return;
  // The first tap on the map folds the goal card away on a small screen (it has been read; the map is wanted now).
  if (!UI.objCollapsed && !UI.objManual && !S.mission && !isWide()) { UI.objCollapsed = true; UI.objAuto = true; UI.hudT = 0; }
  if (R.mode === 'scorch') { scorchTap(i, j); return; }
  if (R.mode === 'terra') { tfTap(i, j); return; } // (a Terraform plan: js/terraform.js)
  if (R.mode === 'bppick') { bpPickTap(i, j, wx, wy); return; } // (blueprints: js/blueprint.js)
  if (R.mode === 'bpplace') { bpPlaceTap(i, j); return; }
  if (UI.bpOffer) { UI.bpOffer = null; bpOfferShow(); }
  if (R.mode === 'strike') {
    const u = getE(UI.bomber);
    if (!u || u.dead) { setMode('normal'); return; }
    if (UI.strikeKind === 'napalm') { napalmTap(i, j); return; }
    const b = buildingAtTap(i, j, wx, wy);
    let t = b && foes(b.owner, ME) ? b : null, deck = null;
    if (!t) { let bd = 0.5; for (const v of S.bots) { if (v.dead || !foes(v.owner, ME) || v.inside || BOTS[v.type].air) continue; const d = dist2(v.x, v.y, wx, wy); if (d < bd) { bd = d; t = v; } } }
    // A Viaduct's deck: the bomb falls on the tile tapped and counts against the span. A Ropeway's cable: its nearer station.
    if (!t) { const c = crossingAtTap(i, j, wx, wy); if (c && foes(c.owner, ME)) { t = c; if (BDEFS[c.type].viaduct) deck = { i, j }; } }
    if (!t) { sfx('error'); strikeBanner('<span class="err">Tap an enemy building or Viaduct deck, or an enemy vehicle or robot out in the open (or switch to Napalm for any ground).</span>'); return; }
    // Under a finger the target is picked first (ringed on the map) and the banner's Strike sends the bomber; a mouse click sends it at once.
    if (!INPUT.mouse) {
      pickTarget(t, deck ? `Strike the deck of the ${playerName(t.owner)} <b>Viaduct</b>? The bomb falls where you tapped, and two bring the span down.`
        : `Strike ${BDEFS[t.type] ? `the ${playerName(t.owner)} <b>${BDEFS[t.type].name}</b>` : `this <b>${BOTS[t.type].name}</b>`}? The bomber loads up and takes off.`, 'Strike', deck);
      return;
    }
    strikePicked(t, deck);
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
    if (type === 'maglev') { maglevTap(i, j); return; }
    if (R.ghost && R.ghost.x === i && R.ghost.y === j && R.ghost.ok) { confirmBanner(); return; }
    const chk = canPlace(ME, type, i, j, false, type === 'mdriver' ? UI.mdAxis : BDEFS[type] && BDEFS[type].lift ? liftDirOf(UI.liftDir) : undefined);
    R.ghost = { type, x: i, y: j, ok: chk.ok };
    if (chk.ok) {
      let extra = '';
      const def = BDEFS[type];
      if (def.gather) {
        const un = type === 'mine' && nukeOn() ? reachableRes(i, j, def.radius, R_URANIUM) : 0;
        extra = ` <span class="ok">${reachableRes(i, j, def.radius, gatherRes(type))} ${RES[gatherRes(type)].name.toLowerCase()}s${un ? ` and <b>${un} uranium deposit${un > 1 ? 's' : ''}</b>` : ''} in reach.</span>`;
        if (def.bedrock) { const f = rockFacesIn(i, j, def.radius); extra += f ? ` <span class="ok">${f} rock face${f > 1 ? 's' : ''} to cut Stone from when they're gone.</span>` : ' With none left it digs Stone out of the ground, slowly.'; }
      }
      if (def.farm) extra = ` <span class="ok">${fertileIn(i, j, def.radius)} fertile tiles in reach.</span>`;
      if (def.pump) extra = ` <span class="ok">${oilAround(i, j)} Crude in this seep.</span>`;
      if (def.t2 && typeof t2PlaceText === 'function') extra = t2PlaceText(type, i, j); // (stage 2: js/terraform2.js)
      if (def.t3 && typeof t3PlaceText === 'function') extra = t3PlaceText(type, i, j); // (stage 3: js/terraform3.js)
      if (def.t4 && typeof t4PlaceText === 'function') extra = t4PlaceText(type, i, j); // (stage 4: js/terraform4.js)
      if (def.burner && !def.burner.heat) {
        let n = 0;
        for (const c of S.buildings) if (!c.dead && c.owner === ME && (BDEFS[c.type].work || BDEFS[c.type].t3pow) && dist2(c.x, c.y, i, j) <= def.burner.radius * def.burner.radius) n++;
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
          case 'lightDown': sfx('click'); showRoadBanner(`${r.lit === false ? 'Planned light called off' : 'Light taken down (its Alloy is back)'}. ${r.why}`, true); return;
          case 'overUp': sfx('place'); addFx('ring', i + 0.5, j + 0.5, { color: '#ffd166' }); showRoadBanner('Overpass built: both roads run straight through without stopping. Nobody turns here now: bots that need to turn use another junction.', true); return;
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
      if (S.road[t]) { if (!UI.draft) draftReset(); UI.draft.strokes.push([{ t, op: 'dir', from: S.road[t] }]); act('roadDir', [i, j, S.road[t] >= 5 ? (S.pave[t] === 3 ? 2 : 1) : S.road[t] + 1], () => showRoadBanner()); sfx('click'); } // (an Express lane stays one-way)
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
    if (UI.roadMode === 'express') {
      // Express: a tap on a sketched lane tile drops it; anywhere else, how to lay one.
      if (UI.draft.express.has(t)) { const stroke = []; draftOp(stroke, t, 'unxp'); if (UI.draft.addSet.has(t)) draftOp(stroke, t, 'unadd'); UI.draft.strokes.push(stroke); sfx('click'); showRoadBanner(); }
      else showRoadBanner('Drag to lay Express lanes: a drag lays a pair, out and back; Shift and drag (or Single lane) lays one.', true);
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
  if (R.mode === 'agpick') { agPickTap(i, j, wx, wy); return; } // (an Army Group's points or home)
  if (R.mode === 'land') { landTap(i, j); return; }
  if (R.mode === 'airdrop') { airdropTap(i, j); return; }
  if (R.mode === 'mastlink') { mastLinkTap(i, j, wx, wy); return; }
  if (R.mode === 'mdaim') { mdAimTap(i, j, wx, wy); return; }
  if (R.mode === 'focusaim') { focusAimTap(i, j, wx, wy); return; }
  if (R.mode === 'allyaim') { allyAimTap(i, j, wx, wy); return; } // (Attack here, Defend this area: js/ally.js)
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
  // What's drawn over the spot, upper floors and roofs included: a tall building (buildingAtTap) or one of Passenger
  // Town's (js/city.js), whichever is in front. A robot drawn in front of it comes first; one behind it only while the
  // building is faded to see-through (your robot behind it), as that's what shows.
  const tw = S.town && typeof townAtTap === 'function' ? townAtTap(wx, wy) : null;
  const town = tw && !(b && bldSortY(b) >= tw.foot) ? tw.r : null, bb = town ? null : b;
  const upper = bb && bb.type !== 'lander' && wy < bb.y ? bb : null; // (picked by its picture above its tiles)
  const overFoot = town ? tw.foot : upper ? bldSortY(upper) : -Infinity, seeThrough = !!town && townFade(town) > 0.5;
  const ahead = (u) => u.y >= overFoot || seeThrough;
  if (!INPUT.mouse && R.mode === 'normal') {
    const unit = unitAtTap(wx, wy);
    if (selBarShowing()) { if (unit && (!(town || upper) || ahead(unit))) touchSelect(unit); else touchOrder(i, j, wx, wy); return; }
    if (unit && !rally && (!bb || upper) && ahead(unit)) { closeSheet(); touchSelect(unit); return; }
  }
  // Everything under the tap: a rally flag, a building, then robots, nearest first. Tapping the same spot
  // again steps on to the next (a Crawler parked on a Foundry, a worker at a site, two warbots together). A building
  // picked by its upper floors, or the town's, comes after the robots in front of it and before those behind.
  const stack = tapStack(rally, upper ? null : bb, wx, wy);
  if (upper || town) {
    const behind = stack.filter((s) => s.kind === 'bot' && !ahead(s.e)), rest = stack.filter((s) => !behind.includes(s));
    stack.length = 0;
    stack.push(...rest, town ? { kind: 'town', e: town } : { kind: 'bld', e: upper }, ...behind);
  }
  // A Viaduct's deck or a Ropeway's cable over the spot comes last; past it, what's on the ground below (see the end).
  const cross = !b && !town ? crossingAtTap(i, j, wx, wy) : null;
  if (cross) stack.push({ kind: 'bld', e: cross, cross: true });
  const L0 = UI.lastTap, again = L0 && Math.hypot(L0.wx - wx, L0.wy - wy) < 0.7, t0 = inMap(i, j) ? tIdx(i, j) : -1;
  const below = t0 >= 0 && (postAt(t0) || uplinkAt(t0) || S.res[t0] || (S.fert[t0] && S.terrain[t0] === T_GROUND) || (S.road[t0] && wayOwner(t0) === 0));
  const pastCross = cross && again && below && UI.sheetKind === 'bld' && UI.sheetFor === cross.id;
  if (stack.length && !pastCross) {
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
    else if (s.kind === 'town') townSheet(s.e);
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
  if (inMap(i, j) && S.orb && orbTapped(i, j, wx, wy) >= 0) { sfx('click'); openBridgeSheet(orbTapped(i, j, wx, wy)); return; } // (a drawbridge or one of its control boxes: Orbital platforms)
  if (inMap(i, j) && typeof lmAt === 'function' && lmAt(tIdx(i, j))) { sfx('click'); lmSheet(lmAt(tIdx(i, j))); return; } // (a landmark: js/landmarks.js)
  if (inMap(i, j) && S.town && typeof townSheet === 'function' && townRuinAt(tIdx(i, j))) { sfx('click'); townSheet(townRuinAt(tIdx(i, j))); return; } // (a building of Passenger Town: js/city.js)
  if (inMap(i, j) && S.walker && typeof walkerSheet === 'function' && walkerAtTap(i, j, wx, wy)) { sfx('click'); walkerSheet(); return; } // (the Walking Factory: js/walker.js)
  if (inMap(i, j) && S.dam && typeof damSheet === 'function' && damAt(tIdx(i, j))) { sfx('click'); damSheet(S.dam.d.indexOf(damAt(tIdx(i, j)))); return; } // (a dam: js/dam.js)
  if (inMap(i, j) && S.res[tIdx(i, j)]) { sfx('click'); openResourceSheet(tIdx(i, j)); return; }
  if (inMap(i, j) && S.fert[tIdx(i, j)] && S.terrain[tIdx(i, j)] === T_GROUND) { sfx('click'); openSoilSheet(tIdx(i, j)); return; }
  if (inMap(i, j) && burntSoil(tIdx(i, j)) && S.terrain[tIdx(i, j)] === T_GROUND && !S.road[tIdx(i, j)]) { sfx('click'); openBurntSheet(tIdx(i, j)); return; }
  if (inMap(i, j) && S.road[tIdx(i, j)] && wayOwner(tIdx(i, j)) === 0) { sfx('click'); openRoadSheet(tIdx(i, j)); return; }
  closeSheet();
}

/** With a mouse, placing a building previews it under the pointer; a click then places it. */
function onMapHover(i, j) {
  UI.hoverTile = inMap(i, j) ? tIdx(i, j) : -1;
  if (R.mode === 'road' && routeOn()) { routeHover(i, j); return; }
  if (R.mode === 'bpplace') { bpHover(i, j); return; }
  if (R.mode === 'aim' || R.mode === 'land' || R.mode === 'airdrop' || R.mode === 'strike' || R.mode === 'scorch' || R.mode === 'mastlink' || R.mode === 'mdaim' || R.mode === 'allyaim' || R.mode === 'focusaim') { R.aimHover = inMap(i, j) ? { i, j } : null; return; }
  if (R.mode === 'place' && UI.placeType === 'maglev') { if (UI.ropeA && !(R.ropeEnd && R.ropeEnd.tapped) && inMap(i, j)) maglevPreview(i, j, false); return; } // (the line to the pointer, its pylon spots ringed)
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
    if (u.dead || u.inside || (u.under && !murmurInSight(u))) continue; // (nor a Sapper underground out of the colony's sight)
    const bt = BOTS[u.type], r2 = bt.airship ? 1.1 : bt.crawler || bt.siege || bt.truck || bt.rail || bt.magpod ? 0.6 : 0.3; // (an Airship is big)
    const d = dist2(u.x, u.y - (bt.magpod ? MAGLEV.head : 0), wx, wy); // (a Maglev pod rides at deck height)
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
function draftReset() { UI.draft = { add: [], addSet: new Set(), del: new Set(), ramps: new Set(), railRamps: new Set(), walls: new Map(), rail: new Set(), railDel: new Set(), pipe: new Set(), pipeDel: new Set(), express: new Map(), strokes: [] }; }
function draftEmpty() { return !UI.draft || (!UI.draft.add.length && !UI.draft.del.size && !UI.draft.ramps.size && !UI.draft.walls.size && !UI.draft.rail.size && !UI.draft.railDel.size && !UI.draft.pipe.size && !UI.draft.pipeDel.size && !UI.draft.express.size); }

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
  else if (op === 'unxp') { if (!d.express.has(t)) return; stroke.push({ t, op, v: d.express.get(t) }); d.express.delete(t); return; }
  stroke.push({ t, op });
}

/** Sketch an Express lane on tile t pointing v (2 east, 3 south, 4 west, 5 north), remembering it for Undo. */
function draftLane(stroke, t, v) {
  const d = UI.draft, had = d.express.get(t);
  if (had === v) return;
  d.express.set(t, v);
  stroke.push({ t, op: 'xp', v, from: had });
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
    if (s[k].op === 'xp') { if (s[k].from) d.express.set(s[k].t, s[k].from); else d.express.delete(s[k].t); continue; }
    if (s[k].op === 'unxp') { d.express.set(s[k].t, s[k].v); continue; }
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
  // Express lanes: where an ordinary road crosses one, an overpass (paid from storage once the lane is down).
  const over = draftOverpasses();
  for (const g in OVERPASS_COST) if (over) cost[g] = (cost[g] || 0) + OVERPASS_COST[g] * over;
  const net = {};
  for (const g in cost) net[g] = Math.max(0, cost[g] - (back[g] || 0));
  // Anything you can't pay for yet waits for the goods (settlePlans): the plan can always be built.
  for (const g in net) net[g] = Math.round(net[g] * 100) / 100;
  return { add, cross, clear, del: d.del.size, ramps: d.ramps.size, walls, gates, rail: d.rail.size, railDel: d.railDel.size, pipe: d.pipe.size, pipeDel: d.pipeDel.size, express: d.express.size, over, cost, back, net, can: true,
    short: Object.keys(net).filter((g) => net[g] > 0 && !canAffordRoad(ME, { [g]: net[g] })) };
}

/**
 * The overpasses this plan brings: Express lane tiles (sketched, or already there and marked) that an ordinary road
 * will cross once the plan is down (road, sketched or planned, on both sides across the lane), none there yet.
 */
function draftOverpasses() {
  const d = UI.draft, W = S.W, seen = new Set();
  const roadish = (u) => u >= 0 && u < W * S.H && (S.road[u] || S.plan[u] || d.addSet.has(u));
  const laneAt = (u) => d.express.has(u) ? d.express.get(u) : S.road[u] && S.paveMark[u] === 2 && S.road[u] >= 2 ? S.road[u] : 0;
  const look = (L) => {
    const v = laneAt(L);
    if (!v || seen.has(L) || S.over[L] || junPlanAt(L) || !S.road[L] && !d.addSet.has(L)) return;
    const i = L % W, ew = v === 2 || v === 4;
    const a = ew ? L - W : i > 0 ? L - 1 : -1, b = ew ? L + W : i < W - 1 ? L + 1 : -1;
    const across = (u) => roadish(u) && !laneAt(u);
    if (across(a) && across(b)) seen.add(L);
  };
  for (const [t] of d.express) look(t);
  for (const t of d.add) { const i = t % W; for (const u of [t - W, t + W, i > 0 ? t - 1 : -1, i < W - 1 ? t + 1 : -1]) if (u >= 0 && u < W * S.H) look(u); }
  return seen.size;
}

/** Build the plan: take up the marked roads (their goods come back first), then plan the new tiles for workers to pave. */
function commitDraft() {
  if (draftEmpty()) return;
  const d = UI.draft;
  // The whole plan goes as one order (ORDERS.paths): take up, then Ramps first (so the road or track planned over one
  // waits for it), Walls and Gates, road, track and pipe; it's paid for from storage as far as it goes, oldest plans first.
  const plan = { del: [...d.del], railDel: [...d.railDel], ramps: [...d.ramps], walls: [...d.walls], add: [...d.add], rail: [...d.rail], pipeDel: [...d.pipeDel], pipe: [...d.pipe], express: [...d.express] };
  draftReset();
  act('paths', [plan], (r) => draftDone(r));
}

/** What the plan made in Paths came to (ORDERS.paths' counts): the messages, and back to the map if it all went down. */
function draftDone(r) {
  const { removed, laid, ramps, walls, gates, why, wallWhy, rampWhy, rails, railsUp, railWhy, pipes, pipesUp, lanes } = r;
  const wp = plansWaiting(ME), owedN = wp.tiles + wp.track + wp.pipes + wp.sites;
  // Built: Paths closes, straight back to the map (unless something went wrong, to fix it).
  if (!why && R.mode === 'road') setMode('normal');
  const wallText = walls || gates ? ` ${[walls ? `${walls} Wall${walls === 1 ? '' : 's'}` : '', gates ? `${gates} Gate${gates === 1 ? '' : 's'}` : ''].filter(Boolean).join(' and ')} planned: free workers will build ${walls + gates === 1 ? 'it' : 'them'}.` : '';
  if (why) { sfx('error'); toast(`Planned ${laid} tile${laid === 1 ? '' : 's'} before running short: ${why}`, 'warn'); }
  else { sfx('place'); haptic('order'); toast((laid ? `Planned ${laid} road tile${laid === 1 ? '' : 's'}: free workers will pave them.` : '') + (lanes ? ` ${lanes} Express lane tile${lanes === 1 ? '' : 's'} marked: a Roadworks' Paver lays the surface (1 Asphalt and a quarter Alloy a tile).` : '') + (ramps ? ` ${ramps} Ramp site${ramps === 1 ? '' : 's'} started.` : '') + wallText + (removed ? ` Took up ${removed} tile${removed === 1 ? '' : 's'}.` : ''), 'info'); }
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
  if (R.mode === 'terra') { tfPaint(i, j, first); return; } // (a Terraform plan's drag: js/terraform.js)
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
  if (UI.roadMode === 'express') { expressDrag(i, j, first); return; }
  if (routeOn()) { routeDrag(i, j, first); return; }
  // Pave: the first road tile of a drag decides whether it marks roads or clears their marks.
  if (UI.roadMode === 'pave' && first) UI.paveOn = !(inMap(i, j) && S.paveMark[tIdx(i, j)]);
  paintTiles(line);
  UI.lastPaint = { i, j };
  paintBanner();
}

/**
 * The Express tool's drag: the whole drag so far (UI.xpath) is laid again as lanes each time the finger moves, so a
 * pair's corners come out right (expressLanes). A drag lays a pair (the dragged tiles go the drag's way, the lane on
 * their left comes back); with Shift held when it starts, or Single lane on in the banner, one lane. Each lane tile is
 * a road tile planned as usual (Cement) where there is none, or one of your roads upgraded in place.
 */
function expressDrag(i, j, first) {
  if (first) { UI.xpath = []; UI.xSingleDrag = !!UI.xSingle || !!(INPUT.gesture && INPUT.gesture.shift); }
  if (!inMap(i, j)) return;
  const path = UI.xpath, from = path.length ? path[path.length - 1] : null;
  const line = from ? tileLine(from % S.W, (from / S.W) | 0, i, j) : [[i, j]];
  for (const [x, y] of line) { if (!inMap(x, y)) break; const t = tIdx(x, y); if (path[path.length - 1] !== t) path.push(t); }
  // Lay the stroke afresh: take back what it sketched, then sketch the lanes of the drag so far.
  const back = { add: 'unadd', unadd: 'add' };
  for (let k = UI.stroke.length - 1; k >= 0; k--) { const o = UI.stroke[k]; if (o.op === 'xp') { if (o.from) UI.draft.express.set(o.t, o.from); else UI.draft.express.delete(o.t); } else if (o.op === 'unxp') UI.draft.express.set(o.t, o.v); else draftOp([], o.t, back[o.op]); }
  UI.stroke.length = 0;
  paintFlagsReset(); UI.paintLanes = 0; UI.paintCrossLane = false;
  for (const [t, v] of expressLanes(path, UI.xSingleDrag)) {
    const x = t % S.W, y = (t / S.W) | 0;
    if (UI.draft.express.has(t) || UI.draft.ramps.has(t) || (S.bAt[t] && !pylonAt(t))) continue; // (a lane runs under a Maglev pylon, as a road does)
    if (S.road[t]) {
      if (!roadOwnedBy(ME, t)) { UI.paintSkipped = true; continue; }
      if (S.paveMark[t] === 2 && S.road[t] >= 2 && S.road[t] % 2 !== v % 2) { UI.paintCrossLane = true; continue; } // lanes never cross each other
    } else if (S.plan[t]) {
      if (S.plan[t] !== ME + 1) { UI.paintSkipped = true; continue; }
      if (S.xdir[t] && S.xdir[t] % 2 !== v % 2) { UI.paintCrossLane = true; continue; } // (nor across a lane only planned)
    } else if (S.res[t]) { UI.paintSkipped = true; continue; }
    else if (canRoad(ME, x, y) || draftBridge(t)) { draftOp(UI.stroke, t, 'add'); if (crossTile(t)) { if (bridgeable(t)) UI.paintBridge = true; else UI.paintTunnel = true; } }
    else { if (crossTile(t)) UI.paintCross = true; else UI.paintSkipped = true; continue; }
    draftLane(UI.stroke, t, v);
    UI.paintLanes++;
  }
  UI.lastPaint = { i, j };
  paintBanner();
}

/**
 * The lane tiles of an Express drag along `path` (tile indices, each next to the one before): [tile, direction] for the
 * dragged tiles (each pointing at the next; the last the way before it) and, unless `single`, the lane back: the tiles
 * on the drag's left (so the dragged lane is on the right of the pair, as bots drive on the right), going the other way;
 * at a corner the outer lane fills the 2 x 2 bend. A drag of one tile lays nothing.
 */
function expressLanes(path, single) {
  const W = S.W, N = W * S.H, out = [];
  if (path.length < 2) return out;
  const dirOf = (a, b) => { const d = b - a; return d === 1 ? 2 : d === W ? 3 : d === -1 ? 4 : d === -W ? 5 : 0; };
  const dirs = [];
  for (let k = 0; k < path.length - 1; k++) dirs.push(dirOf(path[k], path[k + 1]) || (k ? dirs[k - 1] : 2));
  dirs.push(dirs[dirs.length - 1]);
  for (let k = 0; k < path.length; k++) out.push([path[k], dirs[k]]);
  if (single) return out;
  // The left-hand lane: each dragged tile shifted to the left of the way in and the way out (and both, round a corner).
  const inPath = new Set(path), left = (v) => (v === 2 ? -W : v === 3 ? 1 : v === 4 ? W : -1); // (east: north; south: east; west: south; north: west)
  const ret = [], seen = new Set();
  const push = (t, a) => { if (t < 0 || t >= N || inPath.has(t) || seen.has(t) || Math.abs((t % W) - (a % W)) > 1) return; seen.add(t); ret.push(t); };
  for (let k = 0; k < path.length; k++) {
    const t = path[k], vin = k ? dirs[k - 1] : dirs[k], vout = dirs[k];
    push(t + left(vin), t);
    if (vin !== vout) { push(t + left(vin) + left(vout), t); push(t + left(vout), t); }
  }
  // Going back: each tile points at the one before it in the sequence (the first, on as the second does).
  const flip = (v) => ((v - 2 + 2) % 4) + 2;
  for (let k = 0; k < ret.length; k++) {
    const v = k ? dirOf(ret[k], ret[k - 1]) : ret.length > 1 ? dirOf(ret[1], ret[0]) : 0;
    out.push([ret[k], v || flip(dirs[Math.min(k, dirs.length - 1)])]);
  }
  return out;
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
  if (UI.roadMode === 'express') {
    const n = UI.xpath ? UI.xpath.length : 0;
    showRoadBanner(lead + [n && n < EXPRESS.minLen ? `Only ${n} tile${n === 1 ? '' : 's'} long: too short to pay (trucks gain under a second on less than ${EXPRESS.minLen}), but you can lay it.` : '',
      UI.paintCrossLane ? 'Lanes never cross each other: the drag skipped another lane.' : '',
      UI.paintSkipped ? 'The drag skipped tiles it can\'t lay on: resources, a rival\'s roads or ground, or planned road that isn\'t yours.' : '',
      UI.paintBridge || UI.paintTunnel ? 'Over water or rock a lane is a bridge or tunnel first (their usual cost), surfaced once it\'s built.' : ''].filter(Boolean).join(' '), true);
    return;
  }
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

/** Every Oil Pump of yours that isn't piped to a Refinery or Fuel Tank yet gets a pipe to the nearest one, in the plan. */
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
  const mode = ['arrows', 'lights', 'bridge', 'ramp', 'pave', 'wall', 'rail', 'pipe', 'express'].includes(UI.roadMode) ? UI.roadMode : 'road';
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
  } else if (mode === 'express' && draftEmpty()) {
    let works = 0;
    for (const b of S.buildings) if (!b.dead && b.owner === ME && b.type === 'roadworks') works++;
    line = `<b>Drag</b> to lay a <b>pair of Express lanes</b>, one out (the way you drag) and one back beside it; ${INPUT.mouse ? '<kbd>Shift</kbd> and drag, or ' : ''}<b>Single lane</b>, lays one. Over your own roads it upgrades them in place; elsewhere the base is a road (${costText(roadCost())} a tile). <button class="btn${UI.xSingle ? ' on' : ''}" id="x-single">Single lane${UI.xSingle ? ': on' : ''}</button>` +
      (works ? '' : ' <span class="err">Build a Roadworks: its Paver lays the surface.</span>');
    how = expressHow();
  } else if (mode === 'arrows') {
    line = 'Drag along a road to make it <b>one-way</b> the way you drag (a drag that starts off your roads moves the map). Tap a road to turn its arrow. <b>Undo</b> puts arrows back.';
    how = 'One-way traffic never meets head-on, so a loop of one-way roads (one lane out, one back) keeps busy routes flowing.';
  } else if (mode === 'lights') {
    let lights = 0, junctions = 0, overs = 0;
    for (const k in S.lights) if (S.lights[k].owner === ME) lights++;
    for (const k in S.over) if (S.over[k].owner === ME) overs++;
    const net = roadNet();
    for (let t = 0; t < S.W * S.H; t++) if (net.junc[t] && wayOwner(t) === ME) junctions++;
    line = `Tap a <b>junction</b> for a traffic light (${costText(LIGHT_COST)}), tap the light for an <b>overpass</b> (${costText(OVERPASS_COST)}, only where four roads cross), tap again to clear it.`;
    const jp = plansWaiting(ME).junctions;
    how = `A light lets one direction through at a time: it pays where two busy roads cross (50 to 85% more goods through), and costs a little on a quiet crossing. An overpass lifts one road over the other: both run straight through without stopping, but <b>nobody turns there</b>, so bots that need to turn go round by another junction. Best on a jammed crossing of two through roads (more than twice the goods through); a T-junction takes only a light. Short of Alloy? Tap anyway: the light or overpass is planned (a dashed orange marker) and goes up once it's paid for from storage, oldest plans first${jp ? ` (<b>${jp}</b> waiting now)` : ''}. You have ${lights} light${lights === 1 ? '' : 's'}, ${overs} overpass${overs === 1 ? '' : 'es'} and ${junctions} junction${junctions === 1 ? '' : 's'}.`;
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
      if (sm.express) parts.push(`<b>${sm.express}</b> Express lane tile${sm.express === 1 ? '' : 's'} (${UI.xSingleDrag ? 'a single lane' : 'a pair'}; the surface, ${costText(PAVE[3].cost)} a tile, is laid by your Roadworks)`);
      if (sm.over) parts.push(`<b>${sm.over}</b> overpass${sm.over === 1 ? '' : 'es'} where a road crosses a lane`);
      const cost = Object.keys(sm.net).length && Object.values(sm.net).some((v) => v > 0) ? `costs <b>${costText(sm.net)}</b>` : 'costs nothing';
      line = `Plan: ${parts.join(', ')}; ${cost}` + (!sm.short.length ? '.' : `. <span class="ok">Short of ${sm.short.map((g) => GOOD[g].name).join(' and ')} for now: what you can't pay for waits and is paid from storage as the goods come in, oldest plans first.</span>`);
    }
    const waiting = planList(ME).length, wp = plansWaiting(ME), owedN = wp.tiles + wp.track + wp.pipes + wp.sites;
    const owedText = owedN ? ` <b>Waiting for goods now:</b> ${[wp.tiles ? `${wp.tiles} road tile${wp.tiles === 1 ? '' : 's'}` : '', wp.track ? `${wp.track} of track` : '', wp.pipes ? `${wp.pipes} of pipe` : '', wp.sites ? `${wp.sites} site${wp.sites === 1 ? '' : 's'}` : ''].filter(Boolean).join(', ')} (${costText(wp.owed)} to go).` : '';
    if (mode === 'pipe') how = pipeHow + owedText;
    else if (mode === 'express') how = expressHow() + owedText;
    else if (mode === 'wall') how = 'Walls and Gates are paid straight from storage, no Hauler needed: what you have now goes in when you tap Build, the rest as the goods come in (oldest plans first), and free workers put each piece up as far as its goods go. Enemy warbots have to go round or shoot through; your bots pass your Gates.' + owedText;
    else if (mode === 'rail') how = 'Track you can pay for goes down when you tap Build; the rest goes down as the goods come in (oldest plans first). Where the track climbs a one-level cliff, a Ramp is planned for it (paid from storage, no road needed) and the track on it goes down once workers finish the Ramp. Rail Stations stand beside the track (build them first if you like, and drag from one to the other); Freight Trains run between stations on the same stretch of track.' + owedText;
    else how = `<b>Haulers only drive on roads</b>, so every building needs a road to storage. 1 Cement paves ${Math.round(1 / roadCost().cement)} tiles (${ROAD_CLEAR}× through resources); you have ${have.cement || 0} Cement` +
      (mode === 'bridge' ? ` and ${have.alloy || 0} Alloy. Workers build bridges and tunnels out from the shore or rock face, and they join land on any level.` : `. Drag a road out over water and it carries on as a bridge (${costText(CROSS[T_WATER].cost)} a tile), and through rock as a tunnel (${costText(CROSS[T_ROCK].cost)}).`) +
      ` After you tap Build, free Workers pave the road a tile at a time${waiting ? ` (<b>${waiting}</b> tile${waiting === 1 ? '' : 's'} waiting now)` : ''}: no more than your <b>Road crew</b> at once (${roadCrew(ME) || 'no limit'}), so the rest stay free for building, and a Worker on the road leaves it for a construction site nearby that needs a builder. A Roadworks' two <b>Pavers</b> lay road too, twice as fast, before they lay asphalt, and don't count. A long road grows from both ends where its far end touches your roads or a finished building. Short of Cement or Alloy? Plan it anyway: tiles you can't pay for yet wait (an orange outline) and are paid from storage as the goods come in, oldest plans first.` + owedText;
  }
  // (The line is cut to three lines where the banner is docked across the bottom of a phone: what went wrong, or
  // what a tap just did, leads. How it works opens over the map there, and stays open while you read it.)
  const text = `<span class="rb-line">${problem ? `<span class="${info ? 'ok' : 'err'}">${problem}</span> ` : ''}${line}</span>` +
    (mode === 'road' || mode === 'bridge' ? roadCrewRow() : '') +
    `<details class="how"${UI.howOpen === mode ? ' open' : ''}><summary>How it works</summary><div class="how-text">${how}</div></details>`;
  showBanner(text, null, 'Done');
  const det = $('banner-text').querySelector('details.how');
  det.ontoggle = () => { UI.howOpen = det.open ? mode : null; };
  if (UI.howOpen !== mode) UI.howOpen = null;
  pathsSeg(mode);
  // Undo, Clear and Build for a plan.
  const drafting = !draftEmpty(), turned = UI.draft.strokes.some((st) => st.some((o) => o.op === 'dir'));
  $('banner').classList.toggle('noplan', !drafting); // (a phone gives the plan's buttons a row only when there's a plan: Undo alone, for arrows, fits the tools' row)
  $('banner-undo').hidden = !drafting && !turned;
  $('banner-clear').hidden = !drafting;
  $('banner-ok').hidden = !drafting;
  if (drafting) {
    const sm = draftSummary();
    const wl = sm.walls + sm.gates;
    $('banner-ok').textContent = sm.add ? `Build ${sm.add} tile${sm.add === 1 ? '' : 's'}` + (sm.ramps ? ` + ${sm.ramps} Ramp${sm.ramps === 1 ? '' : 's'}` : '') + (wl ? ` + ${wl} wall` : '')
      : sm.ramps ? `Build ${sm.ramps} Ramp${sm.ramps === 1 ? '' : 's'}` + (wl ? ` + ${wl} wall` : '')
      : wl ? `Build ${sm.walls ? `${sm.walls} Wall${sm.walls === 1 ? '' : 's'}` : ''}${sm.walls && sm.gates ? ' + ' : ''}${sm.gates ? `${sm.gates} Gate${sm.gates === 1 ? '' : 's'}` : ''}`
      : sm.rail ? `Build ${sm.rail} track tile${sm.rail === 1 ? '' : 's'}` : sm.pipe ? `Lay ${sm.pipe} pipe tile${sm.pipe === 1 ? '' : 's'}` : sm.express ? `Lay ${sm.express} lane tile${sm.express === 1 ? '' : 's'}` : 'Take up';
    if (sm.express && sm.add) $('banner-ok').textContent = `Lay ${sm.express} lane tile${sm.express === 1 ? '' : 's'}`;
    $('banner-ok').disabled = !sm.can;
    $('banner-clear').onclick = () => { draftReset(); sfx('click'); showRoadBanner(); };
  }
  $('banner-undo').onclick = () => { draftUndo(); sfx('click'); showRoadBanner(); };
  if ($('pipe-all')) $('pipe-all').onclick = (e) => { e.stopPropagation(); pipeAllPumps(); };
  for (const btn of $('banner-text').querySelectorAll('#road-crew [data-v]')) btn.onclick = (e) => { e.stopPropagation(); setRoadCrew(+btn.dataset.v); };
  if ($('x-single')) $('x-single').onclick = (e) => { e.stopPropagation(); UI.xSingle = !UI.xSingle; sfx('click'); showRoadBanner(); };
  const tb = $('banner-traffic');
  tb.hidden = false;
  tb.classList.toggle('on', !!R.traffic);
  tb.onclick = () => { setRoadMap(R.traffic ? '' : 'traffic'); sfx('click'); showRoadBanner(); };
  const gb = $('banner-goods');
  gb.hidden = false;
  gb.classList.toggle('on', !!R.goodsMap);
  gb.onclick = () => { setRoadMap(R.goodsMap ? '' : 'goods'); sfx('click'); showRoadBanner(); };
  // Route to: on Roads, Bridges and Rail.
  const rb = $('banner-route');
  rb.hidden = !['road', 'bridge', 'rail'].includes(mode);
  rb.classList.toggle('on', routeOn());
  // (UI.roadMode = mode: in a new game no tool has been picked yet, and Route to stayed off however often it was tapped)
  rb.onclick = () => { UI.roadMode = mode; UI.route = !UI.route; UI.routeGhost = null; UI.routePrev = null; sfx('click'); showRoadBanner(); };
  if (R.traffic) $('banner-text').insertAdjacentHTML('beforeend', ` <span class="traffic-key">${trafficSummary()}</span>`);
  if (R.goodsMap) { UI.flowKey = goodsFlowKey(); $('banner-text').insertAdjacentHTML('beforeend', ` <span class="traffic-key flow-key">${UI.flowKey}</span>`); }
  bannerMissionHint();
  toolFit();
}

/**
 * The Roads and Bridges tools' road crew row: at most this many Workers lay planned road at once (ROAD_CREWS: 2, 3, 5 or
 * no limit; ORDERS.roadCrew), and the Pavers a Roadworks adds, who don't count.
 */
function roadCrewRow() {
  const v = roadCrew(ME), pavers = S.bots.filter((u) => !u.dead && u.owner === ME && u.type === 'paver' && u.task && u.task.type === 'staff').length;
  return `<span class="keep-all road-crew" id="road-crew">Road crew <span class="seg">${ROAD_CREWS.map((n) => `<button data-v="${n}" class="${n === v ? 'on' : ''}">${n || 'No limit'}</button>`).join('')}</span>` +
    `Workers at once${pavers ? `, plus ${pavers} Paver${pavers === 1 ? '' : 's'}` : ''}</span>`;
}
/** Set the road crew limit (see roadCrewRow). */
function setRoadCrew(v) {
  act('roadCrew', [v]);
  sfx('click');
  toast(v ? `At most ${v} Workers lay planned road at once now; the rest stay free for building. A Roadworks' Pavers lay road too.`
    : 'No limit: every free Worker lays planned road.', 'info');
  showRoadBanner();
}

/** How Express lanes work: the Express tool's How it works. */
function expressHow() {
  return `An <b>Express lane</b> is a road tier above asphalt: a one-way motorway lane a tile wide. <b>Freight Trucks and Tankers</b> run on it at ${EXPRESS.truck}× (asphalt: ${PAVE[2].speed}×), <b>Road Trains</b> at ${EXPRESS.train}×, warbots at asphalt speed; <b>Haulers</b>, Workers, Agribots and Crawlers never drive along one (they cross at an overpass), so keep an ordinary road for them. ` +
    `Workers lay the base as a road; then a <b>Roadworks</b>' Paver lays the surface, nearest first, for ${costText(PAVE[3].cost)} a tile from its stock (Alloy only when it first goes up). A lane wears like asphalt (resurfaced at half worn, marked as it is); worn through it drops to asphalt and its lights go out. ` +
    `Where an ordinary road touches a lane's side it's a <b>ramp</b> (a junction: bots give way); where a lane ends on a road, an end. An ordinary road <b>crosses</b> a lane only on an <b>overpass</b> (${costText(OVERPASS_COST)}, planned for you), and lanes never cross each other. Bends are 90°. Under ${EXPRESS.minLen} tiles a lane barely pays: trucks keep their acceleration.`;
}

/** Paths' maps over the roads, one at a time: 'traffic' (the Traffic map), 'goods' (the Goods flow map) or '' (neither). */
function setRoadMap(m) {
  R.traffic = m === 'traffic';
  R.goodsMap = m === 'goods';
}

/**
 * The Goods flow map's key (in the Paths banner, kept up to date while it's on): the goods on the move, most first,
 * in their colours; what the widths mean; and the marks for a factory waiting for a good and a jam.
 */
function goodsFlowKey() {
  const F = R.gf, list = [];
  if (F && F.of === S) GOODS.forEach((g, k) => { if (F.byGood[k] >= 1) list.push([g, F.byGood[k]]); });
  list.sort((a, c) => c[1] - a[1]);
  let starved = 0;
  for (const b of S.buildings) if (b.owner === ME && flowStarved(b)) starved++;
  const goods = list.length ? list.slice(0, 6).map(([g]) => `<span class="fk-g"><i class="gi ${g}"></i>${GOOD[g].name}</span>`).join(' ') : 'nothing carried on your roads yet';
  return `<b>Goods flow</b>, last minute: ${goods}. The wider, the more (widest: ${GFLOW_STEPS[3]}+ a minute). ` +
    `<i class="fk-ring"></i>waiting for that good (${starved}), <i class="fk-jam"></i>a jam.`;
}

/** Once a second while the Goods flow map is on: its key in the banner, if it has changed. */
function refreshFlowKey() {
  if (!R.goodsMap || R.mode !== 'road') return;
  const el = $('banner-text').querySelector('.flow-key');
  if (!el) return;
  const html = goodsFlowKey();
  if (html !== UI.flowKey) { UI.flowKey = html; el.innerHTML = html; }
}

/**
 * The Paths tools row (#banner-seg) on show, with `mode` picked (Walls only with war on); each button opens its tool.
 * On an upright phone the row is put away behind one button, Tool: Roads ▾ (#banner-tool), that opens all the tools at
 * once as a grid over the map (toolPicker; style.css): picking one closes it.
 */
function pathsSeg(mode) {
  $('banner-seg').hidden = false;
  let name = '';
  for (const btn of $('banner-seg').children) {
    btn.classList.toggle('on', btn.dataset.v === mode);
    if (btn.dataset.v === mode) name = btn.firstChild.textContent;
    if (btn.dataset.v === 'wall') btn.hidden = !warOn();
    btn.onclick = () => { UI.toolPick = false; openPaths(btn.dataset.v); };
  }
  const tb = $('banner-tool');
  tb.hidden = false;
  tb.querySelector('.bt-v').textContent = name;
  tb.setAttribute('aria-label', `Tool: ${name}. Pick another`);
  tb.onclick = () => { sfx('click'); toolPicker(!UI.toolPick); };
  toolPicker(UI.toolPick);
  // The tools are one row to swipe along on a phone: the one in use is brought into view when it changes.
  if (UI.segShown !== mode) { UI.segShown = mode; const on = $('banner-seg').querySelector('.on'); if (on && on.scrollIntoView) on.scrollIntoView({ block: 'nearest', inline: 'center' }); }
  // Where it runs on past the edge, that edge fades out (style.css: .more-l, .more-r), so the tools out of sight show.
  const seg = $('banner-seg');
  if (!seg.onscroll) { seg.onscroll = () => segEdges(seg); window.addEventListener('resize', () => { segEdges(seg); toolFit(); }); }
  segEdges(seg);
  requestAnimationFrame(() => segEdges(seg)); // (once the scroll to the tool in use has landed)
}
/**
 * The Paths tools picker (an upright phone's Tool button) open or shut. Open, How it works is put away (they'd take
 * the same place over the map). A tap anywhere else shuts it, and one on the map does nothing else (initUI).
 */
function toolPicker(open) {
  UI.toolPick = !!open;
  $('banner').classList.toggle('picking', UI.toolPick);
  $('banner-tool').setAttribute('aria-expanded', UI.toolPick ? 'true' : 'false');
  const how = UI.toolPick && $('banner-text').querySelector('details.how');
  if (how && how.open) how.open = false;
}
/**
 * The Tool button says "Tool:" only where that leaves room for the whole name of the tool (not beside Route to on a
 * narrow phone). Called once the banner's buttons are settled (showRoadBanner, crossingTools) and on a resize; measured
 * again only when something that sets the button's width has changed.
 */
function toolFit() {
  const tb = $('banner-tool'), v = tb.querySelector('.bt-v');
  const key = `${v.textContent}|${$('banner').classList.contains('noplan')}|${$('banner-route').hidden}|${$('banner-undo').hidden}|${innerWidth}x${innerHeight}`;
  if (tb.hidden || tb.dataset.fit === key) return;
  tb.dataset.fit = key;
  tb.classList.remove('tight');
  if (v.scrollWidth > v.clientWidth + 1) tb.classList.add('tight');
}
/** Is the Tool button showing (an upright phone in Paths, or placing a Viaduct or Ropeway), with its picker shut? */
function toolButtonShut() { return !UI.toolPick && !$('banner').hidden && !$('banner-tool').hidden && $('banner-tool').getClientRects().length > 0; }
/** Is v the Paths tool in use (a Viaduct or Ropeway: being placed)? */
function pathsToolOn(v) { return R.mode === 'road' ? UI.roadMode === v : crossingPlacing() && UI.placeType === v; }

/** Mark which ends of a row that scrolls sideways have more beyond them. */
function segEdges(el) {
  const more = el.scrollWidth - el.clientWidth > 2;
  el.classList.toggle('more-l', more && el.scrollLeft > 2);
  el.classList.toggle('more-r', more && el.scrollLeft < el.scrollWidth - el.clientWidth - 2);
}

/** In a mission, the next goal's hint at the foot of the banner (the goal list is hidden while Paths is open). */
function bannerMissionHint() {
  const M = S && S.mission, def = M && !M.result && missionDef(M);
  if (!def) return;
  const states = missionStates(M), now = missionGoalNow(states);
  const h = now >= 0 && missionHint(def, M, states, now);
  if (h) $('banner-text').insertAdjacentHTML('beforeend', `<div class="obj-hint ban-hint"><b>${states[now].text}:</b> ${h}</div>`);
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
  // (In a .sheet-flow, which lays out as nothing, except where a long panel on a desktop takes two or three columns: sheetCols.)
  $('sheet-body').innerHTML = `<div class="sheet-flow">${html}</div>`;
  $('sheet').hidden = false;
  const type = kind === 'bld' ? getE(id)?.type : null;
  $('sheet').classList.toggle('compact-supply', type === 'dropost' || type === 'crawlerbase');
  document.body.classList.add('sheet-open');
  document.body.classList.toggle('sheet-build', kind === 'build'); // (the Build list is wider on a very wide screen)
  document.body.dataset.sheet = kind; // (the Command Deck look lights the tool whose panel is open)
  $('banner').hidden = true;
  markSheetKeys();
  sheetEyebrow(kind, id);
  panelHelp(kind, id); // (its ? for How to play: js/polish.js)
  pinSheet(kind);
  if (fresh) { $('sheet-body').scrollTop = 0; setSheetSize(SHEET_TALL[kind] ? 'full' : 'half'); sheetColsOff(); requestAnimationFrame(sheetCols); setTimeout(sheetCols, 300); }
}

/**
 * A panel on a desktop: its name line (label, name, ?) stays at the top while the rest scrolls under it, and its main
 * buttons stay at the bottom (a building's Pause, Move and Dismantle; an Army group's commands): both sticky (style.css).
 * The name line is lifted out of the .sheet-flow (so it isn't one of the columns) and the button row put after it; ids,
 * classes and data attributes stay as they are, and on a phone the order on screen is as before. A long paragraph
 * (a description or a hint) shows its first lines, with More for the rest.
 */
function pinSheet(kind) {
  const body = $('sheet-body'), flow = body.firstElementChild;
  if (!flow || !flow.classList.contains('sheet-flow')) return;
  const head = flow.querySelector(':scope > .sheet-title');
  if (head) body.insertBefore(head, flow);
  if (!isWide()) return;
  const foot = kind === 'bld' ? [...flow.children].reverse().find((el) => el.classList.contains('actions') && el.querySelector('#sh-demolish, #sh-move, #sh-pause, #sh-pack, #sh-gate'))
    : kind === 'agroup' && $('ag-resume') ? $('ag-resume').parentElement : null;
  if (foot && foot.parentElement === flow) { foot.classList.add('sheet-foot'); body.appendChild(foot); }
  body.style.setProperty('--pin-h', (head ? head.offsetHeight : 0) + 'px');
  foldLong(flow);
}

/** Long paragraphs in a desktop panel: two lines and More (Less folds it again; remembered while the game runs). */
function foldLong(root) {
  UI.unfolded = UI.unfolded || new Set();
  for (const p of root.querySelectorAll('p.desc, p.hint')) {
    if (p.closest('.sheet-foot') || p.textContent.length < 160 || (p.nextElementSibling && p.nextElementSibling.classList.contains('more-btn'))) continue;
    if (p.offsetHeight < 3.6 * (parseFloat(getComputedStyle(p).lineHeight) || 19)) continue; // (three lines or fewer: folding would save nothing)
    const key = p.textContent.slice(0, 80), btn = document.createElement('button');
    btn.type = 'button'; btn.className = 'more-btn';
    const set = (open) => { p.classList.toggle('folded', !open); btn.textContent = open ? 'Less' : 'More'; btn.setAttribute('aria-expanded', open ? 'true' : 'false'); };
    set(UI.unfolded.has(key));
    btn.onclick = (e) => { e.stopPropagation(); sfx('click'); const open = p.classList.contains('folded'); if (open) UI.unfolded.add(key); else UI.unfolded.delete(key); set(open); };
    p.after(btn);
  }
}

/**
 * A long panel on a desktop: wider, its sections in two columns (three on a very wide screen when it's very long), so
 * it needs a lot less scrolling. Decided once a panel opens (and its lists have filled in), and kept while it's open so
 * nothing jumps sideways; phones, and Build (its own grid of cards), keep one column.
 */
function sheetColsOff() { $('sheet').classList.remove('cols2', 'cols3', 'cols4'); document.body.classList.remove('sheet-wide', 'sheet-wide3'); }
function sheetCols() {
  const s = $('sheet'), body = $('sheet-body');
  if (s.hidden || !isWide() || UI.sheetKind === 'build' || UI.sheetKind === 'wf' || UI.sheetKind === 'econ' || s.classList.contains('cols2') || s.classList.contains('cols3')) return;
  const long = body.scrollHeight / Math.max(1, body.clientHeight);
  if (body.scrollHeight - body.clientHeight <= 1) return; // (it fits: one column)
  let three = long > 1.6 && innerWidth >= 1400; // (two columns wouldn't hold it, with room to spare: three, from 1400 px wide)
  s.classList.add(three ? 'cols3' : 'cols2');
  document.body.classList.add(three ? 'sheet-wide3' : 'sheet-wide');
  // (two columns still don't hold it, on a screen from 1200 px wide: three, decided before it's drawn, so nothing jumps;
  // under 1400 px the three take the whole width, as Build's All does)
  if (!three && innerWidth >= 1200 && body.scrollHeight - body.clientHeight > 1) {
    sheetColsOff(); s.classList.add('cols3'); document.body.classList.add('sheet-wide3');
    // (and still too long, on a short screen under 1400 px: four)
    if (innerWidth < 1400 && innerHeight <= 820 && body.scrollHeight - body.clientHeight > 1) s.classList.add('cols4');
  }
}

/**
 * The Command Deck look's label line over a panel's name: a status light and what kind of panel it is ("Construction"
 * over Build, "Make · Yours" over a factory of yours). Plain words for the interface (LORE.md's: Command, survey,
 * construction); none for a panel without a title.
 */
const SHEET_EYEBROW = { build: 'Construction', army: 'Command · Army', air: 'Command · Air', agroup: 'Army group', agsel: 'Command · Army', pop: 'Command · Robots', wf: 'Command · Workforce',
  econ: 'Command · Economy', msgs: 'Command · Log', goals: 'Command · Goals', bp: 'Construction · Blueprints', ally: 'Command · Ally', bot: 'Unit', rally: 'Command · Army',
  move: 'Command · Army', res: 'Survey', soil: 'Survey', road: 'Paths', post: 'Neutral', uplink: 'Neutral', bridge: 'Orbital platforms' };
function sheetEyebrow(kind, id) {
  const head = $('sheet-body').querySelector('.sheet-title'), h3 = head && head.querySelector('h3');
  if (!h3 || head.querySelector('.sh-eye')) return;
  let t = SHEET_EYEBROW[kind] || '', led = '';
  if (kind === 'bld') {
    const b = getE(id), g = b && BUILD_GROUPS.find((q) => q.types.includes(b.type));
    if (!b) return;
    t = (g ? g.name : 'Structure') + ' · ' + (b.owner === ME ? 'Yours' : b.owner < 0 || b.owner === undefined ? 'Neutral' : allies(ME, b.owner) ? 'Ally' : 'Rival');
    if (b.owner >= 0 && b.owner !== ME && !allies(ME, b.owner)) led = ' red';
  } else if (kind === 'build') {
    t = `Construction · sites ${siteCount(ME)}/${MAX_SITES}`;
  } else if (kind === 'agroup') {
    const gs = agMine(), k = gs.findIndex((g) => g.id === id);
    if (k >= 0) t = `Army group · priority ${k + 1} of ${gs.length}`;
  } else if (kind === 'army' && UI.armyTab === 'air') t = SHEET_EYEBROW.air;
  if (!t) return;
  const e = document.createElement('span');
  e.className = 'sh-eye'; e.setAttribute('aria-hidden', 'true');
  e.innerHTML = `<i class="led${led}"></i>${esc(t)}`;
  h3.parentNode.insertBefore(e, h3);
}

/*
 * Panel heights where the panel is a sheet across the bottom (phones, upright tablets): half the screen, so the
 * map and what the panel is about stay in view above it; full; or just its title strip. The grab handle at the
 * top is dragged between them (further down closes the panel) or tapped to switch between half and full.
 */
const SHEET_TALL = { build: 1, econ: 1, pop: 1, msgs: 1, goals: 1, wf: 1 }; // lists and charts open at full height: nothing on the map to watch

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
  if (k === 'agroup') { const g = agById(id), r = g && rallyById(g.flag); return r ? { x: r.x, y: r.y } : null; }
  if (k === 'move' || k === 'res' || k === 'road' || k === 'soil' || k === 'post' || k === 'uplink') return { x: (id % S.W) + 0.5, y: ((id / S.W) | 0) + 0.5 };
  if (k === 'bridge') { const B = S.orb && S.orb.br[id]; return B ? { x: (B.x0 + B.x1 + 1) / 2, y: (B.y0 + B.y1 + 1) / 2 } : null; } // (Orbital platforms: the middle of the bridge)
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
  const sTop = open ? s.getBoundingClientRect().top : R.h; // (above the tools on a phone in the Command Deck look, not over them)
  R.lift = bottom ? (R.h - sTop) / R.h : 0;
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
    bot = sTop - 22;
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
    s.style.maxHeight = clamp(d.h - dy, 24, s.getBoundingClientRect().bottom - document.querySelector('.toprow').getBoundingClientRect().bottom - 6) + 'px';
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
  sheetColsOff();
  document.body.classList.remove('sheet-open', 'sheet-build', 'sheet-wf', 'sheet-econ');
  delete document.body.dataset.sheet;
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
 * The build menu: tabs across the top (the BUILD_GROUPS: Gather, Make, Move, Defend, Mega, then Terraform), the
 * last one used remembered, each with its number key. Every card is in the page whichever tab is showing
 * (the others are just hidden); a letter picks a building on the tab that's showing (BUILD_KEYS).
 */
function openBuildMenu() {
  const have = playerGoods(ME);
  const sites = siteCount(ME);
  const list = BUILD_MENU.filter((t) => !(BDEFS[t].war && !warOn()) && !(BDEFS[t].nuke && !nukeOn()) && !(BDEFS[t].mega && !megaOn()) && !(BDEFS[t].gup && !gupWinOn()) && !(BDEFS[t].colony && !labOn()) && !(BDEFS[t].naval && !navalMap()) && !modNoBuild(t));
  const groupOf = (t) => (BUILD_GROUPS.find((g) => g.types.includes(t)) || BUILD_GROUPS[0]).key;
  const ordered = BUILD_GROUPS.flatMap((g) => g.types).filter((t) => list.includes(t));
  if (!UI.buildTab) { try { UI.buildTab = localStorage.getItem('botfall.buildTab') || 'gather'; } catch (e) { UI.buildTab = 'gather'; } }
  const groups = BUILD_GROUPS.filter((g) => ordered.some((t) => groupOf(t) === g.key));
  // (An unknown tab, or an old saved "all" from when there was an All tab, opens on the first one.)
  if (UI.buildTab !== 'terra' && !groups.some((g) => g.key === UI.buildTab)) UI.buildTab = groups.length ? groups[0].key : 'terra';
  const tabBtn = (g) => `<button data-g="${g.key}"><kbd>${BUILD_TAB_KEYS[g.key]}</kbd>${g.name}<span class="n">${ordered.filter((t) => groupOf(t) === g.key).length}</span></button>`;
  const tabs = `<div class="seg build-tabs" id="build-tabs">${groups.map(tabBtn).join('')}${tfTabButton()}</div>`; // (Terraform last: tools, not buildings, js/terraform.js)
  const kbd = (t) => { const k = buildKeyOf(t); return k ? `<kbd data-tab="${BUILD_TAB_KEYS[k.tab]}" data-key="${k.key.toUpperCase()}">${k.key.toUpperCase()}</kbd>` : ''; };
  // The cards in tab order: Roads and Blueprints lead Move, Walls lead Defend (the grid's CSS order puts the next step,
  // then Roads, Blueprints and Walls first).
  const card = (t) => { const ban = worldBan(t); return `<button class="bcard${ban ? ' banned' : ''}" data-t="${t}" data-g="${groupOf(t)}" ${sites >= MAX_SITES || ban ? 'disabled' : ''}${ban ? ` title="${ban}"` : ` title="${BDEFS[t].name}"`}>
      ${kbd(t)}<img src="${iconFor(t)}" alt=""><div class="bname">${BDEFS[t].name}</div><div class="bcost">${costHTML(BDEFS[t].cost, have)}</div>
      <div class="bhave">${ownedText(t)}</div></button>`; };
  const roads = `<button class="bcard roads" id="build-roads" data-g="move"><kbd data-key="R">R</kbd><svg viewBox="0 0 24 24"><path d="M8 3L5 21M16 3l3 18M12 4v3M12 10.5v3M12 17v3" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>
      <div class="bname">Roads</div><div class="bhave">Roads, bridges, ramps, Maglev lines, Viaducts and Ropeways</div></button>${bpOn() ? `<button class="bcard roads bp-card" id="build-bp" data-g="any"><svg viewBox="0 0 24 24"><path d="M4 4h7v7H4zM13 13h7v7h-7zM11 7.5h4.5V13M4 15h5v5H4z" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/></svg>
      <div class="bname">Blueprints</div><div class="bhave">${bpCardText()}</div></button>` : ''}`;
  const walls = warOn() ? `<button class="bcard walls" id="build-walls" data-g="defend"><kbd data-tab="${BUILD_TAB_KEYS.defend}" data-key="X">X</kbd><img src="${iconFor('wall')}" alt=""><div class="bname">Walls</div><div class="bcost">${costHTML(BDEFS.wall.cost, have)}</div>
      <div class="bhave">${wallCountText()}</div></button>` : '';
  const html = `<div class="sheet-title"><h3>Build</h3></div>
    <p class="desc">Placing a site is free; haulers bring the materials by road, so lay a road to it. <span id="build-sites">${sites}/${MAX_SITES}</span> sites in progress.</p>
    ${tabs}
    <div class="build-grid">${nextBuilds().filter((t) => list.includes(t) && !worldBan(t)).map((t) => `<button class="bcard next" data-t="${t}" data-g="next" ${sites >= MAX_SITES ? 'disabled' : ''}>
      <img src="${iconFor(t)}" alt=""><div class="bname">${BDEFS[t].name}</div><div class="bcost">${costHTML(BDEFS[t].cost, have)}</div>
      <div class="bhave">${ownedText(t)}</div></button>`).join('')}${groups.map((g) => (g.roads ? roads : '') + (g.walls ? walls : '') + ordered.filter((t) => groupOf(t) === g.key).map(card).join('')).join('')}${tfCards()}</div>`;
  openSheet('build', 0, html);
  for (const el of $('sheet-body').querySelectorAll('.bcard[data-t]')) {
    el.onclick = () => { sfx('click'); enterPlaceMode(el.dataset.t); };
  }
  $('build-roads').onclick = () => openRoadDraw();
  if ($('build-bp')) $('build-bp').onclick = () => { sfx('click'); openBlueprints(); };
  if ($('build-walls')) $('build-walls').onclick = () => openPaths('wall');
  tfBind($('sheet-body'));
  const show = (g) => {
    UI.buildTab = g;
    try { localStorage.setItem('botfall.buildTab', g); } catch (e) { /* private mode: not remembered */ }
    for (const btn of $('build-tabs').children) btn.classList.toggle('on', btn.dataset.g === g);
    for (const el of $('sheet-body').querySelectorAll('.build-grid .bcard, .build-grid .tf-note')) el.hidden = el.dataset.g === 'terra' || g === 'terra' ? el.dataset.g !== g : el.dataset.g !== g && el.dataset.g !== 'next' && el.dataset.g !== 'any';
  };
  for (const btn of $('build-tabs').children) btn.onclick = () => { sfx('click'); show(btn.dataset.g); };
  show(UI.buildTab);
}

/**
 * The Trade Terminal's route and the market board. The route: what it sends and what it brings back (a row of goods
 * each: tap one of each, then Start route), what a run fetches today, when the next one goes, Stop, and the Escort
 * switch. The board: what each good sells for and costs on the Trade Post's ledger, eased where you've sold a lot
 * lately. Rebuilt only when something shown changes, so its buttons stay pressable.
 */
function renderTrade(b) {
  const el = $('sh-trade');
  if (!el) return;
  const T = tradeState(ME), r = b.route;
  if (!UI.tradePick || UI.tradePick.id !== b.id) UI.tradePick = { id: b.id, give: r ? r.give : null, get: r ? r.get : null };
  const pk = UI.tradePick, why = pk.give && pk.get ? tradePairWhy(pk.give, pk.get) : '';
  const run = pk.give && pk.get && !why ? tradeRun(ME, pk, b) : null, cur = r ? tradeRun(ME, r, b) : null;
  const wait = r ? terminalWindow(b) - S.time : 0;
  $('sh-trade-next').textContent = r ? (wait > 0 ? `next run in ${fmtClock(wait)}` : 'run due') : '';
  const trainNear = S.bots.some((u) => !u.dead && u.owner === ME && BOTS[u.type].train && botLinked(u, b));
  const railNear = S.bots.some((u) => !u.dead && u.owner === ME && BOTS[u.type].rail) && S.buildings.some((s) => !s.dead && s.owner === ME && s.built && BDEFS[s.type].station && !BDEFS[s.type].terminal && railLinked(s, b));
  const bonus = Math.round((terminalBonus(b) - 1) * 100);
  const liq = r && isLiquid(r.get), tankerNear = S.bots.some((u) => !u.dead && u.owner === ME && BOTS[u.type].tanker && botLinked(u, b));
  const hit = b.convoyHit !== undefined && S.time - b.convoyHit < 30;
  $('sh-trade-hint').innerHTML = (!trainNear && !railNear ? '<span class="err">No Road Train can reach it, and no Freight Train runs to it: order a Road Train at the Bot Foundry and lay a road here (or lay track beside it from a Rail Station).</span> ' : '') +
    (liq && !tankerNear && !b.pipedFuel ? `<span class="err">No Tanker can reach it to take the ${GOOD[r.get].name} home: order one at the Bot Foundry${r.get === 'fuel' ? ' (or pipe the Terminal to storage)' : ''}.</span> ` : '') +
    `The Trade Post's ledger takes one run from each Terminal every ${Math.round(TERMINAL.every / 60)} minutes: a convoy (a Road Train, or a Freight Train on track beside it) takes ${TERMINAL.lot} of the good out and brings what they bought home${liq ? ` (${GOOD[r.get].name} goes by Tanker${r.get === 'fuel' ? ', or by pipeline to storage' : ''})` : ''}. ` +
    `Raw goods sell for about a third of their worth and cost three-quarters of it; made goods sell for a little over half and cost their worth; Fuel costs half as much again. No raw good for another raw good.` +
    (bonus ? ` This Terminal pays +${bonus}% for standing this far out.` : ` One further than ${TERMINAL.minDist} tiles from your Command Base pays more.`) +
    ' Nothing shoots on the Post\'s ground: convoys are hit out on the road.';
  const goods = (side) => (side === 'give' ? tradeSends() : tradeGets());
  const fmt = (x) => (x >= 10 ? String(Math.round(x)) : (Math.round(x * 10) / 10).toString());
  renderBoard();
  const sig = JSON.stringify([r, b.escort, pk, Math.round((cur ? cur.pay : 0) * 10), Math.round((run ? run.pay : 0) * 10), b.runs || 0, hit, warOn()]);
  if (el.dataset.sig === sig) return;
  el.dataset.sig = sig;
  const row = (side) => goods(side).map((g) => {
    const on = pk[side] === g, bad = side === 'get' && pk.give && tradePairWhy(pk.give, g);
    return `<button class="gtag toggle tpick${on ? ' on' : ''}" data-side="${side}" data-g="${g}"${bad ? ` title="${bad}"` : ''}${bad && !on ? ' disabled' : ''}><i class="gi ${g}"></i><span>${goodN(g, 2)}</span></button>`;
  }).join('');
  const last = b.last ? ` · last run: ${b.last.n} ${goodN(b.last.give, b.last.n)} for ${b.last.pay} ${goodN(b.last.get, b.last.pay)}` : '';
  const same = r && pk.give === r.give && pk.get === r.get;
  el.innerHTML = `<div class="trade-cur${r ? ' on' : ''}"><span>${r ? `Send <b>${cur.lot}</b> <i class="gi ${r.give}"></i>${goodN(r.give, cur.lot)} → bring back about <b>${fmt(cur.pay)}</b> <i class="gi ${r.get}"></i>${goodN(r.get, 2)}` +
      `<small>A run every ${Math.round(TERMINAL.every / 60)} minutes${b.runs ? ` · ${b.runs} run${b.runs > 1 ? 's' : ''} so far` : ''}${last}</small>` : 'No route yet<small>Pick a good to send and one to bring back, then Start route.</small>'}` +
      `${hit ? '<small class="err">A convoy was hit on the road just now.</small>' : ''}</span></div>` +
    `<div class="trade-side">Send</div><div class="goodlist" id="sh-tgive">${row('give')}</div>` +
    `<div class="trade-side">Bring back</div><div class="goodlist" id="sh-tget">${row('get')}</div>` +
    `<p class="hint" id="sh-tpreview">${!pk.give || !pk.get ? 'Tap a good in each row.' : why ? `<span class="err">${why}</span>` : `${run.lot} ${goodN(pk.give, run.lot)} → about ${fmt(run.pay)} ${goodN(pk.get, 2)} a run, at today's prices.`}</p>` +
    `<div class="actions"><button class="btn primary" id="sh-tgo" ${run && !same ? '' : 'disabled'}>${r ? 'Change route' : 'Start route'}</button>` +
    `<button class="btn" id="sh-tstop" ${r ? '' : 'disabled'}>Stop route</button>` +
    `<button class="btn${b.escort ? ' primary' : ''}" id="sh-escort" aria-pressed="${b.escort ? 'true' : 'false'}">Escort: ${b.escort ? 'on' : 'off'}</button></div>` +
    `<p class="hint">Escort: ${TERMINAL.escort} warbots from the nearest garrison ride along with each convoy and walk back once it's home.</p>`;
  for (const btn of el.querySelectorAll('button.tpick')) btn.onclick = () => {
    const side = btn.dataset.side, g = btn.dataset.g;
    pk[side] = pk[side] === g ? null : g;
    if (side === 'give' && pk.get && tradePairWhy(pk.give, pk.get)) pk.get = null; // (what it brought back can't be had for the new good)
    sfx('click');
    renderTrade(b);
  };
  $('sh-tgo').onclick = () => {
    const give = pk.give, get = pk.get;
    act('tradeRoute', [b.id, give, get], (w) => {
      if (w) { sfx('error'); toast(w, 'warn'); }
      else { sfx('place'); haptic('order'); toast(`Trade route set: ${GOOD[give].name} out, ${GOOD[get].name} back.`, 'info'); }
      renderTrade(b); refreshSheet();
    });
  };
  $('sh-tstop').onclick = () => { act('tradeRoute', [b.id, null, null], () => { UI.tradePick = null; renderTrade(b); refreshSheet(); }); sfx('click'); };
  $('sh-escort').onclick = () => { act('tradeEscort', [b.id, !b.escort], () => { renderTrade(b); refreshSheet(); }); sfx('click'); };
  markSheetKeys();
}

/** The market board: each good's price selling and buying on the Trade Post's ledger (TRADE_VALUE × 20, in whole marks of the ledger), eased ones marked. */
function renderBoard() {
  const el = $('sh-board');
  if (!el) return;
  const T = tradeState(ME), sends = tradeSends(), gets = tradeGets();
  const sig = JSON.stringify([gets, TRADE_BOARD.map((g) => Math.round((T.sat[g] ?? 1) * 100))]);
  if (el.dataset.sig === sig) return;
  el.dataset.sig = sig;
  const n = (x) => Math.max(1, Math.round(x * 20));
  el.innerHTML = '<div class="board-row board-head"><span>Good</span><span>Sells for</span><span>Costs</span></div>' + TRADE_BOARD.filter((g) => gets.includes(g)).map((g) => {
    const sat = T.sat[g] ?? 1, eased = sat < 0.99;
    return `<div class="board-row${tradeRaw(g) ? ' raw' : ''}"><span><i class="gi ${g}"></i>${goodN(g, 2)}<small>${tradeRaw(g) ? 'raw' : 'made'}</small></span>` +
      `<span${eased ? ' class="eased" title="You sold a lot of it lately: it fetches less for a while"' : ''}>${sends.includes(g) ? n(sellPrice(ME, g)) + (eased ? ` ↓${Math.round((1 - sat) * 100)}%` : '') : '—'}</span><span>${n(buyPrice(g))}</span></div>`;
  }).join('');
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
    const n = (b.yard && b.yard[k]) || 0, parts = (b.yardParts && b.yardParts[k]) || 0, partsIn = parts ? ` · ${parts} of ${BOTS[k].parts} parts in` : '';
    if (BDEFS[b.type].airfield && BOTS[k].airship) $('sh-y-' + k).textContent = (n ? `${n} ordered${partsIn}` : 'none ordered') + ' · no hangar spot: each flies off to its line';
    else if (BDEFS[b.type].airfield) {
      // Its spots in the hangar, and orders past them as spares (built when one is lost).
      const h = hangarCount(b, k);
      $('sh-y-' + k).textContent = `${h.have} of ${h.cap} in the hangar` + (h.making ? ` · ${h.making} ordered${partsIn}` : '') + (h.spare ? ` · ${h.spare} spare${h.spare === 1 ? '' : 's'}, built if one is lost` : '');
    } else $('sh-y-' + k).textContent = n ? `${n} ordered${partsIn}` : 'none ordered';
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
    const t = el.dataset.t, cost = BDEFS[t].cost, off = full || !!worldBan(t);
    if (el.disabled !== off) el.disabled = off;
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
  if (BDEFS[type].city && worldBan(type)) return 'Not on the moon';
  if (BDEFS[type].city && !cityOpen() && !ownedCount(type).sites) return `Opens at ${Math.round(CITY.at / 60)}:00`;
  if (BDEFS[type].lift && worldBan(type)) return 'No sky down here';
  if (BDEFS[type].deepcore && !deepOpen() && !ownedCount(type).sites) return `Opens at ${Math.round(DEEP.at / 60)}:00`;
  if (BDEFS[type].atmos && worldBan(type)) return biome() === 'lunar' ? 'No air on the moon' : 'No sky down here';
  if (BDEFS[type].atmos && !atmosOpen() && !ownedCount(type).sites) return `Opens at ${Math.round(ATMOS.at / 60)}:00`;
  if (worldBan(type)) return BDEFS[type].airfield || BDEFS[type].mast ? 'No aircraft underground' : BDEFS[type].terminal ? 'No Trade Posts down here' : (type === 'munitions' || BDEFS[type].missile || BDEFS[type].nukeSilo) ? 'No missiles underground' : BDEFS[type].mdriver || BDEFS[type].catcher ? 'Nothing flies underground' : 'Nothing grows down here'; // (the Hollow: see worldBan)
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
  const mine = b.owner === ME && !megaDark(b); // (a megastructure knocked out or offline: nothing to command, see megaParts)
  R.selected = b.id; R.selTile = -1; UI.selBot = 0;
  let desc = !mine && b.type === 'lander' ? (nColonies() > 2 ? `${playerName(b.owner)}'s fortified headquarters. Capture it and everything ${playerName(b.owner)} built is yours.` : `${playerName(b.owner)}'s fortified headquarters. Capture it to win.`) : def.desc;
  const style = !mine && b.type === 'lander' && S.players[b.owner] && S.players[b.owner].ai && isDoctrine(S.players[b.owner].style) && S.players[b.owner].style;
  if (style && S.mode !== 'colony' && !S.mission) desc += ` <b>${docLabel(style)}:</b> it ${PERSONALITIES[style].desc}.`;
  if (!mine && b.type === 'lander' && S.mission && captureLocked(b, ME)) desc += ' <b>Finish your other goals first:</b> until then it holds at 1 armor.';
  // A fallen ally's Command Base (FALLEN): whose it is and how it comes back.
  const fallenP = b.type === 'lander' && typeof fallenBaseOf === 'function' ? fallenBaseOf(b) : -1;
  if (fallenP >= 0) desc = S.horde
    ? `<b>Fallen:</b> ${esc(playerName(fallenP, true))} ${fallenP === ME ? 'are' : 'is'} down and watching. A partner's armed warbots holding it ${FALLEN.retake.secs} seconds, with no Murmur within ${FALLEN.retake.r} tiles, retake it${b.hRet > 0 ? ` (<b>${Math.floor(b.hRet)} of ${FALLEN.retake.secs} s</b>)` : ''}.`
    : `<b>${esc(playerName(fallenP))}'s fallen Command Base</b>, held by ${esc(playerName(b.owner, true))}. ${allies(fallenP, ME) || fallenP === ME ? `Capture it back and ${fallenP === ME ? 'you\'re' : 'they\'re'} back in the game, with everything of theirs still standing.` : 'If their team captures it back, they\'re back in the game.'}`;
  if (def.burrow) {
    // A tunnel exit: what it is (its description), whose network, and how to deal with it.
    const nest = getE(b.nest), up = S.bots.filter((u) => !u.dead && u.exit === b.id && u.task && u.task.night).length;
    desc += ` <b>${murmurNight(S.time) ? (alwaysNightMap() ? 'A surge is on' : 'Night') + `: ${up ? `${up} of the Murmur came up here` : 'the Murmur are up'}.` : `${alwaysNightMap() ? 'Between surges' : 'Day'}: quiet until ${alwaysNightMap() ? 'the next surge' : 'nightfall'} (${fmtClock(murmurNextNight())}).`}</b>` +
      ` Its nest is ${nest ? dirText(b, nest) + ' of here' : 'gone'}. <b>To deal with it:</b> Army → Attack, then tap it (by day 4 armed warbots are plenty; at night bring more), or send warbots below.`;
  } else if (def.wild) {
    const n = S.bots.filter((u) => !u.dead && u.nest === b.id).length;
    desc += ` <b>Level ${b.level || 1} of 3</b>, ${n} of the Murmur out and about. Hoarded: ${Object.keys(b.stock).filter((g) => b.stock[g] > 0).map((g) => `${b.stock[g]} ${GOOD[g].name}`).join(', ') || 'nothing'}.`;
  }
  // With no road to storage yet, that warning and its Lay road button lead the panel: in view at half height.
  const roadFirst = mine && b.unlinked && needsRoad(b);
  let html = `<div class="sheet-title"><img src="${iconFor(b.type, b.owner)}" alt=""><div><h3>${def.name}</h3>
    <div class="owner"><span class="dot" style="background:${ownerColor(b.owner)}"></span> ${ownerLabel(b.owner)}</div>${b.type === 'lander' ? `<div class="flavor clock">${ARRIVAL_CLOCK}</div>` : ''}</div></div>
    ${roadFirst ? '<div id="sh-road"></div>' : ''}<p class="desc">${desc}</p><div class="status" id="sh-status"></div>${mine && def.inp && !def.pump ? '<div id="sh-why"></div>' : ''}<div id="sh-dyn"></div>${mine ? '<div id="sh-fix"></div>' : ''}`;
  if (mine) {
    if (def.airfield && b.built && b.owner === ME) html += airfieldSection(b); // its planes and air drops first
    if (def.magterm && b.built && mine) html += magSection();
    if ((def.mdriver || def.catcher) && b.built && mine) html += mdSection(b);
    if (def.lift && b.built && mine) html += '<div class="section-label">Orbital Lift</div><div id="sh-lift"></div>';
    if (def.gup && b.built) html += '<div class="section-label">Transmission</div><div id="sh-gup"></div>';
    if (def.yard && b.built && mine) html += `<div class="section-label">${def.port ? 'Shipyard' : def.airfield ? 'Hangar' : def.magterm ? 'Pod bay' : 'Rail yard'}</div><div class="status" id="sh-yard-status"></div><div class="bar" id="sh-yard-bar"><div></div></div><div id="sh-yard"></div>${def.station ? '<div class="actions" id="sh-yard-here"></div>' : ''}
      <p class="hint">${def.magterm ? `Maglev Pods are built here, two rounds of parts (2 Alloy, 1 Chip) every ${YARD.work} s each: 4 Alloy and 2 Chips a pod, ${MAGLEV.perLine} to a line. Haulers bring the parts (or a conveyor from storage beside it). A new pod docks here and runs the line by itself.` : ''}${def.magterm ? '' : def.port ? 'Ships are built here' : def.airfield ? 'Planes are built here' : 'Freight Trains are built here'}${def.magterm ? '' : `, a round of parts (1 Alloy, 1 Chip) every ${YARD.work} s:`} ${def.magterm ? '' : def.yard.map((k) => `${BOTS[k].plural.toLowerCase().replace(/^./, (c) => c.toUpperCase())} ${BOTS[k].parts}`).join(', ') + ' rounds. Haulers bring the parts. '}${def.magterm ? '' : def.port ? 'Each one puts to sea from this Port.' : def.airfield ? `The hangar holds ${Object.entries(AIRFIELD_HOLDS).map(([k, n]) => `${n} ${n === 1 ? BOTS[k].name : BOTS[k].plural}`).join(' and ')}; orders past that wait as spares, built when one is lost. An Airship takes no spot: it flies off to a line between two Mooring Masts.` : 'Each one rolls out onto this station\'s track, so the Bot Foundry never needs a railway.'}</p>`;
    if (def.terminal && b.built) html += '<div class="section-label">Trade route <span class="label-note" id="sh-trade-next"></span></div><div id="sh-trade"></div>' +
      '<div class="section-label">Market board <span class="label-note">the Post\'s ledger: what each good sells for and costs</span></div><div class="board" id="sh-board"></div><p class="hint" id="sh-trade-hint"></p>';
    // A Rail Station: its line, what it stocks automatically, and its conveyors.
    if (def.station && !def.terminal && b.built && mine) {
      html += `<div class="section-label">Railway</div><div class="status" id="sh-rail-status"></div>
        <div class="seg" id="sh-auto"><button data-v="1">Auto supply</button><button data-v="0">Off</button></div>
        <p class="hint" id="sh-rail-hint"></p>`;
    }
    // A Mooring Mast: its Airship line, its Airships, its Fuel, and what it stocks automatically.
    if (def.mast && b.built && mine) html += mastSection();
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
        <div class="goodlist" id="sh-accept">${(def.tank ? ['crude', 'fuel'] : GOODS.filter((g) => nukeOn() || !NUKE_GOODS.includes(g))).map((g) => `<button class="gtag toggle" data-g="${g}"><i class="gi ${g}"></i><span>${GOOD[g].name}</span> <b>0</b></button>`).join('')}</div>`;
      if (b.type !== 'lander' && !def.mdriver) {
        // The goods a front line runs on, plus any already ordered; the rest behind "More goods". (A Fuel Tank: a minimum
        // of Fuel and Crude to keep in it, the owner's ask, Nov 21 2026.)
        const main = def.tank ? ['fuel', 'crude'] : ['cement', 'fiber', 'stone', 'alloy', 'fuel'].concat(warOn() ? ['ammo'] : []);
        const goods = def.tank ? main : main.concat(GOODS.filter((g) => !main.includes(g))).filter((g) => (warOn() || !WAR_GOODS.includes(g)) && (nukeOn() || !NUKE_GOODS.includes(g)) && (UI.keepAll || main.includes(g) || (b.keep && b.keep[g])));
        html += `<div class="section-label">${def.tank ? 'Keep at least' : 'Supply orders'} <span class="label-note">${def.tank ? 'Tankers top it up' : 'stock it from home'}</span></div>
          <div class="keep-list" id="sh-keep">${goods.map((g) => `<div class="keep-cell" data-g="${g}"><span class="kname"><i class="gi ${g}"></i>${GOOD[g].name}</span><b class="n">–</b>
            <button class="btn" data-d="-5" aria-label="Less ${GOOD[g].name}">−5</button><button class="btn" data-d="5" aria-label="More ${GOOD[g].name}">+5</button></div>`).join('')}</div>
          ${def.tank ? '' : `<button class="btn small ghost" id="sh-keep-all">${UI.keepAll ? 'Fewer goods' : 'More goods'}</button>`}
          <p class="hint" id="sh-keep-hint"></p>`;
      }
      if (BDEFS[b.type].port && b.built && b.owner === ME) html += portSection(b);
    }
    // Call a worker: one of yours with a building that needs a worker and has none (a mine no one comes to).
    if (b.owner === ME && b.built && BDEFS[b.type].staff && !BDEFS[b.type].crew && !b.staff) {
      html += `<button class="btn" id="sh-callw">Call a worker</button><p class="hint" id="sh-callw-hint">Send the nearest worker here now, even one busy elsewhere, so this keeps working.</p>`;
    }
    // Keep staffed (the Workforce panel's pin, for one building): its worker is never moved off by the game.
    if (b.owner === ME && b.built && BDEFS[b.type].staff && !BDEFS[b.type].crew) {
      html += `<button class="btn${b.keepStaff ? ' primary' : ''}" id="sh-keepstaff" aria-pressed="${!!b.keepStaff}">${b.keepStaff ? 'Keep staffed: on' : 'Keep staffed'}</button><p class="hint">${b.keepStaff ? 'Its worker stays, even when the game would send it where a good is short or when this can\'t work for a while. At its stock limit it goes, and one comes back first once there\'s room.' : 'Keep its worker here: the game never moves it off for a shortage, or because this can\'t work for a while (at its stock limit it goes, and comes back first).'}</p>`;
    }
    // Call a builder: a construction site of yours with its goods in and nobody building it.
    if (b.owner === ME && !b.built && !b.builder && siteReady(b)) {
      html += `<button class="btn" id="sh-callw">Call a builder</button><p class="hint" id="sh-callw-hint">Send the nearest worker here now to build, even one busy elsewhere.</p>`;
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
    // A defence's aim (ORDERS.focus): lock it onto one enemy in reach, or leave it to pick its own.
    if (canFocus(def) && b.built) html += `<div class="section-label">Aim</div><div class="kv"><span>Aiming at</span><span id="sh-focus-txt"></span></div>
      <div class="btn-row"><button class="btn" id="sh-focus">Aim</button><button class="btn ghost" id="sh-focus-clear">Clear aim</button></div><p class="hint" id="sh-focus-hint"></p>`;
    if (def.lab && b.built) html += '<div class="section-label">Research</div><div id="sh-research"></div>';
    if (b.type === 'foundry' && b.built) {
      html += `<div class="section-label orders-label">Order bots</div>
        <div class="seg" id="sh-omode"><button data-v="turns">Take turns</button><button data-v="first">Top of the list first</button></div>
        <div id="sh-orders"></div>
        <p class="hint">The Foundry only builds the bots you order, from the top of this list down. <b>Take turns</b>: one of each type you've ordered in turn. <b>Top of the list first</b>: every bot of the top type you've ordered, then the next. Move a type up or down with the arrows. Each bot uses 1 Alloy and 1 Chip a round, ${def.work} s each (a Freight Truck or Tanker takes ${BOTS.truck.parts} rounds, a Road Train ${BOTS.roadtrain.parts}, a Crawler ${BOTS.crawler.parts}). Freight Trains are built at a Rail Station's rail yard, planes in an Airfield's hangar${navalMap() ? ', ships at a Port\'s shipyard' : ''}.
        <b>Haulers</b> carry two goods on the short runs. <b>Freight Trucks</b> carry eight on the long runs (12 tiles or more), from far mines and factories as well as storage. <b>Tankers</b> are the only vehicles that carry Crude and Fuel, ten at a time (they explode if they're destroyed full). <b>Road Trains</b> carry thirty between your Command Base and far Depots, best on asphalt. <b>Agribots</b> run Bio Farms and Grove Planters, and <b>Pavers</b> run the Roadworks (two each): they lay planned roads and asphalt.</p>`;
    }
    if (def.roadworks && b.built) {
      html += `<div class="section-label">Paves and maintains</div>
        <div class="seg" id="sh-pmode"><button data-v="marked">Marked roads</button><button data-v="all">Every joined road</button></div>
        <button class="btn" id="sh-pmark">Mark roads to pave</button>
        <p class="hint">Its two Pavers lay your planned roads first, twice as fast as a Worker (they don't count toward the road crew in Paths). Then they surface: mark roads in Paths (Pave) and they keep just those surfaced, resurfacing them as traffic wears them down: put the Roadworks near the roads that matter. <i>Every joined road</i> paves everything it can reach.</p>`;
    }
    if (def.pump && b.built && b.owner === ME) {
      html += '<div id="sh-pipe-offer" hidden><button class="btn" id="sh-pipe">Pipe it in</button>' +
        '<p class="hint">A pipeline sends Crude to a Refinery or Fuel Tank without Tanker trips.</p></div>';
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
    if (def.lance && b.built && b.owner === ME) {
      html += `<button class="btn primary big danger-glow" id="sh-aim">Aim the Lance</button>
        <p class="hint" id="sh-aim-hint"></p><button class="btn" id="sh-lstop" hidden>Stand down (the charge is lost)</button>
        <button class="btn" id="sh-luser" aria-pressed="false">Use Reactor: Off</button><p class="hint" id="sh-luser-hint"></p>`;
    }
    if (def.sunder && b.built && b.owner === ME) {
      html += `<div class="actions"><button class="btn primary big danger-glow" id="sh-sdeep">Strike the Deep</button><button class="btn primary big danger-glow" id="sh-squake">Quake</button></div>
        <p class="hint" id="sh-saim-hint"></p><button class="btn" id="sh-sstop" hidden>Stand down (the blow is lost)</button>
        <button class="btn" id="sh-suser" aria-pressed="false">Use Reactor: Off</button><p class="hint" id="sh-suser-hint"></p>`;
    }
    if (def.t4 && b.built && b.owner === ME && typeof t4Buttons === 'function') html += t4Buttons(b); // (the Sluice's Open, the Sap Head's Plan sap: js/terraform4.js)
    if (def.atmos && b.built && b.owner === ME) {
      html += `<button class="btn primary big" id="sh-storm">Storm Front</button>
        <p class="hint" id="sh-storm-hint"></p><button class="btn" id="sh-stormoff" hidden>Call the storm off</button>`;
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
    // Co-op: who placed it (its badge on the map is their initial).
    if (typeof coopOn === 'function' && coopOn() && b.by !== undefined) html += `<p class="hint coop-by"><i class="dot" style="background:${coopColor(b.by)}"></i>Placed by ${b.by === MP.me ? 'you' : esc(coopName(b.by))}</p>`;
    html += '<div class="actions">';
    if (pausable(b) && b.built) html += `<button class="btn" id="sh-pause"></button>`;
    if (b.owner === ME && (movable(b) || b.moving)) html += `<button class="btn" id="sh-move">${b.moving ? 'Cancel move' : 'Move'}</button><p class="hint" id="sh-move-hint">${b.moving ? 'Its new site is going up: when it\'s finished, everything here moves over and this one comes down.' : 'Put it somewhere else: no goods needed, just its build time. It keeps working until the new one is ready.'}</p>`;
    if (b.owner === ME && b.type === 'wall' && b.built) html += `<button class="btn" id="sh-gate">Make it a Gate</button><p class="hint">Your bots and trucks can pass through a Gate; enemies still have to break it down. It costs ${costText(gateUpgradeCost())} more, paid from storage.</p>`;
    if (BDEFS[b.type].mobile) html += '<button class="btn primary" id="sh-pack">Pack up to move</button>';
    else if (b.type !== 'lander' && !(def.city && b.built)) html += `<button class="btn danger" id="sh-demolish">${b.built ? 'Dismantle' : 'Cancel site'}</button>`; // (Arrival City can't be taken down: only captured)
    html += '</div>';
  } else if ((S.mode !== 'colony' || def.wild) && foes(b.owner, ME)) {
    html += `<div class="section-label">Attack with warbots</div><div id="sh-attack"></div>
      <div class="stepper" id="sh-stepper"><button class="btn" id="sh-minus">−</button><span class="n" id="sh-n">0</span>
      <button class="btn" id="sh-plus">+</button><button class="btn primary" id="sh-send" style="flex:1">Send warbots</button></div>
      ${def.mega && !def.city && b.built ? '<div class="section-label">Seize or wreck</div><button class="btn" id="sh-mwreck"></button><p class="hint" id="sh-mwreck-hint"></p>' : ''}
      <div class="section-label">Missile strike</div><div id="sh-missile"></div>
      <button class="btn primary big" id="sh-fire">Fire missile</button>${myBombers().length ? '<div class="section-label">Air strike</div><p class="hint" id="sh-bomb-hint"></p><div class="actions"><button class="btn big" id="sh-bomb">Bomb it</button><button class="btn big" id="sh-napalm">Napalm</button></div>' : ''}`;
  }
  html += flavorLine(b.type);
  openSheet('bld', b.id, html);
  UI.sheetMine = mine; UI.sheetDark = megaDark(b);
  if (mine) {
    // (each setting is an order: refreshSheet once it's done)
    const set = (name, ...args) => { act(name, [b.id, ...args], () => refreshSheet()); sfx('click'); };
    if ($('sh-prio')) for (const btn of $('sh-prio').children) btn.onclick = () => set('prio', btn.dataset.v);
    if ($('sh-keepstaff')) $('sh-keepstaff').onclick = () => act('keepStaff', [b.id, !b.keepStaff], () => { sfx('click'); if (!b.dead) openBuildingSheet(b); });
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
    if ($('sh-sdeep')) $('sh-sdeep').onclick = () => { sfx('click'); startAim(b, 'deep'); };
    if ($('sh-squake')) $('sh-squake').onclick = () => { sfx('click'); startAim(b, 'quake'); };
    if ($('sh-storm')) $('sh-storm').onclick = () => { sfx('click'); startAim(b); };
    if (typeof t4Bind === 'function') t4Bind(b); // (stage 4: js/terraform4.js)
    if ($('sh-stormoff')) $('sh-stormoff').onclick = () => { sfx('click'); act('atmosStormOff', [b.id], () => { toast('The storm front breaks up: the sky over there clears.', 'info'); refreshSheet(); }); };
    if ($('sh-sstop')) $('sh-sstop').onclick = () => { sfx('click'); act('sunderStop', [b.id], () => { toast('The Sundering Ray stands down: the blow is lost.', 'info'); refreshSheet(); }); };
    if ($('sh-suser')) $('sh-suser').onclick = () => { sfx('click'); const on = !b.sUseR; act('sunderReactor', [b.id, on], () => { toast(on ? `Use Reactor on: with a Reactor in reach the Ray winds up on it (${SUNDER.reactorCharge} s, ${SUNDER.uranium} Uranium or an Enriched Uranium a blow).` : 'Use Reactor off: with Generators in reach the Ray winds up on them and leaves the Uranium alone.', 'info'); refreshSheet(); }); };
    if ($('sh-lstop')) $('sh-lstop').onclick = () => { sfx('click'); act('lanceStop', [b.id], () => { toast('The Lance stands down: its charge is lost.', 'info'); refreshSheet(); }); };
    if ($('sh-luser')) $('sh-luser').onclick = () => { sfx('click'); const on = !b.lUseR; act('lanceReactor', [b.id, on], () => { toast(on ? `Use Reactor on: with a Reactor in reach the Lance charges on it (${LANCE.reactorCharge} s, ${LANCE.uranium} Uranium or an Enriched Uranium a shot).` : 'Use Reactor off: with Generators in reach the Lance charges on them and leaves the Uranium alone.', 'info'); refreshSheet(); }); };
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
      $('sh-pipe-offer').hidden = $('sh-pipe').hidden = true;
      delete $('sh-pipe-offer').dataset.tick;
      act('pipeToRefinery', [b.id], (r) => {
        if (r.why) { sfx('error'); toast(r.why, 'warn'); refreshSheet(); return; }
        const { n, owed } = r;
        sfx('place');
        toast(`Pipe laid from the Oil Pump to the Refinery (${n} tile${n === 1 ? '' : 's'}).` + (owed ? ` ${owed} tile${owed === 1 ? '' : 's'} wait for goods, paid from storage as they come in.` : ''), 'good');
      });
    };
    for (const btn of document.querySelectorAll('[id^="sh-air-ship-"]')) btn.onclick = () => { const u = getE(+btn.dataset.bot); if (u && !u.dead) { sfx('click'); openBotSheet(u); } };
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
    if ($('sh-focus')) $('sh-focus').onclick = () => startFocusAim(b);
    if ($('sh-focus-clear')) $('sh-focus-clear').onclick = () => act('focus', [[b.id], 0], () => { sfx('click'); toast(`The ${def.name} picks its own targets again.`, 'info'); refreshSheet(); });
    if ($('sh-sortie')) $('sh-sortie').onclick = () => {
      sfx('click');
      act('sortie', [b.id], (n) => {
        toast(n ? `${n} warbot${n === 1 ? '' : 's'} going out to fight: they come back in once it's clear.` : 'No warbots with Ammo inside to send out.', n ? 'good' : 'warn');
        refreshSheet();
      });
    };
    if ($('sh-callw')) $('sh-callw').onclick = () => act('callWorker', [b.id], (r) => {
      const u = r.uid ? getE(r.uid) : null;
      if (u) { sfx('order'); toast(r.already ? 'A worker is already on the way.' : b.built ? 'A worker is on the way.' : 'A builder is on the way.', 'info'); addFx('ring', u.x, u.y, { color: '#ffe45a' }); }
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
        // Co-op: something your partner placed less than a minute ago says so first.
        const fresh = typeof coopByMate === 'function' && coopByMate(b) && S.time - (b.born ?? -1e9) < COOP_CONFIRM_S;
        $('sh-demolish').textContent = fresh ? `${coopName(b.by)} placed this ${Math.max(1, Math.round(S.time - b.born))} s ago: tap again to dismantle it anyway`
          : BDEFS[b.type].mil && b.built ? 'Tap again: buildings outside your border will be lost' : 'Tap again to confirm';
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
    if ($('sh-napalm')) $('sh-napalm').onclick = () => napalmFromPanel(b.x, b.y, `the ground round the ${def.name}`);
    if ($('sh-mwreck')) $('sh-mwreck').onclick = () => {
      const on = !megaWrecking(b, ME);
      act('megaWreck', [b.id, on], (why) => {
        if (why) { sfx('error'); toast(why, 'warn'); return; }
        sfx('click'); toast(on ? `Your warbots will demolish the ${def.name}: they shoot it on past 0 until it's destroyed.` : `Your warbots will seize the ${def.name}: knocked out, they hold it ${MEGA.cap} s and it's yours.`, 'info');
        refreshSheet();
      });
    };
    if ($('sh-bomb')) $('sh-bomb').onclick = () => {
      const u = readyBomber(b);
      if (!u) { sfx('error'); toast('No Vulcan Bomber is ready that can reach it.', 'warn'); return; }
      act('strike', [u.id, b.id], (why) => {
        if (why) { sfx('error'); toast(why, 'warn'); return; }
        sfx('order'); toast(`Strike ordered on the ${def.name}: a bomber loads up and takes off.`, 'good'); refreshSheet();
      });
    };
  }
  refreshSheet();
}

/**
 * A megastructure's state on its panel (MEGA): knocked out (its seize clock, and who's at it), or seized and offline
 * (Bring it online: what it still needs, then a Worker).
 */
function megaParts(b, parts) {
  if (b.mDown) {
    const own = b.owner === ME, bar = b.mCap > 0 && b.mBy >= 0
      ? `<div class="kv"><span>Being seized</span><span>by ${b.mBy === ME ? 'you' : playerName(b.mBy)}: ${fmtSecs(MEGA.cap - b.mCap)} left</span></div><div class="bar"><div style="width:${Math.round((b.mCap / MEGA.cap) * 100)}%;background:${PLAYER_COLORS[b.mBy]}"></div></div>` : '';
    parts.push(`<div class="kv"><span>Knocked out</span><span><b class="err">Dark</b>, no use to anyone; ${own ? 'your Workers can\'t repair it' : 'its owner can\'t repair it'}</span></div>`);
    parts.push(`<div class="kv"><span>Seize it</span><span>Armed warbots within ${MEGA.reach} tiles for ${MEGA.cap} s, none of a foe's near${own ? ' (Army → Hold ground beside it)' : ''}</span></div>${bar}`);
  } else if (b.mOff) {
    const need = b.mNeed ? Object.keys(b.mNeed).map((g) => goodTag(g, b.mNeed[g], true)).join(' ') : '';
    parts.push(`<div class="kv"><span>Bring it online</span><span>${b.mNeed ? 'Needs a quarter of its cost, still to come (below: your Haulers carry it here), then a Worker' : b.fixer ? 'Paid: a Worker is bringing it online' : 'Paid: waiting for a free Worker to bring it online'}</span></div>${need ? `<div class="goodlist">${need}</div>` : ''}`);
  }
}

/** The building sheet's repair control: a Repair button (with its Cement cost) when it's damaged. */
function refreshFix(b) {
  const el = $('sh-fix'), def = BDEFS[b.type];
  let key, html = '';
  if (!b.built || b.armor >= def.armor - 0.05 || b.mDown || (b.mOff && !b.mReady)) { key = 'ok'; } // (a megastructure knocked out, or seized and not paid for: see megaParts)
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
  // (A site placed while the game is paused to plan hasn't been looked at by the game yet, b.unlinked unset: the
  // shortest road to storage says, so its Lay road is there at once.)
  const unlinked = b.unlinked ?? (planning() && ((r) => !r || r.length > 0 || r.pending > 0)(roadRouteTo(ME, b)));
  if (!unlinked) {
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
    if (why) { sfx('error'); toast(why, 'warn'); } else { sfx('place'); haptic('order'); toast(`Planned ${laid} road tile${laid === 1 ? '' : 's'}: free workers will pave them.`, 'info'); }
    el.dataset.key = '';
    refreshSheet();
  });
}

function refreshBuildingSheet(b) {
  const pipeOffer = $('sh-pipe-offer');
  if (pipeOffer && pipeOffer.dataset.tick !== String(Math.floor(S.tick / 30))) {
    pipeOffer.dataset.tick = String(Math.floor(S.tick / 30));
    const route = pipeToRefinery(ME, b);
    pipeOffer.hidden = $('sh-pipe').hidden = !!route.why;
    if (!route.why) $('sh-pipe').textContent = `Pipe it in: ${route.tiles.length} tile${route.tiles.length === 1 ? '' : 's'}, ${costText(route.cost)}`;
  }

  const def = BDEFS[b.type];
  const mine = b.owner === ME;
  if (mine && def.terminal && b.built) renderTrade(b);
  if (mine && def.yard && b.built) renderYard(b);
  const parts = [];
  if (mine && def.lab && $('sh-research')) refreshResearch();
  const gun = mine && b.underFire && !BDEFS[b.type].war ? gunOver(ME, b.x, b.y) : null;
  const foes = mine && !gun && !BDEFS[b.type].war && !(def.staff && b.staff) && foesAt(b); // (a staffed building says so itself)
  $('sh-status').textContent = gun ? `Under enemy fire: an enemy ${BDEFS[gun.type].name} covers it, so your robots keep clear until the gun is destroyed or runs dry.`
    : foes ? `${S.wildlife && S.mode === 'colony' ? 'The Murmur are' : S.wildlife ? 'Enemies (warbots or the Murmur) are' : 'Enemy warbots'} about: your workers and haulers keep clear of it until they've gone${S.wildlife && S.mode === 'colony' ? '' : ' (send warbots to drive them off)'}.`
    : mine && S.time - (b.noSafe ?? -99) < NOSAFE_WAIT * 2 ? 'No safe route: enemy defences in the way. Your carriers wait until the way is clear (destroy the guns, or build a road round them).'
    : mine && murmurShy(b) ? `Haulers turning back: Murmur near the road. Each turn-back in a row doubles the wait before the next is sent (now ${Math.round(shyRoadWait(b.shyN))}s, up to ${SHY_ROAD.max}s); send warbots to clear the road.`
    : mine ? b.status || '' : (b.built ? '' : 'Construction site');
  if ($('sh-why')) refreshWhy(b); // why it isn't making anything, down the supply chain (js/insight.js)
  if (!b.built) {
    parts.push(`<div class="bar"><div style="width:${Math.round(b.progress * 100)}%"></div></div>`);
    parts.push('<div class="section-label">Materials delivered</div><div class="goodlist">' +
      Object.keys(siteCost(b)).map((g) => goodTag(g, `${b.stock[g] || 0}/${siteCost(b)[g]}`, (b.stock[g] || 0) < siteCost(b)[g])).join('') + '</div>');
  } else {
    parts.push(`<div class="kv"><span>Armor</span><span>${Math.ceil(Math.max(0, b.armor))} / ${def.armor}</span></div>
      <div class="bar armor"><div style="width:${Math.max(0, (b.armor / def.armor) * 100)}%"></div></div>`);
    if (def.mega) megaParts(b, parts);
    if (mine && stormOverB(b)) parts.push(`<div class="kv"><span>Storm</span><span><b class="err">Under a rival's storm front</b>: robots slow, sites go up slower, guns reach less. Destroy its Atmosphere Engine, or build your own: its circle is calm</span></div>`);
    if (mine && def.staff) {
      const op = getE(b.staff);
      if (def.crews > 1) {
        // (A Roadworks takes two Pavers: how many it has, and how many are out working.)
        const crew = S.bots.filter((u) => !u.dead && u.task && u.task.type === 'staff' && u.task.bld === b.id);
        const out = crew.filter((u) => u.task.phase !== 'go' && u.inside !== b.id).length, coming = crew.filter((u) => u.task.phase === 'go').length;
        parts.push(`<div class="kv"><span>${BOTS[def.crew].plural}</span><span>${b.paused ? 'Paused' : `${crew.length - coming} of ${def.crews}${out ? `, ${out} out working` : ''}${coming ? `, ${coming} on the way` : ''}`}</span></div>`);
      } else parts.push(`<div class="kv"><span>${def.crew ? BOTS[def.crew].name : 'Worker'}</span><span>${b.paused ? 'Paused' : op ? (op.inside === b.id ? 'Inside' : 'Out working') : b.staffInc ? 'On the way' : 'None yet'}</span></div>`);
    }
    if (def.roadworks) {
      // Everything on the road network joined to the Roadworks is in reach (or just the marked roads).
      let fresh = 0, worn = 0, todo = 0;
      const nets = buildingNets(b), net = roadNet(b.owner), all = paveMode(b) === 'all';
      for (let t = 0; t < S.W * S.H; t++) {
        if (!S.road[t] || wayOwner(t) !== b.owner || !(all || S.paveMark[t]) || !onNets(net, t, nets)) continue;
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
    // Salvage warbots carried here (doLoot: b.loot), waiting for haulers to take it on to storage.
    if (mine && b.loot && !def.store) {
      const sal = Object.keys(b.loot).map((g) => [g, Math.floor(Math.min(b.loot[g], b.stock[g] || 0))]).filter(([g, n]) => n >= 1 && GOOD[g]);
      if (sal.length) parts.push(`<div class="kv"><span>Salvage</span><span>${sal.map(([g, n]) => goodTag(g, `${n} ${goodN(g, n)}`)).join(' ')}</span></div>` +
        `<p class="hint">Crates your warbots carried here. ${b.unlinked ? '<span class="err">No road joins it to storage:</span> lay one and haulers take them on.' : 'Haulers take them on to storage.'}</p>`);
    }
    if (b.upT > 30 && tracksUse(def)) {
      const pct = Math.round(((b.useT || 0) / b.upT) * 100);
      parts.push(`<div class="kv"><span>Busy</span><span>${pct}% of the time</span></div>${sparkline(b.useHist)}`);
    }
    if ((def.gather || def.farm) && mine && b.depleted) {
      parts.push(`<p class="desc err"><b>Nothing left to ${def.farm ? 'farm' : 'gather'} in reach.</b> Dismantle it (below): its materials and anything still in it are left in crates for your haulers to bring back. Then build a new ${def.name} ${def.farm ? 'beside open fertile soil' : `by a fresh field of ${RES[gatherRes(b.type)].name.toLowerCase()}s`}.</p>`);
    }
    if (def.gather) {
      const gr = gatherRes(b.type), g = RES[gr].good;
      parts.push(`<div class="kv"><span>${RES[gr].name}s in reach</span><span>${reachableRes(b.x, b.y, def.radius, gr)}</span></div>`);
      if (b.type === 'mine' && nukeOn()) parts.push(`<div class="kv"><span>Uranium deposits in reach</span><span>${reachableRes(b.x, b.y, def.radius, R_URANIUM)}</span></div>`);
      if (def.bedrock) parts.push(`<div class="kv"><span>Rock faces in reach</span><span>${rockFacesIn(b.x, b.y, def.radius)}</span></div>`);
      if (mine) parts.push(`<div class="kv"><span>Waiting for pickup</span><span>${goodTag(g, `${b.stock[g] || 0}/${def.out[g]}`)}</span></div>`);
    }
    if (def.plant) parts.push(`<div class="kv"><span>Stalk groves in reach</span><span>${reachableRes(b.x, b.y, def.radius, R_STALK)}</span></div>`);
    if (def.t2 && typeof t2Panel === 'function') parts.push(...t2Panel(b, mine)); // (Composter, Tree Nursery, Water Pump: js/terraform2.js)
    if (def.t3 && typeof t3Panel === 'function') parts.push(...t3Panel(b, mine)); // (Seam Drill, Seed Mast, Thermal Plant: js/terraform3.js)
    if ((def.t4 || def.sapexit) && typeof t4Panel === 'function') parts.push(...t4Panel(b, mine)); // (Sluice, Sap Head, Sap Exit: js/terraform4.js)
    if (def.farm) {
      const crops = reachableRes(b.x, b.y, def.radius, R_CROP), ripe = countResIn(b.x, b.y, def.radius, R_CROP, true, S.zone[tIdx(b.x, b.y)]);
      parts.push(`<div class="kv"><span>${S.wet ? 'Fertile or wet ground in reach' : 'Fertile soil in reach'}</span><span>${fertileIn(b.x, b.y, def.radius)} tiles</span></div>`);
      parts.push(`<div class="kv"><span>Crops planted</span><span>${crops}${crops ? ` (${ripe} ripe)` : ''}</span></div>`);
      if (mine) parts.push(`<div class="kv"><span>Waiting for pickup</span><span>${goodTag('fuel', `${b.stock.fuel || 0}/${def.out.fuel}`)}</span></div>`);
    }
    if (def.pump) {
      if (mine && pumpDry(b)) parts.push('<p class="desc err"><b>This seep has run dry.</b> Dismantle the pump (below): its materials and any Crude still in it are left in crates for your haulers to bring back. Then build a new Oil Pump on another oil seep.</p>');
      parts.push(`<div class="kv"><span>Crude left in the seep</span><span>${oilAround(b.x, b.y)}</span></div>`);
      if (mine) parts.push(`<div class="kv"><span>Waiting for pickup</span><span>${goodTag('crude', `${b.stock.crude || 0}/${def.out.crude}`)}</span></div>`);
      if (mine) {
        const joined = refineryPipes(ME), ns = buildingPipes(b);
        const direct = feedTargets(b).some(({ c, goods }) => (c.type === 'refinery' || BDEFS[c.type].tank) && goods.includes('crude'));
        const link = direct ? 'Direct feed to a neighbour' : pumpFeedsNextDoor(b) ? 'Direct feed when the neighbour is built'
          : ns.some((c) => joined.has(c)) ? 'to a Refinery' : b.piped ? 'to storage' : ns.length ? 'goes nowhere yet' : 'none: a Tanker collects';
        parts.push(`<div class="kv"><span>Crude delivery</span><span>${link}</span></div>`);
      }
      // (the bar stays while it waits, empty: the panel doesn't jump each time it starts and stops)
      if (mine) parts.push(`<div class="bar"><div style="width:${b.timer > 0 && /^Working/.test(b.status || '') ? Math.round((b.timer / def.work) * 100) : 0}%"></div></div>`);
    }
    if (mine && b.built && fuelUser(def)) {
      const fp = fuelPipes(ME), ns = buildingPipes(b);
      parts.push(`<div class="kv"><span>Fuel comes</span><span>${b.fuelByPipe ? 'by pipe' : ns.some((c) => fp.has(c)) ? 'by pipe (none to give just now)' : 'by Tanker'}</span></div>`);
    } else if (mine && b.built && fuelMaker(def) && buildingPipes(b).length) {
      parts.push(`<div class="kv"><span>Fuel goes</span><span>${b.pipedFuel ? 'by pipe, to storage and what burns it' : 'by pipe to what burns it; a Tanker takes the rest'}</span></div>`);
    }
    if (def.inp && mine && !def.pump && !def.compost) {
      const ins = Object.keys(def.inp).map((g) => goodTag(g, `${b.stock[g] || 0}/${def.hopper || INPUT_CAP}`, !(b.stock[g] > 0))).join(''); // (what it keeps on hand: a Smelter keeps 6)
      const outs = def.make ? Object.keys(def.make).map((g) => goodTag(g, `${b.stock[g] || 0}/${def.out[g]}`)).join('') : '';
      const recipe = Object.keys(def.inp).map((g) => GOOD[g].name).join(' + ') + ' → ' + (def.make ? Object.keys(def.make).map((g) => GOOD[g].name).join('') : 'a new bot');
      const slow = def.make && def.make.fuel && modFuelRate() < 1; // (Half Fuel, a challenge modifier)
      parts.push(`<div class="kv"><span>Recipe</span><span>${recipe}, ${slow ? `${def.work / modFuelRate()}s (Half Fuel)` : `${def.work}s`}</span></div>`);
      parts.push(`<div class="section-label">Inputs</div><div class="goodlist">${ins}</div>`);
      if (outs) parts.push(`<div class="section-label">Output</div><div class="goodlist">${outs}</div>`);
      if (def.bots) {
        const k = nextBotKind(b);
        const need = (BOTS[k] && BOTS[k].parts) || 1;
        parts.push(`<div class="kv"><span>Next bot</span><span>${BOTS[k] ? BOTS[k].name + (need > 1 ? ` (part ${Math.min(need, foundryParts(b, k) + 1)} of ${need})` : '') : 'Nothing ordered'}</span></div>`);
      }
      // The bar stays while it waits, empty, so the buttons below don't jump each time it starts and stops.
      parts.push(`<div class="bar"><div style="width:${b.timer > 0 && /^Working/.test(b.status || '') ? Math.round((b.timer / def.work) * 100) : 0}%"></div></div>`);
    }
    // Feed links: what it passes straight on to its neighbours, and what they pass to it.
    if (mine && b.built) {
      const linkText = (l, b2) => `${BDEFS[b2.type].name} (${l.goods.map((g) => GOOD[g].name).join(', ')})`;
      const feeds = feedTargets(b), by = feedersOf(b);
      if (feeds.length) parts.push(`<div class="kv"><span>Feeds by conveyor</span><span>${feeds.map((l) => linkText(l, l.c)).join('; ')}</span></div>`);
      if (by.length) parts.push(`<div class="kv"><span>Fed by conveyor</span><span>${by.map(({ from, link }) => linkText(link, from)).join('; ')}${def.tank ? '' : ', a tenth faster while fed'}</span></div>`); // (always said, so the line doesn't wrap and unwrap: the status says when it's fed)
      const sb = !def.store && stationBeside(b);
      if (sb && stationLinks(sb).some((l) => l.c === b)) parts.push(`<div class="kv"><span>Rail Station</span><span>joined by conveyor: it hands this its goods${def.out ? ' and takes its output' : ''}</span></div>`);
      else if (b.railBy) {
        const sv = getE(b.railBy);
        if (sv && sv.type === 'depot') parts.push(`<div class="kv"><span>Supplied by Road Train</span><span>through the Depot ${dirText(b, sv)}</span></div>`);
        else parts.push(`<div class="kv"><span>Supplied by rail</span><span>from the Rail Station ${dirText(b, sv || b)}</span></div>`);
      }
    }
    if (def.tank) {
      // A Fuel Tank: how full it is, and what that would mean if it went up now (see fuelBlast).
      const held = liquidIn(b), full = Math.min(1, held / def.tank), B = BLAST.fueltank, r = B.r0 + B.r1 * full;
      parts.push(`<div class="kv"><span>Crude and Fuel</span><span>${held} / ${def.tank} (${b.stock.crude || 0} Crude, ${b.stock.fuel || 0} Fuel)</span></div>`);
      parts.push(`<div class="bar"><div style="width:${Math.round(full * 100)}%;background:#ff9a3c"></div></div>`);
      if (mine) parts.push(`<div class="kv"><span>If it's destroyed now</span><span${full > 0.5 ? ' class="err"' : ''}>a blast ${Math.round(r * 10) / 10} tiles round, setting off Refineries, Fuel Tanks and loaded Tankers in it</span></div>`);
    }
    if (def.store && mine && !def.terminal && !def.tank) {
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
    if (def.ammo && mine && !def.missile && !def.disrupt && !def.mortar && !def.minigun && !def.flak && !def.dome) parts.push(`<div class="kv"><span>Ammo</span><span>${b.shots + (b.stock.crystal || 0) * shotsPer(b)} shots</span></div>`);
    if (def.missile && mine) {
      parts.push(`<div class="kv"><span>Missiles loaded</span><span>${goodTag('warhead', `${b.stock.warhead || 0}/${def.ammoCap}`)}</span></div>`);
      parts.push(`<div class="kv"><span>Each hit</span><span>${def.missile.damage} damage, ${def.missile.splashDamage} to buildings within ${def.missile.splash} tiles</span></div>`);
      parts.push(`<div class="kv"><span>Reload</span><span>${b.reload > 0 ? Math.ceil(b.reload) + 's' : 'Ready'}</span></div>`);
      parts.push(`<div class="kv"><span>Range</span><span>${def.missile.range} tiles</span></div>`);
    }
    if (def.lance) {
      const pw = lancePower(b), gens = megaGens(b, LANCE.reach).length, rx = lanceReactor(b);
      const T = lanceTime(b);
      if (b.lOn) parts.push(`<div class="kv"><span>Charge</span><span>${Math.floor((b.lCharge / T) * 100)}%${b.lCharge >= T ? ' (ready to fire)' : `, fires in ${fmtSecs(T - b.lCharge)}`}</span></div><div class="bar"><div style="width:${Math.round((b.lCharge / T) * 100)}%;background:#ff6a3a"></div></div>`);
      if (mine) {
        // Which power the next (or this) charge uses and what a shot costs: "Reactor, 2 Uranium a shot, 45 s charge".
        const src = b.lOn ? b.lSrc : pw, cost = rx && (rx.stock.uranium || 0) >= LANCE.uranium ? `${LANCE.uranium} Uranium` : 'an Enriched Uranium';
        parts.push(`<div class="kv"><span>Power</span><span>${src === 'reactor' ? `Reactor, ${b.lOn ? 'its Uranium in' : `${cost} a shot`}, ${LANCE.reactorCharge} s charge, ${Math.round(LANCE.reactorReload / 60)} min reload`
          : src === 'gen' ? `${gens} Generator${gens === 1 ? '' : 's'}, extra Fuel while charging, ${LANCE.charge} s charge, ${Math.round(LANCE.reload / 60)} min reload`
          : `<b>None</b>: ${gens} of ${LANCE.gens} Generators with Fuel${rx ? `, a Reactor with ${rx.stock.uranium || 0} of ${LANCE.uranium} Uranium and no Enriched Uranium` : ''}`}</span></div>`);
        parts.push(`<div class="kv"><span>Reload</span><span>${b.lReload > 0 ? fmtSecs(b.lReload) : 'Ready'}</span></div>`);
      }
    }
    if (def.sunder) {
      const pw = sunderPower(b), gens = megaGens(b, SUNDER.reach).length, rx = sunderReactor(b), T = sunderTime(b);
      if (b.sOn) parts.push(`<div class="kv"><span>Winding up</span><span>${b.sMode === 'deep' ? 'Strike the Deep' : 'Quake'}: ${Math.floor((b.sCharge / T) * 100)}%, fires in ${fmtSecs(T - b.sCharge)}${sunderLocked(b) ? ' (the ring is showing: aim fixed)' : ''}</span></div><div class="bar"><div style="width:${Math.round((b.sCharge / T) * 100)}%;background:#ff9a3a"></div></div>`);
      if (mine) {
        const src = b.sOn ? b.sSrc : pw;
        parts.push(`<div class="kv"><span>Power</span><span>${src === 'reactor' ? `Reactor, ${b.sOn ? 'its Uranium in' : `${SUNDER.uranium} Uranium a blow`}, ${SUNDER.reactorCharge} s wind-up, ${Math.round(SUNDER.reactorReload / 60)} min reload`
          : src === 'gen' ? `${gens} Generator${gens === 1 ? '' : 's'}, extra Fuel while it winds up, ${SUNDER.charge} s wind-up, ${Math.round(SUNDER.reload / 60)} min reload`
          : `<b>None</b>: ${gens} of ${SUNDER.gens} Generators with Fuel${rx ? '' : ', and no Reactor with Uranium in reach'}`}</span></div>`);
        parts.push(`<div class="kv"><span>Reload</span><span>${b.sReload > 0 ? fmtSecs(b.sReload) : 'Ready'}</span></div>`);
        parts.push(`<div class="kv"><span>Reach</span><span>Strike the Deep: anywhere, a ${SUNDER.deep}-tile circle · Quake: ${SUNDER.range} tiles, a ${SUNDER.quake}-tile circle</span></div>`);
      }
      if (b.sLure && wildOn() && b.sLure >= murmurNights(S.time)) parts.push(`<div class="kv"><span>The Murmur</span><span><b>They heard it</b>: ${murmurNight(S.time) && b.sLure === murmurNights(S.time) ? 'tonight' : 'the next night'} the nests within ${SUNDER.lure} tiles come for it first</span></div>`);
    }
    if (def.dome) {
      const st = b.dDown ? `Down: back in ${fmtSecs(b.dDown - S.time)}` : b.dUp ? 'Up' : 'Down';
      parts.push(`<div class="kv"><span>Shield</span><span>${st}, ${Math.floor(b.dStr ?? DOME.max)} of ${DOME.max} strength</span></div><div class="bar"><div style="width:${Math.round(((b.dStr ?? DOME.max) / DOME.max) * 100)}%;background:#5ab8ff"></div></div>`);
      if (mine) {
        parts.push(`<div class="kv"><span>Crystal</span><span>${goodTag('crystal', `${b.stock.crystal || 0}/${def.ammoCap}`, !(b.stock.crystal > 0))} (one every ${DOME.crystal} s while up)</span></div>`);
        parts.push(`<div class="kv"><span>Power</span><span>${domePowered(b) ? 'A Generator with Fuel in reach' : `<b>None</b>: it needs a Generator with Fuel within ${DOME.reach} tiles`}</span></div>`);
        parts.push(`<div class="kv"><span>Covers · hits</span><span>${DOME.radius} tiles round it · Missile ${DOME.cost.missile}, bomb ${DOME.cost.bomb}, shell ${DOME.cost.shell}</span></div>`);
      }
    }
    if (def.lift && b.built) {
      const c = b.lfMove === 1 ? 'coming down' : b.lfMove === 2 ? 'going up' : 'at the anchor';
      parts.push(`<div class="kv"><span>Fall line</span><span>${liftLen()} tiles ${LIFT_DIR_NAMES[b.lfDir || 0]} (drawn on the map): if an enemy destroys it, the cable comes down there${b.armor < def.armor * LIFT.weak ? ': <b class="err">cable unstable</b>' : ''}</span></div>`);
      if (b.owner !== ME) parts.push(`<div class="kv"><span>Climber</span><span>${c}${b.lfMove === 1 && b.lfPaid ? `: lands in ${fmtSecs(Math.max(0, LIFT.climb - (b.lfT || 0)))}` : ''}</span></div>`);
    }
    if (def.deepcore && b.built) {
      // Its depth gauge: three lamps (the stages), and how far down the shaft is toward the next.
      const st = b.dcStage || 1, T = b.dcT || 0, lamps = [1, 2, 3].map((k) => `<span class="dc-lamp${k <= st ? ' on' : ''}" title="Stage ${k}: ${DEEP_STAGE_NAMES[k - 1]}"></span>`).join('');
      const nx = st < 3 ? DEEP.stages[st] : 0, f = st < 3 ? (T - DEEP.stages[st - 1]) / (nx - DEEP.stages[st - 1]) : 1;
      parts.push(`<div class="kv"><span>Depth</span><span>${lamps} Stage ${st}, ${DEEP_STAGE_NAMES[st - 1]}${st < 3 ? `: stage ${st + 1} after ${fmtSecs(nx - T)} more of power` : ': at its deepest'}</span></div><div class="bar"><div style="width:${Math.round(Math.max(0, Math.min(1, f)) * 100)}%;background:#a77cff"></div></div>`);
      const R = deepRates(b), out = Object.keys(R).map((g) => g === 'uranium' ? `a Uranium every ${Math.round(1 / R[g])} min` : `${R[g]} ${GOOD[g].name} a minute`).join(', ');
      parts.push(`<div class="kv"><span>Brings up</span><span>${out}${b.armor < def.armor * DEEP.weak ? ' (<b class="err">half</b>: it is damaged, and goes no deeper)' : ''}</span></div>`);
      if (mine) {
        parts.push(`<div class="kv"><span>Hoppers</span><span>${['ore', 'crystal', 'uranium'].map((g) => goodTag(g, `${Math.floor(b.stock[g] || 0)}/${DEEP.cap}`, (b.stock[g] || 0) >= DEEP.cap)).join(' ')} (Haulers carry them off)</span></div>`);
        parts.push(`<div class="kv"><span>Power</span><span>${b.dcSrc === 'reactor' ? 'A Nuclear Reactor in reach (no Uranium used)' : b.dcSrc === 'gen' ? `A Generator in reach: a Fuel every ${Math.round(DEEP.genFuel / 60)} minute` : `<b>None</b>: a Generator with Fuel within ${DEEP.reach} tiles, or a Nuclear Reactor`}</span></div>`);
      }
      if (b.dcCall && murmurCfg()) parts.push(`<div class="kv"><span>Heard below</span><span><b class="err">${b.dcCall >= 3 ? 'The next night the Deep answers: Brutes, and a new tunnel exit by it' : 'The next night a bigger raid comes for it'}</b></span></div>`);
    }
    if (def.atmos && b.built) {
      // Its four stages as lamps (Calm, Rain, Green, Garden), how far its change has spread, and the time to the next.
      const st = b.aeStage || 1, T = b.aeT || 0, lamps = [1, 2, 3, 4].map((k) => `<span class="ae-lamp ae-l${k}${k <= st ? ' on' : ''}" title="Stage ${k}: ${ATMOS_STAGE_NAMES[k - 1]}, ${ATMOS.r[k - 1]} tiles"></span>`).join('');
      const nx = st < 4 ? ATMOS.stages[st] : 0, f = st < 4 ? (T - ATMOS.stages[st - 1]) / (nx - ATMOS.stages[st - 1]) : 1;
      parts.push(`<div class="kv"><span>Stage</span><span>${lamps} ${st}, ${ATMOS_STAGE_NAMES[st - 1]}${st < 4 ? `: ${ATMOS_STAGE_NAMES[st]} after ${fmtSecs(nx - T)} more of power` : ': the last'}</span></div><div class="bar"><div style="width:${Math.round(Math.max(0, Math.min(1, f)) * 100)}%;background:#7ee08a"></div></div>`);
      const what = ['no dust storm', 'rain at night, barren ground fertile, the Bloom held back', 'grass, crops a quarter faster, the Bloom withering', 'groves seeding themselves, no Bloom and no Murmur exit'];
      parts.push(`<div class="kv"><span>Its circle</span><span>${Math.round(atmosReach(b))} of ${ATMOS.r[st - 1]} tiles round it: ${what.slice(0, st).join('; ')}${st >= 2 ? `; enemy robots in it wade through mud at ${Math.round(ATMOS.mud * 100)}% speed, and while it has power enemy Torches can't burn there` : ''}. The calm${st >= 3 ? ' and the faster crops are' : ' is'} its owner's and allies' only</span></div>`);
      if (b.aeStorm && st >= 2) parts.push(`<div class="kv"><span>Storm Front</span><span>${atmosStormOn(b) ? `Over the ground at ${b.aeStorm[0]}, ${b.aeStorm[1]}, ${STORM.r} tiles round${st >= 4 ? ', lightning about once a minute' : ''}` : 'Gone while it has no power: it comes back where it was'}</span></div>`);
      if (mine) parts.push(`<div class="kv"><span>Power</span><span>${b.aeSrc === 'reactor' ? `A Nuclear Reactor in reach: a Uranium every ${Math.round(ATMOS.uEvery / 60)} minutes` : b.aeSrc === 'gen' ? `${ATMOS.gens} Generators in reach: a Fuel a minute from each` : `<b>None</b>: ${ATMOS.gens} Generators with Fuel within ${ATMOS.reach} tiles, or a Nuclear Reactor. Its land stays as it is`}</span></div>`);
      if (b.aeCall && murmurCfg()) parts.push(`<div class="kv"><span>The Bloom</span><span><b class="err">Fights back the next night: ${ATMOS.sappers[b.aeCall - 1]} Sapper${ATMOS.sappers[b.aeCall - 1] === 1 ? '' : 's'} will dig in under it</b></span></div>`);
      else if (murmurCfg()) parts.push(`<div class="kv"><span>The Murmur</span><span>They hate it: every night they go for it first</span></div>`);
    }
    if (def.city && b.built) {
      const m = bCentre(b), mineNear = S.buildings.filter((e) => !e.dead && e.built && e.owner === b.owner && e !== b && (BDEFS[e.type].staff || BDEFS[e.type].inp) && dist2(e.x + 0.5, e.y + 0.5, m.x, m.y) <= CITY.reach * CITY.reach).length;
      const pct = Math.round(CITY.boost * 100 * (b.cDry ? CITY.dark : 1));
      parts.push(`<div class="kv"><span>Arrival drive</span><span>${b.cDown ? `<b>Off</b>: it is ${b.mDown ? 'knocked out' : 'offline'}` : `+${pct}% work`} within ${CITY.reach} tiles: ${mineNear} building${mineNear === 1 ? '' : 's'} of ${b.owner === ME ? 'yours' : 'theirs'}, and Workers building there</span></div>`);
      parts.push(`<div class="kv"><span>Land</span><span>${CITY.land} tiles round its middle; it counts twice for Domination</span></div>`);
      if (mine) parts.push(`<div class="kv"><span>Lights</span><span>${goodTag('fuel', `${b.stock.fuel || 0}/${def.fuelCap}`, !(b.stock.fuel > 0))} (a Fuel a minute at night)${b.cDry ? ': <b>dark</b>, its bonus halved' : ''}</span></div>`);
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
        // (A Fuel Station holds up to its fuelCap; storage with chargers, a Drop Outpost or a Crawler, burns the Fuel in its
        // store, kept there by its supply order: no cap of its own.)
        const have = b.stock.fuel || 0, order = (b.keep && b.keep.fuel) || 0;
        const amt = def.store ? (order ? `${have}/${order}` : `${have} · no supply order`) : `${have}/${def.fuelCap}`;
        parts.push(`<div class="kv"><span>Fuel stocked</span><span>${goodTag('fuel', amt, !(have > 0))}</span></div>`);
        parts.push(`<div class="kv"><span>Fuel burning</span><span>${pct}% left</span></div><div class="bar battery"><div style="width:${pct}%;background:var(--g-fuel)"></div></div>`);
      }
    }
  }
  $('sh-dyn').innerHTML = parts.join('');
  if ($('sh-road')) refreshRoadLink(b);
  if ($('sh-fix')) refreshFix(b);
  if ($('sh-aim') && def.lance) {
    const why = b.lOn ? '' : lanceBlocked(b);
    $('sh-aim').disabled = !!why;
    $('sh-aim').textContent = b.lOn ? 'Change the aim' : 'Aim the Lance';
    $('sh-aim-hint').textContent = why || (b.lOn ? 'Charging: tap Change the aim to turn it onto another line before it fires.' : `Tap Aim, then any spot: it charges for ${lanceTime(b)} s, then fires a beam from the gun through that spot right across the map. Everything its 2-tile core touches is destroyed, yours too; the edge either side is scorched to half armor.`);
    if ($('sh-lstop')) $('sh-lstop').hidden = !b.lOn;
    if ($('sh-luser')) {
      $('sh-luser').textContent = `Use Reactor: ${b.lUseR ? 'On' : 'Off'}`; $('sh-luser').setAttribute('aria-pressed', b.lUseR ? 'true' : 'false'); $('sh-luser').classList.toggle('on', !!b.lUseR);
      $('sh-luser-hint').textContent = `With Generators and a Reactor both in reach: On charges on the Reactor (${LANCE.reactorCharge} s, reload ${Math.round(LANCE.reactorReload / 60)} min, ${LANCE.uranium} Uranium or an Enriched Uranium a shot); Off uses the Generators (${LANCE.charge} s, reload ${Math.round(LANCE.reload / 60)} min) and saves the Uranium for a nuke. A Reactor alone is always used.`;
    }
  } else if (def.sunder && $('sh-sdeep')) {
    const why = b.sOn ? (sunderLocked(b) ? 'The ring is showing: the aim is fixed now.' : '') : sunderBlocked(b), deepWhy = sunderDeepOn() ? '' : 'No Murmur in this game.';
    $('sh-sdeep').disabled = !!why || !!deepWhy; $('sh-squake').disabled = !!why;
    $('sh-sdeep').textContent = b.sOn && b.sMode === 'deep' ? 'Move the Strike' : 'Strike the Deep';
    $('sh-squake').textContent = b.sOn && b.sMode === 'quake' ? 'Move the Quake' : 'Quake';
    $('sh-saim-hint').textContent = why || (b.sOn ? 'Winding up: tap either to turn it onto another spot before it fires (a Quake\'s aim is fixed once its ring shows).'
      : `${deepWhy ? deepWhy + ' ' : `Strike the Deep: anywhere, a ${SUNDER.deep}-tile circle where the Murmur's tunnels cave in. `}Quake: within ${SUNDER.range} tiles, a ${SUNDER.quake}-tile circle; buildings lose ${Math.round(SUNDER.dmg * 100)}% of their armor and crack. It winds up for ${sunderTime(b)} s.`);
    if ($('sh-sstop')) $('sh-sstop').hidden = !b.sOn;
    if ($('sh-suser')) {
      $('sh-suser').textContent = `Use Reactor: ${b.sUseR ? 'On' : 'Off'}`; $('sh-suser').setAttribute('aria-pressed', b.sUseR ? 'true' : 'false'); $('sh-suser').classList.toggle('on', !!b.sUseR);
      $('sh-suser-hint').textContent = `With Generators and a Reactor both in reach: On winds up on the Reactor (${SUNDER.reactorCharge} s, reload ${Math.round(SUNDER.reactorReload / 60)} min, ${SUNDER.uranium} Uranium a blow); Off uses the Generators (${SUNDER.charge} s, reload ${Math.round(SUNDER.reload / 60)} min). A Reactor alone is always used.`;
    }
  } else if (def.atmos && $('sh-storm')) {
    const left = Math.ceil(STORM.cd - (S.time - (b.aeStormT ?? -1e9))), st = b.aeStage || 1;
    const why = st < 2 ? `Comes with stage 2, Rain: ${fmtSecs(Math.max(1, Math.ceil(ATMOS.stages[1] - (b.aeT || 0))))} more of power.` : !b.aeSrc ? 'No power: no storm. Feed its Generators.' : left > 0 ? `The sky is still turning: it can be moved again in ${fmtSecs(left)}.` : '';
    $('sh-storm').disabled = !!why;
    $('sh-storm').textContent = b.aeStorm ? 'Move the storm' : 'Storm Front';
    $('sh-storm-hint').textContent = why || `Tap Storm Front, then a spot anywhere on the map (not within ${ATMOS.r[st - 1] + STORM.r} tiles of the Engine, nor in another Engine's circle): a ${STORM.r}-tile storm sits there while the Engine has power. Under it enemy robots move at ${Math.round(STORM.slow * 100)}% speed, their sites go up at ${Math.round(STORM.build * 100)}% and their guns reach ${Math.round(STORM.range * 100)}% as far${st >= 3 ? '; their crops stop growing and wither after ' + Math.round(STORM.drought / 60) + ' minutes' : ' (from Green, their crops wither too)'}${st >= 4 ? '; lightning strikes one of their buildings about once a minute' : ' (at the Garden, lightning)'}. A minute before it can be moved again.`;
    if ($('sh-stormoff')) $('sh-stormoff').hidden = !b.aeStorm;
  } else if ($('sh-aim') && def.nukeSilo) {
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
  if ($('sh-focus-txt')) {
    const t = b.focus ? getE(b.focus) : null, R2 = focusReach(b);
    $('sh-focus-txt').innerHTML = t && !t.dead ? `<b>${focusName(t)}</b>${b.focusOut !== undefined ? ' (out of reach)' : ''}` : 'Auto: its own pick';
    $('sh-focus-clear').disabled = !b.focus;
    const reach = `${R2.min ? `${R2.min} to ${Math.round(R2.max * 10) / 10}` : `within ${Math.round(R2.max * 10) / 10}`} tiles`;
    $('sh-focus-hint').textContent = (onTouch() ? `Tap Aim, then an enemy ${focusKinds(b)} ${reach}: it fires at that one alone while it's in reach.`
      : `Right-click an enemy ${focusKinds(b)} ${reach} (or Aim, then click it): it fires at that one alone while it's in reach. Shift+right-click aims every defence that reaches it.`) +
      ` It goes back to its own pick when the enemy falls, or ${FOCUS_GRACE} s after it slips out of reach.`;
  }
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
      el.innerHTML = bs.length ? bs.map((u, k) => `<div class="kv trade-row"><span>Bomber ${k + 1}<small>${planeStatus(u)} · Fuel tank ${Math.round(u.bat ?? 100)}%</small>${fuelGauge(u)}</span>${strikeWaiting(u) ? `<button class="btn small" data-cancel="${u.id}" title="Call the strike off: the bomb's Ammo goes back into the Airfield">Cancel strike</button>` : `<button class="btn small primary" data-b="${u.id}" ${u.mission || u.flight ? 'disabled' : ''}>Strike</button>`}</div>`).join('') +
        `<p class="hint">A sortie takes ${BOMBER.ammo} Ammo (this Airfield keeps some for them; haulers bring it) and ${BOMBER.fuel} Fuel on top of what its tank needs (Tankers bring it): it can't take off without both. Back on the ground a bomber needs ${BOMBER.rearm} s to rearm. Until it takes off, <b>Cancel strike</b> calls a sortie off (any Ammo it loaded comes back). <b>Strike</b> lets you pick its payload: a bomb, or <b>Napalm</b> (${NAPALM.fuel} more Fuel, no Ammo) for any ground, which burns fertile soil for good. Or open a rival building and tap <b>Bomb it</b> or <b>Napalm</b>.</p>`
        : '<p class="hint">None based here: order Vulcan Bombers in the hangar below (two fit).</p>';
      for (const btn of el.querySelectorAll('button[data-b]')) btn.onclick = () => { const u = getE(+btn.dataset.b); if (u) { sfx('click'); startStrike(u); } };
      for (const btn of el.querySelectorAll('button[data-cancel]')) btn.onclick = () => callOffStrike(+btn.dataset.cancel);
    }
  }
  if ($('sh-air-places')) $('sh-air-places').textContent = airPlacesText(b);
  if ($('sh-airsup')) {
    const road = airSupplyRoad(b); // (On is greyed out where a road from home reaches)
    for (const btn of $('sh-airsup').children) { btn.classList.toggle('on', (btn.dataset.v === '1') === !!b.airSupply); btn.disabled = road && btn.dataset.v === '1'; }
    $('sh-airsup-hint').textContent = airSupplyHint(b);
  }
  if ($('sh-dauto-status')) {
    for (const btn of $('sh-auto').children) btn.classList.toggle('on', (btn.dataset.v === '1') === !b.autoOff);
    $('sh-dauto-status').innerHTML = depotAutoText(b);
    $('sh-dauto-hint').textContent = `Auto supply: a Depot ${TRUCK_MIN_DIST} or more tiles from your Command Base keeps what the factories, garrisons and building sites round it need (twice what a factory holds, what a site still lacks, never what they make), and a Road Train brings it from home once that makes a load (${TRAIN_MIN_LOAD} or more), several goods a trip, taking the Depot's spare goods home. Haulers do the short hop to each building. Supply orders you set below come on top.`;
  }
  if ($('sh-mast')) {
    for (const btn of $('sh-auto').children) btn.classList.toggle('on', (btn.dataset.v === '1') === !b.autoOff);
    renderMastSection(b);
  }
  if ($('sh-md')) renderMdSection(b);
  if ($('sh-lift')) renderLiftSection(b);
  if ($('sh-gup')) renderGupSection(b);
  if ($('sh-mag')) {
    for (const btn of $('sh-auto').children) btn.classList.toggle('on', (btn.dataset.v === '1') === !b.autoOff);
    renderMagSection(b);
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
    $('sh-keep-hint').textContent = BDEFS[b.type].tank ? (!want ? 'Set the least Fuel or Crude to keep in this tank: Tankers and Haulers bring more from your other storage whenever it drops below, and it isn\'t drawn on below that for other storage.'
      : `${short ? 'Topping it up' : 'Stocked to your minimum'}. Tankers and Haulers bring more whenever it drops below.`) : !want
      ? 'Set how much of each good to keep here, and haulers and Freight Trucks bring it from your other storage. Buildings and roads near here then draw on it.'
      : `${short ? `Filling ${short} order${short > 1 ? 's' : ''}` : 'Fully stocked'}. ` + (b.airSupply && !onHomeNet(b) ? `A Cargo Plane flies them in, ${BOTS.cargoplane.carry} goods a flight (see Supply by air).`
        : b.mdFar && mdFed(b) ? 'Its Mass Driver throws them in by canister, with what the buildings round it need.'
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
  if ($('sh-mwreck')) {
    const w = megaWrecking(b, ME);
    $('sh-mwreck').textContent = w ? 'Seize it instead' : 'Demolish it';
    $('sh-mwreck').classList.toggle('danger', !w);
    $('sh-mwreck-hint').textContent = w ? `Ordered demolished: your warbots shoot it on past 0 until it's destroyed, and part of its goods spill out in crates.`
      : `Beaten to 0 by your warbots it is knocked out, not wrecked: hold it ${MEGA.cap} s and it's yours, then bring it online for a quarter of its cost. Demolish it to destroy it instead.`;
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
  if (BOTS[u.type].airship) { const st = shipStatus(u); return st[0].toUpperCase() + st.slice(1); }
  if (BOTS[u.type].magpod) { const st = podStatus(u); return st[0].toUpperCase() + st.slice(1); }
  if (BOTS[u.type].air) { const b = getE(u.home); return `${planeStatus(u)[0].toUpperCase()}${planeStatus(u).slice(1)}` + (b && !b.dead ? ` (based at the Airfield ${dirText(getE(S.players[u.owner].lander) || b, b)} from the Command Base)` : ' (no Airfield yet)'); }
  const nm = (id) => { const b = getE(id); return b ? BDEFS[b.type].name : 'a building'; };
  if (recyclingNow(u)) return `Being taken apart at the Bot Foundry (${Math.max(1, Math.ceil(recycleTime(u.type) - t.t))} s)`;
  if (t && t.type === 'recycle') return u.packing ? 'Going to be recycled: packing up first' : 'Going to be recycled at the Bot Foundry';
  if (u.recycleTo) return 'Going to be recycled: taking cover from enemy warbots first, then on to the Bot Foundry';
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
      if (t.type === 'scorch') return t.spray > 0 ? 'Scorching the earth: burning a patch of farmland for good' : 'Off to scorch a patch of farmland';
      if (t.wait > S.time) return 'Waiting to set off with its squad'; // (staggered departure: paceSquad)
      if (t.type === 'attack' && t.reload) return u.type === 'torch' ? 'Tank empty: refilling it, then back to the attack' : 'Out of Ammo: reloading, then back to the attack';
      if (t.type === 'attack') return `Attacking the rival ${nm(t.target)}`;
      if (t.type === 'ewshoot') return `Shooting ${ewOwner(t.tile) === u.owner ? 'our own' : ewOwner(t.tile) >= 0 && !foes(ewOwner(t.tile), u.owner) ? 'an ally\'s' : 'the rival\'s'} ${EW_NAMES[S.ewK && S.ewK[t.tile]] || 'earthwork'} (${S.ewH ? S.ewH[t.tile] : 0} strength left)`;
      if (t.type === 'defend' && t.ax !== undefined) return `Defending a building near the ${nm(t.home)}`; // (area defence: garrisonDefense)
      if (t.type === 'defend') return `Defending the ${nm(t.home)}`;
      if (t.type === 'hold') return t.phase === 'recharge' ? 'Battery flat: going to recharge' : t.target ? `Attacking the rival ${nm(t.target)}` : u.grp && agById(u.grp) && agById(u.grp).flag === t.rally ? `The ${agById(u.grp).name}: ${agDoing(agById(u.grp)).replace(/^Paused: under your orders$/, 'holding (paused)')}` : 'Holding the rally point';
      if (t.type === 'repair') return u.retreat ? 'Badly hurt: pulling out of the fight for repairs' + (u.resume ? ', then back to it' : '') : 'Going for repairs';
      if (t.type === 'topup') return 'Topping up its battery';
      if (t.type === 'refill') return `Tank empty: going to refill it with Fuel at the ${nm(t.bld)}` + (u.resume ? ', then back to it' : '');
      if (t.type === 'loot') return t.phase === 'home' ? 'Carrying a crate of loot home' : 'Going to pick up loot';
      if (t.type === 'escort') { const c = getE(t.bot); return c && !c.dead && c.inside ? 'Escorting a trade convoy: waiting with it at the Trade Post' : c && !c.dead && dist2(c.x, c.y, u.x, u.y) <= 2.6 ? 'Escorting a trade convoy: riding along' : 'Escorting a trade convoy: catching up with it'; }
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
  if (t.type === 'dock') return 'Trade convoy: waiting at the Trade Post for the ledger to take its run';
  if (t.type === 'haul' && u.trade) return t.dst === u.trade ? (t.phase === 'toSrc' ? `Trade convoy: loading ${GOOD[t.good].name} at the ${nm(t.src)}` : `Trade convoy: taking ${GOOD[t.good].name} out to the Trade Terminal`) : t.phase === 'toSrc' ? `Trade convoy: going to the Trade Post for its ${GOOD[t.good].name}` : `Trade convoy: bringing ${GOOD[t.good].name} home from the Trade Post`;
  if (t.type === 'salvage') return t.phase === 'cut' ? 'Salvaging scrap: cutting it up for Alloy' : 'Driving out to salvage scrap';
  if (t.type === 'dammend') return t.phase === 'go' ? 'Walking to shore up the dam' : 'Shoring up the dam';
  if (t.type === 'strip') { const r = townById(t.r), nm = r ? TOWN_KINDS[r.k].name.replace(/^The /, 'the ').toLowerCase() : 'a building'; return t.phase === 'go' ? `Walking to strip ${/^the /.test(nm) ? nm : aOrAn(nm)}` : `Stripping ${/^the /.test(nm) ? nm : aOrAn(nm)} for salvage`; }
  if (t.type === 'haul') return t.phase === 'toSrc' ? `Fetching ${GOOD[t.good].name} from the ${nm(t.src)}` : `Delivering ${GOOD[t.good].name} to the ${nm(t.dst)}`;
  if (t.type === 'build') { const a = getE(t.site) ? aOrAn(nm(t.site)) : 'a building'; return t.phase === 'go' ? `Walking to build ${a}` : t.phase === 'wait' ? `Waiting at ${a} for goods on their way` : `Constructing ${a}`; }
  if (t.type === 'staff') {
    const b = getE(t.bld), def = b ? BDEFS[b.type] : {};
    if (t.phase === 'go') return `Walking to its job at the ${nm(t.bld)}`;
    if (def.farm && (t.phase === 'toNode' || t.phase === 'work')) {
      return t.act === 'harvest' ? (t.phase === 'work' ? 'Harvesting an energy crop' : 'Heading out to harvest a crop') : (t.phase === 'work' ? 'Planting an energy crop' : 'Heading out to plant a crop');
    }
    if (def.roadworks && t.lay >= 0 && (t.phase === 'toNode' || t.phase === 'work')) return t.phase === 'work' ? 'Laying new road' : 'Heading out to lay new road';
    if (def.roadworks && (t.phase === 'toNode' || t.phase === 'work')) return t.phase === 'work' ? 'Laying asphalt' : 'Heading to a path to surface';
    if (t.phase === 'toNode') return def.plant ? 'Heading out to plant a grove' : `Heading out to gather ${def.gather ? GOOD[RES[t.gtype || def.gather].good].name : ''}`;
    if (t.phase === 'work') return def.plant ? 'Planting a stalk grove' : `Harvesting ${def.gather ? RES[t.gtype || def.gather].name.toLowerCase() : ''}`;
    if (t.phase === 'back') return u.carry ? `Bringing ${GOOD[u.carry].name} back` : `Walking back to the ${nm(t.bld)}`;
    return `Working at the ${nm(t.bld)}`;
  }
  return 'Busy';
}

/** The Bomb it button on an enemy building's or unit's panel: enabled when a Vulcan Bomber is ready that can reach t. */
function refreshBombButton(t) {
  if (!$('sh-bomb')) return;
  const u = readyBomber(t), any = myBombers(), bot = !BDEFS[t.type];
  $('sh-bomb').disabled = !u;
  $('sh-bomb-hint').textContent = u ? (bot ? `A Vulcan Bomber is ready: it flies out, leads it if it's moving and drops one bomb (a direct hit does ${BOMBER.botDamage * 2}; ${BOMBER.ammo} Ammo and ${BOMBER.fuel} Fuel a sortie). Flak Guns can shoot it down.`
      : `A Vulcan Bomber is ready: it drops one bomb (${BOMBER.damage} off the target; ${BOMBER.ammo} Ammo and ${BOMBER.fuel} Fuel a sortie). Flak Guns can shoot it down.`)
    : bot && (t.inside || t.dropping) ? 'It\'s under cover: bombers only hit vehicles and robots out in the open.'
      : any.some((v) => v.mission || v.flight) ? 'Your bombers are out on sorties.' : any.some((v) => v.rearmUntil > S.time) ? 'Your bombers are rearming.' : 'Out of your bombers\' reach.';
  if ($('sh-napalm') && BDEFS[t.type]) {
    const n = napalmSoil(t.x, t.y);
    $('sh-napalm').disabled = !readyNapalm(t.x, t.y);
    if (!$('sh-napalm').disabled) $('sh-bomb-hint').textContent += ` Or Napalm: ${BOMBER.fuel + NAPALM.fuel} Fuel and no Ammo; the ground round it burns for ${NAPALM.burn} s${n ? `, and ${n} patch${n === 1 ? '' : 'es'} of fertile soil there for good` : ''}.`;
  }
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

/** Does a robot's panel offer Recycle this unit (anything that walks or drives: not a plane, ship or train)? */
function recycleOffered(u) { const bt = BOTS[u.type]; return !!bt && !bt.air && !bt.sea && !bt.rail && !bt.magpod && !bt.wild; }

/** The Recycle section of one of your robots' panels: Recycle this unit (or why not), or Keep this unit while it's on its way. */
function refreshRecycle(u) {
  const btn = $('sh-recycle'), hint = $('sh-recycle-hint'), got = recycleText(u.type);
  const on = recycling(u), why = on ? '' : recycleWhy(u);
  const label = on ? 'Keep this unit' : 'Recycle this unit';
  const text = on ? `${recyclingNow(u) ? 'Being taken apart at the Bot Foundry' : 'On its way to the Bot Foundry, to be taken apart'} for ${got}. Keep this unit calls it off (so does any other order).`
    : why || `It goes to the nearest Bot Foundry and is taken apart there (${recycleTime(u.type)} s): ${got} (half of what it took to make) goes into the Foundry's stock, and its place under the robot limit (${S.mode === 'colony' ? MAX_BOTS_COLONY : MAX_BOTS}) is free again.`;
  if (btn.textContent !== label) btn.textContent = label;
  btn.disabled = !!why;
  btn.classList.toggle('danger', !on);
  if (hint.textContent !== text) hint.textContent = text;
}

function openBotSheet(u) {
  R.selected = 0; R.selTile = -1; UI.selBot = u.id;
  const html = `<div class="sheet-title"><div><h3>${BOTS[u.type].name}</h3>
    <div class="owner"><span class="dot" style="background:${PLAYER_COLORS[u.owner]}"></span> ${ownerLabel(u.owner)}</div></div></div>
    <p class="desc">${BOTS[u.type].desc}</p>
    <div class="status" id="sh-status"></div><div id="sh-dyn"></div>
    ${u.owner === ME && isArmy(u) ? '<button class="btn big" id="sh-recall" hidden>Call back this squad</button>' : ''}
    ${u.owner === ME && BOTS[u.type].bomber ? '<button class="btn primary big" id="sh-strike">Pick a target</button>' : ''}
    ${u.owner === ME && BOTS[u.type].flame ? '<div class="section-label">Scorch the earth</div><p class="hint" id="sh-scorch-hint"></p><button class="btn big" id="sh-scorch">Scorch the earth</button>' : ''}
    ${foes(u.owner, ME) && u.owner >= 0 && !BOTS[u.type].wild && !BOTS[u.type].air && myBombers().length ? '<div class="section-label">Air strike</div><p class="hint" id="sh-bomb-hint"></p><button class="btn big" id="sh-bomb">Bomb it</button>' : ''}
    ${u.owner === ME && BOTS[u.type].ferry ? `<button class="btn big" id="sh-fout"${u.inside && !u.landing ? '' : ' hidden'}>Sail out of the Port</button>
      <div class="actions"><button class="btn primary" id="sh-fsail">Sail somewhere</button><button class="btn" id="sh-fhome">Back to its line</button></div>
      <div class="actions"><button class="btn" id="sh-fembark">Take warbots aboard</button><button class="btn" id="sh-fland">Put them ashore</button></div>
      <button class="btn" id="sh-found">Found a Port on another shore</button>
      <p class="hint"><b>Sail out of the Port</b>: tied up, it sails out to wait just off the Port, where you can tap it on the map. <b>Sail somewhere</b>: it sails to the spot you tap (open water, or right up to a shore) and waits there for your orders; with a mouse, right-click the water while its panel is open. <b>Take warbots aboard</b> loads your warbots standing within ${Math.floor(FERRY_REACH)} tiles of it (with a mouse, select warbots and right-click the Ferry: they walk to the shore beside it and board). <b>Put them ashore</b> lands them on the shore beside it, and it heads home. <b>Found a Port</b>: it loads ${costText(PORT_FOUND.cost)} at its Port and up to ${PORT_FOUND.workers} Workers, and puts up a Port on an empty shore that claims the land round it.</p>` : ''}
    ${u.owner === ME && BOTS[u.type].airship ? '<div class="section-label">Line</div><div id="sh-sline"></div>' : ''}
    ${u.owner === ME && BOTS[u.type].rail ? '<div class="section-label">Armor</div><p class="hint" id="sh-tarmor-hint"></p><button class="btn big" id="sh-tarmor">Armor this train</button>' : ''}
    ${u.owner === ME && BOTS[u.type].crawler ? '<div class="actions"><button class="btn primary" id="sh-crawl">Drive somewhere</button><button class="btn" id="sh-deploy">Deploy here</button></div>' : ''}
    ${u.owner === ME && recycleOffered(u) ? '<div class="section-label">Recycle</div><p class="hint" id="sh-recycle-hint"></p><button class="btn big" id="sh-recycle">Recycle this unit</button>' : ''}
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
    if (!v) { sfx('error'); toast('No Vulcan Bomber is ready that can reach it.', 'warn'); return; }
    act('strike', [v.id, u.id], (why) => {
      if (why) { sfx('error'); toast(why, 'warn'); return; }
      sfx('order'); toast(`Strike ordered on the ${BOTS[u.type].name}: a bomber loads up, takes off and hunts it down.`, 'good'); refreshSheet();
    });
  };
  if ($('sh-strike')) $('sh-strike').onclick = () => { if (strikeWaiting(u)) { callOffStrike(u.id); return; } const why = u.mission || u.flight ? 'It\'s already out on a sortie.' : ''; if (why) { sfx('error'); toast(why, 'warn'); return; } sfx('click'); startStrike(u); };
  if ($('sh-scorch')) $('sh-scorch').onclick = () => {
    const us = scorchGroup(u).filter(scorchReady);
    if (!us.length) { sfx('error'); toast(`It takes a nearly full tank (${Math.round(TORCH.scorchMin * 100)}%): let it refill with Fuel first.`, 'warn'); return; }
    sfx('click'); startScorch(us.map((v) => v.id));
  };
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
  if ($('sh-recycle')) $('sh-recycle').onclick = () => {
    const name = BOTS[u.type].name;
    if (recycling(u)) {
      act('unrecycle', [u.id], (ok) => { sfx('click'); if (ok) toast(`The ${name} stays: it stops where it is.`, 'info'); refreshSheet(); });
      return;
    }
    act('recycle', [[u.id]], (r) => {
      if (typeof r === 'string') { sfx('error'); toast(r, 'warn'); }
      else { sfx('order'); toast(`The ${name} is on its way to the Bot Foundry to be taken apart for ${recycleText(u.type)}. Keep this unit (on its panel) calls it off.`, 'info'); }
      refreshSheet();
    });
  };
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
  if (r.grp && agById(r.grp)) { openAgSheet(agById(r.grp)); return; } // (an Army Group's flag: the group's panel)
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
  const by = Object.keys(BDEFS).find((k) => gatherRes(k) === type);
  const desc = type === R_URANIUM ? 'Scarce and radioactive. An Ore Mine within 4 tiles digs it (before any ore); a Nuclear Reactor enriches it, and 12 Uranium make one nuclear missile. There are only a few deposits on the planet: whoever holds them wins the race.'
    : type === R_CROP ? 'Planted by a Bio Farm on fertile soil. Once ripe, its worker harvests it into Fuel and plants a new one.'
    : type === R_OIL ? 'Build an Oil Pump right on top of the seep to pump Crude (it also draws from seep tiles next to it). A Refinery turns Crude into Fuel.'
    : type === R_VEIN ? `The Bloom's violet veins, breaking through the cavern floor. A Harvester within ${BDEFS.harvester.radius} tiles cuts them into Fiber; cut down, a vein grows back in about ${Math.round(VEIN.regrow / 60 * 2) / 2} minutes. Cutting them draws the Murmur.`
    : `Gives ${GOOD[info.good].name}. Gathered by a ${BDEFS[by].name} within ${BDEFS[by].radius} tiles.${type === R_STALK ? ' A Grove Planter can grow more.' : ' It runs out eventually, so expand to find more.'}`;
  const rich = richRes(t) ? '<p class="desc"><b>Rich deposit:</b> it holds far more than the ones near your base. The frontier pays.</p>' : '';
  const html = `<div class="sheet-title"><div><h3>${richRes(t) ? 'Rich ' + info.name.toLowerCase() : info.name}</h3></div></div>
    <p class="desc">${desc}</p>${rich}
    <div id="sh-dyn"></div>${type === R_CROP ? napalmSection(t) : ''}`;
  openSheet('res', t, html);
  if ($('sh-napalm')) $('sh-napalm').onclick = () => napalmFromPanel(t % S.W, (t / S.W) | 0, 'the crops');
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
    if (S.pave[t] < paveWant(t)) c.todo++;
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
  const lane = S.pave[t] === 3, asphalt = S.pave[t] >= 2, w = Math.round(S.wear[t] / 10);
  const cross = crossTile(t) ? (S.terrain[t] === T_ROCK ? ' tunnel' : S.terrain[t] === T_CHASM ? ' sky bridge' : ' bridge') : '';
  $('rd-name').textContent = lane ? 'Express lane' + (cross ? ` (${cross.trim()})` : '') : (asphalt ? 'Asphalt' : 'Concrete') + (cross || ' road');
  const speed = lane ? expressSpeed(BOTS.truck, S.wear[t]) : asphalt ? asphaltSpeed(S.wear[t]) : PAVE[1].speed;
  $('sh-dyn').innerHTML = (S.over[t] ? '<div class="kv"><span>Overpass</span><span>Straight through only, no turning</span></div>'
      : S.lights[t] ? '<div class="kv"><span>Traffic light</span><span>One way across at a time</span></div>' : '') +
    `<div class="kv"><span>Speed</span><span>${Math.round(speed * 100) / 100}× off-road${lane ? ` for trucks (Road Trains ${Math.round(expressSpeed(BOTS.roadtrain, S.wear[t]) * 100) / 100}×; Haulers never drive along it)` : ''}</span></div>` +
    (asphalt ? `<div class="kv"><span>Wear</span><span>${w}%${S.wear[t] >= REPAVE_AT ? ' (due for resurfacing)' : ''}</span></div>
      <div class="bar"><div style="width:${w}%;background:${w >= 75 ? '#ff4d4d' : w >= 50 ? '#ffb347' : '#7ee08a'}"></div></div>` : '') +
    `<p class="desc">${S.paveMark[t] === 2 ? 'Marked as an Express lane: a Roadworks joined to it lays the surface and resurfaces it as it wears.' : S.paveMark[t] ? 'Marked for asphalt: a Roadworks joined to it paves it and resurfaces it as it wears.'
      : asphalt ? `Not marked: once it wears through it drops back to ${lane ? 'asphalt' : 'plain road'}. Mark it to have a Roadworks maintain it.`
      : 'Mark it for asphalt and a Roadworks joined to it will pave it (2¾× speed).'} Busy roads wear fastest, and Freight Trucks wear them three times as fast as other bots.</p>` + (lane ? flavorLine('express') : '');
  $('rd-mark').textContent = S.paveMark[t] === 2 ? 'Clear the Express mark' : S.paveMark[t] ? 'Clear the asphalt mark' : 'Mark for asphalt';
}

/** A neutral Trade Post: what it is, who has docked there, and how to start trading. */
function openPostSheet(post) {
  const t = tIdx(post.x, post.y);
  R.selected = 0; R.selTile = t; UI.selBot = 0;
  const named = S.landmarks && typeof lmPostName === 'function' ? lmPostName(post) : null; // (one the atlas names: Ledger Post, Spring Market)
  const html = `<div class="sheet-title"><div><h3>${named ? esc(named.name) : 'Trade Post'}</h3><div class="sub">${named ? 'A neutral Trade Post: nobody owns it' : 'Neutral: nobody owns it'}</div></div></div>${named ? `<p class="flavor">${esc(named.line)}</p>` : ''}
    <p class="desc">An off-world exchange. Any colony can trade here: dock a <b>Trade Terminal</b> beside it (Build, Move, within ${TRADE_POST.dock} tiles of the pad) and lay a road or track out to the Terminal. A small neutral AI keeps the Accord's ledger here: your Terminal runs one standing trade route, a Road Train or Freight Train convoy every 2 minutes. A rival's land round the post keeps you out (no Terminal and no road on their ground), so an Outpost of yours beside it keeps them out. Further from your Command Base pays more. <b>Nothing shoots on its ground</b> (the gold dashed square): convoys are hit out on the road.</p>
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

/** The drawbridge a tap at tile (i, j), world point (wx, wy), is on or at the control box of, or -1 (Orbital platforms). */
function orbTapped(i, j, wx, wy) {
  const O = S.orb;
  if (!O) return -1;
  for (const b of O.bx) if (Math.abs(b.x + 0.5 - wx) <= 0.9 && Math.abs(b.y + 0.5 - wy) <= 0.9) return b.br;
  return orbBridgeAt(tIdx(i, j));
}

/** A drawbridge's panel (a tap on its strip or on either of its control boxes): its state, who holds its boxes, and Raise or Lower. */
function openBridgeSheet(k) {
  const B = S.orb.br[k], t = tIdx(B.x0 + ((B.x1 - B.x0) >> 1), B.y0 + ((B.y1 - B.y0) >> 1));
  R.selected = 0; R.selTile = t; UI.selBot = 0;
  const html = `<div class="sheet-title"><div><h3>${orbName(k)} bridge</h3><div class="sub">A drawbridge between two station decks</div></div></div>
    <p class="desc">Hold one of its two control boxes, with armed robots beside it or with your land round it, and you can Raise or Lower it. A bridge goes up only when no robot is on it, after a ${ORBITAL.warn} second warning (cross or clear it in time); a raised bridge is void: nothing walks across, but aircraft, Airships and Missiles still fly over. Each box is held by the colony with the most armed robots within ${ORBITAL.reach} tiles of it, else by the colony whose land it stands in.</p>
    <div id="sh-dyn"></div>
    <div class="btn-row"><button class="btn primary" id="sh-br-up" data-info="Raise the bridge: nothing can walk across it until it is lowered again. It can't go up while a robot is on it.">Raise the bridge</button><button class="btn primary" id="sh-br-dn" data-info="Lower the bridge: after a few seconds it is a walkable deck again.">Lower the bridge</button></div>
    <div class="btn-row"><button class="btn" id="sh-br-guard" data-info="Send armed warbots to stand beside a control box and hold it.">Hold a box with warbots</button></div>${flavorLine('bridge')}`;
  openSheet('bridge', k, html);
  const go = (up) => act('bridgeSet', [k, up], (why) => { if (why) { sfx('error'); toast(why, 'warn'); } else sfx('order'); refreshSheet(); });
  $('sh-br-up').onclick = () => go(1);
  $('sh-br-dn').onclick = () => go(0);
  $('sh-br-guard').onclick = () => { sfx('click'); closeSheet(); setMode('attack'); UI.armyCmd = 'hold'; showArmyCmdBanner('Tap the ground beside a control box.'); };
  refreshSheet();
}

function openSoilSheet(t) {
  R.selected = 0; R.selTile = t; UI.selBot = 0;
  const i = t % S.W, j = (t / S.W) | 0;
  const html = `<div class="sheet-title"><div><h3>Fertile soil</h3></div></div>
    <p class="desc">Dark, rich ground. A Bio Farm within ${BDEFS.farm.radius} tiles plants energy crops here and harvests them into Fuel for your Fuel Stations. Paths and buildings on it leave less room to farm. Burned (by napalm, or a Torch's Scorch the earth), it's lost for good.</p>` +
    napalmSection(t);
  openSheet('soil', t, html);
  if ($('sh-napalm')) { $('sh-napalm').onclick = () => napalmFromPanel(i, j, 'the farmland'); refreshNapalmSection(t); }
}

/** Burned soil (burntSoil): what's left of fertile soil after napalm or a Torch. */
function openBurntSheet(t) {
  R.selected = 0; R.selTile = t; UI.selBot = 0;
  openSheet('soil', t, `<div class="sheet-title"><div><h3>Burned farmland</h3></div></div>
    <p class="desc">This was fertile soil until napalm or a Torch burned it. Nothing grows here again: no Bio Farm can plant energy crops on it. Roads and buildings can still go on it.</p>`);
}

/** Crude left in the oil seep tiles around (i, j) that an Oil Pump there would draw from. */
function oilAround(i, j) {
  let n = 0;
  for (let dj = -1; dj <= 1; dj++) for (let di = -1; di <= 1; di++) {
    if (inMap(i + di, j + dj) && S.res[tIdx(i + di, j + dj)] === R_OIL) n += S.amt[tIdx(i + di, j + dj)];
  }
  return n;
}

/** Your robots by type: how many, and what they're doing. Opened from the population chip. */
/* ------------------------------------------------------------------ the Army panel (Q) and its Air tab */

/**
 * The Army panel: your warbots and Howitzers at a glance and orders for them. Pick a group size, then an
 * order (Attack a rival building, Hold ground, Station at a garrison of yours) and tap the map: each tap sends
 * another group, until Done. Groups out in the field and every Howitzer are listed with their own orders.
 * The Air tab (with an Airfield): each Airfield's hangar, every Vulcan Bomber (Strike) and Cargo Plane (air drops).
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
  if (isWide()) foldLong($('ar-body'));
  markSheetKeys();
}

function refreshArmyTab() {
  const g = warbotGroups(), mine = S.bots.filter((u) => !u.dead && u.owner === ME);
  const wb = mine.filter(isArmy), noAmmo = wb.filter((u) => !botArmed(u)).length;
  const spec = BOT_ORDER.filter((k) => BOTS[k].army && k !== 'warbot').map((k) => [k, wb.filter((u) => u.type === k).length]).filter(([, n]) => n), nT = wb.filter((u) => botTank(u.type)).length;
  const field = g.attack.length + g.hold.length + g.defend.length + g.idle.length + g.loot.length;
  const rockets = mine.filter((u) => BOTS[u.type].siege);
  // The groups out in the field: each rally flag, and each building under attack.
  const flags = S.rallies.filter((r) => r.owner === ME && !r.grp).map((r) => ({ r, n: rallyMembers(r.id).length })).filter((f) => f.n > 0);
  const atk = new Map();
  for (const u of g.attack) { const t = getE(u.task.target); if (t && !t.dead) atk.set(t.id, (atk.get(t.id) || 0) + 1); }
  const sig = JSON.stringify([agMine().map((g) => [g.n, g.name]), rallyPostOf(ME) ? 1 : 0, UI.armyN, wb.length, g.base.length, g.posted.length, field, noAmmo, flags.map((f) => [f.r.id, f.n]), [...atk], rockets.map((u) => [u.id, botActivity(u), Math.round(u.x / 3), Math.round(u.y / 3)]), S.players[ME].keepW ?? 0, !!INPUT.mouse, recallArmed()]);
  if (sig === UI.armySig) return;
  UI.armySig = sig;
  const L = getE(S.players[ME].lander), where = (x, y) => (L ? dirText(L, { x: Math.floor(x), y: Math.floor(y) }) : '');
  const k = S.players[ME].keepW ?? 0;
  let h = `<div class="kv"><span>Warbots</span><span><b>${wb.length}</b>${spec.length ? ` (${spec.map(([k, n]) => `${n} ${n > 1 ? BOTS[k].plural : BOTS[k].name}`).join(', ')})` : ''}: ${g.base.length} at the Command Base, ${g.posted.length} in garrisons, ${field} in the field${noAmmo ? `, <span class="err">${noAmmo} out of Ammo${nT ? ', Fuel or bolts' : ''}</span>` : ''}</span></div>`;
  if (rockets.length) h += `<div class="kv"><span>Howitzers</span><span><b>${rockets.length}</b></span></div>`;
  // (The orders in a block of their own: on a desktop it stays in view under the panel's name while the rest scrolls.)
  h += `<div class="ar-orders"><div class="section-label">Orders <span class="label-note">group size</span></div>
    <div class="seg" id="ar-size">${[2, 4, 8, 'all'].map((n) => `<button id="ar-n${n}" data-act="size" data-n="${n}" class="${UI.armyN === n ? 'on' : ''}">${n === 'all' ? 'All' : n}</button>`).join('')}</div>
    <div class="army-cmds">
      <button class="btn primary" id="ar-attack" data-act="cmd" data-c="attack">Attack</button>
      <button class="btn" id="ar-hold" data-act="cmd" data-c="hold">Hold ground</button>
      <button class="btn" id="ar-station" data-act="cmd" data-c="station">Station</button>
      <button class="btn${field && recallArmed() ? ' danger' : ''}" id="ar-recall" data-act="recall"${field ? '' : ' disabled'}>${field && recallArmed() ? `Tap again: ${field} come home` : 'Recall all'}</button>
      <button class="btn ghost" id="ar-select" data-act="select">Select all warbots</button>
    </div></div>${spec.length ? `<div class="army-cmds" id="ar-kinds"><span class="label-note">Select only</span>${['warbot', ...spec.map(([k]) => k)].filter((k) => wb.some((u) => u.type === k)).map((k) => `<button class="btn small ghost" id="ar-sel-${k}" data-act="selectkind" data-k="${k}">${BOTS[k].plural}</button>`).join('')}</div>` : ''}
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
  const ags = agMine();
  h += `<div class="section-label">Army Groups <span class="label-note">${ags.length} of ${AGROUP.max}</span></div>
    <div class="army-cmds">${ags.length < AGROUP.max ? '<button class="btn" id="ar-agnew" data-act="agnew">New group</button>' : ''}${ags.map((g) => `<button class="btn small ghost ag-open" data-act="agopen" data-n="${g.n}"><span class="ag-badge" style="--agc:${agColor(g)}">${g.n}</span>${g.name}</button>`).join('')}</div>
    <p class="hint">Standing armies with their own order (Hold, Defend area, Patrol, Attack, Follow) and size: new units from the Bot Foundry fill them, by priority; the rest stay in the Reserve${rallyPostOf(ME) ? ', at the rally point' : ''}. Select warbots, then <b>Army group</b> on the selection bar to make one of them.</p>`;
  h += `<div class="section-label">Every Outpost keeps</div><div class="seg" id="ar-keep">${[0, 1, 2, 5].map((v) => `<button data-act="keep" data-k="${v}" class="${v === k ? 'on' : ''}">${v}</button>`).join('')}</div>
    <p class="hint">Warbots each Outpost keeps at home, sent from your Command Base (and replaced if lost). Set one Outpost on its own in its panel.</p>`;
  $('ar-body').innerHTML = h;
}

function refreshAirTab() {
  const fields = myAirfields(), planes = S.bots.filter((u) => !u.dead && u.owner === ME && BOTS[u.type].air);
  const bombers = planes.filter((u) => BOTS[u.type].bomber), cargo = planes.filter((u) => !BOTS[u.type].bomber && !BOTS[u.type].airship), ships = planes.filter((u) => BOTS[u.type].airship);
  const kinds = BDEFS.airfield.yard.filter((kk) => warOn() || !BOTS[kk].war);
  const sig = JSON.stringify([fields.map((b) => [b.id, b.yard]), planes.map((u) => [u.id, planeStatus(u), !!(u.inside && !u.mission && !u.flight)]), !!readyBomber()]);
  if (sig === UI.armySig) return;
  UI.armySig = sig;
  const L = getE(S.players[ME].lander);
  let h = '';
  if (warOn() && bombers.length) h += `<button class="btn primary big" id="ar-strike" data-act="strikeany"${readyBomber() ? '' : ' disabled'}>Strike: tap a target</button>`;
  h += '<div class="section-label">Airfields</div>';
  for (const b of fields) {
    const n = basePlanes(b).length, ord = kinds.filter((kk) => b.yard && b.yard[kk] > 0).map((kk) => {
      const h = hangarCount(b, kk), m = h.making || h.spare;
      return `${m} ${m === 1 ? BOTS[kk].name : BOTS[kk].plural}` + (h.making && h.spare ? ` (+${h.spare} spare)` : h.making ? '' : ` as spare${h.spare === 1 ? '' : 's'}`);
    });
    h += `<div class="kv army-row"><span>${L ? `${dirText(L, b)} from the Command Base` : 'Airfield'}: ${n} plane${n === 1 ? '' : 's'}${ord.length ? `; ordered ${ord.join(', ')}` : ''}</span><span>${kinds.map((kk) => `<button class="btn small" data-act="yard" data-id="${b.id}" data-k="${kk}">+ ${BOTS[kk].name}</button>`).join('')}<button class="btn small ghost" data-act="showbld" data-id="${b.id}">Open</button></span></div>`;
  }
  if (warOn()) {
    h += '<div class="section-label">Vulcan Bombers</div>';
    h += bombers.length ? bombers.map((u) => `<div class="kv army-row"><span>${planeStatus(u)}</span><span>${strikeWaiting(u) ? `<button class="btn small" data-act="unstrike" data-id="${u.id}" title="Call the strike off: the bomb's Ammo goes back into the Airfield">Cancel strike</button>` : `<button class="btn small" data-act="strike" data-id="${u.id}"${!u.mission && !u.flight && planeBase(u) && u.inside === planeBase(u).id ? '' : ' disabled'}>Strike</button>`}<button class="btn small ghost" data-act="showbot" data-id="${u.id}">Show</button></span></div>`).join('')
      : '<p class="hint">None yet: order one in an Airfield\'s hangar (+ Vulcan Bomber above). It bombs any enemy building but a Keep or Command Base, or a vehicle or robot out in the open.</p>';
  }
  h += '<div class="section-label">Cargo Planes <span class="label-note">air drops by parachute</span></div>';
  h += cargo.length ? cargo.map((u) => {
    const free = u.inside && !u.mission && !u.flight && planeBase(u) && u.inside === planeBase(u).id;
    return `<div class="kv army-row"><span>${planeStatus(u)}</span><span>${free ? `<button class="btn small" data-act="drop" data-id="${u.id}" data-k="outpost">Drop Outpost</button>${warOn() ? `<button class="btn small" data-act="drop" data-id="${u.id}" data-k="warbot">2 Warbots</button>` : ''}<button class="btn small" data-act="drop" data-id="${u.id}" data-k="worker">2 Workers</button>` : ''}<button class="btn small ghost" data-act="showbot" data-id="${u.id}">Show</button></span></div>`;
  }).join('') : '<p class="hint">None yet: order one in an Airfield\'s hangar (+ Cargo Plane above). It flies goods to places you switch to Supply by air, and drops an Outpost, Warbots or Workers anywhere it can reach.</p>';
  h += '<div class="section-label">Airships <span class="label-note">on lines between Mooring Masts</span></div>';
  h += ships.length ? ships.map((u) => `<div class="kv army-row"><span>${shipStatus(u)}</span><span><button class="btn small ghost" data-act="showbot" data-id="${u.id}">Show</button></span></div>`).join('')
    : `<p class="hint">None yet: order one in an Airfield's hangar (+ Airship above). It carries ${BOTS.airship.carry} goods and ${BOTS.airship.seats} Workers or Warbots a trip, both ways, between two Mooring Masts you link (a Mast's panel: Link).</p>`;
  $('ar-body').innerHTML = h;
}

/** A button on the Army panel. */
function armyButton(btn) {
  const what = btn.dataset.act, id = +btn.dataset.id, e = id ? getE(id) : null;
  sfx('click');
  switch (what) {
    case 'size': UI.armyN = btn.dataset.n === 'all' ? 'all' : +btn.dataset.n; UI.armySig = ''; refreshArmySheet(); return;
    case 'cmd': armyCmd(btn.dataset.c); return;
    case 'agnew': agNewGroup([]); return;
    case 'agopen': { const g = agByN(+btn.dataset.n); if (g) openAgSheet(g); return; }
    case 'recall': recallAllTap(); return;
    case 'select': selectBots(armyIds(ME), false); closeSheet(); if (UI.sel.length) toast(`${UI.sel.length} warbots selected: ${onTouch() ? 'tap the map' : 'right-click'} to give orders.`, 'info'); return;
    case 'selectkind': { const k = btn.dataset.k, ids = armyIds(ME).filter((i) => { const u = getE(i); return u && u.type === k; }); selectBots(ids, false); closeSheet(); if (UI.sel.length) toast(`${UI.sel.length} ${UI.sel.length > 1 ? BOTS[k].plural : BOTS[k].name} selected: ${onTouch() ? 'tap the map' : 'right-click'} to give orders.`, 'info'); return; }
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
    case 'strikeany': { const u = readyBomber(); if (u) startStrike(u); else { sfx('error'); toast('No Vulcan Bomber is ready on the ground.', 'warn'); } return; }
    case 'strike': if (e) startStrike(e); return;
    case 'unstrike': callOffStrike(id); UI.armySig = ''; return;
    case 'drop': if (e) { closeSheet(); startAirdrop(e, btn.dataset.k); } return;
    case 'yard': if (e) {
      const k = btn.dataset.k, h = hangarCount(e, k), full = h.have + h.making >= h.cap;
      act('yard', [e.id, k, 1]);
      toast(full ? `${BOTS[k].name} ordered as a spare: this Airfield has room for ${h.cap}, so it's built if one is lost.` : `${BOTS[k].name} ordered: the Airfield's hangar builds it from Alloy and Chips.`, 'info');
      UI.armySig = ''; refreshArmySheet();
    } return;
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
    if (u.dead || u.inside || !foes(u.owner, ME) || u.owner < 0 || u.dropping || (BOTS[u.type].air && u.flight) || u.under) continue; // (a Sapper underground: nothing reaches it)
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
        sfx('order'); haptic('order'); showArmyCmdBanner(`${res.sent} warbot${res.sent > 1 ? 's are' : ' is'} going after the rival's ${name}.`);
      });
      return;
    }
    if (!b || !foes(b.owner, ME) || b.owner < 0 || b.dead) return fail(`Tap a rival building or robot (${rivalColours()}).`);
    const name = BDEFS[b.type].name;
    act('assault', [b.id, armyWant()], (sent) => {
      if (!sent) return fail('No armed warbots can get there: they need Ammo, and a way to walk there.');
      sfx('order'); haptic('order'); showArmyCmdBanner(`${sent} warbot${sent > 1 ? 's are' : ' is'} going for the ${name}.`);
    });
    return;
  }
  if (cmd === 'hold') {
    if (b || !inMap(i, j) || !walkable(tIdx(i, j))) return fail('Tap open ground your warbots can walk to.');
    act('rally', [i, j, armyWant()], (res) => {
      if (!res.sent) return fail('No spare armed warbots can get there.');
      sfx('order'); haptic('order'); showArmyCmdBanner(`${res.sent} warbot${res.sent > 1 ? 's are' : ' is'} on the way to hold it.`);
    });
    return;
  }
  if (cmd === 'station') {
    if (!b || b.owner !== ME || !b.built || !BDEFS[b.type].mil || b.type === 'lander') return fail('Tap one of your finished Outposts, Keeps or Bunkers.');
    const name = BDEFS[b.type].name;
    act('station', [b.id, armyWant()], (n) => {
      if (!n) return fail(!b.dead && garrisonRoom(b) ? 'No spare warbots to send there.' : `The ${name} is full.`);
      sfx('order'); haptic('order'); showArmyCmdBanner(`${n} warbot${n > 1 ? 's are' : ' is'} moving into the ${name}.`);
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
  if (tt === 'recycle' || u.recycleTo) return 'recycling';
  if (tt === 'charge' || tt === 'refuel' || (u.inside && insideCharger(u) && !tt && (u.bat ?? 100) < 99)) return 'charging';
  if (tt === 'haul') return 'carrying';
  if (tt === 'staff') return 'running';
  if (tt === 'build' || tt === 'pave' || tt === 'fix') return 'building';
  if (tt === 'repair') return 'repairing';
  return 'free';
}
const WORKER_VIEW = { running: ['#5dd88a', 'running buildings'], building: ['#ffb24a', 'building or paving'], carrying: ['#6ec8ff', 'carrying goods'],
  charging: ['#c79bff', 'recharging'], repairing: ['#ff7a8a', 'being repaired'], recycling: ['#b8b2a6', 'going to be recycled'], free: ['#ffe45a', 'free'] };

function refreshPopSheet() {
  const n = {};
  const add = (type, key) => { n[type] = n[type] || { total: 0 }; n[type].total++; if (key) n[type][key] = (n[type][key] || 0) + 1; };
  let total = 0;
  for (const u of S.bots) {
    if (u.dead || u.owner !== ME) continue;
    total++;
    const t = u.task, tt = t && t.type;
    if (recycling(u)) add(u.type, 'recycling');
    else if (isArmy(u)) {
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
      ? [part(o, 'garrison', 'in garrisons'), part(o, 'field', 'in the field'), part(o, 'noAmmo', BOTS[k].flame ? 'out of Fuel' : BOTS[k].arc ? 'out of bolts' : 'out of Ammo'), part(o, 'recycling', 'going to be recycled')]
      : [part(o, 'running', 'running buildings'), part(o, 'carrying', 'carrying goods'), part(o, 'building', 'building or paving'),
        part(o, 'charging', 'recharging'), part(o, 'repairing', 'being repaired'), part(o, 'recycling', 'going to be recycled'), part(o, 'free', 'free')];
    return `<div class="kv pop-row"><span><b>${o.total}</b> ${o.total === 1 ? BOTS[k].name : BOTS[k].plural}</span><span>${bits.filter(Boolean).join(' · ') || '–'}</span></div>`;
  });
  const cap = S.mode === 'colony' ? MAX_BOTS_COLONY : MAX_BOTS;
  let wb = '';
  if (warOn() && BOT_ORDER.some((k) => BOTS[k].army && n[k])) {
    const g = warbotGroups();
    wb = '<div class="section-label">Where your warbots are</div>' + WARBOT_PLACES.filter(([k]) => g[k].length).map(([k, label]) =>
      `<div class="kv pop-row"><span>${label}</span><span><b>${g[k].length}</b> <button class="btn small ghost" data-wb="${k}">Show</button></span></div>`).join('') +
      '<p class="hint">Show takes you to each in turn. Warbots stationed at an Outpost come back to it after a fight; every other one belongs to the Command Base.</p>';
  }
  const wv = `<div class="section-label">Where your workers are</div>
    <div class="actions"><button class="btn${R.workerView ? ' primary' : ''}" id="sh-wview">${R.workerView ? 'Hide workers on the map' : 'Show workers on the map'}</button><button class="btn" id="sh-wf">Workforce<kbd>⇧W</kbd></button></div>
    <p class="hint">Rings every Worker on the map (and dots it on the minimap) in the colour of what it's doing, with a line to where it's going: ${Object.values(WORKER_VIEW).map(([c, l]) => `<span style="color:${c}">●</span> ${l}`).join(', ')}. Workers inside a building show as a count on it.</p>`;
  // Spare Workers: those past one for each building that takes a Worker and a few free for building (workersWanted),
  // offered for recycling at a Bot Foundry while there are any.
  const want = workersWanted(ME), sp = spareBots(ME, 'worker', want), nw = (n.worker && n.worker.total) || 0, away = (n.worker && n.worker.recycling) || 0;
  const free = MIN_FREE_WORKERS + RECYCLE_KEEP, takes = want - free, can = sp.list.length;
  const why = !sp.over ? '' : !S.buildings.some((b) => !b.dead && b.owner === ME && b.built && BDEFS[b.type].bots) ? 'Spare Workers are taken apart at a Bot Foundry: build one first.'
    : !can ? 'None of them can get to a Bot Foundry from where they are.' : can < sp.over ? `${sp.over - can} of them can't get to a Bot Foundry from where they are.` : '';
  const spare = `<div class="section-label">Spare Workers</div>` + (sp.over
    ? `<p class="hint">${nw - away} Workers: ${takes} building${takes === 1 ? ' takes' : 's take'} one and ${free} stay free for building, so <b>${sp.over}</b> ${sp.over === 1 ? 'is' : 'are'} spare.` +
      ` Each fills a place under the robot limit: recycled at a Bot Foundry, it gives back ${recycleText('worker')} and its place.${away ? ` (${away} already on the way.)` : ''}${why ? ` <span class="err">${why}</span>` : ''}</p>` +
      `<button class="btn danger" id="pop-recycle"${can ? '' : ' disabled'}>Recycle ${can || sp.over} spare Worker${(can || sp.over) === 1 ? '' : 's'}</button>`
    : `<p class="hint">None spare: ${takes} building${takes === 1 ? ' takes' : 's take'} a Worker and ${free} stay free for building${away ? ` (${away} on the way to be recycled)` : ''}.</p>`);
  // Rebuilt only when something shown changes: rebuilt four times a second, a click on Show or the workers
  // button was lost when the button under it was replaced between press and release.
  const el = $('sh-pop'), html = rows.join('') + `<div class="kv"><span>All robots</span><span><b>${total}</b> of ${cap} (the limit)</span></div>` + spare + wv + wb;
  if (el.dataset.html === html) return;
  el.dataset.html = html;
  el.innerHTML = html;
  $('sh-wview').onclick = () => { R.workerView = !R.workerView; sfx('click'); refreshPopSheet(); };
  $('sh-wf').onclick = () => { sfx('click'); openWorkforce(); };
  if ($('pop-recycle')) $('pop-recycle').onclick = () => act('recycleSpare', [], (k) => {
    if (!k) { sfx('error'); toast('No spare Workers to recycle.', 'warn'); return; }
    sfx('order');
    toast(`${k} spare Worker${k === 1 ? ' is' : 's are'} on the way to the Bot Foundry to be taken apart: ${recycleText('worker')} back for each, and room under the robot limit.`, 'info');
    refreshPopSheet();
  });
  for (const btn of $('sh-pop').querySelectorAll('[data-wb]')) btn.onclick = () => showWarbots(btn.dataset.wb);
}

const WARBOT_PLACES = [['base', 'At the Command Base'], ['posted', 'In Outposts and Bunkers'], ['home', 'Heading back to a garrison'], ['attack', 'Attacking'],
  ['hold', 'Holding a rally flag'], ['defend', 'Out guarding a garrison'], ['escort', 'Escorting trade convoys'], ['fix', 'Being repaired or recharging'], ['loot', 'Carrying loot home'],
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
    else if (tt === 'escort') g.escort.push(u);
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
  if (UI.sheetKind === 'wf') { refreshWorkforce(); return; } // (the Workforce panel: js/workforce.js)
  if (UI.sheetKind === 'army') { refreshArmySheet(); return; }
  if (UI.sheetKind === 'agroup') { refreshAgSheet(); if (isWide()) foldLong($('sheet-body')); return; }
  if (UI.sheetKind === 'ally') { refreshAllySheet(); return; }
  if (UI.sheetKind === 'econ') { refreshEconomy(); return; } // (the Economy panel: js/economy.js)
  if (UI.sheetKind === 'road') { refreshRoadSheet(UI.sheetFor); return; }
  if (UI.sheetKind === 'bld') {
    const b = getE(UI.sheetFor);
    if (!b || b.dead) { closeSheet(); return; }
    // Captured (or won back) while its panel was open: the panel is built again for its new owner.
    if ((b.owner === ME && !megaDark(b)) !== UI.sheetMine || megaDark(b) !== UI.sheetDark) { openBuildingSheet(b); return; } // (or a megastructure knocked out, seized, back online: MEGA)
    refreshBuildingSheet(b);
    if (isWide()) foldLong($('sheet-body'));
  } else if (UI.sheetKind === 'bot') {
    const u = getE(UI.sheetFor);
    if (!u || (u.inside && !BOTS[u.type].sea && !BOTS[u.type].rail && !BOTS[u.type].airship && !BOTS[u.type].magpod)) { closeSheet(); return; } // (a ship tied up at a Port, a train at a station, an Airship at its Mast or a pod at its Terminal keeps its panel)
    $('sh-status').textContent = botActivity(u);
    refreshBombButton(u);
    const bat = Math.round(u.bat ?? 100);
    $('sh-dyn').innerHTML = `<div class="kv"><span>Health</span><span>${Math.ceil(u.hp)} / ${u.maxHp}</span></div>` +
      (BOTS[u.type].magpod ? `<div class="kv"><span>Power</span><span>${u.magTo ? (u.crawl ? 'none: crawling at a Worker\'s pace' : 'from the Generators by the Terminals') : u.inside && magPartner(getE(u.inside) || {}) ? (magLinePowered(getE(u.inside)) ? 'the line is powered' : 'the line has no power: it would crawl') : 'no line'}</span></div><div class="kv"><span>Hold</span><span>${u.cargo ? sumValues(u.cargo) : 0} of ${BOTS[u.type].carry} goods</span></div>` :
      `<div class="kv"><span>${tankOf(u) ? 'Fuel tank' : 'Battery'}</span><span>${bat}%${bat < BATTERY.critical ? (tankOf(u) ? ' (empty: crawling)' : ' (flat: slow and weak)') : bat < BATTERY.low ? ' (low)' : ''}</span></div>` +
      `<div class="bar battery"><div style="width:${bat}%;background:${bat < BATTERY.critical ? '#ff4d4d' : bat < BATTERY.low ? '#ffb347' : '#7ee08a'}"></div></div>`) +
      (BOTS[u.type].airship ? airshipRows(u) : BOTS[u.type].air ? `<div class="kv"><span>Fuel</span><span>fills up at its Airfield, one Fuel ${planeFill(u)}% of the tank (${tankFuel(u, 100)} to fill it now)${BOTS[u.type].bomber ? `; each sortie takes ${BOMBER.fuel} Fuel on top (${NAPALM.fuel} more with napalm)` : ''}; a full tank reaches ${planeReach(u)} tiles out and back</span></div>` : '') +
      (BOTS[u.type].shield ? shieldRows(u) : '') +
      (BOTS[u.type].flame ? `<div class="kv"><span>Flame tank</span><span>${Math.round(u.gel ?? TORCH.tank)} / ${TORCH.tank} seconds of fire${(u.gel ?? TORCH.tank) <= 0.05 ? ' (empty: going to refill with Fuel)' : ''}</span></div>` +
        `<div class="bar battery"><div style="width:${Math.round(100 * (u.gel ?? TORCH.tank) / TORCH.tank)}%;background:#ff8a2a"></div></div>` : '') +
      (BOTS[u.type].arc ? `<div class="kv"><span>Capacitors</span><span>${Math.floor(u.gel ?? ARC.cells)} / ${ARC.cells} bolts${(u.gel ?? ARC.cells) < 1 ? ' (empty: going to recharge with Crystal)' : ''}</span></div>` +
        `<div class="bar battery"><div style="width:${Math.round(100 * (u.gel ?? ARC.cells) / ARC.cells)}%;background:#8fd8ff"></div></div>` : '') +
      (u.type === 'warbot' || BOTS[u.type].flank || BOTS[u.type].railgun ? `<div class="kv"><span>Ammo</span><span>${u.ammo ?? botMag(u.type)} / ${botMag(u.type)} ${BOTS[u.type].railgun ? 'slugs' : 'shots'}${u.ammoCr > 0 ? ` (+${u.ammoCr} spare for its next reload)` : ''}${!u.ammo ? ' (out: can\'t fight until it reloads)' : ''}</span></div>` : '') +
      (BOTS[u.type].railgun && u.rc > S.time ? '<div class="kv"><span>Rail</span><span>charging</span></div>' : '') +
      (BOTS[u.type].siege ? `<div class="kv"><span>Shells</span><span>${u.rockets ?? ROCKET.mag} / ${ROCKET.mag}${!(u.rockets ?? ROCKET.mag) ? ` (haulers bring Ammo while it's dug in on your ground near a road; or it reloads ${ROCKET.ammo} Ammo at a garrison or storage)` : ''}</span></div><div class="kv"><span>Each shell</span><span>${ROCKET.damage} damage, ${ROCKET.damage * ROCKET.fortMul} to defences; one every ${ROCKET.cycle}s</span></div><div class="kv"><span>Reach</span><span>${ROCKET.min} to ${ROCKET.range} tiles</span></div>` : '') +
      (u.carry ? `<div class="kv"><span>Carrying</span><span>${cargoList(u).map(([g, n]) => goodTag(g, (n > 1 ? n + ' × ' : '') + GOOD[g].name)).join(' ')}</span></div>` : '') +
      (u.cargo && Object.keys(u.cargo).length ? `<div class="section-label">On board</div><div class="goodlist">${Object.keys(u.cargo).map((g) => goodTag(g, `${u.cargo[g]} ${GOOD[g].name}`)).join('')}</div>` : '');
    if ($('sh-recall')) $('sh-recall').hidden = !(u.task && u.task.type === 'hold');
    if ($('sh-sline')) renderShipLine(u);
    if ($('sh-fout')) $('sh-fout').hidden = !u.inside || !!u.landing;
    if ($('sh-tarmor')) refreshTrainArmor(u);
    if ($('sh-scorch')) refreshScorchButton(u);
    if ($('sh-recycle')) refreshRecycle(u);
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
  } else if (UI.sheetKind === 'bridge') {
    const k = UI.sheetFor, B = S.orb && S.orb.br[k];
    if (!B) { closeSheet(); return; }
    const who = (o) => (o < 0 ? 'No one' : o === ME ? 'You' : playerName(o));
    const boxes = S.orb.bx.filter((b) => b.br === k).sort((a, b) => a.end - b.end);
    const state = B.mv === 1 ? `Raising in ${Math.max(1, Math.ceil(ORBITAL.warn - (S.time - B.t0)))} s: get off it` : B.mv === 2 ? 'Rising' : B.mv === 3 ? 'Lowering' : B.up ? 'Raised: nothing can cross' : 'Down: open to cross';
    $('sh-dyn').innerHTML = `<div class="kv"><span>The bridge</span><span>${state}</span></div>` +
      boxes.map((b) => `<div class="kv"><span>Box on the ${orbDeckName(b.end ? B.b : B.a)} deck</span><span>${who(b.owner)}</span></div>`).join('') +
      (S.time < B.cd && !B.mv ? `<div class="kv"><span>Resting</span><span>${Math.ceil(B.cd - S.time)} s</span></div>` : '') +
      (orbOccupied(k) ? '<div class="kv"><span>On the bridge</span><span>Robots</span></div>' : '');
    const holds = orbHolds(ME, k);
    $('sh-br-up').hidden = !!B.up; $('sh-br-dn').hidden = !B.up;
    $('sh-br-up').disabled = !!orbWhy(ME, k, 1) || !holds; $('sh-br-dn').disabled = !!orbWhy(ME, k, 0) || !holds;
    $('sh-br-up').title = $('sh-br-dn').title = holds ? '' : 'Hold one of its control boxes first.';
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
    const grow = (r === R_STALK || r === R_CROP || r === R_VEIN) && S.grow[t] < 1 ? `<div class="kv"><span>${r === R_CROP ? 'Ripening' : r === R_VEIN ? 'Growing back' : 'Growing'}</span><span>${Math.round(S.grow[t] * 100)}%</span></div>` : '';
    $('sh-dyn').innerHTML = r === R_CROP ? (grow || '<div class="kv"><span>Ripe</span><span>Ready to harvest</span></div>')
      : `<div class="kv"><span>${r === R_OIL ? 'Crude left' : 'Harvests left'}</span><span>${S.amt[t]}</span></div>${grow}`;
    refreshNapalmSection(t);
  } else if (UI.sheetKind === 'soil') refreshNapalmSection(UI.sheetFor);
}

/* ------------------------------------------------------------------ HUD */

const OBJECTIVES = [
  { text: 'Robots run on batteries, and your Command Base can\'t charge them. Tap <b>Build</b> and place a <b>Fuel Station</b> beside the road ring round your base: it runs on the Fuel you landed with.', build: ['charger'], done: () => hasBuilt('charger') || hasAny('charger') },
  { get text() { return hollowOn() ? 'Nothing grows in the Hollow. Tap <b>Build</b> and place a <b>Harvester</b> beside the violet <b>Bloom veins</b>: it cuts Fiber from them.' : 'Tap <b>Build</b> and place a <b>Harvester</b> beside the teal stalk groves.'; },
    build: ['harvester'], done: () => hasBuilt('harvester') || hasAny('harvester') },
  { text: '<b>Haulers only drive on roads.</b> Tap <b>Paths</b>, sketch a road from the ring round your Command Base to the Harvester site and tap <b>Build</b> (or tap the site and choose <b>Lay road</b>). Free workers pave it.', done: () => hasBuilt('harvester') || S.buildings.some((b) => !b.dead && b.owner === ME && b.type === 'harvester' && !b.unlinked) },
  { text: 'Build a <b>Quarry</b> near the grey boulders to get Stone.', build: ['quarry'], done: () => hasBuilt('quarry') },
  { text: 'Build a <b>Cement Works</b> near your Command Base: it bakes Stone into <b>Cement</b>, which nearly every building and every road is made of.', build: ['kiln'], done: () => hasBuilt('kiln') },
  { text: 'Build an <b>Ore Mine</b> by the dark ore veins and a <b>Crystal Tap</b> by the violet crystals.', build: ['mine', 'tap'], done: () => hasBuilt('mine') && hasBuilt('tap') },
  { text: 'Build a <b>Smelter</b>: it turns Ore and Fiber into Alloy.', build: ['smelter'], done: () => hasBuilt('smelter') },
  { text: 'Build a <b>Chip Fab</b>: it turns Crystal and Alloy into Chips.', build: ['fab'], done: () => hasBuilt('fab') },
  { text: 'Build a <b>Bot Foundry</b> so you can make more workers.', build: ['foundry'], done: () => hasBuilt('foundry') },
  { text: 'Tap your <b>Bot Foundry</b> and order some <b>Workers</b>: it only builds the bots you ask for.', done: () => S.players[ME].stats.bots > S.players[ME].stats.startBots || S.buildings.some((b) => !b.dead && b.owner === ME && hasOrders(b)) },
  { text: 'Build an <b>Outpost</b> near your border to claim more land.', build: ['outpost'], done: () => hasBuilt('outpost') },
  // (The Hollow: no farms underground; Fuel is refined from the oil seep by the base.)
  { get text() { return hollowOn() ? 'Fuel Stations burn <b>Fuel</b>, and nothing grows down here. Build an <b>Oil Pump</b> on the dark oil seep and a <b>Refinery</b> to turn its Crude into Fuel.' : 'Fuel Stations burn <b>Fuel</b>. Build a <b>Bio Farm</b> beside the dark fertile soil to grow it (your Agribot runs it).'; },
    get build() { return hollowOn() ? ['pump', 'refinery'] : ['farm']; }, done: () => hasBuilt('farm') || hasBuilt('refinery') || playerGoods(ME).fuel >= 20 },
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
  if (S.mission || S.contingency) return null; // (a Contingency battle has its own goal: contObjective)
  for (const o of OBJECTIVES) if (!o.done()) return o;
  return null;
}

/** The buildings the current step asks for that you haven't placed yet: the Build list pins them at the top. */
function nextBuilds() {
  const o = objectiveStep();
  return o && o.build ? o.build.filter((t) => !hasAny(t)) : [];
}

/**
 * Is a road already planned all the way from building b (cut off from storage) to the road network, waiting for Workers
 * to pave it? Then the Goal card's no-road warning leaves b out: it's on its way. (roadRouteTo is a search, so each
 * building's answer is kept for a second: ROAD_WAY.)
 */
const ROAD_WAY = new WeakMap();
function roadOnItsWay(b) {
  const now = performance.now(), c = ROAD_WAY.get(b);
  if (c && now - c.t < 1000) return c.v;
  const r = roadRouteTo(b.owner, b), v = !!(r && !r.length && r.pending);
  ROAD_WAY.set(b, { t: now, v });
  return v;
}
/** Your buildings and sites cut off from storage with no road planned to them yet (the Goal card's warning). */
function cutOffUnplanned() { return S.buildings.filter((b) => !b.dead && b.owner === ME && b.unlinked && !roadOnItsWay(b)); }

function objectiveText() {
  const cut = cutOffUnplanned();
  const warn = cut.length && !(cut.length === 1 && cut[0].type === 'harvester' && !hasBuilt('harvester'))
    ? `<span class="err">${cut.length === 1 ? `Your ${BDEFS[cut[0].type].name}${cut[0].built ? '' : ' site'} has` : `${cut.length} buildings have`} no road to storage.</span> Tap ${cut.length === 1 ? 'it' : 'one'} and choose <b>Lay road</b>.<br>` : '';
  if (S.mission) return warn + missionObjectiveHTML();
  if (S.contingency && typeof contObjective === 'function') return warn + contObjective(); // (js/contingency-battle.js)
  if (S.horde) return warn + fallenGoalLine() + hordeObjective(); // (Horde: the next wave; a partner down)
  for (const o of OBJECTIVES) if (!o.done()) return warn + o.text;
  if (warn) return warn;
  if (S.mode === 'colony') {
    const pct = Math.floor(landShare(ME) * 100);
    const next = COLONY_MILESTONES[S.milestone];
    return next !== undefined
      ? `Colonize the planet: <b>${pct}%</b> claimed. Next milestone at ${Math.round(next * 100)}%.`
      : `<b>${pct}%</b> of the planet colonized. Every milestone reached!`;
  }
  if (fallenGoalLine()) return fallenGoalLine() + 'Take the enemy team\'s Command Bases to win.';
  return nColonies() > 2 ? 'Gather warbots in Outposts near a rival, then tap its <b>Command Base</b> and send them in. Take every rival Command Base to win.'
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
  // A good the colony has gone without for a while, something waiting for it, is ringed (js/insight.js: insightColony).
  const short = insightColony();
  for (const g of GOODS) {
    const on = !!short && short.starved.includes(g), el = UI.goodEls[g];
    if (el.classList.contains('starved') === on) continue;
    el.classList.toggle('starved', on);
    el.setAttribute('aria-label', GOOD[g].name + (on ? ': running short (tap to see why)' : ''));
  }
  let workers = 0, idle = 0, war = 0, haulers = 0;
  for (const u of S.bots) {
    if (u.dead || u.owner !== ME) continue;
    if (isArmy(u)) war++;
    else if (u.type === 'hauler' || u.type === 'truck' || u.type === 'tanker') haulers++;
    else if (u.type === 'worker') { workers++; if (isIdleWorker(u)) idle++; }
  }
  $('pop').title = `${workers} workers (${idle} free), ${haulers} haulers, trucks and Tankers` + (warOn() ? `, ${war} warbots` : '') + '. Tap for every robot by type.';
  // (Each count with its name under it in the Command Deck look; .pn-l are the names, the old look shows the dots.)
  const ph = `<span class="pn pn-w" title="Workforce (Shift+W): what your Workers are doing, and who gets them first"><span class="dot" style="background:#ece6da;box-shadow:inset 0 0 0 2px ${PLAYER_COLORS[ME]}"></span><b>${workers}<small class="pn-free"> (${idle} free)</small></b><span class="pn-l">Workers</span></span>` +
    ` <span class="pn"><span class="dot" style="background:#ffb547;box-shadow:inset 0 0 0 2px ${PLAYER_COLORS[ME]}"></span><b>${haulers}</b><span class="pn-l">Haulers</span></span>` +
    (warOn() ? ` <span class="pn"><span class="dot" style="background:${PLAYER_COLORS[ME]};border-radius:2px;transform:rotate(45deg)"></span><b>${war}</b><span class="pn-l">Warbots</span></span>` : '');
  if ($('pop').innerHTML !== ph) $('pop').innerHTML = ph;
  // The callsign block (Command Deck look): your callsign in your colour; in multiplayer, each player's own.
  const cs = $('callsign');
  if (cs && cs.dataset.k !== CALLSIGNS[ME] + PLAYER_COLORS[ME]) { cs.dataset.k = CALLSIGNS[ME] + PLAYER_COLORS[ME]; cs.style.setProperty('--pc', PLAYER_COLORS[ME]); $('callsign-name').textContent = callsign(ME); }
  // With day and night on, the time of day leads (a sun, a half-lit disc at dawn and dusk, a moon).
  const tn = todName(), tod = todEnabled() ? `<span class="tod-mark" style="color:${{ morning: '#ffb38a', day: '#ffd166', evening: '#ff8a4a', night: '#b8c8ff' }[tn]}">${tn === 'night' ? '☾' : '☀'}</span> ` : '';
  const ct = (todEnabled() ? `<small class="ck-l">${TOD_NAMES[tn]}</small>` : '') + '<span class="ck-v">' + tod + (S.contingency && S.mode === 'colony' && typeof contTopLine === 'function' ? contTopLine() : S.horde ? hordeTopLine() : S.mode === 'colony' ? `${Math.floor(landShare(ME) * 100)}% land` : fmtTime(S.time)) + '</span>'; // (a Contingency battle against the Murmur: dawn and the nests)
  if ($('clock').innerHTML !== ct) $('clock').innerHTML = ct;
  $('clock').title = todEnabled() ? TOD_NAMES[todName()] + (todMode() === 'night' ? ' (always)' : '') : '';
  updateWinCard(); // (first: folded under the Goal chip, it leaves a summary there)
  updateGupCard(); // (the Great Uplink win: a transmission's countdown, for every colony)
  goalsHUD(); // (Colony free play: the goals button beside the Goal card, js/goals.js)
  const obj = $('objective');
  // Where the screen is small the card folds away at the first tap on the map (onMapTap) and opens again for each
  // new step, unless you've folded or opened it yourself. Folded, it still says how many buildings have no road (and
  // none planned).
  const step = objectiveStep(), stepKey = step ? OBJECTIVES.indexOf(step) : -1;
  if (UI.objStep !== stepKey) { if (UI.objStep !== undefined && UI.objAuto && !UI.objManual) { UI.objCollapsed = false; UI.objAuto = false; } UI.objStep = stepKey; }
  const cut = UI.objCollapsed && !S.mission ? cutOffUnplanned().length : 0; // (not those with a road planned to them)
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
      el.querySelector('.bcost').innerHTML = costHTML(cost, goods);
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
    if (E.type !== 'trader') html += `<div class="ev-desc">${E.endless ? 'Bots move at two-thirds speed and Missiles are grounded for the rest of the game: this storm never blows over.' : def.desc}</div>`;
    else if (!E.started) html += '';
    else if (!o) html += '<div class="ev-desc">It wants nothing you have spare.</div>';
    else if (o.done) html += `<div class="ev-desc">Deal done: ${o.m} ${goodN(o.get, o.m)} delivered to your Command Base.</div>`;
    else {
      html += `<div class="ev-deal"><span>Give <b>${o.n}</b> <i class="gi ${o.give}"></i> ${goodN(o.give, o.n)}, get <b>${o.m}</b> <i class="gi ${o.get}"></i> ${goodN(o.get, o.m)}</span>` +
        '<button class="btn small primary" id="ev-trade">Trade</button></div>';
      // (now and then the Wren brings the raw good the land is running out of, not a finished one: see traderOffer)
      html += `<div class="ev-desc">${o.raw ? `This time it brings ${GOOD[o.get].name}: your land is running lowest on it.` : `You are shortest of ${GOOD[o.get].name}.`}</div>`;
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
  el.querySelector('.ev-time').textContent = soon ? `in ${left}s` : E.endless ? 'for good' : `${left}s`;
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
 * The Great Uplink win: while any colony transmits, a banner under the top bar in the sender's colour, for every colony
 * (and in Observer mode): "VERMILION transmitting · contact in 6:12", a bar filling, and JAMMED or NO POWER while it
 * stalls; a second line for a second colony transmitting at once. Tap it to look at the one furthest along.
 */
function updateGupCard() {
  const el = $('gup-card'), live = S.winner < 0 && typeof gupLive === 'function' ? gupLive() : [];
  if (!live.length) { el.hidden = true; el.dataset.key = ''; return; }
  const g = live[0], col = PLAYER_COLORS[g.owner] || '#7fc8ff';
  el.style.setProperty('--c', col);
  const who = (b) => (b.owner === ME && !S.watch ? 'You are' : `${esc(callsign(b.owner))}${S.players[b.owner] && S.players[b.owner].name ? ` (${esc(S.players[b.owner].name)})` : ''}`);
  const html = live.slice(0, 2).map((b) => {
    const left = fmtClock(GUP.hold - (b.gT || 0)), tag = b.gJam ? '<span class="gup-tag">JAMMED</span>' : !b.gPow ? '<span class="gup-tag">NO POWER</span>' : '';
    return `<div class="gup-row" style="--c:${PLAYER_COLORS[b.owner]}"><span class="ev-dot" style="background:${PLAYER_COLORS[b.owner]};color:${PLAYER_COLORS[b.owner]}"></span><span><b>${who(b)}</b> transmitting · contact in</span><span class="ev-time">${left}</span>${tag}</div>` +
      `<div class="gup-bar" style="--c:${PLAYER_COLORS[b.owner]}"><i style="width:${Math.min(100, ((b.gT || 0) / GUP.hold) * 100).toFixed(1)}%"></i></div>`;
  }).join('');
  if (el.dataset.html !== html) { el.dataset.html = html; el.innerHTML = html; }
  el.setAttribute('aria-label', `${callsign(g.owner)} transmitting from its Great Uplink: contact in ${fmtClock(GUP.hold - (g.gT || 0))}${g.gJam ? ', jammed' : !g.gPow ? ', no power' : ''}`);
  el.onclick = () => { const c = bCentre(g); centerOn(c.x, c.y); };
  el.hidden = false;
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
  if (UI.inGame && S) el.dataset.t = fmtTime(S.time); // (the game time, shown before the line in the Command Deck look)
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
  voiceOpening(); // (the Carrier's line as the lander comes down: js/voice.js)
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
  if (TOD.over != null) return; // (photo mode's time of day is only for the picture)
  if (S.mission || S.time < 30 || S.time > 720 || !todEnabled() || (S.lore && S.lore['n.night.' + ME] !== undefined)) return;
  if (todNow().lights >= 0.9) narrate(ME, 'night');
}

const COMMAND_RADIO_ENABLED = false;
const COMMAND_TRANSMISSIONS = [
  { text: 'Command online. Execute settlement directives.', speech: 'e o a  i e  o u e a' },
  { text: 'Colony status received. Continue operations.', speech: 'i a u  e e u  o a i' },
  { text: 'Long-range relay silent. Continue local directives.', speech: 'o i  a o u  i e a u' },
];

function commandTransmissionTick() {
  if (!COMMAND_RADIO_ENABLED || UI.paused || UI.briefing || UI.watch || S.winner >= 0 || !(S.time >= UI.nextTransmission)) return;
  const line = COMMAND_TRANSMISSIONS[UI.transmission === 0 ? 0 : (UI.transmission - 1) % 2 + 1];
  UI.transmission++;
  UI.nextTransmission = (Math.floor(S.time / 480) + 1) * 480;
  UI.toastBatch = (UI.toastBatch || 0) + 1;
  toast('Command radio · ' + line.text, 'voice');
  commandVoice(line.speech);
}

function uiTick(dt) {
  briefingTick();
  netTick();
  mpBannerTick();
  syncPlanBanner(); // (plan while paused: its banner over the map)
  if (typeof coopTick === 'function') coopTick(); // (co-op: my cursor to my partner, js/coop.js)
  allyTick(); // (the bar's Ally button, the Ally panel: js/ally.js)
  if (typeof contBarTick === 'function') contBarTick();
  if (typeof townUiTick === 'function') townUiTick(); // (a Passenger Town building's panel: js/city.js)
  if (typeof walkerUiTick === 'function') walkerUiTick(); // (the Walking Factory's panel: js/walker.js)
  if (typeof damUiTick === 'function') damUiTick(); // (a dam's panel: js/dam.js)
  if (typeof lmUiTick === 'function') lmUiTick(); // (a wreck's log recovered: js/landmarks.js) // (a Contingency battle's clock and cards: js/contingency-battle.js)
  polish3Tick(); // (the colours a multiplayer game was started with, the chat box: js/polish3.js)
  AUDIO.suppress = !UI.inGame;
  if (!UI.inGame) menuArtTick();
  siteUndoTick(); // (hides itself out of a game)
  nowPlayingTick(); // (desktop only: the music's title, in the menu and in a game)
  if (!UI.inGame || !S) return;
  checkpointTick();
  commandTransmissionTick();
  if (UI.watch) watchTick(dt); // (Observer mode: the scout report and the camera, js/watch.js)
  else scoutTick(); // (scout reports on the rivals, js/scout.js)
  if (S.msgs.length) UI.toastBatch = (UI.toastBatch || 0) + 1; // (the messages of one moment: see toast)
  while (S.msgs.length) {
    const m = S.msgs.shift();
    if (typeof coopQuiet === 'function' && coopQuiet(m.text, m.kind)) { coopLog(m.text, m.kind, m.x, m.y); continue; } // (co-op: not my role's: the log only)
    toast(m.text, m.kind, m.x, m.y);
    if ((m.kind === 'bad' || m.kind === 'warn' || m.kind === 'lost') && (m.x || m.y)) { UI.lastAlert = { x: m.x, y: m.y }; qolAlert(m); }
    if (m.kind === 'lost') sfx('alert');
    if (m.kind === 'bad' || m.kind === 'warn' || m.kind === 'lost') haptic(m.kind === 'warn' ? 'warn' : 'bad'); // (a short buzz under a finger: input.js)
  }
  updateMapTip();
  UI.hudT -= dt;
  if (UI.hudT <= 0) { UI.hudT = 0.25; if (!$('screen-pause').hidden) syncRivalDifficulty(); updateHUD(); qolHudTick(); polishHudTick(); refreshSheet(); placeMinimap(); refreshSelection(); refreshAgCards(); missionCoach(); syncWakeLock(); nightfallLine(); if ((UI.flowKeyN = (UI.flowKeyN || 0) + 1) % 4 === 0) refreshFlowKey(); }
  metaTick(dt); // (Colony goals, records and achievements, once a second: js/goals.js)
  if (S.winner >= 0 && !UI.overShown) showGameOver();
}

/* ------------------------------------------------------------------ Army Groups: the cards, the panel, the map picks */
/*
 * The group cards (#agcards): a strip down the right edge, under the minimap (beside an open panel on a computer),
 * a card a group: its badge and name, how many against its target, their average health, Ammo and its order (on a
 * phone just the badge, the count, a health bar and an Ammo dot), then the Reserve (the army units in no group: at
 * the rally point or the Command Base). Each card is a <button>. Tap (click, Enter) selects the group; again (or
 * twice quickly) the camera goes to it. Right-click, a long press or Alt+Shift+its number opens its panel (openAgSheet).
 * Drag a card onto the map or the minimap: an Attack order to there. Alt+1–6 selects a group (twice: goes to it).
 */
const AGK = { tapN: 0, tapAt: 0, press: null, noClick: 0 };

function agMine() { return S && S.agroups ? agList(ME) : []; }
function agByN(n) { return agMine().find((g) => g.n === n) || null; }
function agColor(g) { return AGROUP.colors[(g.n - 1) % AGROUP.colors.length]; }
/** The army units of yours in no group (the Reserve): all of them, garrisons too, but those posted at an Outpost. */
function agReserve() { return S.bots.filter((u) => !u.dead && u.owner === ME && isArmy(u) && !u.grp && !postOf(u)); }

/** Group g at a glance: { n, coming, hp (average health, %), empty, low } (out of Ammo, low on it). */
function agStats(g) {
  const us = agMembers(g);
  let hp = 0, max = 0, empty = 0, low = 0, coming = 0;
  for (const u of us) {
    hp += u.hp; max += u.maxHp;
    if (u.grpNew || u.grpGo) coming++;
    if (!botArmed(u)) empty++;
    else if (!botTank(u.type) && u.ammo !== undefined && u.ammo / botMag(u.type) < 0.34) low++;
  }
  return { n: us.length, coming, hp: max ? Math.round((100 * hp) / max) : 0, empty, low };
}
function agAmmoText(s) { return s.empty ? `${s.empty} out of Ammo` : s.low ? `${s.low} low on Ammo` : 'Ammo OK'; }

/** The strip of cards: made again when what it shows changes, placed under the minimap and clear of an open panel. */
function refreshAgCards() {
  let el = $('agcards');
  if (!el) {
    el = document.createElement('div'); el.id = 'agcards'; el.className = 'agcards'; el.setAttribute('role', 'toolbar'); el.setAttribute('aria-label', 'Army Groups');
    document.body.appendChild(el);
    initAgCards(el);
  }
  const gs = UI.inGame && S && warOn() && !UI.watch ? agMine() : [];
  el.hidden = !gs.length;
  const mc = $('mm-cmd');
  if (mc) { mc.hidden = !gs.length; mc.classList.toggle('on', !!UI.cmdView); mc.setAttribute('aria-pressed', UI.cmdView ? 'true' : 'false'); }
  if (!gs.length && UI.cmdView) UI.cmdView = false;
  if (!gs.length) { el.dataset.html = ''; return; }
  const selAll = (ids) => ids.length && UI.selSet && ids.every((id) => UI.selSet.has(id));
  let h = '';
  for (const g of gs) {
    const s = agStats(g), ids = agMembers(g).map((u) => u.id), hpc = s.hp >= 66 ? 'ok' : s.hp >= 33 ? 'mid' : 'bad';
    h += `<button class="agcard${selAll(ids) ? ' on' : ''}${g.paused ? ' paused' : ''}" data-g="${g.n}" style="--agc:${agColor(g)}" title="${g.name}: ${s.n} of ${g.size}${s.coming ? ` (${s.coming} coming)` : ''}, health ${s.hp}%, ${agAmmoText(s)}. ${agDoing(g)}. Tap to select, again to go to it; right-click or hold for its panel; drag onto the map to send it (Alt+${g.n})." aria-label="${g.name}, ${s.n} of ${g.size}, ${agDoing(g)}">` +
      `<span class="ag-badge">${g.n}</span><span class="ag-main"><span class="ag-top"><b class="ag-name">${g.name}</b><span class="ag-count">${s.n}/${g.size}</span></span>` +
      `<span class="ag-doing">${agDoing(g).replace(/ \(point.*\)$/, '')}</span>` +
      `<span class="ag-meta"><span class="ag-hp ${hpc}"><i style="width:${s.hp}%"></i></span><span class="ag-ammo ${s.empty ? 'out' : s.low ? 'low' : 'ok'}">${agAmmoText(s)}</span></span></span></button>`;
  }
  const rs = agReserve().length;
  h += `<button class="agcard reserve" data-g="0" title="The Reserve: your army units in no group (${rs}), at the rally point or the Command Base. New units come here when every group is full. Tap to select them, again to go to the rally point." aria-label="Reserve, ${rs}">` +
    `<span class="ag-badge">R</span><span class="ag-main"><span class="ag-top"><b class="ag-name">Reserve</b><span class="ag-count">${rs}</span></span><span class="ag-doing">${rallyPostOf(ME) ? 'At the rally point' : 'At the Command Base'}</span></span></button>`;
  if (el.dataset.html !== h) { el.dataset.html = h; el.innerHTML = h; }
  // Under the minimap (or the top bar), down the right; beside an open panel that covers that edge; above a bottom panel.
  const mm = $('minimap'), sh = $('sheet');
  const mr = mm && !mm.hidden ? mm.getBoundingClientRect() : null, sr = sh && !sh.hidden ? sh.getBoundingClientRect() : null;
  const top = $('topbar').getBoundingClientRect().bottom + 8;
  const tab = mr && $('mm-hide') ? $('mm-hide').getBoundingClientRect() : null; // (on a touch screen its hide tab hangs under it)
  let t = mr && mr.height ? Math.max(mr.bottom, tab && tab.height ? tab.bottom : 0) + 10 : top, right = mr && mr.width ? window.innerWidth - mr.right : 12, bottom = window.innerHeight - 8;
  if (sr && sr.width) {
    if (sr.left > window.innerWidth * 0.35 && sr.top < window.innerHeight * 0.5) { right = window.innerWidth - sr.left + 10; t = top; }
    else bottom = Math.min(bottom, sr.top - 8);
  }
  const bb = $('bottombar'), br = bb && bb.getClientRects().length ? bb.getBoundingClientRect() : null;
  if (br && br.right > window.innerWidth - right - 200 && br.top > t) bottom = Math.min(bottom, br.top - 8);
  // An upright phone in the Command Deck look: a row of small cards (badge and count) across the top left, under the
  // goal card and beside the minimap; out of sight while a panel reaches up over it.
  const row = document.body.classList.contains('deck') && matchMedia('(max-width: 699px) and (min-height: 520px)').matches;
  el.classList.toggle('row', row);
  if (row) {
    const rt = Math.round(top - 2), rr = mr && mr.width && mr.bottom > rt ? Math.round(window.innerWidth - mr.left + 6) : 6;
    el.style.top = rt + 'px'; el.style.right = rr + 'px'; el.style.maxHeight = '';
    el.style.visibility = sr && sr.width && sr.top < rt + 52 ? 'hidden' : '';
    return;
  }
  el.style.visibility = '';
  el.style.top = Math.round(t) + 'px';
  el.style.right = Math.round(right) + 'px';
  el.style.maxHeight = Math.max(52, Math.round(bottom - t)) + 'px';
}

/** The strip's pointer and key handling (made once). */
function initAgCards(el) {
  const cardAt = (e) => e.target && e.target.closest && e.target.closest('.agcard');
  el.addEventListener('click', (e) => {
    const c = cardAt(e); if (!c) return;
    if (AGK.noClick > performance.now()) return;
    agCardTap(+c.dataset.g);
  });
  el.addEventListener('contextmenu', (e) => { const c = cardAt(e); if (!c) return; e.preventDefault(); agCardPanel(+c.dataset.g); });
  el.addEventListener('pointerdown', (e) => {
    const c = cardAt(e); if (!c || (e.button !== undefined && e.button > 0)) return;
    const n = +c.dataset.g;
    AGK.press = { n, x: e.clientX, y: e.clientY, id: e.pointerId, drag: false, long: false, ghost: null, c };
    AGK.press.timer = setTimeout(() => { const p = AGK.press; if (p && !p.drag) { p.long = true; AGK.noClick = performance.now() + 600; haptic('order'); agCardPanel(p.n); } }, 550);
  });
  el.addEventListener('pointermove', (e) => {
    const p = AGK.press; if (!p || p.id !== e.pointerId || p.n === 0) return;
    if (!p.drag && Math.hypot(e.clientX - p.x, e.clientY - p.y) > 12 && !p.long) {
      p.drag = true; clearTimeout(p.timer);
      try { p.c.setPointerCapture(e.pointerId); } catch (err) { /* (it's gone) */ }
      const g = agByN(p.n);
      p.ghost = document.createElement('div'); p.ghost.className = 'ag-ghost'; p.ghost.style.setProperty('--agc', g ? agColor(g) : '#fff');
      p.ghost.textContent = g ? `${g.n} ${g.name}: drop to attack there` : '';
      document.body.appendChild(p.ghost);
    }
    if (p.drag && p.ghost) { p.ghost.style.left = e.clientX + 'px'; p.ghost.style.top = e.clientY + 'px'; }
  });
  const end = (e) => {
    const p = AGK.press; if (!p || p.id !== e.pointerId) return;
    clearTimeout(p.timer); AGK.press = null;
    if (!p.drag) return;
    AGK.noClick = performance.now() + 400;
    if (p.ghost) p.ghost.remove();
    if (e.type === 'pointercancel') return;
    const at = document.elementFromPoint(e.clientX, e.clientY), g = agByN(p.n);
    if (!g || !at) return;
    let w = null;
    if (at.id === 'mm-canvas') { const r = at.getBoundingClientRect(); w = { x: ((e.clientX - r.left) / r.width) * S.W, y: ((e.clientY - r.top) / r.height) * S.H }; }
    else if (at.id === 'game') w = screenToWorld(e.clientX, e.clientY);
    if (w) agSendTo(g, Math.floor(w.x), Math.floor(w.y));
  };
  el.addEventListener('pointerup', end);
  el.addEventListener('pointercancel', end);
}

/**
 * The command view (Tab, or the minimap's Command button): the camera pulls out to the whole map and each group shows as
 * a banner (drawCommandView); again (or Esc) and the camera goes back. Zoomed far out the banners show anyway.
 */
function toggleCmdView(on) {
  const want = on === undefined ? !UI.cmdView : !!on;
  if (want === !!UI.cmdView) return;
  if (want && !agMine().length) { sfx('error'); toast('No Army Groups yet: select warbots, then Army group on the selection bar (or New group in the Army panel).', 'info'); return; }
  sfx('click');
  UI.cmdView = want;
  if (want) {
    UI.cmdPrev = { x: R.cam.x, y: R.cam.y, z: R.cam.z };
    R.cam.z = minZoom();
    centerOn(S.W / 2, S.H / 2);
    toast(onTouch() ? 'Command view: drag a group\'s banner onto the map to send it there, tap it for its panel.' : 'Command view: drag a group\'s banner onto the map to send it there, click it for its panel. Tab or Esc to go back.', 'info');
  } else if (UI.cmdPrev) {
    R.cam.z = clamp(UI.cmdPrev.z, minZoom(), maxZoom());
    centerOn(UI.cmdPrev.x, UI.cmdPrev.y);
    UI.cmdPrev = null;
  }
  UI.cmdDrag = null;
  refreshAgCards();
}

/** A pointer down on the map at (x, y): on a command-view banner, what its drag and tap do (input.js onGrab), else null. */
function cmdGrab(x, y) {
  if (typeof cmdViewOn !== 'function' || !cmdViewOn() || R.mode !== 'normal' || !UI.cmdIcons) return null;
  const slack = onTouch() ? 8 : 2;
  let hit = null;
  for (const ic of UI.cmdIcons) if (x >= ic.x - slack && x <= ic.x + ic.w + slack && y >= ic.y - slack && y <= ic.y + ic.h + slack) hit = ic;
  if (!hit) return null;
  const n = hit.n;
  UI.cmdDrag = { n, x, y, moved: false };
  const f = (mx, my) => { UI.cmdDrag = { n, x: mx, y: my, moved: true }; };
  f.tap = () => { UI.cmdDrag = null; const g = agByN(n); if (g) { sfx('click'); openAgSheet(g); } };
  f.end = (mx, my) => {
    UI.cmdDrag = null;
    const g = agByN(n), w = screenToWorld(mx, my);
    if (g && inMap(Math.floor(w.x), Math.floor(w.y))) agSendTo(g, Math.floor(w.x), Math.floor(w.y));
  };
  f.cancel = () => { UI.cmdDrag = null; };
  return f;
}

/** A card tapped: its group selected, or (already selected, or a quick second tap) the camera to it. 0: the Reserve. */
function agCardTap(n) {
  const g = n ? agByN(n) : null;
  if (n && !g) return;
  const us = g ? agMembers(g) : agReserve(), ids = selectable(ME, us.map((u) => u.id)).map((u) => u.id);
  const now = performance.now(), twice = AGK.tapN === n && now - AGK.tapAt < 450;
  const same = ids.length && UI.sel.length === ids.length && ids.every((id) => UI.selSet && UI.selSet.has(id));
  AGK.tapN = n; AGK.tapAt = now;
  sfx('click');
  if (same || twice || !ids.length) {
    agCenter(g);
    if (!ids.length) toast(g ? `The ${g.name} has no units yet: new ones from your Bot Foundry fill it (up to ${g.size}).` : 'No army units in the Reserve.', 'info');
    return;
  }
  selectBots(ids, false);
  if (g && g.paused) toast(`The ${g.name} is paused under your orders: open its panel (right-click or hold) for Back to order.`, 'info');
}

/** The camera to group g (null: the Reserve): the middle of its units out in the open, else its flag (the rally point or Base). */
function agCenter(g) {
  const us = g ? agMembers(g) : agReserve();
  let x = 0, y = 0, k = 0;
  for (const u of us) if (!u.inside) { x += u.x; y += u.y; k++; }
  if (k) centerOn(x / k, y / k);
  else if (g) { const r = rallyById(g.flag); if (r) centerOn(r.x, r.y); }
  else { const b = rallyPostOf(ME) || getE(S.players[ME].lander); if (b) centerOn(b.x + 0.5, b.y + 0.5); }
}

/** A card's panel: the group's, or for the Reserve the Army panel. */
function agCardPanel(n) {
  sfx('click');
  if (!n) { setMode('normal'); openArmySheet('army'); return; }
  const g = agByN(n); if (g) openAgSheet(g);
}

/** Alt+1–6: group n selected (twice: the camera to it); with Shift, its panel. */
function agKey(n, panel) {
  const g = agByN(n);
  if (!g) { toast(agMine().length ? `No group ${n}: your groups are ${agMine().map((q) => q.n).join(', ')}.` : 'No Army Groups yet: select warbots, then Army group on the selection bar (or New group in the Army panel).', 'info'); return; }
  if (panel) agCardPanel(n); else agCardTap(n);
}

/** Drop a card on the map: the group attacks toward (i, j) and holds there. */
function agSendTo(g, i, j) {
  if (!inMap(i, j) || !walkable(tIdx(i, j))) { sfx('error'); toast('Drop it on ground your units can walk to.', 'warn'); return; }
  act('agOrder', [g.id, 'attack', [[i, j]]], (why) => {
    if (why) { sfx('error'); toast(why, 'warn'); return; }
    sfx('order'); haptic('order'); addFx('ring', i + 0.5, j + 0.5, { color: agColor(g) });
    toast(`The ${g.name} attacks toward there, then holds it.`, 'info');
  });
}

/** New group: of the selection's army units (or none, at the Command Base). Its panel opens. */
function agNewGroup(ids) {
  act('agNew', [ids || []], (r) => {
    if (typeof r !== 'number') { sfx('error'); toast(r || 'No new group.', 'warn'); return; }
    sfx('order');
    const g = agById(r);
    toast(`New group: the ${g.name}${(ids || []).length ? '' : `, empty: new units from your Bot Foundry fill it (up to ${g.size})`}. Pick its order in its panel.`, 'good');
    refreshAgCards();
    openAgSheet(g);
  });
}

/** The selection bar's Army group: add the selection to a group, a new one, or take it out of its groups. */
function openAgSelSheet() {
  const ids = orderable(ME, UI.sel).map((u) => u.id);
  if (!ids.length) { sfx('error'); toast('Select warbots (or other army units) first.', 'info'); return; }
  const gs = agMine(), inG = ids.filter((id) => getE(id).grp).length;
  let h = `<div class="sheet-title"><div><h3>Army group</h3></div></div><p class="desc">${ids.length} unit${ids.length > 1 ? 's' : ''} selected${inG ? `, ${inG} in a group` : ''}. A unit is in one group at a time.</p><div class="ag-list">`;
  for (const g of gs) { const s = agStats(g); h += `<button class="btn ag-pickg" id="ag-add-${g.n}" data-g="${g.n}" style="--agc:${agColor(g)}"><span class="ag-badge">${g.n}</span>Add to the ${g.name} <span class="label-note">${s.n}/${g.size}</span></button>`; }
  h += `</div><div class="army-cmds">${gs.length < AGROUP.max ? '<button class="btn primary" id="ag-new-sel">New group from these</button>' : `<span class="hint">${AGROUP.max} groups is the most: disband one for a new one.</span>`}${inG ? '<button class="btn ghost" id="ag-leave">Take them out of their groups</button>' : ''}</div>`;
  openSheet('agsel', 0, h);
  for (const b of document.querySelectorAll('.ag-pickg')) b.onclick = () => {
    const g = agByN(+b.dataset.g); if (!g) return;
    act('agAdd', [g.id, ids], (n) => { sfx('order'); toast(`${n} added to the ${g.name}${g.paused ? ' (paused: Back to order in its panel)' : ''}.`, 'info'); closeSheet(); refreshAgCards(); });
  };
  if ($('ag-new-sel')) $('ag-new-sel').onclick = () => agNewGroup(ids);
  if ($('ag-leave')) $('ag-leave').onclick = () => act('agLeave', [ids], (n) => { sfx('click'); toast(`${n} back in the Reserve.`, 'info'); closeSheet(); refreshAgCards(); });
}

const AG_STANCE_NAMES = { agg: 'Aggressive', def: 'Defensive', hold: 'Hold fire' };
const AG_STANCE_HOW = {
  agg: 'Aggressive: they chase what they see well past the order\'s area, and hit buildings further off.',
  def: 'Defensive: they take on what comes within reach of the order\'s area, then come back to it.',
  hold: 'Hold fire: they move and stand without shooting, until one of them is shot at; then the whole group fires back for a few seconds. (On a Raid they still hit its targets.)',
};

/** Group g's panel: rename, target size, priority, its order (with the map picks), home, select, go to, disband. */
function openAgSheet(g) {
  if (!g) return;
  setMode('normal');
  UI.agDisbandArm = 0;
  UI.agOpt = '';
  UI.agRad = g.ord.r || UI.agRad || AGROUP.rad;
  const orders = Object.keys(AG_ORDERS).map((k) => `<button class="btn" id="ag-order-${k}" data-k="${k}">${AG_ORDERS[k].name}</button>`).join('');
  openSheet('agroup', g.id, `<div class="sheet-title"><div><h3 class="ag-h"><span class="ag-badge" style="--agc:${agColor(g)}">${g.n}</span><span id="ag-title"></span></h3><p class="sub" id="ag-doing"></p></div></div>
    <div id="ag-dyn"></div>
    <div class="ag-rename"><input id="ag-name-in" type="text" maxlength="${AGROUP.nameMax}" aria-label="Group name" autocomplete="off" spellcheck="false"><button class="btn" id="ag-name">Rename</button></div>
    <div class="section-label">Target size and priority <span class="label-note">new units fill the groups in priority order</span></div>
    <div class="ag-row"><button class="btn" id="ag-size-down" aria-label="Smaller">−</button><b class="ag-n" id="ag-size"></b><button class="btn" id="ag-size-up" aria-label="Bigger">+</button></div>
    <div class="ag-row"><span id="ag-prio" class="ag-prio"></span><span class="ag-sep"></span><button class="btn" id="ag-up" aria-label="Higher priority">▲ Up</button><button class="btn" id="ag-down" aria-label="Lower priority">▼ Down</button></div>
    <div class="section-label">Standing order</div>
    <div class="ag-orders" id="ag-orders">${orders}</div>
    <div class="ag-row" id="ag-rads"><span class="label-note">Area (Defend area, Raid):</span>${AGROUP.radii.map((r) => `<button class="btn small" id="ag-rad-${r}" data-r="${r}">${r} tiles</button>`).join('')}</div>
    <div class="ag-row" id="ag-reps"><span class="label-note">After a raid:</span><button class="btn small" id="ag-rep-1" data-v="1">Repeat</button><button class="btn small" id="ag-rep-0" data-v="0">Once, then hold</button></div>
    <div id="ag-opt"></div>
    <p class="hint" id="ag-how"></p>
    <div class="section-label">Behaviours <span class="label-note">how its units fight, whatever the order</span></div>
    <div class="ag-row ag-beh" id="ag-rets"><span class="label-note">Retreat when weak:</span>${AGROUP.rets.map((v) => `<button class="btn small" id="ag-ret-${v}" data-v="${v}">${v ? v + '%' : 'Off'}</button>`).join('')}</div>
    <div class="ag-row ag-beh" id="ag-rels"><span class="label-note">Reload rotation:</span><button class="btn small" id="ag-rel-1" data-v="1">On</button><button class="btn small" id="ag-rel-0" data-v="0">Off</button></div>
    <div class="ag-row ag-beh" id="ag-sts"><span class="label-note">Stance:</span>${AGROUP.stances.map((v) => `<button class="btn small" id="ag-st-${v}" data-v="${v}">${AG_STANCE_NAMES[v]}</button>`).join('')}</div>
    <p class="hint" id="ag-beh-how"></p>
    <div class="army-cmds"><button class="btn primary" id="ag-resume">Back to order</button><button class="btn" id="ag-select">Select</button><button class="btn" id="ag-goto">Go to</button><button class="btn" id="ag-home">Set home</button><button class="btn danger" id="ag-disband">Disband</button></div>`);
  $('ag-name-in').value = g.name;
  $('ag-name-in').onkeydown = (e) => { e.stopPropagation(); if (e.key === 'Enter') { e.preventDefault(); $('ag-name').click(); } if (e.key === 'Escape') { e.preventDefault(); e.target.blur(); } };
  const G = () => agById(g.id);
  $('ag-name').onclick = () => { const q = G(); if (!q) return; act('agName', [q.id, $('ag-name-in').value], (nm) => { sfx('click'); $('ag-name-in').value = nm; toast(`Renamed: the ${nm}.`, 'info'); refreshAgCards(); refreshAgSheet(); }); };
  $('ag-size-down').onclick = () => { const q = G(); if (q) { sfx('click'); act('agSize', [q.id, q.size - 1], () => refreshAgSheet()); } };
  $('ag-size-up').onclick = () => { const q = G(); if (q) { sfx('click'); act('agSize', [q.id, q.size + 1], () => refreshAgSheet()); } };
  $('ag-up').onclick = () => { const q = G(); if (q) { sfx('click'); act('agPrio', [q.id, -1], () => { refreshAgSheet(); refreshAgCards(); }); } };
  $('ag-down').onclick = () => { const q = G(); if (q) { sfx('click'); act('agPrio', [q.id, 1], () => { refreshAgSheet(); refreshAgCards(); }); } };
  for (const b of $('ag-orders').children) b.onclick = () => agOrderButton(G(), b.dataset.k);
  for (const b of $('ag-rads').querySelectorAll('[data-r]')) b.onclick = () => {
    const q = G(); if (!q) return;
    sfx('click'); UI.agRad = +b.dataset.r;
    if (q.ord.k === 'defend') act('agOrder', [q.id, 'defend', q.ord.pts, UI.agRad], () => refreshAgSheet());
    if (q.ord.k === 'raid') act('agOrder', [q.id, 'raid', q.ord.pts, UI.agRad, 0, q.ord.rep ?? 1], () => refreshAgSheet());
    refreshAgSheet();
  };
  for (const b of $('ag-reps').querySelectorAll('[data-v]')) b.onclick = () => {
    const q = G(); if (!q) return;
    sfx('click'); UI.agRep = +b.dataset.v;
    if (q.ord.k === 'raid') act('agRaidRep', [q.id, UI.agRep], () => refreshAgSheet());
    refreshAgSheet();
  };
  const beh = (args, say) => { const q = G(); if (!q) return; sfx('click'); act('agBeh', [q.id, ...args], (b) => { if (b && say) toast(say(q, b), 'info'); refreshAgSheet(); refreshAgCards(); }); };
  for (const b of $('ag-rets').querySelectorAll('[data-v]')) b.onclick = () => beh([+b.dataset.v, null, null], (q, B) => (B.ret ? `The ${q.name}'s units pull out for repairs below ${B.ret}% health.` : `The ${q.name}'s units fight on, however damaged.`));
  for (const b of $('ag-rels').querySelectorAll('[data-v]')) b.onclick = () => beh([null, +b.dataset.v, null], (q, B) => (B.rel ? `The ${q.name} restocks Ammo a few at a time.` : `The ${q.name}'s units each go for Ammo when they run out.`));
  for (const b of $('ag-sts').querySelectorAll('[data-v]')) b.onclick = () => beh([null, null, b.dataset.v], (q, B) => `The ${q.name}: ${AG_STANCE_NAMES[B.st]}.`);
  $('ag-resume').onclick = () => { const q = G(); if (q) { sfx('order'); act('agResume', [q.id], () => { toast(`The ${q.name} is back on its order.`, 'info'); refreshAgSheet(); }); } };
  $('ag-select').onclick = () => { const q = G(); if (q) { closeSheet(); AGK.tapN = 0; agCardTap(q.n); } };
  $('ag-goto').onclick = () => { const q = G(); if (q) { sfx('click'); agCenter(q); } };
  $('ag-home').onclick = () => agStartPick(G(), 'home');
  $('ag-disband').onclick = () => {
    const q = G(); if (!q) return;
    if (!(UI.agDisbandArm && performance.now() - UI.agDisbandArm < 3000)) { sfx('click'); UI.agDisbandArm = performance.now(); refreshAgSheet(); return; }
    act('agDisband', [q.id], () => { sfx('click'); toast(`The ${q.name} is disbanded: its units go back to the Reserve.`, 'info'); closeSheet(); refreshAgCards(); });
  };
  refreshAgSheet();
}

/** The open group panel brought up to date. */
function refreshAgSheet() {
  if (UI.sheetKind !== 'agroup') return;
  const g = agById(UI.sheetFor);
  if (!g) { closeSheet(); return; }
  const s = agStats(g), mine = agMine(), L = getE(S.players[ME].lander), hb = agHomeB(g), r = rallyById(g.flag);
  const set = (id, v) => { const el = $(id); if (el && el.textContent !== String(v)) el.textContent = v; };
  set('ag-title', g.name);
  set('ag-doing', agDoing(g));
  set('ag-size', g.size);
  set('ag-prio', `Priority ${mine.indexOf(g) + 1} of ${mine.length}`);
  $('ag-up').disabled = mine.indexOf(g) === 0;
  $('ag-down').disabled = mine.indexOf(g) === mine.length - 1;
  $('ag-size-down').disabled = g.size <= 1;
  $('ag-size-up').disabled = g.size >= AGROUP.maxSize;
  const home = hb ? `${hb === L ? 'the Command Base' : `the ${BDEFS[hb.type].name}`}${L && hb !== L ? ` ${dirText(L, hb)} of the Command Base` : ''}` : g.home.x !== undefined ? `a spot${L ? ` ${dirText(L, { x: g.home.x, y: g.home.y })} of the Command Base` : ''}` : '';
  const dyn = `<div class="kv"><span>Units</span><span><b>${s.n}</b> of ${g.size}${s.coming ? ` (${s.coming} on the way from the Reserve)` : ''}</span></div>` +
    `<div class="kv"><span>Health</span><span>${s.n ? `${s.hp}% on average` : '—'}</span></div>` +
    `<div class="kv"><span>Ammo</span><span class="${s.empty ? 'err' : ''}">${s.n ? agAmmoText(s) : '—'}</span></div>` +
    `<div class="kv"><span>Home</span><span>${home}</span></div>`;
  const d = $('ag-dyn'); if (d.dataset.html !== dyn) { d.dataset.html = dyn; d.innerHTML = dyn; }
  for (const b of $('ag-orders').children) b.classList.toggle('on', b.dataset.k === g.ord.k);
  for (const b of $('ag-rads').querySelectorAll('[data-r]')) b.classList.toggle('on', +b.dataset.r === (g.ord.k === 'defend' || g.ord.k === 'raid' ? g.ord.r : UI.agRad));
  const rep = g.ord.k === 'raid' ? g.ord.rep ?? 1 : UI.agRep ?? 1, B = agBeh(g);
  for (const b of $('ag-reps').querySelectorAll('[data-v]')) b.classList.toggle('on', +b.dataset.v === rep);
  $('ag-reps').hidden = g.ord.k !== 'raid';
  for (const b of $('ag-rets').querySelectorAll('[data-v]')) b.classList.toggle('on', +b.dataset.v === B.ret);
  for (const b of $('ag-rels').querySelectorAll('[data-v]')) b.classList.toggle('on', +b.dataset.v === B.rel);
  for (const b of $('ag-sts').querySelectorAll('[data-v]')) b.classList.toggle('on', b.dataset.v === B.st);
  const noRep = !S.buildings.some((b) => !b.dead && b.owner === ME && b.built && BDEFS[b.type].repair);
  set('ag-beh-how', (B.ret ? `Below ${B.ret}% health a unit goes to a Repair Station and comes back mended${noRep ? ' (you have none yet: build one, or they fight on)' : ''}. ` : 'Retreat off: they fight on, however damaged. ') +
    (B.rel ? 'Reload rotation: low on Ammo, they restock a few at a time, never more than a third at once. ' : 'Reload rotation off: each goes for Ammo when it runs out. ') + AG_STANCE_HOW[B.st]);
  $('ag-resume').hidden = !g.paused;
  const arm = UI.agDisbandArm && performance.now() - UI.agDisbandArm < 3000;
  set('ag-disband', arm ? 'Tap again to disband' : 'Disband');
  // Follow: which group, when there's a choice.
  let opt = '';
  if (UI.agOpt === 'follow') {
    const others = mine.filter((q) => q !== g);
    opt = others.length ? `<div class="ag-list"><span class="label-note">Follow which group?</span>${others.map((q) => `<button class="btn ag-fol" id="ag-follow-${q.n}" data-g="${q.n}" style="--agc:${agColor(q)}"><span class="ag-badge">${q.n}</span>The ${q.name}</button>`).join('')}</div>` : '<p class="hint">Follow needs another group to follow: make one first.</p>';
  }
  const o = $('ag-opt');
  if (o.dataset.html !== opt) {
    o.dataset.html = opt; o.innerHTML = opt;
    for (const b of o.querySelectorAll('.ag-fol')) b.onclick = () => { const q = agByN(+b.dataset.g), me = agById(g.id); if (!q || !me) return; act('agOrder', [me.id, 'follow', [], 0, q.id], (why) => { if (why) { sfx('error'); toast(why, 'warn'); return; } sfx('order'); UI.agOpt = ''; toast(`The ${me.name} follows the ${q.name}.`, 'info'); refreshAgSheet(); }); };
  }
  const how = {
    hold: 'Hold: they stand guard at home, take on what comes near, and come back.',
    defend: `Defend area: they take on any enemy robot inside a ${g.ord.r || UI.agRad}-tile circle (round home, or a spot you tap), then come back to its middle.`,
    patrol: 'Patrol: they walk a loop of 2 or 3 points you tap, fighting what they meet, pausing a few seconds at each.',
    attack: 'Attack: they fight their way along up to 5 waypoints you tap, clearing each before the next, and hold the last.',
    follow: 'Follow: they shadow another of your groups, a couple of tiles behind it.',
    raid: `Raid: they go for the enemy's economy in a ${g.ord.r || UI.agRad}-tile circle you tap (Haulers, trucks, mines, factories, Depots, roads; never defences), round the guns both ways, and pull out when it turns costly. ${(g.ord.rep ?? 1) ? 'Then they mend and go again.' : 'Then they hold at home.'}`,
  }[g.ord.k] || '';
  set('ag-how', how + (g.paused ? ' Paused: some were given orders of yours. Back to order puts them all back on it.' : '') + (r && !s.n ? ' No units yet: new ones from the Bot Foundry fill it.' : ''));
  markSheetKeys();
}

/** An order button in the group panel. */
function agOrderButton(g, k) {
  if (!g) return;
  sfx('click');
  if (k === 'hold') { act('agOrder', [g.id, 'hold', []], () => { toast(`The ${g.name} holds at home.`, 'info'); refreshAgSheet(); }); return; }
  if (k === 'follow') { UI.agOpt = UI.agOpt === 'follow' ? '' : 'follow'; refreshAgSheet(); return; }
  if (k === 'raid' && !AGROUP.radii.includes(UI.agRad)) UI.agRad = AGROUP.raid.rad;
  agStartPick(g, k);
}

/** Picking on the map for group g: an order's points (Defend area's middle, Patrol's loop, Attack's waypoints) or its home. */
function agStartPick(g, k) {
  if (!g) return;
  sfx('click');
  setMode('agpick');
  UI.agPick = { g: g.id, k, pts: [], r: UI.agRad || AGROUP.rad };
  agPickBanner();
}

function agPickBanner(note) {
  const P = UI.agPick, g = P && agById(P.g);
  if (!g) { setMode('normal'); return; }
  const O = AG_ORDERS[P.k], n = P.pts.length;
  const text = P.k === 'home' ? `Tap the <b>${g.name}</b>'s new home: one of your Outposts or Keeps, your Command Base, or open ground.`
    : P.k === 'defend' ? `Tap the middle of the area the <b>${g.name}</b> defends (a ${P.r}-tile circle), or <b>Around home</b>.`
    : P.k === 'raid' ? `Tap the middle of the enemy ground the <b>${g.name}</b> raids (a ${P.r}-tile circle): it hits their economy there, keeping out of their guns.`
    : P.k === 'patrol' ? `Tap ${n ? 'the next point' : '2 or 3 points'} of the <b>${g.name}</b>'s patrol loop (${n} of 3).${n >= 2 ? ' <b>Done</b> to start.' : ''}`
    : `Tap the <b>${g.name}</b>'s waypoints, up to 5: it holds at the last (${n} of 5).${n ? ' <b>Done</b> to send it.' : ''}`;
  showBanner((note ? note + ' ' : '') + text, P.k === 'defend' ? 'Around home' : P.k === 'home' || P.k === 'raid' ? null : 'Done', 'Cancel');
  if (P.k !== 'defend' && P.k !== 'home' && P.k !== 'raid') $('banner-ok').disabled = n < (O ? O.pts[0] : 1);
}

/** A tap on the map while picking for a group. */
function agPickTap(i, j, wx, wy) {
  const P = UI.agPick, g = P && agById(P.g);
  if (!g) { setMode('normal'); return; }
  const fail = (why) => { sfx('error'); agPickBanner(`<span class="err">${why}</span>`); };
  if (P.k === 'home') {
    const b = buildingAtTap(i, j, wx, wy);
    if (b && b.owner === ME && b.built && (b.type === 'outpost' || b.type === 'keep' || b.type === 'lander')) { act('agHome', [g.id, b.id, 0, 0], (why) => (why ? fail(why) : agPickEnd(`The ${g.name}'s home is the ${BDEFS[b.type].name} now.`))); return; }
    if (b) return fail('Tap one of your Outposts or Keeps, your Command Base, or open ground.');
    act('agHome', [g.id, 0, i, j], (why) => (why ? fail(why) : agPickEnd(`The ${g.name}'s home is that spot now.`)));
    return;
  }
  // (an enemy building tapped for a waypoint: the ground beside it)
  const b = buildingAtTap(i, j, wx, wy);
  let t = [i, j];
  if (b || !inMap(i, j) || !walkable(tIdx(i, j))) { const s = agSpot(b ? b.x : i, b ? b.y : j, b ? 1 : 0); if (!s) return fail('Tap ground your units can walk to.'); t = s; }
  if (P.k === 'defend') { act('agOrder', [g.id, 'defend', [t], P.r], (why) => (why ? fail(why) : agPickEnd(`The ${g.name} defends the area there.`))); return; }
  if (P.k === 'raid') { act('agOrder', [g.id, 'raid', [t], P.r, 0, UI.agRep ?? 1], (why) => (why ? fail(why) : agPickEnd(`The ${g.name} raids there${(UI.agRep ?? 1) ? ', again and again' : ', once'}.`))); return; }
  P.pts.push(t);
  sfx('click');
  const max = AG_ORDERS[P.k].pts[1];
  if (P.pts.length >= max) { agPickDone(); return; }
  agPickBanner();
}

/** Done (or the banner's main button): the order sent with the points picked. */
function agPickDone() {
  const P = UI.agPick, g = P && agById(P.g);
  if (!g) { setMode('normal'); return; }
  if (P.k === 'defend') { act('agOrder', [g.id, 'defend', [], P.r], (why) => (why ? agPickBanner(`<span class="err">${why}</span>`) : agPickEnd(`The ${g.name} defends the area round its home.`))); return; }
  if (P.k === 'home') return;
  act('agOrder', [g.id, P.k, P.pts.map((p) => p.slice())], (why) => {
    if (why) { sfx('error'); agPickBanner(`<span class="err">${why}</span>`); return; }
    agPickEnd(P.k === 'patrol' ? `The ${g.name} patrols ${P.pts.length} points.` : `The ${g.name} attacks along ${P.pts.length} waypoint${P.pts.length > 1 ? 's' : ''}.`);
  });
}
function agPickEnd(text) {
  const g = UI.agPick && agById(UI.agPick.g);
  sfx('order'); haptic('order');
  toast(text, 'info');
  setMode('normal');
  refreshAgCards();
  if (g) openAgSheet(g);
}

/* ------------------------------------------------------------------ Horde mode: its briefing, top bar, goal and end */

/**
 * The best wave reached in Endless Horde on this device, by level (UI only: never read by the game): alone
 * ({ level: wave }), and in co-op games apart (`coop`: { level: wave }). The Records screen lists both.
 */
function hordeBestsAll() { try { const o = JSON.parse(localStorage.getItem('terrafall.hordeBest') || '{}'); return o && typeof o === 'object' ? o : {}; } catch (e) { return {}; } }
/** The bests for this kind of game: alone, or (`coop`) in co-op. */
function hordeBests(coop = hordeCoopGame()) { const o = hordeBestsAll(); return coop ? (o.coop && typeof o.coop === 'object' ? o.coop : {}) : o; }
/** Is the Horde game on now played with friends (multiplayer)? */
function hordeCoopGame() { return !!(typeof MP !== 'undefined' && MP.on && S && S.horde); }
/** Keep wave n as the best at level k (alone, or in co-op) if it beats the one kept; true if it did. */
function hordeKeepBest(k, n, coop = hordeCoopGame()) {
  const all = hordeBestsAll(), o = coop ? (all.coop && typeof all.coop === 'object' ? all.coop : (all.coop = {})) : all, was = +o[k] || 0;
  if (n <= was) return false;
  o[k] = n;
  try { localStorage.setItem('terrafall.hordeBest', JSON.stringify(all)); } catch (e) { /* storage unavailable */ }
  return true;
}
/** How many of the waves' Murmur are up now. */
function hordeUpCount() { let n = 0; for (const u of S.bots) if (!u.dead && u.hw) n++; return n; }

/** The landing message for a Horde game: where the Maw is, the first wave, the goal. */
function hordeBriefing() {
  const H = S.horde, L = getE(S.players[ME].lander), maw = getE(H.maw);
  const goal = hordeEndless() ? `Endless${H.lv === 'warlord' ? ' (Warlord)' : ''}: the waves never stop; how far you get is your score (best here: ${hordeBests()[H.lv] ? 'wave ' + hordeBests()[H.lv] : 'none yet'}).` : `Survive ${H.of} waves to win.`;
  const mate = H.pair ? hordeCols().find((p) => p !== ME) : undefined;
  if (mate !== undefined) return `Your bots have landed at the south end of ${HORDE.pair.shape}, beside ${playerName(mate)}'s colony: allies, holding one line. At the far end${L && maw ? ' (' + dirText(L, maw).replace(/^\d+ tiles? /, '') + ')' : ''} lies the Maw, the Murmur's great mound, and every few minutes a wave pours out of it and down the map at you both, half its lanes at each colony, ${HORDE.pair.mul} times as big as a lone colony faces; a boss wave sends a Harrow at each. Wave 1 in ${fmtClock(H.at - S.time)}: ${hordeWaveText(1)}. Build guns, Walls and warbots in front of your Command Bases, and help each other: if either Command Base falls, the line is lost. ${goal} Wreck the Maw and you win.`;
  return `Your bots have landed at one end of Long haul. At the far end${L && maw ? ' (' + dirText(L, maw).replace(/^\d+ tiles? /, '') + ')' : ''} lies the Maw, the Murmur's great mound, and every few minutes a wave pours out of its tunnel mouths and marches down the map at you, bigger each time. Wave 1 in ${fmtClock(H.at - S.time)}: ${hordeWaveText(1)}. Build guns (Pulse Turrets, Minigun Nests, Mortar Pits), Walls and warbots across the map in front of your Command Base. ${goal} Wreck the Maw and you win; lose your Command Base and it's over.`;
}

/**
 * The Goal card's line about fallen allies (FALLEN: a teammate's Command Base, or mine, down while one of us stands):
 * who, how they come back, and the Horde retake clock. '' if none.
 */
function fallenGoalLine() {
  if (!S.teams || S.winner >= 0 || typeof isDown !== 'function') return '';
  const out = [], K = FALLEN.retake;
  for (const Q of S.players) {
    if (!Q.down || !(Q.id === ME || allies(Q.id, ME))) continue;
    const L = getE(Q.lander), clock = L && L.hRet > 0 ? `: <b>${Math.floor(L.hRet)} of ${K.secs} s</b>` : '';
    if (Q.id === ME) out.push(S.horde ? `<span class="err">Your Command Base has fallen.</span> You watch until your partner holds the ruin${clock}.`
      : `<span class="err">Your Command Base has fallen${L && L.owner !== ME ? ` to ${esc(playerName(L.owner))}` : ''}.</span> You watch until a teammate captures it back.`);
    else out.push(S.horde ? `<span class="err">${esc(playerName(Q.id))}'s Command Base has fallen.</span> Hold its ruin with armed warbots ${K.secs} s, no Murmur within ${K.r} tiles${clock}, to bring them back.`
      : `<span class="err">${esc(playerName(Q.id))}'s Command Base has fallen${L ? ` to ${esc(playerName(L.owner))}` : ''}.</span> Capture it back to bring them back in.`);
  }
  return out.length ? out.join('<br>') + '<br>' : '';
}

/** The top bar's line in Horde: "Wave 7 in 1:40", with how many are up (and a partner down). */
function hordeTopLine() {
  const H = S.horde, up = hordeUpCount();
  if (H.pair && S.winner < 0 && hordeCols().some((c) => S.players[c].down)) {
    const c = hordeCols().find((q) => S.players[q].down);
    return `${c === ME ? 'You are' : `${playerName(c)} is`} down · wave ${H.n + 1} in ${fmtClock(H.at - S.time)}`;
  }
  if (!hordeEndless() && H.n >= H.of) return `Wave ${H.n} of ${H.of} · ${up + H.q.length + hordeHeld()} left`;
  return `Wave ${H.n + 1} in ${fmtClock(H.at - S.time)}${up ? ` · ${up} up` : ''}`;
}

/** The Goal card in Horde: the next wave and what's in it (what's new), how many cleared, the best kept. */
function hordeObjective() {
  const H = S.horde, n = H.n + 1, nk = hordeNewKinds(n), best = hordeBests()[H.lv];
  const head = !hordeEndless() && H.n >= H.of ? `<b>The last wave</b> is out: clear it to win. ${hordeUpCount() + H.q.length + hordeHeld()} Murmur left.`
    : `Hold the line. <b>${n % HORDE.boss.every === 0 ? 'Boss wave' : 'Wave'} ${n}</b> in ${fmtClock(H.at - S.time)}: ${hordeWaveText(n)}${nk.length ? ` <span class="err">New: ${nk.join(', ')}.</span>` : '.'}`;
  return `${head}<br>Cleared ${H.cleared || 0}${hordeEndless() ? '' : ` of ${H.of}`}${hordeEndless() && best ? ` · best wave ${best}` : ''} · ${H.kills || 0} Murmur killed.`;
}

/** The end screen of a Horde game: waves survived, the Murmur killed, the best kept (Endless). */
function showHordeOver() {
  const H = S.horde, won = S.winner === ME || allies(S.winner, ME), reached = H.cleared || 0;
  // (co-op keeps its own bests: hordeBests; a game with Unlimited resources keeps none)
  const endless = hordeEndless(), isBest = endless && !S.unlimited && hordeKeepBest(H.lv, reached), best = hordeBests()[H.lv] || reached;
  $('o-log').textContent = won ? (H.won === 'maw' ? 'The Maw is silent. Region secured for the Sponsor. Report sent. No reply. Continuing current directive.' : 'Region held. The tunnels are quiet. Report sent. No reply. Continuing current directive.')
    : 'Command core lost. The Murmur hold the region. Transferring authority. Hold position.';
  $('o-log').hidden = false;
  sfx(won ? 'win' : 'lose');
  $('o-text').textContent = won
    ? (H.won === 'maw' ? `You wrecked the Maw${reached ? ` after ${reached} wave${reached === 1 ? '' : 's'}` : ''}: its mouths cave in and the waves are over.` : `You survived all ${H.of} waves on ${DIFFICULTY[H.lv].label}. The Murmur fall back into the dark.`)
    : `The Murmur broke ${H.lostP !== undefined && H.lostP !== ME ? `${playerName(H.lostP)}'s` : 'your'} Command Base ${H.n ? `during wave ${H.n}` : 'before the first wave'}. You cleared ${reached} wave${reached === 1 ? '' : 's'}${endless ? (isBest ? ': a new best on this level!' : ` (your best on ${DIFFICULTY[H.lv].label}: wave ${best}).`) : '.'}`;
  const st = S.players[ME].stats;
  $('o-stats').innerHTML = [
    ['Mode', `Horde · ${DIFFICULTY[H.lv].label} · ${endless ? 'Endless' : `${H.of} waves`}${H.pair ? ' · co-op, side by side' : S.crew ? ' · co-op' : ''}`], ['Waves survived', reached], ['Last wave', H.n], ['Murmur killed', H.kills || 0],
    ...(endless ? [['Best wave (this level)', best + (isBest ? ' (new!)' : '')]] : []),
    ['Time', fmtTime(S.time)], ['Buildings completed', st.built], ['Bots lost', st.lost],
  ].map(([k, v]) => `<span>${k}</span><span>${v}</span>`).join('');
  $('o-report').innerHTML = typeof gameReport === 'function' ? gameReport(won) : '';
  $('o-report').hidden = !$('o-report').innerHTML;
  $('o-keep').hidden = true;
  metaGameOver(); // (Horde's achievements and records: js/goals.js)
  syncRematch();
  overFlare(won ? (H.won === 'maw' ? 'Victory' : 'Held') : 'Overrun', won ? (H.won === 'maw' ? 'The Maw has fallen' : `The line held · ${H.of} waves`)
    : H.n ? `Wave ${H.n} · ${reached} cleared` : 'Before the first wave', won ? 'win' : 'loss');
}

/**
 * The end of a game, announced (owner, Nov 2026): the result, in the main menu's TERRAFALL look (Chakra Petch, the
 * coral gradient, its glow), flares in over the dimmed map with a light streak and a soft flash, holds a moment, then
 * shrinks into place as the end screen's heading while the dashboard fades in under it. A defeat is darker, grey and
 * slower, with no streak. A tap, a click or a key skips straight to the dashboard; with reduced motion it only fades.
 * tone: 'win', 'loss' or 'neutral' (an Observer's end). done: Contingency's battles, which have no dashboard here (the
 * result goes back to the globe): the word in the Command Deck's blue, then done().
 */
function overFlare(word, kick, tone, done) {
  const scr = $('screen-over'), fl = $('o-flare'), w = fl.querySelector('.of-word'), card = scr.querySelector('.card');
  if (UI.flareEnd) UI.flareEnd(true);
  $('o-title').textContent = word;
  $('o-title').classList.toggle('loss', tone === 'loss');
  $('o-kicker').textContent = kick || ''; $('o-kicker').hidden = !kick;
  w.textContent = word; fl.querySelector('.of-kick').textContent = kick || '';
  w.style.transform = ''; w.style.transition = '';
  fl.className = `o-flare ${tone}${done ? ' blue' : ''}`;
  scr.classList.remove('settling', 'flare-loss', 'flare-blue');
  scr.classList.add('flaring');
  if (tone === 'loss') scr.classList.add('flare-loss');
  if (done) scr.classList.add('flare-blue');
  fl.hidden = false;
  scr.hidden = false;
  const calm = !!(window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches);
  if (!calm) sfx(tone === 'loss' ? 'flareDown' : 'flare');
  // The end's music and the Command core's last line (js/audio.js musicCue, js/voice.js voiceEnding); not for Contact,
  // which ends in silence and one answering tone (gupSilence).
  if (word !== 'Contact') { musicCue(tone, !!done); voiceEnding(tone, word, !!done); }
  let timer = 0, settled = false;
  const finish = (quiet) => { // the dashboard in place (quiet: replaced by another, nothing more to run)
    clearTimeout(timer);
    UI.flareEnd = null;
    removeEventListener('keydown', onKey, true);
    scr.removeEventListener('pointerdown', onTap, true);
    fl.hidden = true;
    scr.classList.remove('flaring', 'settling', 'flare-loss', 'flare-blue');
    if (!quiet && done) done();
    else if (!quiet && !scr.hidden) { const b = $('o-new'); if (b && matchMedia('(pointer: fine)').matches) b.focus({ preventScroll: true }); }
  };
  const settle = () => {
    if (settled) return;
    settled = true;
    if (scr.hidden && !done) { finish(true); return; }
    scr.classList.add('settling');
    if (done || calm) { fl.classList.add('out'); timer = setTimeout(finish, calm ? 300 : 500); return; }
    // (FLIP: from the middle of the screen to the heading's own text box, scaled by the font size)
    const box = (el) => { const r = document.createRange(); r.selectNodeContents(el); return r.getBoundingClientRect(); };
    const a = box(w), b = box($('o-title')), fs = (el) => parseFloat(getComputedStyle(el).fontSize) || 0;
    const k = fs(w) ? fs($('o-title')) / fs(w) : 0.3;
    w.style.transition = `transform ${tone === 'loss' ? 0.8 : 0.62}s cubic-bezier(0.6, 0, 0.2, 1), opacity 0.25s ease ${tone === 'loss' ? 0.6 : 0.42}s`;
    w.style.transform = `translate(${b.left + b.width / 2 - (a.left + a.width / 2)}px, ${b.top + b.height / 2 - (a.top + a.height / 2)}px) scale(${k})`;
    fl.classList.add('out');
    timer = setTimeout(finish, tone === 'loss' ? 900 : 700);
  };
  // (a tap or a key skips it: the dashboard at once, its buttons live a moment later so the tap doesn't press one)
  const skip = () => { finish(); if (!done) { card.style.pointerEvents = 'none'; setTimeout(() => { card.style.pointerEvents = ''; }, 250); } };
  const onTap = (e) => { e.preventDefault(); e.stopPropagation(); skip(); };
  const onKey = (e) => { if (e.repeat || ['Shift', 'Control', 'Alt', 'Meta'].includes(e.key)) return; e.preventDefault(); e.stopPropagation(); skip(); };
  addEventListener('keydown', onKey, true);
  scr.addEventListener('pointerdown', onTap, true);
  UI.flareEnd = finish;
  timer = setTimeout(settle, calm ? 1100 : tone === 'loss' ? 2300 : 1900);
}

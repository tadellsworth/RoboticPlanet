'use strict';
/*
 * Terrafall — boot and main loop. Behind the main menu an AI-vs-AI demo game plays as a backdrop.
 */

let _lastFrame = performance.now();
let _acc = 0;
let _demoT = 0;
const DEMO_FRAME = 30; // ms between drawn frames of the demo behind the menu: about 30 a second is plenty for a backdrop
let _demoWarm = 0; // sim steps the demo still has to fast-forward (see startDemo)

const DEMO_WARM = 30 * 150; // the demo opens 150 s into its game, so it already has a colony going
const WARM_MS = 10;         // most of a frame's time the warm-up may take: the menu stays quick to answer
const BAKE_WAIT = 1500;     // at launch the map waits this long, at most, for the art it's drawn from before it is baked

let _bakeHold = false;      // launch only: the demo's map isn't baked until its art has come (see boot)

const STAGE_FAILS = 5;      // a stage of the frame that fails this many times running is in real trouble...
const STAGE_GAP = 3000;     // ...counting failures no more than this many ms apart (the HUD only works every quarter second)

function startDemo() {
  const seed = randomSeed();
  newGame({ seed, difficulty: 'normal', autoplay: true, biome: BIOME_ORDER[seed % BIOME_ORDER.length] });
  if (!_bakeHold) bakeMap();
  // Zoomed in enough that the planet fills the whole screen behind the menu, even on widescreens.
  R.cam.z = Math.min(maxZoom(), Math.max(minZoom() * 1.6, R.w / (S.W - 6), R.h / (S.H - 6)));
  centerOn(S.W / 2, S.H / 2);
  _demoT = 0;
  // Fast-forward a little so the demo has a colony going: a slice each frame (see step), never all at once,
  // which held up the page for seconds at launch and on every return to the menu.
  _demoWarm = DEMO_WARM;
  TOD.dayHold = true; // (it opens in daylight: the morning it races through isn't drawn, nor its art fetched)
}

function demoCamera(dt) {
  _demoT += dt;
  R.cam.x = S.W / 2 + Math.sin(_demoT * 0.05) * S.W * 0.2;
  R.cam.y = S.H / 2 + Math.sin(_demoT * 0.031) * S.H * 0.3;
  clampCam();
  if (S.winner >= 0 || S.time > 30 * 60) startDemo();
}

function frame(now) {
  // The next frame is booked first: a bug in one frame (drawing, say) can never stop the game.
  requestAnimationFrame(frame);
  try { step(now); } catch (e) { frameError(e); }
}

/** Report a frame's error once (it may repeat every frame), and carry on. */
const _frameErrs = new Set();
function frameError(e) {
  const k = String(e && e.message);
  if (_frameErrs.has(k)) return;
  _frameErrs.add(k);
  console.error('Terrafall: a frame failed and the game carried on.', e);
}

/**
 * Does this frame need drawing? Not when a full screen covers the map in a game (the pause menu, Help,
 * Statistics, game over...), the game behind it is standing still (paused, or over; a multiplayer game runs on under
 * its pause menu) and nothing that shows has changed since the last one drawn: the view, the size of the canvas, new
 * art (R.dirty). A paused game used to be drawn sixty times a second behind its pause menu. And the
 * demo behind the main menu is drawn every DEMO_FRAME ms, not every frame.
 */
const COVERS = ['screen-pause', 'screen-help', 'screen-stats', 'screen-over', 'screen-boost', 'screen-missions', 'screen-mp', 'screen-lore'];
let _drawAt = 0, _drawDt = 0, _drawKey = '';
function drawNeeded(now) {
  if (!S || !R.map) return true;
  if (!UI.inGame) return now - _drawAt >= DEMO_FRAME;
  const still = (UI.paused && !MP.on) || S.winner >= 0;
  const covered = still && COVERS.some((id) => { const el = document.getElementById(id); return el && !el.hidden; });
  const c = R.cam, key = covered ? `${c.x},${c.y},${c.z},${R.canvas.width},${R.canvas.height}` : '';
  const same = key !== '' && key === _drawKey && !R.dirty;
  _drawKey = key;
  return !same;
}

/**
 * One stage of a frame (the simulation, the camera, drawing, the interface, sound) run on its own, so a
 * bug in one never stops the others: a drawing that throws used to skip the interface too, and with it the
 * game-over screen. A stage that keeps failing while a game is being played says so, once, and the game
 * stops saving itself: the last good save is still there to reload.
 */
const _stages = {};
function stage(name, now, fn) {
  try { fn(); } catch (e) {
    frameError(e);
    const f = _stages[name] || (_stages[name] = { n: 0, at: 0 });
    f.n = now - f.at < STAGE_GAP ? f.n + 1 : 1;
    f.at = now;
    if (f.n < STAGE_FAILS || !UI.inGame || UI.saveHold) return;
    UI.saveHold = true; // (autoSave, Save and quit and Download save file check it; a new or loaded game clears it)
    toast('Something in the game keeps going wrong. Saving is paused so your last save stays as it was: reload the page to carry on from it.', 'bad');
  }
}

function step(now) {
  const ms = now - _lastFrame, dt = Math.min(0.1, ms / 1000);
  _lastFrame = now;
  if (S) {
    stage('sim', now, () => {
      const running = UI.inGame ? !UI.paused && S.winner < 0 : true;
      // A multiplayer game keeps time with the other players' devices (lockstep.js), paused or not.
      if (UI.inGame && MP.on) mpFrame(dt);
      else if (MPJ.on) { mpFrame(dt); if (running) { _acc += dt * 1.5 * GAME_PACE; let n = 0; while (_acc >= SIM_STEP && n < 10) { simStep(SIM_STEP); _acc -= SIM_STEP; n++; } } } // (joining: asking for the game, the menu's backdrop playing on)
      else if (running) {
        _acc += dt * (UI.inGame ? UI.speed : 1.5) * GAME_PACE;
        let n = 0;
        while (_acc >= SIM_STEP && n < 10) { simStep(SIM_STEP); _acc -= SIM_STEP; n++; }
        if (n >= 10) _acc = 0;
      }
      // The demo's warm-up: as many steps as fit in WARM_MS of this frame.
      if (!UI.inGame && !MP.on && !MPJ.on && _demoWarm > 0) {
        const t0 = performance.now();
        while (_demoWarm > 0 && performance.now() - t0 < WARM_MS) { simStep(SIM_STEP); _demoWarm--; }
      }
      TOD.dayHold = !UI.inGame && _demoWarm > 0;
    });
    stage('camera', now, () => { if (!UI.inGame) demoCamera(dt); else keyPan(dt); });
  }
  stage('draw', now, () => {
    _drawDt += dt;
    if (!drawNeeded(now)) return;
    if (UI.inGame) watchFrameRate(ms);
    render(Math.min(0.1, _drawDt)); // (the time since the last frame drawn, so what moves by the clock keeps its pace)
    _drawAt = now; _drawDt = 0; R.dirty = false;
  });
  stage('ui', now, () => uiTick(dt));
  stage('sound', now, () => audioTick(dt));
}

function boot() {
  const canvas = document.getElementById('game');
  initRender(canvas);
  initInput(canvas, { onTap: onMapTap, onPaint: onRoadPaint, onPaintEnd: () => { UI.lastPaint = null; UI.roadWarned = false; UI.paintErase = false; }, onHover: onMapHover,
    onBox: onSelectBox, onCommand: onMapCommand, canBox: fieldUnits, onGrab: mapGrab, canPaint: roadPaintStarts });
  initUI();
  // Custom art loads in the background; redraw once after a burst of images arrives. The map is baked again only
  // when art it's drawn from has come (bakedArt), and while more is still on its way at most every two seconds.
  let rebake = 0, mapArt = false, baked = 0;
  // At launch the demo's map is baked once, when the art it's drawn from is in (loadArt asks for that first), or
  // after BAKE_WAIT if that takes longer: then it's baked again as the rest of it arrives, as before. (Baked at
  // once without art and again and again as it came, launch spent seconds baking on a slow link.)
  const firstBake = () => {
    if (!_bakeHold) return;
    _bakeHold = false;
    if (S && !R.map) { mapArt = false; baked = performance.now(); bakeMap(); }
  };
  loadArt((key) => {
    R.dirty = true; // (new art shows even on a frame that would otherwise be skipped: see drawNeeded)
    if (bakedArt(key)) mapArt = true;
    if (_bakeHold && !bakedArtPending()) firstBake();
    clearTimeout(rebake);
    rebake = setTimeout(() => {
      UI.icons = {};
      if (!mapArt || !S || !R.map) return;
      mapArt = false; baked = performance.now();
      bakeMap();
      R.dirty = true;
    }, mapArt && artPending() ? Math.max(120, baked + 2000 - performance.now()) : 120);
  });
  _bakeHold = bakedArtPending() > 0;
  if (_bakeHold) setTimeout(firstBake, BAKE_WAIT);
  // The first frame is booked before the demo is set up (and the demo warms up a slice a frame), so the
  // menu answers straight away.
  requestAnimationFrame(frame);
  startDemo();
  hideSplash();
  if ('serviceWorker' in navigator && location.protocol.startsWith('http') && !window.BOTFALL_NO_SW) {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  }
}

/**
 * The loading screen (#splash in index.html): shown from the first paint, it fades out once the game is up, after
 * two seconds or so, long enough to read its line from the archives (at once under test automation). With reduced
 * motion, the animated icons hold still.
 */
function hideSplash() {
  const el = document.getElementById('splash');
  if (window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches) for (const svg of document.querySelectorAll('svg.m-icon, svg.splash-icon')) if (svg.pauseAnimations) svg.pauseAnimations();
  if (!el) return;
  const wait = typeof navigator !== 'undefined' && navigator.webdriver && !window.BOTFALL_SPLASH ? 0 : Math.max(0, 2000 - performance.now());
  setTimeout(() => { el.classList.add('done'); setTimeout(() => el.remove(), 500); }, wait);
}

boot();

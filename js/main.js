'use strict';
/*
 * Terrafall — boot and main loop. Behind the main menu an AI-vs-AI demo game plays as a backdrop.
 */

let _lastFrame = performance.now();
let _acc = 0;
let _demoT = 0;
const DEMO_FRAME = 30; // ms between drawn frames of the demo behind the menu: about 30 a second is plenty for a backdrop

function startDemo() {
  const seed = randomSeed();
  newGame({ seed, difficulty: 'normal', autoplay: true, biome: BIOME_ORDER[seed % BIOME_ORDER.length] });
  bakeMap();
  // Zoomed in enough that the planet fills the whole screen behind the menu, even on widescreens.
  R.cam.z = Math.min(maxZoom(), Math.max(minZoom() * 1.6, R.w / (S.W - 6), R.h / (S.H - 6)));
  centerOn(S.W / 2, S.H / 2);
  _demoT = 0;
  // Fast-forward a little so the demo already has a colony going.
  for (let k = 0; k < 30 * 150; k++) simStep(SIM_STEP);
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
const COVERS = ['screen-pause', 'screen-help', 'screen-stats', 'screen-over', 'screen-boost', 'screen-missions', 'screen-mp'];
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

function step(now) {
  const dt = Math.min(0.1, (now - _lastFrame) / 1000);
  if (UI.inGame) watchFrameRate(now - _lastFrame);
  _lastFrame = now;
  if (S) {
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
    if (!UI.inGame) demoCamera(dt);
    else keyPan(dt);
  }
  _drawDt += dt;
  if (drawNeeded(now)) {
    render(Math.min(0.1, _drawDt)); // (the time since the last frame drawn, so what moves by the clock keeps its pace)
    _drawAt = now; _drawDt = 0; R.dirty = false;
  }
  uiTick(dt);
  audioTick(dt);
}

function boot() {
  const canvas = document.getElementById('game');
  initRender(canvas);
  initInput(canvas, { onTap: onMapTap, onPaint: onRoadPaint, onPaintEnd: () => { UI.lastPaint = null; UI.roadWarned = false; }, onHover: onMapHover,
    onBox: onSelectBox, onCommand: onMapCommand, canBox: fieldUnits, onGrab: mapGrab, canPaint: roadPaintStarts });
  initUI();
  // Custom art loads in the background; redraw once after a burst of images arrives.
  let rebake = 0;
  loadArt(() => {
    R.dirty = true; // (new art shows even on a frame that would otherwise be skipped: see drawNeeded)
    clearTimeout(rebake);
    rebake = setTimeout(() => { UI.icons = {}; if (S && R.map) { bakeMap(); R.dirty = true; } }, 120);
  });
  startDemo();
  requestAnimationFrame(frame);
  hideSplash();
  if ('serviceWorker' in navigator && location.protocol.startsWith('http') && !window.BOTFALL_NO_SW) {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  }
}

/**
 * The loading screen (#splash in index.html): shown from the first paint, it fades out once the game is up, after
 * a little over a second so it doesn't just flash (at once under test automation). With reduced motion, the
 * animated icons hold still.
 */
function hideSplash() {
  const el = document.getElementById('splash');
  if (window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches) for (const svg of document.querySelectorAll('svg.m-icon, svg.splash-icon')) if (svg.pauseAnimations) svg.pauseAnimations();
  if (!el) return;
  const wait = typeof navigator !== 'undefined' && navigator.webdriver && !window.BOTFALL_SPLASH ? 0 : Math.max(0, 1250 - performance.now());
  setTimeout(() => { el.classList.add('done'); setTimeout(() => el.remove(), 500); }, wait);
}

boot();

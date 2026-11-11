'use strict';
/*
 * Terrafall — boot and main loop. Behind the main menu an AI-vs-AI demo game plays as a backdrop.
 */

let _lastFrame = performance.now();
let _acc = 0;
let _demoT = 0;
let _demoWarm = 0; // sim steps the demo still has to fast-forward (see startDemo)

const DEMO_WARM = 30 * 150; // the demo opens 150 s into its game, so it already has a colony going
const WARM_MS = 10;         // most of a frame's time the warm-up may take: the menu stays quick to answer
const STAGE_FAILS = 5;      // a stage of the frame that fails this many times running is in real trouble...
const STAGE_GAP = 3000;     // ...counting failures no more than this many ms apart (the HUD only works every quarter second)

function startDemo() {
  const seed = randomSeed();
  newGame({ seed, difficulty: 'normal', autoplay: true, biome: BIOME_ORDER[seed % BIOME_ORDER.length] });
  bakeMap();
  // Zoomed in enough that the planet fills the whole screen behind the menu, even on widescreens.
  R.cam.z = Math.min(maxZoom(), Math.max(minZoom() * 1.6, R.w / (S.W - 6), R.h / (S.H - 6)));
  centerOn(S.W / 2, S.H / 2);
  _demoT = 0;
  // Fast-forward a little so the demo has a colony going: a slice each frame (see step), never all at
  // once, which held up the menu for seconds at launch and on every return to it.
  _demoWarm = DEMO_WARM;
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
 * One stage of a frame (the simulation, the camera, drawing, the interface, sound) run on its own, so a
 * bug in one never stops the others. A stage that keeps failing while a game is being played says so,
 * once, and the game stops saving itself: the last good save is still there to reload.
 */
const _stages = {};
function stage(name, now, fn) {
  try { fn(); } catch (e) {
    frameError(e);
    const f = _stages[name] || (_stages[name] = { n: 0, at: 0 });
    f.n = now - f.at < STAGE_GAP ? f.n + 1 : 1;
    f.at = now;
    if (f.n < STAGE_FAILS || !UI.inGame || UI.saveHold) return;
    UI.saveHold = true; // (autoSave and Save and quit check it; a new or loaded game clears it)
    toast('Something in the game keeps going wrong. Saving is paused so your last save stays as it was: reload the page to carry on from it.', 'bad');
  }
}

function step(now) {
  const ms = now - _lastFrame, dt = Math.min(0.1, ms / 1000);
  _lastFrame = now;
  if (S) {
    stage('sim', now, () => {
      const running = UI.inGame ? !UI.paused && S.winner < 0 : true;
      if (running) {
        _acc += dt * (UI.inGame ? UI.speed : 1.5) * GAME_PACE;
        let n = 0;
        while (_acc >= SIM_STEP && n < 10) { simStep(SIM_STEP); _acc -= SIM_STEP; n++; }
        if (n >= 10) _acc = 0;
      }
      // The demo's warm-up: as many steps as fit in WARM_MS of this frame.
      if (!UI.inGame && _demoWarm > 0) {
        const t0 = performance.now();
        while (_demoWarm > 0 && performance.now() - t0 < WARM_MS) { simStep(SIM_STEP); _demoWarm--; }
      }
    });
    stage('camera', now, () => { if (!UI.inGame) demoCamera(dt); else keyPan(dt); });
  }
  stage('draw', now, () => { if (UI.inGame) watchFrameRate(ms); render(dt); });
  stage('ui', now, () => uiTick(dt));
  stage('sound', now, () => audioTick(dt));
}

function boot() {
  const canvas = document.getElementById('game');
  initRender(canvas);
  initInput(canvas, { onTap: onMapTap, onPaint: onRoadPaint, onPaintEnd: () => { UI.lastPaint = null; UI.roadWarned = false; }, onHover: onMapHover,
    onBox: onSelectBox, onCommand: onMapCommand });
  initUI();
  // Custom art loads in the background; redraw once after a burst of images arrives. The map is baked again only
  // when art it's drawn from has come (bakedArt), and while more is still on its way at most every two seconds.
  let rebake = 0, mapArt = false, baked = 0;
  loadArt((key) => {
    if (bakedArt(key)) mapArt = true;
    clearTimeout(rebake);
    rebake = setTimeout(() => {
      UI.icons = {};
      if (!mapArt || !S || !R.map) return;
      mapArt = false; baked = performance.now();
      bakeMap();
    }, mapArt && artPending() ? Math.max(120, baked + 2000 - performance.now()) : 120);
  });
  // The first frame is booked before the demo is set up (and the demo warms up a slice a frame), so the
  // menu answers straight away.
  requestAnimationFrame(frame);
  startDemo();
  if ('serviceWorker' in navigator && location.protocol.startsWith('http') && !window.BOTFALL_NO_SW) {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  }
}

boot();

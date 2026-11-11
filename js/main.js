'use strict';
/*
 * Terrafall — boot and main loop. Behind the main menu an AI-vs-AI demo game plays as a backdrop.
 */

let _lastFrame = performance.now();
let _acc = 0;
let _demoT = 0;

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

function step(now) {
  const dt = Math.min(0.1, (now - _lastFrame) / 1000);
  if (UI.inGame) watchFrameRate(now - _lastFrame);
  _lastFrame = now;
  if (S) {
    const running = UI.inGame ? !UI.paused && S.winner < 0 : true;
    if (running) {
      _acc += dt * (UI.inGame ? UI.speed : 1.5) * GAME_PACE;
      let n = 0;
      while (_acc >= SIM_STEP && n < 10) { simStep(SIM_STEP); _acc -= SIM_STEP; n++; }
      if (n >= 10) _acc = 0;
    }
    if (!UI.inGame) demoCamera(dt);
    else keyPan(dt);
  }
  render(dt);
  uiTick(dt);
  audioTick(dt);
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
  startDemo();
  requestAnimationFrame(frame);
  if ('serviceWorker' in navigator && location.protocol.startsWith('http') && !window.BOTFALL_NO_SW) {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  }
}

boot();

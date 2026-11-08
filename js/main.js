'use strict';
/*
 * Botfall — boot and main loop. Behind the main menu an AI-vs-AI demo game plays as a backdrop.
 */

let _lastFrame = performance.now();
let _acc = 0;
let _demoT = 0;

function startDemo() {
  newGame({ seed: randomSeed(), difficulty: 'normal', autoplay: true });
  bakeMap();
  R.cam.z = minZoom() * 1.6;
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
  const dt = Math.min(0.1, (now - _lastFrame) / 1000);
  _lastFrame = now;
  if (S) {
    const running = UI.inGame ? !UI.paused && S.winner < 0 : true;
    if (running) {
      _acc += dt * (UI.inGame ? UI.speed : 1.5);
      let n = 0;
      while (_acc >= SIM_STEP && n < 10) { simStep(SIM_STEP); _acc -= SIM_STEP; n++; }
      if (n >= 10) _acc = 0;
    }
    if (!UI.inGame) demoCamera(dt);
  }
  render(dt);
  uiTick(dt);
  requestAnimationFrame(frame);
}

function boot() {
  const canvas = document.getElementById('game');
  initRender(canvas);
  initInput(canvas, { onTap: onMapTap, onPaint: onRoadPaint, onPaintEnd: () => { UI.lastPaint = null; } });
  initUI();
  loadArt(() => { UI.icons = {}; if (S && R.map) bakeMap(); });
  startDemo();
  requestAnimationFrame(frame);
  if ('serviceWorker' in navigator && location.protocol.startsWith('http') && !window.BOTFALL_NO_SW) {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  }
}

boot();

'use strict';
/*
 * Terrafall — touch and mouse input on the map.
 *   one finger drag         : pan (or paint paths in path mode; in Arrows only from one of your roads)
 *   mouse left drag         : draw a box to select warbots (pan in other modes; paint paths in path mode)
 *   finger, after Box       : the same box, for one drag (Box on the selection bar arms it; two fingers still pan and zoom)
 *   finger, held then moved : the same box, where you have warbots out (a long press that doesn't move is still a tap)
 *   finger on the crosshair : while aiming a missile, a drag that starts on the crosshair moves it (ui.js mapGrab)
 *   right / middle drag     : pan, in every mode
 *   right click             : order the selected warbots (move, attack, station)
 *   two fingers             : pinch zoom + pan
 *   mouse wheel             : zoom
 *   tap / click             : select, place, attack… (handled by ui.js via onMapTap)
 */

const INPUT = { pointers: new Map(), gesture: null, onTap: null, onPaint: null, onPaintEnd: null, onHover: null, onBox: null, onCommand: null, onGrab: null, canPaint: null, canBox: null, shift: false, tap: null, boxArmed: false };
const LONG_PRESS = 350; // ms a finger rests on the map before its drag draws a selection box (where there are warbots to select)

function initInput(canvas, handlers) {
  Object.assign(INPUT, handlers);
  canvas.addEventListener('pointerdown', onPointerDown);
  canvas.addEventListener('pointermove', onPointerMove);
  canvas.addEventListener('pointerup', onPointerUp);
  canvas.addEventListener('pointercancel', onPointerUp);
  canvas.addEventListener('wheel', onWheel, { passive: false });
  initGestures();
  canvas.addEventListener('contextmenu', (e) => e.preventDefault());
  // A touch on the map never becomes a click as well. The browser makes that click after the finger lifts and
  // aims it at whatever is under the finger by then: a panel the tap just opened had its own buttons pressed
  // (a Depot set to Empty out, a Wall made a Gate, the panel closed again). Nothing on the map listens for
  // clicks; taps come from the pointer events above.
  canvas.addEventListener('touchend', (e) => { if (e.cancelable) e.preventDefault(); }, { passive: false });
  // And a touch that lands on the map stays on the map. A browser moves a fingertip's touch to the nearest thing
  // that takes clicks, a dozen pixels away or so: with nothing on the map listening for clicks, a tap on a tile
  // beside a button pressed the button. (This listener does nothing; that there is one is what counts.)
  canvas.addEventListener('click', () => {});
  // (Should a browser make a touch's click anyway, one that lands off the map where a finger just tapped it is dropped.)
  document.addEventListener('click', (e) => {
    const t = INPUT.tap;
    if (!t || e.target === canvas || performance.now() - t.at > 300 || Math.hypot(e.clientX - t.x, e.clientY - t.y) > 25) return;
    e.stopPropagation(); e.preventDefault();
  }, true);
  // Where the mouse is over the map (edge scrolling and hover tips); cleared when it leaves.
  canvas.addEventListener('pointerleave', (e) => { if (e.pointerType === 'mouse') R.mouse = null; });
}

function _tileAt(sx, sy) {
  const w = screenToWorld(sx, sy);
  return { i: Math.floor(w.x), j: Math.floor(w.y), wx: w.x, wy: w.y };
}

function onPointerDown(e) {
  if (!S) return;
  audioUnlock();
  e.target.setPointerCapture(e.pointerId);
  INPUT.mouse = e.pointerType === 'mouse';
  INPUT.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
  if (INPUT.pointers.size === 1) {
    // Right or middle mouse button: always pans (handy in Paths mode, where a left drag paints).
    const panOnly = e.pointerType === 'mouse' && (e.button === 1 || e.button === 2);
    // With a mouse, a left drag on the map in the normal view draws a selection box, RTS-style. Under a finger
    // the same once Box is armed (`armed`: a tap then does nothing, the box is still waiting to be drawn).
    const mouse = e.pointerType === 'mouse', armed = !mouse && INPUT.boxArmed && R.mode === 'normal' && !!INPUT.onBox;
    const box = armed || (mouse && e.button === 0 && R.mode === 'normal' && !!INPUT.onBox);
    // (grab: something on the map this finger has taken hold of, the aiming crosshair say; its drag moves that, not the map)
    const grab = !mouse && INPUT.onGrab ? INPUT.onGrab(e.clientX, e.clientY) : null;
    const g = INPUT.gesture = { type: 'single', sx: e.clientX, sy: e.clientY, lx: e.clientX, ly: e.clientY, moved: false, painting: false, panOnly, box, armed, grab, button: e.button, hold: 0 };
    // ...or once the finger has rested where it landed for LONG_PRESS ms (a short buzz says so), if there are warbots to box.
    if (!mouse && !box && R.mode === 'normal' && INPUT.onBox && (!INPUT.canBox || INPUT.canBox())) {
      g.hold = setTimeout(() => { if (INPUT.gesture === g && !g.moved) { g.box = true; if (navigator.vibrate) navigator.vibrate(12); } }, LONG_PRESS);
    }
  } else {
    // Two fingers pinch. A third (a palm, a thumb) starts the pinch afresh from where the fingers are now.
    if (INPUT.gesture) clearTimeout(INPUT.gesture.hold);
    R.box = null;
    startPinch();
    if (INPUT.pointers.size === 2 && INPUT.onPaintEnd) INPUT.onPaintEnd();
  }
}

/**
 * A pinch measured from the first two pointers down, as they are now. Started again whenever a finger
 * lands or lifts with two or more still down, so the zoom never jumps to fit a different pair.
 */
function startPinch() {
  const [a, b] = [...INPUT.pointers.values()];
  INPUT.gesture = {
    type: 'pinch',
    d0: Math.hypot(a.x - b.x, a.y - b.y) || 1,
    z0: R.cam.z,
    mid: screenToWorld((a.x + b.x) / 2, (a.y + b.y) / 2),
  };
}

function onPointerMove(e) {
  if (e.pointerType === 'mouse') R.mouse = { x: e.clientX, y: e.clientY, at: performance.now() };
  if (e.pointerType === 'mouse' && S) {
    const t = _tileAt(e.clientX, e.clientY);
    const h = inMap(t.i, t.j) ? tIdx(t.i, t.j) : -1;
    if (h !== R.hover) { R.hover = h; if (INPUT.onHover) INPUT.onHover(t.i, t.j); }
  }
  if (!INPUT.pointers.has(e.pointerId)) return;
  INPUT.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
  const g = INPUT.gesture;
  if (!g) return;
  if (g.type === 'pinch' && INPUT.pointers.size >= 2) {
    const [a, b] = [...INPUT.pointers.values()];
    const d = Math.hypot(a.x - b.x, a.y - b.y) || 1;
    R.cam.z = clamp(g.z0 * (d / g.d0), minZoom(), maxZoom());
    // Keep the world point that started under the fingers' midpoint under it.
    const mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2;
    R.cam.x = g.mid.x - (mx - R.w / 2) / R.cam.z;
    R.cam.y = g.mid.y - (my - R.h / 2) / R.cam.z;
    clampCam();
    return;
  }
  if (g.type !== 'single') return;
  const dx = e.clientX - g.lx, dy = e.clientY - g.ly;
  if (!g.moved && Math.hypot(e.clientX - g.sx, e.clientY - g.sy) > 9) {
    g.moved = true;
    clearTimeout(g.hold);
    const t = _tileAt(g.sx, g.sy);
    if (R.mode === 'road' && !g.panOnly && !(typeof UI !== 'undefined' && UI.roadMode === 'lights') && (!INPUT.canPaint || INPUT.canPaint(t.i, t.j))) {
      g.painting = true;
      if (INPUT.onPaint) INPUT.onPaint(t.i, t.j, true);
    }
  }
  if (g.moved) {
    if (g.grab) g.grab(e.clientX, e.clientY);
    else if (g.box) {
      R.box = { x0: g.sx, y0: g.sy, x1: e.clientX, y1: e.clientY };
    } else if (g.painting) {
      const t = _tileAt(e.clientX, e.clientY);
      if (INPUT.onPaint) INPUT.onPaint(t.i, t.j, false);
    } else {
      R.cam.x -= dx / R.cam.z;
      R.cam.y -= dy / R.cam.z;
      clampCam();
    }
  }
  g.lx = e.clientX; g.ly = e.clientY;
}

function onPointerUp(e) {
  const g = INPUT.gesture;
  const wasSingle = g && g.type === 'single' && INPUT.pointers.size === 1;
  INPUT.pointers.delete(e.pointerId);
  if (g) clearTimeout(g.hold);
  if (wasSingle) {
    // (A cancelled gesture selects, orders and taps nothing, but still ends: no box left on the screen.)
    if (e.type === 'pointerup') {
      INPUT.shift = e.shiftKey;
      if (g.box && g.moved && R.box) {
        if (INPUT.onBox) INPUT.onBox(R.box, e.shiftKey, g.armed);
      } else if (!g.moved && g.panOnly && g.button === 2) {
        const t = _tileAt(e.clientX, e.clientY);
        if (INPUT.onCommand) INPUT.onCommand(t.i, t.j, t.wx, t.wy);
      } else if (!g.moved && !g.panOnly && !g.armed) {
        const t = _tileAt(e.clientX, e.clientY);
        INPUT.tap = e.pointerType === 'mouse' ? null : { at: performance.now(), x: e.clientX, y: e.clientY };
        if (INPUT.onTap) INPUT.onTap(t.i, t.j, t.wx, t.wy);
      }
    }
    R.box = null;
    if (g.painting && INPUT.onPaintEnd) INPUT.onPaintEnd();
  }
  if (INPUT.pointers.size >= 2) startPinch(); // a finger lifted with two still down: carry on from here
  else if (INPUT.pointers.size === 1) {
    // Finishing a pinch with one finger still down continues as a pan (never a tap).
    const p = [...INPUT.pointers.values()][0];
    INPUT.gesture = { type: 'single', sx: p.x, sy: p.y, lx: p.x, ly: p.y, moved: true, painting: false };
  } else if (INPUT.pointers.size === 0) INPUT.gesture = null;
}

/** Zoom to z, keeping the map point under screen point (sx, sy) where it is. */
function zoomAt(sx, sy, z) {
  const before = screenToWorld(sx, sy);
  R.cam.z = clamp(z, minZoom(), maxZoom());
  const after = screenToWorld(sx, sy);
  R.cam.x += before.x - after.x;
  R.cam.y += before.y - after.y;
  clampCam();
}

/**
 * The mouse wheel zooms. Wheels that scroll by lines or pages (some mice, Firefox) count as
 * pixels, and one event never jumps further than a normal wheel notch, so a Magic Mouse or trackpad
 * flick with momentum zooms smoothly. A trackpad pinch (Ctrl + wheel in Chrome and Firefox) zooms
 * faster; a sideways swipe (or Shift + wheel) pans.
 */
function onWheel(e) {
  if (!S) return;
  e.preventDefault();
  const unit = e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? 400 : 1;
  let dx = e.deltaX * unit, dy = e.deltaY * unit;
  if (e.shiftKey && !dx) { dx = dy; dy = 0; }
  if (e.ctrlKey) { zoomAt(e.clientX, e.clientY, R.cam.z * Math.exp(-clamp(dy, -50, 50) * 0.01)); return; }
  if (Math.abs(dx) > Math.abs(dy)) { R.cam.x += clamp(dx, -120, 120) / R.cam.z; clampCam(); return; }
  zoomAt(e.clientX, e.clientY, R.cam.z * Math.exp(-clamp(dy, -120, 120) * 0.0015));
}

/**
 * Safari on a Mac sends a trackpad pinch as gesture events, not wheel events, and would magnify the
 * whole page: zoom the map instead. (On iPhone and iPad a pinch also arrives as two touches, which
 * onPointerMove already handles, so there only the page zoom is stopped.)
 */
function initGestures() {
  let g = null;
  const opt = { passive: false };
  document.addEventListener('gesturestart', (e) => { e.preventDefault(); g = S ? { z: R.cam.z, x: e.clientX || R.w / 2, y: e.clientY || R.h / 2 } : null; }, opt);
  document.addEventListener('gesturechange', (e) => {
    e.preventDefault();
    if (!g || !S || INPUT.pointers.size) return;
    zoomAt(g.x, g.y, g.z * e.scale);
  }, opt);
  document.addEventListener('gestureend', (e) => { e.preventDefault(); g = null; }, opt);
}

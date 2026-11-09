'use strict';
/*
 * Terrafall — touch and mouse input on the map.
 *   one finger drag         : pan (or paint paths in path mode)
 *   mouse left drag         : draw a box to select warbots (pan in other modes; paint paths in path mode)
 *   right / middle drag     : pan, in every mode
 *   right click             : order the selected warbots (move, attack, station)
 *   two fingers             : pinch zoom + pan
 *   mouse wheel             : zoom
 *   tap / click             : select, place, attack… (handled by ui.js via onMapTap)
 */

const INPUT = { pointers: new Map(), gesture: null, onTap: null, onPaint: null, onPaintEnd: null, onHover: null, onBox: null, onCommand: null, shift: false };

function initInput(canvas, handlers) {
  Object.assign(INPUT, handlers);
  canvas.addEventListener('pointerdown', onPointerDown);
  canvas.addEventListener('pointermove', onPointerMove);
  canvas.addEventListener('pointerup', onPointerUp);
  canvas.addEventListener('pointercancel', onPointerUp);
  canvas.addEventListener('wheel', onWheel, { passive: false });
  initGestures();
  canvas.addEventListener('contextmenu', (e) => e.preventDefault());
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
    // With a mouse, a left drag on the map in the normal view draws a selection box, RTS-style.
    const box = e.pointerType === 'mouse' && e.button === 0 && R.mode === 'normal' && !!INPUT.onBox;
    INPUT.gesture = { type: 'single', sx: e.clientX, sy: e.clientY, lx: e.clientX, ly: e.clientY, moved: false, painting: false, panOnly, box, button: e.button };
  } else if (INPUT.pointers.size === 2) {
    const [a, b] = [...INPUT.pointers.values()];
    INPUT.gesture = {
      type: 'pinch',
      d0: Math.hypot(a.x - b.x, a.y - b.y) || 1,
      z0: R.cam.z,
      mid: screenToWorld((a.x + b.x) / 2, (a.y + b.y) / 2),
    };
    if (INPUT.onPaintEnd) INPUT.onPaintEnd();
  }
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
    if (R.mode === 'road' && !g.panOnly && !(typeof UI !== 'undefined' && UI.roadMode === 'lights')) {
      g.painting = true;
      const t = _tileAt(g.sx, g.sy);
      if (INPUT.onPaint) INPUT.onPaint(t.i, t.j, true);
    }
  }
  if (g.moved) {
    if (g.box) {
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
  if (wasSingle && e.type === 'pointerup') {
    INPUT.shift = e.shiftKey;
    if (g.box && g.moved && R.box) {
      if (INPUT.onBox) INPUT.onBox(R.box, e.shiftKey);
    } else if (!g.moved && g.panOnly && g.button === 2) {
      const t = _tileAt(e.clientX, e.clientY);
      if (INPUT.onCommand) INPUT.onCommand(t.i, t.j, t.wx, t.wy);
    } else if (!g.moved && !g.panOnly) {
      const t = _tileAt(e.clientX, e.clientY);
      if (INPUT.onTap) INPUT.onTap(t.i, t.j, t.wx, t.wy);
    }
    R.box = null;
    if (g.painting && INPUT.onPaintEnd) INPUT.onPaintEnd();
  }
  if (INPUT.pointers.size === 1) {
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

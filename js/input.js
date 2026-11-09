'use strict';
/*
 * Botfall — touch and mouse input on the map.
 *   one finger / mouse drag : pan (or paint paths in path mode)
 *   right / middle drag     : pan, in every mode
 *   two fingers             : pinch zoom + pan
 *   mouse wheel             : zoom
 *   tap / click             : select, place, attack… (handled by ui.js via onMapTap)
 */

const INPUT = { pointers: new Map(), gesture: null, onTap: null, onPaint: null, onPaintEnd: null, onHover: null };

function initInput(canvas, handlers) {
  Object.assign(INPUT, handlers);
  canvas.addEventListener('pointerdown', onPointerDown);
  canvas.addEventListener('pointermove', onPointerMove);
  canvas.addEventListener('pointerup', onPointerUp);
  canvas.addEventListener('pointercancel', onPointerUp);
  canvas.addEventListener('wheel', onWheel, { passive: false });
  canvas.addEventListener('contextmenu', (e) => e.preventDefault());
}

function _tileAt(sx, sy) {
  const w = screenToWorld(sx, sy);
  return { i: Math.floor(w.x), j: Math.floor(w.y), wx: w.x, wy: w.y };
}

function onPointerDown(e) {
  if (!S) return;
  audioUnlock();
  e.target.setPointerCapture(e.pointerId);
  INPUT.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
  if (INPUT.pointers.size === 1) {
    // Right or middle mouse button: always pans (handy in Paths mode, where a left drag paints).
    const panOnly = e.pointerType === 'mouse' && (e.button === 1 || e.button === 2);
    INPUT.gesture = { type: 'single', sx: e.clientX, sy: e.clientY, lx: e.clientX, ly: e.clientY, moved: false, painting: false, panOnly };
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
    if (g.painting) {
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
    if (!g.moved && !g.panOnly) {
      const t = _tileAt(e.clientX, e.clientY);
      if (INPUT.onTap) INPUT.onTap(t.i, t.j, t.wx, t.wy);
    }
    if (g.painting && INPUT.onPaintEnd) INPUT.onPaintEnd();
  }
  if (INPUT.pointers.size === 1) {
    // Finishing a pinch with one finger still down continues as a pan (never a tap).
    const p = [...INPUT.pointers.values()][0];
    INPUT.gesture = { type: 'single', sx: p.x, sy: p.y, lx: p.x, ly: p.y, moved: true, painting: false };
  } else if (INPUT.pointers.size === 0) INPUT.gesture = null;
}

function onWheel(e) {
  if (!S) return;
  e.preventDefault();
  const before = screenToWorld(e.clientX, e.clientY);
  R.cam.z = clamp(R.cam.z * Math.exp(-e.deltaY * 0.0015), minZoom(), maxZoom());
  const after = screenToWorld(e.clientX, e.clientY);
  R.cam.x += before.x - after.x;
  R.cam.y += before.y - after.y;
  clampCam();
}

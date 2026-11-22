'use strict';
/*
 * Terrafall: Passenger Town's look and its panel (the city map, SHAPE_PRESETS city). The town is laid by townSetup
 * (world.js) and runs in sim.js (townRun, townDoStrip, townTick); this file only draws it and opens its panels.
 *
 * Drawn in code, in the game's projection (straight down for the ground, the fronts of things standing up toward the
 * camera), after the owner's art direction (Nov 22 2026, ART_GUIDE.md: Passenger Town): a dense grid of blocks packed
 * with mid-rise and taller buildings of varied heights and footprints, chunky blocky forms with rooftop clutter (vents,
 * tanks, fans, pads, antennas), many small warm windows and a few cool accent strips and red or cyan signs, wide
 * streets with lane dashes and kerbs, street lamps, a plaza or two, low haze over it all that thickens at dusk and
 * night. By day muted greys, browns and teal panels with the lights off; at night the lights still run on automatic.
 *
 *   townGround   the streets, kerbs, lane dashes, plazas, parking lots and stripped lots, cached in one picture at
 *                TOWN_GROUND_PX a tile (made again when a building comes down), drawn with the ground (so it's graded
 *                with it at dusk and night)
 *   townItems    the standing pieces among the buildings and robots, sorted with them by their foot: each building (a
 *                cached picture of it, made at the nearest of a few zoom steps and the time of day's colours, and its
 *                lit windows and signs in a second picture added on at night), its sentry, street lamps, the signs
 *   townLights   the light pools at night (render.js's pool)
 *   townHaze     the low haze over the town, on top
 */

const TOWN_GROUND_PX = 16;
const _tg = { of: null, ver: -1, c: null };
const _tb = { key: '', body: new Map() };

/** A number from building r's seed and k (0..1), so its look is the same every time it's drawn. */
function townHash(r, k) { return hash2(r.v % 9973, k, 4111 + (r.v % 31)); }

/* ------------------------------------------------------------------ the ground */

function townGroundCanvas() {
  const T = S.town;
  if (_tg.of === T && _tg.ver === (T.ver || 0) && _tg.c) return _tg.c;
  const G = TOWN_GROUND_PX, y0 = T.y0 - 1, rows = T.y1 - T.y0 + 3, W = S.W;
  const c = _tg.c && _tg.c.width === W * G && _tg.c.height === rows * G ? _tg.c : document.createElement('canvas');
  c.width = W * G; c.height = rows * G;
  const g = c.getContext('2d');
  g.clearRect(0, 0, c.width, c.height);
  const X = (x) => x * G, Y = (y) => (y - y0) * G;
  const speck = (x, y, w, h, n, seed, dark, light) => {
    for (let k = 0; k < n; k++) {
      const a = hash2(k, seed, 4201), b = hash2(seed, k, 4202);
      g.fillStyle = hash2(k, seed, 4203) < 0.5 ? dark : light;
      g.fillRect(X(x) + a * w * G, Y(y) + b * h * G, 1 + (k % 3 === 0 ? 1 : 0), 1);
    }
  };
  // the street paving over the whole town, the mouths of its streets fading out into the land
  g.fillStyle = '#3e4044'; g.fillRect(0, Y(T.y0), W * G, (T.y1 - T.y0 + 1) * G);
  for (const [yy, dir] of [[T.y0 - 1, 1], [T.y1 + 1, 0]]) {
    const gr = g.createLinearGradient(0, Y(yy), 0, Y(yy) + G);
    gr.addColorStop(dir ? 0 : 1, 'rgba(62,64,68,0)'); gr.addColorStop(dir ? 1 : 0, 'rgba(62,64,68,0.85)');
    g.fillStyle = gr; g.fillRect(0, Y(yy), W * G, G);
  }
  speck(0, T.y0, W, T.y1 - T.y0 + 1, W * (T.y1 - T.y0) * 3, 7, 'rgba(0,0,0,0.25)', 'rgba(255,255,255,0.08)');
  // the blocks: a concrete slab with a kerb (the buildings stand on it)
  const plaza = new Map();
  for (const p of T.plazas) plaza.set(p[0] + ',' + p[1], p);
  for (const [ya, yb] of T.ys) for (const [xa, xb] of T.xs) {
    const p = plaza.get(xa + ',' + ya);
    g.fillStyle = '#26282b'; g.fillRect(X(xa) - 1, Y(ya) - 1, (xb - xa) * G + 2, (yb - ya) * G + 2); // (the kerb's shadow)
    g.fillStyle = p && p[4] ? '#46484c' : '#8a867d'; g.fillRect(X(xa), Y(ya), (xb - xa) * G, (yb - ya) * G);
    g.strokeStyle = 'rgba(210,205,190,0.55)'; g.lineWidth = 1.5; g.strokeRect(X(xa) + 1, Y(ya) + 1, (xb - xa) * G - 2, (yb - ya) * G - 2);
    if (!p) continue;
    if (p[4]) { // a parking lot: bays marked in faded white
      g.strokeStyle = 'rgba(225,222,210,0.5)'; g.lineWidth = 1;
      for (let x = xa + 0.5; x < xb; x += 0.5) for (let y = ya; y < yb; y += 1) { g.beginPath(); g.moveTo(X(x), Y(y) + 2); g.lineTo(X(x), Y(y) + G * 0.42); g.stroke(); }
    } else { // a plaza: paving, planters and a dry fountain
      g.strokeStyle = 'rgba(60,55,50,0.25)'; g.lineWidth = 1;
      for (let x = xa; x <= xb; x += 0.5) { g.beginPath(); g.moveTo(X(x), Y(ya)); g.lineTo(X(x), Y(yb)); g.stroke(); }
      for (let y = ya; y <= yb; y += 0.5) { g.beginPath(); g.moveTo(X(xa), Y(y)); g.lineTo(X(xb), Y(y)); g.stroke(); }
      const cx = X((xa + xb) / 2), cy = Y((ya + yb) / 2);
      g.fillStyle = '#5d6264'; g.beginPath(); g.arc(cx, cy, G * 0.95, 0, 7); g.fill();
      g.fillStyle = '#7f8a8c'; g.beginPath(); g.arc(cx, cy, G * 0.75, 0, 7); g.fill();
      g.fillStyle = '#6b6e66'; g.beginPath(); g.arc(cx, cy, G * 0.18, 0, 7); g.fill();
      for (const [a, b] of [[xa + 0.15, ya + 0.15], [xb - 0.65, ya + 0.15], [xa + 0.15, yb - 0.65], [xb - 0.65, yb - 0.65]]) { g.fillStyle = '#4b5a3c'; g.fillRect(X(a), Y(b), G * 0.5, G * 0.5); g.fillStyle = '#6f8a4a'; g.fillRect(X(a) + 2, Y(b) + 2, G * 0.5 - 4, G * 0.5 - 4); }
    }
  }
  // lane dashes down the middle of every street, kerbs either side; none across the crossings
  const rowSt = [], colSt = [];
  for (let k = 0; k + 1 < T.xs.length; k++) colSt.push([T.xs[k][1], T.xs[k + 1][0]]);
  for (let k = 0; k + 1 < T.ys.length; k++) rowSt.push([T.ys[k][1], T.ys[k + 1][0]]);
  g.strokeStyle = 'rgba(232,226,205,0.6)'; g.lineWidth = Math.max(1, G * 0.07); g.setLineDash([G * 0.38, G * 0.32]);
  for (const [a, b] of colSt) for (const [ya, yb] of T.ys) { const x = X((a + b) / 2); g.beginPath(); g.moveTo(x, Y(ya) + G * 0.2); g.lineTo(x, Y(yb) - G * 0.2); g.stroke(); }
  for (const [a, b] of colSt) { const x = X((a + b) / 2); g.beginPath(); g.moveTo(x, Y(T.y0 - 1) + G * 0.5); g.lineTo(x, Y(T.ys[0][0])); g.moveTo(x, Y(T.ys[T.ys.length - 1][1])); g.lineTo(x, Y(T.y1 + 1) + G * 0.5); g.stroke(); }
  for (const [a, b] of rowSt) for (const [xa, xb] of T.xs) { const y = Y((a + b) / 2); g.beginPath(); g.moveTo(X(xa) + G * 0.2, y); g.lineTo(X(xb) - G * 0.2, y); g.stroke(); }
  g.setLineDash([]);
  // zebra crossings at the crossings' edges, worn
  g.fillStyle = 'rgba(225,220,200,0.32)';
  for (const [a, b] of colSt) for (const [ra, rb] of rowSt) for (const yy of [ra - 0.32, rb + 0.06]) for (let k = 0; k < 4; k++) g.fillRect(X(a) + G * (0.12 + k * 0.47), Y(yy), G * 0.24, G * 0.26);
  // the stripped lots: foundations, rubble and rebar where a building stood (an arcade's: the street again, scarred)
  for (const r of T.r) {
    if (!r.gone) continue;
    const x = X(r.x), y = Y(r.y), w = r.w * G, h = r.h * G;
    if (r.k !== 'arcade' && r.k !== 'car') {
      g.fillStyle = '#6e6a62'; g.fillRect(x + 1, y + 1, w - 2, h - 2);
      g.strokeStyle = 'rgba(40,36,32,0.6)'; g.lineWidth = 1.5; g.strokeRect(x + 3, y + 3, w - 6, h - 6);
      g.strokeStyle = 'rgba(40,36,32,0.35)'; g.lineWidth = 1;
      for (let k = 1; k < r.w; k++) { g.beginPath(); g.moveTo(x + k * G, y + 3); g.lineTo(x + k * G, y + h - 3); g.stroke(); }
    }
    speck(r.x, r.y, r.w, r.h, r.w * r.h * 14, r.v % 997, 'rgba(30,26,22,0.55)', 'rgba(220,210,190,0.35)');
    g.strokeStyle = 'rgba(120,70,40,0.6)'; g.lineWidth = 1;
    for (let k = 0; k < r.w * r.h; k++) { const a = hash2(k, r.v % 991, 4204), b = hash2(r.v % 991, k, 4205); g.beginPath(); g.moveTo(x + a * w, y + b * h); g.lineTo(x + a * w + (hash2(k, 3, 4206) - 0.5) * G * 0.6, y + b * h + (hash2(k, 4, 4207) - 0.5) * G * 0.4); g.stroke(); }
  }
  _tg.of = T; _tg.ver = T.ver || 0; _tg.c = c;
  return c;
}

/** The town's ground, with the rest of the ground (before its light: graded with it). */
function townGround(ctx, ox, oy, z) {
  if (!S.town || typeof document === 'undefined') return;
  const c = townGroundCanvas(), T = S.town;
  ctx.save(); ctx.imageSmoothingEnabled = true;
  ctx.drawImage(c, ox, oy + (T.y0 - 1) * z, S.W * z, (T.y1 - T.y0 + 3) * z);
  ctx.restore();
}

/* ------------------------------------------------------------------ the buildings */

const TOWN_LOOK = {
  house: { body: ['#8c7a68', '#9a8a74', '#7f6e66', '#a08c74', '#86786a'], roof: '#6b655d', tiers: 1 },
  shop: { body: ['#7b7f80', '#8a7d6c', '#6e7476', '#94877a'], roof: '#5f6266', tiers: 1 },
  flats: { body: ['#6b7073', '#5d6b70', '#77736c', '#646a6e', '#6e655f'], roof: '#55595c', tiers: 2 },
  tower: { body: ['#4f5559', '#585a63', '#5b5350', '#4a5560', '#5d5a55'], roof: '#45484c', tiers: 3 },
  school: { body: ['#b2aa9a', '#a9a493'], roof: '#7d7a72', tiers: 1 },
  hall: { body: ['#b4ac9c'], roof: '#5f8a7a', tiers: 2 },
  spire: { body: ['#5a6066'], roof: '#40464c', tiers: 4 },
  arcade: { body: ['#6d7377'], roof: '#86aab4', tiers: 1 },
  car: { body: ['#8a3a30', '#3a5a7a', '#c8b27a', '#5a6a4a', '#d0d0c8'], roof: '#2a2c30', tiers: 1 },
};
/** How tall building r stands now (tiles, as drawn): it comes down as it's stripped. */
function townHeight(r) { const f = r.n0 ? townLeft(r) / r.n0 : 1; return (r.hgt / 10) * (0.3 + 0.7 * f); }
/** Its stripped share in steps (a new picture each step). */
function townStep(r) { return r.n0 ? Math.round((1 - townLeft(r) / r.n0) * 8) : 0; }
/** A colour lightened (k > 0) or darkened (k < 0), as #rrggbb. */
function townShade(hex, k) {
  const v = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
  return '#' + v.map((x) => Math.round(clamp(k > 0 ? x + (255 - x) * k : x * (1 + k), 0, 255)).toString(16).padStart(2, '0')).join('');
}

/**
 * Paint building r (body, graded for the time of day: `col` maps a colour) and its lights (glow) at zb pixels a tile.
 * The picture's top-left is at tile (r.x - 0.4, r.y - top) where top is its full height plus a tile.
 */
function townPaint(r, zb, col, glow) {
  const L = TOWN_LOOK[r.k], full = r.hgt / 10, H = townHeight(r), step = townStep(r);
  const top = full + 1.1, ox = r.x - 0.4, oy = r.y - top;
  const w = Math.ceil((r.w + 1.6) * zb), h = Math.ceil((r.h + top + 0.2) * zb);
  const bc = document.createElement('canvas'); bc.width = w; bc.height = h;
  const gc = document.createElement('canvas'); gc.width = w; gc.height = h;
  const b = bc.getContext('2d'), g = gc.getContext('2d');
  const X = (x) => (x - ox) * zb, Y = (y) => (y - oy) * zb;
  const rnd = (k) => townHash(r, k);
  const base = L.body[Math.floor(rnd(1) * L.body.length)], ROOFS = ['#6b6e72', '#7a746a', '#56686a', '#857b6f', '#4f5a5e', '#8f8c85', '#6a5f58'], roofC = r.k === 'hall' || r.k === 'arcade' || r.k === 'spire' || r.k === 'car' ? L.roof : ROOFS[Math.floor(rnd(8) * ROOFS.length)];
  const flick = [];
  // its shadow on the street to the east
  b.fillStyle = 'rgba(10,12,16,0.28)';
  b.beginPath(); b.moveTo(X(r.x + r.w), Y(r.y + 0.1)); b.lineTo(X(r.x + r.w + Math.min(1.1, H * 0.35)), Y(r.y + 0.4)); b.lineTo(X(r.x + r.w + Math.min(1.1, H * 0.35)), Y(r.y + r.h)); b.lineTo(X(r.x + r.w), Y(r.y + r.h)); b.closePath(); b.fill();
  if (r.k === 'car') { townCar(b, r, X, Y, zb, col, base); return { body: bc, glow: gc, ox, oy, flick }; }
  // the tiers, each set back from the one under it
  const nT = r.k === 'flats' ? (r.w * r.h >= 9 && rnd(2) < 0.6 ? 2 : 1) : r.k === 'tower' ? 2 + (rnd(3) < 0.5 ? 1 : 0) : L.tiers;
  const inset = 0.1;
  let x0 = r.x + inset, x1 = r.x + r.w - inset, yb = r.y + inset, yf = r.y + r.h - inset, h0 = 0;
  const strip = rnd(4) < 0.55, sign = rnd(5), lit = 0.35 + rnd(6) * 0.4, warm = rnd(7) < 0.8 ? '#ffcf7a' : '#ffe6b8';
  for (let k = 0; k < nT; k++) {
    const share = nT === 1 ? 1 : k === nT - 1 ? 1 : [0.55, 0.7, 0.8][k] || 0.8;
    let h1 = k === nT - 1 ? H : h0 + (H - h0) * share;
    if (r.k === 'hall' && k === 0) h1 = H * 0.62;
    if (h1 - h0 < 0.08) break;
    const bodyC = r.k === 'hall' && k === 1 ? '#a39b8b' : k % 2 && r.k === 'tower' ? townShade(base, -0.08) : base;
    // the front face, then its roof
    const fx = X(x0), fw = X(x1) - fx, fy = Y(yf - h1), fh = (h1 - h0) * zb;
    b.fillStyle = col(bodyC); b.fillRect(fx, fy, fw, fh);
    const ao = b.createLinearGradient(0, fy + fh * 0.6, 0, fy + fh);
    ao.addColorStop(0, 'rgba(0,0,0,0)'); ao.addColorStop(1, 'rgba(0,0,0,0.22)'); b.fillStyle = ao; b.fillRect(fx, fy, fw, fh);
    b.fillStyle = 'rgba(0,0,0,0.18)'; b.fillRect(fx + fw - Math.max(1, zb * 0.06), fy, Math.max(1, zb * 0.06), fh); // (its east edge in shade)
    townFacade(b, g, r, k, fx, fy, fw, fh, zb, col, bodyC, { strip, sign, lit, warm, flick, x0, yf, h0, h1, X, Y });
    const roofTop = Y(yb - h1), roofH = Y(yf - h1) - roofTop;
    const rc = r.k === 'arcade' ? '#86aab4' : (r.k === 'hall' && k === 1) || k === nT - 1 ? roofC : townShade(roofC, 0.12);
    b.fillStyle = col(townShade(rc, 0.1)); b.fillRect(fx, roofTop, fw, roofH);
    b.strokeStyle = col(townShade(rc, -0.35)); b.lineWidth = Math.max(1, zb * 0.05); b.strokeRect(fx + b.lineWidth / 2, roofTop + b.lineWidth / 2, fw - b.lineWidth, roofH - b.lineWidth);
    if (r.k === 'arcade') { // a glass roof on ribs
      b.strokeStyle = col('#4a5a60'); b.lineWidth = Math.max(1, zb * 0.04);
      for (let x = x0 + 0.33; x < x1; x += 0.33) { b.beginPath(); b.moveTo(X(x), roofTop); b.lineTo(X(x), roofTop + roofH); b.stroke(); }
      b.fillStyle = 'rgba(255,255,255,0.12)'; b.fillRect(fx, roofTop, fw, roofH * 0.35);
    }
    if (k === nT - 1) townRoof(b, g, r, X(x0), roofTop, fw, roofH, zb, col, step);
    else if (step && k === nT - 2) { /* (the upper tiers come down first) */ }
    // the next tier back from this one's front and sides
    h0 = h1;
    const sx = Math.min((x1 - x0) * 0.18, 0.5), sy = Math.min((yf - yb) * 0.3, 0.7);
    if (r.k === 'hall') { x0 += (x1 - x0) * 0.25; x1 -= (x1 - x0) * 0.33; yb += 0.3; yf -= (yf - yb) * 0.45; }
    else if (r.k === 'spire') { x0 += 0.12; x1 -= 0.12; yb += 0.1; yf -= 0.12; }
    else { x0 += sx * (rnd(10 + k) < 0.5 ? 1 : 0.4); x1 -= sx * (rnd(20 + k) < 0.5 ? 1 : 0.4); yf -= sy; yb += 0.05; }
    if (x1 - x0 < 0.4 || yf - yb < 0.3) break;
  }
  if (step) { // stripping under way: scaffold over the front, girders showing
    b.strokeStyle = col('#9a9488'); b.lineWidth = Math.max(1, zb * 0.03);
    const fy = Y(r.y + r.h - inset - H), fb = Y(r.y + r.h - inset);
    for (let x = r.x + inset; x <= r.x + r.w - inset + 0.01; x += 0.5) { b.beginPath(); b.moveTo(X(x), fy - zb * 0.15); b.lineTo(X(x), fb); b.stroke(); }
    for (let y = fy; y < fb; y += zb * 0.3) { b.beginPath(); b.moveTo(X(r.x + inset), y); b.lineTo(X(r.x + r.w - inset), y); b.stroke(); }
    b.fillStyle = 'rgba(30,25,20,0.35)'; b.fillRect(X(r.x + inset), fy, X(r.x + r.w - inset) - X(r.x + inset), zb * 0.12);
  }
  if (r.k === 'hall') { // steps up to its doors, and its columns
    b.fillStyle = col('#c9c1b0'); b.fillRect(X(r.x + r.w * 0.3), Y(r.y + r.h - 0.1) - zb * 0.08, (r.w * 0.4) * zb, zb * 0.12);
  }
  return { body: bc, glow: gc, ox, oy, flick };
}

/** A building's front: floors of windows (lit at night in the glow), accents and signs, by its kind. */
function townFacade(b, g, r, k, fx, fy, fw, fh, zb, col, bodyC, o) {
  const rnd = (n) => townHash(r, n);
  const floorH = r.k === 'shop' ? 0.3 : r.k === 'school' || r.k === 'hall' ? 0.3 : 0.22;
  const floors = Math.max(1, Math.round(fh / (floorH * zb)));
  const fhh = fh / floors, ww = zb * (r.k === 'school' ? 0.2 : 0.12), sp = zb * (r.k === 'school' ? 0.3 : 0.22);
  const cols = Math.max(1, Math.floor((fw - zb * 0.12) / sp)), pad = (fw - cols * sp) / 2 + (sp - ww) / 2;
  const glass = col('#262d36'), band = col(townShade(bodyC, 0.16));
  if (r.k === 'arcade') { // arches over the street's way through
    for (let x = fx + zb * 0.08; x < fx + fw - zb * 0.3; x += zb * 0.5) { b.fillStyle = glass; b.beginPath(); b.moveTo(x, fy + fh); b.lineTo(x, fy + fh * 0.45); b.arc(x + zb * 0.17, fy + fh * 0.45, zb * 0.17, Math.PI, 0); b.lineTo(x + zb * 0.34, fy + fh); b.fill(); g.fillStyle = 'rgba(255,200,120,0.35)'; g.fillRect(x + zb * 0.05, fy + fh * 0.55, zb * 0.24, fh * 0.4); }
    return;
  }
  for (let f = 0; f < floors; f++) {
    const y = fy + f * fhh;
    if (zb >= 10) { b.fillStyle = band; b.fillRect(fx, y, fw, Math.max(1, zb * 0.025)); }
    const ground = f === floors - 1 && k === 0;
    if (ground && (r.k === 'shop' || (r.k === 'flats' && rnd(30) < 0.4) || r.k === 'tower')) { // a shopfront: big window, awning
      b.fillStyle = glass; b.fillRect(fx + zb * 0.08, y + fhh * 0.3, fw - zb * 0.16, fhh * 0.62);
      g.fillStyle = rnd(31) < 0.5 ? 'rgba(255,214,140,0.85)' : 'rgba(200,236,255,0.7)'; g.fillRect(fx + zb * 0.1, y + fhh * 0.34, fw - zb * 0.2, fhh * 0.52);
      const aw = ['#3f7f86', '#8a3a30', '#b08a3a', '#4f6a4a'][Math.floor(rnd(32) * 4)];
      b.fillStyle = col(aw); b.fillRect(fx + zb * 0.04, y + fhh * 0.12, fw - zb * 0.08, fhh * 0.2);
      continue;
    }
    for (let c = 0; c < cols; c++) {
      const x = fx + pad + c * sp, wy = y + fhh * 0.28, wh = fhh * 0.5;
      b.fillStyle = glass; b.fillRect(x, wy, ww, wh);
      const hs = hash2(r.v % 7919 + c * 13, f + k * 31, 4301);
      if (hs < o.lit) { g.fillStyle = hs < o.lit * 0.12 ? '#9fe8ff' : o.warm; g.globalAlpha = 0.65 + 0.35 * hash2(c, f, r.v % 113); g.fillRect(x, wy, ww, wh); g.globalAlpha = 1; }
      else if (o.flick.length < 3 && hs > 0.985) o.flick.push([x, wy, ww, wh]);
    }
    if (r.k === 'flats' && f < floors - 1 && zb >= 12) { b.fillStyle = col(townShade(bodyC, -0.3)); b.fillRect(fx + zb * 0.05, y + fhh * 0.82, fw - zb * 0.1, Math.max(1, fhh * 0.1)); } // (balconies)
  }
  if (r.k === 'hall' && k === 0) { // columns across its front
    for (let x = fx + zb * 0.25; x < fx + fw - zb * 0.1; x += zb * 0.45) { b.fillStyle = col('#d4ccbb'); b.fillRect(x, fy + fh * 0.18, zb * 0.12, fh * 0.82); }
    b.fillStyle = col('#8c8474'); b.fillRect(fx, fy, fw, fh * 0.16);
    g.fillStyle = 'rgba(255,220,160,0.5)'; g.fillRect(fx + fw * 0.4, fy + fh * 0.5, fw * 0.2, fh * 0.5);
  }
  if (r.k === 'school' && k === 0) { // its yellow band and the clock over the door
    b.fillStyle = col('#c9a23a'); b.fillRect(fx, fy + zb * 0.04, fw, zb * 0.07);
    b.fillStyle = col('#e9e4d6'); b.beginPath(); b.arc(fx + fw / 2, fy + zb * 0.08, zb * 0.13, 0, 7); b.fill();
    b.strokeStyle = col('#333'); b.lineWidth = Math.max(1, zb * 0.02); b.beginPath(); b.moveTo(fx + fw / 2, fy + zb * 0.08); b.lineTo(fx + fw / 2, fy - zb * 0.02); b.moveTo(fx + fw / 2, fy + zb * 0.08); b.lineTo(fx + fw / 2 + zb * 0.07, fy + zb * 0.1); b.stroke();
  }
  // accents: a cool strip up one edge, a red panel sign or a cyan glyph sign
  if (o.strip && fh > zb * 0.5 && r.k !== 'school' && r.k !== 'hall') {
    const sx = rnd(40) < 0.5 ? fx + zb * 0.04 : fx + fw - zb * 0.1;
    b.fillStyle = col('#3f7f86'); b.fillRect(sx, fy + zb * 0.05, zb * 0.06, fh - zb * 0.1);
    g.fillStyle = '#5ff0e8'; g.fillRect(sx, fy + zb * 0.05, zb * 0.06, fh - zb * 0.1);
  }
  if (k === 0 && fh > zb * 0.45 && r.k !== 'hall' && r.k !== 'school') {
    const sw = zb * 0.32, sh = zb * 0.42, sx = fx + fw * (0.2 + rnd(41) * 0.5), sy = fy + zb * 0.08;
    if (o.sign < 0.3) { b.fillStyle = col('#7a2e26'); b.fillRect(sx, sy, sw, sh); g.fillStyle = '#ff5a3a'; for (let n = 0; n < 3; n++) g.fillRect(sx + sw * 0.15, sy + sh * (0.15 + n * 0.28), sw * 0.7, sh * 0.14); }
    else if (o.sign < 0.55) { b.fillStyle = col('#1d3a40'); b.fillRect(sx, sy, sw, sw); g.fillStyle = '#7ff6ff'; g.fillRect(sx + sw * 0.15, sy + sw * 0.15, sw * 0.3, sw * 0.3); g.fillRect(sx + sw * 0.55, sy + sw * 0.55, sw * 0.3, sw * 0.3); g.fillRect(sx + sw * 0.55, sy + sw * 0.15, sw * 0.12, sw * 0.3); g.strokeStyle = '#7ff6ff'; g.lineWidth = Math.max(1, zb * 0.02); g.strokeRect(sx + 1, sy + 1, sw - 2, sw - 2); }
    else if (o.sign < 0.68 && r.k === 'shop') { b.fillStyle = col('#3a2a1a'); b.fillRect(fx + zb * 0.1, fy - zb * 0.12, fw - zb * 0.2, zb * 0.14); g.fillStyle = '#ffb24a'; g.fillRect(fx + zb * 0.16, fy - zb * 0.1, fw - zb * 0.32, zb * 0.1); }
  }
}

/** The roof's clutter: vents, tanks, fans, a landing pad, antennas; a stripped roof's girders. */
function townRoof(b, g, r, x, y, w, h, zb, col, step) {
  const rnd = (n) => townHash(r, n);
  const box = (bx, by, bw, bd, bh, c) => { b.fillStyle = col(townShade(c, -0.15)); b.fillRect(bx, by + bd - bh, bw, bh); b.fillStyle = col(townShade(c, 0.12)); b.fillRect(bx, by - bh, bw, bd); };
  if (step >= 3) { // girders where the roof was
    b.fillStyle = 'rgba(25,22,20,0.55)'; b.fillRect(x + zb * 0.08, y + zb * 0.08, w - zb * 0.16, h - zb * 0.16);
    b.strokeStyle = col('#7a5a40'); b.lineWidth = Math.max(1, zb * 0.04);
    for (let gx = x + zb * 0.2; gx < x + w - zb * 0.1; gx += zb * 0.35) { b.beginPath(); b.moveTo(gx, y + zb * 0.1); b.lineTo(gx, y + h - zb * 0.1); b.stroke(); }
    return;
  }
  if (r.k === 'spire') { // the beacon housing and its mast
    box(x + w * 0.25, y + h * 0.2, w * 0.5, h * 0.5, zb * 0.25, '#6a7077');
    b.strokeStyle = col('#9aa0a6'); b.lineWidth = Math.max(1, zb * 0.04); b.beginPath(); b.moveTo(x + w / 2, y + h * 0.3); b.lineTo(x + w / 2, y - zb * 0.85); b.stroke();
    g.fillStyle = '#ffe8b0'; g.beginPath(); g.arc(x + w / 2, y + h * 0.35 - zb * 0.25, zb * 0.12, 0, 7); g.fill();
    return;
  }
  if (r.k === 'hall') { // the flagpole, no flag
    b.strokeStyle = col('#d8d8d0'); b.lineWidth = Math.max(1, zb * 0.03); b.beginPath(); b.moveTo(x + w * 0.5, y + h * 0.5); b.lineTo(x + w * 0.5, y - zb * 0.6); b.stroke();
    return;
  }
  if (r.k === 'arcade' || w < zb * 0.5 || h < zb * 0.4) return;
  const n = clamp(Math.round((w * h) / (zb * zb) * 1.6), 1, 7);
  for (let k = 0; k < n; k++) {
    const kind = rnd(50 + k), px = x + zb * 0.1 + rnd(60 + k) * Math.max(0, w - zb * 0.6), py = y + zb * 0.12 + rnd(70 + k) * Math.max(0, h - zb * 0.5);
    if (kind < 0.35) box(px, py, zb * 0.3, zb * 0.22, zb * 0.12, '#7d8084'); // a vent
    else if (kind < 0.55) { b.fillStyle = col('#8f9396'); b.beginPath(); b.ellipse(px + zb * 0.15, py + zb * 0.1, zb * 0.15, zb * 0.12, 0, 0, 7); b.fill(); b.fillStyle = col('#6a6e72'); b.fillRect(px, py + zb * 0.1, zb * 0.3, zb * 0.12); } // a tank
    else if (kind < 0.75) { b.fillStyle = col('#3d4145'); b.beginPath(); b.arc(px + zb * 0.15, py + zb * 0.12, zb * 0.14, 0, 7); b.fill(); b.strokeStyle = col('#8a8e92'); b.lineWidth = Math.max(1, zb * 0.025); b.beginPath(); b.moveTo(px + zb * 0.05, py + zb * 0.05); b.lineTo(px + zb * 0.25, py + zb * 0.19); b.moveTo(px + zb * 0.25, py + zb * 0.05); b.lineTo(px + zb * 0.05, py + zb * 0.19); b.stroke(); } // a fan
    else if (kind < 0.88) box(px, py, zb * 0.45, zb * 0.14, zb * 0.08, '#6c7075'); // a row of units
    else { b.strokeStyle = col('#a6aaae'); b.lineWidth = Math.max(1, zb * 0.025); b.beginPath(); b.moveTo(px + zb * 0.1, py + zb * 0.15); b.lineTo(px + zb * 0.1, py - zb * 0.5); b.stroke(); g.fillStyle = '#ff4a3a'; g.fillRect(px + zb * 0.07, py - zb * 0.53, zb * 0.06, zb * 0.06); } // an antenna
  }
  if (r.k === 'tower' && w > zb * 0.9 && h > zb * 0.8 && rnd(80) < 0.6) { // a landing pad
    const cx = x + w / 2, cy = y + h / 2, rr = Math.min(w, h) * 0.32;
    b.fillStyle = col('#3a3d41'); b.beginPath(); b.arc(cx, cy, rr, 0, 7); b.fill();
    b.strokeStyle = col('#c9b25a'); b.lineWidth = Math.max(1, zb * 0.035); b.beginPath(); b.arc(cx, cy, rr * 0.75, 0, 7); b.stroke();
    g.strokeStyle = 'rgba(120,240,255,0.8)'; g.lineWidth = Math.max(1, zb * 0.03); g.beginPath(); g.arc(cx, cy, rr * 0.92, 0, 7); g.stroke();
  }
}

/** A parked car: a small box, its glass dark. */
function townCar(b, r, X, Y, zb, col, base) {
  const x = X(r.x + 0.18), w = zb * 0.64, y = Y(r.y + 0.25), d = zb * 0.5, h = zb * 0.2;
  b.fillStyle = 'rgba(0,0,0,0.3)'; b.fillRect(x + zb * 0.05, y + d - zb * 0.02, w, zb * 0.08);
  b.fillStyle = col(townShade(base, -0.2)); b.fillRect(x, y + d - h, w, h);
  b.fillStyle = col(base); b.fillRect(x, y - h, w, d);
  b.fillStyle = col('#2a3038'); b.fillRect(x + w * 0.2, y - h + d * 0.2, w * 0.6, d * 0.55);
  b.fillStyle = col('#6a4a30'); b.fillRect(x + w * 0.1, y - h + d * 0.1, w * 0.08, d * 0.08); // (rust)
}

/** The pictures of building r now, from the cache (made at the zoom step nearest z). */
function townSprite(r, z) {
  const zb = clamp(Math.pow(2, Math.round(Math.log2(Math.max(4, z)) * 2) / 2), 8, 72);
  const st = typeof TOD !== 'undefined' && TOD.active && TOD.state ? TOD.state : null;
  const tk = st ? st.mul.map((v) => Math.round(v * 20)).join() + '/' + st.add.map((v) => Math.round(v * 40)).join() : 'day';
  if (_tb.key !== tk) { _tb.key = tk; _tb.body.clear(); }
  const key = r.id + '|' + zb + '|' + townStep(r);
  let e = _tb.body.get(key);
  if (!e) {
    const col = (c) => (typeof todColor === 'function' ? todColor(c) : c);
    e = townPaint(r, zb, col);
    e.zb = zb;
    _tb.body.set(key, e);
    if (_tb.body.size > 240) _tb.body.delete(_tb.body.keys().next().value);
  }
  return e;
}

/** How dark it is (0 day to 1 night), for the lights. */
function townNight() { return typeof TOD !== 'undefined' && TOD.active && TOD.state ? clamp(TOD.state.lights || 0, 0, 1) : 0; }

/** The standing pieces (render.js's items): the buildings, their sentries, the street lamps and the signs. */
function townItems(items, inView) {
  const T = S.town;
  for (const r of T.r) if (!r.gone && inView(r.x + r.w / 2, r.y + r.h / 2, Math.max(r.w, r.h) / 2 + 5)) items.push({ ent: 'town', r, x: r.x, y: r.y + r.h - 0.02 });
  for (const [x, y] of T.signs) if (inView(x, y, 4)) items.push({ ent: 'town', sign: [x, y], x, y: y + 0.6 });
  for (let a = 0; a + 1 < T.xs.length; a++) for (let b = 0; b + 1 < T.ys.length; b++) {
    const x = T.xs[a][1], y = T.ys[b][1]; // (a lamp on the north-west corner of each crossing)
    if (inView(x, y, 3)) items.push({ ent: 'town', lamp: [x + 0.08, y + 0.12], x: x + 0.08, y: y + 0.12 });
  }
}

/** One of townItems' pieces. */
function townDraw(ctx, e, ox, oy, z) {
  const live = typeof R !== 'undefined' && !R.inMap, night = townNight();
  if (e.lamp) {
    const x = ox + e.lamp[0] * z, y = oy + e.lamp[1] * z;
    ctx.fillStyle = typeof todColor === 'function' ? todColor('#3a3e44') : '#3a3e44'; ctx.fillRect(x - z * 0.025, y - z * 0.75, z * 0.05, z * 0.75);
    ctx.fillRect(x - z * 0.025, y - z * 0.75, z * 0.28, z * 0.04);
    if (night > 0.05) { ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = night; ctx.fillStyle = '#ffe2a8'; ctx.fillRect(x + z * 0.16, y - z * 0.73, z * 0.12, z * 0.05); ctx.restore(); }
    return;
  }
  if (e.sign) {
    const x = ox + (e.sign[0] + 0.5) * z, y = oy + (e.sign[1] + 0.5) * z, art = typeof lmArt === 'function' ? lmArt('lm-sign') : null;
    if (art) drawArt(ctx, art, x, y, z); else if (typeof lmBox === 'function') lmBox(ctx, x, y, z, 0.9, 0.35, '#e9e2cf', '#3a6e9a');
    if (typeof lmSignGlow === 'function') lmSignGlow(ctx, x, y, z);
    return;
  }
  const r = e.r, sp = townSprite(r, z), k = z / sp.zb;
  const dx = ox + sp.ox * z, dy = oy + sp.oy * z;
  ctx.drawImage(sp.body, dx, dy, sp.body.width * k, sp.body.height * k);
  if (night > 0.03 && live) {
    const flicker = townHash(r, 90) < 0.12 ? (hash2(Math.floor(R.time * 7), r.id, 4401) < 0.18 ? 0.35 : 1) : 1;
    ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = night * 0.9 * flicker;
    ctx.drawImage(sp.glow, dx, dy, sp.glow.width * k, sp.glow.height * k);
    ctx.globalAlpha = night * 0.9;
    for (const [fx, fy, fw, fh] of sp.flick) if (hash2(Math.floor(R.time * 3 + fx), r.id, 4402) < 0.5) { ctx.fillStyle = '#ffd890'; ctx.fillRect(dx + fx * k, dy + fy * k, fw * k, fh * k); }
    ctx.restore();
  }
  if (live && (r.k === 'spire' || r.k === 'tower')) { // the civic tower's beacon (dusk to dawn), a tower's red light
    const H = townHeight(r), bx = ox + (r.x + r.w / 2) * z, by = oy + (r.y + 0.3 - H) * z;
    if (r.k === 'spire' && night > 0.05) { ctx.save(); ctx.globalCompositeOperation = 'lighter'; const a = night * (0.55 + 0.45 * Math.sin(R.time * 1.3)); const gr = ctx.createRadialGradient(bx, by - z * 0.5, 0, bx, by - z * 0.5, z * 1.4); gr.addColorStop(0, `rgba(255,236,190,${a})`); gr.addColorStop(1, 'rgba(255,236,190,0)'); ctx.fillStyle = gr; ctx.fillRect(bx - z * 1.4, by - z * 1.9, z * 2.8, z * 2.8); ctx.restore(); }
    if (r.k === 'tower' && Math.sin(R.time * 3.1 + r.id) > 0.6) { ctx.fillStyle = '#ff3a2a'; ctx.fillRect(bx - z * 0.03, by - z * 0.08, z * 0.06, z * 0.06); }
  }
  if (r.sen > 0) townSentryDraw(ctx, r, ox, oy, z, live);
}

/** An old Accord sentry at its post on the roof: a squat white robot with a blue band and a lit visor. */
function townSentryDraw(ctx, r, ox, oy, z, live) {
  const x = ox + (r.x + r.w / 2) * z, y = oy + (r.y + r.h * 0.6 - townHeight(r)) * z, c = (h) => (typeof todColor === 'function' ? todColor(h) : h);
  ctx.fillStyle = 'rgba(0,0,0,0.3)'; ctx.beginPath(); ctx.ellipse(x, y, z * 0.22, z * 0.08, 0, 0, 7); ctx.fill();
  ctx.fillStyle = c('#c9ccd0'); ctx.fillRect(x - z * 0.16, y - z * 0.42, z * 0.32, z * 0.4);
  ctx.fillStyle = c('#2f5d86'); ctx.fillRect(x - z * 0.16, y - z * 0.26, z * 0.32, z * 0.06);
  ctx.fillStyle = c('#e4e6e8'); ctx.fillRect(x - z * 0.12, y - z * 0.56, z * 0.24, z * 0.16);
  ctx.fillStyle = '#8ff2ff'; ctx.fillRect(x - z * 0.09, y - z * 0.5, z * 0.18, z * 0.05);
  ctx.fillStyle = c('#55595e'); ctx.fillRect(x + z * 0.16, y - z * 0.36, z * 0.14, z * 0.05); // (its arm, the old service carbine)
  if (live && Math.sin(R.time * 2.2 + r.id) > 0.85) { ctx.fillStyle = '#ff5a3a'; ctx.fillRect(x - z * 0.03, y - z * 0.62, z * 0.06, z * 0.05); }
  const f = r.sen / TOWN.sentry.hp; // (its armour, when it's been hit)
  if (f < 1) { ctx.fillStyle = 'rgba(0,0,0,0.6)'; ctx.fillRect(x - z * 0.2, y - z * 0.74, z * 0.4, z * 0.06); ctx.fillStyle = '#8ff2ff'; ctx.fillRect(x - z * 0.2, y - z * 0.74, z * 0.4 * f, z * 0.06); }
}

/** Night: the light pools (render.js's pool): lamps at the crossings, shop windows, the civic tower's beacon. */
function townLights(pool, ox, oy, z, inView) {
  const k = townNight(), T = S.town;
  if (k < 0.02) return;
  for (let a = 0; a + 1 < T.xs.length; a++) for (let b = 0; b + 1 < T.ys.length; b++) {
    const x = T.xs[a][1] + 1, y = T.ys[b][1] + 1;
    if (inView(x, y, 3)) pool(ox + x * z, oy + y * z, z * 0.9, '#ffd9a0');
  }
  for (const r of T.r) {
    if (r.gone || r.k === 'car' || !inView(r.x + r.w / 2, r.y + r.h, 3)) continue;
    pool(ox + (r.x + r.w / 2) * z, oy + (r.y + r.h + 0.2) * z, z * Math.min(1.5, r.w * 0.4), townHash(r, 4) < 0.4 ? '#7fe8f0' : '#ffcf8a');
    if (r.k === 'spire') pool(ox + (r.x + r.w / 2) * z, oy + (r.y + r.h / 2) * z, z * 4, '#fff0c8');
  }
}

/** The low haze over the town: thin by day, thick at dusk and night, deepest at the town's edges. */
function townHaze(ctx, ox, oy, z) {
  if (!S.town || (typeof R !== 'undefined' && (R.inMap || R.clean >= 2))) return;
  const T = S.town, night = townNight(), a = 0.05 + 0.13 * night;
  const x0 = ox, x1 = ox + S.W * z, y0 = oy + (T.y0 - 1.5) * z, y1 = oy + (T.y1 + 2.5) * z;
  ctx.save();
  const c = night > 0.5 ? '96,108,138' : '170,180,196';
  const gy = ctx.createLinearGradient(0, y0, 0, y1);
  gy.addColorStop(0, `rgba(${c},0)`); gy.addColorStop(0.15, `rgba(${c},${a})`); gy.addColorStop(0.85, `rgba(${c},${a})`); gy.addColorStop(1, `rgba(${c},0)`);
  ctx.fillStyle = gy; ctx.fillRect(x0, y0, x1 - x0, y1 - y0);
  const ny = Math.max(2, Math.round((T.y1 - T.y0) / 3)); // (thicker toward the map's edges: the town fades into it)
  for (let k = 0; k <= ny; k++) for (const ex of [x0, x1]) {
    const ey = oy + (T.y0 + ((T.y1 - T.y0) * k) / ny) * z, rr = z * 4;
    const gr = ctx.createRadialGradient(ex, ey, 0, ex, ey, rr);
    gr.addColorStop(0, `rgba(${c},${a * 0.7})`); gr.addColorStop(1, `rgba(${c},0)`);
    ctx.fillStyle = gr; ctx.fillRect(ex - rr, ey - rr, rr * 2, rr * 2);
  }
  const t = typeof R !== 'undefined' ? R.time : 0; // (banks of it drifting slowly east)
  for (let k = 0; k < 7; k++) {
    const cx = ox + (((hash2(k, 1, 4501) * S.W + t * 0.12 * (0.5 + hash2(k, 2, 4502))) % (S.W + 8)) - 4) * z, cy = oy + (T.y0 + hash2(k, 3, 4503) * (T.y1 - T.y0)) * z, rr = z * (3 + hash2(k, 4, 4504) * 4);
    const gr = ctx.createRadialGradient(cx, cy, 0, cx, cy, rr);
    gr.addColorStop(0, `rgba(${c},${a * 0.9})`); gr.addColorStop(1, `rgba(${c},0)`);
    ctx.fillStyle = gr; ctx.fillRect(cx - rr, cy - rr, rr * 2, rr * 2);
  }
  ctx.restore();
}

/** Zoomed out: the town's name in the atlas's faded lettering over the middle. */
function townLabel(ctx, ox, oy, z) {
  if (!S.town || typeof R === 'undefined' || R.clean >= 2 || z >= 22) return;
  const a = clamp((22 - z) / 8, 0, 1) * 0.7, fs = Math.max(11, Math.min(20, z * 1.1));
  ctx.save(); ctx.globalAlpha = a; ctx.font = `600 ${fs}px Georgia, 'Times New Roman', serif`; ctx.textAlign = 'center';
  if ('letterSpacing' in ctx) ctx.letterSpacing = `${Math.round(fs * 0.22)}px`;
  const x = ox + (S.W / 2) * z, y = oy + (S.H / 2 + 0.35) * z;
  ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(20,16,12,0.55)'; ctx.strokeText('PASSENGER TOWN', x, y);
  ctx.fillStyle = '#f1e4c8'; ctx.fillText('PASSENGER TOWN', x, y);
  if ('letterSpacing' in ctx) ctx.letterSpacing = '0px';
  ctx.restore();
}

/* ------------------------------------------------------------------ its panel */

/** The days building r's sentry has held its post (since the Pathfinder built the town, 71 years ago, by the game's days). */
function townDay() { return 25933 + Math.floor((S.time || 0) / 720); }

/** Tapped: a building's panel (its name and line, the salvage left, who strips it; Strip for salvage). */
function townSheet(r) {
  if (!r) return;
  if (typeof R !== 'undefined') { R.selected = 0; R.selTile = -1; }
  if (typeof UI !== 'undefined') UI.selBot = 0;
  const D = TOWN_KINDS[r.k], mine = (r.by >> ME) & 1;
  const crew = S.bots.filter((u) => !u.dead && u.task && u.task.type === 'strip' && u.task.r === r.id);
  const ours = crew.filter((u) => u.owner === ME).length, theirs = crew.length - ours;
  const left = ['cement', 'alloy', 'chip'].filter((g) => r.g[g] > 0).map((g) => `${r.g[g]} ${GOOD[g].name}${g === 'chip' && r.g[g] !== 1 ? 's' : ''}`).join(', ') || 'nothing';
  let state;
  if (r.sen > 0) state = `<b>An old Accord sentry is on duty here</b> (armour ${Math.ceil(r.sen)} of ${TOWN.sentry.hp}). It shoots any robot within ${TOWN.sentry.range} tiles. Select warbots and tap the building to send them: they shoot back from beside it. Its log: "${esc(TOWN_SENTRY_LINE.replace('{day}', townDay().toLocaleString('en-GB')))}"`;
  else if (mine) state = ours ? `<b>Being stripped:</b> ${ours} of your Workers on it (up to ${townCrew(r)}). Crates go down beside it; Haulers with a road to them, or idle Workers, carry them home.` : '<b>Ordered stripped:</b> your next free Workers go to it.';
  else state = 'Strip it for salvage: up to ' + townCrew(r) + ' of your Workers take it apart, and its lot becomes open ground, a new way through the town.';
  if (theirs) state += ` <b>${theirs} rival Worker${theirs > 1 ? 's are' : ' is'} stripping it too.</b>`;
  const btn = r.sen > 0 ? '' : mine ? '<button class="btn" id="sh-unstrip">Stop stripping</button>' : '<button class="btn primary" id="sh-strip">Strip for salvage</button>';
  const html = `<div class="sheet-title"><div><h3>${esc(D.name.replace(/^the /i, 'The '))}</h3><div class="sub">Passenger Town${r.cache && r.n0 - townLeft(r) > 0 ? '' : ''}</div></div></div>
    <p class="flavor">${esc(D.line)}</p>
    <p class="desc">Salvage left: <b>${esc(left)}</b>${r.n0 ? ` (${Math.round((townLeft(r) / r.n0) * 100)}%)` : ''}. ${state}</p>
    <p class="desc">Robots on the street beside it are in cover: they take a quarter less damage.</p>
    ${btn ? `<div class="btn-row">${btn}</div>` : ''}`;
  openSheet('town', r.id, html);
  const go = (on) => { sfx('click'); act('townStrip', [r.id, on], (why) => { if (why) toast(why, 'warn'); else toast(on ? `${D.name.replace(/^the /i, 'The ')}: your Workers are on their way to strip it.` : 'Stripping called off.', 'info'); townSheet(townById(r.id)); }); };
  if ($('sh-strip')) $('sh-strip').onclick = () => go(true);
  if ($('sh-unstrip')) $('sh-unstrip').onclick = () => go(false);
}
/** A few times a second (the interface): an open building's panel kept current; a building that came down closes it. */
function townUiTick() {
  if (!S || !S.town || typeof UI === 'undefined' || UI.sheetKind !== 'town') return;
  const r = townById(UI.sheetFor);
  if (!r || r.gone) { closeSheet(); return; }
  UI.townT = (UI.townT || 0) + 1;
  if (UI.townT % 4 === 0) townSheet(r);
}

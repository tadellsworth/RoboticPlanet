'use strict';
/*
 * Terrafall — canvas renderer. Terrain, paths and resources are baked into an offscreen image
 * (only changed tiles are redrawn); buildings, bots and effects are drawn every frame.
 *
 * Placeholder art is drawn with canvas shapes. Any piece listed in art/art-manifest.js is
 * drawn from the image file instead (see ART below).
 */

const TP = 32; // baked map pixels per tile

const R = {
  canvas: null, ctx: null, dpr: 1, w: 0, h: 0,
  cam: { x: 20, y: 48, z: 34 },
  map: null, mapCtx: null,
  terr: null, terrCtx: null, terrVer: -1, borders: [],
  overlay: null,          // { type, valid: Uint8Array, ver }
  ghost: null,            // { type, x, y, ok }
  selected: 0,            // building id
  selTile: -1,            // tile index of a selected resource
  hover: -1,              // tile under the mouse pointer
  routePreview: null,     // tiles a building's "Lay road" button would pave
  keys: new Set(),        // arrow / WASD keys held down (desktop panning)
  mode: 'normal',
  time: 0,
};

// Ground colour pairs per elevation level, from canyon floor (0) up to the high mesas (4).
const LEVEL_GROUND = [
  ['#7a462d', '#93593a'],
  ['#ad6f47', '#c99a66'],
  ['#c88d5a', '#e0b07a'],
  ['#d7a46e', '#ecc28c'],
  ['#e3b781', '#f5d3a0'],
];

const THEME = {
  ground1: '#ad6f47', ground2: '#c99a66',
  cliffTop: '#62402c', cliffBottom: '#3a2418', slope: '#d9b98a',
  water: '#1c4b5d', waterEdge: '#2e7684', foam: '#9fd9d0',
  rock: '#5d4134', rockTop: '#73513f', rockHi: '#94694f', rockShadow: '#36241d',
  road: '#8d8478', roadEdge: '#4f473f',
  hull: '#262a33', hullHi: '#3a404c', icon: '#eef2f6',
};

/* ------------------------------------------------------------------ custom art */

const ART = {};
let artLoaded = 0;

function loadArt(onChange) {
  if (typeof ART_MANIFEST !== 'object') return;
  for (const key in ART_MANIFEST) {
    const entry = typeof ART_MANIFEST[key] === 'string' ? { src: ART_MANIFEST[key] } : ART_MANIFEST[key];
    const img = new Image();
    img.onload = () => {
      ART[key] = { img, scale: entry.scale || 0, anchor: entry.anchor || '', shadow: !!entry.shadow };
      artLoaded++;
      if (key.startsWith('icon-')) applyGoodIcons();
      if (onChange) onChange(key);
    };
    img.onerror = () => console.warn('Terrafall: could not load art for', key, entry.src);
    img.src = /^(data:|https?:)/.test(entry.src) ? entry.src : 'art/' + entry.src;
  }
}

/** Goods icons in the HUD and menus are CSS shapes; custom 'icon-<good>' art replaces them. */
function applyGoodIcons() {
  let css = '';
  for (const g of GOODS) {
    const a = ART['icon-' + g];
    if (a) css += `.gi.${g}{background:url("${a.img.src}") center/contain no-repeat!important;clip-path:none!important;border-radius:0!important;outline:none!important;box-shadow:none!important;width:16px!important;height:16px!important}`;
  }
  let el = document.getElementById('good-icon-art');
  if (!el) { el = document.createElement('style'); el.id = 'good-icon-art'; document.head.appendChild(el); }
  el.textContent = css;
}

function artFor(key, owner) {
  return ART[key + '@' + owner] || ART[key] || null;
}

/** Draw part of a seamless texture so one image spans 4×4 tiles (less visible repetition). */
function drawTexture(ctx, art, i, j, x, y) {
  const span = 4, img = art.img;
  const sw = img.width / span, sh = img.height / span;
  ctx.drawImage(img, (i % span) * sw, (j % span) * sh, sw, sh, x, y, TP, TP);
}

/**
 * The turret head image facing closest to `aim` (radians, 0 = right, clockwise on screen), from the
 * art keys turret-head-0 … turret-head-7 (or -15 for 16 directions), team versions first. Null if
 * there are none.
 */
function turretHead(owner, aim) {
  const n = artFor('turret-head-15', owner) ? 16 : artFor('turret-head-7', owner) ? 8 : 0;
  if (!n) return null;
  const k = ((Math.round(aim / ((Math.PI * 2) / n)) % n) + n) % n;
  return artFor('turret-head-' + k, owner);
}

/**
 * Draw an art image centred on (cx, cy) at sizePx × its scale. Art with anchor 'bottom' (buildings
 * drawn in a 3/4 view, rising above their tile) is lined up so the image's bottom edge sits on the
 * bottom edge of the tile instead; an anchor [ax, ay] puts that point of the image (fractions of
 * its size) on (cx, cy).
 */
function drawArt(ctx, art, cx, cy, sizePx, angle) {
  const s = sizePx * (art.scale || 1);
  if (Array.isArray(art.anchor) && !angle) {
    ctx.drawImage(art.img, cx - art.anchor[0] * s, cy - art.anchor[1] * s, s, s);
    return;
  }
  if (art.anchor === 'bottom' && !angle) cy += (sizePx - s) / 2;
  if (angle) {
    ctx.save(); ctx.translate(cx, cy); ctx.rotate(angle);
    ctx.drawImage(art.img, -s / 2, -s / 2, s, s);
    ctx.restore();
  } else ctx.drawImage(art.img, cx - s / 2, cy - s / 2, s, s);
}

/* ------------------------------------------------------------------ setup */

function initRender(canvas) {
  R.canvas = canvas;
  R.ctx = canvas.getContext('2d');
  resizeRender();
  window.addEventListener('resize', resizeRender);
  window.addEventListener('orientationchange', () => setTimeout(resizeRender, 250));
  window.addEventListener('pageshow', resizeRender);
  if (window.visualViewport) window.visualViewport.addEventListener('resize', resizeRender);
}

function resizeRender() {
  R.dpr = Math.min(2, window.devicePixelRatio || 1);
  // Installed web apps on iPhone sometimes report a viewport shorter than the screen; take the
  // largest of the measurements so the map always reaches the bottom edge.
  const vv = window.visualViewport;
  R.w = Math.max(window.innerWidth, document.documentElement.clientWidth);
  R.h = Math.max(window.innerHeight, document.documentElement.clientHeight, vv ? Math.round(vv.height) : 0);
  R.canvas.width = Math.round(R.w * R.dpr);
  R.canvas.height = Math.round(R.h * R.dpr);
  R.canvas.style.width = R.w + 'px';
  R.canvas.style.height = R.h + 'px';
  if (S) clampCam();
}

function minZoom() { return Math.max(8, Math.min(R.w / (S.W + 2), R.h / (S.H + 2))); }
function maxZoom() { return 80; }

function clampCam() {
  const c = R.cam;
  c.z = clamp(c.z, minZoom(), maxZoom());
  const hw = R.w / 2 / c.z, hh = R.h / 2 / c.z;
  // The map may scroll a little past its edges so the edge tiles can be brought out from under
  // the top bar, the banner and the side panel.
  const wide = isWide();
  const padX = Math.max(1, Math.min(R.w * 0.3, 440) / c.z), padT = Math.max(1.5, (R.h * (wide ? 0.12 : 0.22)) / c.z);
  const padB = Math.max(2.5, (R.h * (wide ? 0.08 : 0.4)) / c.z);
  c.x = S.W / 2 <= hw ? S.W / 2 : clamp(c.x, hw - padX, S.W - hw + padX);
  c.y = S.H / 2 <= hh ? S.H / 2 : clamp(c.y, hh - padT, S.H - hh + padB);
}

/** Desktop / widescreen layout (matches the CSS media query). */
function isWide() { return R.w >= 1000 && R.h >= 520; }

function centerOn(x, y) { R.cam.x = x; R.cam.y = y; clampCam(); }
function screenToWorld(sx, sy) { return { x: (sx - R.w / 2) / R.cam.z + R.cam.x, y: (sy - R.h / 2) / R.cam.z + R.cam.y }; }
function worldToScreen(wx, wy) { return { x: (wx - R.cam.x) * R.cam.z + R.w / 2, y: (wy - R.cam.y) * R.cam.z + R.h / 2 }; }

/* ------------------------------------------------------------------ baked map */

function bakeMap() {
  // A completely flat map uses the mid-level colours.
  let maxElev = 0;
  for (let t = 0; t < S.W * S.H; t++) if (S.elev[t] > maxElev) maxElev = S.elev[t];
  R.levelOffset = maxElev === 0 ? 1 : 0;
  R.map = document.createElement('canvas');
  R.map.width = S.W * TP;
  R.map.height = S.H * TP;
  R.mapCtx = R.map.getContext('2d');
  for (let j = 0; j < S.H; j++) for (let i = 0; i < S.W; i++) drawTile(i, j);
  R.terr = document.createElement('canvas');
  R.terr.width = S.W; R.terr.height = S.H;
  R.terrCtx = R.terr.getContext('2d');
  R.terrVer = -1;
  S.dirtyTiles.length = 0;
  MM.dirty = true;
}

function flushDirtyTiles() {
  if (!S.dirtyTiles.length) return;
  MM.dirty = true;
  const seen = new Set();
  for (const t of S.dirtyTiles) {
    if (seen.has(t)) continue;
    seen.add(t);
    drawTile(t % S.W, (t / S.W) | 0);
  }
  S.dirtyTiles.length = 0;
}

function terrAt(i, j) { return inMap(i, j) ? S.terrain[tIdx(i, j)] : T_ROCK; }

function levelColor(e, n) {
  const pal = LEVEL_GROUND[clamp(e + (R.levelOffset || 0), 0, LEVEL_GROUND.length - 1)];
  return mixColor(pal[0], pal[1], clamp(n * 1.4 - 0.2, 0, 1));
}

function drawTile(i, j) {
  const ctx = R.mapCtx, x = i * TP, y = j * TP, t = tIdx(i, j);
  const terr = S.terrain[t];
  const n = fbm(i / 6, j / 6, 991, 3);
  ctx.fillStyle = levelColor(S.elev[t], n);
  ctx.fillRect(x, y, TP, TP);
  if (ART.ground) {
    drawTexture(ctx, ART.ground, i, j, x, y);
    // Keep elevation readable on top of the texture: higher ground is lighter, canyons darker.
    const d = S.elev[t] + (R.levelOffset || 0) - 1;
    if (d > 0) { ctx.fillStyle = `rgba(255,236,205,${Math.min(0.34, 0.1 * d)})`; ctx.fillRect(x, y, TP, TP); }
    else if (d < 0) { ctx.fillStyle = 'rgba(45,22,10,0.26)'; ctx.fillRect(x, y, TP, TP); }
  } else {
    for (let k = 0; k < 5; k++) {
      const h = hash2(i * 7 + k, j * 3 - k, 41);
      const px = x + hash2(i, j * 5 + k, 11) * (TP - 3), py = y + hash2(i * 3 + k, j, 13) * (TP - 3);
      ctx.fillStyle = h < 0.5 ? 'rgba(70,35,15,0.16)' : 'rgba(255,235,200,0.13)';
      ctx.fillRect(px, py, h < 0.25 ? 3 : 2, 2);
    }
  }

  if (terr === T_WATER) {
    if (ART.water) {
      drawTexture(ctx, ART.water, i, j, x, y);
      ctx.fillStyle = 'rgba(159,217,208,0.5)';
      if (terrAt(i, j - 1) !== T_WATER) ctx.fillRect(x, y, TP, 2);
      if (terrAt(i - 1, j) !== T_WATER) ctx.fillRect(x, y, 2, TP);
      ctx.fillStyle = 'rgba(10,30,40,0.35)';
      if (terrAt(i, j + 1) !== T_WATER) ctx.fillRect(x, y + TP - 2, TP, 2);
      if (terrAt(i + 1, j) !== T_WATER) ctx.fillRect(x + TP - 2, y, 2, TP);
    } else {
      ctx.fillStyle = THEME.water;
      ctx.fillRect(x, y, TP, TP);
      ctx.fillStyle = THEME.waterEdge;
      const e = 6;
      if (terrAt(i, j - 1) !== T_WATER) ctx.fillRect(x, y, TP, e);
      if (terrAt(i, j + 1) !== T_WATER) ctx.fillRect(x, y + TP - e, TP, e);
      if (terrAt(i - 1, j) !== T_WATER) ctx.fillRect(x, y, e, TP);
      if (terrAt(i + 1, j) !== T_WATER) ctx.fillRect(x + TP - e, y, e, TP);
      ctx.fillStyle = 'rgba(159,217,208,0.55)';
      if (terrAt(i, j - 1) !== T_WATER) ctx.fillRect(x, y, TP, 2);
      if (terrAt(i - 1, j) !== T_WATER) ctx.fillRect(x, y, 2, TP);
      ctx.strokeStyle = 'rgba(159,217,208,0.25)';
      ctx.lineWidth = 1.5;
      const rx = x + 8 + hash2(i, j, 3) * 12, ry = y + 10 + hash2(i, j, 4) * 12;
      ctx.beginPath(); ctx.moveTo(rx, ry); ctx.quadraticCurveTo(rx + 4, ry - 3, rx + 8, ry); ctx.stroke();
    }
  } else if (terr === T_ROCK) {
    if (ART.rock) {
      drawTexture(ctx, ART.rock, i, j, x, y);
      ctx.fillStyle = 'rgba(255,225,190,0.22)';
      if (terrAt(i, j - 1) !== T_ROCK) ctx.fillRect(x, y, TP, 2);
      if (terrAt(i - 1, j) !== T_ROCK) ctx.fillRect(x, y, 2, TP);
      ctx.fillStyle = 'rgba(15,8,4,0.45)';
      if (terrAt(i, j + 1) !== T_ROCK) ctx.fillRect(x, y + TP - 4, TP, 4);
      if (terrAt(i + 1, j) !== T_ROCK) ctx.fillRect(x + TP - 3, y, 3, TP);
    } else {
      const up = terrAt(i, j - 1) === T_ROCK, dn = terrAt(i, j + 1) === T_ROCK;
      const lf = terrAt(i - 1, j) === T_ROCK, rt = terrAt(i + 1, j) === T_ROCK;
      const l = lf ? 0 : 3, r = rt ? 0 : 3, tp = up ? 0 : 3, b = dn ? 0 : 7;
      ctx.fillStyle = THEME.rockShadow;
      ctx.fillRect(x + l, y + tp + 3, TP - l - r, TP - tp - (dn ? 0 : 2) - 3);
      ctx.fillStyle = THEME.rock;
      ctx.fillRect(x + l, y + tp, TP - l - r, TP - tp - b);
      ctx.fillStyle = THEME.rockTop;
      ctx.fillRect(x + l + (lf ? 0 : 2), y + tp + (up ? 0 : 2), TP - l - r - (lf ? 0 : 2) - (rt ? 0 : 2), TP - tp - b - (up ? 0 : 2) - (dn ? 0 : 3));
      ctx.fillStyle = THEME.rockHi;
      if (!up) ctx.fillRect(x + l + 2, y + tp, TP - l - r - 4, 2);
      if (!lf) ctx.fillRect(x + l, y + tp + 2, 2, TP - tp - b - 4);
      ctx.fillStyle = 'rgba(0,0,0,0.12)';
      const cx = x + 6 + hash2(i, j, 21) * 18, cy = y + 6 + hash2(i, j, 22) * 14;
      ctx.fillRect(cx, cy, 6, 2);
    }
  }

  if (terr === T_GROUND) drawElevation(ctx, i, j, x, y, t, n);
  else if (terr === T_WATER) drawCliffFace(ctx, i, j, x, y, t, true);
  if (terr === T_GROUND && S.fert && S.fert[t] && !S.ramp[t]) drawFertile(ctx, i, j, x, y);
  if (S.road[t]) { if (terr === T_GROUND) drawRoad(ctx, i, j, x, y); else drawCrossing(ctx, i, j, x, y, t); }
  if (S.res[t]) {
    drawResource(ctx, S.res[t], S.amt[t], S.grow[t], x + TP / 2, y + TP / 2, TP, i, j);
    if (richRes(t)) drawGlint(ctx, x, y, i, j);
  }
}

/** A rich deposit sparkles: two little four-pointed stars. */
function drawGlint(ctx, x, y, i, j) {
  ctx.fillStyle = 'rgba(255,250,215,0.95)';
  for (let k = 0; k < 2; k++) {
    const cx = x + 6 + hash2(i, j, 70 + k) * (TP - 12), cy = y + 5 + hash2(j, i, 80 + k) * (TP - 14), r = k ? 2.5 : 3.5;
    ctx.beginPath();
    ctx.moveTo(cx, cy - r); ctx.lineTo(cx + r * 0.3, cy - r * 0.3); ctx.lineTo(cx + r, cy); ctx.lineTo(cx + r * 0.3, cy + r * 0.3);
    ctx.lineTo(cx, cy + r); ctx.lineTo(cx - r * 0.3, cy + r * 0.3); ctx.lineTo(cx - r, cy); ctx.lineTo(cx - r * 0.3, cy - r * 0.3);
    ctx.closePath(); ctx.fill();
  }
}

/** Level of a neighbouring ground tile, or null for off-map / water / rock. */
function groundElev(i, j) {
  if (!inMap(i, j)) return null;
  const u = tIdx(i, j);
  return S.terrain[u] === T_GROUND ? S.elev[u] : null;
}

/** The rock face of a higher tile to the north, seen in front of this tile. */
function drawCliffFace(ctx, i, j, x, y, t, waterOnly) {
  const en = groundElev(i, j - 1);
  if (en === null || en <= S.elev[t]) return;
  if (!waterOnly && canStep(t, tIdx(i, j - 1))) return; // a ramp joins them; the slope is drawn instead
  const h = Math.min(TP * 0.62, 14 * (en - S.elev[t]));
  if (ART.cliff) {
    const img = ART.cliff.img, sw = img.width / 4;
    ctx.drawImage(img, (i % 4) * sw, 0, sw, img.height, x, y, TP, h);
  } else {
    const g = ctx.createLinearGradient(0, y, 0, y + h);
    g.addColorStop(0, THEME.cliffTop);
    g.addColorStop(1, THEME.cliffBottom);
    ctx.fillStyle = g;
    ctx.fillRect(x, y, TP, h);
    ctx.fillStyle = 'rgba(0,0,0,0.18)';
    for (let k = 3; k < h - 1; k += 4) ctx.fillRect(x, y + k, TP, 1);
    ctx.fillStyle = 'rgba(255,220,180,0.12)';
    for (let k = 0; k < 3; k++) ctx.fillRect(x + 4 + hash2(i, j, 50 + k) * (TP - 8), y + 1, 1.5, h - 2);
  }
  const sh = ctx.createLinearGradient(0, y + h, 0, y + h + 7);
  sh.addColorStop(0, 'rgba(20,10,5,0.4)'); sh.addColorStop(1, 'rgba(20,10,5,0)');
  ctx.fillStyle = sh;
  ctx.fillRect(x, y + h, TP, 7);
}

/** Cliff edges, shadows and slopes that show which level a ground tile is on. */
function drawElevation(ctx, i, j, x, y, t, n) {
  const e = S.elev[t];
  const N = groundElev(i, j - 1), Sv = groundElev(i, j + 1), Wv = groundElev(i - 1, j), E = groundElev(i + 1, j);
  const linked = (di, dj) => canStep(t, tIdx(i + di, j + dj));
  if (S.ramp[t]) { drawSlope(ctx, i, j, x, y, t, n); return; }
  drawCliffFace(ctx, i, j, x, y, t, false);
  // Higher ground to the west casts a shadow (light comes from the top-left).
  if (Wv !== null && Wv > e && !linked(-1, 0)) {
    const g = ctx.createLinearGradient(x, 0, x + 8, 0);
    g.addColorStop(0, 'rgba(25,12,5,0.38)'); g.addColorStop(1, 'rgba(25,12,5,0)');
    ctx.fillStyle = g; ctx.fillRect(x, y, 8, TP);
  }
  if (E !== null && E > e && !linked(1, 0)) { ctx.fillStyle = 'rgba(25,12,5,0.28)'; ctx.fillRect(x + TP - 3, y, 3, TP); }
  // This tile is the top of a cliff: draw its lit rim and dark drop edges.
  if (N !== null && N < e && !linked(0, -1)) { ctx.fillStyle = 'rgba(255,236,200,0.45)'; ctx.fillRect(x, y, TP, 2); }
  if (Sv !== null && Sv < e && !linked(0, 1)) { ctx.fillStyle = 'rgba(255,236,200,0.3)'; ctx.fillRect(x, y + TP - 2, TP, 2); }
  if (Wv !== null && Wv < e && !linked(-1, 0)) { ctx.fillStyle = 'rgba(255,236,200,0.35)'; ctx.fillRect(x, y, 2, TP); }
  if (E !== null && E < e && !linked(1, 0)) { ctx.fillStyle = 'rgba(45,22,10,0.55)'; ctx.fillRect(x + TP - 3, y, 3, TP); }
}

/** A ramp: the ground rises toward the higher neighbour, with steps across it. */
function drawSlope(ctx, i, j, x, y, t, n) {
  const e = S.elev[t];
  let dir = null;
  for (const [di, dj] of [[0, -1], [0, 1], [-1, 0], [1, 0]]) {
    const v = groundElev(i + di, j + dj);
    if (v !== null && v !== e && canStep(t, tIdx(i + di, j + dj))) {
      dir = v > e ? [di, dj] : [-di, -dj]; // always point uphill
      if (v > e) break;
    }
  }
  if (!dir) return;
  if (ART.slope) {
    // Custom slope art is drawn with uphill at the top of the image.
    ctx.save();
    ctx.translate(x + TP / 2, y + TP / 2);
    ctx.rotate(Math.atan2(dir[1], dir[0]) + Math.PI / 2);
    ctx.drawImage(ART.slope.img, -TP / 2, -TP / 2, TP, TP);
    ctx.restore();
    return;
  }
  const lowE = Math.min(e, ...[[0, -1], [0, 1], [-1, 0], [1, 0]].map(([di, dj]) => groundElev(i + di, j + dj) ?? e));
  const highE = e + (groundElev(i + dir[0], j + dir[1]) > e ? 1 : 0);
  const fromLow = levelColor(Math.max(lowE, highE - 1), n), toHigh = levelColor(highE, n);
  const cx = x + TP / 2, cy = y + TP / 2;
  const g = ctx.createLinearGradient(cx - dir[0] * TP / 2, cy - dir[1] * TP / 2, cx + dir[0] * TP / 2, cy + dir[1] * TP / 2);
  g.addColorStop(0, mixColor(fromLow, '#000000', 0.12));
  g.addColorStop(1, toHigh);
  ctx.fillStyle = g;
  ctx.fillRect(x, y, TP, TP);
  // Steps across the slope and darker side walls along it.
  ctx.fillStyle = 'rgba(40,20,8,0.28)';
  for (let k = 1; k <= 4; k++) {
    const f = k / 5;
    if (dir[0] === 0) ctx.fillRect(x + 4, y + (dir[1] < 0 ? TP * (1 - f) : TP * f) - 1, TP - 8, 2);
    else ctx.fillRect(x + (dir[0] < 0 ? TP * (1 - f) : TP * f) - 1, y + 4, 2, TP - 8);
  }
  ctx.fillStyle = 'rgba(40,20,8,0.4)';
  if (dir[0] === 0) { ctx.fillRect(x, y, 3, TP); ctx.fillRect(x + TP - 3, y, 3, TP); }
  else { ctx.fillRect(x, y, TP, 3); ctx.fillRect(x, y + TP - 3, TP, 3); }
}

/** Road surfaces: concrete (pale slabs) and asphalt (near-black). */
const ROAD_LOOK = [null, { edge: '#5d636b', fill: '#b9bec5', w: 12 }, { edge: '#15171b', fill: '#33363d', w: 12 }];

function drawRoad(ctx, i, j, x, y) {
  const c = TP / 2;
  const t = tIdx(i, j);
  const tier = S.pave[t] || 1, look = ROAD_LOOK[tier], w = look.w;
  const nb = [[0, -1], [1, 0], [0, 1], [-1, 0]].map(([di, dj]) => inMap(i + di, j + dj) && roadLike(tIdx(i + di, j + dj)) && canStep(t, tIdx(i + di, j + dj)));
  for (const [col, ww] of [[look.edge, w + 4], [look.fill, w]]) {
    ctx.fillStyle = col;
    ctx.beginPath();
    ctx.arc(x + c, y + c, ww / 2, 0, Math.PI * 2);
    ctx.fill();
    if (nb[0]) ctx.fillRect(x + c - ww / 2, y, ww, c);
    if (nb[1]) ctx.fillRect(x + c, y + c - ww / 2, c, ww);
    if (nb[2]) ctx.fillRect(x + c - ww / 2, y + c, ww, c);
    if (nb[3]) ctx.fillRect(x, y + c - ww / 2, c, ww);
  }
  if (tier === 1) {
    // Concrete slabs with expansion joints across the run.
    ctx.fillStyle = 'rgba(60,64,70,0.35)';
    if (nb[0] || nb[2]) ctx.fillRect(x + c - w / 2, y + 1, w, 1);
    if (nb[1] || nb[3]) ctx.fillRect(x + 1, y + c - w / 2, 1, w);
  } else {
    // Asphalt: a faint aggregate speckle.
    ctx.fillStyle = 'rgba(255,255,255,0.10)';
    for (let k = 0; k < 4; k++) ctx.fillRect(x + c - 4 + hash2(i, j, 30 + k) * 8, y + c - 4 + hash2(j, i, 40 + k) * 8, 1, 1);
  }
  drawRoadArrow(ctx, t, x, y);
}

/** One-way paths carry an arrow showing which way traffic flows. */
function drawRoadArrow(ctx, t, x, y) {
  const c = TP / 2, r = S.road[t];
  if (r >= 2) {
    const a = Math.atan2(ROAD_DIRS[r][1], ROAD_DIRS[r][0]);
    if (ART.oneway) { drawArt(ctx, ART.oneway, x + c, y + c, TP * 0.6, a); return; }
    ctx.save();
    ctx.translate(x + c, y + c);
    ctx.rotate(a);
    ctx.fillStyle = '#fff3d6';
    ctx.strokeStyle = 'rgba(40,28,18,0.75)';
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(6, 0); ctx.lineTo(-1, -5); ctx.lineTo(-1, -1.8); ctx.lineTo(-6, -1.8);
    ctx.lineTo(-6, 1.8); ctx.lineTo(-1, 1.8); ctx.lineTo(-1, 5); ctx.closePath();
    ctx.fill(); ctx.stroke();
    ctx.restore();
  }
}

/**
 * A bridge (road over water: a steel deck on piers with railings) or a tunnel (road through rock:
 * a dark bore with lamps, and a concrete portal where it comes out of the crags).
 */
function drawCrossing(ctx, i, j, x, y, t) {
  const c = TP / 2, water = S.terrain[t] === T_WATER;
  const sides = [[0, -1], [1, 0], [0, 1], [-1, 0]];
  const nb = sides.map(([di, dj]) => inMap(i + di, j + dj) && S.road[tIdx(i + di, j + dj)] > 0 && canStep(t, tIdx(i + di, j + dj)));
  const shape = (w, ox, oy) => {
    ctx.fillRect(x + c - w / 2 + ox, y + c - w / 2 + oy, w, w);
    if (nb[0]) ctx.fillRect(x + c - w / 2 + ox, y + oy, w, c);
    if (nb[1]) ctx.fillRect(x + c + ox, y + c - w / 2 + oy, c, w);
    if (nb[2]) ctx.fillRect(x + c - w / 2 + ox, y + c + oy, w, c);
    if (nb[3]) ctx.fillRect(x + ox, y + c - w / 2 + oy, c, w);
  };
  const asphalt = S.pave[t] === 2;
  if (water) {
    ctx.fillStyle = 'rgba(0,18,28,0.38)'; shape(20, 2, 4);              // shadow on the water
    ctx.fillStyle = '#2f353c'; shape(20, 0, 0);                         // girders
    ctx.fillStyle = asphalt ? '#34373e' : '#9aa1a8'; shape(14, 0, 0);   // deck
    ctx.fillStyle = asphalt ? 'rgba(255,255,255,0.08)' : 'rgba(40,46,52,0.35)';
    const along = nb[1] || nb[3];
    for (let k = 3; k < TP; k += 5) { if (along) ctx.fillRect(x + k, y + c - 7, 1, 14); else ctx.fillRect(x + c - 7, y + k, 14, 1); }
    // Railings on both edges of the deck, with posts.
    ctx.fillStyle = '#d9dde2';
    const rail = (vertical, off) => {
      if (vertical) { ctx.fillRect(x + c + off, y + (nb[0] ? 0 : c - 9), 1.5, (nb[0] ? c : 9) + (nb[2] ? c : 9)); }
      else { ctx.fillRect(x + (nb[3] ? 0 : c - 9), y + c + off, (nb[3] ? c : 9) + (nb[1] ? c : 9), 1.5); }
    };
    if (nb[0] || nb[2] || !(nb[1] || nb[3])) { rail(true, -9); rail(true, 7.5); }
    if (nb[1] || nb[3]) { rail(false, -9); rail(false, 7.5); }
    ctx.fillStyle = '#5c646d'; // piers
    if (!(nb[0] && nb[2]) && !(nb[1] && nb[3])) ctx.fillRect(x + c - 3, y + c + 8, 6, 3);
  } else {
    ctx.fillStyle = 'rgba(8,5,3,0.78)'; shape(18, 0, 0);                // the bore
    ctx.fillStyle = asphalt ? '#26282d' : '#4b4e54'; shape(10, 0, 0);   // roadway
    ctx.fillStyle = 'rgba(255,214,120,0.85)';                           // lamps
    ctx.fillRect(x + c - 1, y + c - 1, 2, 2);
    // Portals where the tunnel meets open ground.
    ctx.fillStyle = '#b8b0a3';
    sides.forEach(([di, dj], k) => {
      if (!nb[k] || terrAt(i + di, j + dj) === T_ROCK) return;
      if (dj) ctx.fillRect(x + c - 11, y + (dj < 0 ? 0 : TP - 4), 22, 4);
      else ctx.fillRect(x + (di < 0 ? 0 : TP - 4), y + c - 11, 4, 22);
    });
  }
  drawRoadArrow(ctx, t, x, y);
}

/* ------------------------------------------------------------------ resources */

/** Fertile soil: dark tilled earth with furrows, where a Bio Farm can plant energy crops. */
function drawFertile(ctx, i, j, x, y) {
  if (ART.fertile) { drawTexture(ctx, ART.fertile, i, j, x, y); return; }
  const fert = (di, dj) => inMap(i + di, j + dj) && S.fert[tIdx(i + di, j + dj)];
  const l = fert(-1, 0) ? 0 : 2, r = fert(1, 0) ? 0 : 2, tp = fert(0, -1) ? 0 : 2, b = fert(0, 1) ? 0 : 2;
  ctx.fillStyle = 'rgba(52,40,22,0.62)';
  ctx.fillRect(x + l, y + tp, TP - l - r, TP - tp - b);
  ctx.fillStyle = 'rgba(96,120,44,0.28)';
  ctx.fillRect(x + l, y + tp, TP - l - r, TP - tp - b);
  // Furrows run east-west across the whole patch.
  for (let k = 0; k < 4; k++) {
    const yy = y + 4 + k * 8;
    ctx.fillStyle = 'rgba(20,14,6,0.45)';
    ctx.fillRect(x + l, yy, TP - l - r, 2);
    ctx.fillStyle = 'rgba(160,180,90,0.22)';
    ctx.fillRect(x + l, yy - 1.5, TP - l - r, 1);
  }
}

function drawResource(ctx, type, amt, grow, cx, cy, s, i, j) {
  const art = ART[RES[type].key];
  if (art) {
    const sc = type === R_STALK ? 0.5 + 0.5 * grow : type === R_CROP ? 0.35 + 0.65 * grow : 0.6 + 0.4 * Math.min(1, amt / RES[type].amount);
    ctx.globalAlpha = (type === R_STALK || type === R_CROP) && grow < 1 ? 0.85 : 1;
    drawArt(ctx, art, cx, cy, s * sc);
    ctx.globalAlpha = 1;
    return;
  }
  const u = s / 32;
  const h = (k) => hash2(i * 13 + k, j * 7 - k, 5);
  if (type === R_STALK) {
    const n = Math.max(1, amt);
    const g = 0.45 + 0.55 * grow;
    const spots = [[-6, 4], [5, 6], [0, -3]];
    for (let k = 0; k < n; k++) {
      const bx = cx + (spots[k][0] + (h(k) - 0.5) * 4) * u, by = cy + (spots[k][1] + (h(k + 5) - 0.5) * 3) * u;
      const hgt = (12 + h(k + 9) * 5) * g * u;
      ctx.fillStyle = 'rgba(30,20,10,0.22)';
      ctx.beginPath(); ctx.ellipse(bx + 2 * u, by + 1 * u, 4.5 * g * u, 2.2 * g * u, 0, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = '#1b6a58';
      ctx.lineWidth = 2.6 * u * g;
      ctx.beginPath(); ctx.moveTo(bx, by); ctx.quadraticCurveTo(bx + 3 * u, by - hgt * 0.5, bx + (h(k + 2) - 0.5) * 4 * u, by - hgt); ctx.stroke();
      const tx = bx + (h(k + 2) - 0.5) * 4 * u, ty = by - hgt;
      ctx.fillStyle = grow < 1 ? '#5fae8e' : '#2fcf9d';
      ctx.beginPath(); ctx.ellipse(tx, ty, 5.5 * g * u, 4 * g * u, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = grow < 1 ? '#9ad3bc' : '#a6ffe0';
      ctx.beginPath(); ctx.ellipse(tx - 1.5 * u, ty - 1.2 * u, 2.2 * g * u, 1.5 * g * u, 0, 0, Math.PI * 2); ctx.fill();
    }
  } else if (type === R_BOULDER) {
    const n = Math.min(3, Math.ceil((amt * 3) / RES[R_BOULDER].amount));
    const spots = [[-5, 3, 7], [6, -3, 6], [3, 7, 5]];
    for (let k = 0; k < n; k++) {
      const [ox, oy, r0] = spots[k];
      const bx = cx + ox * u, by = cy + oy * u, r = (r0 + h(k) * 2) * u;
      ctx.fillStyle = 'rgba(30,20,10,0.25)';
      ctx.beginPath(); ctx.ellipse(bx + 2 * u, by + 2.5 * u, r, r * 0.7, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#857e75';
      ctx.beginPath(); ctx.ellipse(bx, by, r, r * 0.82, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#b3ada3';
      ctx.beginPath(); ctx.ellipse(bx - r * 0.25, by - r * 0.25, r * 0.6, r * 0.45, 0, 0, Math.PI * 2); ctx.fill();
    }
  } else if (type === R_ORE) {
    const n = Math.min(3, Math.ceil(amt / 6));
    const spots = [[0, 1, 8], [-7, -5, 5], [7, -4, 5]];
    for (let k = 0; k < n; k++) {
      const [ox, oy, r0] = spots[k];
      const bx = cx + ox * u, by = cy + oy * u, r = r0 * u;
      ctx.fillStyle = 'rgba(30,20,10,0.25)';
      ctx.beginPath(); ctx.ellipse(bx + 2 * u, by + 2 * u, r, r * 0.7, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#3f312c';
      ctx.beginPath();
      ctx.moveTo(bx - r, by + r * 0.3); ctx.lineTo(bx - r * 0.5, by - r * 0.8); ctx.lineTo(bx + r * 0.6, by - r * 0.7);
      ctx.lineTo(bx + r, by + r * 0.2); ctx.lineTo(bx + r * 0.2, by + r * 0.8); ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#ff8a3d';
      for (let f = 0; f < 3; f++) ctx.fillRect(bx + (h(k * 3 + f) - 0.5) * r * 1.2, by + (h(k * 3 + f + 7) - 0.6) * r, 2.4 * u, 2.4 * u);
      ctx.fillStyle = '#ffd08a';
      ctx.fillRect(bx - r * 0.2, by - r * 0.3, 1.6 * u, 1.6 * u);
    }
  } else if (type === R_CROP) {
    // Rows of leafy stems topped with glowing pink energy pods once ripe.
    const g = 0.3 + 0.7 * grow, ripe = grow >= 1;
    for (let k = 0; k < 4; k++) {
      const bx = cx + (-9 + k * 6 + (h(k) - 0.5) * 2) * u, by = cy + (k % 2 ? 7 : 3) * u;
      const hgt = (10 + h(k + 4) * 4) * g * u;
      ctx.strokeStyle = ripe ? '#3f8a3a' : '#5c9a42';
      ctx.lineWidth = 1.8 * u;
      ctx.beginPath(); ctx.moveTo(bx, by); ctx.lineTo(bx + (h(k + 2) - 0.5) * 2 * u, by - hgt); ctx.stroke();
      ctx.fillStyle = '#6fb24c';
      ctx.beginPath(); ctx.ellipse(bx - 2.5 * u * g, by - hgt * 0.45, 3 * g * u, 1.4 * g * u, -0.5, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.ellipse(bx + 2.5 * u * g, by - hgt * 0.6, 3 * g * u, 1.4 * g * u, 0.5, 0, Math.PI * 2); ctx.fill();
      if (grow > 0.5) {
        const px = bx + (h(k + 2) - 0.5) * 2 * u, py = by - hgt;
        ctx.fillStyle = ripe ? '#ff5c8a' : '#c88aa0';
        ctx.beginPath(); ctx.arc(px, py, (ripe ? 2.8 : 1.8) * u, 0, Math.PI * 2); ctx.fill();
        if (ripe) { ctx.fillStyle = '#ffd1e0'; ctx.beginPath(); ctx.arc(px - 0.8 * u, py - 0.8 * u, 1 * u, 0, Math.PI * 2); ctx.fill(); }
      }
    }
  } else if (type === R_URANIUM) {
    // A dark rock studded with glowing green uranium crystals, on a faint green glow.
    const g = ctx.createRadialGradient(cx, cy, 2 * u, cx, cy, 14 * u);
    g.addColorStop(0, 'rgba(157,255,58,0.45)'); g.addColorStop(1, 'rgba(157,255,58,0)');
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(cx, cy, 14 * u, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#2b2a26';
    ctx.beginPath(); ctx.ellipse(cx, cy + 2 * u, 9 * u, 6.5 * u, 0, 0, Math.PI * 2); ctx.fill();
    const n = Math.max(1, Math.min(5, amt + 1));
    for (let k = 0; k < n; k++) {
      const a = -Math.PI / 2 + (k - (n - 1) / 2) * 0.55, len = (7 + h(k) * 4) * u;
      const bx = cx + Math.cos(a + Math.PI / 2) * 3 * u * (k - (n - 1) / 2) * 0.6, by = cy + 2 * u;
      ctx.fillStyle = k % 2 ? '#7be22b' : '#b8ff6a';
      ctx.beginPath();
      ctx.moveTo(bx - 2 * u, by); ctx.lineTo(bx + Math.cos(a) * len, by + Math.sin(a) * len); ctx.lineTo(bx + 2 * u, by); ctx.closePath(); ctx.fill();
    }
    ctx.fillStyle = 'rgba(240,255,200,0.8)';
    ctx.beginPath(); ctx.arc(cx - 1 * u, cy - 4 * u, 1.2 * u, 0, Math.PI * 2); ctx.fill();
  } else if (type === R_OIL) {
    // A dark glossy pool with an oily rainbow sheen; it shrinks as it is pumped dry.
    const f = 0.55 + 0.45 * Math.min(1, amt / RES[R_OIL].amount);
    const rx = 12 * f * u, ry = 8.5 * f * u, ox = (h(1) - 0.5) * 3 * u, oy = (h(2) - 0.5) * 3 * u;
    ctx.fillStyle = 'rgba(30,20,10,0.3)';
    ctx.beginPath(); ctx.ellipse(cx + ox + 1.5 * u, cy + oy + 2 * u, rx, ry, 0.3, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#16120f';
    ctx.beginPath(); ctx.ellipse(cx + ox, cy + oy, rx, ry, 0.3, 0, Math.PI * 2); ctx.fill();
    ctx.lineWidth = 1.4 * u;
    for (const [col, k] of [['rgba(255,92,138,0.55)', 0.7], ['rgba(56,212,255,0.45)', 0.55], ['rgba(200,240,90,0.35)', 0.4]]) {
      ctx.strokeStyle = col;
      ctx.beginPath(); ctx.ellipse(cx + ox - 2 * u, cy + oy - 1.5 * u, rx * k, ry * k, 0.3, Math.PI * 0.9, Math.PI * 1.9); ctx.stroke();
    }
    ctx.fillStyle = 'rgba(255,255,255,0.5)';
    ctx.beginPath(); ctx.ellipse(cx + ox - rx * 0.4, cy + oy - ry * 0.35, 2 * u, 1 * u, 0.3, 0, Math.PI * 2); ctx.fill();
  } else if (type === R_CRYSTAL) {
    const n = Math.min(3, Math.ceil(amt / 4));
    const spots = [[0, 4, 13, 0], [-7, 6, 9, -0.35], [7, 7, 8, 0.4]];
    for (let k = 0; k < n; k++) {
      const [ox, oy, hgt, ang] = spots[k];
      const bx = cx + ox * u, by = cy + oy * u, w = 4 * u, ht = hgt * u;
      ctx.save(); ctx.translate(bx, by); ctx.rotate(ang);
      ctx.fillStyle = 'rgba(30,20,10,0.22)';
      ctx.beginPath(); ctx.ellipse(1 * u, 1 * u, w * 1.4, w * 0.6, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#8758f0';
      ctx.beginPath(); ctx.moveTo(-w, 0); ctx.lineTo(-w, -ht * 0.7); ctx.lineTo(0, -ht); ctx.lineTo(w, -ht * 0.7); ctx.lineTo(w, 0); ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#c9b0ff';
      ctx.beginPath(); ctx.moveTo(-w, -ht * 0.7); ctx.lineTo(0, -ht); ctx.lineTo(0, 0); ctx.lineTo(-w, 0); ctx.closePath(); ctx.fill();
      ctx.restore();
    }
  }
}

/* ------------------------------------------------------------------ buildings */

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function hullBase(ctx, cx, cy, s, color, shape) {
  const w = s * 0.82, h = s * 0.78;
  ctx.fillStyle = 'rgba(20,10,5,0.32)';
  if (shape === 'round') { ctx.beginPath(); ctx.ellipse(cx + s * 0.06, cy + s * 0.1, w / 2, h / 2, 0, 0, Math.PI * 2); ctx.fill(); }
  else { roundRect(ctx, cx - w / 2 + s * 0.06, cy - h / 2 + s * 0.1, w, h, s * 0.14); ctx.fill(); }
  ctx.fillStyle = THEME.hull;
  if (shape === 'round') { ctx.beginPath(); ctx.ellipse(cx, cy, w / 2, h / 2, 0, 0, Math.PI * 2); ctx.fill(); }
  else { roundRect(ctx, cx - w / 2, cy - h / 2, w, h, s * 0.14); ctx.fill(); }
  ctx.strokeStyle = color;
  ctx.lineWidth = Math.max(1.5, s * 0.06);
  ctx.stroke();
  ctx.fillStyle = THEME.hullHi;
  if (shape !== 'round') { roundRect(ctx, cx - w / 2 + s * 0.08, cy - h / 2 + s * 0.07, w - s * 0.16, s * 0.12, s * 0.05); ctx.fill(); }
}

/** Draw one building at screen centre (cx, cy), tile size s px. `b` may be a stub for menu icons. */
function drawBuilding(ctx, type, cx, cy, s, owner, b) {
  const color = PLAYER_COLORS[owner];
  const t = R.time;
  const working = b && b.working;
  if (b && !b.built) { drawSite(ctx, type, cx, cy, s, owner, b); return; }
  const art = artFor(type, owner);
  if (art) {
    if (!ART[type + '@' + owner] && type !== 'ramp') {
      // Shared art: a thin team-coloured bar along the front edge shows whose building it is.
      const w = s * 0.56, h = Math.max(2.5, s * 0.07), y = cy + s * 0.43;
      ctx.fillStyle = 'rgba(10,10,14,0.7)';
      ctx.fillRect(cx - w / 2 - 1, y - 1, w + 2, h + 2);
      ctx.fillStyle = color;
      ctx.fillRect(cx - w / 2, y, w, h);
    }
    // Flat (top-down) turret art is drawn barrel-right and rotated to aim. 3/4-view turret art
    // (anchored at the bottom) is a fixed base plus a head image for each direction (see turretHead).
    drawArt(ctx, art, cx, cy, s * (type === 'lander' && !art.scale ? 1.6 : 1), type === 'turret' && b && art.anchor !== 'bottom' ? b.aim : 0);
    if (type === 'turret' && art.anchor === 'bottom') {
      const head = turretHead(owner, b ? b.aim : Math.PI / 4);
      if (head) drawArt(ctx, head, cx, cy, s);
    }
    if (type === 'silo' && b && b.stock) drawSiloStatus(ctx, b, cx, cy, s, color);
    return;
  }
  const u = s / 32;
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  switch (type) {
    case 'lander': {
      const r = s * 0.78;
      ctx.fillStyle = 'rgba(20,10,5,0.32)';
      ctx.beginPath(); ctx.ellipse(cx + 3 * u, cy + 5 * u, r, r * 0.8, 0, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = THEME.hull; ctx.lineWidth = 3 * u;
      for (let k = 0; k < 4; k++) {
        const a = Math.PI / 4 + k * Math.PI / 2;
        ctx.beginPath(); ctx.moveTo(cx + Math.cos(a) * r * 0.5, cy + Math.sin(a) * r * 0.5); ctx.lineTo(cx + Math.cos(a) * r * 1.02, cy + Math.sin(a) * r * 1.02); ctx.stroke();
        ctx.fillStyle = THEME.hullHi;
        ctx.beginPath(); ctx.arc(cx + Math.cos(a) * r * 1.02, cy + Math.sin(a) * r * 1.02, 3.5 * u, 0, Math.PI * 2); ctx.fill();
      }
      ctx.fillStyle = THEME.hull;
      ctx.beginPath();
      for (let k = 0; k < 8; k++) {
        const a = k * Math.PI / 4 + Math.PI / 8;
        ctx.lineTo(cx + Math.cos(a) * r * 0.8, cy + Math.sin(a) * r * 0.8);
      }
      ctx.closePath(); ctx.fill();
      ctx.strokeStyle = color; ctx.lineWidth = 2.5 * u; ctx.stroke();
      ctx.fillStyle = THEME.hullHi;
      ctx.beginPath(); ctx.arc(cx, cy, r * 0.5, 0, Math.PI * 2); ctx.fill();
      const grd = ctx.createRadialGradient(cx - r * 0.12, cy - r * 0.15, r * 0.05, cx, cy, r * 0.4);
      grd.addColorStop(0, '#ffffff'); grd.addColorStop(0.35, color); grd.addColorStop(1, mixColor(color, '#000000', 0.45));
      ctx.fillStyle = grd;
      ctx.beginPath(); ctx.arc(cx, cy, r * 0.38, 0, Math.PI * 2); ctx.fill();
      const ba = t * 2.2;
      ctx.fillStyle = '#ffffff';
      ctx.globalAlpha = 0.85;
      ctx.beginPath(); ctx.arc(cx + Math.cos(ba) * r * 0.62, cy + Math.sin(ba) * r * 0.62, 2.2 * u, 0, Math.PI * 2); ctx.fill();
      ctx.globalAlpha = 1;
      break;
    }
    case 'harvester': {
      hullBase(ctx, cx, cy, s, color);
      ctx.save(); ctx.translate(cx, cy + 2 * u); ctx.rotate(working ? t * 6 : 0);
      ctx.fillStyle = '#3fd8a6';
      ctx.beginPath();
      for (let k = 0; k < 16; k++) { const a = k * Math.PI / 8, rr = k % 2 ? 7.5 * u : 9.5 * u; ctx.lineTo(Math.cos(a) * rr, Math.sin(a) * rr); }
      ctx.closePath(); ctx.fill();
      ctx.fillStyle = THEME.hull; ctx.beginPath(); ctx.arc(0, 0, 3 * u, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
      break;
    }
    case 'quarry': {
      hullBase(ctx, cx, cy, s, color);
      ctx.fillStyle = '#c9c1b4';
      ctx.fillRect(cx - 9 * u, cy + 1 * u, 8 * u, 7 * u);
      ctx.fillRect(cx + 1 * u, cy + 1 * u, 8 * u, 7 * u);
      ctx.fillStyle = '#e8e2d8';
      ctx.fillRect(cx - 4 * u, cy - 7 * u, 8 * u, 7 * u);
      break;
    }
    case 'mine': {
      hullBase(ctx, cx, cy, s, color);
      ctx.fillStyle = '#1a1c22';
      ctx.beginPath(); ctx.arc(cx, cy + 3 * u, 8 * u, Math.PI, 0); ctx.closePath(); ctx.fill();
      ctx.save(); ctx.translate(cx, cy - 1 * u); ctx.rotate(working ? Math.sin(t * 10) * 0.25 : 0);
      ctx.fillStyle = '#ff8a3d';
      ctx.beginPath(); ctx.moveTo(-3 * u, -8 * u); ctx.lineTo(3 * u, -8 * u); ctx.lineTo(0, 4 * u); ctx.closePath(); ctx.fill();
      ctx.restore();
      break;
    }
    case 'tap': {
      hullBase(ctx, cx, cy, s, color);
      ctx.fillStyle = '#b98cff';
      ctx.beginPath(); ctx.moveTo(cx, cy - 10 * u); ctx.lineTo(cx + 6 * u, cy - 2 * u); ctx.lineTo(cx, cy + 9 * u); ctx.lineTo(cx - 6 * u, cy - 2 * u); ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#e4d6ff';
      ctx.beginPath(); ctx.moveTo(cx, cy - 10 * u); ctx.lineTo(cx - 6 * u, cy - 2 * u); ctx.lineTo(cx, cy - 1 * u); ctx.closePath(); ctx.fill();
      break;
    }
    case 'grower': {
      hullBase(ctx, cx, cy, s, color);
      ctx.strokeStyle = '#3fd8a6'; ctx.lineWidth = 2.5 * u;
      ctx.beginPath(); ctx.moveTo(cx, cy + 8 * u); ctx.lineTo(cx, cy - 4 * u); ctx.stroke();
      ctx.fillStyle = '#3fd8a6';
      ctx.beginPath(); ctx.ellipse(cx - 5 * u, cy - 3 * u, 5 * u, 2.6 * u, -0.5, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.ellipse(cx + 5 * u, cy - 6 * u, 5 * u, 2.6 * u, 0.5, 0, Math.PI * 2); ctx.fill();
      break;
    }
    case 'smelter': {
      hullBase(ctx, cx, cy, s, color);
      ctx.fillStyle = '#3a404c';
      ctx.fillRect(cx + 3 * u, cy - 13 * u, 6 * u, 10 * u);
      ctx.fillStyle = working ? '#ffb347' : '#7a4a2a';
      ctx.beginPath(); ctx.arc(cx - 2 * u, cy + 3 * u, 6 * u, Math.PI, 0); ctx.lineTo(cx + 4 * u, cy + 7 * u); ctx.lineTo(cx - 8 * u, cy + 7 * u); ctx.closePath(); ctx.fill();
      if (working) {
        ctx.fillStyle = 'rgba(220,220,220,0.35)';
        const k = (t * 0.8) % 1;
        ctx.beginPath(); ctx.arc(cx + 6 * u + k * 3 * u, cy - 14 * u - k * 10 * u, (2 + k * 4) * u, 0, Math.PI * 2); ctx.fill();
      }
      break;
    }
    case 'fab': {
      hullBase(ctx, cx, cy, s, color);
      ctx.fillStyle = '#c8f05a';
      ctx.fillRect(cx - 6 * u, cy - 5 * u, 12 * u, 12 * u);
      ctx.strokeStyle = '#c8f05a'; ctx.lineWidth = 1.5 * u;
      for (let k = -1; k <= 1; k++) {
        ctx.beginPath();
        ctx.moveTo(cx + k * 4 * u, cy - 5 * u); ctx.lineTo(cx + k * 4 * u, cy - 9 * u);
        ctx.moveTo(cx + k * 4 * u, cy + 7 * u); ctx.lineTo(cx + k * 4 * u, cy + 11 * u);
        ctx.moveTo(cx - 6 * u, cy + 1 * u + k * 4 * u); ctx.lineTo(cx - 10 * u, cy + 1 * u + k * 4 * u);
        ctx.moveTo(cx + 6 * u, cy + 1 * u + k * 4 * u); ctx.lineTo(cx + 10 * u, cy + 1 * u + k * 4 * u);
        ctx.stroke();
      }
      ctx.fillStyle = working && Math.sin(t * 8) > 0 ? '#ffffff' : THEME.hull;
      ctx.fillRect(cx - 2 * u, cy - 1 * u, 4 * u, 4 * u);
      break;
    }
    case 'foundry': {
      hullBase(ctx, cx, cy, s, color);
      ctx.save(); ctx.translate(cx, cy + 1 * u); ctx.rotate(working ? t * 1.5 : 0);
      ctx.fillStyle = '#8ec3e6';
      ctx.beginPath();
      for (let k = 0; k < 8; k++) {
        const a = k * Math.PI / 4;
        ctx.lineTo(Math.cos(a - 0.22) * 10 * u, Math.sin(a - 0.22) * 10 * u);
        ctx.lineTo(Math.cos(a + 0.22) * 10 * u, Math.sin(a + 0.22) * 10 * u);
        ctx.lineTo(Math.cos(a + 0.5) * 7 * u, Math.sin(a + 0.5) * 7 * u);
      }
      ctx.closePath(); ctx.fill();
      ctx.fillStyle = THEME.hull; ctx.beginPath(); ctx.arc(0, 0, 3.5 * u, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
      break;
    }
    case 'depot': {
      hullBase(ctx, cx, cy, s, color);
      ctx.fillStyle = '#c99a66';
      ctx.fillRect(cx - 9 * u, cy - 6 * u, 18 * u, 14 * u);
      ctx.strokeStyle = '#8a5e35'; ctx.lineWidth = 2 * u;
      ctx.strokeRect(cx - 9 * u, cy - 6 * u, 18 * u, 14 * u);
      ctx.beginPath(); ctx.moveTo(cx - 9 * u, cy - 6 * u); ctx.lineTo(cx + 9 * u, cy + 8 * u); ctx.moveTo(cx + 9 * u, cy - 6 * u); ctx.lineTo(cx - 9 * u, cy + 8 * u); ctx.stroke();
      break;
    }
    case 'outpost': {
      hullBase(ctx, cx, cy, s, color, 'round');
      ctx.fillStyle = THEME.hullHi;
      ctx.beginPath(); ctx.arc(cx, cy, 8 * u, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = '#d8dde4'; ctx.lineWidth = 2 * u;
      ctx.beginPath(); ctx.moveTo(cx - 1 * u, cy + 4 * u); ctx.lineTo(cx - 1 * u, cy - 15 * u); ctx.stroke();
      const wave = Math.sin(t * 4) * 1.5 * u;
      ctx.fillStyle = color;
      ctx.beginPath(); ctx.moveTo(cx - 1 * u, cy - 15 * u); ctx.lineTo(cx + 11 * u, cy - 12 * u + wave); ctx.lineTo(cx - 1 * u, cy - 8 * u); ctx.closePath(); ctx.fill();
      if (b && b.garrison) {
        const n = Math.min(10, b.garrison.length);
        for (let k = 0; k < n; k++) {
          const a = -Math.PI / 2 + (k / 10) * Math.PI * 2;
          ctx.fillStyle = color;
          ctx.beginPath(); ctx.arc(cx + Math.cos(a) * 12 * u, cy + Math.sin(a) * 11 * u, 1.8 * u, 0, Math.PI * 2); ctx.fill();
        }
      }
      break;
    }
    case 'charger': {
      hullBase(ctx, cx, cy, s, color);
      // A battery cell with a lightning bolt; pulses while charging.
      const glow = b && b.charging ? 0.6 + 0.4 * Math.sin(t * 6) : 0.5;
      ctx.fillStyle = '#1a1d24';
      ctx.fillRect(cx - 6 * u, cy - 8 * u, 12 * u, 17 * u);
      ctx.fillRect(cx - 2.5 * u, cy - 10.5 * u, 5 * u, 3 * u);
      ctx.fillStyle = `rgba(126,224,138,${glow})`;
      ctx.fillRect(cx - 4.5 * u, cy - 6.5 * u, 9 * u, 14 * u);
      ctx.fillStyle = '#ffffff';
      ctx.beginPath(); ctx.moveTo(cx + 1.5 * u, cy - 6 * u); ctx.lineTo(cx - 3 * u, cy + 1.5 * u); ctx.lineTo(cx, cy + 1.5 * u);
      ctx.lineTo(cx - 1.5 * u, cy + 7 * u); ctx.lineTo(cx + 3.5 * u, cy - 1 * u); ctx.lineTo(cx + 0.5 * u, cy - 1 * u); ctx.closePath(); ctx.fill();
      break;
    }
    case 'repair': {
      hullBase(ctx, cx, cy, s, color);
      // A repair bay: a lit service pad with a crossed wrench and spanner; sparks while working.
      ctx.fillStyle = '#1a1d24';
      ctx.beginPath(); ctx.arc(cx, cy, 9 * u, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = working ? '#ffd166' : '#c9ced8'; ctx.lineWidth = 2.6 * u; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(cx - 5 * u, cy + 5 * u); ctx.lineTo(cx + 5 * u, cy - 5 * u); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(cx + 5 * u, cy + 5 * u); ctx.lineTo(cx - 5 * u, cy - 5 * u); ctx.stroke();
      ctx.lineWidth = 1.6 * u;
      ctx.beginPath(); ctx.arc(cx + 5.5 * u, cy - 5.5 * u, 2.4 * u, 0, Math.PI * 2); ctx.stroke();
      ctx.beginPath(); ctx.arc(cx - 5.5 * u, cy - 5.5 * u, 2.4 * u, 0, Math.PI * 2); ctx.stroke();
      if (working && Math.sin(t * 13) > 0.3) { ctx.fillStyle = '#ffe9a8'; ctx.fillRect(cx + 2 * u, cy - 2 * u, 1.6 * u, 1.6 * u); }
      ctx.lineCap = 'butt';
      break;
    }
    case 'farm': {
      hullBase(ctx, cx, cy, s, color);
      // Seed hoppers over a green bed of sprouts, with a pink Fuel tank.
      ctx.fillStyle = '#3a2c1a';
      ctx.fillRect(cx - 10 * u, cy - 3 * u, 20 * u, 11 * u);
      ctx.fillStyle = '#6fb24c';
      for (let k = 0; k < 5; k++) {
        const sx = cx - 8 * u + k * 4 * u, sw = working ? Math.sin(t * 3 + k) * 0.6 * u : 0;
        ctx.beginPath(); ctx.moveTo(sx, cy + 6 * u); ctx.lineTo(sx - 1.5 * u + sw, cy - 1 * u); ctx.lineTo(sx + 1.5 * u + sw, cy - 1 * u); ctx.closePath(); ctx.fill();
      }
      ctx.fillStyle = '#ff5c8a';
      ctx.beginPath(); ctx.arc(cx + 6 * u, cy - 7 * u, 3.5 * u, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#d8dde4';
      ctx.fillRect(cx - 9 * u, cy - 10 * u, 9 * u, 5 * u);
      break;
    }
    case 'pump': {
      hullBase(ctx, cx, cy, s, color, 'round');
      // A pumpjack: a beam that nods up and down on an A-frame while it pumps.
      const nod = working ? Math.sin(t * 3) * 0.35 : 0.15;
      ctx.strokeStyle = '#8a8f99'; ctx.lineWidth = 2.2 * u;
      ctx.beginPath(); ctx.moveTo(cx - 5 * u, cy + 8 * u); ctx.lineTo(cx, cy - 4 * u); ctx.lineTo(cx + 5 * u, cy + 8 * u); ctx.stroke();
      ctx.save(); ctx.translate(cx, cy - 4 * u); ctx.rotate(nod);
      ctx.fillStyle = '#ffcf4a';
      ctx.fillRect(-11 * u, -1.8 * u, 22 * u, 3.6 * u);
      ctx.fillStyle = '#d8dde4';
      ctx.beginPath(); ctx.moveTo(-11 * u, -4 * u); ctx.lineTo(-14 * u, 0); ctx.lineTo(-11 * u, 4 * u); ctx.closePath(); ctx.fill();
      ctx.restore();
      ctx.fillStyle = '#16120f';
      ctx.beginPath(); ctx.arc(cx - 10 * u, cy + 8 * u, 2.5 * u, 0, Math.PI * 2); ctx.fill();
      break;
    }
    case 'refinery': {
      hullBase(ctx, cx, cy, s, color);
      // Two storage tanks joined by a pipe, and a flare stack that burns while refining.
      for (const [ox, r0, c] of [[-5, 6, '#b08a6e'], [6, 4.5, '#ff5c8a']]) {
        ctx.fillStyle = '#1a1d24';
        ctx.beginPath(); ctx.arc(cx + ox * u, cy + 2 * u, (r0 + 1.2) * u, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = c;
        ctx.beginPath(); ctx.arc(cx + ox * u, cy + 2 * u, r0 * u, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = 'rgba(255,255,255,0.35)';
        ctx.beginPath(); ctx.arc(cx + (ox - r0 * 0.3) * u, cy + (2 - r0 * 0.3) * u, r0 * 0.35 * u, 0, Math.PI * 2); ctx.fill();
      }
      ctx.fillStyle = '#8a8f99';
      ctx.fillRect(cx + 7 * u, cy - 12 * u, 2.5 * u, 9 * u);
      if (working) {
        const fl = 3 + Math.sin(t * 14) * 1;
        ctx.fillStyle = '#ffcf4a';
        ctx.beginPath(); ctx.ellipse(cx + 8.2 * u, cy - 13 * u - fl * 0.5 * u, 1.6 * u, fl * u, 0, 0, Math.PI * 2); ctx.fill();
      }
      break;
    }
    case 'kiln': {
      hullBase(ctx, cx, cy, s, color);
      // A rotary kiln drum and a chimney that puffs while it works.
      ctx.save(); ctx.translate(cx - 2 * u, cy + 2 * u); ctx.rotate(-0.35);
      ctx.fillStyle = '#8f969f'; roundRect(ctx, -10 * u, -4 * u, 20 * u, 8 * u, 3 * u); ctx.fill();
      ctx.fillStyle = 'rgba(0,0,0,0.25)';
      for (let k = -1; k <= 1; k++) ctx.fillRect((k * 6 - 0.8) * u, -4 * u, 1.6 * u, 8 * u);
      ctx.restore();
      ctx.fillStyle = '#5d636b'; ctx.fillRect(cx + 6 * u, cy - 12 * u, 4 * u, 9 * u);
      if (working) {
        const f = (t * 0.8) % 1;
        ctx.fillStyle = `rgba(220,225,232,${0.6 * (1 - f)})`;
        ctx.beginPath(); ctx.arc(cx + 8 * u + f * 4 * u, cy - 13 * u - f * 6 * u, (2 + f * 2.5) * u, 0, Math.PI * 2); ctx.fill();
      }
      break;
    }
    case 'tarworks': {
      hullBase(ctx, cx, cy, s, color);
      // A black tar tank over a burner, and a hopper of stone.
      ctx.fillStyle = '#1a1c21';
      ctx.beginPath(); ctx.arc(cx - 3 * u, cy + 1 * u, 7.5 * u, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = '#6b7280'; ctx.lineWidth = 1.5 * u;
      ctx.beginPath(); ctx.arc(cx - 3 * u, cy + 1 * u, 7.5 * u, 0, Math.PI * 2); ctx.stroke();
      ctx.fillStyle = working ? `rgba(255,${140 + Math.sin(t * 9) * 30},60,0.9)` : 'rgba(255,140,60,0.35)';
      ctx.fillRect(cx - 7 * u, cy + 9 * u, 8 * u, 2 * u);
      ctx.fillStyle = '#c9c1b4';
      ctx.beginPath(); ctx.moveTo(cx + 6 * u, cy - 9 * u); ctx.lineTo(cx + 12 * u, cy - 9 * u); ctx.lineTo(cx + 10 * u, cy - 2 * u); ctx.lineTo(cx + 8 * u, cy - 2 * u); ctx.closePath(); ctx.fill();
      break;
    }
    case 'roadworks': {
      hullBase(ctx, cx, cy, s, color);
      // A road roller: a striped drum and a small cab.
      ctx.fillStyle = '#ffcf4a'; roundRect(ctx, cx - 11 * u, cy - 1 * u, 13 * u, 9 * u, 3 * u); ctx.fill();
      ctx.save(); roundRect(ctx, cx - 11 * u, cy - 1 * u, 13 * u, 9 * u, 3 * u); ctx.clip();
      ctx.fillStyle = '#1a1c21';
      for (let k = -2; k < 4; k++) { ctx.beginPath(); ctx.moveTo(cx + (k * 5 - 11) * u, cy + 8 * u); ctx.lineTo(cx + (k * 5 - 8) * u, cy + 8 * u); ctx.lineTo(cx + (k * 5 - 3) * u, cy - 1 * u); ctx.lineTo(cx + (k * 5 - 6) * u, cy - 1 * u); ctx.closePath(); ctx.fill(); }
      ctx.restore();
      ctx.fillStyle = '#d8dde4'; ctx.fillRect(cx + 3 * u, cy - 8 * u, 7 * u, 8 * u);
      ctx.fillStyle = '#33363d'; ctx.fillRect(cx + 4.5 * u, cy - 6.5 * u, 4 * u, 3 * u);
      break;
    }
    case 'armory': {
      hullBase(ctx, cx, cy, s, color);
      // Three brass rounds standing on a tray.
      ctx.fillStyle = '#2a2e38'; ctx.fillRect(cx - 10 * u, cy + 6 * u, 20 * u, 3 * u);
      for (const ox of [-6, 0, 6]) {
        ctx.fillStyle = '#e8c39e';
        ctx.fillRect(cx + (ox - 2.2) * u, cy - 3 * u, 4.4 * u, 9 * u);
        ctx.fillStyle = '#b8875a';
        ctx.beginPath(); ctx.moveTo(cx + (ox - 2.2) * u, cy - 3 * u); ctx.lineTo(cx + ox * u, cy - 9 * u); ctx.lineTo(cx + (ox + 2.2) * u, cy - 3 * u); ctx.closePath(); ctx.fill();
      }
      if (working) { ctx.fillStyle = 'rgba(232,195,158,0.5)'; ctx.fillRect(cx - 10 * u, cy + 10 * u, 20 * u * ((t * 0.5) % 1), 1.5 * u); }
      break;
    }
    case 'munitions': {
      hullBase(ctx, cx, cy, s, color);
      // Two missiles on an assembly rack.
      for (const ox of [-5, 5]) {
        ctx.fillStyle = '#ffcf4a';
        ctx.beginPath(); ctx.moveTo(cx + ox * u, cy - 9 * u); ctx.lineTo(cx + (ox + 3.5) * u, cy - 3 * u); ctx.lineTo(cx + (ox + 3.5) * u, cy + 7 * u);
        ctx.lineTo(cx + (ox - 3.5) * u, cy + 7 * u); ctx.lineTo(cx + (ox - 3.5) * u, cy - 3 * u); ctx.closePath(); ctx.fill();
        ctx.fillStyle = '#2a2e38';
        ctx.fillRect(cx + (ox - 3.5) * u, cy + 1 * u, 7 * u, 2 * u);
      }
      if (working) { ctx.fillStyle = 'rgba(255,207,74,0.5)'; ctx.fillRect(cx - 10 * u, cy + 9 * u, 20 * u * ((t * 0.5) % 1), 2 * u); }
      break;
    }
    case 'silo': {
      hullBase(ctx, cx, cy, s, color, 'round');
      // A blast hatch; a missile tip shows when loaded.
      ctx.fillStyle = '#1a1d24';
      ctx.beginPath(); ctx.arc(cx, cy, 8.5 * u, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = '#ffcf4a'; ctx.lineWidth = 1.5 * u; ctx.setLineDash([3 * u, 2.5 * u]);
      ctx.beginPath(); ctx.arc(cx, cy, 8.5 * u, 0, Math.PI * 2); ctx.stroke(); ctx.setLineDash([]);
      if (!b || (b.stock && b.stock.warhead > 0)) {
        ctx.fillStyle = '#d8dde4';
        ctx.beginPath(); ctx.arc(cx, cy, 4.5 * u, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = color;
        ctx.beginPath(); ctx.arc(cx, cy, 2 * u, 0, Math.PI * 2); ctx.fill();
      }
      if (b && b.reload > 0) {
        ctx.strokeStyle = color; ctx.lineWidth = 2 * u;
        ctx.beginPath(); ctx.arc(cx, cy, 11 * u, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * (1 - b.reload / BDEFS.silo.missile.reload)); ctx.stroke();
      }
      break;
    }
    case 'ramp': {
      // A stepped slope rising to the north.
      ctx.fillStyle = 'rgba(20,10,5,0.3)';
      ctx.fillRect(cx - 10 * u, cy - 9 * u, 22 * u, 22 * u);
      const g = ctx.createLinearGradient(0, cy + 11 * u, 0, cy - 11 * u);
      g.addColorStop(0, '#a86b44'); g.addColorStop(1, '#e4b67f');
      ctx.fillStyle = g;
      ctx.fillRect(cx - 11 * u, cy - 11 * u, 22 * u, 22 * u);
      ctx.fillStyle = 'rgba(40,20,8,0.45)';
      for (let k = 0; k < 4; k++) ctx.fillRect(cx - 8 * u, cy + (7 - k * 5) * u, 16 * u, 2 * u);
      ctx.fillStyle = THEME.cliffBottom;
      ctx.fillRect(cx - 11 * u, cy - 11 * u, 3 * u, 22 * u);
      ctx.fillRect(cx + 8 * u, cy - 11 * u, 3 * u, 22 * u);
      ctx.strokeStyle = color; ctx.lineWidth = 2 * u;
      ctx.strokeRect(cx - 11 * u, cy - 11 * u, 22 * u, 22 * u);
      break;
    }
    case 'turret': {
      hullBase(ctx, cx, cy, s, color, 'round');
      const a = b ? b.aim : -Math.PI / 2;
      ctx.save(); ctx.translate(cx, cy); ctx.rotate(a);
      ctx.fillStyle = '#d8dde4';
      ctx.fillRect(0, -2.5 * u, 14 * u, 5 * u);
      ctx.fillStyle = color;
      ctx.fillRect(11 * u, -2.5 * u, 3 * u, 5 * u);
      ctx.restore();
      ctx.fillStyle = THEME.hullHi;
      ctx.beginPath(); ctx.arc(cx, cy, 6.5 * u, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = color;
      ctx.beginPath(); ctx.arc(cx, cy, 2.5 * u, 0, Math.PI * 2); ctx.fill();
      break;
    }
  }
}

function drawSite(ctx, type, cx, cy, s, owner, b) {
  const color = PLAYER_COLORS[owner];
  const art = ART.site;
  if (art) drawArt(ctx, art, cx, cy, s);
  else {
    const w = s * 0.8;
    ctx.fillStyle = 'rgba(40,25,15,0.25)';
    roundRect(ctx, cx - w / 2, cy - w / 2, w, w, s * 0.1); ctx.fill();
    ctx.setLineDash([s * 0.1, s * 0.07]);
    ctx.strokeStyle = color; ctx.lineWidth = Math.max(1.5, s * 0.05);
    roundRect(ctx, cx - w / 2, cy - w / 2, w, w, s * 0.1); ctx.stroke();
    ctx.setLineDash([]);
    // Ghost of the finished building, revealed as construction progresses.
    ctx.save();
    ctx.beginPath(); ctx.rect(cx - s, cy + s * 0.45 - s * 0.9 * b.progress, s * 2, s * 2); ctx.clip();
    ctx.globalAlpha = 0.85;
    drawBuilding(ctx, type, cx, cy, s, owner, { built: true, garrison: [], aim: -Math.PI / 2 });
    ctx.restore();
    ctx.globalAlpha = 1;
    // delivered materials
    let k = 0;
    for (const g in b.stock) {
      for (let n = 0; n < b.stock[g] && k < 8; n++, k++) {
        ctx.fillStyle = GOOD[g].color;
        ctx.fillRect(cx - w / 2 + 2 + (k % 4) * s * 0.11, cy + w / 2 - s * 0.12 - Math.floor(k / 4) * s * 0.1, s * 0.08, s * 0.08);
      }
    }
  }
  // progress bar
  const bw = s * 0.8;
  ctx.fillStyle = 'rgba(0,0,0,0.55)';
  ctx.fillRect(cx - bw / 2, cy + s * 0.48, bw, Math.max(3, s * 0.09));
  ctx.fillStyle = color;
  ctx.fillRect(cx - bw / 2, cy + s * 0.48, bw * b.progress, Math.max(3, s * 0.09));
}

/* ------------------------------------------------------------------ bots */

function drawBot(ctx, u, sx, sy, s) {
  const color = PLAYER_COLORS[u.owner];
  const own = driveFrame(u) || artFor(u.type, u.owner);
  // Specialists use their own art when it exists, otherwise the worker's with a badge.
  const truck = u.type === 'truck';
  const art = own || (u.type !== 'warbot' && !truck ? artFor('worker', u.owner) : null);
  const acting = u.task && (u.task.type === 'build' || u.task.type === 'pave' || (u.task.type === 'staff' && u.task.phase === 'work' && u.task.node >= 0 && S.road[u.task.node]));
  const bob = u.busy && !acting ? Math.sin(R.time * 18 + u.id) * s * 0.03 : 0;
  if (truck) {
    drawTruck(ctx, u, sx, sy, s, color, own);
  } else if (art) {
    const size = s * (u.type === 'warbot' ? 0.6 : 0.5);
    if (art.shadow) drawBotShadow(ctx, u, sx, sy, size * 0.42, size * 0.3);
    drawArt(ctx, art, sx, sy + bob, size, u.face);
    if (art === own) drawDriveOverlays(ctx, u, sx, sy + bob, size);
  } else if (u.type !== 'warbot') {
    const r = s * 0.16;
    ctx.fillStyle = 'rgba(20,10,5,0.3)';
    ctx.beginPath(); ctx.ellipse(sx + r * 0.3, sy + r * 0.6, r, r * 0.6, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#ece6da';
    ctx.beginPath(); ctx.arc(sx, sy + bob, r, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = color; ctx.lineWidth = Math.max(1.2, r * 0.35);
    ctx.beginPath(); ctx.arc(sx, sy + bob, r * 0.82, 0, Math.PI * 2); ctx.stroke();
    ctx.fillStyle = '#1b1e25';
    ctx.beginPath(); ctx.arc(sx + Math.cos(u.face) * r * 0.45, sy + bob + Math.sin(u.face) * r * 0.45, r * 0.32, 0, Math.PI * 2); ctx.fill();
  } else {
    const r = s * 0.22;
    ctx.fillStyle = 'rgba(20,10,5,0.3)';
    ctx.beginPath(); ctx.ellipse(sx + r * 0.3, sy + r * 0.6, r, r * 0.6, 0, 0, Math.PI * 2); ctx.fill();
    ctx.save(); ctx.translate(sx, sy); ctx.rotate(u.face);
    ctx.fillStyle = '#1b1e25';
    ctx.beginPath(); ctx.moveTo(r * 1.15, 0); ctx.lineTo(-r * 0.75, r * 0.95); ctx.lineTo(-r * 0.4, 0); ctx.lineTo(-r * 0.75, -r * 0.95); ctx.closePath(); ctx.fill();
    ctx.fillStyle = color;
    ctx.beginPath(); ctx.moveTo(r * 0.9, 0); ctx.lineTo(-r * 0.55, r * 0.72); ctx.lineTo(-r * 0.25, 0); ctx.lineTo(-r * 0.55, -r * 0.72); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.beginPath(); ctx.arc(r * 0.3, 0, r * 0.18, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  }
  if (!own && u.type !== 'worker' && u.type !== 'warbot' && !truck) drawBotBadge(ctx, u.type, sx + s * 0.16, sy + s * 0.14 + bob, s);
  // A Hauler with its own art carries its load on the flatbed (x 29–165, y 87–169 of the 256 image).
  const bed = u.type === 'hauler' && own;
  if (bed && u.carry) drawTruckCargo(ctx, u, sx, sy + bob, -0.387 * s * 0.5, 0.531 * s * 0.5, 0.32 * s * 0.5, s, 2, 1);
  if (u.carry && !truck && !bed) {
    const c = s * 0.1;
    for (let k = (u.carryN || 1) - 1; k >= 0; k--) {
      const ox = k * c * 1.2, oy = -k * c * 0.9;
      ctx.fillStyle = '#1b1e25';
      ctx.fillRect(sx - c - 1 + ox, sy - s * 0.3 - c - 1 + bob + oy, c * 2 + 2, c * 2 + 2);
      ctx.fillStyle = GOOD[u.carry].color;
      ctx.fillRect(sx - c + ox, sy - s * 0.3 - c + bob + oy, c * 2, c * 2);
    }
  }
  if (u.owner === 0 && u.type === 'warbot' && (u.ammo ?? WARBOT_AMMO) < WARBOT_AMMO * 0.3) {
    // Low on ammo: a short brass bar under the bot (empty = grey outline only).
    const w = s * 0.26, h = Math.max(2.5, s * 0.07), x = sx - w / 2, y = sy + s * 0.26;
    ctx.fillStyle = 'rgba(0,0,0,0.7)';
    ctx.fillRect(x - 1, y - 1, w + 2, h + 2);
    ctx.fillStyle = '#e8c39e';
    ctx.fillRect(x, y, (w * (u.ammo || 0)) / WARBOT_AMMO, h);
  }
  if (u.owner === 0 && (u.bat ?? 100) < BATTERY.low) {
    // Low battery: an orange bar; emergency mode: a flashing red one.
    const crit = u.bat < BATTERY.critical;
    if (!crit || Math.sin(R.time * 10) > -0.3) {
      const w = s * 0.26, h = Math.max(3, s * 0.09), x = sx + s * 0.16, y = sy - s * 0.3;
      ctx.fillStyle = 'rgba(0,0,0,0.7)';
      ctx.fillRect(x - 1, y - 1, w + 3, h + 2);
      ctx.fillStyle = crit ? '#ff4d4d' : '#ffb347';
      ctx.fillRect(x, y, Math.max(1.5, (w * u.bat) / 100), h);
    }
  }
  if (u.hp < u.maxHp) {
    const w = s * 0.4;
    ctx.fillStyle = 'rgba(0,0,0,0.6)';
    ctx.fillRect(sx - w / 2, sy - s * 0.36, w, 3);
    ctx.fillStyle = u.hp / u.maxHp > 0.5 ? '#7bea6b' : '#ff6b5a';
    ctx.fillRect(sx - w / 2, sy - s * 0.36, (w * u.hp) / u.maxHp, 3);
  }
}

/* Driving animation: frames step every FRAME_STEP tiles driven. */
const FRAME_STEP = 1 / 12;

/** The driving frame bot u shows now ('<type>@<team>-f0' …), or null if it has no frames. */
function driveFrame(u) {
  const base = u.type + '@' + u.owner + '-f';
  if (!ART[base + '0']) return null;
  let n = 1;
  while (ART[base + n]) n++;
  return ART[base + (Math.floor((u.odo || 0) / FRAME_STEP) % n)];
}

/** Brake lights while it slows or waits, a puff of dust while it speeds up (fading towards full speed). */
function drawDriveOverlays(ctx, u, x, y, size) {
  if (u.drive < 0 && ART[u.type + '-brake']) drawArt(ctx, ART[u.type + '-brake'], x, y, size, u.face);
  else if (u.drive > 0 && ART[u.type + '-boost']) {
    ctx.globalAlpha = clamp(1 - (u.vel || 0) / (u.vtop || 1), 0.2, 1);
    drawArt(ctx, ART[u.type + '-boost'], x, y, size, u.face);
    ctx.globalAlpha = 1;
  }
}

/** A soft shadow under a bot, cast down-right whichever way the bot faces (for art without one). */
function drawBotShadow(ctx, u, x, y, along, across) {
  ctx.fillStyle = 'rgba(20,10,5,0.32)';
  ctx.beginPath();
  ctx.ellipse(x + along * 0.12, y + along * 0.16, along, across, u.face, 0, Math.PI * 2);
  ctx.fill();
}

/*
 * Work animations. A builder circles its construction site welding, with sparks flying off the
 * frame; a worker paving a road tile spreads fresh concrete across it as it goes (bridge decks and
 * tunnel linings too); a Paver drives across the tile laying hot asphalt that steams behind it.
 */
function workPose(u) {
  const t = u.task;
  if (!t || !u.busy) return null;
  if (t.type === 'build' && t.phase === 'work') {
    const a = R.time * 0.7 + u.id * 1.7, r = 0.33;
    return { kind: 'weld', dx: Math.cos(a) * r, dy: Math.sin(a) * r * 0.8, face: a + Math.PI };
  }
  if (t.type === 'pave' && t.phase !== 'go') {
    const c = CROSS[S.terrain[t.tile]], time = c ? c.time : S.res[t.tile] ? PAVE_CLEAR_TIME : PAVE_TIME;
    return { kind: c ? 'deck' : 'concrete', tile: t.tile, prog: clamp(t.prog / time, 0, 1), dx: 0, dy: 0 };
  }
  if (t.type === 'staff' && t.phase === 'work' && t.node >= 0 && S.road[t.node]) {
    const b = getE(t.bld);
    if (b && BDEFS[b.type].roadworks) {
      const prog = clamp(1 - t.timer / 2.5, 0, 1), along = (prog - 0.5) * 0.7;
      return { kind: 'asphalt', tile: t.node, prog, dx: Math.cos(u.face) * along, dy: Math.sin(u.face) * along };
    }
  }
  return null;
}

/** The road surface spreading across the tile being paved, from the side the bot came in. */
function drawWorkUnder(ctx, u, pose, ox, oy, z) {
  if (pose.tile === undefined) return;
  const i = pose.tile % S.W, j = (pose.tile / S.W) | 0, x = ox + i * z, y = oy + j * z;
  const horiz = Math.abs(Math.cos(u.face)) >= Math.abs(Math.sin(u.face));
  const back = horiz ? (Math.cos(u.face) >= 0 ? 0 : 1) : (Math.sin(u.face) >= 0 ? 0 : 1); // fill starts at the edge behind it
  const p = pose.prog, w = z * 0.62, inset = (z - w) / 2;
  const fill = pose.kind === 'asphalt' ? '#2c2f35' : pose.kind === 'deck' ? '#8f979f' : '#c3c8cf';
  ctx.fillStyle = fill;
  if (horiz) {
    const len = z * p, x0 = back === 0 ? x : x + z - len;
    ctx.fillRect(x0, y + inset, len, w);
  } else {
    const len = z * p, y0 = back === 0 ? y : y + z - len;
    ctx.fillRect(x + inset, y0, w, len);
  }
  if (pose.kind === 'concrete' || pose.kind === 'deck') {
    // The wet edge: a brighter line where the fresh concrete is being spread.
    ctx.fillStyle = 'rgba(255,255,255,0.55)';
    const e = Math.max(1, z * 0.04), at = z * p;
    if (horiz) ctx.fillRect(back === 0 ? x + at - e : x + z - at, y + inset, e, w);
    else ctx.fillRect(x + inset, back === 0 ? y + at - e : y + z - at, w, e);
  }
}

/** Sparks off a weld, dust off fresh concrete, steam off hot asphalt. */
function drawWorkOver(ctx, u, pose, sx, sy, z) {
  const T = R.time, seed = u.id * 7.31;
  if (pose.kind === 'weld') {
    // The arc: a hot white-blue point in front of the bot, flickering, and sparks spraying from it.
    const fx = sx + Math.cos(pose.face) * z * 0.2, fy = sy + Math.sin(pose.face) * z * 0.2;
    const flick = 0.6 + 0.4 * Math.sin(T * 40 + seed);
    const g = ctx.createRadialGradient(fx, fy, 0, fx, fy, z * 0.22);
    g.addColorStop(0, `rgba(235,250,255,${0.95 * flick})`); g.addColorStop(0.4, `rgba(140,210,255,${0.5 * flick})`); g.addColorStop(1, 'rgba(140,210,255,0)');
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(fx, fy, z * 0.22, 0, Math.PI * 2); ctx.fill();
    for (let k = 0; k < 7; k++) {
      const ph = (T * 2.6 + k / 7 + hash2(k, u.id, 3)) % 1;
      const ang = pose.face + Math.PI + (hash2(k, Math.floor(T * 2.6 + k / 7), u.id) - 0.5) * 2.2;
      const d = ph * z * 0.45;
      const px = fx + Math.cos(ang) * d, py = fy + Math.sin(ang) * d + ph * ph * z * 0.35; // they arc and fall
      ctx.fillStyle = `rgba(255,${200 + Math.round(55 * (1 - ph))},${90 + Math.round(120 * (1 - ph))},${1 - ph})`;
      ctx.fillRect(px - 1, py - 1, Math.max(1.5, z * 0.045), Math.max(1.5, z * 0.045));
    }
  } else if (pose.kind === 'asphalt') {
    // Steam curling up off the hot asphalt behind the Paver.
    const bx = sx - Math.cos(u.face) * z * 0.3, by = sy - Math.sin(u.face) * z * 0.3;
    for (let k = 0; k < 4; k++) {
      const ph = (T * 0.9 + k / 4 + hash2(k, u.id, 5)) % 1;
      ctx.fillStyle = `rgba(235,235,235,${0.35 * (1 - ph)})`;
      ctx.beginPath(); ctx.arc(bx + Math.sin(ph * 6 + k) * z * 0.08 + (k - 1.5) * z * 0.1, by - ph * z * 0.6, z * (0.06 + ph * 0.12), 0, Math.PI * 2); ctx.fill();
    }
  } else {
    // Concrete dust kicking up as it's spread.
    for (let k = 0; k < 3; k++) {
      const ph = (T * 1.4 + k / 3 + hash2(k, u.id, 9)) % 1;
      ctx.fillStyle = `rgba(215,205,190,${0.4 * (1 - ph)})`;
      ctx.beginPath(); ctx.arc(sx + (hash2(k, u.id, 2) - 0.5) * z * 0.5, sy + z * 0.15 - ph * z * 0.3, z * (0.05 + ph * 0.08), 0, Math.PI * 2); ctx.fill();
    }
  }
}

/** A Freight Truck seen from above: a team-coloured cab and a flatbed with its load of crates (over its art, if any). */
function drawTruck(ctx, u, sx, sy, s, color, art) {
  const L = s * 0.62, Wd = s * 0.3;
  if (art) {
    // The art's flatbed (inside the side rails) runs from 10% to 64% of the image's width.
    const size = s * 0.9;
    if (art.shadow) drawBotShadow(ctx, u, sx, sy, size * 0.44, size * 0.17);
    drawArt(ctx, art, sx, sy, size, u.face);
    drawDriveOverlays(ctx, u, sx, sy, size);
    drawTruckCargo(ctx, u, sx, sy, -size * 0.392, size * 0.54, size * 0.24, s);
    return;
  }
  ctx.save();
  ctx.translate(sx, sy);
  ctx.fillStyle = 'rgba(20,10,5,0.3)';
  ctx.beginPath(); ctx.ellipse(s * 0.04, s * 0.06, L * 0.55, Wd * 0.62, u.face, 0, Math.PI * 2); ctx.fill();
  ctx.rotate(u.face);
  // Wheels, chassis, flatbed.
  ctx.fillStyle = '#121418';
  for (const x of [-L * 0.36, -L * 0.12, L * 0.3]) { ctx.fillRect(x - s * 0.04, -Wd * 0.58, s * 0.08, Wd * 0.16); ctx.fillRect(x - s * 0.04, Wd * 0.42, s * 0.08, Wd * 0.16); }
  ctx.fillStyle = '#2b2f36';
  roundRect(ctx, -L / 2, -Wd / 2, L, Wd, s * 0.03); ctx.fill();
  ctx.fillStyle = '#5a616b';
  ctx.fillRect(-L / 2 + s * 0.02, -Wd / 2 + s * 0.025, L * 0.66, Wd - s * 0.05);
  // Cab at the front, with a windscreen.
  ctx.fillStyle = color;
  roundRect(ctx, L * 0.2, -Wd / 2, L * 0.3, Wd, s * 0.04); ctx.fill();
  ctx.fillStyle = '#16212b';
  ctx.fillRect(L * 0.38, -Wd * 0.36, L * 0.08, Wd * 0.72);
  // Brake lights while it slows or waits; a puff of dust from the rear wheels as it pulls away.
  if (u.drive < 0) {
    ctx.fillStyle = '#ff3b3b';
    ctx.fillRect(-L / 2 - s * 0.012, -Wd * 0.45, s * 0.025, s * 0.04);
    ctx.fillRect(-L / 2 - s * 0.012, Wd * 0.45 - s * 0.04, s * 0.025, s * 0.04);
  } else if (u.drive > 0 && (u.vel || 0) < (u.vtop || 1) * 0.8) {
    ctx.fillStyle = 'rgba(214,170,120,0.45)';
    for (const k of [-1, 1]) { ctx.beginPath(); ctx.arc(-L * 0.62, k * Wd * 0.4, s * 0.05, 0, Math.PI * 2); ctx.fill(); }
  }
  ctx.restore();
  drawTruckCargo(ctx, u, sx, sy, -L / 2 + s * 0.025, L * 0.62, Wd - s * 0.06, s);
}

/** A load of crates on a flatbed starting `x0` behind the centre: `cols` × `rows` of them (truck 4 × 2, hauler 2 × 1). */
function drawTruckCargo(ctx, u, sx, sy, x0, len, wid, s, cols, rows) {
  const n = u.carry ? u.carryN || 1 : 0;
  if (!n) return;
  cols = cols || 4; rows = rows || 2;
  ctx.save();
  ctx.translate(sx, sy);
  ctx.rotate(u.face);
  const cw = len / cols, ch = wid / rows, m = Math.max(0.5, s * 0.006);
  for (let k = 0; k < Math.min(n, cols * rows); k++) {
    const x = x0 + Math.floor(k / rows) * cw, y = -wid / 2 + (k % rows) * ch;
    ctx.fillStyle = '#1b1e25'; ctx.fillRect(x + m, y + m, cw - 2 * m, ch - 2 * m);
    ctx.fillStyle = GOOD[u.carry].color; ctx.fillRect(x + 2 * m, y + 2 * m, cw - 4 * m, ch - 4 * m);
  }
  ctx.restore();
}

/** A small marker telling specialist bots apart when they share the worker's art. */
function drawBotBadge(ctx, type, x, y, s) {
  const r = Math.max(2.5, s * 0.075);
  ctx.fillStyle = '#14161d';
  ctx.beginPath(); ctx.arc(x, y, r + 1.5, 0, Math.PI * 2); ctx.fill();
  if (type === 'hauler') {
    ctx.fillStyle = '#f0a030';
    ctx.fillRect(x - r * 0.8, y - r * 0.8, r * 1.6, r * 1.6);
  } else if (type === 'agribot') {
    ctx.fillStyle = '#6fd36a';
    ctx.beginPath(); ctx.ellipse(x, y, r, r * 0.55, -0.7, 0, Math.PI * 2); ctx.fill();
  } else {
    ctx.fillStyle = '#ffcf4a';
    ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#14161d'; ctx.lineWidth = Math.max(1, r * 0.45);
    ctx.beginPath(); ctx.moveTo(x - r * 0.7, y + r * 0.7); ctx.lineTo(x + r * 0.7, y - r * 0.7); ctx.stroke();
  }
}

/* ------------------------------------------------------------------ territory */

function updateTerritoryLayer() {
  if (R.terrVer === S.territoryVer) return;
  R.terrVer = S.territoryVer;
  const img = R.terrCtx.createImageData(S.W, S.H);
  const cols = PLAYER_COLORS.map((c) => [parseInt(c.slice(1, 3), 16), parseInt(c.slice(3, 5), 16), parseInt(c.slice(5, 7), 16)]);
  for (let t = 0; t < S.W * S.H; t++) {
    const o = S.owner[t];
    if (o < 0) continue;
    img.data[t * 4] = cols[o][0]; img.data[t * 4 + 1] = cols[o][1]; img.data[t * 4 + 2] = cols[o][2];
    img.data[t * 4 + 3] = 34;
  }
  R.terrCtx.putImageData(img, 0, 0);
  const segs = [];
  for (let j = 0; j < S.H; j++) {
    for (let i = 0; i < S.W; i++) {
      const o = S.owner[j * S.W + i];
      if (o < 0) continue;
      if (i + 1 >= S.W || S.owner[j * S.W + i + 1] !== o) segs.push([o, i + 1, j, i + 1, j + 1]);
      if (i === 0 || S.owner[j * S.W + i - 1] !== o) segs.push([o, i, j, i, j + 1]);
      if (j + 1 >= S.H || S.owner[(j + 1) * S.W + i] !== o) segs.push([o, i, j + 1, i + 1, j + 1]);
      if (j === 0 || S.owner[(j - 1) * S.W + i] !== o) segs.push([o, i, j, i + 1, j]);
    }
  }
  R.borders = segs;
}

/* ------------------------------------------------------------------ placement overlay */

function refreshOverlay(type) {
  const valid = new Uint8Array(S.W * S.H);
  for (let j = 0; j < S.H; j++) for (let i = 0; i < S.W; i++) {
    if (S.owner[j * S.W + i] === 0 && canPlace(0, type, i, j).ok) valid[j * S.W + i] = 1;
  }
  R.overlay = { type, valid, at: R.time };
}

/* ------------------------------------------------------------------ main draw */

function render(dtReal) {
  R.time += dtReal;
  R.dt = dtReal;
  const ctx = R.ctx, z = R.cam.z;
  ctx.setTransform(R.dpr, 0, 0, R.dpr, 0, 0);
  ctx.fillStyle = '#120f14';
  ctx.fillRect(0, 0, R.w, R.h);
  if (!S || !R.map) return;
  flushDirtyTiles();
  updateTerritoryLayer();

  let ox = R.w / 2 - R.cam.x * z, oy = R.h / 2 - R.cam.y * z;
  // A nuclear blast shakes the screen for its first half second.
  for (const f of S.fx) if (f.type === 'nuke' && f.t < 0.6) { const a = 9 * (1 - f.t / 0.6); ox += (Math.random() - 0.5) * a; oy += (Math.random() - 0.5) * a; }
  const v0 = screenToWorld(0, 0), v1 = screenToWorld(R.w, R.h);
  const inView = (x, y, m) => x > v0.x - m && x < v1.x + m && y > v0.y - m && y < v1.y + m;

  ctx.imageSmoothingEnabled = z < TP;
  ctx.drawImage(R.map, ox, oy, S.W * z, S.H * z);
  ctx.imageSmoothingEnabled = true;
  ctx.drawImage(R.terr, ox, oy, S.W * z, S.H * z);

  // Territory borders
  ctx.lineWidth = Math.max(1.5, z * 0.07);
  ctx.setLineDash([z * 0.28, z * 0.18]);
  for (let p = 0; p < 2; p++) {
    ctx.strokeStyle = PLAYER_COLORS[p];
    ctx.globalAlpha = 0.85;
    ctx.beginPath();
    for (const sg of R.borders) {
      if (sg[0] !== p) continue;
      ctx.moveTo(ox + sg[1] * z, oy + sg[2] * z);
      ctx.lineTo(ox + sg[3] * z, oy + sg[4] * z);
    }
    ctx.stroke();
  }
  ctx.setLineDash([]);
  ctx.globalAlpha = 1;

  // Placement overlay
  if (R.mode === 'place' && R.overlay) {
    if (R.time - R.overlay.at > 1.5) refreshOverlay(R.overlay.type);
    ctx.fillStyle = 'rgba(160,255,190,0.22)';
    for (let t = 0; t < S.W * S.H; t++) {
      if (!R.overlay.valid[t]) continue;
      const i = t % S.W, j = (t / S.W) | 0;
      if (!inView(i, j, 1)) continue;
      ctx.fillRect(ox + i * z + z * 0.12, oy + j * z + z * 0.12, z * 0.76, z * 0.76);
    }
  }
  if (R.mode === 'road') {
    const lightsMode = typeof UI !== 'undefined' && UI.roadMode === 'lights';
    const bridgeMode = typeof UI !== 'undefined' && UI.roadMode === 'bridge';
    const rampMode = typeof UI !== 'undefined' && UI.roadMode === 'ramp';
    if (rampMode) {
      // Where a Ramp can go: the foot or top of a one-level cliff (refreshed every couple of seconds).
      if (!R.overlay || R.overlay.type !== 'ramp' || R.time - R.overlay.at > 2) refreshOverlay('ramp');
      ctx.fillStyle = 'rgba(160,255,190,0.22)';
      ctx.strokeStyle = 'rgba(160,255,190,0.7)';
      ctx.lineWidth = 1.5;
      for (let t = 0; t < S.W * S.H; t++) {
        if (!R.overlay.valid[t]) continue;
        const i = t % S.W, j = (t / S.W) | 0;
        if (!inView(i, j, 1)) continue;
        ctx.fillRect(ox + i * z + z * 0.12, oy + j * z + z * 0.12, z * 0.76, z * 0.76);
        ctx.strokeRect(ox + i * z + z * 0.12, oy + j * z + z * 0.12, z * 0.76, z * 0.76);
      }
    } else if (R.overlay && R.overlay.type === 'ramp') R.overlay = null;
    ctx.lineWidth = 1;
    const net = roadNet();
    for (let t = 0; t < S.W * S.H; t++) {
      const i = t % S.W, j = (t / S.W) | 0;
      if (!inView(i, j, 1)) continue;
      if (lightsMode) {
        // Junctions that can take a light.
        if (!net.junc[t] || S.owner[t] !== 0 || S.lights[t]) continue;
        ctx.strokeStyle = 'rgba(125,255,160,0.9)';
        ctx.lineWidth = 2;
        ctx.setLineDash([z * 0.12, z * 0.08]);
        ctx.strokeRect(ox + i * z + 2, oy + j * z + 2, z - 4, z - 4);
        ctx.setLineDash([]);
        continue;
      }
      if (S.road[t] || !canRoad(0, i, j)) continue;
      const cross = crossTile(t);
      if (cross && !bridgeMode) continue;
      ctx.strokeStyle = cross ? 'rgba(140,215,255,0.5)' : S.res[t] ? 'rgba(255,170,90,0.28)' : 'rgba(255,240,200,0.18)';
      ctx.strokeRect(ox + i * z + 1.5, oy + j * z + 1.5, z - 3, z - 3);
    }
  }
  drawScorch(ctx, ox, oy, z);
  drawPlans(ctx, ox, oy, z, inView);
  if (R.mode === 'road') drawDraft(ctx, ox, oy, z, inView);
  drawLights(ctx, ox, oy, z, inView);
  drawOverpasses(ctx, ox, oy, z, inView);
  if (R.traffic && R.mode === 'road') drawTraffic(ctx, ox, oy, z, inView);
  if (R.routePreview) {
    // The road a building's "Lay road" button would pave.
    ctx.strokeStyle = '#ffd166';
    ctx.lineWidth = Math.max(1.5, z * 0.06);
    ctx.setLineDash([z * 0.14, z * 0.1]);
    ctx.lineDashOffset = -R.time * z * 0.4;
    for (const t of R.routePreview) {
      const i = t % S.W, j = (t / S.W) | 0;
      ctx.fillStyle = S.res[t] ? 'rgba(255,140,80,0.25)' : 'rgba(255,209,102,0.18)';
      ctx.fillRect(ox + i * z + z * 0.1, oy + j * z + z * 0.1, z * 0.8, z * 0.8);
      ctx.strokeRect(ox + i * z + z * 0.1, oy + j * z + z * 0.1, z * 0.8, z * 0.8);
    }
    ctx.setLineDash([]);
    ctx.lineDashOffset = 0;
  }

  // Selection rings drawn under buildings
  const sel = getE(R.selected);
  if (R.mode === 'aim') drawAim(ctx, ox, oy, z);
  else if (sel) drawRanges(ctx, sel.type, sel.x, sel.y, ox, oy, z, sel.owner);
  if (R.ghost) drawRanges(ctx, R.ghost.type, R.ghost.x, R.ghost.y, ox, oy, z, 0);

  // Buildings and bots, sorted by y so lower things overlap upper ones.
  const items = [];
  for (const b of S.buildings) if (!b.dead && inView(b.x, b.y, 2)) items.push(b);
  for (const u of S.bots) if (!u.dead && !u.inside && inView(u.x, u.y, 1)) items.push(u);
  items.sort((a, b) => (a.ent === 'b' ? a.y + 0.5 : a.y) - (b.ent === 'b' ? b.y + 0.5 : b.y));
  for (const e of items) {
    if (e.ent === 'b') {
      const cx = ox + (e.x + 0.5) * z, cy = oy + (e.y + 0.5) * z;
      drawBuilding(ctx, e.type, cx, cy, z, e.owner, e);
      const def = BDEFS[e.type];
      if (e.built && e.armor < def.armor - 0.05) {
        const w = z * 0.8;
        ctx.fillStyle = 'rgba(0,0,0,0.6)';
        ctx.fillRect(cx - w / 2, cy - z * 0.62, w, Math.max(3, z * 0.08));
        ctx.fillStyle = e.armor / def.armor > 0.4 ? '#ffd166' : '#ff5a5a';
        ctx.fillRect(cx - w / 2, cy - z * 0.62, (w * Math.max(0, e.armor)) / def.armor, Math.max(3, z * 0.08));
      }
      if (e.owner === 0) drawBadge(ctx, e, cx - z * 0.32, cy - z * 0.32, z);
      if (e.owner === 0 && e.unlinked) drawNoRoad(ctx, cx + z * 0.32, cy + z * 0.3, z);
      if (e.paused) {
        ctx.fillStyle = 'rgba(0,0,0,0.65)';
        ctx.beginPath(); ctx.arc(cx + z * 0.3, cy - z * 0.3, z * 0.16, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#fff';
        ctx.fillRect(cx + z * 0.25, cy - z * 0.38, z * 0.035, z * 0.16);
        ctx.fillRect(cx + z * 0.32, cy - z * 0.38, z * 0.035, z * 0.16);
      }
    } else {
      // Bots swing round to a new heading instead of snapping to it (long trucks turn slower).
      const turn = (BOTS[e.type].truck ? 5 : 11) * Math.min(0.1, R.dt || 0) * ((typeof UI !== 'undefined' && UI.speed) || 1);
      const want = e.face || 0;
      e.rface = e.rface === undefined ? want : e.rface + clamp(wrapAngle(want - e.rface), -turn, turn);
      // Off-road bots spread out a little; on roads they drive in lanes (keep right on two-way roads).
      let jx = (hash2(e.id, 1, 9) - 0.5) * 0.25, jy = (hash2(e.id, 2, 9) - 0.5) * 0.25;
      const rt = S.road[tIdx(Math.floor(e.x), Math.floor(e.y))];
      if (rt && e.path) {
        const lane = rt === 1 ? LANE_OFFSET : 0;
        jx = -Math.sin(e.rface) * lane; jy = Math.cos(e.rface) * lane;
      }
      if (typeof UI !== 'undefined' && UI.selSet && UI.selSet.has(e.id)) {
        // Selected (desktop): a green ring on the ground under it.
        ctx.strokeStyle = 'rgba(125,255,160,0.95)';
        ctx.lineWidth = Math.max(1.5, z * 0.045);
        ctx.beginPath(); ctx.ellipse(ox + (e.x + jx) * z, oy + (e.y + jy) * z + z * 0.06, z * 0.3, z * 0.2, 0, 0, Math.PI * 2); ctx.stroke();
      }
      // Working bots act out their job (building, paving): a pose, plus effects under and over them.
      const pose = workPose(e);
      if (pose) { jx += pose.dx; jy += pose.dy; drawWorkUnder(ctx, e, pose, ox, oy, z); }
      const face = e.face;
      e.face = pose && pose.face !== undefined ? pose.face : e.rface; // draw with the smoothed heading
      drawBot(ctx, e, ox + (e.x + jx) * z, oy + (e.y + jy) * z, z);
      e.face = face;
      if (pose) drawWorkOver(ctx, e, pose, ox + (e.x + jx) * z, oy + (e.y + jy) * z, z);
    }
  }

  if (R.ghost) {
    ctx.globalAlpha = 0.75;
    drawBuilding(ctx, R.ghost.type, ox + (R.ghost.x + 0.5) * z, oy + (R.ghost.y + 0.5) * z, z, 0, { built: true, garrison: [], aim: -Math.PI / 2 });
    ctx.globalAlpha = 1;
    ctx.strokeStyle = R.ghost.ok ? '#9dffb8' : '#ff6b6b';
    ctx.lineWidth = 2.5;
    ctx.strokeRect(ox + R.ghost.x * z + 1, oy + R.ghost.y * z + 1, z - 2, z - 2);
  }
  if (sel) {
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2;
    ctx.setLineDash([z * 0.15, z * 0.1]);
    ctx.lineDashOffset = -R.time * z * 0.5;
    const r = sel.type === 'lander' ? z * 0.95 : z * 0.6;
    ctx.beginPath(); ctx.arc(ox + (sel.x + 0.5) * z, oy + (sel.y + 0.5) * z, r, 0, Math.PI * 2); ctx.stroke();
    ctx.setLineDash([]);
  }
  const sb = typeof UI !== 'undefined' && UI.selBot ? getE(UI.selBot) : null;
  if (sb && !sb.inside) {
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(ox + sb.x * z, oy + sb.y * z, z * 0.32, 0, Math.PI * 2); ctx.stroke();
  }
  // Mouse hover: outline the tile under the pointer while laying roads or placing lights.
  if (R.hover >= 0 && R.mode === 'road') {
    ctx.strokeStyle = 'rgba(255,255,255,0.85)';
    ctx.lineWidth = 2;
    ctx.strokeRect(ox + (R.hover % S.W) * z + 1, oy + ((R.hover / S.W) | 0) * z + 1, z - 2, z - 2);
  }
  if (R.selTile >= 0) {
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2;
    ctx.strokeRect(ox + (R.selTile % S.W) * z + 1, oy + ((R.selTile / S.W) | 0) * z + 1, z - 2, z - 2);
  }

  drawRallies(ctx, ox, oy, z);
  drawMissiles(ctx, ox, oy, z);
  drawEffects(ctx, ox, oy, z);
  if (R.box) {
    // The selection box being dragged (desktop).
    const b = R.box, x = Math.min(b.x0, b.x1), y = Math.min(b.y0, b.y1), w = Math.abs(b.x1 - b.x0), h = Math.abs(b.y1 - b.y0);
    ctx.fillStyle = 'rgba(125,255,160,0.1)';
    ctx.fillRect(x, y, w, h);
    ctx.strokeStyle = 'rgba(125,255,160,0.9)';
    ctx.lineWidth = 1.5;
    ctx.strokeRect(x + 0.5, y + 0.5, w, h);
  }
  if (typeof UI !== 'undefined' && UI.inGame) renderMinimap();
}

/**
 * Planned roads waiting for workers: a faint road with a dashed outline (amber for yours), and a
 * bar filling up while a worker paves it.
 */
function drawPlans(ctx, ox, oy, z, inView) {
  for (let p = 0; p < 2; p++) {
    const list = planList(p);
    if (!list.length) continue;
    ctx.lineWidth = Math.max(1, z * 0.04);
    ctx.setLineDash([z * 0.12, z * 0.09]);
    for (const t of list) {
      const i = t % S.W, j = (t / S.W) | 0;
      if (!inView(i, j, 1)) continue;
      const x = ox + i * z, y = oy + j * z, m = z * 0.16;
      ctx.fillStyle = p === 0 ? 'rgba(200,206,214,0.32)' : 'rgba(200,206,214,0.16)';
      ctx.fillRect(x + m, y + m, z - 2 * m, z - 2 * m);
      ctx.strokeStyle = p === 0 ? 'rgba(255,209,102,0.9)' : 'rgba(255,120,120,0.5)';
      ctx.strokeRect(x + m, y + m, z - 2 * m, z - 2 * m);
      const by = getE(S.paveRes[t]);
      if (by && by.task && by.task.type === 'pave' && by.task.tile === t && by.task.phase === 'work') {
        const f = Math.min(1, by.task.prog / (S.res[t] ? PAVE_CLEAR_TIME : PAVE_TIME));
        ctx.fillStyle = 'rgba(169,180,194,0.9)';
        ctx.fillRect(x + m, y + z - m - z * 0.12, (z - 2 * m) * f, z * 0.12);
      }
    }
    ctx.setLineDash([]);
  }
}

/**
 * Traffic lights: a stop line on each road leading into the junction, green for the direction
 * that may go, red for the other (both red while the junction clears), and a small signal post.
 */
function drawLights(ctx, ox, oy, z, inView) {
  for (const k in S.lights) {
    const t = +k, L = S.lights[k], i = t % S.W, j = (t / S.W) | 0;
    if (!inView(i, j, 1)) continue;
    const x = ox + i * z, y = oy + j * z;
    const w = Math.max(2, z * 0.09), len = z * 0.42;
    for (const [di, dj, axis] of [[1, 0, 0], [-1, 0, 0], [0, 1, 1], [0, -1, 1]]) {
      if (!inMap(i + di, j + dj) || !S.road[tIdx(i + di, j + dj)]) continue;
      const go = !(L.clr > 0) && L.ph === axis;
      ctx.fillStyle = go ? '#3dff8a' : L.clr > 0 && L.ph === axis ? '#ffc23d' : '#ff4b4b';
      // A bar across the entry, just inside the junction tile.
      if (axis === 0) ctx.fillRect(x + (di > 0 ? z - w - z * 0.04 : z * 0.04), y + (z - len) / 2, w, len);
      else ctx.fillRect(x + (z - len) / 2, y + (dj > 0 ? z - w - z * 0.04 : z * 0.04), len, w);
    }
    // Signal head on the corner: two lamps showing the east-west and north-south state.
    const px = x + z * 0.86, py = y + z * 0.14, r = Math.max(2, z * 0.07);
    ctx.fillStyle = 'rgba(20,22,28,0.9)';
    roundRect(ctx, px - r * 1.5, py - r * 2.6, r * 3, r * 5.2, r);
    ctx.fill();
    for (const [axis, dy] of [[0, -1.2], [1, 1.2]]) {
      const go = !(L.clr > 0) && L.ph === axis;
      ctx.fillStyle = go ? '#3dff8a' : '#ff4b4b';
      ctx.beginPath(); ctx.arc(px, py + dy * r, r * 0.8, 0, Math.PI * 2); ctx.fill();
    }
  }
}

/**
 * A road plan not yet built (Paths): sketched tiles in bright cyan (blue for bridges and tunnels),
 * and roads marked to take up with a red cross.
 */
function drawDraft(ctx, ox, oy, z, inView) {
  const d = typeof UI !== 'undefined' && UI.draft;
  if (!d || (!d.add.length && !d.del.size && !d.ramps.size)) return;
  // Planned Ramps: a yellow tile with chevrons pointing up the slope.
  for (const t of d.ramps) {
    const i = t % S.W, j = (t / S.W) | 0;
    if (!inView(i, j, 1)) continue;
    const x = ox + i * z, y = oy + j * z;
    ctx.fillStyle = 'rgba(255,209,102,0.45)';
    ctx.fillRect(x + z * 0.08, y + z * 0.08, z * 0.84, z * 0.84);
    ctx.strokeStyle = '#ffd166'; ctx.lineWidth = Math.max(1.5, z * 0.05);
    ctx.strokeRect(x + z * 0.08, y + z * 0.08, z * 0.84, z * 0.84);
    ctx.beginPath();
    for (const k of [0.38, 0.6]) { ctx.moveTo(x + z * 0.28, y + z * (k + 0.12)); ctx.lineTo(x + z * 0.5, y + z * k); ctx.lineTo(x + z * 0.72, y + z * (k + 0.12)); }
    ctx.stroke();
  }
  const pulse = 0.75 + 0.25 * Math.sin(R.time * 4);
  ctx.lineWidth = Math.max(1.5, z * 0.05);
  for (const t of d.add) {
    const i = t % S.W, j = (t / S.W) | 0;
    if (!inView(i, j, 1) || S.road[t] || S.plan[t]) continue;
    const x = ox + i * z, y = oy + j * z, cross = crossTile(t);
    ctx.fillStyle = cross ? `rgba(110,170,255,${0.45 * pulse})` : `rgba(120,230,255,${0.4 * pulse})`;
    ctx.fillRect(x + z * 0.1, y + z * 0.1, z * 0.8, z * 0.8);
    ctx.strokeStyle = cross ? '#7fb2ff' : '#7ae8ff';
    ctx.strokeRect(x + z * 0.1, y + z * 0.1, z * 0.8, z * 0.8);
  }
  ctx.strokeStyle = '#ff5a6e';
  ctx.lineWidth = Math.max(2, z * 0.08);
  for (const t of d.del) {
    const i = t % S.W, j = (t / S.W) | 0;
    if (!inView(i, j, 1)) continue;
    const x = ox + i * z, y = oy + j * z;
    ctx.beginPath();
    ctx.moveTo(x + z * 0.25, y + z * 0.25); ctx.lineTo(x + z * 0.75, y + z * 0.75);
    ctx.moveTo(x + z * 0.75, y + z * 0.25); ctx.lineTo(x + z * 0.25, y + z * 0.75);
    ctx.stroke();
  }
}

/** The traffic map: each road tile tinted green (quiet) to red (packed), with pulsing rings on jams. */
function drawTraffic(ctx, ox, oy, z, inView) {
  if (!HEAT.flow || HEAT.of !== S) return;
  const pulse = 0.5 + 0.5 * Math.sin(R.time * 6);
  for (let t = 0; t < S.W * S.H; t++) {
    if (!S.road[t]) continue;
    const i = t % S.W, j = (t / S.W) | 0;
    if (!inView(i, j, 1)) continue;
    const v = clamp(HEAT.flow[t] / TRAFFIC_BUSY, 0, 1);
    const col = v < 0.5 ? mixColor('#3ddc84', '#ffd23d', v * 2) : mixColor('#ffd23d', '#ff4b4b', (v - 0.5) * 2);
    ctx.globalAlpha = 0.35 + 0.5 * v;
    ctx.fillStyle = col;
    ctx.fillRect(ox + i * z + z * 0.22, oy + j * z + z * 0.22, z * 0.56, z * 0.56);
    ctx.globalAlpha = 1;
    if (HEAT.jam[t] > TRAFFIC_JAM) {
      ctx.strokeStyle = `rgba(255,75,75,${0.5 + 0.5 * pulse})`;
      ctx.lineWidth = Math.max(2, z * 0.07);
      ctx.beginPath(); ctx.arc(ox + i * z + z / 2, oy + j * z + z / 2, z * (0.42 + 0.08 * pulse), 0, Math.PI * 2); ctx.stroke();
    }
  }
}

/**
 * Overpasses: the east-west road rises onto a short deck over the junction (ramps reaching into the
 * tiles either side), casting a shadow on the road below.
 */
function drawOverpasses(ctx, ox, oy, z, inView) {
  for (const k in S.over) {
    const t = +k, i = t % S.W, j = (t / S.W) | 0;
    if (!inView(i, j, 2)) continue;
    const x = ox + i * z, y = oy + j * z;
    const w = z * 0.46, y0 = y + (z - w) / 2, e = Math.max(1, z * 0.04);
    // Shadow cast on the road underneath.
    ctx.fillStyle = 'rgba(0,0,0,0.38)';
    ctx.fillRect(x - z * 0.12, y0 + z * 0.17, z * 1.24, w);
    // Approach ramps either side, then the raised deck over the junction.
    for (const [rx, rw] of [[x - z * 0.55, z * 0.45], [x + z * 1.1, z * 0.45]]) {
      ctx.fillStyle = '#9aa1a9'; ctx.fillRect(rx, y0 + e, rw, w - 2 * e);
      ctx.fillStyle = '#4a5058'; ctx.fillRect(rx, y0, rw, e); ctx.fillRect(rx, y0 + w - e, rw, e);
    }
    ctx.fillStyle = '#3c4249';
    ctx.fillRect(x - z * 0.12, y0 - e, z * 1.24, w + 2 * e);
    ctx.fillStyle = '#c9ced5';
    ctx.fillRect(x - z * 0.1, y0 + e, z * 1.2, w - 2 * e);
    // Railings and a centre line.
    ctx.fillStyle = '#f2f4f7';
    ctx.fillRect(x - z * 0.1, y0 + e, z * 1.2, e);
    ctx.fillRect(x - z * 0.1, y0 + w - 2 * e, z * 1.2, e);
    ctx.fillStyle = 'rgba(255,209,102,0.85)';
    for (let k2 = 0; k2 < 3; k2++) ctx.fillRect(x + z * (0.05 + k2 * 0.36), y + z / 2 - e / 2, z * 0.18, e);
  }
}

/** On Missile Silo art: a pip for each Missile loaded and a ring while it reloads. */
function drawSiloStatus(ctx, b, cx, cy, s, color) {
  const cap = BDEFS.silo.ammoCap, n = b.stock.warhead || 0;
  const r = Math.max(2.5, s * 0.055), gap = r * 2.8;
  const x0 = cx - s * 0.36, y0 = cy + s * 0.34;
  ctx.fillStyle = 'rgba(14,15,20,0.8)';
  roundRect(ctx, x0 - r * 1.6, y0 - r * 1.6, gap * (cap - 1) + r * 3.2, r * 3.2, r * 1.2);
  ctx.fill();
  for (let k = 0; k < cap; k++) {
    ctx.fillStyle = k < n ? '#ffcf4a' : 'rgba(255,255,255,0.18)';
    ctx.beginPath(); ctx.arc(x0 + k * gap, y0, r, 0, Math.PI * 2); ctx.fill();
  }
  if (b.reload > 0) {
    ctx.strokeStyle = color; ctx.lineWidth = Math.max(1.5, s * 0.035);
    ctx.beginPath();
    ctx.arc(cx, cy - s * 0.05, s * 0.3, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * (1 - b.reload / BDEFS.silo.missile.reload));
    ctx.stroke();
  }
}

/** A red badge on a building with no road to storage: a road with a slash through it. */
function drawNoRoad(ctx, x, y, z) {
  const r = Math.max(6, z * 0.17);
  const pulse = 0.75 + 0.25 * Math.sin(R.time * 4);
  ctx.globalAlpha = pulse;
  ctx.fillStyle = '#e0475c';
  ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = '#fff';
  ctx.lineWidth = Math.max(1.2, r * 0.16);
  ctx.beginPath();
  ctx.moveTo(x - r * 0.35, y - r * 0.6); ctx.lineTo(x - r * 0.35, y + r * 0.6);
  ctx.moveTo(x + r * 0.35, y - r * 0.6); ctx.lineTo(x + r * 0.35, y + r * 0.6);
  ctx.stroke();
  ctx.lineWidth = Math.max(1.5, r * 0.22);
  ctx.beginPath(); ctx.moveTo(x - r * 0.62, y + r * 0.62); ctx.lineTo(x + r * 0.62, y - r * 0.62); ctx.stroke();
  ctx.globalAlpha = 1;
}

/** Small corner badge showing a player-set priority or storage mode. */
function drawBadge(ctx, b, x, y, z) {
  let kind = null;
  if (b.prio === 'high') kind = 'up';
  else if (b.prio === 'low') kind = 'down';
  else if (b.gprio === 'high') kind = 'up';
  else if (b.gprio === 'low') kind = 'down';
  else if (b.smode === 'fill') kind = 'in';
  else if (b.smode === 'empty') kind = 'out';
  else if (b.reject) kind = 'filter';
  if (!kind) return;
  const r = Math.max(5, z * 0.15);
  ctx.fillStyle = 'rgba(14,15,20,0.85)';
  ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = kind === 'up' ? '#ffc457' : kind === 'down' ? '#9ba4b4' : kind === 'out' ? '#ff8a3d' : '#38d4ff';
  ctx.lineWidth = Math.max(1.5, r * 0.28);
  ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  const k = r * 0.5;
  ctx.beginPath();
  if (kind === 'up') { ctx.moveTo(x - k, y + k * 0.4); ctx.lineTo(x, y - k * 0.6); ctx.lineTo(x + k, y + k * 0.4); }
  else if (kind === 'down') { ctx.moveTo(x - k, y - k * 0.4); ctx.lineTo(x, y + k * 0.6); ctx.lineTo(x + k, y - k * 0.4); }
  else if (kind === 'in') { ctx.moveTo(x, y - k); ctx.lineTo(x, y + k * 0.7); ctx.moveTo(x - k * 0.7, y); ctx.lineTo(x, y + k * 0.7); ctx.lineTo(x + k * 0.7, y); }
  else if (kind === 'out') { ctx.moveTo(x, y + k); ctx.lineTo(x, y - k * 0.7); ctx.moveTo(x - k * 0.7, y); ctx.lineTo(x, y - k * 0.7); ctx.lineTo(x + k * 0.7, y); }
  else { ctx.moveTo(x - k, y - k * 0.6); ctx.lineTo(x + k, y - k * 0.6); ctx.lineTo(x + k * 0.2, y + k * 0.1); ctx.lineTo(x + k * 0.2, y + k * 0.8); ctx.lineTo(x - k * 0.2, y + k * 0.6); ctx.lineTo(x - k * 0.2, y + k * 0.1); ctx.closePath(); }
  ctx.stroke();
}

function drawRanges(ctx, type, x, y, ox, oy, z, owner) {
  const def = BDEFS[type];
  const r = def.gather || def.plant ? def.radius + 0.5 : def.range ? def.range : def.missile ? def.missile.range : def.mil ? def.terr : 0;
  if (!r) return;
  const cx = ox + (x + 0.5) * z, cy = oy + (y + 0.5) * z;
  const hostile = def.range || def.missile;
  ctx.fillStyle = hostile ? 'rgba(255,90,90,0.08)' : 'rgba(255,255,255,0.09)';
  ctx.strokeStyle = hostile ? 'rgba(255,140,140,0.7)' : 'rgba(255,255,255,0.65)';
  ctx.lineWidth = 2;
  ctx.beginPath(); ctx.arc(cx, cy, r * z, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
  if (def.gather) {
    // Highlight the nodes this building can reach.
    ctx.strokeStyle = 'rgba(255,255,255,0.75)';
    ctx.lineWidth = 1.5;
    const rad = def.radius, r2 = rad * rad + 0.3;
    for (let j = Math.max(0, y - rad); j <= Math.min(S.H - 1, y + rad); j++) {
      for (let i = Math.max(0, x - rad); i <= Math.min(S.W - 1, x + rad); i++) {
        if (S.res[j * S.W + i] === def.gather && dist2(i, j, x, y) <= r2) {
          ctx.beginPath(); ctx.arc(ox + (i + 0.5) * z, oy + (j + 0.5) * z, z * 0.42, 0, Math.PI * 2); ctx.stroke();
        }
      }
    }
  }
}

/**
 * Aiming a Missile Silo: its range ring on the ground (everything outside it dimmed), and a target
 * marker with the blast radius where you tapped (or where the mouse points).
 */
function drawAim(ctx, ox, oy, z) {
  const silo = getE(typeof UI !== 'undefined' ? UI.aimSilo : 0);
  if (!silo) return;
  const nuke = !!BDEFS[silo.type].nukeSilo;
  const md = nuke ? { range: NUKE.range, splash: NUKE.radius } : BDEFS.silo.missile;
  const cx = ox + (silo.x + 0.5) * z, cy = oy + (silo.y + 0.5) * z, rr = md.range * z;
  ctx.save();
  ctx.fillStyle = 'rgba(8,8,12,0.45)';
  ctx.beginPath(); ctx.rect(0, 0, R.w, R.h); ctx.arc(cx, cy, rr, 0, Math.PI * 2, true); ctx.fill('evenodd');
  ctx.restore();
  ctx.fillStyle = 'rgba(255,90,90,0.07)';
  ctx.strokeStyle = 'rgba(255,120,120,0.95)';
  ctx.lineWidth = Math.max(2, z * 0.08);
  ctx.setLineDash([z * 0.5, z * 0.3]);
  ctx.lineDashOffset = -R.time * z;
  ctx.beginPath(); ctx.arc(cx, cy, rr, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
  ctx.setLineDash([]); ctx.lineDashOffset = 0;
  const spot = R.aim || R.aimHover;
  if (!spot) return;
  const t = nuke ? null : missileTargetAt(silo.owner, spot.i, spot.j);
  const tx = (t ? t.x : spot.i) + 0.5, ty = (t ? t.y : spot.j) + 0.5;
  const ok = dist(silo.x, silo.y, tx - 0.5, ty - 0.5) <= md.range;
  const px = ox + tx * z, py = oy + ty * z;
  const col = !ok ? 'rgba(200,200,200,0.8)' : R.aim ? '#ff4b4b' : 'rgba(255,140,120,0.85)';
  // Flight path, blast radius and crosshair.
  ctx.strokeStyle = ok ? 'rgba(255,207,74,0.7)' : 'rgba(200,200,200,0.4)';
  ctx.lineWidth = Math.max(1.5, z * 0.05);
  ctx.setLineDash([z * 0.2, z * 0.2]);
  ctx.beginPath(); ctx.moveTo(cx, cy); ctx.quadraticCurveTo((cx + px) / 2, Math.min(cy, py) - 3 * z, px, py); ctx.stroke();
  ctx.setLineDash([]);
  ctx.fillStyle = ok ? 'rgba(255,75,75,0.18)' : 'rgba(200,200,200,0.12)';
  ctx.strokeStyle = col;
  ctx.lineWidth = Math.max(2, z * 0.07);
  ctx.beginPath(); ctx.arc(px, py, md.splash * z, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
  const k = Math.max(6, z * 0.6);
  ctx.beginPath();
  ctx.moveTo(px - k, py); ctx.lineTo(px - k * 0.35, py); ctx.moveTo(px + k * 0.35, py); ctx.lineTo(px + k, py);
  ctx.moveTo(px, py - k); ctx.lineTo(px, py - k * 0.35); ctx.moveTo(px, py + k * 0.35); ctx.lineTo(px, py + k);
  ctx.stroke();
  ctx.beginPath(); ctx.arc(px, py, k * 0.7, 0, Math.PI * 2); ctx.stroke();
}

/** Your rally flags, with how many warbots hold each one. */
function drawRallies(ctx, ox, oy, z) {
  for (const r of S.rallies) {
    if (r.owner !== 0) continue;
    const x = ox + r.x * z, y = oy + r.y * z;
    const n = rallyMembers(r.id).length;
    const art = ART.rally;
    if (art) drawArt(ctx, art, x, y - z * 0.3, z * 0.9);
    else {
      ctx.strokeStyle = 'rgba(0,0,0,0.5)'; ctx.lineWidth = Math.max(2, z * 0.08);
      ctx.beginPath(); ctx.moveTo(x + 1, y + 1); ctx.lineTo(x + 1, y - z * 0.75 + 1); ctx.stroke();
      ctx.strokeStyle = '#eef2f6'; ctx.lineWidth = Math.max(1.5, z * 0.06);
      ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x, y - z * 0.75); ctx.stroke();
      const wave = Math.sin(R.time * 5) * z * 0.04;
      ctx.fillStyle = PLAYER_COLORS[0];
      ctx.beginPath(); ctx.moveTo(x, y - z * 0.75); ctx.lineTo(x + z * 0.45, y - z * 0.62 + wave); ctx.lineTo(x, y - z * 0.48); ctx.closePath(); ctx.fill();
      ctx.fillStyle = 'rgba(0,0,0,0.35)';
      ctx.beginPath(); ctx.ellipse(x + 2, y + 2, z * 0.18, z * 0.07, 0, 0, Math.PI * 2); ctx.fill();
    }
    ctx.font = `800 ${Math.max(10, z * 0.3)}px system-ui, sans-serif`;
    ctx.textAlign = 'left';
    ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(0,0,0,0.75)'; ctx.fillStyle = '#ffffff';
    ctx.strokeText(String(n), x + z * 0.12, y - z * 0.05);
    ctx.fillText(String(n), x + z * 0.12, y - z * 0.05);
  }
}

/** Missiles fly in an arc: a shadow on the ground and the missile above it. */
function drawMissiles(ctx, ox, oy, z) {
  for (const m of S.missiles) {
    if (m.nuke) { drawNukeFlight(ctx, m, ox, oy, z); continue; }
    const k = Math.min(1, m.t / m.dur), k2 = Math.min(1, (m.t + 0.05) / m.dur);
    const gx = ox + lerp(m.x0, m.x1, k) * z, gy = oy + lerp(m.y0, m.y1, k) * z;
    const hgt = Math.sin(k * Math.PI) * 2.5 * z;
    const ang = Math.atan2((lerp(m.y0, m.y1, k2) - Math.sin(k2 * Math.PI) * 2.5) - (lerp(m.y0, m.y1, k) - Math.sin(k * Math.PI) * 2.5),
      lerp(m.x0, m.x1, k2) - lerp(m.x0, m.x1, k));
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.beginPath(); ctx.ellipse(gx, gy, z * 0.2, z * 0.08, 0, 0, Math.PI * 2); ctx.fill();
    // Target marker so the defender sees where it will land.
    if (m.owner !== 0 || k > 0.5) {
      ctx.strokeStyle = `rgba(255,90,90,${0.5 + 0.5 * Math.sin(R.time * 12)})`; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(ox + m.x1 * z, oy + m.y1 * z, z * 0.7, 0, Math.PI * 2); ctx.stroke();
    }
    const art = ART.missile;
    if (art) { drawArt(ctx, art, gx, gy - hgt, z * 0.7, ang); continue; }
    ctx.save(); ctx.translate(gx, gy - hgt); ctx.rotate(ang);
    ctx.fillStyle = '#ffcf4a';
    ctx.beginPath(); ctx.ellipse(-z * 0.32, 0, z * 0.16 + Math.random() * z * 0.05, z * 0.07, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#d8dde4';
    ctx.fillRect(-z * 0.22, -z * 0.06, z * 0.36, z * 0.12);
    ctx.fillStyle = PLAYER_COLORS[m.owner];
    ctx.beginPath(); ctx.moveTo(z * 0.14, -z * 0.06); ctx.lineTo(z * 0.26, 0); ctx.lineTo(z * 0.14, z * 0.06); ctx.closePath(); ctx.fill();
    ctx.restore();
  }
}

/**
 * A nuclear missile in flight: a high, slow arc, and for everyone a pulsing red ring over the whole
 * blast area with the seconds to impact.
 */
function drawNukeFlight(ctx, m, ox, oy, z) {
  const k = Math.min(1, m.t / m.dur), k2 = Math.min(1, (m.t + 0.1) / m.dur), H = 7;
  const at = (q) => ({ x: lerp(m.x0, m.x1, q), y: lerp(m.y0, m.y1, q) - Math.sin(q * Math.PI) * H });
  const p = at(k), p2 = at(k2);
  const tx = ox + m.x1 * z, ty = oy + m.y1 * z, rr = NUKE.radius * z, pulse = 0.5 + 0.5 * Math.sin(R.time * 8);
  ctx.fillStyle = `rgba(255,40,40,${0.08 + 0.1 * pulse})`;
  ctx.strokeStyle = `rgba(255,70,70,${0.6 + 0.4 * pulse})`;
  ctx.lineWidth = Math.max(2, z * 0.1);
  ctx.setLineDash([z * 0.4, z * 0.25]);
  ctx.beginPath(); ctx.arc(tx, ty, rr, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
  ctx.setLineDash([]);
  const secs = Math.max(0, Math.ceil(m.dur - m.t));
  ctx.font = `800 ${Math.max(16, z * 0.9)}px system-ui, sans-serif`;
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.lineWidth = 4; ctx.strokeStyle = 'rgba(0,0,0,0.75)'; ctx.strokeText('☢ ' + secs, tx, ty);
  ctx.fillStyle = '#ffd23d'; ctx.fillText('☢ ' + secs, tx, ty);
  // Shadow on the ground, then the missile up in the air.
  const gx = ox + lerp(m.x0, m.x1, k) * z, gy = oy + lerp(m.y0, m.y1, k) * z;
  ctx.fillStyle = 'rgba(0,0,0,0.3)';
  ctx.beginPath(); ctx.ellipse(gx, gy, z * 0.4, z * 0.14, 0, 0, Math.PI * 2); ctx.fill();
  const ang = Math.atan2(p2.y - p.y, p2.x - p.x), sx = ox + p.x * z, sy = oy + p.y * z;
  const art = ART['nuclear-missile'];
  if (art) { drawArt(ctx, art, sx, sy, z * 1.6, ang); return; }
  ctx.save(); ctx.translate(sx, sy); ctx.rotate(ang);
  ctx.fillStyle = '#ff9a3c'; ctx.beginPath(); ctx.ellipse(-z * 0.6, 0, z * 0.3, z * 0.1, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#16171b'; ctx.fillRect(-z * 0.45, -z * 0.09, z * 0.8, z * 0.18);
  ctx.fillStyle = '#ffd23d'; ctx.fillRect(z * 0.05, -z * 0.09, z * 0.12, z * 0.18);
  ctx.restore();
}

/** Ground scorched by a nuclear blast: the crater art (or a dark burn) fading as the ground recovers. */
function drawScorch(ctx, ox, oy, z) {
  if (!S.blasts || !S.blasts.length) return;
  for (const b of S.blasts) {
    const left = b.until - S.time;
    if (left <= 0) continue;
    ctx.globalAlpha = clamp(left / 60, 0, 1);
    const art = ART['nuke-scorch'], w = (NUKE.radius * 2 / 0.82) * z, x = ox + b.x * z, y = oy + b.y * z;
    if (art) ctx.drawImage(art.img, x - w * 0.5, y - w * 0.52, w, w);
    else {
      const g = ctx.createRadialGradient(x, y, 0, x, y, NUKE.radius * z);
      g.addColorStop(0, 'rgba(10,6,4,0.85)'); g.addColorStop(0.7, 'rgba(30,20,12,0.6)'); g.addColorStop(1, 'rgba(30,20,12,0)');
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.arc(x, y, NUKE.radius * z, 0, Math.PI * 2); ctx.fill();
    }
    ctx.globalAlpha = 1;
  }
}

function drawEffects(ctx, ox, oy, z) {
  for (const f of S.fx) {
    const k = f.t / f.life;
    const x = ox + f.x * z, y = oy + f.y * z;
    switch (f.type) {
      case 'nuke': {
        // The detonation: 24 frames from a 6×4 sheet at 12 fps, ground zero at [0.5, 0.7] of each
        // frame, drawn so the shockwave (0.31 of the frame) reaches the blast radius.
        const art = ART['nuke-blast'], fr = Math.floor(f.t * 12);
        if (art && fr < 24) {
          const fw = art.img.width / 6, fh = art.img.height / 4, w = (f.r / 0.31) * z;
          ctx.globalAlpha = 1;
          ctx.drawImage(art.img, (fr % 6) * fw, Math.floor(fr / 6) * fh, fw, fh, x - w * 0.5, y - w * 0.7, w, w);
        } else if (!art) {
          ctx.globalAlpha = Math.max(0, 1 - k);
          ctx.fillStyle = '#fff6d8';
          ctx.beginPath(); ctx.arc(x, y, f.r * z * Math.min(1, k * 3), 0, Math.PI * 2); ctx.fill();
        }
        break;
      }
      case 'boom': {
        const r = (f.r || 0.6) * z * (0.3 + k);
        ctx.globalAlpha = 1 - k;
        ctx.fillStyle = '#ffcf6b';
        ctx.beginPath(); ctx.arc(x, y, r * 0.6, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = '#ff7a3d'; ctx.lineWidth = 3;
        ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.stroke();
        break;
      }
      case 'smoke': {
        ctx.fillStyle = '#5a524c';
        for (let n = 0; n < 3; n++) {
          const kk = (k + n * 0.3) % 1;
          ctx.globalAlpha = 0.5 * (1 - kk);
          ctx.beginPath(); ctx.arc(x + (n - 1) * z * 0.15, y - kk * z * 0.9, z * (0.15 + kk * 0.3), 0, Math.PI * 2); ctx.fill();
        }
        break;
      }
      case 'laser': {
        ctx.globalAlpha = 1 - k;
        ctx.strokeStyle = f.color; ctx.lineWidth = 4;
        ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(ox + f.x2 * z, oy + f.y2 * z); ctx.stroke();
        ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 1.5;
        ctx.stroke();
        break;
      }
      case 'spark': {
        ctx.globalAlpha = 1 - k;
        ctx.strokeStyle = f.color || '#fff'; ctx.lineWidth = 2;
        const r = z * 0.12 * (0.5 + k);
        ctx.beginPath();
        for (let n = 0; n < 4; n++) {
          const a = n * Math.PI / 2 + 0.4;
          ctx.moveTo(x + Math.cos(a) * r * 0.3, y + Math.sin(a) * r * 0.3);
          ctx.lineTo(x + Math.cos(a) * r, y + Math.sin(a) * r);
        }
        ctx.stroke();
        break;
      }
      case 'ring': {
        ctx.globalAlpha = 1 - k;
        ctx.strokeStyle = f.color || '#fff'; ctx.lineWidth = 3;
        ctx.beginPath(); ctx.arc(x, y, z * (f.r || 1) * (0.3 + k), 0, Math.PI * 2); ctx.stroke();
        break;
      }
      case 'float': {
        ctx.globalAlpha = 1 - k;
        ctx.fillStyle = f.color || '#fff';
        ctx.font = `700 ${Math.max(11, z * 0.38)}px system-ui, sans-serif`;
        ctx.textAlign = 'center';
        ctx.strokeStyle = 'rgba(0,0,0,0.6)'; ctx.lineWidth = 3;
        ctx.strokeText(f.text, x, y - k * z * 0.8);
        ctx.fillText(f.text, x, y - k * z * 0.8);
        break;
      }
    }
    ctx.globalAlpha = 1;
  }
}

/** Render a building to a data URL for the build menu. */
function buildingIcon(type, size, owner) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const ctx = c.getContext('2d');
  // Custom art is fitted to the icon whole, whatever its scale or anchor on the map.
  const art = artFor(type, owner || 0);
  if (art) {
    ctx.drawImage(art.img, size * 0.04, size * 0.04, size * 0.92, size * 0.92);
    const head = type === 'turret' && art.anchor === 'bottom' ? turretHead(owner || 0, Math.PI / 4) : null;
    if (head) ctx.drawImage(head.img, size * 0.04, size * 0.04, size * 0.92, size * 0.92);
    return c.toDataURL();
  }
  drawBuilding(ctx, type, size / 2, size / 2 + (type === 'lander' ? 0 : size * 0.02), type === 'lander' ? size * 0.55 : size * 0.86, owner || 0,
    { built: true, garrison: [], aim: -Math.PI / 4 });
  return c.toDataURL();
}

/* ------------------------------------------------------------------ minimap */

const MM = { canvas: null, ctx: null, base: null, baseCtx: null, dirty: true, ver: -1, builtAt: -9, w: 0, h: 0, on: true };

const MM_COLORS = {
  ground: [169, 113, 74], water: [28, 75, 93], rock: [74, 51, 41], ramp: [235, 205, 150],
  [R_STALK]: [47, 174, 134], [R_BOULDER]: [160, 154, 145], [R_ORE]: [235, 120, 50], [R_CRYSTAL]: [150, 105, 245],
  [R_CROP]: [255, 92, 138], [R_OIL]: [22, 18, 15], [R_URANIUM]: [157, 255, 58], fertile: [92, 98, 40],
};

function initMinimap(canvas) {
  MM.canvas = canvas;
  MM.ctx = canvas.getContext('2d');
}

/** Size the minimap for the current screen and map. Returns its CSS width. */
function layoutMinimap() {
  if (!S || !MM.canvas) return 0;
  MM.w = R.w >= 700 ? 156 : 100;
  MM.h = Math.round((MM.w * S.H) / S.W);
  MM.canvas.style.width = MM.w + 'px';
  MM.canvas.style.height = MM.h + 'px';
  MM.canvas.width = Math.round(MM.w * R.dpr);
  MM.canvas.height = Math.round(MM.h * R.dpr);
  MM.dirty = true;
  return MM.w;
}

function rebuildMinimapBase() {
  if (!MM.base || MM.base.width !== S.W || MM.base.height !== S.H) {
    MM.base = document.createElement('canvas');
    MM.base.width = S.W; MM.base.height = S.H;
    MM.baseCtx = MM.base.getContext('2d');
  }
  const img = MM.baseCtx.createImageData(S.W, S.H);
  const team = PLAYER_COLORS.map((c) => [parseInt(c.slice(1, 3), 16), parseInt(c.slice(3, 5), 16), parseInt(c.slice(5, 7), 16)]);
  for (let t = 0; t < S.W * S.H; t++) {
    const terr = S.terrain[t];
    let c = terr === T_WATER ? MM_COLORS.water : terr === T_ROCK ? MM_COLORS.rock : S.res[t] ? MM_COLORS[S.res[t]] : S.ramp[t] ? MM_COLORS.ramp
      : S.fert && S.fert[t] ? MM_COLORS.fertile : MM_COLORS.ground;
    if (terr === T_GROUND && !S.res[t] && !S.ramp[t]) {
      // Higher ground is lighter.
      const f = 0.8 + 0.09 * (S.elev[t] + (R.levelOffset || 0));
      c = [Math.min(255, c[0] * f), Math.min(255, c[1] * f), Math.min(255, c[2] * f)];
    }
    const o = S.owner[t];
    const k = o >= 0 && terr === T_GROUND ? 0.32 : 0;
    const i = t * 4;
    img.data[i] = c[0] + (k ? (team[o][0] - c[0]) * k : 0);
    img.data[i + 1] = c[1] + (k ? (team[o][1] - c[1]) * k : 0);
    img.data[i + 2] = c[2] + (k ? (team[o][2] - c[2]) * k : 0);
    img.data[i + 3] = 255;
  }
  MM.baseCtx.putImageData(img, 0, 0);
  MM.dirty = false;
  MM.ver = S.territoryVer;
  MM.builtAt = R.time;
}

function renderMinimap() {
  if (!MM.on || !S || !MM.ctx || !MM.w) return;
  if ((MM.dirty || MM.ver !== S.territoryVer) && R.time - MM.builtAt > 0.4) rebuildMinimapBase();
  if (!MM.base) rebuildMinimapBase();
  const ctx = MM.ctx, sx = MM.w / S.W, sy = MM.h / S.H;
  ctx.setTransform(R.dpr, 0, 0, R.dpr, 0, 0);
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(MM.base, 0, 0, MM.w, MM.h);
  for (const b of S.buildings) {
    if (b.dead) continue;
    const big = b.type === 'lander' ? 2.2 : 1.3;
    const w = Math.max(2.5, sx * big), h = Math.max(2.5, sy * big);
    const x = (b.x + 0.5) * sx - w / 2, y = (b.y + 0.5) * sy - h / 2;
    ctx.fillStyle = b.built ? PLAYER_COLORS[b.owner] : 'rgba(255,255,255,0.7)';
    ctx.fillRect(x, y, w, h);
    if (b.type === 'lander') { ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 1; ctx.strokeRect(x - 0.5, y - 0.5, w + 1, h + 1); }
  }
  for (const u of S.bots) {
    if (u.dead || u.inside || u.type !== 'warbot') continue;
    ctx.fillStyle = u.owner === 0 ? '#bff2ff' : '#ffc2ca';
    ctx.fillRect(u.x * sx - 1, u.y * sy - 1, 2, 2);
  }
  for (const b of S.buildings) {
    if (b.dead || S.time - b.lastHit > 2) continue;
    ctx.strokeStyle = (R.time * 4) % 2 < 1 ? '#ffffff' : '#ff5a6e';
    ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.arc((b.x + 0.5) * sx, (b.y + 0.5) * sy, 4, 0, Math.PI * 2); ctx.stroke();
  }
  for (const r of S.rallies) {
    if (r.owner !== 0) continue;
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(r.x * sx - 0.5, r.y * sy - 5, 1.5, 5);
    ctx.fillStyle = PLAYER_COLORS[0];
    ctx.fillRect(r.x * sx + 1, r.y * sy - 5, 3, 2.5);
  }
  for (const m of S.missiles) {
    const k = Math.min(1, m.t / m.dur);
    ctx.fillStyle = '#ffcf4a';
    ctx.fillRect(lerp(m.x0, m.x1, k) * sx - 1.5, lerp(m.y0, m.y1, k) * sy - 1.5, 3, 3);
  }
  const a = screenToWorld(0, 0), c = screenToWorld(R.w, R.h);
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 1.5;
  ctx.strokeRect(clamp(a.x, 0, S.W) * sx, clamp(a.y, 0, S.H) * sy,
    (clamp(c.x, 0, S.W) - clamp(a.x, 0, S.W)) * sx, (clamp(c.y, 0, S.H) - clamp(a.y, 0, S.H)) * sy);
}

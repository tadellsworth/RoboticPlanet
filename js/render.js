'use strict';
/*
 * Botfall — canvas renderer. Terrain, paths and resources are baked into an offscreen image
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
  mode: 'normal',
  time: 0,
};

const THEME = {
  ground1: '#ad6f47', ground2: '#c99a66',
  water: '#1c4b5d', waterEdge: '#2e7684', foam: '#9fd9d0',
  rock: '#5d4134', rockTop: '#73513f', rockHi: '#94694f', rockShadow: '#36241d',
  road: '#dcc193', roadEdge: '#a77f55',
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
    img.onload = () => { ART[key] = { img, scale: entry.scale || 0 }; artLoaded++; if (onChange) onChange(key); };
    img.onerror = () => console.warn('Botfall: could not load art for', key, entry.src);
    img.src = /^(data:|https?:)/.test(entry.src) ? entry.src : 'art/' + entry.src;
  }
}

function artFor(key, owner) {
  return ART[key + '@' + owner] || ART[key] || null;
}

function drawArt(ctx, art, cx, cy, sizePx, angle) {
  const s = sizePx * (art.scale || 1);
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
}

function resizeRender() {
  R.dpr = Math.min(2, window.devicePixelRatio || 1);
  R.w = window.innerWidth;
  R.h = window.innerHeight;
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
  c.x = S.W / 2 <= hw ? S.W / 2 : clamp(c.x, hw - 1, S.W - hw + 1);
  c.y = S.H / 2 <= hh ? S.H / 2 : clamp(c.y, hh - 1.5, S.H - hh + 2.5);
}

function centerOn(x, y) { R.cam.x = x; R.cam.y = y; clampCam(); }
function screenToWorld(sx, sy) { return { x: (sx - R.w / 2) / R.cam.z + R.cam.x, y: (sy - R.h / 2) / R.cam.z + R.cam.y }; }
function worldToScreen(wx, wy) { return { x: (wx - R.cam.x) * R.cam.z + R.w / 2, y: (wy - R.cam.y) * R.cam.z + R.h / 2 }; }

/* ------------------------------------------------------------------ baked map */

function bakeMap() {
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
}

function flushDirtyTiles() {
  if (!S.dirtyTiles.length) return;
  const seen = new Set();
  for (const t of S.dirtyTiles) {
    if (seen.has(t)) continue;
    seen.add(t);
    drawTile(t % S.W, (t / S.W) | 0);
  }
  S.dirtyTiles.length = 0;
}

function terrAt(i, j) { return inMap(i, j) ? S.terrain[tIdx(i, j)] : T_ROCK; }

function drawTile(i, j) {
  const ctx = R.mapCtx, x = i * TP, y = j * TP, t = tIdx(i, j);
  const terr = S.terrain[t];
  const n = fbm(i / 6, j / 6, 991, 3);
  ctx.fillStyle = mixColor(THEME.ground1, THEME.ground2, clamp(n * 1.4 - 0.2, 0, 1));
  ctx.fillRect(x, y, TP, TP);
  const groundArt = ART.ground;
  if (groundArt) ctx.drawImage(groundArt.img, x, y, TP, TP);
  else {
    for (let k = 0; k < 5; k++) {
      const h = hash2(i * 7 + k, j * 3 - k, 41);
      const px = x + hash2(i, j * 5 + k, 11) * (TP - 3), py = y + hash2(i * 3 + k, j, 13) * (TP - 3);
      ctx.fillStyle = h < 0.5 ? 'rgba(70,35,15,0.16)' : 'rgba(255,235,200,0.13)';
      ctx.fillRect(px, py, h < 0.25 ? 3 : 2, 2);
    }
  }

  if (terr === T_WATER) {
    if (ART.water) ctx.drawImage(ART.water.img, x, y, TP, TP);
    else {
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
    if (ART.rock) ctx.drawImage(ART.rock.img, x, y, TP, TP);
    else {
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

  if (S.road[t]) drawRoad(ctx, i, j, x, y);
  if (S.res[t]) drawResource(ctx, S.res[t], S.amt[t], S.grow[t], x + TP / 2, y + TP / 2, TP, i, j);
}

function drawRoad(ctx, i, j, x, y) {
  const c = TP / 2, w = 9;
  const nb = [[0, -1], [1, 0], [0, 1], [-1, 0]].map(([di, dj]) => inMap(i + di, j + dj) && S.road[tIdx(i + di, j + dj)]);
  for (const [col, ww] of [[THEME.roadEdge, w + 4], [THEME.road, w]]) {
    ctx.fillStyle = col;
    ctx.beginPath();
    ctx.arc(x + c, y + c, ww / 2, 0, Math.PI * 2);
    ctx.fill();
    if (nb[0]) ctx.fillRect(x + c - ww / 2, y, ww, c);
    if (nb[1]) ctx.fillRect(x + c, y + c - ww / 2, c, ww);
    if (nb[2]) ctx.fillRect(x + c - ww / 2, y + c, ww, c);
    if (nb[3]) ctx.fillRect(x, y + c - ww / 2, c, ww);
  }
  ctx.fillStyle = 'rgba(120,80,40,0.25)';
  ctx.fillRect(x + c - 1 + hash2(i, j, 8) * 3, y + c - 2, 2, 2);
}

/* ------------------------------------------------------------------ resources */

function drawResource(ctx, type, amt, grow, cx, cy, s, i, j) {
  const art = ART[RES[type].key];
  if (art) {
    const sc = type === R_STALK ? 0.5 + 0.5 * grow : 0.6 + 0.4 * (amt / RES[type].amount);
    ctx.globalAlpha = type === R_STALK && grow < 1 ? 0.85 : 1;
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
    const n = Math.ceil(amt / 2);
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
    if (!ART[type + '@' + owner]) {
      ctx.fillStyle = color;
      ctx.globalAlpha = 0.5;
      ctx.beginPath(); ctx.ellipse(cx, cy + s * 0.35, s * 0.42, s * 0.14, 0, 0, Math.PI * 2); ctx.fill();
      ctx.globalAlpha = 1;
    }
    // Turret art is drawn barrel-right and rotated to aim; everything else is drawn as-is.
    drawArt(ctx, art, cx, cy, s * (type === 'lander' && !art.scale ? 1.6 : 1), type === 'turret' && b ? b.aim : 0);
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
  const art = artFor(u.type, u.owner);
  const bob = u.busy ? Math.sin(R.time * 18 + u.id) * s * 0.03 : 0;
  if (art) {
    drawArt(ctx, art, sx, sy + bob, s * (u.type === 'warbot' ? 0.6 : 0.5), u.face);
  } else if (u.type === 'worker') {
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
  if (u.carry) {
    const c = s * 0.1;
    ctx.fillStyle = '#1b1e25';
    ctx.fillRect(sx - c - 1, sy - s * 0.3 - c - 1 + bob, c * 2 + 2, c * 2 + 2);
    ctx.fillStyle = GOOD[u.carry].color;
    ctx.fillRect(sx - c, sy - s * 0.3 - c + bob, c * 2, c * 2);
  }
  if (u.hp < u.maxHp) {
    const w = s * 0.4;
    ctx.fillStyle = 'rgba(0,0,0,0.6)';
    ctx.fillRect(sx - w / 2, sy - s * 0.36, w, 3);
    ctx.fillStyle = u.hp / u.maxHp > 0.5 ? '#7bea6b' : '#ff6b5a';
    ctx.fillRect(sx - w / 2, sy - s * 0.36, (w * u.hp) / u.maxHp, 3);
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
  const ctx = R.ctx, z = R.cam.z;
  ctx.setTransform(R.dpr, 0, 0, R.dpr, 0, 0);
  ctx.fillStyle = '#120f14';
  ctx.fillRect(0, 0, R.w, R.h);
  if (!S || !R.map) return;
  flushDirtyTiles();
  updateTerritoryLayer();

  const ox = R.w / 2 - R.cam.x * z, oy = R.h / 2 - R.cam.y * z;
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
    if (R.time - R.overlay.at > 0.5) refreshOverlay(R.overlay.type);
    ctx.fillStyle = 'rgba(160,255,190,0.22)';
    for (let t = 0; t < S.W * S.H; t++) {
      if (!R.overlay.valid[t]) continue;
      const i = t % S.W, j = (t / S.W) | 0;
      if (!inView(i, j, 1)) continue;
      ctx.fillRect(ox + i * z + z * 0.12, oy + j * z + z * 0.12, z * 0.76, z * 0.76);
    }
  }
  if (R.mode === 'road') {
    ctx.strokeStyle = 'rgba(255,240,200,0.18)';
    ctx.lineWidth = 1;
    for (let t = 0; t < S.W * S.H; t++) {
      const i = t % S.W, j = (t / S.W) | 0;
      if (!inView(i, j, 1) || !canRoad(0, i, j)) continue;
      ctx.strokeRect(ox + i * z + 1.5, oy + j * z + 1.5, z - 3, z - 3);
    }
  }

  // Selection rings drawn under buildings
  const sel = getE(R.selected);
  if (sel) drawRanges(ctx, sel.type, sel.x, sel.y, ox, oy, z, sel.owner);
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
      if (e.paused) {
        ctx.fillStyle = 'rgba(0,0,0,0.65)';
        ctx.beginPath(); ctx.arc(cx + z * 0.3, cy - z * 0.3, z * 0.16, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#fff';
        ctx.fillRect(cx + z * 0.25, cy - z * 0.38, z * 0.035, z * 0.16);
        ctx.fillRect(cx + z * 0.32, cy - z * 0.38, z * 0.035, z * 0.16);
      }
    } else {
      const jx = (hash2(e.id, 1, 9) - 0.5) * 0.25, jy = (hash2(e.id, 2, 9) - 0.5) * 0.25;
      drawBot(ctx, e, ox + (e.x + jx) * z, oy + (e.y + jy) * z, z);
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
  if (R.selTile >= 0) {
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2;
    ctx.strokeRect(ox + (R.selTile % S.W) * z + 1, oy + ((R.selTile / S.W) | 0) * z + 1, z - 2, z - 2);
  }

  drawEffects(ctx, ox, oy, z);
}

function drawRanges(ctx, type, x, y, ox, oy, z, owner) {
  const def = BDEFS[type];
  const r = def.gather || def.plant ? def.radius + 0.5 : def.range ? def.range : def.mil ? def.terr : 0;
  if (!r) return;
  const cx = ox + (x + 0.5) * z, cy = oy + (y + 0.5) * z;
  ctx.fillStyle = def.range ? 'rgba(255,90,90,0.10)' : 'rgba(255,255,255,0.09)';
  ctx.strokeStyle = def.range ? 'rgba(255,140,140,0.7)' : 'rgba(255,255,255,0.65)';
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

function drawEffects(ctx, ox, oy, z) {
  for (const f of S.fx) {
    const k = f.t / f.life;
    const x = ox + f.x * z, y = oy + f.y * z;
    switch (f.type) {
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
  drawBuilding(ctx, type, size / 2, size / 2 + (type === 'lander' ? 0 : size * 0.02), type === 'lander' ? size * 0.55 : size * 0.86, owner || 0,
    { built: true, garrison: [], aim: -Math.PI / 4 });
  return c.toDataURL();
}

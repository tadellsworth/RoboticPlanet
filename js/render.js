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

/* ------------------------------------------------------------------ biomes */

/**
 * How each biome looks. Ground, water and rock use the biome's own art (ground-jungle and so on)
 * when it exists, otherwise the Red desert textures recoloured with `tex` (dark, mid, light).
 */
const BIOME_LOOK = {
  desert: {
    level: [['#7a462d', '#93593a'], ['#ad6f47', '#c99a66'], ['#c88d5a', '#e0b07a'], ['#d7a46e', '#ecc28c'], ['#e3b781', '#f5d3a0']],
    theme: {},
    hi: '255,236,205', lo: 'rgba(45,22,10,0.26)',
    grain: ['rgba(62,32,14,0.2)', 'rgba(255,238,212,0.18)', 'rgba(238,214,180,0.55)', 'rgba(40,20,8,0.3)'],
    mm: { ground: [169, 113, 74], water: [28, 75, 93], rock: [74, 51, 41], ramp: [235, 205, 150] },
  },
  jungle: {
    level: [['#22301a', '#2c3d20'], ['#33492a', '#425d31'], ['#40592f', '#516f3a'], ['#4d6a36', '#5f8043'], ['#5b7a40', '#6f914e']],
    theme: { cliffTop: '#33402a', cliffBottom: '#1b2215', slope: '#7b8a52', water: '#22402f', waterEdge: '#3d6a4a',
      rock: '#2b3329', rockTop: '#3a4636', rockHi: '#55664c', rockShadow: '#161c15' },
    tex: { ground: ['#1f2a14', '#3f5726', '#7f9a4c'], water: ['#16281d', '#2f5240', '#6f9478'], rock: ['#15190f', '#33402c', '#6b7d5d'] },
    // The jungle art is very dark: lift the ground to a lighter moss green (and the water to a clear
    // teal) so roads, plants, resources and bots stand out. Rock and cliffs stay dark for contrast.
    adjust: { ground: { mul: [1.25, 1.5, 1.2], add: [44, 56, 38] }, water: { mul: [0.7, 1.1, 1.45], add: [10, 22, 32] } },
    hi: '220,255,190', lo: 'rgba(8,22,6,0.2)',
    grain: ['rgba(20,32,10,0.28)', 'rgba(200,230,150,0.14)', 'rgba(120,90,50,0.55)', 'rgba(10,18,6,0.35)'],
    mm: { ground: [66, 96, 46], water: [34, 64, 47], rock: [43, 51, 41], ramp: [123, 138, 82] },
  },
  polar: {
    level: [['#9fb0c2', '#aebfd0'], ['#c3d0dd', '#d3dee9'], ['#d6e0ea', '#e4ecf3'], ['#e2eaf2', '#eef3f8'], ['#ecf2f7', '#f8fbfd']],
    theme: { cliffTop: '#7d8b99', cliffBottom: '#4c5866', slope: '#e3eaf1', water: '#132a3f', waterEdge: '#2c5878',
      rock: '#5a6470', rockTop: '#727d8a', rockHi: '#a3aebb', rockShadow: '#323a44' },
    tex: { ground: ['#9fb2c6', '#d6e1ec', '#fbfdff'], water: ['#0a1a2a', '#1d4566', '#7fa9c8'], rock: ['#3b434d', '#6c7682', '#c3ccd6'] },
    hi: '255,255,255', lo: 'rgba(30,50,80,0.22)',
    grain: ['rgba(70,95,125,0.16)', 'rgba(255,255,255,0.45)', 'rgba(120,130,140,0.6)', 'rgba(40,60,90,0.25)'],
    mm: { ground: [214, 225, 236], water: [22, 52, 78], rock: [96, 106, 118], ramp: [227, 234, 241] },
  },
};
const THEME_DESERT = {};
const MM_DESERT = {};

/** Switch the palette, textures and minimap colours to the current game's biome (at every bake). */
function applyBiome() {
  const b = typeof biome === 'function' && S ? biome() : 'desert';
  const look = BIOME_LOOK[b] || BIOME_LOOK.desert;
  if (!THEME_DESERT.cliffTop) { Object.assign(THEME_DESERT, THEME); Object.assign(MM_DESERT, { ground: MM_COLORS.ground, water: MM_COLORS.water, rock: MM_COLORS.rock, ramp: MM_COLORS.ramp }); }
  Object.assign(THEME, THEME_DESERT, look.theme);
  Object.assign(MM_COLORS, MM_DESERT, look.mm);
  R.biome = b;
  R.look = look;
  R.tex = {};
  for (const k of ['ground', 'water', 'rock']) R.tex[k] = biomeTexture(b, k);
  R.tex.cliff = b === 'desert' ? ART.cliff || null : ART['cliff-' + b] || null;
  // The minimap takes its ground, water and rock colours from the textures themselves.
  for (const k of ['ground', 'water', 'rock']) { const c = R.tex[k] && avgColor(R.tex[k]); if (c) MM_COLORS[k] = c; }
}

/** The average colour of an art image, [r, g, b] (or null if it can't be read). */
function avgColor(art) {
  if (art.avg !== undefined) return art.avg;
  try {
    const c = document.createElement('canvas');
    c.width = c.height = 8;
    const x = c.getContext('2d');
    x.imageSmoothingQuality = 'high';
    x.drawImage(art.img, 0, 0, 8, 8);
    const d = x.getImageData(0, 0, 8, 8).data;
    let r = 0, g = 0, bl = 0;
    for (let k = 0; k < 64; k++) { r += d[k * 4]; g += d[k * 4 + 1]; bl += d[k * 4 + 2]; }
    art.avg = [Math.round(r / 64), Math.round(g / 64), Math.round(bl / 64)];
  } catch (e) { art.avg = null; }
  return art.avg;
}

/** The biome's own texture, or the desert one recoloured to suit (made once and kept). */
function biomeTexture(b, kind) {
  if (b === 'desert') return ART[kind] || null;
  const own = ART[kind + '-' + b], adj = BIOME_LOOK[b].adjust && BIOME_LOOK[b].adjust[kind];
  if (own && !adj) return own;
  const src = own || ART[kind], stops = !own && BIOME_LOOK[b].tex && BIOME_LOOK[b].tex[kind];
  if (!src || !(stops || adj)) return null;
  R.texCache = R.texCache || {};
  const key = b + ':' + kind;
  if (R.texCache[key] && R.texCache[key].from === src.img) return R.texCache[key];
  if (own) return (R.texCache[key] = adjustArt(own, adj));
  const img = src.img, w = img.width, h = img.height;
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const x = c.getContext('2d');
  x.drawImage(img, 0, 0);
  let d;
  try { d = x.getImageData(0, 0, w, h); } catch (e) { return null; }
  const px = d.data, n = w * h, L = new Float32Array(n);
  let lo = 255, hi = 0;
  for (let k = 0; k < n; k++) { const l = 0.3 * px[k * 4] + 0.59 * px[k * 4 + 1] + 0.11 * px[k * 4 + 2]; L[k] = l; if (l < lo) lo = l; if (l > hi) hi = l; }
  const rgb = stops.map((s) => [parseInt(s.slice(1, 3), 16), parseInt(s.slice(3, 5), 16), parseInt(s.slice(5, 7), 16)]);
  for (let k = 0; k < n; k++) {
    const f = hi > lo ? (L[k] - lo) / (hi - lo) : 0.5, a = f < 0.5 ? rgb[0] : rgb[1], b2 = f < 0.5 ? rgb[1] : rgb[2], g = f < 0.5 ? f * 2 : f * 2 - 1;
    px[k * 4] = a[0] + (b2[0] - a[0]) * g; px[k * 4 + 1] = a[1] + (b2[1] - a[1]) * g; px[k * 4 + 2] = a[2] + (b2[2] - a[2]) * g;
  }
  x.putImageData(d, 0, 0);
  return (R.texCache[key] = { img: c, scale: 0, anchor: '', from: img });
}

/** A copy of an art image with each colour channel scaled and lifted: { mul: [r, g, b], add: [r, g, b] }. */
function adjustArt(art, adj) {
  const img = art.img, w = img.width, h = img.height;
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const x = c.getContext('2d');
  x.drawImage(img, 0, 0);
  try {
    const d = x.getImageData(0, 0, w, h), px = d.data;
    for (let k = 0; k < px.length; k += 4) for (let ch = 0; ch < 3; ch++) px[k + ch] = px[k + ch] * adj.mul[ch] + adj.add[ch];
    x.putImageData(d, 0, 0);
  } catch (e) { return art; }
  return { img: c, scale: art.scale || 0, anchor: art.anchor || '', from: img };
}

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
      // The third team (green) gets the rival's red art recoloured, made the first time it's asked for.
      if (key.includes('@1')) {
        const k2 = key.replace('@1', '@2');
        if (!Object.prototype.hasOwnProperty.call(ART, k2)) {
          Object.defineProperty(ART, k2, {
            configurable: true, enumerable: false,
            get() { const v = recolorArt(ART[key], ART[key.replace('@1', '@0')]); Object.defineProperty(ART, k2, { value: v, writable: true, configurable: true, enumerable: false }); return v; },
          });
        }
      }
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

/**
 * The green team's art, made from the other two teams' versions: wherever the red (@1) and cyan
 * (@0) versions differ (the team lights, stripes and glow), the cyan pixel is turned green;
 * everything else is left as it is. Without a cyan version, strongly red pixels are turned green.
 */
function recolorArt(red, cyan) {
  if (!red) return null;
  const img = red.img, w = img.width, h = img.height;
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const x = c.getContext('2d');
  x.drawImage(img, 0, 0);
  try {
    const d = x.getImageData(0, 0, w, h), px = d.data;
    let cy = null;
    if (cyan && cyan.img.width === w && cyan.img.height === h) {
      const c2 = document.createElement('canvas');
      c2.width = w; c2.height = h;
      const x2 = c2.getContext('2d');
      x2.drawImage(cyan.img, 0, 0);
      cy = x2.getImageData(0, 0, w, h).data;
    }
    for (let k = 0; k < px.length; k += 4) {
      if (px[k + 3] < 8) continue;
      let r = px[k], g = px[k + 1], b = px[k + 2], f;
      if (cy) {
        const diff = Math.abs(r - cy[k]) + Math.abs(g - cy[k + 1]) + Math.abs(b - cy[k + 2]);
        if (diff < 40) continue;
        // Start from the cyan pixel: cyan-blue light becomes green light of the same brightness.
        r = cy[k]; g = cy[k + 1]; b = cy[k + 2];
        f = Math.min(1, (diff - 40) / 80);
        const v = Math.max(r, g, b), lo = Math.min(r, g, b);
        const ng = v, nr = lo + (v - lo) * 0.38, nb = lo + (v - lo) * 0.3;
        px[k] = px[k] + (nr - px[k]) * f; px[k + 1] = px[k + 1] + (ng - px[k + 1]) * f; px[k + 2] = px[k + 2] + (nb - px[k + 2]) * f;
        px[k + 3] = px[k + 3] + (cy[k + 3] - px[k + 3]) * f;
      } else {
        if (r < 80 || r < g * 1.55 || r < b * 1.1) continue;
        const mn = Math.min(g, b), sat = (r - mn) / r;
        if (sat < 0.35) continue;
        f = Math.min(1, (sat - 0.35) / 0.25);
        const ng = r * 0.92, nr = mn + (r - mn) * 0.32, nb = mn + (r - mn) * 0.38;
        px[k] = r + (nr - r) * f; px[k + 1] = g + (ng - g) * f; px[k + 2] = b + (nb - b) * f;
      }
    }
    x.putImageData(d, 0, 0);
  } catch (e) { return red; }
  return { img: c, scale: red.scale, anchor: red.anchor, shadow: red.shadow };
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
  const img = artMip(art, s * (R.drawScale || 1));
  if (Array.isArray(art.anchor) && !angle) {
    ctx.drawImage(img, cx - art.anchor[0] * s, cy - art.anchor[1] * s, s, s);
    return;
  }
  if (art.anchor === 'bottom' && !angle) cy += (sizePx - s) / 2;
  if (angle) {
    ctx.save(); ctx.translate(cx, cy); ctx.rotate(angle);
    ctx.drawImage(img, -s / 2, -s / 2, s, s);
    ctx.restore();
  } else ctx.drawImage(img, cx - s / 2, cy - s / 2, s, s);
}

/**
 * The copy of an art image to draw at `px` device pixels wide. Big images shrunk a long way in one
 * step come out jagged and shimmer as they move, so each image keeps a chain of half-size copies
 * (made once, smoothly) and draws from the smallest one that is still at least as big as needed.
 */
function artMip(art, px) {
  const img = art.img;
  if (px >= img.width * 0.75 || img.width < 64) return img;
  if (!art.mips) {
    art.mips = [];
    let src = img, w = img.width, h = img.height;
    while (w >= 48) {
      w = Math.round(w / 2); h = Math.round(h / 2);
      const c = document.createElement('canvas');
      c.width = w; c.height = h;
      const cx = c.getContext('2d');
      cx.imageSmoothingQuality = 'high';
      cx.drawImage(src, 0, 0, w, h);
      art.mips.push(c);
      src = c;
    }
  }
  let best = img;
  for (const m of art.mips) { if (m.width >= px) best = m; else break; }
  return best;
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

// Drawing resolution. Retina screens draw at up to 2x, but never more than R.budget pixels (about a
// 4K screen's worth): a 5K iMac at 2x would be 15 million pixels a frame, four times the work, and
// drop to a few frames a second. If frames still come slowly, watchFrameRate lowers the budget.
const RENDER_BUDGET = 8.3e6;

function resizeRender() {
  // Installed web apps on iPhone sometimes report a viewport shorter than the screen; take the
  // largest of the measurements so the map always reaches the bottom edge.
  const vv = window.visualViewport;
  R.w = Math.max(window.innerWidth, document.documentElement.clientWidth);
  R.h = Math.max(window.innerHeight, document.documentElement.clientHeight, vv ? Math.round(vv.height) : 0);
  const fit = Math.sqrt((R.budget || RENDER_BUDGET) / Math.max(1, R.w * R.h));
  R.dpr = Math.min(2, window.devicePixelRatio || 1, Math.max(1, fit));
  R.canvas.width = Math.round(R.w * R.dpr);
  R.canvas.height = Math.round(R.h * R.dpr);
  R.canvas.style.width = R.w + 'px';
  R.canvas.style.height = R.h + 'px';
  if (S) clampCam();
}

/**
 * Called every frame with the milliseconds since the last one. If the game runs below about 45
 * frames a second for a couple of seconds while drawing at more than 1x, draw at a lower
 * resolution (never below 1x; the buttons and text stay sharp, they aren't on the canvas).
 */
function watchFrameRate(ms) {
  const fw = R.fw || (R.fw = { n: 0, sum: 0 });
  if (ms > 250 || document.hidden) { fw.n = 0; fw.sum = 0; return; }
  fw.n++; fw.sum += ms;
  if (fw.n < 120) return;
  const avg = fw.sum / fw.n;
  fw.n = 0; fw.sum = 0;
  if (avg > 22 && R.dpr > 1.05) {
    R.budget = Math.max(R.w * R.h, R.w * R.h * R.dpr * R.dpr * 0.6);
    resizeRender();
  }
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
  R.skyFloor = !!(S.settings && SHAPE_PRESETS[S.settings.shape || 0] && SHAPE_PRESETS[S.settings.shape || 0].sky);
  applyBiome();
  R.map = document.createElement('canvas');
  R.map.width = S.W * TP;
  R.map.height = S.H * TP;
  R.mapCtx = R.map.getContext('2d');
  R.mapCtx.hdScale = 1;
  hdReset();
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
  const chunks = R.hd ? [...R.hd.chunks.values()] : [];
  for (const t of S.dirtyTiles) {
    if (seen.has(t)) continue;
    seen.add(t);
    const i = t % S.W, j = (t / S.W) | 0;
    drawTile(i, j);
    for (const ch of chunks) if (i >= ch.i0 && i < ch.i0 + HD_CHUNK && j >= ch.j0 && j < ch.j0 + HD_CHUNK) drawTile(i, j, ch.ctx);
  }
  S.dirtyTiles.length = 0;
}

/* ------------------------------------------------------------------ sharp map (HD chunks) */

// The whole map is baked once at TP pixels a tile, which is cheap to draw zoomed out. Zoomed in, the
// part on screen is baked again in chunks at 64 or 128 pixels a tile, so resources, roads, cliffs and
// plants stay sharp instead of being stretched. Chunks are made a few at a time, nearest the middle
// of the screen first, and the least recently seen are dropped to keep memory in check.
const HD_CHUNK = 8;      // tiles along each side of a chunk
const HD_SPARE = 10e6;   // pixels of off-screen chunks kept for when you pan back
const HD_BAKE_MS = 6;    // baking time allowed per frame

function hdReset() {
  if (R.hd) for (const ch of R.hd.chunks.values()) ch.c.width = 0;
  R.hd = { chunks: new Map(), px: 0, frame: 0 };
}

/** Pixels a tile for the sharp map at this zoom (0: the whole-map bake is sharp enough). */
function hdLevel(z) {
  const px = z * R.dpr;
  return px <= TP * 1.2 ? 0 : px <= 64 * 1.25 ? 64 : 128;
}

function hdBake(level, cx, cy) {
  const n = HD_CHUNK * level, k = level / TP;
  const c = document.createElement('canvas');
  c.width = n; c.height = n;
  const ctx = c.getContext('2d');
  ctx.hdScale = k;
  ctx.setTransform(k, 0, 0, k, -cx * n, -cy * n);
  const i0 = cx * HD_CHUNK, j0 = cy * HD_CHUNK;
  // One tile of margin, so plants and resources leaning over the chunk's edge aren't cut off.
  for (let j = j0 - 1; j <= j0 + HD_CHUNK; j++) for (let i = i0 - 1; i <= i0 + HD_CHUNK; i++) if (inMap(i, j)) drawTile(i, j, ctx);
  return { c, ctx, level, i0, j0, used: 0 };
}

/** Draw the baked ground: the whole-map bake, with sharp chunks over it when zoomed in. */
function drawMapLayer(ctx, ox, oy, z) {
  ctx.imageSmoothingEnabled = true;
  ctx.drawImage(R.map, ox, oy, S.W * z, S.H * z);
  const level = hdLevel(z);
  if (!level) return;
  if (!R.hd) hdReset();
  const hd = R.hd, C = HD_CHUNK, d = R.dpr;
  hd.frame++;
  const v0 = screenToWorld(0, 0), v1 = screenToWorld(R.w, R.h);
  const nx = Math.ceil(S.W / C), ny = Math.ceil(S.H / C);
  const cx0 = Math.floor(v0.x / C), cx1 = Math.floor(v1.x / C), cy0 = Math.floor(v0.y / C), cy1 = Math.floor(v1.y / C);
  const key = (lv, cx, cy) => (lv * 4096 + cy) * 4096 + cx;
  const draw = (ch) => {
    // Snap to whole device pixels so neighbouring chunks meet without a seam.
    const x0 = Math.round((ox + ch.i0 * z) * d) / d, y0 = Math.round((oy + ch.j0 * z) * d) / d;
    const x1 = Math.round((ox + (ch.i0 + C) * z) * d) / d, y1 = Math.round((oy + (ch.j0 + C) * z) * d) / d;
    ctx.drawImage(ch.c, x0, y0, x1 - x0, y1 - y0);
  };
  const todo = [], ring = [];
  for (let cy = cy0 - 1; cy <= cy1 + 1; cy++) for (let cx = cx0 - 1; cx <= cx1 + 1; cx++) {
    if (cx < 0 || cy < 0 || cx >= nx || cy >= ny) continue;
    const onScreen = cx >= cx0 && cx <= cx1 && cy >= cy0 && cy <= cy1;
    const ch = hd.chunks.get(key(level, cx, cy));
    if (ch) { if (onScreen) { ch.used = hd.frame; draw(ch); } continue; }
    if (!onScreen) { ring.push([cx, cy]); continue; }
    // Not made yet: show the other sharpness level meanwhile, if there is one.
    const alt = hd.chunks.get(key(level === 64 ? 128 : 64, cx, cy));
    if (alt) { alt.used = hd.frame; draw(alt); }
    todo.push([cx, cy]);
  }
  const mx = R.cam.x / C - 0.5, my = R.cam.y / C - 0.5;
  const near = (a, b) => Math.hypot(a[0] - mx, a[1] - my) - Math.hypot(b[0] - mx, b[1] - my);
  todo.sort(near); ring.sort(near);
  const t0 = performance.now(), size = (C * level) ** 2;
  for (const [cx, cy] of todo) {
    if (performance.now() - t0 > HD_BAKE_MS) break;
    const ch = hdBake(level, cx, cy);
    ch.used = hd.frame;
    hd.chunks.set(key(level, cx, cy), ch);
    hd.px += size;
    draw(ch);
  }
  // Spare time: get the chunks just off screen ready for panning.
  let spare = 0;
  for (const ch of hd.chunks.values()) if (ch.used !== hd.frame) spare += ch.c.width * ch.c.height;
  for (const [cx, cy] of ring) {
    if (performance.now() - t0 > HD_BAKE_MS || spare + size > HD_SPARE) break;
    const ch = hdBake(level, cx, cy);
    ch.used = hd.frame - 1;
    hd.chunks.set(key(level, cx, cy), ch);
    hd.px += size; spare += size;
  }
  // Drop the least recently seen off-screen chunks beyond the allowance.
  if (spare > HD_SPARE) {
    const old = [...hd.chunks.entries()].filter(([, ch]) => ch.used < hd.frame - 1).sort((a, b) => a[1].used - b[1].used);
    for (const [k, ch] of old) {
      if (spare <= HD_SPARE) break;
      const px = ch.c.width * ch.c.height;
      spare -= px; hd.px -= px;
      ch.c.width = 0;
      hd.chunks.delete(k);
    }
  }
}

function terrAt(i, j) { return inMap(i, j) ? S.terrain[tIdx(i, j)] : T_ROCK; }

function levelColor(e, n) {
  const lv = (R.look && R.look.level) || LEVEL_GROUND;
  const pal = lv[clamp(e + (R.levelOffset || 0), 0, lv.length - 1)];
  return mixColor(pal[0], pal[1], clamp(n * 1.4 - 0.2, 0, 1));
}

/** Draw tile (i, j) of the baked map into ctx (the whole-map canvas, or a sharp chunk). */
function drawTile(i, j, ctx = R.mapCtx) {
  const prev = R.drawScale;
  R.drawScale = ctx.hdScale || 1;
  paintTile(ctx, i, j);
  R.drawScale = prev;
}

function paintTile(ctx, i, j) {
  const x = i * TP, y = j * TP, t = tIdx(i, j);
  const terr = S.terrain[t];
  const n = fbm(i / 6, j / 6, 991, 3);
  ctx.fillStyle = levelColor(S.elev[t], n);
  ctx.fillRect(x, y, TP, TP);
  const tex = R.tex || {}, look = R.look || BIOME_LOOK.desert;
  if (tex.ground) {
    drawTexture(ctx, tex.ground, i, j, x, y);
    // Keep elevation readable on top of the texture: higher ground is lighter, canyons darker.
    const d = S.elev[t] + (R.levelOffset || 0) - 1;
    if (d > 0) { ctx.fillStyle = `rgba(${look.hi},${Math.min(0.34, 0.1 * d)})`; ctx.fillRect(x, y, TP, TP); }
    else if (d < 0) { ctx.fillStyle = look.lo; ctx.fillRect(x, y, TP, TP); }
  } else {
    for (let k = 0; k < 5; k++) {
      const h = hash2(i * 7 + k, j * 3 - k, 41);
      const px = x + hash2(i, j * 5 + k, 11) * (TP - 3), py = y + hash2(i * 3 + k, j, 13) * (TP - 3);
      ctx.fillStyle = h < 0.5 ? 'rgba(70,35,15,0.16)' : 'rgba(255,235,200,0.13)';
      ctx.fillRect(px, py, h < 0.25 ? 3 : 2, 2);
    }
  }

  if (terr === T_WATER) {
    if (tex.water) {
      drawTexture(ctx, tex.water, i, j, x, y);
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
  } else if (terr === T_CHASM) {
    drawChasm(ctx, i, j, x, y);
  } else if (terr === T_ROCK) {
    if (tex.rock) {
      drawTexture(ctx, tex.rock, i, j, x, y);
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

  // Fine grain stands in for detail the ground texture lacks (none needed with 512 px art).
  if (terr === T_GROUND && !S.road[t] && !(tex.ground && tex.ground.img.width >= 256)) drawGrain(ctx, i, j, x, y);
  // Sky islands: the canyon floor lies far below the mesas, in their shade.
  if (terr !== T_WATER && S.elev[t] <= 1 && R.skyFloor) { ctx.fillStyle = S.elev[t] ? 'rgba(20,10,6,0.2)' : 'rgba(20,10,6,0.32)'; ctx.fillRect(x, y, TP, TP); }
  if (terr === T_GROUND) drawElevation(ctx, i, j, x, y, t, n);
  else if (terr === T_WATER) drawCliffFace(ctx, i, j, x, y, t, true);
  if (terr === T_GROUND && S.fert && S.fert[t] && !S.ramp[t]) drawFertile(ctx, i, j, x, y);
  if (S.decor && S.decor[t] && !S.road[t] && !S.res[t] && !S.plan[t] && !S.bAt[t]) drawPlant(ctx, S.decor[t], i, j, x, y);
  if (S.road[t]) { if (terr === T_GROUND) drawRoad(ctx, i, j, x, y); else drawCrossing(ctx, i, j, x, y, t); }
  if (S.rail && S.rail[t]) { if (!S.road[t] && bridgeable(t)) drawBridge(ctx, i, j, x, y, t, true); drawRail(ctx, i, j, x, y, t); }
  if (S.res[t]) {
    drawResource(ctx, S.res[t], S.amt[t], S.grow[t], x + TP / 2, y + TP / 2, TP, i, j);
    if (richRes(t)) drawGlint(ctx, x, y, i, j);
  }
}

/**
 * A decorative plant on open ground: the biome's art (plant-<biome>-1 …) if there is any, otherwise
 * a simple drawn stand-in. Each tile's plant sits a little off-centre at its own size.
 */
function drawPlant(ctx, v, i, j, x, y) {
  const b = R.biome || 'desert', sd = 911;
  let n = 0;
  while (ART[`plant-${b}-${n + 1}`]) n++;
  if (n) {
    // The art is centred with its shadow baked in: a small nudge and size change per tile, kept
    // inside the tile so neighbouring tiles never cut it off.
    const ax = x + TP / 2 + (hash2(i, j, sd) - 0.5) * TP * 0.1, ay = y + TP / 2 + (hash2(j, i, sd + 1) - 0.5) * TP * 0.1;
    drawArt(ctx, ART[`plant-${b}-${((v - 1) % n) + 1}`], ax, ay, TP * (0.84 + hash2(i, j, sd + 2) * 0.14));
    return;
  }
  const cx = x + TP / 2 + (hash2(i, j, sd) - 0.5) * TP * 0.22, cy = y + TP / 2 + (hash2(j, i, sd + 1) - 0.5) * TP * 0.22;
  const sc = 0.78 + hash2(i, j, sd + 2) * 0.3;
  const u = (TP / 32) * sc, h = (k) => hash2(i * 7 + k, j * 11 - k, sd + 3);
  const P = (fill, f) => { ctx.fillStyle = fill; ctx.beginPath(); f(); ctx.fill(); };
  const E = (ex, ey, rx, ry, rot) => ctx.ellipse(ex, ey, rx, ry, rot || 0, 0, Math.PI * 2);
  const shadow = (r, a) => P(`rgba(0,0,0,${a || 0.2})`, () => E(cx + 1.8 * u, cy + 2 * u, r * u, r * 0.6 * u));
  const leaf = (ang, len, wid, fill) => P(fill, () => E(cx + Math.cos(ang) * len * 0.5 * u, cy + Math.sin(ang) * len * 0.5 * u, len * 0.5 * u, wid * u, ang));
  const line = (col, w, pts) => { ctx.strokeStyle = col; ctx.lineWidth = w * u; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(cx + pts[0] * u, cy + pts[1] * u); for (let k = 2; k < pts.length; k += 2) ctx.lineTo(cx + pts[k] * u, cy + pts[k + 1] * u); ctx.stroke(); };
  const rot = h(0) * Math.PI * 2;
  if (b === 'jungle') {
    if (v === 1) { // fern
      shadow(9);
      for (let k = 0; k < 7; k++) { const a = rot + k * 0.9; leaf(a, 11, 2.2, '#2c5426'); line('rgba(150,190,110,0.5)', 0.5, [0, 0, Math.cos(a) * 10, Math.sin(a) * 10]); }
    } else if (v === 2) { // giant leaves
      shadow(9);
      for (let k = 0; k < 5; k++) { const a = rot + k * 1.25; leaf(a, 12, 4, k % 2 ? '#56692e' : '#4b5f28'); line('rgba(120,30,40,0.55)', 0.6, [0, 0, Math.cos(a) * 11, Math.sin(a) * 11]); }
    } else if (v === 3) { // flowering shrub
      shadow(8);
      for (let k = 0; k < 6; k++) P(k % 2 ? '#2f5a2b' : '#3c6b33', () => E(cx + (h(k) - 0.5) * 9 * u, cy + (h(k + 6) - 0.5) * 8 * u, 4.4 * u, 3.8 * u));
      for (let k = 0; k < 5; k++) P(k % 2 ? '#e0559a' : '#f29a3a', () => E(cx + (h(k + 20) - 0.5) * 10 * u, cy + (h(k + 30) - 0.5) * 8 * u, 1.3 * u, 1.3 * u));
    } else if (v === 4) { // small tree canopy
      shadow(11, 0.28);
      P('#244a24', () => E(cx, cy, 10 * u, 9 * u));
      for (let k = 0; k < 5; k++) P('#356b32', () => E(cx + (h(k) - 0.6) * 8 * u, cy + (h(k + 5) - 0.6) * 7 * u, 4.5 * u, 4 * u));
      P('rgba(150,200,110,0.35)', () => E(cx - 3 * u, cy - 3 * u, 3.5 * u, 2.6 * u));
    } else if (v === 5) { // moss mat with spore heads
      P('rgba(0,0,0,0.12)', () => E(cx + 1 * u, cy + 1.2 * u, 9 * u, 6 * u));
      for (let k = 0; k < 4; k++) P('#45622a', () => E(cx + (h(k) - 0.5) * 8 * u, cy + (h(k + 4) - 0.5) * 5 * u, 5 * u, 3.4 * u));
      for (let k = 0; k < 7; k++) P('#b5c94a', () => E(cx + (h(k + 10) - 0.5) * 12 * u, cy + (h(k + 17) - 0.5) * 7 * u, 0.8 * u, 0.8 * u));
    } else { // vines with pitcher pods
      shadow(8);
      line('#3c5a26', 1.3, [-9, 3, -4, -2, 1, 2, 6, -3, 9, 1]);
      line('#34502a', 1.1, [-7, -5, -2, 0, 4, 5]);
      for (let k = 0; k < 2; k++) { const px = (k ? 5 : -3) * u, py = (k ? -1 : 3) * u; P('#8a6b3a', () => E(cx + px, cy + py, 2.4 * u, 3.2 * u)); P('#2a1c10', () => E(cx + px, cy + py - 1.6 * u, 1.5 * u, 0.9 * u)); }
    }
  } else if (b === 'polar') {
    if (v === 1) { // frost-rimed shrub
      shadow(7);
      for (let k = 0; k < 7; k++) { const a = rot + k * 0.9, l = 6 + h(k) * 4; line('#5f7184', 1.1, [0, 0, Math.cos(a) * l, Math.sin(a) * l]); P('#eef6ff', () => E(cx + Math.cos(a) * l * u, cy + Math.sin(a) * l * u, 1.1 * u, 1.1 * u)); }
    } else if (v === 2) { // snow drift with grass
      P('rgba(60,85,120,0.25)', () => E(cx + 1.5 * u, cy + 2 * u, 8 * u, 4.5 * u));
      P('#f6f9fc', () => E(cx, cy, 8 * u, 4.5 * u));
      for (let k = 0; k < 5; k++) line('#a08a5e', 0.7, [(h(k) - 0.5) * 9, 1, (h(k) - 0.5) * 9 + (h(k + 5) - 0.5) * 3, -5 - h(k + 9) * 3]);
    } else if (v === 3) { // conifer seen from above
      shadow(9, 0.26);
      for (let k = 0; k < 8; k++) { const a = rot + k * Math.PI / 4; P('#1f3b2b', () => { ctx.moveTo(cx + Math.cos(a - 0.35) * 3 * u, cy + Math.sin(a - 0.35) * 3 * u); ctx.lineTo(cx + Math.cos(a) * 9 * u, cy + Math.sin(a) * 9 * u); ctx.lineTo(cx + Math.cos(a + 0.35) * 3 * u, cy + Math.sin(a + 0.35) * 3 * u); }); }
      P('#2c5039', () => E(cx, cy, 3.5 * u, 3.5 * u));
      for (let k = 0; k < 6; k++) P('rgba(245,250,255,0.85)', () => E(cx + (h(k) - 0.5) * 12 * u, cy + (h(k + 6) - 0.5) * 12 * u, 1.2 * u, 0.9 * u));
    } else if (v === 4) { // lichen-covered stone
      shadow(7, 0.25);
      P('#868d96', () => E(cx, cy, 6.5 * u, 5 * u));
      P('#a4abb4', () => E(cx - 1.5 * u, cy - 1.5 * u, 4 * u, 2.8 * u));
      for (let k = 0; k < 4; k++) P(k % 2 ? '#b9a3c9' : '#c27a4a', () => E(cx + (h(k) - 0.5) * 8 * u, cy + (h(k + 4) - 0.5) * 6 * u, 1.4 * u, 1.1 * u));
      P('rgba(250,252,255,0.9)', () => E(cx - 1 * u, cy - 3.6 * u, 3.4 * u, 1.2 * u));
    } else if (v === 5) { // frozen reeds
      shadow(6, 0.16);
      for (let k = 0; k < 6; k++) { const bx = (h(k) - 0.5) * 8, l = 6 + h(k + 6) * 4; line('#8d9a82', 0.9, [bx, 3, bx + (h(k + 12) - 0.5) * 3, 3 - l]); line('rgba(240,248,255,0.9)', 0.6, [bx, 1, bx + (h(k + 12) - 0.5) * 2, 1 - l * 0.5]); }
    } else { // frost flower
      P('rgba(60,90,130,0.18)', () => E(cx + 1 * u, cy + 1.5 * u, 6 * u, 4 * u));
      for (let k = 0; k < 6; k++) leaf(rot + k * Math.PI / 3, 8, 2, '#cfe6f6');
      P('#ffffff', () => E(cx, cy, 2 * u, 2 * u));
    }
  } else {
    if (v === 1) { // lichen crust
      for (let k = 0; k < 5; k++) P(k % 2 ? 'rgba(150,62,38,0.6)' : 'rgba(190,110,58,0.5)', () => E(cx + (h(k) - 0.5) * 10 * u, cy + (h(k + 5) - 0.5) * 7 * u, (2.5 + h(k + 9) * 2.5) * u, (1.8 + h(k + 13) * 1.6) * u, h(k) * 3));
    } else if (v === 2) { // spiny succulent rosette
      shadow(7);
      for (let k = 0; k < 8; k++) { const a = rot + k * Math.PI / 4; P(k % 2 ? '#6b2f2a' : '#7a3a2c', () => { ctx.moveTo(cx + Math.cos(a - 0.5) * 1.5 * u, cy + Math.sin(a - 0.5) * 1.5 * u); ctx.lineTo(cx + Math.cos(a) * 7.5 * u, cy + Math.sin(a) * 7.5 * u); ctx.lineTo(cx + Math.cos(a + 0.5) * 1.5 * u, cy + Math.sin(a + 0.5) * 1.5 * u); }); }
      P('#7a7340', () => E(cx, cy, 2.4 * u, 2.4 * u));
    } else if (v === 3) { // dry scrub
      shadow(7, 0.16);
      for (let k = 0; k < 9; k++) { const a = rot + k * 0.7, l = 5 + h(k) * 4; line('#b9a383', 0.7, [0, 0, Math.cos(a) * l * 0.6 + (h(k + 9) - 0.5) * 2, Math.sin(a) * l * 0.6, Math.cos(a) * l, Math.sin(a) * l]); }
    } else if (v === 4) { // creeper with seed pods
      line('#6a4a30', 1, [-8, 2, -3, -1, 2, 2, 8, -2]);
      for (let k = 0; k < 3; k++) { const px = (-6 + k * 6) * u, py = (k % 2 ? 1.5 : -1) * u; P('rgba(0,0,0,0.2)', () => E(cx + px + 0.8 * u, cy + py + 1 * u, 2 * u, 1.3 * u)); P('#3b2a22', () => E(cx + px, cy + py, 2 * u, 1.4 * u)); }
    } else if (v === 5) { // dry coral fan
      shadow(7, 0.16);
      for (let k = 0; k < 5; k++) { const a = -Math.PI / 2 + (k - 2) * 0.38, l = 6 + h(k) * 3; line('#9a4a38', 1.2, [0, 4, Math.cos(a) * l * 0.5, 4 + Math.sin(a) * l * 0.5, Math.cos(a) * l, 4 + Math.sin(a) * l]); }
    } else { // grass tufts
      for (let g = 0; g < 2; g++) {
        const gx = (g ? 4 : -4) + (h(g) - 0.5) * 3, gy = (g ? -2 : 2);
        P('rgba(0,0,0,0.15)', () => E(cx + (gx + 1) * u, cy + (gy + 1) * u, 3.5 * u, 1.6 * u));
        for (let k = 0; k < 6; k++) line('#c9a86a', 0.6, [gx, gy, gx + (k - 2.5) * 1.1, gy - 4 - h(k + g * 6) * 3]);
      }
    }
  }
}

/** Fine grain on open ground (tiny grit and pebbles), crisp on the sharp map when zoomed in. */
function drawGrain(ctx, i, j, x, y) {
  const gr = (R.look || BIOME_LOOK.desert).grain;
  for (let k = 0; k < 10; k++) {
    const h = hash2(i * 11 + k, j * 17 - k, 57);
    const px = x + 1 + hash2(i * 5 + k, j * 3, 61) * (TP - 2), py = y + 1 + hash2(i * 3, j * 5 + k, 67) * (TP - 2);
    const r = 0.3 + h * 0.55;
    if (h > 0.9) { // a pebble, lit from the top-left
      ctx.fillStyle = gr[3];
      ctx.beginPath(); ctx.arc(px + 0.35, py + 0.35, r + 0.25, 0, 6.283); ctx.fill();
      ctx.fillStyle = gr[2];
    } else ctx.fillStyle = h < 0.5 ? gr[0] : gr[1];
    ctx.beginPath(); ctx.arc(px, py, r, 0, 6.283); ctx.fill();
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
  let en = groundElev(i, j - 1);
  // A sheer drop of three levels or more (Sky islands) is too tall for one tile: its face carries on
  // down the tile below as well.
  const e2 = groundElev(i, j - 2);
  if ((en === null || en <= S.elev[t]) && en === S.elev[t] && e2 !== null && e2 - S.elev[t] >= 3 && !S.ramp[t]) {
    const d = e2 - S.elev[t], h2 = Math.min(TP, 10 * d + 8 - TP);
    if (h2 > 0) tallFace(ctx, i, j, x, y, h2, d, true);
    return;
  }
  if (en === null || en <= S.elev[t]) return;
  if (!waterOnly && canStep(t, tIdx(i, j - 1))) return; // a ramp joins them; the slope is drawn instead
  if (en - S.elev[t] >= 3) { tallFace(ctx, i, j, x, y, TP, en - S.elev[t], groundElev(i, j + 1) !== S.elev[t]); return; }
  const h = Math.min(TP * 0.62, 14 * (en - S.elev[t]));
  const cliffArt = R.tex ? R.tex.cliff : ART.cliff;
  if (cliffArt) {
    const img = cliffArt.img, sw = img.width / 4;
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

/**
 * Part of a tall cliff face (a drop of `d` levels): banded rock strata, cracks and a few ledges,
 * darkening with depth, over the top `h` pixels of the tile. `foot`: this is where the face meets
 * the ground, so it ends in a band of shadow (otherwise it carries on into the tile below).
 */
function tallFace(ctx, i, j, x, y, h, d, foot) {
  const lower = foot && h < TP; // the second tile of a face
  // The art: the canyon wall (its rim at the top) under the rim; below that, the wall's lower half
  // carrying on, darkening into a shadow at the foot.
  const wall = canyonArt('chasm-wall');
  if (wall) {
    const img = artMip(wall, TP * (ctx.hdScale || 1) * (R.drawScale || 1));
    if (!lower) ctx.drawImage(img, x, y, TP, h);
    else ctx.drawImage(img, 0, img.height * 0.45, img.width, img.height * 0.55, x, y, TP, h);
    if (foot) {
      const sh = ctx.createLinearGradient(0, y + h * 0.4, 0, y + h);
      sh.addColorStop(0, 'rgba(15,8,4,0)'); sh.addColorStop(1, 'rgba(15,8,4,0.6)');
      ctx.fillStyle = sh; ctx.fillRect(x, y + h * 0.4, TP, h * 0.6);
    }
    return;
  }
  const g = ctx.createLinearGradient(0, y, 0, y + h);
  g.addColorStop(0, lower ? THEME.cliffBottom || '#4a2e1e' : THEME.cliffTop || '#8a5c3e');
  g.addColorStop(1, mixColor(THEME.cliffBottom || '#4a2e1e', '#1a0f0a', lower ? 0.6 : 0.25));
  ctx.fillStyle = g;
  ctx.fillRect(x, y, TP, h);
  // Strata: alternating bands, the same height all along the cliff so they line up tile to tile.
  for (let k = 0; k * 5 < h; k++) {
    const yy = y + k * 5 + (lower ? 2 : 0);
    if (yy > y + h - 1) break;
    ctx.fillStyle = (k + j) % 3 === 0 ? 'rgba(255,215,170,0.1)' : (k + j) % 3 === 1 ? 'rgba(0,0,0,0.16)' : 'rgba(120,60,30,0.12)';
    ctx.fillRect(x, yy, TP, 2);
  }
  // Vertical cracks and a ledge or two.
  ctx.fillStyle = 'rgba(0,0,0,0.28)';
  for (let n = 0; n < 3; n++) ctx.fillRect(x + 3 + hash2(i, j, 90 + n) * (TP - 6), y + hash2(j, i, 95 + n) * h * 0.4, 1.3, h * (0.35 + 0.4 * hash2(i, n, 99)));
  if (hash2(i, j, 101) < 0.4) { ctx.fillStyle = 'rgba(255,225,190,0.16)'; ctx.fillRect(x + hash2(i, j, 102) * 18, y + h * (0.3 + 0.4 * hash2(i, j, 103)), 8 + hash2(i, j, 104) * 8, 1.5); }
  // Where the face meets the ground: a deep shadow at its foot.
  if (foot && h <= TP) {
    const sh = ctx.createLinearGradient(0, y + h - 6, 0, y + h);
    sh.addColorStop(0, 'rgba(15,8,4,0)'); sh.addColorStop(1, 'rgba(15,8,4,0.45)');
    ctx.fillStyle = sh; ctx.fillRect(x, y + h - 6, TP, 6);
  }
}

/**
 * A deep, steep canyon between the islands: near-black depths with a faint haze of dust far below,
 * sheer rock walls dropping from every island edge (tallest under the southern rims, the faces you
 * look into), with bands of strata, and a dark lip along the other edges.
 */
/** A canyon art image for this planet's biome (the desert's when there's no biome version). */
function canyonArt(key) {
  const b = biome();
  return (b !== 'desert' && ART[key + '-' + b]) || ART[key] || null;
}

function drawChasm(ctx, i, j, x, y) {
  // The art: a wall below an island's rim, the wall carrying on below that, or the depths.
  const ca = canyonArt('chasm');
  if (ca) {
    const key = terrAt(i, j - 1) === T_GROUND ? 'chasm-wall' : terrAt(i, j - 2) === T_GROUND && terrAt(i, j - 1) === T_CHASM ? 'chasm-wall-2' : 'chasm';
    drawTileArt(ctx, canyonArt(key) || ca, x, y, 0);
    return;
  }
  const k = fbm(i / 6, j / 6, 4242, 2);
  const g = ctx.createLinearGradient(0, y, 0, y + TP);
  g.addColorStop(0, `rgb(${22 + 10 * k},${16 + 7 * k},${14 + 6 * k})`);
  g.addColorStop(1, `rgb(${12 + 6 * k},${9 + 4 * k},${9 + 4 * k})`);
  ctx.fillStyle = g;
  ctx.fillRect(x, y, TP, TP);
  // Faint motes of dust drifting in the depths.
  for (let n = 0; n < 3; n++) {
    if (hash2(i * 5 + n, j * 3, 717) > 0.35) continue;
    ctx.fillStyle = `rgba(190,150,110,${0.06 + 0.08 * hash2(i, j + n, 718)})`;
    ctx.fillRect(x + hash2(i + n, j, 719) * TP, y + hash2(i, j + n, 720) * TP, 1.5, 1);
  }
  // The canyon wall under an island's southern rim: a sheer face of banded rock falling away into the dark.
  if (terrAt(i, j - 1) === T_GROUND) {
    const h = TP;
    const rg = ctx.createLinearGradient(0, y, 0, y + h);
    rg.addColorStop(0, THEME.cliffTop || '#8a5c3e'); rg.addColorStop(0.5, THEME.cliffBottom || '#4a2e1e'); rg.addColorStop(1, 'rgba(14,10,9,0)');
    ctx.fillStyle = rg;
    ctx.fillRect(x, y, TP, h);
    for (let b = 0; b < 4; b++) {
      ctx.fillStyle = b % 2 ? 'rgba(0,0,0,0.18)' : 'rgba(255,215,170,0.08)';
      ctx.fillRect(x, y + 3 + b * 6 + hash2(i, b, 61) * 2, TP, 2);
    }
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    for (let n = 0; n < 3; n++) ctx.fillRect(x + 3 + hash2(i, j, 70 + n) * (TP - 6), y + 2, 1.5, h * (0.4 + 0.4 * hash2(j, i, 80 + n)));
  }
  // The rim on the other sides: a dark lip with a sliver of lit edge.
  const rim = (dx, dy, fx, fy, fw, fh) => { if (terrAt(i + dx, j + dy) !== T_GROUND) return; ctx.fillStyle = 'rgba(0,0,0,0.55)'; ctx.fillRect(fx, fy, fw, fh); };
  rim(-1, 0, x, y, 5, TP);
  rim(1, 0, x + TP - 5, y, 5, TP);
  rim(0, 1, x, y + TP - 4, TP, 4);
}

/** Crumbled rims on the clifftop's edges over a sheer drop (3+ levels, or a canyon) to the north, west or east. */
function drawRimLips(ctx, i, j, x, y, e) {
  if (!canyonArt('chasm-lip-n')) return;
  const drop = (di, dj) => {
    if (!inMap(i + di, j + dj)) return false;
    const u = tIdx(i + di, j + dj);
    return S.terrain[u] === T_CHASM || (S.terrain[u] === T_GROUND && e - S.elev[u] >= 3);
  };
  if (drop(0, -1)) drawTileArt(ctx, canyonArt('chasm-lip-n'), x, y, 0);
  if (drop(-1, 0)) drawTileArt(ctx, canyonArt('chasm-lip-w'), x, y, 0);
  if (drop(1, 0)) drawTileArt(ctx, canyonArt('chasm-lip-e'), x, y, 0);
}

/** Cliff edges, shadows and slopes that show which level a ground tile is on. */
function drawElevation(ctx, i, j, x, y, t, n) {
  const e = S.elev[t];
  if (e >= 3 || S.terrain[t] === T_GROUND) drawRimLips(ctx, i, j, x, y, e);
  const N = groundElev(i, j - 1), Sv = groundElev(i, j + 1), Wv = groundElev(i - 1, j), E = groundElev(i + 1, j);
  const linked = (di, dj) => canStep(t, tIdx(i + di, j + dj));
  if (S.ramp[t]) { drawSlope(ctx, i, j, x, y, t, n); return; }
  drawCliffFace(ctx, i, j, x, y, t, false);
  // Higher ground to the west casts a shadow (light comes from the top-left).
  if (Wv !== null && Wv > e && !linked(-1, 0)) {
    const deep = Wv - e >= 3, w = deep ? 16 : 8;
    const g = ctx.createLinearGradient(x, 0, x + w, 0);
    g.addColorStop(0, `rgba(25,12,5,${deep ? 0.55 : 0.38})`); g.addColorStop(1, 'rgba(25,12,5,0)');
    ctx.fillStyle = g; ctx.fillRect(x, y, w, TP);
  }
  if (E !== null && E > e && !linked(1, 0)) {
    if (E - e >= 3) { const g = ctx.createLinearGradient(x + TP, 0, x + TP - 9, 0); g.addColorStop(0, 'rgba(25,12,5,0.45)'); g.addColorStop(1, 'rgba(25,12,5,0)'); ctx.fillStyle = g; ctx.fillRect(x + TP - 9, y, 9, TP); }
    else { ctx.fillStyle = 'rgba(25,12,5,0.28)'; ctx.fillRect(x + TP - 3, y, 3, TP); }
  }
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
    const band = S.wear ? (S.wear[t] / 250) | 0 : 0;
    if (band) drawWear(ctx, i, j, x, y, w, nb, band);
  }
  drawRoadArrow(ctx, t, x, y);
}

/** Roads marked for asphalt (amber), and worn asphalt that's due for resurfacing (red outline). */
function drawPaveMarks(ctx, ox, oy, z, inView) {
  const pulse = 0.75 + 0.25 * Math.sin(R.time * 3);
  ctx.lineWidth = Math.max(1.5, z * 0.05);
  for (let t = 0; t < S.W * S.H; t++) {
    if (S.owner[t] !== 0 || !(S.road[t] || S.plan[t] === 1)) continue;
    const worn = S.road[t] && S.pave[t] === 2 && S.wear[t] >= REPAVE_AT;
    if (!S.paveMark[t] && !worn) continue;
    const i = t % S.W, j = (t / S.W) | 0;
    if (!inView(i, j, 1)) continue;
    const x = ox + i * z, y = oy + j * z;
    if (S.paveMark[t]) {
      ctx.fillStyle = S.pave[t] === 2 ? 'rgba(255,196,70,0.16)' : 'rgba(255,196,70,0.34)';
      ctx.fillRect(x + z * 0.08, y + z * 0.08, z * 0.84, z * 0.84);
      ctx.strokeStyle = `rgba(255,196,70,${0.7 * pulse})`;
      ctx.strokeRect(x + z * 0.08, y + z * 0.08, z * 0.84, z * 0.84);
    }
    if (worn) {
      ctx.strokeStyle = `rgba(255,80,60,${0.9 * pulse})`;
      ctx.strokeRect(x + z * 0.18, y + z * 0.18, z * 0.64, z * 0.64);
    }
  }
}

/** Worn asphalt: it fades grey, cracks, and finally breaks into potholes. */
function drawWear(ctx, i, j, x, y, w, nb, band) {
  const c = TP / 2, h = (k) => hash2(i * 7 + k, j * 13 - k, 90);
  // Keep the marks on the road: inside the centre square and the arms that join neighbours.
  ctx.save();
  ctx.beginPath();
  ctx.rect(x + c - w / 2, y + c - w / 2, w, w);
  if (nb[0]) ctx.rect(x + c - w / 2, y, w, c);
  if (nb[1]) ctx.rect(x + c, y + c - w / 2, c, w);
  if (nb[2]) ctx.rect(x + c - w / 2, y + c, w, c);
  if (nb[3]) ctx.rect(x, y + c - w / 2, c, w);
  ctx.clip();
  ctx.fillStyle = `rgba(170,165,155,${0.07 * band})`;
  ctx.fillRect(x, y, TP, TP);
  ctx.strokeStyle = 'rgba(8,8,10,0.75)';
  ctx.lineWidth = 0.7;
  ctx.lineCap = 'round';
  for (let k = 0; k < band + 1; k++) {
    let px = x + c + (h(k) - 0.5) * w, py = y + c + (h(k + 9) - 0.5) * w;
    ctx.beginPath(); ctx.moveTo(px, py);
    for (let s = 0; s < 3; s++) { px += (h(k * 5 + s) - 0.5) * 9; py += (h(k * 5 + s + 20) - 0.5) * 9; ctx.lineTo(px, py); }
    ctx.stroke();
  }
  if (band >= 3) {
    for (let k = 0; k < 2; k++) {
      const px = x + c + (h(40 + k) - 0.5) * w * 0.7, py = y + c + (h(50 + k) - 0.5) * w * 0.7, r = 1.4 + h(60 + k) * 1.4;
      ctx.fillStyle = 'rgba(150,140,125,0.55)';
      ctx.beginPath(); ctx.ellipse(px + 0.4, py + 0.5, r + 0.6, (r + 0.6) * 0.75, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#0b0b0d';
      ctx.beginPath(); ctx.ellipse(px, py, r, r * 0.75, 0, 0, Math.PI * 2); ctx.fill();
    }
  }
  ctx.restore();
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

/* ------------------------------------------------------------------ bridges */

const ARM_DIRS = [[0, -1], [1, 0], [0, 1], [-1, 0]]; // N E S W

/** Is tile t a bridge: a road or railway out over water or a canyon? */
function onBridge(t) { return bridgeable(t) && (S.road[t] > 0 || (!!S.rail && S.rail[t] > 0)); }

/** Which sides (N E S W) bridge tile t carries on to: more bridge, or a landing on the shore. */
function bridgeArms(i, j, t) {
  return ARM_DIRS.map(([di, dj]) => {
    if (!inMap(i + di, j + dj)) return false;
    const u = tIdx(i + di, j + dj);
    return (S.road[t] > 0 && S.road[u] > 0 && canStep(t, u)) || (!!S.rail && railStep(t, u));
  });
}

/**
 * The level a bridge's deck runs at. A bridge holds one height all the way across: that of the
 * highest clifftop it lands on (where the other end lands lower, its last stretch ramps down to
 * it). Worked out once per span and kept until roads or rail change.
 */
function deckLevel(t) {
  const ver = (S.roadVer || 0) + '/' + (S.railVer || 0);
  if (!R.deck || R.deck.ver !== ver || R.deck.of !== S) R.deck = { ver, of: S, at: new Map() };
  const hit = R.deck.at.get(t);
  if (hit !== undefined) return hit;
  const W = S.W, q = [t], seen = new Set(q);
  let top = -1, rim = 0;
  for (let h = 0; h < q.length && h < 600; h++) {
    const a = q[h], i = a % W, j = (a / W) | 0, arms = bridgeArms(i, j, a);
    ARM_DIRS.forEach(([di, dj], k) => {
      if (!inMap(i + di, j + dj)) return;
      const u = tIdx(i + di, j + dj);
      if (S.terrain[u] === T_GROUND) { rim = Math.max(rim, S.elev[u]); if (arms[k]) top = Math.max(top, S.elev[u]); }
      else if (arms[k] && onBridge(u) && !seen.has(u)) { seen.add(u); q.push(u); }
    });
  }
  const lv = top >= 0 ? top : rim;
  for (const a of q) R.deck.at.set(a, lv);
  return lv;
}

/**
 * The bridge art piece for tile (i, j) with these arms: 'ew' or 'ns' along a straight run, 'end-<side>'
 * where it meets land on that side, 'ramp-<side>' where that land is lower than the deck. Null at a
 * corner or junction.
 */
function bridgePiece(i, j, arms, lv) {
  const ew = arms[1] || arms[3], ns = arms[0] || arms[2];
  if (ew && ns) return null;
  const sides = ew ? [[3, -1, 0, 'w'], [1, 1, 0, 'e']] : [[0, 0, -1, 'n'], [2, 0, 1, 's']];
  const land = sides.filter(([k, di, dj]) => arms[k] && inMap(i + di, j + dj) && S.terrain[tIdx(i + di, j + dj)] === T_GROUND);
  if (land.length === 1) {
    const [, di, dj, side] = land[0];
    return (S.elev[tIdx(i + di, j + dj)] < lv ? 'ramp-' : 'end-') + side;
  }
  return ew || !ns ? 'ew' : 'ns';
}

/**
 * A bridge tile, lit like the cliffs (from the top-left): a level deck at clifftop height with
 * railings on both edges, the deck slab and its girders showing along the south side, and the
 * bridge's shadow far below on a canyon floor (or close by on water). A rail bridge carries
 * ballast for the track. Where the deck meets a lower clifftop it ramps down onto it. Piers,
 * towers and cables reach out past the tile, so drawBridgeRigging draws those every frame.
 */
function drawBridge(ctx, i, j, x, y, t, rail) {
  const c = TP / 2, deep = S.terrain[t] === T_CHASM, arms = bridgeArms(i, j, t);
  if (!arms.some(Boolean)) arms[1] = arms[3] = true; // a lone stub lies east-west
  const hw = rail ? 10 : 9, asphalt = !rail && S.pave[t] === 2, lv = deckLevel(t);
  const rects = (w, ox, oy) => {
    const out = [[x + c - w + ox, y + c - w + oy, 2 * w, 2 * w]];
    if (arms[0]) out.push([x + c - w + ox, y + oy, 2 * w, c]);
    if (arms[1]) out.push([x + c + ox, y + c - w + oy, c, 2 * w]);
    if (arms[2]) out.push([x + c - w + ox, y + c + oy, 2 * w, c]);
    if (arms[3]) out.push([x + ox, y + c - w + oy, c, 2 * w]);
    return out;
  };
  const fill = (style, list) => { ctx.fillStyle = style; for (const r of list) ctx.fillRect(r[0], r[1], r[2], r[3]); };
  ctx.save();
  ctx.beginPath(); ctx.rect(x, y, TP, TP); ctx.clip();
  // Shadow: soft and far off to the south-east on a canyon floor, close by on water.
  if (deep) { fill('rgba(0,0,0,0.22)', rects(hw + 3, 8, 16)); fill('rgba(0,0,0,0.22)', rects(hw, 8, 16)); }
  else fill('rgba(0,18,28,0.4)', rects(hw + 1, 2, 5));
  // The bridge art, for straight runs and their ends (corners and junctions are drawn).
  const piece = bridgePiece(i, j, arms, lv), bart = piece && ART[(rail ? 'railbridge-' : deep ? 'skybridge-' : 'bridge-') + piece];
  if (bart) { ctx.drawImage(artMip(bart, TP * (ctx.hdScale || 1) * (R.drawScale || 1)), x, y, TP, TP); ctx.restore(); return; }
  // The south face, where the deck's south edge is open: slab edge, then the girders.
  const y0 = y + c + hw, spans = [];
  if (!arms[2]) spans.push([arms[3] ? x : x + c - hw, arms[1] ? x + TP : x + c + hw]);
  else { if (arms[3]) spans.push([x, x + c - hw]); if (arms[1]) spans.push([x + c + hw, x + TP]); }
  for (const [a, b] of spans) {
    ctx.fillStyle = rail ? '#6f655c' : '#8f969d'; ctx.fillRect(a, y0, b - a, 3);              // slab edge
    ctx.fillStyle = 'rgba(255,255,255,0.22)'; ctx.fillRect(a, y0, b - a, 1);
    const gh = deep ? y + TP - (y0 + 3) : 3;
    ctx.fillStyle = '#272c32'; ctx.fillRect(a, y0 + 3, b - a, gh);                          // girders
    if (deep) {
      // A Warren truss: chords top and bottom, diagonals between.
      ctx.strokeStyle = '#6a737d'; ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(a, y0 + 3.5); ctx.lineTo(b, y0 + 3.5);
      ctx.moveTo(a, y + TP - 0.5); ctx.lineTo(b, y + TP - 0.5);
      for (let px = Math.ceil((a - x) / 4) * 4 + x; px < b; px += 4) {
        const up = ((px - x) / 4) % 2 === 0;
        ctx.moveTo(px, up ? y0 + 3.5 : y + TP - 0.5); ctx.lineTo(Math.min(b, px + 4), up ? y + TP - 0.5 : y0 + 3.5);
      }
      ctx.stroke();
    }
  }
  // Girders under the deck show along its sides (more on the shaded east side), then the deck.
  fill('#2a2f35', rects(hw + 1.5, 0.8, 0));
  // A north-south deck shows its truss down the shaded east side and a lit edge on the west.
  if (arms[0] || arms[2]) {
    const a = arms[0] ? y : y + c - hw, b = arms[2] ? y + TP : y + c + hw, ex = x + c + hw;
    ctx.fillStyle = '#23272c'; ctx.fillRect(ex, a, deep ? 5 : 3, b - a);
    if (deep) {
      ctx.strokeStyle = '#5f6872'; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(ex + 4.5, a); ctx.lineTo(ex + 4.5, b);
      for (let py = Math.ceil((a - y) / 4) * 4 + y; py < b; py += 4) { const up = ((py - y) / 4) % 2 === 0; ctx.moveTo(up ? ex : ex + 4.5, py); ctx.lineTo(up ? ex + 4.5 : ex, Math.min(b, py + 4)); }
      ctx.stroke();
    }
    ctx.fillStyle = '#8f969d'; ctx.fillRect(x + c - hw - 1.5, a, 1.5, b - a);
  }
  fill(rail ? '#5b5047' : asphalt ? '#34373e' : '#a3a9ae', rects(hw, 0, 0));
  if (rail) {
    // Ballast: gravel for the sleepers to sit in.
    for (let k = 0; k < 14; k++) {
      const gx = x + hash2(i * 9 + k, j, 301) * TP, gy = y + hash2(i, j * 9 + k, 302) * TP;
      ctx.fillStyle = k % 2 ? 'rgba(0,0,0,0.25)' : 'rgba(255,235,210,0.14)';
      ctx.fillRect(gx, gy, 1.5, 1.5);
    }
  } else {
    // Deck plates with seams, and expansion joints where one span meets the next.
    ctx.fillStyle = asphalt ? 'rgba(255,255,255,0.07)' : 'rgba(40,46,52,0.3)';
    const along = arms[1] || arms[3];
    for (let k = 4; k < TP; k += 8) { if (along) ctx.fillRect(x + k, y + c - hw, 1, 2 * hw); else ctx.fillRect(x + c - hw, y + k, 2 * hw, 1); }
    ctx.fillStyle = 'rgba(20,22,26,0.55)';
    if (arms[1]) ctx.fillRect(x + TP - 1, y + c - hw, 1, 2 * hw);
    if (arms[2]) ctx.fillRect(x + c - hw, y + TP - 1, 2 * hw, 1);
    if (asphalt) {
      ctx.fillStyle = 'rgba(240,210,110,0.55)';
      if (arms[1] || arms[3]) for (let k = 2; k < TP; k += 8) if ((arms[3] || k >= c) && (arms[1] || k <= c)) ctx.fillRect(x + k, y + c - 0.5, 4, 1);
      if (arms[0] || arms[2]) for (let k = 2; k < TP; k += 8) if ((arms[0] || k >= c) && (arms[2] || k <= c)) ctx.fillRect(x + c - 0.5, y + k, 1, 4);
    }
  }
  // Lit north and west edges of the deck.
  ctx.fillStyle = 'rgba(255,255,255,0.2)';
  for (const r of rects(hw, 0, 0)) { if (r[2] > r[3] || r[2] === r[3]) ctx.fillRect(r[0], r[1], r[2], 1); if (r[3] >= r[2]) ctx.fillRect(r[0], r[1], 1, r[3]); }
  // A lower clifftop: the deck's last stretch ramps down onto it.
  ARM_DIRS.forEach(([di, dj], k) => {
    if (!arms[k] || !inMap(i + di, j + dj)) return;
    const u = tIdx(i + di, j + dj);
    if (S.terrain[u] !== T_GROUND || S.elev[u] >= lv) return;
    const ex = x + c + di * c, ey = y + c + dj * c;
    const g = ctx.createLinearGradient(x + c, y + c, ex, ey);
    g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, `rgba(0,0,0,${0.18 + 0.1 * Math.min(3, lv - S.elev[u])})`);
    ctx.fillStyle = g;
    if (di) ctx.fillRect(Math.min(x + c, ex), y + c - hw, c, 2 * hw); else ctx.fillRect(x + c - hw, Math.min(y + c, ey), 2 * hw, c);
    ctx.fillStyle = 'rgba(255,240,210,0.28)'; // grooves across the ramp
    for (let s = 4; s < c; s += 4) { if (di) ctx.fillRect(x + c + di * s, y + c - hw + 1, 1, 2 * hw - 2); else ctx.fillRect(x + c - hw + 1, y + c + dj * s, 2 * hw - 2, 1); }
  });
  // Railings along the open edges: posts with a rail on top, standing up off the deck.
  const segs = [];
  const H = (y1, a, b) => segs.push([0, y1, a, b]), V = (x1, a, b) => segs.push([1, x1, a, b]);
  if (arms[0]) { V(x + c - hw, y, y + c - hw); V(x + c + hw, y, y + c - hw); }
  if (arms[2]) { V(x + c - hw, y + c + hw, y + TP); V(x + c + hw, y + c + hw, y + TP); }
  if (arms[1]) { H(y + c - hw, x + c + hw, x + TP); H(y + c + hw, x + c + hw, x + TP); }
  if (arms[3]) { H(y + c - hw, x, x + c - hw); H(y + c + hw, x, x + c - hw); }
  if (!arms[0]) H(y + c - hw, x + c - hw, x + c + hw);
  if (!arms[2]) H(y + c + hw, x + c - hw, x + c + hw);
  if (!arms[3]) V(x + c - hw, y + c - hw, y + c + hw);
  if (!arms[1]) V(x + c + hw, y + c - hw, y + c + hw);
  const railC = rail ? '#c4c0b8' : '#dfe3e8', lift = 2.5;
  for (const [vert, p, a, b] of segs) {
    if (b - a < 0.5) continue;
    if (!vert) {
      const yy = p + (p < y + c ? 1 : -1);
      ctx.fillStyle = 'rgba(0,0,0,0.3)'; ctx.fillRect(a, yy + 0.5, b - a, 1);          // its shadow on the deck
      ctx.fillStyle = '#7d858e';
      for (let px = Math.ceil((a - x) / 4) * 4 + x; px <= b; px += 4) ctx.fillRect(px - 0.5, yy - lift, 1, lift + 0.5); // posts
      ctx.fillStyle = railC; ctx.fillRect(a, yy - lift - 0.5, b - a, 1.3);               // top rail
    } else {
      const xx = p + (p < x + c ? 1 : -1.5);
      ctx.fillStyle = 'rgba(0,0,0,0.3)'; ctx.fillRect(xx + 1, a + 1, 1, b - a);
      ctx.fillStyle = '#7d858e';
      for (let py = Math.ceil((a - y) / 4) * 4 + y; py <= b; py += 4) ctx.fillRect(xx - 0.5, py - lift, 1.5, lift + 0.5);
      ctx.fillStyle = railC; ctx.fillRect(xx, a - lift, 1.3, b - a);
    }
  }
  ctx.restore();
}

/**
 * A Viaduct's deck from abutment a to abutment b (tile coords), drawn level at the higher end's
 * height: its shadow far down on the ground below, concrete piers standing on that ground every
 * other tile, the deck slab and girders (the south face of an east-west deck, the shaded east side
 * of a north-south one), the road (or ballast and rails, with track on both ends), railings, and a
 * ramp down at a lower end. frac < 1: still going up, built out that far from a.
 */
function drawViaductDeck(ctx, ox, oy, z, a, b, frac, building) {
  if (ART['skybridge-ew']) { drawViaductDeckArt(ctx, ox, oy, z, a, b, frac, building); return; }
  const u = z / TP, W = S.W;
  const ta = tIdx(a.x, a.y), tb = tIdx(b.x, b.y);
  const ew = a.y === b.y, n = Math.abs(b.x - a.x) + Math.abs(b.y - a.y);
  const di = Math.sign(b.x - a.x), dj = Math.sign(b.y - a.y);
  const top = Math.max(S.elev[ta], S.elev[tb]);
  let floor = top;
  for (let k = 1; k < n; k++) { const t = tIdx(a.x + di * k, a.y + dj * k); floor = Math.min(floor, S.terrain[t] === T_GROUND ? S.elev[t] : 0); }
  const drop = Math.max(1, top - floor), h = clamp(drop * 0.3, 0.3, 1.5) * z; // how high the deck stands, on screen
  const rail = !!(S.rail && S.rail[ta] && S.rail[tb]);
  const hw = (rail ? 10 : 9) * u;
  // The deck as a screen rectangle from the middle of one abutment to (frac of the way to) the other.
  const ax = ox + (a.x + 0.5) * z, ay = oy + (a.y + 0.5) * z;
  const len = n * z * frac, ex = ax + di * len, ey = ay + dj * len;
  const x0 = Math.min(ax, ex) - (ew ? 0 : hw), x1 = Math.max(ax, ex) + (ew ? 0 : hw);
  const y0 = Math.min(ay, ey) - (ew ? hw : 0), y1 = Math.max(ay, ey) + (ew ? hw : 0);
  if (x1 < -z * 2 || y1 < -z * 2 || x0 > R.w + z * 2 || y0 > R.h + z * 3) return;
  // Shadow, down on the ground below: further off the higher the deck.
  ctx.fillStyle = 'rgba(15,8,4,0.26)';
  ctx.fillRect(x0 + h * 0.35, y0 + h * 0.6, x1 - x0, y1 - y0);
  // Piers: tapered concrete columns down to a footing on the ground, every other tile.
  for (let k = 1; k < n; k++) {
    if (n > 3 && k % 2 === 0 && k !== n - 1) continue;
    if (k > n * frac) break;
    const px = ax + di * k * z, py = ay + dj * k * z;
    const footY = py + (ew ? hw : 0) + h;
    const wTop = (ew ? 7 : 5) * u, wBot = wTop * 1.35;
    const g = ctx.createLinearGradient(px - wBot, 0, px + wBot, 0);
    g.addColorStop(0, '#d5cfc4'); g.addColorStop(0.45, '#b3ada3'); g.addColorStop(1, '#6f6a62');
    ctx.fillStyle = 'rgba(15,8,4,0.3)';
    ctx.beginPath(); ctx.ellipse(px + wBot * 0.4, footY + 1.5 * u, wBot * 1.3, 3 * u, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(px - wTop, py + (ew ? hw : 0)); ctx.lineTo(px + wTop, py + (ew ? hw : 0));
    ctx.lineTo(px + wBot, footY); ctx.lineTo(px - wBot, footY); ctx.closePath(); ctx.fill();
    ctx.fillStyle = 'rgba(0,0,0,0.18)';
    for (let s = 1; s < 4; s++) ctx.fillRect(px - wTop - (wBot - wTop) * s / 4, py + (ew ? hw : 0) + (footY - py - (ew ? hw : 0)) * s / 4, 2 * (wTop + (wBot - wTop) * s / 4), 1);
  }
  // Girders: the south face of an east-west deck (slab edge, then a truss); the shaded east side
  // of a north-south one.
  if (ew) {
    ctx.fillStyle = rail ? '#6f655c' : '#8f969d'; ctx.fillRect(x0, y1, x1 - x0, 3 * u);
    ctx.fillStyle = '#272c32'; ctx.fillRect(x0, y1 + 3 * u, x1 - x0, 6 * u);
    ctx.strokeStyle = '#6a737d'; ctx.lineWidth = Math.max(1, u);
    ctx.beginPath();
    for (let x = x0, up = true; x < x1; x += 5 * u, up = !up) { ctx.moveTo(x, up ? y1 + 3.5 * u : y1 + 8.5 * u); ctx.lineTo(Math.min(x1, x + 5 * u), up ? y1 + 8.5 * u : y1 + 3.5 * u); }
    ctx.stroke();
  } else {
    ctx.fillStyle = '#23272c'; ctx.fillRect(x1, y0, 5 * u, y1 - y0);
    ctx.fillStyle = '#8f969d'; ctx.fillRect(x0 - 1.5 * u, y0, 1.5 * u, y1 - y0);
  }
  // The deck: road, or ballast with the track on it.
  ctx.fillStyle = rail ? '#5b5047' : '#a3a9ae';
  ctx.fillRect(x0, y0, x1 - x0, y1 - y0);
  ctx.fillStyle = 'rgba(255,255,255,0.2)';
  if (ew) ctx.fillRect(x0, y0, x1 - x0, 1); else ctx.fillRect(x0, y0, 1, y1 - y0);
  ctx.fillStyle = 'rgba(20,22,26,0.4)'; // expansion joints at each tile
  for (let k = 1; k < n * frac; k++) { const jx = ax + di * k * z - di * z / 2, jy = ay + dj * k * z - dj * z / 2; if (ew) ctx.fillRect(jx, y0, 1, y1 - y0); else ctx.fillRect(x0, jy, x1 - x0, 1); }
  if (rail) {
    ctx.fillStyle = '#33271e';
    for (let s = 0; s < len; s += 8 * u) { const sx = ax + di * s, sy = ay + dj * s; if (ew) ctx.fillRect(sx - 2 * u, ay - 9 * u, 4 * u, 18 * u); else ctx.fillRect(ax - 9 * u, sy - 2 * u, 18 * u, 4 * u); }
    ctx.strokeStyle = '#c9ced6'; ctx.lineWidth = Math.max(1, 2 * u);
    ctx.beginPath();
    for (const off of [-5.5, 5.5]) { if (ew) { ctx.moveTo(ax, ay + off * u); ctx.lineTo(ex, ay + off * u); } else { ctx.moveTo(ax + off * u, ay); ctx.lineTo(ax + off * u, ey); } }
    ctx.stroke();
  }
  // A lower end: the last half-tile ramps down onto it.
  for (const [p, q] of [[a, b], [b, a]]) {
    const d = top - S.elev[tIdx(p.x, p.y)];
    if (d <= 0 || (p === b && frac < 1)) continue;
    const sx = ox + (p.x + 0.5) * z, sy = oy + (p.y + 0.5) * z, qx = Math.sign(q.x - p.x), qy = Math.sign(q.y - p.y);
    const g = ctx.createLinearGradient(sx + qx * z, sy + qy * z, sx, sy);
    g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, `rgba(0,0,0,${0.15 + 0.1 * d})`);
    ctx.fillStyle = g;
    if (ew) ctx.fillRect(Math.min(sx, sx + qx * z), y0, z, y1 - y0); else ctx.fillRect(x0, Math.min(sy, sy + qy * z), x1 - x0, z);
  }
  // Railings: posts and a top rail along both edges.
  for (const side of [-1, 1]) {
    const rx = ew ? null : (side < 0 ? x0 + 1 * u : x1 - 2.3 * u), ry = ew ? (side < 0 ? y0 + 1 * u : y1 - 1 * u) : null;
    ctx.fillStyle = '#7d858e';
    for (let s = 0; s <= len; s += 4 * u) { const sx = ax + di * s, sy = ay + dj * s; if (ew) ctx.fillRect(sx - 0.5 * u, ry - 2.5 * u, 1 * u, 3 * u); else ctx.fillRect(rx, sy - 2.5 * u, 1.3 * u, 3 * u); }
    ctx.fillStyle = rail ? '#c4c0b8' : '#dfe3e8';
    if (ew) ctx.fillRect(x0, ry - 3 * u, x1 - x0, 1.3 * u); else ctx.fillRect(rx, y0 - 2.5 * u, 1.3 * u, y1 - y0);
  }
  // Still going up: the rest of the span marked out.
  if (building && frac < 1) {
    ctx.strokeStyle = 'rgba(255,255,255,0.55)'; ctx.lineWidth = Math.max(1, 1.5 * u);
    ctx.setLineDash([5 * u, 4 * u]);
    const bx = ox + (b.x + 0.5) * z, by = oy + (b.y + 0.5) * z;
    if (ew) ctx.strokeRect(Math.min(ex, bx), ay - hw, Math.abs(bx - ex), 2 * hw); else ctx.strokeRect(ax - hw, Math.min(ey, by), 2 * hw, Math.abs(by - ey));
    ctx.setLineDash([]);
  }
}

/**
 * A Viaduct's deck from the Sky bridge art (or the rail bridge's, with track on both ends): its
 * shadow down below, piers on the ground every other tile (stretched to the drop), the deck tiles
 * (an abutment piece at each end, or a ramp where that end is lower), the track if any, and on spans
 * of four tiles or more, suspension towers by each end with cables between them.
 */
function drawViaductDeckArt(ctx, ox, oy, z, a, b, frac, building) {
  const ta = tIdx(a.x, a.y), tb = tIdx(b.x, b.y), ew = a.y === b.y;
  const n = Math.abs(b.x - a.x) + Math.abs(b.y - a.y), di = Math.sign(b.x - a.x), dj = Math.sign(b.y - a.y);
  const top = Math.max(S.elev[ta], S.elev[tb]);
  let floor = top;
  for (let k = 1; k < n; k++) { const t = tIdx(a.x + di * k, a.y + dj * k); floor = Math.min(floor, S.terrain[t] === T_GROUND ? S.elev[t] : 0); }
  const h = clamp(Math.max(1, top - floor) * 0.3, 0.3, 1.5) * z;
  const rail = !!(S.rail && S.rail[ta] && S.rail[tb]), style = rail ? 'railbridge-' : 'skybridge-';
  const built = Math.min(n - 1, Math.max(0, Math.ceil(n * frac - 0.5)));
  const X = (k) => ox + (a.x + di * k) * z, Y = (k) => oy + (a.y + dj * k) * z;
  const x0 = Math.min(X(1), X(n - 1)), y0 = Math.min(Y(1), Y(n - 1));
  if (x0 > R.w + 2 * z || y0 > R.h + 3 * z || Math.max(X(1), X(n - 1)) < -2 * z || Math.max(Y(1), Y(n - 1)) < -3 * z) return;
  const sideA = ew ? (di > 0 ? 'w' : 'e') : (dj > 0 ? 'n' : 's'), sideB = ew ? (di > 0 ? 'e' : 'w') : (dj > 0 ? 's' : 'n');
  const piece = (k) => {
    if (n - 1 > 1 && k === 1) return (S.elev[ta] < top ? 'ramp-' : 'end-') + sideA;
    if (n - 1 > 1 && k === n - 1) return (S.elev[tb] < top ? 'ramp-' : 'end-') + sideB;
    return ew ? 'ew' : 'ns';
  };
  // Shadow, down on the ground below.
  ctx.fillStyle = 'rgba(15,8,4,0.26)';
  for (let k = 1; k <= built; k++) ctx.fillRect(X(k) + h * 0.35 + (ew ? 0 : z * 0.22), Y(k) + h * 0.6 + (ew ? z * 0.22 : 0), ew ? z : z * 0.56, ew ? z * 0.56 : z);
  // Piers under an east–west deck, stretched down to the ground.
  const pier = ART[style + 'pier'];
  if (ew && pier) {
    const img = artMip(pier, z * (R.drawScale || 1));
    for (let k = 1; k <= built; k++) {
      if (n > 3 && k % 2 === 0 && k !== n - 1) continue;
      ctx.drawImage(img, 0, img.height * 0.25, img.width, img.height * 0.75, X(k), Y(k) + z, z, Math.min(1.6 * z, h + 0.35 * z));
    }
  }
  for (let k = 1; k <= built; k++) {
    const art = ART[style + piece(k)] || ART[style + (ew ? 'ew' : 'ns')];
    if (art) ctx.drawImage(artMip(art, z * (R.drawScale || 1)), X(k), Y(k), z, z);
    if (rail && ART['rail-straight']) {
      const img = artMip(ART['rail-straight'], z * (R.drawScale || 1));
      ctx.save(); ctx.translate(X(k) + z / 2, Y(k) + z / 2); if (!ew) ctx.rotate(Math.PI / 2); ctx.drawImage(img, -z / 2, -z / 2, z, z); ctx.restore();
    }
  }
  // Suspension towers by each end, cables between them, on spans of four deck tiles or more.
  if (built === n - 1 && n - 1 >= 4 && !rail) {
    const t1 = { x: X(2) + z / 2, y: Y(2) + z / 2, di: ew ? -1 : 0, dj: ew ? 0 : -1, L: n - 3, landed: true };
    const t2 = { x: X(n - 2) + z / 2, y: Y(n - 2) + z / 2, di: ew ? 1 : 0, dj: ew ? 0 : 1, L: n - 3, landed: true };
    if (!ew || di > 0) drawTowerArt(ctx, [t1, t2].sort((p, q) => p.y - q.y), z);
    else drawTowerArt(ctx, [{ ...t2, di: -1 }, { ...t1, di: 1 }], z);
  }
  // Still going up: the rest of the span marked out.
  if (building && built < n - 1) {
    ctx.strokeStyle = 'rgba(255,255,255,0.55)'; ctx.lineWidth = Math.max(1, z * 0.05);
    ctx.setLineDash([z * 0.15, z * 0.12]);
    const k0 = built + 1, xa = Math.min(X(k0), X(n - 1)), ya = Math.min(Y(k0), Y(n - 1));
    if (ew) ctx.strokeRect(xa, Y(1) + z * 0.22, Math.abs(X(n - 1) - X(k0)) + z, z * 0.56); else ctx.strokeRect(X(1) + z * 0.22, ya, z * 0.56, Math.abs(Y(n - 1) - Y(k0)) + z);
    ctx.setLineDash([]);
  }
}

/** Every Viaduct's deck: each built pair once, and those still going up as far as they've got. */
function drawViaducts(ctx, ox, oy, z) {
  for (const b of S.buildings) {
    if (b.dead || b.type !== 'viaduct' || b.far) continue;
    if (b.link) { const o = getE(b.link); if (o && !o.dead) drawViaductDeck(ctx, ox, oy, z, b, o, 1, false); continue; }
    if (b.viaTo >= 0) drawViaductDeck(ctx, ox, oy, z, b, { x: b.viaTo % S.W, y: (b.viaTo / S.W) | 0 }, b.built ? 1 : Math.max(0.04, b.progress), !b.built);
  }
}

/**
 * Level crossings (the art's): barriers down and red lamps flashing while a train is near, up
 * otherwise. Drawn every frame over the map.
 */
function drawCrossingGates(ctx, ox, oy, z, inView) {
  if (!ART['rail-barrier-up']) return;
  const ver = (S.roadVer || 0) + '/' + (S.railVer || 0);
  if (!R.xings || R.xings.ver !== ver || R.xings.of !== S) {
    const list = [];
    for (let t = 0; t < S.W * S.H; t++) if (S.rail[t] && S.road[t] && !S.bAt[t]) { const pc = railPiece(t); if (pc.key === 'rail-level-crossing') list.push([t, pc.q]); }
    R.xings = { ver, of: S, list };
  }
  for (const [t, q] of R.xings.list) {
    const i = t % S.W, j = (t / S.W) | 0;
    if (!inView(i, j, 2)) continue;
    const near = trainNear(t), x = ox + i * z, y = oy + j * z;
    const art = ART[near ? 'rail-barrier-down' : 'rail-barrier-up'], img = artMip(art, z * (R.drawScale || 1));
    ctx.save(); ctx.translate(x + z / 2, y + z / 2); ctx.rotate((q * Math.PI) / 2);
    ctx.drawImage(img, -z / 2, -z / 2, z, z);
    if (near && Math.sin(R.time * 9) > 0 && ART['rail-lights-on']) ctx.drawImage(artMip(ART['rail-lights-on'], z * (R.drawScale || 1)), -z / 2, -z / 2, z, z);
    ctx.restore();
  }
}

/**
 * Suspension towers and cables from the art. A tower is one tile wide and two tall, standing on its
 * deck tile's bottom edge. On an east–west span, a cable is stretched from tower to tower on each
 * side: the north one (from 8% down the towers to the deck's north edge, 22% down its tile) behind
 * the towers, the south one (37% down to the 78% line) in front.
 */
function drawTowerArt(ctx, towers, z) {
  const tower = ART['skybridge-tower'], cable = ART['skybridge-cable'], lamp = ART['skybridge-tower-lamp'];
  const timg = artMip(tower, z * (R.drawScale || 1));
  // East–west spans: one cable pair per span, from its west tower.
  const spans = towers.filter((tw) => tw.landed && tw.dj === 0 && tw.di < 0);
  const cab = (tw, north) => {
    if (!cable) return;
    const x0 = tw.x, x1 = tw.x + (tw.L - 1) * z, top = tw.y - z / 2;
    const y0 = north ? top - 0.84 * z : top - 0.26 * z, h = north ? 1.06 * z : 1.04 * z;
    ctx.drawImage(artMip(cable, (x1 - x0) * (R.drawScale || 1)), x0, y0, x1 - x0, h);
  };
  for (const tw of spans) cab(tw, true);
  for (const tw of towers) {
    const x = tw.x - z / 2, y = tw.y + z / 2 - 2 * z;
    ctx.drawImage(timg, x, y, z, 2 * z);
    if (lamp && Math.sin(R.time * 2.4 + tw.x * 0.01) > -0.2) ctx.drawImage(artMip(lamp, z * (R.drawScale || 1)), x, y, z, 2 * z);
  }
  for (const tw of spans) cab(tw, false);
}

/** Every bridge tile on the map (kept until roads or rail change). */
function bridgeList() {
  const ver = (S.roadVer || 0) + '/' + (S.railVer || 0);
  if (R.bridges && R.bridges.ver === ver && R.bridges.of === S) return R.bridges.list;
  const list = [];
  for (let t = 0; t < S.W * S.H; t++) if (onBridge(t)) list.push(t);
  R.bridges = { ver, of: S, list };
  return list;
}

/**
 * The tall parts of bridges, drawn each frame over the map but under bots and buildings: piers
 * dropping from the deck deep into the canyon (or a short way into the water), and, on canyon
 * spans of three tiles or more, a tower at each end hung with suspension cables and hangers that
 * meet at mid-span. The deck stays level: heights here are drawn straight up the screen.
 */
function drawBridgeRigging(ctx, ox, oy, z, inView) {
  const list = bridgeList();
  if (!list.length) return;
  const W = S.W, u = z / TP;
  const towers = [];
  for (const t of list) {
    const i = t % W, j = (t / W) | 0;
    if (!inView(i, j, 6)) continue;
    const arms = bridgeArms(i, j, t), deep = S.terrain[t] === T_CHASM, hw = (S.road[t] ? 9 : 10) * u;
    const x = ox + i * z, y = oy + j * z, cx = x + z / 2;
    const below = inMap(i, j + 1) ? tIdx(i, j + 1) : -1;
    const ew = arms[1] || arms[3] || !arms.some(Boolean);
    // Piers below a deck whose south side is open (every other tile along a straight run).
    if (ew && !arms[2] && below >= 0 && bridgeable(below) && !onBridge(below) && (i % 2 === 0 || !(arms[1] && arms[3]))) {
      // The art's pier: one tile wide, two tall, its top on the deck tile's centre line (the top
      // quarter hides behind the deck, so only what hangs below the tile is drawn).
      const part = ART[(S.road[t] ? (deep ? 'skybridge' : 'bridge') : 'railbridge') + '-pier'];
      if (part) {
        const img = artMip(part, z * (R.drawScale || 1));
        ctx.drawImage(img, 0, img.height * 0.25, img.width, img.height * 0.75, x, y + z, z, z * 1.5);
      } else if (deep) {
        const len = z * 1.15;
        for (const s of [-1, 1]) {
          const px = cx + s * 5 * u - 2 * u;
          const g = ctx.createLinearGradient(0, y + z, 0, y + z + len);
          g.addColorStop(0, '#6c747d'); g.addColorStop(0.55, 'rgba(48,46,46,0.75)'); g.addColorStop(1, 'rgba(14,10,9,0)');
          ctx.fillStyle = g; ctx.fillRect(px, y + z, 4 * u, len);
          ctx.fillStyle = 'rgba(255,240,215,0.18)'; ctx.fillRect(px, y + z, 1 * u, len * 0.6); // lit west side
        }
        // Cross-bracing between the two columns.
        ctx.strokeStyle = 'rgba(110,118,128,0.8)'; ctx.lineWidth = Math.max(1, u);
        ctx.beginPath();
        for (const k of [0, 1]) {
          const a = y + z + (2 + k * 9) * u, b = a + 8 * u;
          ctx.moveTo(cx - 3 * u, a); ctx.lineTo(cx + 3 * u, b); ctx.moveTo(cx + 3 * u, a); ctx.lineTo(cx - 3 * u, b);
        }
        ctx.stroke();
      } else {
        ctx.fillStyle = '#5c646d'; ctx.fillRect(cx - 4 * u, y + z, 8 * u, 6 * u);
        ctx.fillStyle = 'rgba(255,255,255,0.15)'; ctx.fillRect(cx - 4 * u, y + z, 2 * u, 6 * u);
        ctx.strokeStyle = 'rgba(220,240,240,0.35)'; ctx.lineWidth = Math.max(1, u);
        ctx.beginPath(); ctx.ellipse(cx, y + z + 6 * u, 7 * u, 2 * u, 0, 0, Math.PI * 2); ctx.stroke();
      }
    }
    if (!deep) continue;
    // Towers: at a canyon span's landing ends, where the span runs straight on for 3+ tiles.
    ARM_DIRS.forEach(([di, dj], k) => {
      if (!arms[k] || !inMap(i + di, j + dj) || S.terrain[tIdx(i + di, j + dj)] !== T_GROUND) return;
      let L = 1, ci = i, cj = j, landed = false;
      while (L < 40) {
        const ni = ci - di, nj = cj - dj;
        if (!inMap(ni, nj)) break;
        const nt = tIdx(ni, nj);
        if (!bridgeArms(ci, cj, tIdx(ci, cj))[ARM_DIRS.findIndex(([a, b]) => a === -di && b === -dj)]) break;
        if (S.terrain[nt] === T_GROUND) { landed = true; break; }
        if (!onBridge(nt)) break;
        ci = ni; cj = nj; L++;
      }
      if (L < 3) return;
      towers.push({ x: cx, y: y + z / 2, di, dj, L, landed, hw });
    });
  }
  // Back towers first (the north and west ones), so nearer ones stand in front.
  towers.sort((a, b) => a.y - b.y);
  if (ART['skybridge-tower']) { drawTowerArt(ctx, towers, z); return; }
  for (const tw of towers) {
    const ax = -tw.di, ay = -tw.dj;            // along the span, out from the landing
    const pxv = -ay, pyv = ax;                 // across it
    const bx = tw.x - ax * (z / 2 - 5 * u), by = tw.y - ay * (z / 2 - 5 * u);
    const Ht = z * 0.75, hMin = z * 0.1, D = tw.L * z / 2 - 5 * u;
    const sides = [-1, 1].map((s) => ({ x: bx + pxv * s * (tw.hw + 1.5 * u), y: by + pyv * s * (tw.hw + 1.5 * u) })).sort((a, b) => a.y - b.y);
    // Cables and hangers to mid-span (the far tower draws the other half).
    if (tw.landed) {
      for (const p of sides) {
        const at = (s) => ({ x: p.x + ax * D * s, y: p.y + ay * D * s, h: hMin + (Ht - hMin) * (1 - s) * (1 - s) });
        ctx.strokeStyle = 'rgba(205,212,220,0.55)'; ctx.lineWidth = Math.max(0.75, 0.6 * u);
        ctx.beginPath();
        for (let s = 0.12; s < 1; s += 0.5 / tw.L) { const q = at(s); ctx.moveTo(q.x, q.y - q.h); ctx.lineTo(q.x, q.y); }
        ctx.stroke();
        ctx.strokeStyle = '#d9dee4'; ctx.lineWidth = Math.max(1, 1.3 * u);
        ctx.beginPath();
        for (let k = 0; k <= 16; k++) { const q = at(k / 16); if (k) ctx.lineTo(q.x, q.y - q.h); else ctx.moveTo(q.x, q.y - q.h); }
        ctx.stroke();
      }
    }
    // The two legs, then the portal beams across their tops.
    for (const p of sides) {
      const g = ctx.createLinearGradient(p.x - 2 * u, 0, p.x + 2 * u, 0);
      g.addColorStop(0, '#c9ced4'); g.addColorStop(1, '#5d656e');
      ctx.fillStyle = 'rgba(0,0,0,0.3)'; ctx.fillRect(p.x - 1.5 * u, p.y - 1 * u, 5 * u, 3 * u);
      ctx.fillStyle = g; ctx.fillRect(p.x - 2 * u, p.y - Ht, 4 * u, Ht);
      ctx.fillStyle = '#e9edf1'; ctx.fillRect(p.x - 2.5 * u, p.y - Ht - 1.5 * u, 5 * u, 2 * u);
    }
    ctx.strokeStyle = '#9aa2ab'; ctx.lineWidth = Math.max(1.5, 2.2 * u);
    ctx.beginPath();
    for (const f of [1, 0.62]) { ctx.moveTo(sides[0].x, sides[0].y - Ht * f); ctx.lineTo(sides[1].x, sides[1].y - Ht * f); }
    ctx.stroke();
    // A red warning lamp on each tower top, blinking slowly.
    if (Math.sin(R.time * 2.4 + tw.x * 0.01) > -0.2) {
      ctx.fillStyle = 'rgba(255,70,60,0.9)';
      for (const p of sides) { ctx.beginPath(); ctx.arc(p.x, p.y - Ht - 2 * u, 1.3 * u + 0.5, 0, Math.PI * 2); ctx.fill(); }
    }
  }
}

/**
 * A bridge (road over water or a canyon: drawn by drawBridge) or a tunnel (road through rock:
 * a dark bore with lamps, and a concrete portal where it comes out of the crags).
 */
function drawCrossing(ctx, i, j, x, y, t) {
  const c = TP / 2;
  if (S.terrain[t] !== T_ROCK) { drawBridge(ctx, i, j, x, y, t, false); drawRoadArrow(ctx, t, x, y); return; }
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
  {
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

/**
 * How far a Silo's missile has risen into view: 0 while it isn't ready, climbing to 1 over
 * SILO_RISE seconds once it is (instantly for a Silo that was ready when first drawn).
 */
const SILO_RISE = 0.8;
function siloRise(b, ready) {
  const m = R.siloSeen || (R.siloSeen = new Map());
  if (!ready) { m.set(b.id, -1); return 0; }
  let t0 = m.get(b.id);
  if (t0 === undefined) { m.set(b.id, -Infinity); return 1; }
  if (t0 === -1) { t0 = R.time; m.set(b.id, t0); }
  return Math.min(1, (R.time - t0) / SILO_RISE);
}

/** Draw one building at screen centre (cx, cy), tile size s px. `b` may be a stub for menu icons. */
function drawBuilding(ctx, type, cx, cy, s, owner, b) {
  const color = PLAYER_COLORS[owner];
  const t = R.time;
  const working = b && b.working;
  if (b && !b.built) { drawSite(ctx, type, cx, cy, s, owner, b); return; }
  // A deployed Crawler is drawn as the vehicle (turned the way it parked, unfolding), not as a building image.
  let art = type === 'crawlerbase' ? null : artFor(type, owner), full = null, fade = 1;
  // A Silo shows its missile only once it's ready to fire (a Nuclear Silo: once it's armed); the
  // missile fades in as it's raised.
  if (art && b && b.built && (type === 'silo' || type === 'nukesilo')) {
    const empty = artFor(type + '-empty', owner);
    const k = siloRise(b, type === 'silo' ? siloReady(b) : !!b.armed);
    if (empty && k < 1) { full = k > 0 ? art : null; fade = k; art = empty; }
  }
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
    if (full) { ctx.globalAlpha = fade; drawArt(ctx, full, cx, cy, s); ctx.globalAlpha = 1; }
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
  if (type === 'wall' || type === 'gate') { drawBarrier(ctx, type, cx, cy, s, owner, b); return; }
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
    case 'nest': { drawNest(ctx, cx, cy, s, b); break; }
    case 'station': {
      // A platform with a canopy beside the track, crates stacked under it and the team colour on the roof.
      hullBase(ctx, cx, cy, s, color);
      ctx.fillStyle = '#9aa1ab';
      ctx.fillRect(cx - 12 * u, cy - 3 * u, 24 * u, 12 * u);
      ctx.fillStyle = '#c99a66';
      for (const [bx, by] of [[-9, 0], [-4, 0], [-9, 4]]) ctx.fillRect(cx + bx * u, cy + by * u, 4 * u, 3.5 * u);
      ctx.fillStyle = '#3c4148';
      ctx.fillRect(cx - 13 * u, cy - 11 * u, 26 * u, 7 * u);
      ctx.fillStyle = color;
      ctx.fillRect(cx - 13 * u, cy - 11 * u, 26 * u, 2 * u);
      ctx.strokeStyle = '#3c4148'; ctx.lineWidth = 1.6 * u;
      ctx.beginPath(); ctx.moveTo(cx - 11 * u, cy - 4 * u); ctx.lineTo(cx - 11 * u, cy + 9 * u); ctx.moveTo(cx + 11 * u, cy - 4 * u); ctx.lineTo(cx + 11 * u, cy + 9 * u); ctx.stroke();
      ctx.fillStyle = '#ffd166';
      ctx.fillRect(cx + 3 * u, cy + 2 * u, 7 * u, 2 * u);
      break;
    }
    case 'crawlerbase': { drawCrawler(ctx, b && b.face !== undefined ? b.face : -Math.PI / 2, cx, cy, s, owner, true, 0, working, b); break; }
    case 'viaduct': {
      // An abutment: a concrete block keyed into the clifftop, the deck starting out of it toward
      // the far end, bollards where the railings end and a team-coloured lamp.
      let ax = 1, ay = 0;
      const far = b && b.link ? getE(b.link) : null;
      const to = far ? far.y * S.W + far.x : b && b.viaTo >= 0 ? b.viaTo : -1;
      if (b && to >= 0) { const tx = to % S.W, ty = (to / S.W) | 0; ax = Math.sign(tx - b.x); ay = Math.sign(ty - b.y); }
      const px = -ay, py = ax, hw = 9 * u;
      ctx.fillStyle = 'rgba(20,10,5,0.3)';
      ctx.fillRect(cx - 12 * u + 2 * u, cy - 12 * u + 3 * u, 24 * u, 24 * u);
      ctx.fillStyle = '#7f7a72'; ctx.fillRect(cx - 12 * u, cy + 6 * u, 24 * u, 6 * u);   // the block's face
      ctx.fillStyle = '#b8b2a7'; ctx.fillRect(cx - 12 * u, cy - 12 * u, 24 * u, 18 * u); // its top
      ctx.fillStyle = 'rgba(255,255,255,0.25)'; ctx.fillRect(cx - 12 * u, cy - 12 * u, 24 * u, 1.5 * u);
      // The deck from the middle of the block out to the span.
      ctx.save(); ctx.translate(cx, cy); ctx.rotate(Math.atan2(ay, ax));
      ctx.fillStyle = '#2a2f35'; ctx.fillRect(0, -hw - 1.5 * u, 16 * u, 2 * hw + 3 * u);
      ctx.fillStyle = '#a3a9ae'; ctx.fillRect(-4 * u, -hw, 20 * u, 2 * hw);
      ctx.fillStyle = '#dfe3e8'; ctx.fillRect(0, -hw, 16 * u, 1.3 * u); ctx.fillRect(0, hw - 1.3 * u, 16 * u, 1.3 * u);
      ctx.restore();
      ctx.fillStyle = '#e8e4dc';
      for (const sgn of [-1, 1]) { ctx.beginPath(); ctx.arc(cx + px * sgn * (hw + 1 * u) - ax * 3 * u, cy + py * sgn * (hw + 1 * u) - ay * 3 * u, 2.2 * u, 0, Math.PI * 2); ctx.fill(); }
      ctx.fillStyle = color; ctx.beginPath(); ctx.arc(cx - ax * 7 * u - px * 7 * u, cy - ay * 7 * u - py * 7 * u, 2 * u, 0, Math.PI * 2); ctx.fill();
      break;
    }
    case 'ropeway': {
      // A lattice pylon on a concrete footing, with the bull wheel the cable runs round on top.
      ctx.fillStyle = 'rgba(20,10,5,0.32)';
      ctx.beginPath(); ctx.ellipse(cx + 3 * u, cy + 10 * u, 12 * u, 5 * u, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#8d939c';
      roundRect(ctx, cx - 11 * u, cy + 3 * u, 22 * u, 9 * u, 2 * u); ctx.fill();
      ctx.fillStyle = '#6a7079';
      ctx.fillRect(cx - 11 * u, cy + 9 * u, 22 * u, 3 * u);
      ctx.strokeStyle = '#3c4148'; ctx.lineWidth = 2.2 * u;
      ctx.beginPath();
      ctx.moveTo(cx - 8 * u, cy + 6 * u); ctx.lineTo(cx - 2 * u, cy - ROPE_TOP * 32 * u);
      ctx.moveTo(cx + 8 * u, cy + 6 * u); ctx.lineTo(cx + 2 * u, cy - ROPE_TOP * 32 * u);
      for (let k = 0; k < 3; k++) { const y0 = cy + 4 * u - k * 7 * u, y1 = y0 - 7 * u, w0 = 7 - k * 1.8, w1 = w0 - 1.8; ctx.moveTo(cx - w0 * u, y0); ctx.lineTo(cx + w1 * u, y1); ctx.moveTo(cx + w0 * u, y0); ctx.lineTo(cx - w1 * u, y1); }
      ctx.stroke();
      ctx.fillStyle = color;
      ctx.fillRect(cx - 7 * u, cy + 4 * u, 14 * u, 2 * u);
      ctx.strokeStyle = '#d8dde4'; ctx.lineWidth = 2 * u;
      ctx.beginPath(); ctx.arc(cx, cy - ROPE_TOP * 32 * u, 4 * u, 0, Math.PI * 2); ctx.stroke();
      ctx.fillStyle = color;
      ctx.beginPath(); ctx.arc(cx, cy - ROPE_TOP * 32 * u, 1.6 * u, 0, Math.PI * 2); ctx.fill();
      break;
    }
    case 'lab': {
      // A research dome on a plinth, with a dish and a glowing band (brighter while it works).
      ctx.fillStyle = 'rgba(20,10,5,0.32)';
      ctx.beginPath(); ctx.ellipse(cx + 2 * u, cy + 9 * u, 15 * u, 8 * u, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#4b525e';
      roundRect(ctx, cx - 14 * u, cy - 2 * u, 28 * u, 14 * u, 3 * u); ctx.fill();
      ctx.fillStyle = '#6a7381';
      roundRect(ctx, cx - 14 * u, cy - 4 * u, 28 * u, 10 * u, 3 * u); ctx.fill();
      ctx.strokeStyle = color; ctx.lineWidth = Math.max(1.2, 1.6 * u);
      ctx.beginPath(); ctx.moveTo(cx - 12 * u, cy + 7 * u); ctx.lineTo(cx + 12 * u, cy + 7 * u); ctx.stroke();
      const dg = ctx.createRadialGradient(cx - 4 * u, cy - 12 * u, 2 * u, cx, cy - 6 * u, 13 * u);
      dg.addColorStop(0, '#f4f7fb'); dg.addColorStop(1, '#8e9aab');
      ctx.fillStyle = dg;
      ctx.beginPath(); ctx.ellipse(cx, cy - 2 * u, 11 * u, 4 * u, 0, 0, Math.PI); ctx.lineTo(cx - 11 * u, cy - 2 * u);
      ctx.ellipse(cx, cy - 2 * u, 11 * u, 13 * u, 0, Math.PI, Math.PI * 2); ctx.fill();
      const glow = working ? 0.65 + 0.35 * Math.sin(t * 5) : 0.35;
      ctx.strokeStyle = color; ctx.globalAlpha = glow; ctx.lineWidth = 2.2 * u;
      ctx.beginPath(); ctx.ellipse(cx, cy - 6 * u, 10.4 * u, 3.2 * u, 0, 0, Math.PI); ctx.stroke();
      ctx.globalAlpha = 1;
      ctx.strokeStyle = '#d8dde4'; ctx.lineWidth = 1.4 * u;
      ctx.beginPath(); ctx.moveTo(cx + 5 * u, cy - 13 * u); ctx.lineTo(cx + 9 * u, cy - 19 * u); ctx.stroke();
      ctx.fillStyle = '#d8dde4';
      ctx.beginPath(); ctx.ellipse(cx + 10 * u, cy - 20 * u, 4 * u, 2 * u, -0.6, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = working && Math.floor(t * 3) % 2 ? '#fff6b0' : color;
      ctx.beginPath(); ctx.arc(cx - 6 * u, cy - 14 * u, 1.6 * u, 0, Math.PI * 2); ctx.fill();
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
      if (!b || (b.stock && siloReady(b))) {
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

/**
 * Walls and Gates: raised Cement blocks that join up with the Walls and Gates beside them (same
 * owner), with a team-coloured stripe along the top. A Gate is a gap in the wall with the road
 * running through it and a barrier arm that lifts while one of its owner's bots goes through.
 */
function drawBarrier(ctx, type, cx, cy, s, owner, b) {
  const color = PLAYER_COLORS[owner];
  const has = b && b.x !== undefined;
  const link = (di, dj) => {
    if (!has || !inMap(b.x + di, b.y + dj)) return false;
    const n = S.bAt[tIdx(b.x + di, b.y + dj)] ? getE(S.bAt[tIdx(b.x + di, b.y + dj)]) : null;
    return !!n && n.owner === owner && !!BDEFS[n.type].barrier;
  };
  const roadAt = (di, dj) => has && inMap(b.x + di, b.y + dj) && roadLike(tIdx(b.x + di, b.y + dj));
  // [north, east, south, west]
  let c = [link(0, -1), link(1, 0), link(0, 1), link(-1, 0)];
  if (!has) c = [false, true, false, true]; // menu icon: a stretch of wall
  const half = s / 2, a = s * 0.3, h = s * 0.2, x0 = cx - half, y0 = cy - half;
  const rects = [];
  let lane = null; // a Gate's passage: 'v' (road runs north-south) or 'h'
  if (type === 'gate') {
    const rv = (roadAt(0, -1) ? 1 : 0) + (roadAt(0, 1) ? 1 : 0), rh = (roadAt(-1, 0) ? 1 : 0) + (roadAt(1, 0) ? 1 : 0);
    lane = rv > rh ? 'v' : rh > rv ? 'h' : (c[1] || c[3]) ? 'v' : (c[0] || c[2]) ? 'h' : 'v';
    // Road surface through the gap.
    const rw = s * 0.44;
    ctx.fillStyle = '#5d636b';
    if (lane === 'v') ctx.fillRect(cx - rw / 2 - 2, y0, rw + 4, s); else ctx.fillRect(x0, cy - rw / 2 - 2, s, rw + 4);
    ctx.fillStyle = '#b9bec5';
    if (lane === 'v') ctx.fillRect(cx - rw / 2, y0, rw, s); else ctx.fillRect(x0, cy - rw / 2, s, rw);
    // Two pillars either side of the road, reaching out to the wall on each side.
    const p = s * 0.24;
    if (lane === 'v') { rects.push([x0, cy - a, p, a * 2], [x0 + s - p, cy - a, p, a * 2]); }
    else { rects.push([cx - a, y0, a * 2, p], [cx - a, y0 + s - p, a * 2, p]); }
  } else {
    rects.push([cx - a, cy - a, a * 2, a * 2]);
    if (c[0]) rects.push([cx - a, y0, a * 2, half]);
    if (c[2]) rects.push([cx - a, cy, a * 2, half]);
    if (c[3]) rects.push([x0, cy - a, half, a * 2]);
    if (c[1]) rects.push([cx, cy - a, half, a * 2]);
  }
  // Shadow, the front face (the block's base, seen below the raised top) and the top.
  ctx.fillStyle = 'rgba(10,8,6,0.3)';
  for (const r of rects) ctx.fillRect(r[0] + s * 0.06, r[1] + s * 0.05, r[2], r[3]);
  ctx.fillStyle = '#6e7177';
  for (const r of rects) ctx.fillRect(r[0], r[1], r[2], r[3]);
  ctx.fillStyle = '#4f5257';
  for (const r of rects) ctx.fillRect(r[0], r[1] + r[3] - Math.min(h * 0.45, r[3] * 0.4), r[2], Math.min(h * 0.45, r[3] * 0.4));
  ctx.fillStyle = '#c3c6cb';
  for (const r of rects) ctx.fillRect(r[0], r[1] - h, r[2], r[3]);
  // Block joints and a light top edge.
  ctx.strokeStyle = 'rgba(80,84,92,0.55)';
  ctx.lineWidth = Math.max(1, s * 0.025);
  ctx.beginPath();
  for (const r of rects) {
    if (r[2] >= r[3]) for (let k = 1; k < 3; k++) { const x = r[0] + (r[2] * k) / 3; ctx.moveTo(x, r[1] - h); ctx.lineTo(x, r[1] - h + r[3]); }
    else for (let k = 1; k < 3; k++) { const y = r[1] - h + (r[3] * k) / 3; ctx.moveTo(r[0], y); ctx.lineTo(r[0] + r[2], y); }
  }
  ctx.stroke();
  ctx.fillStyle = 'rgba(255,255,255,0.35)';
  for (const r of rects) ctx.fillRect(r[0], r[1] - h, r[2], Math.max(1, s * 0.03));
  // The owner's stripe along the top.
  const st = Math.max(1.5, s * 0.07);
  ctx.fillStyle = color;
  if (type === 'gate') {
    for (const r of rects) {
      if (lane === 'v') ctx.fillRect(r[0], cy - h - st / 2, r[2], st);
      else ctx.fillRect(cx - st / 2, r[1] - h, st, r[3]);
    }
    // Gate posts: taller, darker blocks either side of the road, each with a light in the owner's colour.
    const pw = s * 0.24, ph = h * 0.9, posts = lane === 'v'
      ? [[x0, cy - a * 1.05, pw, a * 2.1], [x0 + s - pw, cy - a * 1.05, pw, a * 2.1]]
      : [[cx - a * 1.05, y0, a * 2.1, pw], [cx - a * 1.05, y0 + s - pw, a * 2.1, pw]];
    for (const r of posts) {
      ctx.fillStyle = '#3d4045';
      ctx.fillRect(r[0], r[1] - h, r[2], r[3] + h);
      ctx.fillStyle = '#8e939b';
      ctx.fillRect(r[0], r[1] - h - ph, r[2], r[3]);
      ctx.fillStyle = 'rgba(255,255,255,0.4)';
      ctx.fillRect(r[0], r[1] - h - ph, r[2], Math.max(1, s * 0.03));
      ctx.fillStyle = color;
      ctx.beginPath(); ctx.arc(r[0] + r[2] / 2, r[1] + r[3] / 2 - h - ph, Math.max(1.5, s * 0.06), 0, Math.PI * 2); ctx.fill();
    }
    // The barrier arm: across the road, or lifted while a friendly bot passes.
    let open = false;
    if (has) for (const v of S.bots) if (!v.dead && !v.inside && v.owner === owner && Math.abs(v.x - (b.x + 0.5)) < 0.9 && Math.abs(v.y - (b.y + 0.5)) < 0.9) { open = true; break; }
    const len = s - pw * 2, bh = Math.max(2, s * 0.09);
    ctx.save();
    if (lane === 'v') { ctx.translate(x0 + pw, cy - h * 1.2); if (open) ctx.rotate(-1.2); }
    else { ctx.translate(cx, y0 + pw - h * 1.2); ctx.rotate(Math.PI / 2); if (open) ctx.rotate(-1.2); }
    ctx.fillStyle = '#f2f2f2';
    ctx.fillRect(0, -bh / 2, len, bh);
    ctx.fillStyle = color;
    for (let k = 0; k < 4; k++) if (k % 2 === 0) ctx.fillRect((len * k) / 4, -bh / 2, len / 4, bh);
    ctx.restore();
  } else {
    ctx.fillRect(cx - st / 2, cy - h - st / 2, st, st);
    if (c[0]) ctx.fillRect(cx - st / 2, y0 - h, st, half);
    if (c[2]) ctx.fillRect(cx - st / 2, cy - h, st, half);
    if (c[3]) ctx.fillRect(x0, cy - h - st / 2, half, st);
    if (c[1]) ctx.fillRect(cx, cy - h - st / 2, half, st);
  }
  // Cracks once it has taken a beating.
  if (b && b.built && b.armor < BDEFS[type].armor * 0.6) {
    ctx.strokeStyle = 'rgba(30,30,34,0.75)';
    ctx.lineWidth = Math.max(1, s * 0.03);
    ctx.beginPath();
    const r = rects[0];
    ctx.moveTo(r[0] + r[2] * 0.2, r[1] - h + r[3] * 0.15); ctx.lineTo(r[0] + r[2] * 0.45, r[1] - h + r[3] * 0.5); ctx.lineTo(r[0] + r[2] * 0.35, r[1] - h + r[3] * 0.85);
    if (b.armor < BDEFS[type].armor * 0.3) { ctx.moveTo(r[0] + r[2] * 0.8, r[1] - h + r[3] * 0.2); ctx.lineTo(r[0] + r[2] * 0.6, r[1] - h + r[3] * 0.55); }
    ctx.stroke();
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
    drawBuilding(ctx, type, cx, cy, s, owner, { built: true, garrison: [], aim: -Math.PI / 2, x: b.x, y: b.y });
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

/**
 * Railway track on the baked map: sleepers and two rails toward every joined neighbour (a level
 * crossing over a road keeps the road showing between the rails).
 */
/** Draw art image `art` over tile (x, y), turned `quarter` quarter-turns clockwise. */
function drawTileArt(ctx, art, x, y, quarter) {
  const img = artMip(art, TP * (ctx.hdScale || 1) * (R.drawScale || 1));
  if (!quarter) { ctx.drawImage(img, x, y, TP, TP); return; }
  ctx.save(); ctx.translate(x + TP / 2, y + TP / 2); ctx.rotate((quarter * Math.PI) / 2);
  ctx.drawImage(img, -TP / 2, -TP / 2, TP, TP);
  ctx.restore();
}

/**
 * Which track piece tile t needs, and how far to turn it (quarter turns clockwise), from the art's
 * pieces: straight (west–east), curve (west–south), tee (west–east and south), cross, end (track from
 * the west), and a level crossing (track west–east over a road running north–south). Null for no track.
 */
function railPiece(t) {
  const i = t % S.W, j = (t / S.W) | 0;
  const has = (di, dj) => {
    if (!inMap(i + di, j + dj)) return false;
    const u = tIdx(i + di, j + dj);
    return railStep(t, u) || (S.bAt[t] > 0 && viaLink(t) >= 0 && Math.sign((viaLink(t) % S.W) - i) === di && Math.sign(((viaLink(t) / S.W) | 0) - j) === dj);
  };
  const N = has(0, -1), E = has(1, 0), So = has(0, 1), Wd = has(-1, 0), n = N + E + So + Wd;
  if (S.road[t] && n <= 2 && !((N || So) && (E || Wd))) return { key: 'rail-level-crossing', q: N || So ? 1 : 0 };
  if (n === 0) return { key: 'rail-straight', q: 0 };
  if (n === 1) return { key: 'rail-end', q: Wd ? 0 : N ? 1 : E ? 2 : 3 };
  if (n === 2) {
    if (E && Wd) return { key: 'rail-straight', q: 0 };
    if (N && So) return { key: 'rail-straight', q: 1 };
    return { key: 'rail-curve', q: Wd && So ? 0 : N && Wd ? 1 : E && N ? 2 : 3 };
  }
  if (n === 3) return { key: 'rail-tee', q: !N ? 0 : !E ? 1 : !So ? 2 : 3 };
  return { key: 'rail-cross', q: 0 };
}

function drawRail(ctx, i, j, x, y, t) {
  const pc = ART['rail-straight'] ? railPiece(t) : null;
  if (pc && ART[pc.key]) { drawTileArt(ctx, ART[pc.key], x, y, pc.q); return; }
  const dirs = [];
  for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
    if (!inMap(i + di, j + dj)) continue;
    if (railStep(t, tIdx(i + di, j + dj))) dirs.push([di, dj]);
  }
  if (!dirs.length) dirs.push([1, 0], [-1, 0]);
  const c = TP / 2, road = S.road[t];
  for (const [di, dj] of dirs) {
    // Sleepers across the half-tile toward this neighbour.
    ctx.fillStyle = road ? 'rgba(70,74,82,0.85)' : bridgeable(t) ? '#33271e' : '#5e4a3a';
    for (let k = 0; k < 3; k++) {
      const f = (k + 0.5) / 3 * 0.5;
      const sx = x + c + di * TP * f, sy = y + c + dj * TP * f;
      if (di) ctx.fillRect(sx - 2, y + c - 9, 4, 18); else ctx.fillRect(x + c - 9, sy - 2, 18, 4);
    }
  }
  for (const [di, dj] of dirs) {
    for (const off of [-5.5, 5.5]) {
      ctx.strokeStyle = 'rgba(20,20,24,0.55)'; ctx.lineWidth = 3;
      ctx.beginPath();
      if (di) { ctx.moveTo(x + c, y + c + off + 1); ctx.lineTo(x + c + di * c, y + c + off + 1); } else { ctx.moveTo(x + c + off + 1, y + c); ctx.lineTo(x + c + off + 1, y + c + dj * c); }
      ctx.stroke();
      ctx.strokeStyle = '#c9ced6'; ctx.lineWidth = 2;
      ctx.beginPath();
      if (di) { ctx.moveTo(x + c, y + c + off); ctx.lineTo(x + c + di * c, y + c + off); } else { ctx.moveTo(x + c + off, y + c); ctx.lineTo(x + c + off, y + c + dj * c); }
      ctx.stroke();
    }
  }
}

/**
 * A Freight Train: a locomotive and four wagons, each wagon following the track the locomotive took
 * (the same trail as a Road Train's trailers). The load is spread over the wagons.
 */
function drawFreightTrain(ctx, u, sx, sy, s) {
  const color = PLAYER_COLORS[u.owner];
  const trails = R.trails || (R.trails = new Map());
  let tr = trails.get(u.id);
  if (!tr) { tr = [{ x: u.x, y: u.y }]; for (let k = 1; k <= 12; k++) tr.push({ x: u.x - Math.cos(u.face || 0) * k * 0.3, y: u.y - Math.sin(u.face || 0) * k * 0.3 }); trails.set(u.id, tr); }
  if (dist2(tr[0].x, tr[0].y, u.x, u.y) > 0.0025) tr.unshift({ x: u.x, y: u.y });
  let len = 0;
  for (let k = 1; k < tr.length; k++) { len += Math.sqrt(dist2(tr[k - 1].x, tr[k - 1].y, tr[k].x, tr[k].y)); if (len > 3.6) { tr.length = k + 1; break; } }
  const at = (d) => {
    let acc = 0;
    for (let k = 1; k < tr.length; k++) {
      const a = tr[k - 1], b = tr[k], l = Math.sqrt(dist2(a.x, a.y, b.x, b.y));
      if (acc + l >= d && l > 0) { const f = (d - acc) / l; return { x: a.x + (b.x - a.x) * f, y: a.y + (b.y - a.y) * f }; }
      acc += l;
    }
    const e = tr[tr.length - 1];
    return { x: e.x, y: e.y };
  };
  const n = u.carry ? u.carryN || 1 : 0;
  // The art: each car is 8 of its frame's 10 units coupler to coupler (0.62 tiles), so cars sit 0.62
  // tiles apart along the track, each turned to its own bit of the curve. Flat cars and hoppers alternate.
  const loco = ART['freight-loco@' + u.owner + '-f0'];
  if (loco) {
    const size = s * 0.775, n = u.carry ? u.carryN || 1 : 0;
    const cars = [];
    for (let k = 0; k <= 4; k++) {
      const d = k * 0.62, p = at(d), f = at(Math.max(0, d - 0.25)), b = at(d + 0.25);
      cars.push({ k, x: sx + (p.x - u.x) * s, y: sy + (p.y - u.y) * s, ang: Math.atan2(f.y - b.y, f.x - b.x) });
    }
    for (const c of cars) drawBotShadow(ctx, { face: c.ang }, c.x, c.y, size * 0.42, size * 0.2);
    for (let k = 4; k >= 1; k--) {
      const c = cars[k], hopper = k % 2 === 0, art = artFor(hopper ? 'freight-wagon-hopper' : 'freight-wagon-flat', u.owner);
      drawArt(ctx, art, c.x, c.y, size, c.ang);
      const load = Math.max(0, Math.min(14, n - (k - 1) * 14));
      // Load: the flat car's deck (x 40–216, y 81–175) or the hopper's opening (x 45–211, y 82–174).
      if (load > 0) drawTruckCargo(ctx, { carry: u.carry, carryN: Math.ceil((load / 14) * 8), face: c.ang }, c.x, c.y, ((hopper ? 45 : 40) - 128) / 256 * size, (hopper ? 166 : 176) / 256 * size, (hopper ? 92 : 94) / 256 * size, s);
    }
    const fr = ART['freight-loco@' + u.owner + '-f' + (Math.floor((u.odo || 0) / FRAME_STEP) % 4)] || loco;
    drawArt(ctx, fr, sx, sy, size, u.face || 0);
    if (ART['freight-loco-lights']) drawArt(ctx, ART['freight-loco-lights'], sx, sy, size, u.face || 0);
    if (u.drive < 0 && ART['freight-loco-brake']) drawArt(ctx, ART['freight-loco-brake'], sx, sy, size, u.face || 0);
    if (u.drive > 0 && ART['freight-loco-exhaust']) { ctx.globalAlpha = clamp(1 - (u.vel || 0) / (u.vtop || 1), 0.3, 1); drawArt(ctx, ART['freight-loco-exhaust'], sx, sy, size, u.face || 0); ctx.globalAlpha = 1; }
    return;
  }
  const car = (d, loco, load) => {
    const p = at(d), f = at(Math.max(0, d - 0.25)), b = at(d + 0.25);
    const ang = Math.atan2(f.y - b.y, f.x - b.x);
    const x = sx + (p.x - u.x) * s, y = sy + (p.y - u.y) * s, Lc = s * 0.62, Wc = s * 0.32;
    ctx.save();
    ctx.translate(x, y);
    ctx.fillStyle = 'rgba(20,10,5,0.3)';
    ctx.beginPath(); ctx.ellipse(s * 0.03, s * 0.05, Lc * 0.55, Wc * 0.6, ang, 0, Math.PI * 2); ctx.fill();
    ctx.rotate(ang);
    ctx.fillStyle = '#2b2f36';
    roundRect(ctx, -Lc / 2, -Wc / 2, Lc, Wc, s * 0.04); ctx.fill();
    if (loco) {
      ctx.fillStyle = '#5a616b'; roundRect(ctx, -Lc / 2 + s * 0.03, -Wc / 2 + s * 0.03, Lc * 0.62, Wc - s * 0.06, s * 0.03); ctx.fill();
      ctx.fillStyle = color; roundRect(ctx, Lc * 0.12, -Wc / 2, Lc * 0.38, Wc, s * 0.05); ctx.fill();
      ctx.fillStyle = '#16212b'; ctx.fillRect(Lc * 0.36, -Wc * 0.34, Lc * 0.08, Wc * 0.68);
      ctx.fillStyle = '#fff6b0'; ctx.beginPath(); ctx.arc(Lc / 2, 0, s * 0.03, 0, Math.PI * 2); ctx.fill();
    } else {
      ctx.fillStyle = '#5a616b'; ctx.fillRect(-Lc / 2 + s * 0.03, -Wc / 2 + s * 0.03, Lc - s * 0.06, Wc - s * 0.06);
      ctx.fillStyle = color; ctx.fillRect(-Lc / 2 + s * 0.03, -Wc / 2 + s * 0.02, Lc - s * 0.06, s * 0.02);
    }
    ctx.restore();
    if (load > 0) drawTruckCargo(ctx, { carry: u.carry, carryN: load, face: ang }, x, y, -Lc / 2 + s * 0.05, Lc - s * 0.1, Wc - s * 0.08, s);
  };
  // Wagons back to front, then the locomotive on top.
  for (let k = 4; k >= 1; k--) car(k * 0.68, false, Math.max(0, Math.min(8, Math.ceil((n - (k - 1) * 10) * 0.8))));
  car(0, true, 0);
}

/**
 * The Crawler's art (straight down, facing right; the frame is 20 units, the Crawler 18, so 1.67
 * tiles for its 1.5): eight tread frames by distance driven, with the sensor dish spinning on its
 * pivot (180, 256 of 512) and the headlights and dust on top; for two seconds after it stops it plays
 * its unfolding (deploy frames d0–d9, the dish easing back to straight ahead; d8 on have the raised
 * dish built in), and the same backwards when it packs up; deployed, the standing base.
 */
const CRAWLER_UNFOLD = 2;
function drawCrawlerArt(ctx, face, x, y, s, owner, deployed, odo, e) {
  const size = s * 1.67;
  let d = -1;
  if (deployed) {
    const k = e && e.deployedAt !== undefined ? (S.time - e.deployedAt) / CRAWLER_UNFOLD : 1;
    d = k >= 1 ? 9 : clamp(Math.floor(k * 10), 0, 9);
  } else if (e && e.packedAt !== undefined && S.time - e.packedAt < CRAWLER_UNFOLD) {
    d = clamp(9 - Math.floor(((S.time - e.packedAt) / CRAWLER_UNFOLD) * 10), 0, 9);
  }
  ctx.fillStyle = 'rgba(20,10,5,0.3)';
  ctx.beginPath(); ctx.ellipse(x + s * 0.08, y + s * 0.12, size * 0.47, size * 0.33, face, 0, Math.PI * 2); ctx.fill();
  const moving = !deployed && d < 0 && e && e.moved;
  if (moving && ART['crawler-dust']) { ctx.globalAlpha = 0.75; drawArt(ctx, ART['crawler-dust'], x, y, size, face); ctx.globalAlpha = 1; }
  const art = d === 9 && deployed ? artFor('crawlerbase', owner)
    : d >= 0 ? ART['crawler-deploy@' + owner + '-d' + d]
    : ART['crawler@' + owner + '-f' + (Math.floor((odo || 0) / (FRAME_STEP * 0.5)) % 8)];
  if (art) drawArt(ctx, art, x, y, size, face);
  if (d < 8 && ART['crawler-dish']) {
    const spin = d >= 0 ? 0 : R.time * 0.9;
    const img = artMip(ART['crawler-dish'], size * (R.drawScale || 1));
    ctx.save(); ctx.translate(x, y); ctx.rotate(face); ctx.translate((180 / 512 - 0.5) * size, 0); ctx.rotate(spin);
    ctx.drawImage(img, (-180 / 512) * size, (-256 / 512) * size, size, size);
    ctx.restore();
  }
  if (!deployed && d < 0 && ART['crawler-lights']) drawArt(ctx, ART['crawler-lights'], x, y, size, face);
}

/**
 * A Crawler: a colossal tracked hull with a cab at the front, a cargo deck and a mast. On the move
 * its treads roll (odo); deployed it stands on four outrigger legs with charging pads lit on its deck.
 */
function drawCrawler(ctx, face, x, y, s, owner, deployed, odo, working, e) {
  if (ART['crawler@' + owner + '-f0']) { drawCrawlerArt(ctx, face, x, y, s, owner, deployed, odo, e); return; }
  const color = PLAYER_COLORS[owner], L = s * 1.5, W = s * 0.95;
  ctx.save();
  ctx.translate(x, y);
  ctx.fillStyle = 'rgba(20,10,5,0.32)';
  ctx.beginPath(); ctx.ellipse(s * 0.06, s * 0.1, L * 0.56, W * 0.6, face, 0, Math.PI * 2); ctx.fill();
  ctx.rotate(face);
  if (deployed) {
    // Outrigger legs braced out at the corners.
    ctx.strokeStyle = '#3c4148'; ctx.lineWidth = s * 0.07; ctx.lineCap = 'round';
    for (const [sx, sy] of [[1, 1], [1, -1], [-1, 1], [-1, -1]]) { ctx.beginPath(); ctx.moveTo(sx * L * 0.38, sy * W * 0.4); ctx.lineTo(sx * L * 0.55, sy * W * 0.66); ctx.stroke(); }
    ctx.fillStyle = '#8d939c';
    for (const [sx, sy] of [[1, 1], [1, -1], [-1, 1], [-1, -1]]) { ctx.beginPath(); ctx.arc(sx * L * 0.55, sy * W * 0.66, s * 0.07, 0, Math.PI * 2); ctx.fill(); }
  }
  // Tracks with tread bars that roll as it drives.
  ctx.fillStyle = '#16181c';
  roundRect(ctx, -L / 2, -W / 2, L, W * 0.24, s * 0.06); ctx.fill();
  roundRect(ctx, -L / 2, W / 2 - W * 0.24, L, W * 0.24, s * 0.06); ctx.fill();
  ctx.strokeStyle = '#3a3e45'; ctx.lineWidth = Math.max(1, s * 0.02);
  const step = L / 12, off = (-(odo * s * 0.8) % step + step) % step;
  ctx.beginPath();
  for (let k = -1; k < 13; k++) { const tx = -L / 2 + off + k * step; if (tx < -L / 2 || tx > L / 2) continue; ctx.moveTo(tx, -W / 2); ctx.lineTo(tx, -W / 2 + W * 0.24); ctx.moveTo(tx, W / 2 - W * 0.24); ctx.lineTo(tx, W / 2); }
  ctx.stroke();
  // Hull and deck.
  ctx.fillStyle = '#4b525e';
  roundRect(ctx, -L * 0.46, -W * 0.36, L * 0.92, W * 0.72, s * 0.08); ctx.fill();
  ctx.fillStyle = '#6a7381';
  roundRect(ctx, -L * 0.42, -W * 0.3, L * 0.6, W * 0.6, s * 0.05); ctx.fill();
  // Cargo bays (or, deployed, charging pads).
  for (let k = 0; k < 4; k++) {
    const bx = -L * 0.39 + (k % 2) * L * 0.29, by = -W * 0.26 + Math.floor(k / 2) * W * 0.28;
    ctx.fillStyle = deployed ? (working ? '#7ee08a' : '#3f6b4a') : '#3a4048';
    roundRect(ctx, bx, by, L * 0.25, W * 0.22, s * 0.03); ctx.fill();
  }
  // Cab at the front, with the team colour and a windscreen.
  ctx.fillStyle = color;
  roundRect(ctx, L * 0.2, -W * 0.3, L * 0.24, W * 0.6, s * 0.06); ctx.fill();
  ctx.fillStyle = '#16212b';
  ctx.fillRect(L * 0.35, -W * 0.22, L * 0.06, W * 0.44);
  // Mast with a dish (raised when deployed).
  ctx.strokeStyle = '#d8dde4'; ctx.lineWidth = Math.max(1.2, s * 0.03);
  ctx.beginPath(); ctx.moveTo(L * 0.08, 0); ctx.lineTo(L * 0.08, deployed ? -W * 0.55 : -W * 0.25); ctx.stroke();
  ctx.fillStyle = '#d8dde4';
  ctx.beginPath(); ctx.ellipse(L * 0.08, deployed ? -W * 0.6 : -W * 0.28, s * 0.12, s * 0.06, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = color;
  ctx.beginPath(); ctx.arc(L * 0.08, deployed ? -W * 0.6 : -W * 0.28, s * 0.03, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
}

/**
 * Ropeways: a sagging cable between each pair of stations' wheels (high above everything), gondolas
 * carrying the bots riding it, and a dashed line to the far end while the near station is still a
 * construction site (red while the far end is blocked).
 */
const ROPE_TOP = 0.82; // how high (in tiles) the cable leaves the pylon
/** How high above its tile centre the cable leaves a station: the art's bull wheel (0.10 down an image anchored at 0.615, 1.47 tiles tall), or the drawn pylon's top. */
function ropeTop() { return ART['ropeway@0'] ? (0.615 - 0.1) * 1.47 : ROPE_TOP; }
function ropeCurve(ax, ay, bx, by, z) {
  const len = Math.sqrt((bx - ax) * (bx - ax) + (by - ay) * (by - ay));
  const top = ropeTop();
  return { x0: ax, y0: ay - top * z, x1: bx, y1: by - top * z, cx: (ax + bx) / 2, cy: (ay + by) / 2 - top * z + len * 0.08 };
}
function drawRopeways(ctx, ox, oy, z) {
  for (const b of S.buildings) {
    if (b.dead || b.type !== 'ropeway') continue;
    const ax = ox + (b.x + 0.5) * z, ay = oy + (b.y + 0.5) * z;
    if (b.link) {
      const o = getE(b.link);
      if (!o || b.id > o.id) continue; // each cable once
      const c = ropeCurve(ax, ay, ox + (o.x + 0.5) * z, oy + (o.y + 0.5) * z, z);
      ctx.strokeStyle = 'rgba(20,22,26,0.85)'; ctx.lineWidth = Math.max(1.5, z * 0.045);
      for (const off of [-0.06, 0.06]) { ctx.beginPath(); ctx.moveTo(c.x0, c.y0 + off * z); ctx.quadraticCurveTo(c.cx, c.cy + off * z, c.x1, c.y1 + off * z); ctx.stroke(); }
    } else if (b.ropeTo >= 0) {
      const t = b.ropeTo, bx = ox + ((t % S.W) + 0.5) * z, by = oy + (((t / S.W) | 0) + 0.5) * z;
      ctx.strokeStyle = b.built ? 'rgba(255,107,107,0.85)' : 'rgba(255,255,255,0.6)';
      ctx.lineWidth = Math.max(1.5, z * 0.04);
      ctx.setLineDash([z * 0.18, z * 0.12]);
      const c = ropeCurve(ax, ay, bx, by, z);
      ctx.beginPath(); ctx.moveTo(c.x0, c.y0); ctx.quadraticCurveTo(c.cx, c.cy, c.x1, c.y1); ctx.stroke();
      ctx.setLineDash([]);
      ctx.globalAlpha = 0.45;
      drawBuilding(ctx, 'ropeway', bx, by, z, b.owner, { built: true, garrison: [] });
      ctx.globalAlpha = 1;
    }
  }
  // Gondolas: each riding bot in a cabin hanging from the cable.
  for (const u of S.bots) {
    if (u.dead || !(u.ride >= 0) || !u.path) continue;
    const to = u.ride, from = u.pi > 0 ? u.path[u.pi - 1] : ropeLink(to);
    if (from < 0) continue;
    const ax = (from % S.W) + 0.5, ay = ((from / S.W) | 0) + 0.5, bx = (to % S.W) + 0.5, by = ((to / S.W) | 0) + 0.5;
    const L2 = (bx - ax) * (bx - ax) + (by - ay) * (by - ay) || 1;
    const f = clamp(((u.x - ax) * (bx - ax) + (u.y - ay) * (by - ay)) / L2, 0, 1);
    const c = ropeCurve(ox + ax * z, oy + ay * z, ox + bx * z, oy + by * z, z);
    const px = (1 - f) * (1 - f) * c.x0 + 2 * (1 - f) * f * c.cx + f * f * c.x1, py = (1 - f) * (1 - f) * c.y0 + 2 * (1 - f) * f * c.cy + f * f * c.y1;
    const gart = artFor('gondola', u.owner);
    if (gart) {
      // The gondola art hangs by its grip clamp, at (0.5, 0.08) of the image, from the cable.
      const sz = z * 0.8, img = artMip(gart, sz * (R.drawScale || 1));
      ctx.drawImage(img, px - sz * 0.5, py - sz * 0.08, sz, sz);
      if (u.carry) { ctx.fillStyle = '#1b1e25'; ctx.fillRect(px - sz * 0.09, py + sz * 0.36, sz * 0.18, sz * 0.12); ctx.fillStyle = GOOD[u.carry].color; ctx.fillRect(px - sz * 0.075, py + sz * 0.37, sz * 0.15, sz * 0.1); }
      continue;
    }
    const w = z * 0.34, h = z * 0.28, top = py + z * 0.14;
    ctx.strokeStyle = '#2a2e35'; ctx.lineWidth = Math.max(1, z * 0.03);
    ctx.beginPath(); ctx.moveTo(px, py); ctx.lineTo(px, top); ctx.stroke();
    ctx.fillStyle = PLAYER_COLORS[u.owner];
    roundRect(ctx, px - w / 2, top, w, h, z * 0.05); ctx.fill();
    ctx.fillStyle = '#16212b';
    ctx.fillRect(px - w * 0.36, top + h * 0.18, w * 0.72, h * 0.34);
    if (u.carry) { ctx.fillStyle = GOOD[u.carry].color; ctx.fillRect(px - w * 0.2, top + h * 0.6, w * 0.4, h * 0.28); }
  }
}

/**
 * A creature nest: a purple creep spreading round a mound with burrow holes and glowing eggs (more
 * of them as it grows).
 */
function drawNest(ctx, cx, cy, s, b) {
  const lv = (b && b.level) || 1, t = R.time;
  const art = ART['nest-' + Math.min(3, lv)];
  if (art) { drawArt(ctx, art, cx, cy, s); return; }
  const cg = ctx.createRadialGradient(cx, cy + s * 0.1, s * 0.1, cx, cy + s * 0.1, s * 1.05);
  cg.addColorStop(0, 'rgba(92,40,110,0.55)'); cg.addColorStop(1, 'rgba(92,40,110,0)');
  ctx.fillStyle = cg;
  ctx.beginPath(); ctx.ellipse(cx, cy + s * 0.1, s * 1.05, s * 0.8, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = 'rgba(20,8,20,0.35)';
  ctx.beginPath(); ctx.ellipse(cx + s * 0.05, cy + s * 0.22, s * 0.5, s * 0.22, 0, 0, Math.PI * 2); ctx.fill();
  const mg = ctx.createRadialGradient(cx - s * 0.12, cy - s * 0.15, s * 0.05, cx, cy, s * 0.5);
  mg.addColorStop(0, '#8c5a7e'); mg.addColorStop(1, '#3d2238');
  ctx.fillStyle = mg;
  ctx.beginPath();
  for (let k = 0; k <= 16; k++) {
    const a = (k / 16) * Math.PI * 2, r = s * (0.42 + 0.05 * Math.sin(a * 3 + 1.3));
    const x = cx + Math.cos(a) * r, y = cy + Math.sin(a) * r * 0.72 + s * 0.02;
    if (k) ctx.lineTo(x, y); else ctx.moveTo(x, y);
  }
  ctx.fill();
  // Burrow holes.
  ctx.fillStyle = '#12060f';
  for (const [hx, hy, hr] of [[-0.16, -0.06, 0.09], [0.15, 0.04, 0.08], [-0.02, 0.16, 0.07]]) { ctx.beginPath(); ctx.ellipse(cx + hx * s, cy + hy * s, hr * s, hr * s * 0.6, 0, 0, Math.PI * 2); ctx.fill(); }
  // Eggs, one more pair per level, pulsing.
  for (let k = 0; k < 2 * lv; k++) {
    const a = k * 2.4 + 0.5, r = s * (0.18 + 0.05 * (k % 3));
    const ex = cx + Math.cos(a) * r, ey = cy - s * 0.12 + Math.sin(a) * r * 0.5;
    ctx.globalAlpha = 0.75 + 0.25 * Math.sin(t * 3 + k);
    ctx.fillStyle = '#c7ff8a';
    ctx.beginPath(); ctx.ellipse(ex, ey, s * 0.05, s * 0.065, 0.3, 0, Math.PI * 2); ctx.fill();
    ctx.globalAlpha = 1;
  }
}

/** A creature (see WILD): a Scuttler is small and quick, a Brute big and armoured; legs scurry as it moves. */
function drawCritter(ctx, u, x, y, s) {
  const brute = u.type === 'brute', k = brute ? 1.7 : 1, face = u.face || 0;
  const step = u.moved || u.fought ? Math.sin(R.time * (brute ? 12 : 22) + u.id) : 0;
  ctx.save();
  ctx.translate(x, y);
  ctx.fillStyle = 'rgba(20,8,20,0.3)';
  ctx.beginPath(); ctx.ellipse(s * 0.03, s * 0.08, s * 0.17 * k, s * 0.1 * k, 0, 0, Math.PI * 2); ctx.fill();
  // The art: four walking frames, stepping while it moves or fights.
  const walk = ART[u.type + '-f0'] ? ART[u.type + '-f' + (u.moved || u.fought ? Math.floor(R.time * (brute ? 6 : 10) + u.id) % 4 : 0)] : null;
  if (walk) {
    ctx.restore();
    drawArt(ctx, walk, x, y, s * (brute ? 0.82 : 0.62), face);
  } else {
  ctx.rotate(face);
  ctx.strokeStyle = brute ? '#3b2418' : '#2a1430'; ctx.lineWidth = Math.max(1, s * 0.03 * k); ctx.lineCap = 'round';
  ctx.beginPath();
  for (let n = 0; n < 3; n++) {
    const lx = (n - 1) * s * 0.07 * k, sw = (n % 2 ? step : -step) * s * 0.035 * k;
    ctx.moveTo(lx, 0); ctx.lineTo(lx + sw, -s * 0.14 * k);
    ctx.moveTo(lx, 0); ctx.lineTo(lx - sw, s * 0.14 * k);
  }
  ctx.stroke();
  ctx.fillStyle = brute ? '#6b4430' : '#55306a';
  ctx.beginPath(); ctx.ellipse(0, 0, s * 0.14 * k, s * 0.09 * k, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = brute ? '#8d5d41' : '#7a4a92';
  ctx.beginPath(); ctx.ellipse(-s * 0.02 * k, 0, s * 0.08 * k, s * 0.05 * k, 0, 0, Math.PI * 2); ctx.fill();
  if (brute) {
    ctx.fillStyle = '#c9b18f';
    for (const sy of [-1, 1]) { ctx.beginPath(); ctx.moveTo(-s * 0.05, sy * s * 0.12); ctx.lineTo(0, sy * s * 0.2); ctx.lineTo(s * 0.05, sy * s * 0.12); ctx.fill(); }
  }
  ctx.fillStyle = brute ? '#ffb347' : '#ff5fd2';
  ctx.beginPath(); ctx.arc(s * 0.12 * k, -s * 0.03 * k, s * 0.022 * k, 0, Math.PI * 2); ctx.arc(s * 0.12 * k, s * 0.03 * k, s * 0.022 * k, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
  }
  if (u.hp < u.maxHp) {
    const w = s * 0.34 * k;
    ctx.fillStyle = 'rgba(0,0,0,0.6)'; ctx.fillRect(x - w / 2, y - s * 0.24 * k, w, Math.max(2, s * 0.05));
    ctx.fillStyle = '#ff5a5a'; ctx.fillRect(x - w / 2, y - s * 0.24 * k, (w * Math.max(0, u.hp)) / u.maxHp, Math.max(2, s * 0.05));
  }
}

function drawBot(ctx, u, sx, sy, s) {
  if (BOTS[u.type].wild) { drawCritter(ctx, u, sx, sy, s); return; }
  if (BOTS[u.type].rail) { drawFreightTrain(ctx, u, sx, sy, s); return; }
  if (BOTS[u.type].train) { drawRoadTrain(ctx, u, sx, sy, s); return; }
  if (BOTS[u.type].crawler) { drawCrawler(ctx, u.face || 0, sx, sy, s, u.owner, false, u.odo || 0, false, u); return; }
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

/**
 * A Road Train: the Freight Truck's tractor unit with two trailers behind it, each trailer following
 * the road the cab took (a trail of the cab's recent positions, kept by the renderer). The load is
 * spread over the cab's bed and both trailers.
 */
function drawRoadTrain(ctx, u, sx, sy, s) {
  const color = PLAYER_COLORS[u.owner];
  const trails = R.trails || (R.trails = new Map());
  let tr = trails.get(u.id);
  if (!tr) { tr = [{ x: u.x, y: u.y }]; for (let k = 1; k <= 6; k++) tr.push({ x: u.x - Math.cos(u.face || 0) * k * 0.3, y: u.y - Math.sin(u.face || 0) * k * 0.3 }); trails.set(u.id, tr); }
  if (dist2(tr[0].x, tr[0].y, u.x, u.y) > 0.0025) tr.unshift({ x: u.x, y: u.y });
  // Keep about 2.5 tiles of trail.
  let len = 0;
  for (let k = 1; k < tr.length; k++) { len += Math.sqrt(dist2(tr[k - 1].x, tr[k - 1].y, tr[k].x, tr[k].y)); if (len > 2.6) { tr.length = k + 1; break; } }
  // The point `d` tiles back along the trail.
  const at = (d) => {
    let acc = 0;
    for (let k = 1; k < tr.length; k++) {
      const a = tr[k - 1], b = tr[k], l = Math.sqrt(dist2(a.x, a.y, b.x, b.y));
      if (acc + l >= d && l > 0) { const f = (d - acc) / l; return { x: a.x + (b.x - a.x) * f, y: a.y + (b.y - a.y) * f }; }
      acc += l;
    }
    const e = tr[tr.length - 1];
    return { x: e.x, y: e.y };
  };
  const n = u.carry ? u.carryN || 1 : 0, cab = Math.min(8, n), rest = n - cab, t1 = Math.min(11, rest), t2 = rest - t1;
  // The art: the tractor, then two flatbeds, each trailer's kingpin on the fifth wheel of the one in
  // front (5.3 of the frame's 10 units apart: 0.477 tiles at the Freight Truck's size), drawn in that
  // order so each trailer's nose rides over the coupling. All the load is on the trailers.
  const tractor = driveFrame(u), trailerArt = artFor('roadtrain-trailer', u.owner);
  if (tractor && trailerArt) {
    const size = s * 0.9, gap = 0.477, l1 = Math.min(15, n), l2 = n - l1;
    const cars = [{ x: sx, y: sy, ang: u.face || 0 }];
    for (const d of [gap, gap * 2]) {
      const p = at(d), f = at(d - 0.2), b = at(d + 0.2);
      cars.push({ x: sx + (p.x - u.x) * s, y: sy + (p.y - u.y) * s, ang: Math.atan2(f.y - b.y, f.x - b.x) });
    }
    for (const c of cars) drawBotShadow(ctx, { face: c.ang }, c.x, c.y, size * 0.4, size * 0.16);
    drawArt(ctx, tractor, sx, sy, size, u.face);
    [l1, l2].forEach((load, k) => {
      const c = cars[k + 1];
      drawArt(ctx, trailerArt, c.x, c.y, size, c.ang);
      // The bed inside the rails: x 53–184, y 92–164 of the 256 frame.
      if (load > 0) drawTruckCargo(ctx, { carry: u.carry, carryN: Math.ceil((load / 15) * 8), face: c.ang }, c.x, c.y, (-75 / 256) * size, (131 / 256) * size, (72 / 256) * size, s);
    });
    // Brake lights on the last trailer (the tractor's own are hidden under the first).
    const last = cars[2];
    if (u.drive < 0 && ART['roadtrain-brake']) drawArt(ctx, ART['roadtrain-brake'], last.x + Math.cos(last.ang) * (35.8 / 256) * size, last.y + Math.sin(last.ang) * (35.8 / 256) * size, size, last.ang);
    return;
  }
  for (const [d, load] of [[1.22, t2], [0.66, t1]]) {
    const p = at(d), f = at(d - 0.22), b = at(d + 0.22);
    const ang = Math.atan2(f.y - b.y, f.x - b.x);
    const x = sx + (p.x - u.x) * s, y = sy + (p.y - u.y) * s, Lt = s * 0.5, Wt = s * 0.27;
    ctx.save();
    ctx.translate(x, y);
    ctx.fillStyle = 'rgba(20,10,5,0.3)';
    ctx.beginPath(); ctx.ellipse(s * 0.03, s * 0.05, Lt * 0.55, Wt * 0.62, ang, 0, Math.PI * 2); ctx.fill();
    ctx.rotate(ang);
    ctx.fillStyle = '#121418';
    for (const wx of [-Lt * 0.32, -Lt * 0.12]) { ctx.fillRect(wx - s * 0.035, -Wt * 0.58, s * 0.07, Wt * 0.16); ctx.fillRect(wx - s * 0.035, Wt * 0.42, s * 0.07, Wt * 0.16); }
    ctx.fillStyle = '#2b2f36';
    roundRect(ctx, -Lt / 2, -Wt / 2, Lt, Wt, s * 0.025); ctx.fill();
    ctx.fillStyle = '#5a616b';
    ctx.fillRect(-Lt / 2 + s * 0.02, -Wt / 2 + s * 0.02, Lt - s * 0.04, Wt - s * 0.04);
    ctx.fillStyle = color;
    ctx.fillRect(-Lt / 2 + s * 0.02, -Wt / 2 + s * 0.01, Lt - s * 0.04, s * 0.018);
    ctx.fillRect(-Lt / 2 + s * 0.02, Wt / 2 - s * 0.028, Lt - s * 0.04, s * 0.018);
    // The hitch to the vehicle in front.
    ctx.fillStyle = '#121418';
    ctx.fillRect(Lt / 2, -s * 0.012, s * 0.07, s * 0.024);
    if (u.drive < 0) { ctx.fillStyle = '#ff3b3b'; ctx.fillRect(-Lt / 2 - s * 0.01, -Wt * 0.45, s * 0.02, s * 0.035); ctx.fillRect(-Lt / 2 - s * 0.01, Wt * 0.45 - s * 0.035, s * 0.02, s * 0.035); }
    ctx.restore();
    if (load > 0) drawTruckCargo(ctx, { carry: u.carry, carryN: Math.ceil((load / 11) * 8), face: ang }, x, y, -Lt / 2 + s * 0.03, Lt - s * 0.06, Wt - s * 0.07, s);
  }
  // The cab: the Freight Truck's art (or its drawing), carrying the first crates.
  const proxy = { ...u, type: 'truck', carryN: cab, carry: cab ? u.carry : null };
  drawTruck(ctx, proxy, sx, sy, s, color, driveFrame(proxy) || artFor('truck', u.owner));
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
  // A Viaduct's near end is picked: light up the far ends it could reach instead.
  if (type === 'viaduct' && typeof UI !== 'undefined' && UI.ropeA) {
    const A = UI.ropeA;
    for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) for (let k = VIA_MIN; k <= VIA_MAX; k++) {
      const i = A.i + di * k, j = A.j + dj * k;
      if (inMap(i, j) && !viaductBlocked(0, A.i, A.j, i, j)) valid[j * S.W + i] = 1;
    }
    R.overlay = { type, valid, at: R.time };
    return;
  }
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
  R.drawScale = R.dpr;
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

  drawMapLayer(ctx, ox, oy, z);
  ctx.drawImage(R.terr, ox, oy, S.W * z, S.H * z);

  // Territory borders
  ctx.lineWidth = Math.max(1.5, z * 0.07);
  ctx.setLineDash([z * 0.28, z * 0.18]);
  for (let p = 0; p < S.players.length; p++) {
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
  drawBridgeRigging(ctx, ox, oy, z, inView);
  drawViaducts(ctx, ox, oy, z);
  drawCrossingGates(ctx, ox, oy, z, inView);

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
    const paveMode = typeof UI !== 'undefined' && UI.roadMode === 'pave';
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
      if (paveMode || S.road[t] || !canRoad(0, i, j)) continue;
      const cross = crossTile(t);
      if (cross && !bridgeMode) continue;
      ctx.strokeStyle = cross ? 'rgba(140,215,255,0.5)' : S.res[t] ? 'rgba(255,170,90,0.28)' : 'rgba(255,240,200,0.18)';
      ctx.strokeRect(ox + i * z + 1.5, oy + j * z + 1.5, z - 3, z - 3);
    }
  }
  drawScorch(ctx, ox, oy, z);
  drawPlans(ctx, ox, oy, z, inView);
  if (typeof UI !== 'undefined') {
    const selB = getE(R.selected);
    if ((R.mode === 'road' && UI.roadMode === 'pave') || (selB && selB.type === 'roadworks' && selB.owner === 0) || UI.sheetKind === 'road') drawPaveMarks(ctx, ox, oy, z, inView);
  }
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
  for (const u of S.bots) if (!u.dead && !u.inside && !(u.ride >= 0) && inView(u.x, u.y, 1)) items.push(u);
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
      if (e.owner === 0 && (e.depleted || (e.type === 'pump' && pumpDry(e)))) drawDryOil(ctx, cx, cy - z * 0.55, z, e);
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
      if (e.loot) drawCrate(ctx, ox + (e.x + jx) * z, oy + (e.y + jy) * z - z * 0.22, z * 0.2, e.loot);
      e.face = face;
      if (pose) drawWorkOver(ctx, e, pose, ox + (e.x + jx) * z, oy + (e.y + jy) * z, z);
    }
  }

  // Placing a Viaduct: the deck from the near end to the far end picked so far.
  if (typeof UI !== 'undefined' && UI.ropeA && R.ropeEnd && UI.placeType === 'viaduct') {
    const A = UI.ropeA, E = R.ropeEnd;
    ctx.globalAlpha = E.ok ? 0.8 : 0.45;
    drawViaductDeck(ctx, ox, oy, z, { x: A.i, y: A.j }, { x: E.i, y: E.j }, 1, false);
    ctx.globalAlpha = 1;
    ctx.strokeStyle = E.ok ? '#9dffb8' : '#ff6b6b'; ctx.lineWidth = 2;
    ctx.strokeRect(ox + E.i * z + 1, oy + E.j * z + 1, z - 2, z - 2);
  } else
  // Placing a Ropeway: the cable from the near station to the far end picked so far.
  if (typeof UI !== 'undefined' && UI.ropeA && R.ropeEnd) {
    const A = UI.ropeA, E = R.ropeEnd, ax = ox + (A.i + 0.5) * z, ay = oy + (A.j + 0.5) * z, bx = ox + (E.i + 0.5) * z, by = oy + (E.j + 0.5) * z;
    const c = ropeCurve(ax, ay, bx, by, z);
    ctx.strokeStyle = E.ok ? '#9dffb8' : '#ff6b6b'; ctx.lineWidth = Math.max(2, z * 0.05);
    ctx.setLineDash([z * 0.18, z * 0.12]);
    ctx.beginPath(); ctx.moveTo(c.x0, c.y0); ctx.quadraticCurveTo(c.cx, c.cy, c.x1, c.y1); ctx.stroke();
    ctx.setLineDash([]);
    ctx.globalAlpha = 0.75;
    drawBuilding(ctx, 'ropeway', bx, by, z, 0, { built: true, garrison: [] });
    ctx.globalAlpha = 1;
    ctx.strokeRect(ox + E.i * z + 1, oy + E.j * z + 1, z - 2, z - 2);
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

  drawRopeways(ctx, ox, oy, z);
  drawLoot(ctx, ox, oy, z, inView);
  drawRallies(ctx, ox, oy, z);
  drawMissiles(ctx, ox, oy, z);
  drawEffects(ctx, ox, oy, z);
  if (S.event) drawEvent(ctx, ox, oy, z);
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
 * Planet events on screen: a dust storm's haze and blowing grit, a solar flare's glare, meteors
 * streaking down onto their marked spots, and the trader ship hovering over each Command Base.
 */
function drawEvent(ctx, ox, oy, z) {
  const E = S.event, now = S.time;
  // How far in the event is (0..1 over its first and last 4 seconds), for fading in and out.
  const fade = clamp(Math.min((now - E.t0) / 4, (E.t1 - now) / 4), 0, 1);
  if (E.type === 'dust' && fade > 0) {
    ctx.fillStyle = `rgba(176,128,72,${0.34 * fade})`;
    ctx.fillRect(0, 0, R.w, R.h);
    // Thicker at the edges of the view: you can't see far.
    const v = ctx.createRadialGradient(R.w / 2, R.h / 2, Math.min(R.w, R.h) * 0.25, R.w / 2, R.h / 2, Math.max(R.w, R.h) * 0.75);
    v.addColorStop(0, 'rgba(150,104,56,0)'); v.addColorStop(1, `rgba(150,104,56,${0.45 * fade})`);
    ctx.fillStyle = v;
    ctx.fillRect(0, 0, R.w, R.h);
    ctx.strokeStyle = `rgba(240,206,150,${0.6 * fade})`;
    ctx.lineWidth = 2;
    ctx.beginPath();
    for (let n = 0; n < 90; n++) {
      const h1 = hash2(n, 7, 31), h2 = hash2(n, 13, 77), sp = 260 + h2 * 300;
      const x = ((h1 * (R.w + 200) + R.time * sp) % (R.w + 200)) - 100, y = ((h2 * R.h + R.time * sp * 0.18) % R.h);
      ctx.moveTo(x, y); ctx.lineTo(x - 14 - h1 * 18, y - 3);
    }
    ctx.stroke();
  } else if (E.type === 'flare' && fade > 0) {
    const g = ctx.createLinearGradient(R.w, 0, R.w * 0.3, R.h * 0.8);
    const pulse = 0.85 + 0.15 * Math.sin(R.time * 2.4);
    g.addColorStop(0, `rgba(255,240,190,${0.55 * fade * pulse})`);
    g.addColorStop(1, 'rgba(255,240,190,0)');
    ctx.save();
    ctx.globalCompositeOperation = 'screen';
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, R.w, R.h);
    ctx.fillStyle = `rgba(255,214,120,${0.1 * fade * pulse})`;
    ctx.fillRect(0, 0, R.w, R.h);
    ctx.restore();
  } else if (E.type === 'meteor' && E.hits) {
    for (const h of E.hits) {
      const dt = h.at - now;
      if (h.done || dt > 3) continue;
      const x = ox + (h.x + 0.5) * z, y = oy + (h.y + 0.5) * z;
      // The spot it will hit: a pulsing red ring.
      ctx.globalAlpha = 0.5 + 0.4 * Math.sin(R.time * 12);
      ctx.strokeStyle = '#ff5a3d'; ctx.lineWidth = 2;
      ctx.setLineDash([z * 0.15, z * 0.1]);
      ctx.beginPath(); ctx.arc(x, y, z * (0.6 + dt * 0.2), 0, Math.PI * 2); ctx.stroke();
      ctx.setLineDash([]);
      ctx.globalAlpha = 1;
      if (dt > 1.3) continue;
      // The meteor itself, falling in from high up.
      const k = dt / 1.3, hx = x + E.dir * k * z * 6, hy = y - k * z * 10;
      const g = ctx.createLinearGradient(hx, hy, hx + E.dir * z * 2.4, hy - z * 4);
      g.addColorStop(0, 'rgba(255,230,160,0.95)'); g.addColorStop(1, 'rgba(255,120,40,0)');
      ctx.strokeStyle = g; ctx.lineWidth = Math.max(3, z * 0.22); ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(hx, hy); ctx.lineTo(hx + E.dir * z * 2.4, hy - z * 4); ctx.stroke();
      ctx.lineCap = 'butt';
      ctx.fillStyle = '#fff3c4';
      ctx.beginPath(); ctx.arc(hx, hy, Math.max(2.5, z * 0.16), 0, Math.PI * 2); ctx.fill();
    }
  } else if (E.type === 'trader' && E.started && E.offers) {
    for (const p in E.offers) {
      const L = getE(S.players[p].lander);
      if (!L || L.dead) continue;
      const o = E.offers[p], bob = Math.sin(R.time * 2 + +p) * z * 0.12;
      const x = ox + (L.x + 0.5) * z, y = oy + (L.y + 0.5) * z - z * 2.4 + bob, w = z * 1.3;
      if (o.done && now < E.t1) {
        // The tractor beam that lowered the goods.
        ctx.fillStyle = 'rgba(127,227,255,0.18)';
        ctx.beginPath(); ctx.moveTo(x - w * 0.3, y + z * 0.2); ctx.lineTo(x + w * 0.3, y + z * 0.2); ctx.lineTo(x + w * 0.6, y + z * 2.3); ctx.lineTo(x - w * 0.6, y + z * 2.3); ctx.fill();
      }
      ctx.fillStyle = 'rgba(0,0,0,0.25)';
      ctx.beginPath(); ctx.ellipse(x, oy + (L.y + 0.5) * z + z * 0.2, w * 0.45, z * 0.15, 0, 0, Math.PI * 2); ctx.fill();
      if (ART['trader-ship']) { drawArt(ctx, ART['trader-ship'], x, y, w * 1.25); continue; }
      ctx.fillStyle = '#9fb3c4';
      ctx.beginPath(); ctx.ellipse(x, y, w * 0.5, z * 0.22, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#7fe3ff';
      ctx.beginPath(); ctx.ellipse(x, y - z * 0.12, w * 0.22, z * 0.2, 0, Math.PI, Math.PI * 2); ctx.fill();
      for (let n = 0; n < 4; n++) {
        ctx.fillStyle = (Math.floor(R.time * 4) + n) % 4 === 0 ? '#fff6b0' : '#ffb547';
        ctx.beginPath(); ctx.arc(x + (n - 1.5) * w * 0.22, y + z * 0.06, Math.max(1.5, z * 0.05), 0, Math.PI * 2); ctx.fill();
      }
    }
  }
}

/**
 * Planned roads waiting for workers: a faint road with a dashed outline (amber for yours), and a
 * bar filling up while a worker paves it. Tiles still waiting for their goods have a sparser
 * orange outline; planned track waiting to go down, pale sleepers with a dashed outline.
 */
function drawPlans(ctx, ox, oy, z, inView) {
  for (let p = 0; p < S.players.length; p++) {
    const list = planAll(p);
    if (!list.length) continue;
    ctx.lineWidth = Math.max(1, z * 0.04);
    for (const t of list) {
      const i = t % S.W, j = (t / S.W) | 0;
      if (!inView(i, j, 1)) continue;
      const x = ox + i * z, y = oy + j * z, m = z * 0.16, owed = S.owe && S.owe[t];
      ctx.setLineDash(owed ? [z * 0.06, z * 0.12] : [z * 0.12, z * 0.09]);
      ctx.fillStyle = p === 0 ? (owed ? 'rgba(255,170,90,0.16)' : 'rgba(200,206,214,0.32)') : 'rgba(200,206,214,0.16)';
      ctx.fillRect(x + m, y + m, z - 2 * m, z - 2 * m);
      ctx.strokeStyle = p === 0 ? (owed ? 'rgba(255,140,60,0.95)' : 'rgba(255,209,102,0.9)') : 'rgba(255,120,120,0.5)';
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
  // Planned track waiting to go down (for its goods, or for a Ramp to be finished under it).
  if (S.planQ && S.planQ.length) {
    ctx.lineWidth = Math.max(1, z * 0.04);
    ctx.setLineDash([z * 0.1, z * 0.08]);
    for (const [kind, t, o] of S.planQ) {
      if (kind !== 't' || S.railPlan[t] !== o + 1 || S.rail[t]) continue;
      const i = t % S.W, j = (t / S.W) | 0;
      if (!inView(i, j, 1)) continue;
      const x = ox + i * z, y = oy + j * z;
      ctx.fillStyle = o === 0 ? 'rgba(255,214,140,0.22)' : 'rgba(255,214,140,0.1)';
      ctx.fillRect(x + z * 0.12, y + z * 0.12, z * 0.76, z * 0.76);
      ctx.strokeStyle = o === 0 ? 'rgba(255,170,90,0.95)' : 'rgba(255,120,120,0.5)';
      ctx.strokeRect(x + z * 0.12, y + z * 0.12, z * 0.76, z * 0.76);
      // Ghost track along the way the line runs: two rails over three sleepers.
      const rl = (u) => u >= 0 && u < S.W * S.H && (S.rail[u] || S.railPlan[u]);
      const horiz = rl(t - 1) || rl(t + 1) || !(rl(t - S.W) || rl(t + S.W));
      ctx.save(); ctx.setLineDash([]); ctx.strokeStyle = o === 0 ? 'rgba(255,214,140,0.85)' : 'rgba(255,214,140,0.4)';
      ctx.lineWidth = Math.max(1, z * 0.05);
      ctx.beginPath();
      for (const k of [0.3, 0.5, 0.7]) { if (horiz) { ctx.moveTo(x + z * k, y + z * 0.26); ctx.lineTo(x + z * k, y + z * 0.74); } else { ctx.moveTo(x + z * 0.26, y + z * k); ctx.lineTo(x + z * 0.74, y + z * k); } }
      ctx.stroke();
      ctx.lineWidth = Math.max(1, z * 0.035);
      ctx.beginPath();
      for (const k of [0.38, 0.62]) { if (horiz) { ctx.moveTo(x + z * 0.16, y + z * k); ctx.lineTo(x + z * 0.84, y + z * k); } else { ctx.moveTo(x + z * k, y + z * 0.16); ctx.lineTo(x + z * k, y + z * 0.84); } }
      ctx.stroke();
      ctx.restore();
    }
    ctx.setLineDash([]);
  }
}

/**
 * Traffic lights: a stop line on each road leading into the junction, green for the direction
 * that may go, red for the other (both red while the junction clears), and a small signal post.
 */
function drawLights(ctx, ox, oy, z, inView) {
  // A light or overpass planned but still waiting for its goods: a dashed orange outline with a
  // small signal (a light) or an arch (an overpass).
  if (S.junPlan) for (const k in S.junPlan) {
    const t = +k, P = S.junPlan[k], i = t % S.W, j = (t / S.W) | 0;
    if (!inView(i, j, 1)) continue;
    const x = ox + i * z, y = oy + j * z, mine = P.owner === 0;
    ctx.save();
    ctx.lineWidth = Math.max(1.5, z * 0.05);
    ctx.setLineDash([z * 0.08, z * 0.08]);
    ctx.strokeStyle = mine ? 'rgba(255,150,60,0.95)' : 'rgba(255,120,120,0.5)';
    ctx.strokeRect(x + z * 0.06, y + z * 0.06, z * 0.88, z * 0.88);
    ctx.setLineDash([]);
    ctx.fillStyle = mine ? 'rgba(255,170,90,0.85)' : 'rgba(255,170,90,0.4)';
    if (P.kind === 'over') {
      ctx.beginPath(); ctx.arc(x + z * 0.5, y + z * 0.72, z * 0.26, Math.PI, 0); ctx.strokeStyle = ctx.fillStyle; ctx.lineWidth = Math.max(1.5, z * 0.07); ctx.stroke();
    } else {
      ctx.fillRect(x + z * 0.42, y + z * 0.26, z * 0.16, z * 0.42);
      ctx.fillStyle = 'rgba(30,30,36,0.8)';
      for (const k2 of [0.33, 0.47, 0.61]) { ctx.beginPath(); ctx.arc(x + z * 0.5, y + z * k2, z * 0.04, 0, Math.PI * 2); ctx.fill(); }
    }
    ctx.restore();
  }
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
  if (!d || (!d.add.length && !d.del.size && !d.ramps.size && !(d.walls && d.walls.size) && !(d.rail && d.rail.size) && !(d.railDel && d.railDel.size))) return;
  // Planned track: pale sleepers; track marked to take up: a red cross.
  if (d.rail) for (const t of d.rail) {
    const i = t % S.W, j = (t / S.W) | 0;
    if (!inView(i, j, 1) || S.rail[t]) continue;
    const x = ox + i * z, y = oy + j * z;
    ctx.fillStyle = 'rgba(255,214,140,0.35)';
    ctx.fillRect(x + z * 0.1, y + z * 0.1, z * 0.8, z * 0.8);
    ctx.strokeStyle = '#ffd68c'; ctx.lineWidth = Math.max(1.5, z * 0.05);
    ctx.strokeRect(x + z * 0.1, y + z * 0.1, z * 0.8, z * 0.8);
    ctx.beginPath(); ctx.moveTo(x + z * 0.3, y + z * 0.5); ctx.lineTo(x + z * 0.7, y + z * 0.5); ctx.moveTo(x + z * 0.5, y + z * 0.3); ctx.lineTo(x + z * 0.5, y + z * 0.7); ctx.stroke();
  }
  if (d.railDel) for (const t of d.railDel) {
    const i = t % S.W, j = (t / S.W) | 0;
    if (!inView(i, j, 1)) continue;
    const x = ox + i * z, y = oy + j * z;
    ctx.strokeStyle = '#ff5a6e'; ctx.lineWidth = Math.max(2, z * 0.08);
    ctx.beginPath(); ctx.moveTo(x + z * 0.25, y + z * 0.25); ctx.lineTo(x + z * 0.75, y + z * 0.75); ctx.moveTo(x + z * 0.75, y + z * 0.25); ctx.lineTo(x + z * 0.25, y + z * 0.75); ctx.stroke();
  }
  // Planned Walls (grey blocks) and Gates (a gap with a striped bar).
  if (d.walls) for (const [t, kind] of d.walls) {
    const i = t % S.W, j = (t / S.W) | 0;
    if (!inView(i, j, 1)) continue;
    const x = ox + i * z, y = oy + j * z;
    ctx.fillStyle = 'rgba(200,204,210,0.6)';
    ctx.strokeStyle = '#e6e8ec';
    ctx.lineWidth = Math.max(1.5, z * 0.05);
    if (kind === 'gate') {
      ctx.fillRect(x + z * 0.06, y + z * 0.06, z * 0.24, z * 0.88); ctx.fillRect(x + z * 0.7, y + z * 0.06, z * 0.24, z * 0.88);
      ctx.strokeRect(x + z * 0.06, y + z * 0.06, z * 0.88, z * 0.88);
      ctx.fillStyle = '#ffd166';
      ctx.fillRect(x + z * 0.3, y + z * 0.45, z * 0.4, z * 0.1);
    } else {
      ctx.fillRect(x + z * 0.06, y + z * 0.06, z * 0.88, z * 0.88);
      ctx.strokeRect(x + z * 0.06, y + z * 0.06, z * 0.88, z * 0.88);
    }
  }
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

/**
 * A resource building with nothing left to work: its resource, struck through, pulsing over it
 * (demolish me). An Oil Pump shows an empty oil drop; a gatherer its boulder, ore, crystal or
 * grove; a Bio Farm a crop.
 */
function drawDryOil(ctx, x, y, z, b) {
  const def = b ? BDEFS[b.type] : null;
  const res = def && (def.gather || (def.farm ? R_CROP : 0));
  if (res) { drawDepletedRes(ctx, x, y, z, res); return; }
  const r = Math.max(8, z * 0.24), bob = Math.sin(R.time * 3) * r * 0.08;
  y += bob;
  ctx.globalAlpha = 0.8 + 0.2 * Math.sin(R.time * 4);
  ctx.fillStyle = 'rgba(20,16,14,0.85)';
  ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = '#ffb547';
  ctx.lineWidth = Math.max(1.2, r * 0.12);
  ctx.stroke();
  // The drop, drawn hollow: no oil left.
  const d = r * 0.55;
  ctx.beginPath();
  ctx.moveTo(x, y - d);
  ctx.bezierCurveTo(x + d * 0.2, y - d * 0.55, x + d * 0.75, y - d * 0.05, x + d * 0.75, y + d * 0.35);
  ctx.arc(x, y + d * 0.35, d * 0.75, 0, Math.PI);
  ctx.bezierCurveTo(x - d * 0.75, y - d * 0.05, x - d * 0.2, y - d * 0.55, x, y - d);
  ctx.strokeStyle = '#e8d8c0';
  ctx.lineWidth = Math.max(1.2, r * 0.13);
  ctx.stroke();
  ctx.strokeStyle = '#ff5a5a';
  ctx.lineWidth = Math.max(1.5, r * 0.16);
  ctx.beginPath(); ctx.moveTo(x - r * 0.62, y + r * 0.62); ctx.lineTo(x + r * 0.62, y - r * 0.62); ctx.stroke();
  ctx.globalAlpha = 1;
}

function drawDepletedRes(ctx, x, y, z, res) {
  const r = Math.max(8, z * 0.24), bob = Math.sin(R.time * 3) * r * 0.08;
  y += bob;
  ctx.globalAlpha = 0.8 + 0.2 * Math.sin(R.time * 4);
  ctx.fillStyle = 'rgba(20,16,14,0.85)';
  ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = '#ffb547';
  ctx.lineWidth = Math.max(1.2, r * 0.12);
  ctx.stroke();
  // The resource itself, small and faded: there's none of it left.
  ctx.save();
  ctx.beginPath(); ctx.arc(x, y, r * 0.86, 0, Math.PI * 2); ctx.clip();
  ctx.globalAlpha *= 0.75;
  const art = ART[RES[res].key];
  if (art) drawArt(ctx, art, x, y + r * 0.05, r * 2.2);
  else drawResource(ctx, res, RES[res].amount, 1, x, y, r * 2, 0, 0);
  ctx.restore();
  ctx.globalAlpha = 0.8 + 0.2 * Math.sin(R.time * 4);
  ctx.strokeStyle = '#ff5a5a';
  ctx.lineWidth = Math.max(1.5, r * 0.16);
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
  const r = def.gather || def.plant ? def.radius + 0.5 : def.range ? turretRange({ type, owner: owner || 0 }) : def.missile ? def.missile.range : def.mil ? def.terr : 0;
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
/** A supply crate (side s px) marked with the colour of the good in it. */
function drawCrate(ctx, cx, cy, s, g) {
  ctx.fillStyle = 'rgba(0,0,0,0.35)';
  ctx.fillRect(cx - s / 2 + s * 0.12, cy - s / 2 + s * 0.12, s, s);
  ctx.fillStyle = '#9a6b3c';
  ctx.fillRect(cx - s / 2, cy - s / 2, s, s);
  ctx.strokeStyle = '#5b3c1e';
  ctx.lineWidth = Math.max(1, s * 0.1);
  ctx.strokeRect(cx - s / 2, cy - s / 2, s, s);
  ctx.beginPath(); ctx.moveTo(cx - s / 2, cy - s / 2); ctx.lineTo(cx + s / 2, cy + s / 2); ctx.stroke();
  ctx.fillStyle = (GOOD[g] && GOOD[g].color) || '#fff';
  ctx.beginPath(); ctx.arc(cx, cy, s * 0.24, 0, Math.PI * 2); ctx.fill();
}

/** Loot piles: a few crates (more for a bigger pile) with a count, fading in their last half minute. */
function drawLoot(ctx, ox, oy, z, inView) {
  if (!S.loot || !S.loot.length) return;
  for (const l of S.loot) {
    if (!inView(l.x, l.y, 1)) continue;
    const n = lootLeft(l);
    if (n <= 0) continue;
    const kinds = Object.keys(l.goods).filter((g) => l.goods[g] > 0);
    const cx = ox + (l.x + 0.5) * z, cy = oy + (l.y + 0.5) * z, s = z * 0.26;
    ctx.globalAlpha = clamp((l.until - S.time) / 30, 0.35, 1);
    const spots = [[-0.18, 0.1], [0.16, 0.12], [0, -0.1], [-0.2, -0.16], [0.2, -0.14]];
    for (let k = 0; k < Math.min(spots.length, 1 + Math.floor(n / 4)); k++) drawCrate(ctx, cx + spots[k][0] * z, cy + spots[k][1] * z, s, kinds[k % kinds.length]);
    ctx.globalAlpha = 1;
    if (z >= 14) {
      ctx.font = `700 ${Math.max(9, z * 0.24)}px system-ui, sans-serif`;
      ctx.textAlign = 'center';
      ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(0,0,0,0.7)';
      ctx.strokeText(String(n), cx, cy - z * 0.3);
      ctx.fillStyle = '#ffe9a8';
      ctx.fillText(String(n), cx, cy - z * 0.3);
    }
  }
}

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
    if (art) ctx.drawImage(artMip(art, w * R.dpr), x - w * 0.5, y - w * 0.52, w, w);
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
      case 'crater': {
        // A meteor's scorch mark, glowing embers fading out.
        ctx.globalAlpha = 0.55 * (1 - k);
        ctx.fillStyle = '#2a211c';
        ctx.beginPath(); ctx.ellipse(x, y, z * 0.75, z * 0.55, 0, 0, Math.PI * 2); ctx.fill();
        ctx.globalAlpha = 0.8 * Math.max(0, 1 - k * 2);
        ctx.fillStyle = '#ff7a2e';
        for (let n = 0; n < 5; n++) { const a = n * 1.26 + f.x; ctx.beginPath(); ctx.arc(x + Math.cos(a) * z * 0.35, y + Math.sin(a) * z * 0.25, z * 0.05, 0, Math.PI * 2); ctx.fill(); }
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
    ctx.drawImage(artMip(art, size * 0.92), size * 0.04, size * 0.04, size * 0.92, size * 0.92);
    const head = type === 'turret' && art.anchor === 'bottom' ? turretHead(owner || 0, Math.PI / 4) : null;
    if (head) ctx.drawImage(artMip(head, size * 0.92), size * 0.04, size * 0.04, size * 0.92, size * 0.92);
    return c.toDataURL();
  }
  drawBuilding(ctx, type, size / 2, size / 2 + (type === 'lander' ? 0 : size * 0.02), type === 'lander' ? size * 0.55 : size * 0.86, owner || 0,
    { built: true, garrison: [], aim: -Math.PI / 4 });
  return c.toDataURL();
}

/* ------------------------------------------------------------------ minimap */

const MM = { canvas: null, ctx: null, base: null, baseCtx: null, dirty: true, ver: -1, builtAt: -9, w: 0, h: 0, on: true };

const MM_COLORS = {
  ground: [169, 113, 74], water: [28, 75, 93], rock: [74, 51, 41], ramp: [235, 205, 150], chasm: [18, 12, 10],
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
    let c = terr === T_WATER ? MM_COLORS.water : terr === T_CHASM ? MM_COLORS.chasm : terr === T_ROCK ? MM_COLORS.rock : S.res[t] ? MM_COLORS[S.res[t]] : S.ramp[t] ? MM_COLORS.ramp
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

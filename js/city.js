'use strict';
/*
 * Terrafall: Passenger Town's look and its panel (the city map, SHAPE_PRESETS city). The town is laid by townSetup
 * (world.js) and runs in sim.js (townRun, townDoStrip, townTick); this file only draws it and opens its panels.
 *
 * After the owner's art direction (Nov 22 2026, ART_GUIDE.md: Passenger Town): a dense grid of blocks packed with
 * mid-rise and taller buildings of varied heights and footprints, chunky blocky forms with rooftop clutter (vents,
 * tanks, fans, pads, antennas), many small warm windows and a few cool accent strips and red or cyan signs, wide
 * streets with lane dashes and kerbs, street lamps, a plaza or two, low haze over it all that thickens at dusk and
 * night. By day muted greys, browns and teal panels with the lights off; at night the lights still run on automatic.
 * The buildings are rendered 3D sprites (renderer/b/town.js: see the buildings below); the ground is drawn in code, in
 * the game's projection (straight down; the buildings stand up toward the camera on their lots).
 *
 *   townGround   the streets, kerbs, lane dashes, plazas, parking lots and stripped lots, and every building's shadow
 *                (one layer, so where two fall together they don't darken twice), cached in one picture at
 *                TOWN_GROUND_PX a tile (made again when a building comes down or its look changes), drawn with the
 *                ground (so it's graded with it at dusk and night)
 *   townItems    the standing pieces among the buildings and robots, sorted with them by their foot: each building
 *                (its sprite for the time of day, faded while one of your robots is behind it), its sentry, street
 *                lamps, the signs
 *   townLights   the light pools at night (render.js's pool)
 *   townHaze     the low haze over the town, on top
 */

const TOWN_GROUND_PX = 16;
const _tg = { of: null, ver: -1, c: null, rv: -1, rk: 0, sk: 0, at: 0 };

/** A number from building r's seed and k (0..1), so its look is the same every time it's drawn. */
function townHash(r, k) { return hash2(r.v % 9973, k, 4111 + (r.v % 31)); }

/* ------------------------------------------------------------------ the ground */

/** The town's picture's extent: tiles cx0..cx1 × cy0..cy1 (the town and a row round it, on the map). */
function townGroundBox(T) { return { cx0: Math.max(0, T.x0 - 1), cy0: Math.max(0, T.y0 - 1), cx1: Math.min(S.W - 1, T.x1 + 1), cy1: Math.min(S.H - 1, T.y1 + 1) }; }

/** A number that changes when the roads on the town's ground do (its picture leaves them showing). */
function townRoadKey(T) {
  const { cx0, cy0, cx1, cy1 } = townGroundBox(T);
  let h = 0;
  for (let j = cy0; j <= cy1; j++) for (let i = cx0; i <= cx1; i++) { const t = j * S.W + i; if (S.road[t]) h = (h * 31 + t * 7 + S.road[t] + (S.pave[t] || 0) * 3) | 0; }
  return h;
}

function townGroundCanvas() {
  const T = S.town;
  if (_tg.rv !== (S.roadVer || 0)) { _tg.rv = S.roadVer || 0; const k = townRoadKey(T); if (k !== _tg.rk) { _tg.rk = k; _tg.ver = -1; } }
  const sk = townShadowKey(T), now = typeof performance !== 'undefined' ? performance.now() : 0; // (the shadows: made again as they come in, at most twice a second)
  if (sk !== _tg.sk && (now - _tg.at > 500 || !_tg.c)) { _tg.sk = sk; _tg.at = now; _tg.ver = -1; }
  if (_tg.of === T && _tg.ver === (T.ver || 0) && _tg.c) return _tg.c;
  const G = TOWN_GROUND_PX, { cx0, cy0, cx1, cy1 } = townGroundBox(T), cols = cx1 - cx0 + 1, rows = cy1 - cy0 + 1, W = S.W;
  const c = _tg.c && _tg.c.width === cols * G && _tg.c.height === rows * G ? _tg.c : document.createElement('canvas');
  c.width = cols * G; c.height = rows * G;
  const g = c.getContext('2d');
  g.clearRect(0, 0, c.width, c.height);
  const X = (x) => (x - cx0) * G, Y = (y) => (y - cy0) * G;
  const speck = (x, y, w, h, n, seed, dark, light) => {
    for (let k = 0; k < n; k++) {
      const a = hash2(k, seed, 4201), b = hash2(seed, k, 4202);
      g.fillStyle = hash2(k, seed, 4203) < 0.5 ? dark : light;
      g.fillRect(X(x) + a * w * G, Y(y) + b * h * G, 1 + (k % 3 === 0 ? 1 : 0), 1);
    }
  };
  const tw = T.x1 - T.x0 + 1, th = T.y1 - T.y0 + 1;
  g.save();
  if (T.rad) { // a round town (three colonies): its paving inside its outline (townEdge), fading out into the land round it
    const mx = X(W / 2), my = Y(S.H / 2), edge = (d) => { g.beginPath(); for (let k = 0; k <= 96; k++) { const a = (k / 96) * Math.PI * 2, r = (townEdge(T.rad, T.lobe, a) + d) * G; g.lineTo(mx + Math.cos(a) * r, my + Math.sin(a) * r); } g.closePath(); };
    for (const [d, a] of [[1.1, 0.25], [0.8, 0.45]]) { g.fillStyle = `rgba(62,64,68,${a})`; edge(d); g.fill(); }
    edge(0.5); g.clip();
  }
  // the street paving over the whole town, the mouths of its streets fading out into the land
  g.fillStyle = '#3e4044'; g.fillRect(X(T.x0), Y(T.y0), tw * G, th * G);
  if (!T.rad) {
    for (const [yy, dir] of [[T.y0 - 1, 1], [T.y1 + 1, 0]]) {
      const gr = g.createLinearGradient(0, Y(yy), 0, Y(yy) + G);
      gr.addColorStop(dir ? 0 : 1, 'rgba(62,64,68,0)'); gr.addColorStop(dir ? 1 : 0, 'rgba(62,64,68,0.85)');
      g.fillStyle = gr; g.fillRect(X(T.x0), Y(yy), tw * G, G);
    }
    if (T.x0 > 0 || T.x1 < W - 1) for (const [xx, dir] of [[T.x0 - 1, 1], [T.x1 + 1, 0]]) { // (a square town, four colonies: its sides too)
      const gr = g.createLinearGradient(X(xx), 0, X(xx) + G, 0);
      gr.addColorStop(dir ? 0 : 1, 'rgba(62,64,68,0)'); gr.addColorStop(dir ? 1 : 0, 'rgba(62,64,68,0.85)');
      g.fillStyle = gr; g.fillRect(X(xx), Y(T.y0), G, th * G);
    }
  }
  speck(T.x0, T.y0, tw, th, tw * (th - 1) * 3, 7, 'rgba(0,0,0,0.25)', 'rgba(255,255,255,0.08)');
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
  if (T.x0 > 0) for (const [a, b] of rowSt) { const y = Y((a + b) / 2); g.beginPath(); g.moveTo(X(T.x0 - 1) + G * 0.5, y); g.lineTo(X(T.xs[0][0]), y); g.moveTo(X(T.xs[T.xs.length - 1][1]), y); g.lineTo(X(T.x1 + 1) + G * 0.5, y); g.stroke(); }
  g.setLineDash([]);
  // zebra crossings at the crossings' edges, worn
  g.fillStyle = 'rgba(225,220,200,0.2)'; // (light and thin: the owner, Nov 23 2026)
  for (const [a, b] of colSt) for (const [ra, rb] of rowSt) for (const yy of [ra - 0.26, rb + 0.06]) for (let k = 0; k < 5; k++) g.fillRect(X(a) + G * (0.16 + k * 0.38), Y(yy), G * 0.12, G * 0.2);
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
  g.restore();
  // The roads on it (the avenues, and any a colony lays): left showing through, in the shape the map draws them.
  g.save(); g.globalCompositeOperation = 'destination-out'; g.fillStyle = '#000';
  const rk = (G / 32) * 0.5, has = (i, j) => i >= 0 && j >= 0 && i < W && j < S.H && S.road[j * W + i];
  for (let j = cy0; j <= cy1; j++) for (let i = cx0; i <= cx1; i++) {
    if (!S.road[j * W + i]) continue;
    const ww = ((typeof ROAD_LOOK !== 'undefined' && ROAD_LOOK[Math.min(2, S.pave[j * W + i] || 1)]) ? ROAD_LOOK[Math.min(2, S.pave[j * W + i] || 1)].w + 4 : 16) * rk * 2, x = X(i), y = Y(j), h = G / 2;
    g.beginPath(); g.arc(x + h, y + h, ww / 2, 0, 7); g.fill();
    if (has(i, j - 1)) g.fillRect(x + h - ww / 2, y, ww, h);
    if (has(i + 1, j)) g.fillRect(x + h, y + h - ww / 2, h, ww);
    if (has(i, j + 1)) g.fillRect(x + h - ww / 2, y + h, ww, h);
    if (has(i - 1, j)) g.fillRect(x, y + h - ww / 2, h, ww);
  }
  g.restore();
  // Every building's shadow (its look's, as stripped as it is): one layer, laid over the ground at its strength.
  const A = typeof window !== 'undefined' && window.TOWN_ART;
  if (A) {
    const sc = document.createElement('canvas'); sc.width = c.width; sc.height = c.height;
    const sg = sc.getContext('2d'), q = G / A.sh;
    for (const r of T.r) {
      const look = !r.gone && townLook(r), D = look && look.L.sh, img = D && townImg(look.key + '-sh');
      if (img) sg.drawImage(img, X(r.x) - D.fl[0] * q * look.sx, Y(r.y + r.h) - D.fl[1] * q, D.size[0] * q * look.sx, D.size[1] * q);
    }
    g.save(); g.globalAlpha = 0.45; g.drawImage(sc, 0, 0); g.restore();
    sc.width = sc.height = 0;
  }
  _tg.of = T; _tg.ver = T.ver || 0; _tg.c = c;
  return c;
}

/** A number that changes when the buildings' shadows do (one coming in, a building gone). */
function townShadowKey(T) {
  let h = _ta.shv;
  for (const r of T.r) if (r.gone) h = (h * 31 + r.id) | 0;
  return h;
}

/** The town's ground, with the rest of the ground (before its light: graded with it). */
function townGround(ctx, ox, oy, z) {
  if (!S.town || typeof document === 'undefined') return;
  ensureTownArt();
  const c = townGroundCanvas(), { cx0, cy0, cx1, cy1 } = townGroundBox(S.town);
  ctx.save(); ctx.imageSmoothingEnabled = true;
  ctx.drawImage(c, ox + cx0 * z, oy + cy0 * z, (cx1 - cx0 + 1) * z, (cy1 - cy0 + 1) * z);
  ctx.restore();
}

/* ------------------------------------------------------------------ the buildings */

/*
 * The buildings are rendered 3D sprites (renderer/b/town.js, installed by renderer/tools/install_town.py; ART_GUIDE.md,
 * Passenger Town): every lot townSetup lays (kind and size) has one to three looks, each by day and at night (lights on
 * automatic) and stripped (scaffold, then the bare frame), with its shadow alone. They load only for a Passenger Town
 * map (ensureTownArt): art/town/town-art.js lists them (window.TOWN_ART), and in the one-file copy of the game they're
 * a bundle beside the page (town.js). Morning and evening are made here from day and night: the day render graded for
 * the time (and at evening the night one laid over it, its lights coming on); the stripped looks have no lights (cut
 * while it's taken apart), so they're graded at night too, a little lighter than the land round the town.
 */
const TOWN_STATES = ['d', 's1', 's2'];
const _ta = { state: '', img: new Map(), shv: 0 };
const _tv = new Map(); // (graded versions made at a zoom step: key -> { c, used })
let _tvPx = 0;
const TOWN_VER_PX = 2.4e7; // (the most pixels of graded versions kept)
const _tf = new Map(); // (each building's fade, while one of your robots is behind it: id -> 0..1)
const _tl = new WeakMap(); // (each building's look in the art: townLook)
/** The town's night is lifted a little over the shared night (the owner, Nov 23 2026): for its stripped looks' grade. */
const TOWN_NIGHT = { mul: [0.3, 0.34, 0.5], add: [0.01, 0.012, 0.03] };

/** The art for a Passenger Town map: its list, then the pictures of the lots this town has (as they're wanted). */
function ensureTownArt() {
  if (_ta.state || typeof document === 'undefined') return;
  _ta.state = 'loading';
  if (typeof window !== 'undefined' && window.TOWN_ART) { _ta.state = 'in'; return; }
  const s = document.createElement('script');
  s.src = typeof window !== 'undefined' && window.TOWN_BUNDLE ? 'town.js' : 'art/town/town-art.js';
  s.onload = () => { _ta.state = window.TOWN_ART ? 'in' : 'failed'; _ta.shv++; };
  s.onerror = () => { _ta.state = 'failed'; }; // (no art: drawn as plain blocks)
  document.head.appendChild(s);
}

/** Picture `name` (art/town/<name>.webp), loading it the first time it's asked for; null till it's in. */
function townImg(name) {
  let e = _ta.img.get(name);
  if (!e) {
    e = { img: null };
    _ta.img.set(name, e);
    const d = window.TOWN_ART && window.TOWN_ART.data;
    loadImg(d && d[name] ? d[name] : `art/town/${name}.webp`, (img) => { e.img = img; if (/-sh$/.test(name)) _ta.shv++; });
  }
  return e.img;
}

/**
 * Building r's look in the art: { key (its picture's name), L (the look: d, n, s1, s2 and their shadows), sx (a
 * stretch across, for a lot the art has no size of) }, or null (no art yet). Of a lot's looks, the one whose height is
 * nearest the building's (r.hgt), so the sim's idea of its height (where its sentry's shots come from) matches.
 */
function townLook(r) {
  const A = typeof window !== 'undefined' && window.TOWN_ART;
  if (!A) return null;
  const c0 = _tl.get(r);
  if (c0 && c0.A === A) return c0.v;
  let looks = A.lots[r.k + '-' + r.w + 'x' + r.h], w = r.w;
  if (!looks) { // a size the art doesn't have: the nearest of the kind, stretched across
    let best = null, bd = Infinity;
    for (const k in A.lots) {
      const m = /^([a-z]+)-(\d+)x(\d+)$/.exec(k);
      if (!m || m[1] !== r.k) continue;
      const d = Math.abs(+m[3] - r.h) * 3 + Math.abs(+m[2] - r.w);
      if (d < bd) { bd = d; best = k; w = +m[2]; }
    }
    looks = best && A.lots[best];
  }
  let v = null;
  if (looks) {
    const hOf = (L) => (L.d.roofG[1] - L.d.roof[1]) / A.ppt, want = r.hgt / 10;
    let L = looks[r.v % looks.length];
    for (const q of looks) if (Math.abs(hOf(q) - want) < Math.abs(hOf(L) - want) - 0.05) L = q;
    v = { key: r.k + '-' + w + 'x' + r.h + '-' + L.v, L, sx: r.w / w };
  }
  _tl.set(r, { A, v });
  return v;
}

/** How far stripping has gone, in the art's steps: 0 standing, 1 scaffold (to half), 2 only the frame left. */
function townState(r) { const s = townStep(r); return s === 0 ? 0 : s <= 4 ? 1 : 2; }
/** Its stripped share in steps of an eighth (townState maps them onto the art's). */
function townStep(r) { return r.n0 ? Math.round((1 - townLeft(r) / r.n0) * 8) : 0; }

/**
 * A picture at least `px` wide for drawing it smaller (halved copies, made the first time: drawing a big picture small
 * every frame shimmers and costs a phone dearly); the picture itself when it's drawn near its size.
 */
function townMip(e, img, px) {
  if (px >= img.width * 0.7 || img.width < 64) return img;
  if (!e.mips) {
    e.mips = [];
    let src = img, w = img.width, h = img.height;
    while (w >= 48 && h >= 24) {
      w = Math.round(w / 2); h = Math.round(h / 2);
      const c = document.createElement('canvas'); c.width = w; c.height = h;
      const x = c.getContext('2d'); x.imageSmoothingQuality = 'high'; x.drawImage(src, 0, 0, w, h);
      e.mips.push(c); src = c;
    }
  }
  let best = img;
  for (const m of e.mips) { if (m.width >= px) best = m; else break; }
  return best;
}

/**
 * Look L's picture for state st ('d', 's1', 's2') at time `tn` (morning, day, evening, night), at least px wide:
 * { img, w, h } (img's own size can be a smaller copy), or null while it isn't ready. Day and night are the renders;
 * the others are made (and kept a while) at the zoom step in use, a few a frame (`budget`).
 */
function townVersion(look, st, tn, px, budget) {
  const S0 = look.L[st], base = st === 'd' ? look.key : S0.src;
  if (tn === 'day' || (tn === 'night' && st === 'd')) {
    const name = tn === 'night' ? base + '-n' : base, img = townImg(name);
    if (!img) return null;
    const e = _ta.img.get(name);
    return { img: townMip(e, img, px), S: tn === 'night' ? look.L.n : S0 };
  }
  const day = townImg(base), night = tn === 'evening' && st === 'd' ? townImg(base + '-n') : null;
  if (!day || (tn === 'evening' && st === 'd' && !night)) return null;
  const src = townMip(_ta.img.get(base), day, px), key = base + '|' + tn + '|' + src.width;
  let v = _tv.get(key);
  if (!v) {
    if (budget.n <= 0) return null;
    budget.n--;
    const c = document.createElement('canvas'); c.width = src.width; c.height = src.height;
    const g = c.getContext('2d'), T = tn === 'night' ? TOWN_NIGHT : TOD_TIMES[tn];
    g.drawImage(src, 0, 0);
    todGrade(g, 0, 0, c.width, c.height, T.mul, T.add, src);
    if (night) { // evening: the night render over it at the share the lights are on, lined up on the lot's corner
      const k = src.width / S0.size[0], N = look.L.n, ns = townMip(_ta.img.get(base + '-n'), night, N.size[0] * k);
      g.globalAlpha = TOD_TIMES.evening.lights;
      g.drawImage(ns, (S0.fl[0] - N.fl[0]) * k, (S0.fl[1] - N.fl[1]) * k, N.size[0] * k, N.size[1] * k);
      g.globalAlpha = 1;
    }
    v = { c, px: c.width * c.height };
    _tv.set(key, v); _tvPx += v.px;
    while (_tvPx > TOWN_VER_PX && _tv.size > 1) { const [k0, o] = _tv.entries().next().value; _tv.delete(k0); _tvPx -= o.px; o.c.width = o.c.height = 0; }
  } else { _tv.delete(key); _tv.set(key, v); } // (most recently used last)
  return { img: v.c, S: S0 };
}

/** Building r with no art (still loading, or none): a plain block of its height, graded for the time of day. */
function townBlock(ctx, r, X, Y, z) {
  const H = r.hgt / 10, c = (h) => (typeof todColor === 'function' ? todColor(h) : h), x = X + z * 0.1, w = (r.w - 0.2) * z;
  ctx.fillStyle = c('#5d6164'); ctx.fillRect(x, Y - H * z - z * 0.1, w, H * z);
  ctx.fillStyle = c('#7a7d80'); ctx.fillRect(x, Y - H * z - (r.h - 0.2) * z - z * 0.1, w, (r.h - 0.2) * z);
}

/** How dark it is (0 day to 1 night), for the lights. */
function townNight() { return typeof TOD !== 'undefined' && TOD.active && TOD.state ? clamp(TOD.state.lights || 0, 0, 1) : 0; }

/** The standing pieces (render.js's items): the buildings, their sentries, the street lamps and the signs. */
function townItems(items, inView) {
  const T = S.town;
  ensureTownArt();
  // (your robots in view: a building in front of one fades, so it's never lost behind it; see townDraw)
  const mine = _ta.mine || (_ta.mine = []);
  mine.length = 0;
  for (const u of S.bots) if (!u.dead && !u.inside && u.owner === ME && !BOTS[u.type].air && inView(u.x, u.y, 2)) mine.push(u);
  for (const r of T.r) if (!r.gone && inView(r.x + r.w / 2, r.y + r.h / 2, Math.max(r.w, r.h) / 2 + 5)) items.push({ ent: 'town', r, x: r.x, y: r.y + r.h - 0.02 });
  for (const [x, y] of T.signs) if (inView(x, y, 4)) items.push({ ent: 'town', sign: [x, y], x, y: y + 0.6 });
  for (let a = 0; a + 1 < T.xs.length; a++) for (let b = 0; b + 1 < T.ys.length; b++) {
    const x = T.xs[a][1], y = T.ys[b][1]; // (a lamp on the north-west corner of each crossing)
    if (inView(x, y, 3) && townIn(x, y)) items.push({ ent: 'town', lamp: [x + 0.08, y + 0.12], x: x + 0.08, y: y + 0.12 });
  }
  _ta.budget = { n: 6 }; // (graded versions made a frame, at most)
}

/**
 * Building r's picture on the map as it's drawn now, in tiles (the map's picture: straight down, a building standing up
 * toward the camera from its lot): { x0, y0, x1, y1, name (the picture), foot (its sort line among the robots) }, or
 * null while there's no art for it. Looks only.
 */
function townSprite(r) {
  const look = townLook(r);
  if (!look) return null;
  const st0 = TOWN_STATES[townState(r)], st = look.L[st0] ? st0 : 'd', S0 = look.L[st], p = S0.p || window.TOWN_ART.ppt, sx = look.sx;
  const x0 = r.x - (S0.fl[0] / p) * sx, y0 = r.y + r.h - S0.fl[1] / p;
  return { x0, y0, x1: x0 + (S0.size[0] / p) * sx, y1: y0 + S0.size[1] / p, name: st === 'd' ? look.key : S0.src, foot: r.y + r.h - 0.02 };
}

/** Does building r's picture (townSprite) cover map point (x, y)? Its solid pixels (artSolidAt), not its box or lot. */
function townCovers(sp, x, y) {
  if (!sp || x < sp.x0 || x >= sp.x1 || y < sp.y0 || y >= sp.y1) return false;
  const img = townImg(sp.name);
  return img ? artSolidAt(img, sp.x0, sp.y0, sp.x1, sp.y1, x, y) : true;
}

/** Points on a robot's body as drawn (its middle, either side, and up to its top), from its foot (x, y). */
const TOWN_BODY = [[0, -0.05], [-0.13, -0.05], [0.13, -0.05], [0, -0.3], [-0.13, -0.3], [0.13, -0.3]];

/**
 * Is one of your robots (or one you have selected) behind building r, hidden by it: drawn before it (its foot behind
 * the building's) and inside the building's picture as drawn (any point of its body on the building's solid pixels)?
 * Judged by each building's own picture, so a robot behind one building never fades the one beside it.
 */
function townHides(r, sp) {
  if (!sp) return false;
  const hid = (u) => {
    if (u.y >= sp.foot || u.x < sp.x0 - 0.2 || u.x > sp.x1 + 0.2 || u.y < sp.y0 || u.y > sp.y1 + 0.1) return false;
    for (const [dx, dy] of TOWN_BODY) if (townCovers(sp, u.x + dx, u.y + dy)) return true;
    return false;
  };
  for (const u of _ta.mine || []) if (hid(u)) return true;
  const sel = typeof UI !== 'undefined' && UI.sel && UI.sel.length ? UI.sel : null;
  if (sel) for (const id of sel) { const u = getE(id); if (u && !u.dead && !u.inside && hid(u)) return true; }
  return false;
}

/** How faded building r is now (0..1: see-through while one of your robots is behind it). */
function townFade(r) { return _tf.get(r.id) || 0; }

/**
 * The town building a tap at map point (wx, wy) is on: on its lot, or on its picture as drawn, its upper floors and
 * roof included; where pictures overlap, the one in front (drawn last). { r, foot } or null. Looks only (what's tapped).
 */
function townAtTap(wx, wy) {
  const T = S && S.town;
  if (!T) return null;
  let best = null;
  for (const r of T.r) {
    if (r.gone || wx < r.x - 0.5 || wx > r.x + r.w + 0.5 || wy > r.y + r.h + 0.5 || wy < r.y - 12) continue;
    const sp = townSprite(r), foot = sp ? sp.foot : r.y + r.h - 0.02;
    const on = (wx >= r.x && wx < r.x + r.w && wy >= r.y && wy < r.y + r.h) || townCovers(sp, wx, wy);
    if (on && (!best || foot > best.foot)) best = { r, foot };
  }
  return best;
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
  const r = e.r, X = ox + r.x * z, Y = oy + (r.y + r.h) * z, look = townLook(r);
  if (!look) { townBlock(ctx, r, X, Y, z); if (r.sen > 0) townSentryDraw(ctx, r, X + (r.w / 2) * z, Y - (r.h * 0.4 + r.hgt / 10) * z, z, live); return; }
  const A = window.TOWN_ART, st0 = TOWN_STATES[townState(r)], st = look.L[st0] ? st0 : 'd', S0 = look.L[st], k = z / (S0.p || A.ppt), sx = look.sx, dpr = (typeof R !== 'undefined' && R.dpr) || 1;
  // the light now: its version, and the next one's faded over it while the light changes (as drawArt)
  const tod = live && typeof TOD !== 'undefined' && TOD.active ? TOD.state : null;
  const ta = tod ? tod.a : 'day', tb = tod && tod.f > 0.002 && tod.b !== tod.a ? tod.b : ta, late = tod && tod.f >= 0.5;
  const px = S0.size[0] * k * sx * dpr, budget = _ta.budget || { n: 6 }; // (device pixels: the copy drawn is at least that wide)
  let A1 = townVersion(look, st, late ? tb : ta, px, budget), B1 = tb !== ta ? townVersion(look, st, late ? ta : tb, px, budget) : null;
  if (!A1) { A1 = B1 || townVersion(look, st, 'day', px, budget); B1 = null; } // (its version for now not made yet: another stands in for a frame)
  // fading while one of your robots is behind it
  const f0 = _tf.get(r.id) || 0, hide = live && townHides(r, townSprite(r)) ? 1 : 0;
  const fade = f0 + (hide - f0) * Math.min(1, (R.dt || 0.016) * 8);
  if (fade > 0.01) _tf.set(r.id, fade); else _tf.delete(r.id);
  const ga = ctx.globalAlpha;
  ctx.globalAlpha = ga * (1 - 0.65 * fade);
  const put = (v) => { const s = v.S, q = z / (s.p || A.ppt); ctx.drawImage(v.img, X - s.fl[0] * q * sx, Y - s.fl[1] * q, s.size[0] * q * sx, s.size[1] * q); };
  if (A1) put(A1); else { townBlock(ctx, r, X, Y, z); }
  const over = tod ? (late ? 1 - tod.f : tod.f) : 0;
  if (A1 && B1 && over > 0.002) { ctx.globalAlpha = ga * (1 - 0.65 * fade) * over; put(B1); }
  ctx.globalAlpha = ga;
  // at night: a few of its lit windows falter now and then (a standing building's)
  const N = look.L.n;
  if (live && night > 0.3 && st === 'd' && N && N.flick && townHash(r, 90) < 0.35) {
    ctx.fillStyle = 'rgba(16,20,30,0.85)';
    N.flick.forEach(([fx, fy, fw, fh], q) => { if (hash2(Math.floor(R.time * (2 + q)), r.id * 3 + q, 4402) < 0.22) ctx.fillRect(X + (fx - N.fl[0]) * k * sx, Y + (fy - N.fl[1]) * k, fw * k * sx, fh * k); });
  }
  const at = (p) => [X + (p[0] - S0.fl[0]) * k * sx, Y + (p[1] - S0.fl[1]) * k];
  if (live && st === 'd' && look.L.d.beacon && night > 0.05) { // the civic tower's beacon (dusk to dawn), breathing
    const D = look.L.d, [bx, by] = [X + (D.beacon[0] - D.fl[0]) * k * sx, Y + (D.beacon[1] - D.fl[1]) * k];
    ctx.save(); ctx.globalCompositeOperation = 'lighter'; const a = night * (0.45 + 0.4 * Math.sin(R.time * 1.3)); const gr = ctx.createRadialGradient(bx, by, 0, bx, by, z * 1.4); gr.addColorStop(0, `rgba(255,236,190,${a})`); gr.addColorStop(1, 'rgba(255,236,190,0)'); ctx.fillStyle = gr; ctx.fillRect(bx - z * 1.4, by - z * 1.4, z * 2.8, z * 2.8); ctx.restore();
  }
  if (live && st === 'd' && look.L.d.mast && Math.sin(R.time * 3.1 + r.id) > 0.6) { // a tower's red light, blinking
    const D = look.L.d, mx = X + (D.mast[0] - D.fl[0]) * k * sx, my = Y + (D.mast[1] - D.fl[1]) * k, s = Math.max(2, z * 0.07);
    ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.fillStyle = '#ff3a2a'; ctx.fillRect(mx - s / 2, my - s / 2, s, s); ctx.restore();
  }
  if (r.sen > 0) { const [sx0, sy0] = at(S0.roof); townSentryDraw(ctx, r, sx0, sy0, z, live); }
}

/** An old Accord sentry at its post on the roof (x, y: its foot on screen): a squat white robot with a blue band and a lit visor. */
function townSentryDraw(ctx, r, x, y, z, live) {
  const c = (h) => (typeof todColor === 'function' ? todColor(h) : h);
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
    if (inView(x, y, 3) && townIn(x - 1, y - 1)) pool(ox + x * z, oy + y * z, z * 0.9, '#ffd9a0');
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
  const x0 = ox + T.x0 * z, x1 = ox + (T.x1 + 1) * z, y0 = oy + (T.y0 - 1.5) * z, y1 = oy + (T.y1 + 2.5) * z;
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
    const cx = ox + (T.x0 + ((hash2(k, 1, 4501) * (T.x1 - T.x0 + 1) + t * 0.12 * (0.5 + hash2(k, 2, 4502))) % (T.x1 - T.x0 + 9)) - 4) * z, cy = oy + (T.y0 + hash2(k, 3, 4503) * (T.y1 - T.y0)) * z, rr = z * (3 + hash2(k, 4, 4504) * 4);
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

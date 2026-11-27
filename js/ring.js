'use strict';
/*
 * Terrafall — The Ring's look (SHAPE_PRESETS asteroids, ringMap in js/world.js): the space behind the asteroids.
 * Looks only: nothing here reads or changes anything the game decides, so it may use Math.random and the real clock.
 *
 *   - ringSpace: what shows where there is no ground (the map is drawn over it, its void tiles left clear): high orbit
 *     round Ithaca I, among the Ring's rocks (ART_GUIDE.md: Batch 40, "Shadow pass"). Painted pictures (art/ring/, made
 *     by tools/ringsky/ringsky.py):
 *       the far layer: the deep sky (the galaxy's band, faint nebulae, a grain of far stars) with two tiles of brighter
 *       stars drawn crisp in code; Corvane, its glare and spikes; Ithaca I with the Ring round it, and Argos. The rocks go
 *       round through the planet's shadow once a day, so the backdrop follows the day: by day Corvane stands clear and
 *       the planet is lit gibbous; at dusk the star sinks to its limb and the planet thins to a crescent; at night
 *       Corvane is behind it, a black disc ringed with lit air and the colonies' lights, the Ring glowing with the light
 *       it lets through; at dawn the star comes out on the other limb. Each time of day has its picture of the planet,
 *       crossfaded as the day turns. It slides a little as the view pans (2 %, within its margin);
 *       over it, each frame: Corvane's flare and the lens (a streak and a few ghosts) while it's out, a few of the
 *       Ring's rocks drifting by (nearer: they slide more, and darken at night), and now and then a streak of ringfall.
 *     The asteroids themselves stay put.
 *   - ringClipLand: the day's light and the dusk are graded over the ground only (space is lit by the backdrop's own day).
 *   - Cheap: the far layer is one canvas made again only when the view's size or the backdrop's day changes (rspFar: in
 *     1/24 steps of a crossfade, about every second while the day turns), each picture scaled once to the size it shows
 *     at (rspFit); a frame draws it once, then a few sprites. The pictures load only on The Ring (ensureRingArt; in the
 *     one-file build a bundle beside the page, ring-art.js); till they're in, a plain deep sky. Graphics Saver: no
 *     drifting rocks, ringfall or lens ghosts; reduced motion: everything holds still.
 */

const RSP = { of: null, tiles: null, spr: {}, fit: new Map(), falls: [], next: 0, last: 0, t: 0, landFor: null, rocks: null, far: null };
const _ra = { state: '', img: new Map() };

/** Load The Ring's pictures (art/ring/ring-art.js: window.RING_ART, the list and layout; the pictures beside it). */
function ensureRingArt() {
  if (_ra.state || typeof document === 'undefined') return;
  _ra.state = 'loading';
  const go = () => {
    const A = window.RING_ART;
    if (!A) { _ra.state = 'failed'; return; }
    _ra.state = 'in';
    for (const name in A) if (A[name] && A[name].w) ringImg(name);
  };
  if (window.RING_ART) { go(); return; }
  const s = document.createElement('script');
  s.src = window.RING_BUNDLE ? 'ring-art.js' : 'art/ring/ring-art.js';
  s.onload = go;
  s.onerror = () => { _ra.state = 'failed'; }; // (no pictures: the plain sky)
  document.head.appendChild(s);
}

/** Picture `name` (art/ring/<name>.webp), loading it the first time; null till it's in. */
function ringImg(name) {
  let e = _ra.img.get(name);
  if (!e) {
    e = { img: null };
    _ra.img.set(name, e);
    const A = window.RING_ART, d = A && A.data;
    if (A && A[name]) loadImg(d && d[name] ? d[name] : `art/ring/${name}.webp`, (img) => { e.img = img; });
  }
  return e.img;
}

/** Picture `name` scaled once to w × h device px (smoothly, in halving steps), for drawing unscaled each frame. */
function rspFit(name, w, h) {
  const img = ringImg(name);
  if (!img) return null;
  w = Math.max(1, Math.round(w)); h = Math.max(1, Math.round(h));
  const key = name + ':' + w + 'x' + h, hit = RSP.fit.get(name);
  if (hit && hit.key === key) return hit.c;
  let src = img, sw = img.width, sh = img.height;
  while (sw / 2 >= w * 1.05 && sh / 2 >= h * 1.05) { // (halving down first keeps a big picture sharp but not ragged)
    const c = document.createElement('canvas'); c.width = Math.round(sw / 2); c.height = Math.round(sh / 2);
    const g = c.getContext('2d'); g.imageSmoothingQuality = 'high'; g.drawImage(src, 0, 0, c.width, c.height);
    src = c; sw = c.width; sh = c.height;
  }
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  const g = c.getContext('2d'); g.imageSmoothingQuality = 'high'; g.drawImage(src, 0, 0, w, h);
  RSP.fit.set(name, { key, c });
  return c;
}

/** A soft disc sprite in colour rgb (alpha 1 at the middle falling to 0 at the edge), made once. */
function rspSprite(name, rgb, core) {
  if (RSP.spr[name]) return RSP.spr[name];
  const n = 96, c = document.createElement('canvas');
  c.width = c.height = n;
  const g = c.getContext('2d'), gr = g.createRadialGradient(n / 2, n / 2, 0, n / 2, n / 2, n / 2);
  if (core) { gr.addColorStop(0, 'rgba(255,255,250,1)'); gr.addColorStop(0.1, `rgba(${rgb},0.95)`); gr.addColorStop(0.4, `rgba(${rgb},0.28)`); }
  else { gr.addColorStop(0, `rgba(${rgb},1)`); gr.addColorStop(0.5, `rgba(${rgb},0.35)`); }
  gr.addColorStop(1, `rgba(${rgb},0)`);
  g.fillStyle = gr; g.fillRect(0, 0, n, n);
  return (RSP.spr[name] = c);
}

/** One tile of stars: `n` of them in a size × size tile, `big` of the brightest with a little cross of light. */
function rspStarTile(seed, size, n, bigShare, dim, d) {
  const c = document.createElement('canvas');
  c.width = c.height = Math.round(size * d);
  const g = c.getContext('2d');
  g.scale(d, d);
  for (let k = 0; k < n; k++) {
    const x = 3 + hash2(k, 3, seed) * (size - 6), y = 3 + hash2(k, 4, seed) * (size - 6), b = hash2(k, 5, seed), tint = hash2(k, 6, seed);
    const rgb = tint > 0.86 ? '255,226,196' : tint < 0.16 ? '190,212,255' : '226,234,255';
    const r = b > 1 - bigShare ? 1.15 : 0.6 + 0.35 * b;
    g.fillStyle = `rgba(${rgb},${dim * (0.35 + 0.65 * b)})`;
    g.fillRect(x - r / 2, y - r / 2, r, r);
    if (b > 1 - bigShare) {
      g.fillStyle = `rgba(${rgb},${dim * 0.18})`;
      g.fillRect(x - 2.6, y - 0.3, 5.2, 0.6); g.fillRect(x - 0.3, y - 2.6, 0.6, 5.2);
    }
  }
  return c;
}

/** Ringfall in the sky: now and then a streak across the view, a spark where it burns out. */
function rspFalls(g, dt, calm) {
  const t = RSP.t;
  if (!calm && t >= RSP.next) {
    const a = 0.5 + Math.random() * 0.7, left = Math.random() < 0.5;
    RSP.falls.push({ x: Math.random() * R.w * (left ? 0.9 : 1.1), y: -10 + Math.random() * R.h * 0.5, dx: (left ? 1 : -1) * Math.cos(a), dy: Math.sin(a), sp: 360 + Math.random() * 360, len: 60 + Math.random() * 110, life: 0.8 + Math.random() * 0.8, age: 0 });
    RSP.next = t + 2.6 + Math.random() * 5.5;
  }
  const fl = rspSprite('fall', '255,220,180', true);
  g.save(); g.globalCompositeOperation = 'lighter';
  for (const f of RSP.falls) {
    f.age += dt;
    const k = f.age / f.life, hx = f.x + f.dx * f.sp * f.age, hy = f.y + f.dy * f.sp * f.age, a = Math.max(0, 1 - k) * Math.min(1, f.age * 8);
    const tx = hx - f.dx * f.len * Math.min(1, f.age * 3), ty = hy - f.dy * f.len * Math.min(1, f.age * 3);
    const gr = g.createLinearGradient(tx, ty, hx, hy);
    gr.addColorStop(0, 'rgba(255,200,150,0)'); gr.addColorStop(1, `rgba(255,236,208,${0.85 * a})`);
    g.strokeStyle = gr; g.lineWidth = 1.4; g.beginPath(); g.moveTo(tx, ty); g.lineTo(hx, hy); g.stroke();
    if (k > 0.82) { const s = 6 + 10 * (k - 0.82); g.globalAlpha = (1 - k) * 4; g.drawImage(fl, hx - s, hy - s, s * 2, s * 2); g.globalAlpha = 1; }
  }
  g.restore();
  RSP.falls = RSP.falls.filter((f) => f.age < f.life);
}

/** How much of each time of day it is now (they add up to 1): the backdrop's own day, which follows the game's. */
function rspDay() {
  const w = { day: 0, morning: 0, evening: 0, night: 0 }, st = typeof todNow === 'function' ? todNow() : null;
  if (!st) { w.day = 1; return w; }
  w[st.a] += 1 - st.f; w[st.b] += st.f;
  return w;
}

/** The drifting rocks' picture, and the same darkened for the planet's shadow (made once). */
function rspRockSheets(A) {
  if (RSP.rocks && RSP.rocks.of === A) return RSP.rocks;
  const img = ringImg('rocks');
  if (!img) return null;
  const dark = document.createElement('canvas'); dark.width = img.width; dark.height = img.height;
  const g = dark.getContext('2d');
  g.drawImage(img, 0, 0); g.globalCompositeOperation = 'source-atop'; g.fillStyle = 'rgba(4,6,14,0.82)'; g.fillRect(0, 0, dark.width, dark.height);
  return (RSP.rocks = { of: A, img, dark });
}

/** Where the bodies sit for a view W × H (css px, no pan): the planet (px, py, pr and its scale k), Argos, Corvane. */
function rspLayout(A, day, W, H) {
  const L = A.layout, lay = H > W * 1.1 ? L.tall : L.wide, mn = Math.min(W, H), P = A['planet-day'];
  const pr = clamp(lay.planet[2] * mn, 90, 560), px = lay.planet[0] * W, py = lay.planet[1] * H;
  let ux = 0, uy = 0;
  for (const n in day) { const s = L.sun[n] || L.sun.day; ux += s[0] * day[n]; uy += s[1] * day[n]; }
  return {
    px, py, pr, k: pr / P.r, mx: lay.argos[0] * W, my: lay.argos[1] * H, mr: clamp(lay.argos[2] * mn, 14, 90),
    sx: px + ux * pr, sy: py + uy * pr, clear: clamp((Math.hypot(ux, uy) - 0.9) / 0.5, 0, 1), // (clear: how far Corvane is out from behind the planet)
  };
}

/**
 * The far layer, made again only when the view's size, the pictures in or the backdrop's day change (its crossfades in
 * 1/24 steps): the deep sky, the stars, Corvane, Ithaca I with its Ring and Argos, on one canvas a margin `m` bigger
 * than the view all round, so the whole of it can slide a little as the view pans. Each frame then draws it once.
 */
function rspFar(A, day, W, H, d) {
  const m = Math.round(Math.max(W, H) * 0.04), q = (v) => Math.round(v * 24);
  let got = 0;
  for (const e of _ra.img.values()) if (e.img) got++;
  const key = [W, H, d, got, q(day.day), q(day.morning), q(day.evening), q(day.night)].join(',');
  if (RSP.far && RSP.far.key === key) return RSP.far;
  const c = (RSP.far && RSP.far.c) || document.createElement('canvas'), cw = W + 2 * m, ch = H + 2 * m;
  if (c.width !== Math.round(cw * d) || c.height !== Math.round(ch * d)) { c.width = Math.round(cw * d); c.height = Math.round(ch * d); }
  const g = c.getContext('2d');
  g.setTransform(d, 0, 0, d, 0, 0);
  // the deep sky
  const sky = A.sky;
  if (ringImg('sky')) {
    const k = Math.max(cw / sky.w, ch / sky.h), sw = sky.w * k, sh = sky.h * k;
    g.drawImage(rspFit('sky', sw * d, sh * d), (cw - sw) / 2, (ch - sh) / 2, sw, sh);
  } else { g.fillStyle = '#070b17'; g.fillRect(0, 0, cw, ch); }
  // two layers of brighter stars drawn crisp at the screen's own pixels
  if (!RSP.tiles || RSP.tiles.d !== d) { RSP.tiles = [rspStarTile(23, 360, 56, 0.05, 0.9, d), rspStarTile(37, 448, 26, 0.16, 1, d)]; RSP.tiles.d = d; }
  for (const [k, o] of [[0, 0], [1, 131]]) {
    const tile = RSP.tiles[k], size = tile.width / d;
    for (let y = -o; y < ch; y += size) for (let x = -o * 0.7; x < cw; x += size) g.drawImage(tile, x, y, size, size);
  }
  g.translate(m, m);
  const Lo = rspLayout(A, day, W, H), P = A['planet-day'];
  // Corvane first (the planet hides it when it's behind): its wide glare and its picture
  g.globalCompositeOperation = 'lighter';
  { const r = Lo.pr * 2.4; g.globalAlpha = 0.3; g.drawImage(rspSprite('corona', '255,150,80'), Lo.sx - r, Lo.sy - r, r * 2, r * 2); }
  const cv = ringImg('corvane');
  if (cv) { const r = Lo.pr * A.layout.sunSize; g.globalAlpha = 1; g.drawImage(cv, Lo.sx - r, Lo.sy - r, r * 2, r * 2); }
  g.globalCompositeOperation = 'source-over';
  // Ithaca I: the picture for the time of day, crossfaded into the next
  const order = Object.keys(day).filter((n) => day[n] > 0.02 && A['planet-' + n]).sort((a, b) => day[b] - day[a]);
  const pw = P.w * Lo.k, ph = P.h * Lo.k;
  order.forEach((n, i) => {
    const pc = rspFit('planet-' + n, pw * d, ph * d);
    if (!pc) return;
    g.globalAlpha = i === 0 ? 1 : day[n] / (day[n] + day[order[0]]);
    g.drawImage(pc, Lo.px - P.cx * Lo.k, Lo.py - P.cy * Lo.k, pw, ph);
  });
  // Argos, lit, or backlit as the rocks go into the planet's shadow
  const M = A['argos-day'], mk = Lo.mr / M.r, mw = M.w * mk, mh = M.h * mk, dark = day.night + 0.5 * (day.evening + day.morning);
  const ma = rspFit('argos-day', mw * d, mh * d), mb = A['argos-night'] && rspFit('argos-night', mw * d, mh * d);
  g.globalAlpha = 1;
  if (ma) g.drawImage(ma, Lo.mx - M.cx * mk, Lo.my - M.cy * mk, mw, mh);
  if (mb && dark > 0.01) { g.globalAlpha = dark; g.drawImage(mb, Lo.mx - M.cx * mk, Lo.my - M.cy * mk, mw, mh); }
  g.globalAlpha = 1;
  return (RSP.far = { key, c, m, Lo });
}

/**
 * The space behind the asteroids, for the frame: ox, oy the map's corner on screen (css px) and z the zoom. Called instead of
 * drawOffMap on The Ring (R.void), over the dark fill the frame starts with.
 */
function ringSpace(ctx, ox, oy, z) {
  if (RSP.of !== S) { RSP.of = S; RSP.falls = []; RSP.next = 1.5; RSP.last = 0; RSP.t = 0; ensureRingArt(); }
  const now = performance.now() / 1000, dt = RSP.last ? Math.min(0.1, now - RSP.last) : 0;
  RSP.last = now;
  const still = !!(LESS_MOTION && LESS_MOTION.matches), saver = typeof gfxStep === 'function' && gfxStep() === 'saver', calm = still || saver;
  if (!calm) RSP.t += dt;
  const T = still ? 0 : RSP.t, d = Math.min(R.dpr || 1, 2), W = R.w, H = R.h, A = _ra.state === 'in' ? window.RING_ART : null;
  const camx = (R.cam.x - S.W / 2) * z, camy = (R.cam.y - S.H / 2) * z; // (how far the view has moved from the middle of the map, px)
  if (!A) { // (till the pictures are in: a plain deep sky)
    const bg = ctx.createLinearGradient(0, 0, W * 0.4, H);
    bg.addColorStop(0, '#0b1124'); bg.addColorStop(0.5, '#070b17'); bg.addColorStop(1, '#04060d');
    ctx.fillStyle = bg; ctx.fillRect(0, 0, W, H);
    rspFalls(ctx, dt, calm);
    return;
  }
  const day = rspDay(), F = rspFar(A, day, W, H, d), Lo = F.Lo;
  // the far layer, slid a little against the pan (the asteroids move with the view, it hardly at all)
  const fx = clamp(-camx * 0.02, -F.m, F.m), fy = clamp(-camy * 0.02, -F.m, F.m);
  ctx.drawImage(F.c, fx - F.m, fy - F.m, W + 2 * F.m, H + 2 * F.m);
  const sx = Lo.sx + fx, sy = Lo.sy + fy;
  // Corvane flares now and then (LORE.md), and when it's out the lens catches it: a long thin streak and a few faint ghosts toward the middle
  if (Lo.clear > 0.01) {
    const flare = still ? 0 : Math.max(0, Math.sin((T / 37) * Math.PI * 2)) ** 12, rs = Lo.pr * 0.1, cr = rspSprite('core', '255,214,160', true);
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    if (flare > 0.01) { const r = Lo.pr * 1.6; ctx.globalAlpha = 0.35 * flare * Lo.clear; ctx.drawImage(rspSprite('corona', '255,150,80'), sx - r, sy - r, r * 2, r * 2); }
    ctx.globalAlpha = (0.2 + 0.12 * flare) * Lo.clear; ctx.drawImage(cr, sx - rs * 22, sy - rs * 0.2, rs * 44, rs * 0.4);
    if (!saver) {
      for (const [f, s, a, rgb] of [[0.3, 0.9, 0.05, '255,170,110'], [0.55, 0.35, 0.08, '150,200,255'], [0.8, 0.6, 0.04, '190,255,210'], [1.3, 1.5, 0.035, '255,150,80']]) {
        const gx = sx + (W / 2 - sx) * f, gy = sy + (H / 2 - sy) * f, gr = rs * s * 3;
        ctx.globalAlpha = a * Lo.clear * (1 + flare); ctx.drawImage(rspSprite('ghost' + rgb, rgb), gx - gr, gy - gr, gr * 2, gr * 2);
      }
    }
    ctx.restore();
  }
  // a few of the Ring's rocks drifting by, nearer than the rest, in the planet's shadow at night
  const n = saver ? 0 : (A.layout.rocks || 7), rk = n && rspRockSheets(A);
  if (rk) {
    const cell = A.rocks.cell, m = 80, mn = Math.min(W, H), dark = day.night + 0.5 * (day.evening + day.morning);
    for (let i = 0; i < n; i++) {
      const h = (j) => hash2(i, j, 5151), par = 0.08 + 0.22 * h(1), sz = (10 + 34 * h(2) ** 2) * (0.6 + par * 2) * (mn / 900 + 0.4);
      const vx = (h(3) - 0.5) * 7, vy = (h(4) - 0.35) * 4, fw = W + 2 * m, fh = H + 2 * m;
      const x = ((((h(5) * fw - camx * par + T * vx) % fw) + fw) % fw) - m, y = ((((h(6) * fh - camy * par + T * vy) % fh) + fh) % fh) - m;
      const rot = h(7) * 6.28 + T * (h(8) - 0.5) * 0.12, ci = i % (A.rocks.n || 8);
      ctx.save(); ctx.translate(x, y); ctx.rotate(rot);
      ctx.drawImage(rk.img, ci * cell, 0, cell, cell, -sz / 2, -sz / 2, sz, sz);
      if (dark > 0.01) { ctx.globalAlpha = dark; ctx.drawImage(rk.dark, ci * cell, 0, cell, cell, -sz / 2, -sz / 2, sz, sz); }
      ctx.restore();
    }
  }
  rspFalls(ctx, dt, calm);
}

/**
 * Clip to the asteroids (their ground and the first tile of rock face under each): what the light of the day and the dusk is graded over, so the
 * space stays as it is. Call between ctx.save() and ctx.restore(); the map's drawing resumes in screen space after it.
 */
function ringClipLand(ctx, ox, oy, z) {
  if (RSP.landFor !== S || !RSP.land) {
    RSP.landFor = S;
    const p = new Path2D(), W = S.W, H = S.H;
    const land = (i, j) => inMap(i, j) && S.terrain[j * W + i] !== T_CHASM;
    for (let j = 0; j < H; j++) {
      let i0 = -1;
      for (let i = 0; i <= W; i++) {
        const on = i < W && (land(i, j) || land(i, j - 1)); // (the ground and the first tile of rock face under it: the fading second tile is left to the sky)
        if (on && i0 < 0) i0 = i;
        else if (!on && i0 >= 0) { p.rect(i0, j, i - i0 + 0.04, 1.04); i0 = -1; }
      }
    }
    RSP.land = p;
  }
  ctx.translate(ox, oy); ctx.scale(z, z);
  ctx.clip(RSP.land);
  ctx.setTransform(R.dpr, 0, 0, R.dpr, 0, 0);
}

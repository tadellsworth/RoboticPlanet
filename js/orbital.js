'use strict';
/*
 * Terrafall — Orbital platforms' look (SHAPE_PRESETS orbital, orbitalMap in js/world.js, the rules in js/sim.js: orbSet, orbTick).
 * Looks only: nothing here reads or changes anything the game decides, so it may use Math.random and the real clock.
 *
 *   - orbitalSky: what shows where there is no deck (drawn instead of the off-map land, the void tiles left clear over it): Ithaca I
 *     seen from the station, far below. Painted layers (art/orbital, renderer/post/orbital_sky.py; ART_GUIDE.md, Batch 39): the
 *     planet's curved limb and its thin blue air with the Ring arcing up out of the sky, the continents of the atlas (the Rust's
 *     coast, the archipelago, Greenreach) under two decks of cloud, one picture for each light: by day lit from the upper left
 *     (the game's key light); at dusk the terminator across it and Corvane on the limb (mirrored at morning, the sun rising on the
 *     other side); at night the colonies' lights. The game's time of day crossfades them. Over the picture: the stars above the
 *     limb (drawn in code, sharp at any size), a near deck of cloud drifting under the decks, and the decks' own shadow on the air
 *     below them (down and right, as every shadow falls). Slow parallax: the picture slides a little as the view pans (toward the
 *     north end of the map the sky opens, toward the south the planet fills the view), the near cloud more. The pictures load
 *     only for this map (ensureOrbArt: art/orbital/orbital-art.js, in the one-file build the bundle dist/orbital-art.js); till
 *     they're in, the sky is drawn in code (orbSkyCode: space, the limb, ocean and land, two layers of cloud).
 *   - orbDeckPaint (baked with the ground): Accord station plating in 2 × 2 tile panels, seams, rivets, a kerb and railing along
 *     every edge that has space beyond it (a bridge's head has none while the bridge is down), hazard plating on the bridges.
 *   - orbVoidPaint (baked): the station's hull showing under a deck's southern edge, fading into the dark, instead of rock.
 *   - orbitalBridges (every frame): the drawbridge leaves. A raised bridge stands up at its hinge; one being raised flashes amber
 *     (the warning), then the leaf swings up; one being lowered swings down; lamps at its corners show red (up or moving) or green.
 *   - drawOrbBox: a control box, a console lit in the colour of the colony that holds it.
 * Graphics Saver draws the picture and the stars only (no near cloud, no motion; in code, one cloud layer); reduced motion holds
 * everything still.
 */

const ORBV = { of: null, stars: null, tex: null, last: 0, t: 0, ver: -1, art: '', img: {}, tint: {}, dk: null, dkVer: -2, dkFor: null };

/** A tileable noise texture (size × size): fbm of value noise whose lattice wraps, white-blue clouds over transparent (kind 'cloud') or colour patches (kind 'land'). */
function orbTexture(kind, size, cells, seed) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const g = c.getContext('2d'), img = g.createImageData(size, size), d = img.data;
  const lat = (a, b, per) => hash2(((a % per) + per) % per, ((b % per) + per) % per, seed);
  const sm = (v) => v * v * (3 - 2 * v);
  const noise = (x, y, per) => {
    const xi = Math.floor(x), yi = Math.floor(y), fx = sm(x - xi), fy = sm(y - yi);
    const a = lat(xi, yi, per), b = lat(xi + 1, yi, per), cc = lat(xi, yi + 1, per), dd = lat(xi + 1, yi + 1, per);
    return a + (b - a) * fx + (cc - a) * fy + (a - b - cc + dd) * fx * fy;
  };
  for (let j = 0; j < size; j++) for (let i = 0; i < size; i++) {
    let v = 0, amp = 0.5, tot = 0, per = cells;
    for (let o = 0; o < 5; o++) { v += amp * noise((i / size) * per, (j / size) * per, per); tot += amp; amp *= 0.5; per *= 2; }
    v /= tot;
    const o = (j * size + i) * 4;
    if (kind === 'cloud') {
      const a = clamp((v - 0.5) * 3.4, 0, 1), sh = clamp((v - 0.56) * 4, 0, 1);
      d[o] = 238 - 28 * sh; d[o + 1] = 244 - 22 * sh; d[o + 2] = 252 - 8 * sh; d[o + 3] = a * 235;
    } else {
      const a = clamp((v - 0.47) * 6, 0, 1), dry = clamp((v - 0.58) * 5, 0, 1);
      d[o] = 64 + 90 * dry; d[o + 1] = 112 - 14 * dry; d[o + 2] = 60 + 4 * dry; d[o + 3] = a * 150;
    }
  }
  g.putImageData(img, 0, 0);
  return c;
}

/** Called once a frame on an orbital map: the day's grading is clipped to the decks (ringClipLand), so its outline is made again when a bridge moves. */
function orbitalFrame() {
  if (ORBV.of !== S) { ORBV.of = S; ORBV.ver = -1; }
  if (S.orb && ORBV.ver !== S.orb.ver) { ORBV.ver = S.orb.ver; RSP.land = null; }
}

/*
 * The painted backdrop's numbers. cover: how much bigger than the screen the picture is drawn (the room it slides in);
 * slide: the most it slides as the view pans across the whole map, as a share of the screen's longer side; cloud: the near
 * cloud's size (of the screen's longer side), its slide with the view (px per px the view moves), drift (px a second) and
 * strength by each light; stars: how bright the stars over the limb show by each light; shadow: the decks' shadow on the
 * air below them (its offset in tiles, down and right, and its darkness).
 */
const ORB_SKY = {
  cover: 1.24, slide: 0.1,
  cloud: { size: 0.95, par: 0.06, vx: 3.2, vy: 1.1, alpha: { day: 0.3, dusk: 0.24, night: 0.16 } },
  stars: { day: 0.45, dusk: 0.8, night: 1 },
  shadow: { dx: 0.35, dy: 0.7, alpha: 0.42 },
};
/** Which picture each time of day shows (morning is dusk's, mirrored: the sun rises on the other side). */
const ORB_TOD = { day: 'orb-day', morning: 'orb-dusk', evening: 'orb-dusk', night: 'orb-night' };

/** Load the backdrop's list and pictures for an Orbital platforms map (once). */
function ensureOrbArt() {
  if (ORBV.art || typeof document === 'undefined') return;
  ORBV.art = 'loading';
  const go = () => {
    const A = window.ORBITAL_ART;
    if (!A) { ORBV.art = 'failed'; return; }
    ORBV.art = 'in';
    for (const n of A.names) {
      const d = A.data && A.data[n];
      loadImg(d || `art/orbital/${n}.webp`, (img) => { ORBV.img[n] = img; });
    }
  };
  if (window.ORBITAL_ART) { go(); return; }
  const s = document.createElement('script');
  s.src = window.ORBITAL_BUNDLE ? 'orbital-art.js' : 'art/orbital/orbital-art.js';
  s.onload = go;
  s.onerror = () => { ORBV.art = 'failed'; }; // (no pictures: the sky drawn in code)
  document.head.appendChild(s);
}

/** The near cloud tile tinted for a light ('day', 'dusk' or 'night'), made once each. */
function orbCloudTint(key) {
  if (ORBV.tint[key]) return ORBV.tint[key];
  const src = ORBV.img['orb-cloud'];
  if (!src) return null;
  const c = document.createElement('canvas');
  c.width = src.width; c.height = src.height;
  const g = c.getContext('2d');
  g.drawImage(src, 0, 0);
  if (key !== 'day') {
    g.globalCompositeOperation = 'source-atop';
    g.fillStyle = key === 'dusk' ? 'rgba(150,92,70,0.62)' : 'rgba(22,30,52,0.86)';
    g.fillRect(0, 0, c.width, c.height);
  }
  return (ORBV.tint[key] = c);
}

/** The decks as a small soft mask (two pixels a tile, drawn up smoothly), made again when a bridge moves: their shadow on the air. */
function orbDeckMask() {
  const ver = S.orb ? S.orb.ver : 0;
  if (ORBV.dk && ORBV.dkVer === ver && ORBV.dkFor === S) return ORBV.dk;
  ORBV.dkVer = ver; ORBV.dkFor = S;
  const k = 2, c = ORBV.dk || document.createElement('canvas');
  c.width = S.W * k + 4; c.height = S.H * k + 4; // (sizing it empties it)
  const g = c.getContext('2d');
  g.fillStyle = '#000';
  for (let j = 0; j < S.H; j++) {
    let i0 = -1;
    for (let i = 0; i <= S.W; i++) {
      const on = i < S.W && S.terrain[j * S.W + i] !== T_CHASM;
      if (on && i0 < 0) i0 = i;
      else if (!on && i0 >= 0) { g.fillRect(2 + i0 * k, 2 + j * k, (i - i0) * k, k); i0 = -1; }
    }
  }
  return (ORBV.dk = c);
}

/** How much of the day's light is in the sky (1 by day, 0 at night) for time of day st (todNow). */
function orbDaylight(st) {
  const v = (n) => (n === 'day' ? 1 : n === 'night' ? 0 : 0.5);
  return v(st.a) * (1 - st.f) + v(st.b) * st.f;
}

/** The high atmosphere behind the decks, for the frame: ox, oy the map's corner on screen (css px) and z the zoom. Called instead of drawOffMap (R.void), over the dark fill the frame starts with. */
function orbitalSky(ctx, ox, oy, z) {
  ensureOrbArt();
  const A = window.ORBITAL_ART, st = typeof todNow === 'function' ? todNow() : { a: 'day', b: 'day', f: 0 };
  const ia = A && ORBV.img[ORB_TOD[st.a] || 'orb-day'], ib = A && ORBV.img[ORB_TOD[st.b] || 'orb-day'];
  if (ia && (ib || st.f < 0.5)) orbSkyArt(ctx, z, A, st);
  else orbSkyCode(ctx, ox, oy, z);
  // The decks' shadow on the air below them: down and right, as every shadow falls.
  const m = orbDeckMask(), k = 2, sh = ORB_SKY.shadow;
  ctx.save();
  ctx.globalAlpha = sh.alpha * (0.6 + 0.4 * orbDaylight(st));
  ctx.imageSmoothingEnabled = true;
  ctx.drawImage(m, ox + (sh.dx - 2 / k) * z, oy + (sh.dy - 2 / k) * z, (m.width / k) * z, (m.height / k) * z);
  ctx.restore();
}

/** The painted backdrop (ensureOrbArt's pictures in): the picture for the light (crossfaded), the stars over the limb, the near cloud. */
function orbSkyArt(ctx, z, A, st) {
  const now = performance.now() / 1000, dt = ORBV.last ? Math.min(0.1, now - ORBV.last) : 0;
  ORBV.last = now;
  const still = !!(LESS_MOTION && LESS_MOTION.matches), saver = typeof gfxStep === 'function' && gfxStep() === 'saver', calm = still || saver;
  if (!calm) ORBV.t += dt;
  const T = calm ? 0 : ORBV.t, d = Math.min(R.dpr || 1, 2), W = R.w, H = R.h, P = ORB_SKY;
  // Where the picture lies: drawn to cover the screen with room to spare, slid by where the view is on the map.
  const sc = Math.max(W / A.w, H / A.h) * P.cover, DW = A.w * sc, DH = A.h * sc;
  const fx = clamp((R.cam.x / S.W) * 2 - 1, -1, 1), fy = clamp((R.cam.y / S.H) * 2 - 1, -1, 1), L = Math.max(W, H) * P.slide;
  const x0 = (W - DW) / 2 - fx * Math.min((DW - W) / 2, L), y0 = (H - DH) / 2 - fy * Math.min((DH - H) / 2, L);
  const draw = (name, alpha) => {
    const img = ORBV.img[ORB_TOD[name] || 'orb-day'];
    if (!img || alpha <= 0) return;
    ctx.globalAlpha = alpha;
    if (name === 'morning') { ctx.save(); ctx.translate(W, 0); ctx.scale(-1, 1); ctx.drawImage(img, W - x0 - DW, y0, DW, DH); ctx.restore(); }
    else ctx.drawImage(img, x0, y0, DW, DH);
    ctx.globalAlpha = 1;
  };
  ctx.imageSmoothingEnabled = true;
  draw(st.a, 1);
  if (st.b !== st.a && st.f > 0) draw(st.b, st.f);
  // The limb on screen (mirrored it's the same circle: the picture is framed on it).
  const lb = A.limb, lx = lb ? x0 + lb.cx * DW : 0, ly = lb ? y0 + lb.cy * DW : 0, lr = lb ? lb.r * DW : 0;
  const lightOf = (n) => (n === 'day' ? 'day' : n === 'night' ? 'night' : 'dusk');
  const la = lightOf(st.a), lz = lightOf(st.b);
  // Stars above the limb: sharp at any size, brighter as the light goes.
  if (lb && ly - lr > -20) {
    if (!ORBV.stars) ORBV.stars = rspStarTile(53, 384, 120, 0.02, 0.9, d);
    const size = ORBV.stars.width / d, camx = (R.cam.x - S.W / 2) * z, camy = (R.cam.y - S.H / 2) * z;
    const offx = (((-camx * 0.02 - T * 1.2) % size) + size) % size, offy = (((-camy * 0.02) % size) + size) % size;
    ctx.save();
    ctx.beginPath(); ctx.rect(0, 0, W, Math.min(H, ly)); ctx.arc(lx, ly, lr + 3, 0, Math.PI * 2); ctx.clip('evenodd');
    ctx.globalAlpha = P.stars[la] * (1 - st.f) + P.stars[lz] * st.f;
    ctx.globalCompositeOperation = 'lighter';
    const top = Math.min(H, ly - lr + 20);
    for (let y = offy - size; y < top; y += size) for (let x = offx - size; x < W; x += size) ctx.drawImage(ORBV.stars, x, y, size, size);
    ctx.restore();
  }
  // The near cloud drifting under the decks (not on Graphics Saver: the picture has its own): over the planet only, ramping in
  // below the limb, where the picture's own cloud is too far off for it.
  if (!saver && ORBV.img['orb-cloud']) {
    const ca = P.cloud.alpha[la] * (1 - st.f) + P.cloud.alpha[lz] * st.f, tile = orbCloudTint(st.f < 0.5 ? la : lz);
    const size = Math.max(W, H) * P.cloud.size, camx = (R.cam.x - S.W / 2) * z, camy = (R.cam.y - S.H / 2) * z;
    const offx = (((-camx * P.cloud.par - T * P.cloud.vx) % size) + size) % size, offy = (((-camy * P.cloud.par - T * P.cloud.vy) % size) + size) % size;
    const yTop = lb ? Math.max(0, ly - lr) : 0, fade = lb ? Math.max(60, H * 0.28) : 0, bands = lb ? 5 : 0;
    ctx.save();
    if (lb) { ctx.beginPath(); ctx.arc(lx, ly, lr, 0, Math.PI * 2); ctx.clip(); }
    for (let k = 0; k <= bands; k++) {
      // (bands: the first few ramp the cloud in below the limb, the last is the rest of the screen at full strength)
      const ya = yTop + (k * fade) / Math.max(1, bands), yb = k < bands ? yTop + ((k + 1) * fade) / bands : H;
      if (yb <= 0 || ya >= H) continue;
      const a = ca * (k < bands ? (k + 0.5) / bands : 1);
      ctx.save(); ctx.beginPath(); ctx.rect(0, ya, W, yb - ya); ctx.clip();
      // (its shadow first, down and right on what's below, then the cloud)
      ctx.globalCompositeOperation = 'multiply'; ctx.globalAlpha = a * 0.35;
      for (let y = offy - size; y < yb; y += size) { if (y + size * 1.04 < ya) continue; for (let x = offx - size; x < W; x += size) ctx.drawImage(tile, x + size * 0.03, y + size * 0.04, size, size); }
      ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = a;
      for (let y = offy - size; y < yb; y += size) { if (y + size < ya) continue; for (let x = offx - size; x < W; x += size) ctx.drawImage(tile, x, y, size, size); }
      ctx.restore();
    }
    ctx.restore();
  }
}

/** The sky drawn in code, while the pictures load (or if they can't be had): space and stars, the limb, ocean and land, cloud and haze. */
function orbSkyCode(ctx, ox, oy, z) {
  const now = performance.now() / 1000, dt = ORBV.last ? Math.min(0.1, now - ORBV.last) : 0;
  ORBV.last = now;
  const still = !!(LESS_MOTION && LESS_MOTION.matches), saver = typeof gfxStep === 'function' && gfxStep() === 'saver', calm = still || saver;
  if (!calm) ORBV.t += dt;
  const T = still ? 0 : ORBV.t, d = Math.min(R.dpr || 1, 2), W = R.w, H = R.h;
  if (!ORBV.tex) {
    ORBV.tex = { cloud: orbTexture('cloud', 256, 6, 4711), cloud2: orbTexture('cloud', 256, 10, 9137), land: orbTexture('land', 256, 4, 2203) };
    ORBV.stars = rspStarTile(53, 384, 120, 0.02, 0.9, d);
  }
  const camx = (R.cam.x - S.W / 2) * z, camy = (R.cam.y - S.H / 2) * z;
  const f = clamp(R.cam.y / S.H, 0, 1), yh = H * (0.5 - 0.46 * f) - camy * 0.02; // (the horizon: low in the view at the north end of the map, high at the south)
  // Space above the limb.
  const sp = ctx.createLinearGradient(0, 0, 0, Math.max(40, yh + 10));
  sp.addColorStop(0, '#02040b'); sp.addColorStop(0.7, '#07112a'); sp.addColorStop(1, '#10285a');
  ctx.fillStyle = sp; ctx.fillRect(0, 0, W, H);
  if (yh > 0) {
    const size = ORBV.stars.width / d, offx = (((-camx * 0.02 - T * 1.5) % size) + size) % size, offy = (((-camy * 0.02) % size) + size) % size;
    ctx.save(); ctx.beginPath(); ctx.rect(0, 0, W, Math.max(0, yh + 20)); ctx.clip();
    for (let y = offy - size; y < yh + 20; y += size) for (let x = offx - size; x < W; x += size) ctx.drawImage(ORBV.stars, x, y, size, size);
    ctx.restore();
  }
  // The planet: a huge disc, its limb curving across the top of the view.
  const Rp = Math.max(W, H) * 2.4, cx = W * 0.5 - camx * 0.01, cy = yh + Rp;
  ctx.save();
  ctx.beginPath(); ctx.arc(cx, cy, Rp, 0, Math.PI * 2); ctx.clip();
  const sea = ctx.createLinearGradient(0, yh, 0, yh + Math.max(H, 200));
  sea.addColorStop(0, '#2f6fae'); sea.addColorStop(0.18, '#1b4f86'); sea.addColorStop(1, '#0e2f5c');
  ctx.fillStyle = sea; ctx.fillRect(0, Math.max(0, yh - 4), W, H);
  const layer = (tex, size, par, vx, vy, alpha) => {
    const offx = (((-camx * par - T * vx) % size) + size) % size, offy = (((-camy * par - T * vy) % size) + size) % size;
    ctx.globalAlpha = alpha;
    for (let y = offy - size; y < H; y += size) for (let x = offx - size; x < W; x += size) { if (y + size < yh - 8) continue; ctx.drawImage(tex, x, y, size, size); }
    ctx.globalAlpha = 1;
  };
  const S1 = Math.max(W, H) * 1.1;
  layer(ORBV.tex.land, S1 * 1.3, 0.05, 0.4, 0.2, 0.9);
  // (a cloud shadow, offset down and to the right, then the cloud)
  ctx.save(); ctx.globalCompositeOperation = 'multiply';
  ctx.translate(26, 34); layer(ORBV.tex.cloud, S1, 0.1, 2.6, 0.8, 0.16); ctx.restore();
  layer(ORBV.tex.cloud, S1, 0.1, 2.6, 0.8, 0.8);
  if (!saver) layer(ORBV.tex.cloud2, S1 * 0.62, 0.17, 5.5, 1.5, 0.55);
  // (haze thickening toward the limb)
  const hz = ctx.createLinearGradient(0, yh, 0, yh + Math.max(60, H * 0.32));
  hz.addColorStop(0, 'rgba(150,200,255,0.62)'); hz.addColorStop(1, 'rgba(150,200,255,0)');
  ctx.fillStyle = hz; ctx.fillRect(0, Math.max(0, yh - 4), W, H);
  ctx.restore();
  // The thin bright air along the limb.
  ctx.save(); ctx.globalCompositeOperation = 'lighter';
  for (const [w, a, rgb] of [[14, 0.1, '90,170,255'], [6, 0.22, '130,200,255'], [2, 0.5, '210,236,255']]) {
    ctx.strokeStyle = `rgba(${rgb},${a})`; ctx.lineWidth = w;
    ctx.beginPath(); ctx.arc(cx, cy, Rp + w * 0.4, Math.PI * 1.25, Math.PI * 1.75); ctx.stroke();
  }
  ctx.restore();
  // The sun low over the limb at one side: a warm glow.
  { const sx = W * 0.84 - camx * 0.02, sy = yh - Rp * 0.0 - 6, r = Math.min(W, H) * 0.3;
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    const co = rspSprite('corona', '255,150,80'), cr = rspSprite('core', '255,214,160', true);
    ctx.globalAlpha = 0.4; ctx.drawImage(co, sx - r, sy - r, r * 2, r * 2);
    ctx.globalAlpha = 0.9; ctx.drawImage(cr, sx - r * 0.22, sy - r * 0.22, r * 0.44, r * 0.44);
    ctx.restore(); }
}

/** A tile of a deck (ground on an orbital map), painted over the ground's own texture when the map is baked: plating, seams, rivets, railing. */
function orbDeckPaint(ctx, i, j, x, y, t) {
  const h = hash2(i, j, 311), h2 = hash2(i + 5, j * 3, 17), bridge = orbTile(t);
  ctx.fillStyle = bridge ? `rgb(${86 + h * 8 | 0},${94 + h * 8 | 0},${108 + h * 8 | 0})` : `rgb(${64 + h * 9 | 0},${74 + h * 9 | 0},${90 + h * 9 | 0})`;
  ctx.fillRect(x, y, TP, TP);
  // (a faint wash, so no two panels are alike)
  ctx.fillStyle = `rgba(${h2 < 0.5 ? '255,255,255' : '0,0,0'},${0.03 + 0.05 * Math.abs(h2 - 0.5)})`; ctx.fillRect(x, y, TP, TP);
  // Panel seams: a heavy one every second tile, a light one between.
  const hx = i % 2 === 0, hy = j % 2 === 0;
  ctx.fillStyle = 'rgba(8,12,20,0.5)'; ctx.fillRect(x, y, TP, hy ? 2 : 1); ctx.fillRect(x, y, hx ? 2 : 1, TP);
  ctx.fillStyle = 'rgba(255,255,255,0.07)'; ctx.fillRect(x, y + (hy ? 2 : 1), TP, 1); ctx.fillRect(x + (hx ? 2 : 1), y, 1, TP);
  if (hx && hy) { ctx.fillStyle = 'rgba(190,200,215,0.45)'; for (const [a, b] of [[5, 5], [TP - 6, 5], [5, TP - 6], [TP - 6, TP - 6]]) ctx.fillRect(x + a, y + b, 2, 2); }
  // A scuff or a service hatch now and then.
  if (h > 0.9) { ctx.fillStyle = 'rgba(0,0,0,0.18)'; ctx.fillRect(x + 6 + h2 * 10, y + 8, 12, 9); ctx.fillStyle = 'rgba(255,255,255,0.1)'; ctx.fillRect(x + 6 + h2 * 10, y + 8, 12, 1); }
  if (h < 0.06) { ctx.fillStyle = 'rgba(244,196,70,0.5)'; ctx.fillRect(x + 4, y + TP - 9, TP - 8, 3); ctx.fillStyle = 'rgba(20,20,20,0.5)'; for (let k = 0; k < TP - 8; k += 8) ctx.fillRect(x + 4 + k, y + TP - 9, 4, 3); }
  if (bridge) {
    // A bridge's plates: chevrons down its length, hazard bands along its two edges.
    const B = S.orb.br[orbBridgeAt(t)], vert = B.ax === 'v';
    ctx.fillStyle = 'rgba(244,196,70,0.16)';
    if (vert) { ctx.fillRect(x + 4, y + 8, TP - 8, 4); ctx.fillRect(x + 4, y + 20, TP - 8, 4); } else { ctx.fillRect(x + 8, y + 4, 4, TP - 8); ctx.fillRect(x + 20, y + 4, 4, TP - 8); }
    const edges = vert ? [i === B.x0 ? 'l' : '', i === B.x1 ? 'r' : ''] : [j === B.y0 ? 't' : '', j === B.y1 ? 'b' : ''];
    for (const e of edges) {
      if (!e) continue;
      const bx = e === 'r' ? x + TP - 5 : x, by = e === 'b' ? y + TP - 5 : y, bw = e === 'l' || e === 'r' ? 5 : TP, bh = e === 't' || e === 'b' ? 5 : TP;
      ctx.fillStyle = '#e8b93c'; ctx.fillRect(bx, by, bw, bh);
      ctx.fillStyle = '#22252b';
      for (let k = 0; k < TP; k += 8) { if (bw === 5) ctx.fillRect(bx, by + k, 5, 4); else ctx.fillRect(bx + k, by, 4, 5); }
    }
  }
  // A kerb and railing along every side that has space beyond it.
  const void_ = (a, b) => inMap(a, b) && S.terrain[tIdx(a, b)] === T_CHASM;
  for (const [di, dj] of [[0, -1], [0, 1], [-1, 0], [1, 0]]) {
    if (!void_(i + di, j + dj) && inMap(i + di, j + dj)) continue;
    const hor = dj !== 0, ex = di > 0 ? x + TP - 4 : x, ey = dj > 0 ? y + TP - 4 : y;
    ctx.fillStyle = '#9aa6b6'; ctx.fillRect(hor ? x : ex, hor ? ey : y, hor ? TP : 4, hor ? 4 : TP);
    ctx.fillStyle = '#2b3340'; ctx.fillRect(hor ? x : ex + (di > 0 ? 3 : 0), hor ? ey + (dj > 0 ? 3 : 0) : y, hor ? TP : 1, hor ? 1 : TP);
    // posts every half tile
    ctx.fillStyle = '#d6dde8';
    for (const k of [3, TP - 6]) ctx.fillRect(hor ? x + k : ex, hor ? ey : y + k, 3, 3);
  }
}

/** A tile of space on an orbital map (left clear over the sky), but for the station's hull under a deck's southern edge: plating that fades out into the dark. */
function orbVoidPaint(ctx, i, j, x, y) {
  const one = terrAt(i, j - 1) === T_GROUND, two = !one && terrAt(i, j - 1) === T_CHASM && terrAt(i, j - 2) === T_GROUND;
  if (!one && !two) return;
  const g = ctx.createLinearGradient(0, y, 0, y + TP);
  if (one) { g.addColorStop(0, '#46505f'); g.addColorStop(1, '#202733'); } else { g.addColorStop(0, '#202733'); g.addColorStop(1, '#10141c'); }
  ctx.fillStyle = g; ctx.fillRect(x, y, TP, TP);
  ctx.fillStyle = 'rgba(0,0,0,0.3)'; for (let k = 4; k < TP; k += 8) ctx.fillRect(x + k, y, 1.5, TP); // (ribs)
  if (one) {
    const h = hash2(i, j, 71);
    ctx.fillStyle = 'rgba(255,255,255,0.12)'; ctx.fillRect(x, y, TP, 2);
    if (h > 0.55) { ctx.fillStyle = h > 0.8 ? 'rgba(255,214,140,0.85)' : 'rgba(150,215,255,0.7)'; ctx.fillRect(x + 6 + h * 12, y + 10, 3, 2); ctx.fillRect(x + 20 - h * 6, y + 18, 3, 2); }
  }
  ctx.save();
  ctx.globalCompositeOperation = 'destination-out';
  const f = ctx.createLinearGradient(0, y, 0, y + TP);
  f.addColorStop(0, `rgba(0,0,0,${one ? 0 : 0.5})`); f.addColorStop(1, `rgba(0,0,0,${one ? 0.55 : 1})`);
  ctx.fillStyle = f; ctx.fillRect(x, y, TP, TP);
  const sx = (one ? 0.05 : 0.18) * TP;
  ctx.fillStyle = 'rgba(0,0,0,0.9)';
  if (terrAt(i - 1, j) === T_CHASM && terrAt(i - 1, j - 1) !== T_GROUND) ctx.fillRect(x, y, sx, TP);
  if (terrAt(i + 1, j) === T_CHASM && terrAt(i + 1, j - 1) !== T_GROUND) ctx.fillRect(x + TP - sx, y, sx, TP);
  ctx.restore();
}

/** Where bridge B's leaf is: 1 down (flat) through 0 up (standing), and whether the warning lights are on, for the frame's time. */
function orbLeaf(B) {
  const el = S.time - B.t0;
  if (B.mv === 1) return { p: 1, warn: Math.max(0, ORBITAL.warn - el) };
  if (B.mv === 2) return { p: 1 - clamp(el / ORBITAL.lift, 0, 1), warn: 0 };
  if (B.mv === 3) return { p: clamp(el / ORBITAL.lift, 0, 1), warn: 0 };
  return { p: B.up ? 0 : 1, warn: 0 };
}

/** The drawbridges' leaves, pylons and lamps for the frame (the plates of a lowered bridge are baked with the ground). */
function orbitalBridges(ctx, ox, oy, z, v0, v1) {
  const O = S.orb;
  if (!O) return;
  const tm = R.time;
  for (const B of O.br) {
    if (B.x1 + 3 < v0.x || B.x0 - 3 > v1.x || B.y1 + 3 < v0.y || B.y0 - 3 > v1.y) continue;
    const vert = B.ax === 'v', L = orbLeaf(B), len = vert ? B.y1 - B.y0 + 1 : B.x1 - B.x0 + 1, wid = vert ? B.x1 - B.x0 + 1 : B.y1 - B.y0 + 1;
    const X = ox + B.x0 * z, Y = oy + B.y0 * z, w = (B.x1 - B.x0 + 1) * z, h = (B.y1 - B.y0 + 1) * z;
    // The road laid on the strip is permanent (js/sim.js: orbFlip): while the strip is void it shows as a faint ghost where it lies.
    if (L.p < 1) {
      ctx.save(); ctx.globalAlpha = 0.22 * (1 - L.p); ctx.strokeStyle = '#f4c446'; ctx.lineWidth = Math.max(1, z * 0.05); ctx.setLineDash([z * 0.3, z * 0.3]);
      ctx.beginPath();
      for (let n = 1; n < wid; n++) { if (vert) { ctx.moveTo(X + n * z, Y); ctx.lineTo(X + n * z, Y + h); } else { ctx.moveTo(X, Y + n * z); ctx.lineTo(X + w, Y + n * z); } }
      ctx.stroke(); ctx.restore();
    }
    ctx.save();
    // The leaf, hinged at the strip's low end (north or west), foreshortened as it rises, its far end lifted up the screen.
    if (L.p < 1) {
      const th = (1 - L.p) * Math.PI / 2, shown = Math.cos(th) * len * z, lift = Math.sin(th) * len * z * 0.34;
      ctx.translate(0, -lift);
      ctx.fillStyle = L.p > 0.04 ? '#59647a' : '#6c7890';
      const lx = vert ? X : X, ly = vert ? Y : Y, lw = vert ? w : Math.max(z * 0.28, shown), lh = vert ? Math.max(z * 0.28, shown) : h;
      ctx.fillRect(lx, ly, lw, lh);
      ctx.fillStyle = 'rgba(244,196,70,0.85)';
      if (vert) { ctx.fillRect(lx, ly + lh - z * 0.12, lw, z * 0.12); ctx.fillRect(lx, ly, z * 0.1, lh); ctx.fillRect(lx + lw - z * 0.1, ly, z * 0.1, lh); }
      else { ctx.fillRect(lx + lw - z * 0.12, ly, z * 0.12, lh); ctx.fillRect(lx, ly, lw, z * 0.1); ctx.fillRect(lx, ly + lh - z * 0.1, lw, z * 0.1); }
      // (the road on it: lane dashes along its length, as on the lowered bridge)
      ctx.fillStyle = 'rgba(244,196,70,0.4)';
      const step = Math.max(1, (vert ? lh : lw) / len);
      for (let n = 1; n < wid; n++) for (let k = 0; k < len; k++) {
        if (vert) ctx.fillRect(lx + n * z - z * 0.04, ly + k * step + step * 0.25, z * 0.08, step * 0.5);
        else ctx.fillRect(lx + k * step + step * 0.25, ly + n * z - z * 0.04, step * 0.5, z * 0.08);
      }
      ctx.fillStyle = 'rgba(255,255,255,0.18)'; ctx.fillRect(lx, ly, vert ? lw : Math.min(lw, z * 0.18), vert ? Math.min(lh, z * 0.18) : lh);
    }
    ctx.restore();
    // The warning: amber light along both edges, pulsing, then a ring of it at the corners.
    const flash = L.warn > 0 && Math.floor(tm * 4) % 2 === 0;
    const lampCol = B.mv ? (flash ? '#ffb020' : '#ff6a3a') : B.up ? '#ff4a4a' : '#4ae27a';
    ctx.save();
    if (L.warn > 0) {
      ctx.globalCompositeOperation = 'lighter'; ctx.fillStyle = flash ? 'rgba(255,170,30,0.5)' : 'rgba(255,170,30,0.18)';
      ctx.fillRect(X, Y, w, h);
    }
    ctx.restore();
    // Pylons at the four corners of the strip (lamps), the hinge's housing, the catch at the far end.
    const post = (px, py, col) => {
      ctx.fillStyle = '#2b3340'; ctx.fillRect(px - z * 0.11, py - z * 0.11, z * 0.22, z * 0.22);
      ctx.fillStyle = col; ctx.fillRect(px - z * 0.06, py - z * 0.06, z * 0.12, z * 0.12);
    };
    for (const [px, py] of [[X, Y], [X + w, Y], [X, Y + h], [X + w, Y + h]]) post(px, py, lampCol);
    // Hinge housing at the low end.
    ctx.fillStyle = '#394252';
    if (vert) ctx.fillRect(X - z * 0.12, Y - z * 0.1, w + z * 0.24, z * 0.2); else ctx.fillRect(X - z * 0.1, Y - z * 0.12, z * 0.2, h + z * 0.24);
    // A word over it while it moves.
    if (B.mv && z >= 18) {
      const secs = B.mv === 1 ? Math.ceil(L.warn) : Math.ceil(ORBITAL.lift - (S.time - B.t0));
      const label = B.mv === 1 ? `RAISING ${secs}` : B.mv === 2 ? 'RAISING' : 'LOWERING';
      ctx.font = `700 ${Math.round(clamp(z * 0.3, 10, 16))}px system-ui, sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(0,0,0,0.75)'; ctx.strokeText(label, X + w / 2, Y + h / 2);
      ctx.fillStyle = '#ffd36a'; ctx.fillText(label, X + w / 2, Y + h / 2);
    }
  }
}

/** A control box at tile (b.x, b.y): a console lit in its holder's colour. cx, cy its middle on screen. */
function drawOrbBox(ctx, cx, cy, z, b) {
  const col = b.owner >= 0 ? PLAYER_COLORS[b.owner] : '#cfd8e6', t = R.time, B = S.orb.br[b.br];
  ctx.save();
  ctx.fillStyle = 'rgba(0,0,0,0.25)'; ctx.beginPath(); ctx.ellipse(cx + z * 0.05, cy + z * 0.3, z * 0.36, z * 0.14, 0, 0, Math.PI * 2); ctx.fill();
  // the plinth and the console
  ctx.fillStyle = '#2a3140'; ctx.fillRect(cx - z * 0.3, cy + z * 0.04, z * 0.6, z * 0.26);
  ctx.fillStyle = '#4a5568'; ctx.fillRect(cx - z * 0.26, cy - z * 0.2, z * 0.52, z * 0.3);
  ctx.fillStyle = '#6b778c'; ctx.fillRect(cx - z * 0.26, cy - z * 0.2, z * 0.52, z * 0.05);
  const pulse = 0.7 + 0.3 * Math.sin(t * 3 + b.id);
  ctx.globalCompositeOperation = 'lighter';
  ctx.fillStyle = col; ctx.globalAlpha = (b.owner >= 0 ? 0.95 : 0.5) * pulse;
  ctx.shadowColor = col; ctx.shadowBlur = Math.max(5, z * 0.3);
  ctx.fillRect(cx - z * 0.19, cy - z * 0.1, z * 0.38, z * 0.14);
  ctx.shadowBlur = 0; ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
  // a lever: up when the bridge is up
  ctx.strokeStyle = '#e8edf5'; ctx.lineWidth = Math.max(1.5, z * 0.05);
  ctx.beginPath(); ctx.moveTo(cx + z * 0.14, cy - z * 0.2); ctx.lineTo(cx + z * 0.14, cy - z * (B && B.up ? 0.46 : 0.3)); ctx.stroke();
  ctx.fillStyle = B && (B.up || B.mv) ? '#ff5a4a' : '#4ae27a'; ctx.beginPath(); ctx.arc(cx + z * 0.14, cy - z * (B && B.up ? 0.46 : 0.3), z * 0.05, 0, Math.PI * 2); ctx.fill();
  if (z >= 30) {
    const label = b.owner >= 0 ? `BRIDGE · ${playerName(b.owner).toUpperCase()}` : 'BRIDGE';
    ctx.font = `600 ${Math.round(Math.max(9, z * 0.16))}px system-ui, sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'top';
    ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(0,0,0,0.7)'; ctx.strokeText(label, cx, cy + z * 0.34);
    ctx.fillStyle = b.owner >= 0 ? col : '#e8f2ff'; ctx.fillText(label, cx, cy + z * 0.34);
  }
  ctx.restore();
}

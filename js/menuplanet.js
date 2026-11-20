'use strict';
/*
 * Terrafall — the main menu's backdrop: Ithaca I itself, turning slowly in Corvane's light, the Ring across it and Argos
 * going round, the colonies' lights on the night side (and now and then, far off, the flash of a fight). Looks only.
 *
 * Drawn on its own canvas (#menu-planet, behind the menu card). The planet's face is made once from a fixed seed: a coral
 * world stitched together from regions (the Rust's red desert, green forest, Emberwood's gold, ash, the violet Bloom,
 * ice at the poles) with seas between, and a layer of cloud. Each frame the sphere is shaded from that map in a small
 * image (MPLANET.res across at most) at a few frames a second, and laid over a sky made once (stars, Corvane's glow).
 * It stops while the menu is hidden or the tab is in the background, and holds still with reduced motion. While it shows,
 * the demo game behind the menu isn't drawn (menuPlanetCovers: main.js), so the menu costs less than it did.
 */

const MPLANET = {
  texW: 512, texH: 256,   // the planet's map (longitude × latitude)
  res: 320,               // the most pixels across the shaded sphere is made at (it's drawn larger, smoothly)
  fps: 9,                 // frames a second the backdrop is drawn (the planet turns slowly: plenty)
  turn: 260,              // seconds the planet takes to turn once
  clouds: 200,            // ...and the clouds, a little faster
  moon: 140,              // seconds Argos takes to go round
  light: [-0.82, -0.34, 0.34], // toward Corvane (to the upper left: the right of the planet is in night)
  tilt: -0.3,             // the Ring's slant (radians)
};

const MPL = { c: null, g: null, raf: 0, last: 0, t: 0, tex: null, cloud: null, lights: null, sky: null, sphere: null, map: null, w: 0, h: 0, dpr: 1, on: false, fights: [] };

/** 3D value noise (0..1), for a seamless map on the sphere. */
function mplNoise(x, y, z, seed) {
  const xi = Math.floor(x), yi = Math.floor(y), zi = Math.floor(z), u = smoothstep01(x - xi), v = smoothstep01(y - yi), w = smoothstep01(z - zi);
  const h = (a, b, c) => hash2(a + c * 7919, b - c * 104729, seed + c * 31);
  const l = (a, b, f) => a + (b - a) * f;
  const z0 = l(l(h(xi, yi, zi), h(xi + 1, yi, zi), u), l(h(xi, yi + 1, zi), h(xi + 1, yi + 1, zi), u), v);
  const z1 = l(l(h(xi, yi, zi + 1), h(xi + 1, yi, zi + 1), u), l(h(xi, yi + 1, zi + 1), h(xi + 1, yi + 1, zi + 1), u), v);
  return l(z0, z1, w);
}
function mplFbm(x, y, z, seed, oct) { let s = 0, a = 0.5, f = 1, n = 0; for (let o = 0; o < oct; o++) { s += a * mplNoise(x * f, y * f, z * f, seed + o * 17); n += a; a *= 0.5; f *= 2; } return s / n; }

/**
 * The planet's face, made once: { tex (rgb per texel), cloud (alpha), lights (night lights 0..1) } over MPLANET.texW ×
 * texH. Regions are cells round scattered centres on the sphere (where ringfall came down), each a biome; seas lie
 * between them where the land falls low; ice caps the poles.
 */
function mplMakeMap() {
  const W = MPLANET.texW, H = MPLANET.texH, seed = 9241;
  const tex = new Uint8ClampedArray(W * H * 3), cloud = new Uint8ClampedArray(W * H), lights = new Uint8ClampedArray(W * H);
  const BIO = [
    [204, 88, 60], [218, 120, 80], [188, 74, 54], [196, 100, 70], // the Rust (red desert, four tones: it's the coral world)
    [210, 96, 66], [84, 124, 66],                 // more of the Rust; Greenreach forest
    [190, 140, 70],                               // Emberwood gold
    [172, 154, 100],                              // the Long Grass
    [104, 96, 92],                                // the Cinderlands' ash
    [124, 86, 160],                               // the Bloom
    [200, 168, 138],                              // pale steppe
  ];
  const cells = [];
  for (let k = 0; k < 44; k++) {
    const z = hash2(k, 1, seed) * 2 - 1, a = hash2(k, 2, seed) * Math.PI * 2, r = Math.sqrt(1 - z * z);
    cells.push({ x: r * Math.cos(a), y: z, z: r * Math.sin(a), b: BIO[Math.floor(hash2(k, 3, seed) * BIO.length)], city: hash2(k, 4, seed) });
  }
  const doRow = (j) => {
    const lat = (0.5 - (j + 0.5) / H) * Math.PI, cl = Math.cos(lat), sl = Math.sin(lat);
    for (let i = 0; i < W; i++) {
      const lon = ((i + 0.5) / W) * Math.PI * 2, x = cl * Math.cos(lon), y = sl, z = cl * Math.sin(lon), t = j * W + i;
      // the nearest centre (and how near the next, for the seams between regions)
      let b1 = null, b2 = null, d1 = 9, d2 = 9;
      const q = 0.42, wx = x + q * (mplFbm(x * 2.5, y * 2.5, z * 2.5, seed + 5, 2) - 0.5), wy = y + q * (mplFbm(x * 2.5 + 9, y * 2.5, z * 2.5, seed + 6, 2) - 0.5), wz = z + q * (mplFbm(x * 2.5, y * 2.5 + 9, z * 2.5, seed + 7, 2) - 0.5);
      for (const c of cells) { const d = (wx - c.x) ** 2 + (wy - c.y) ** 2 + (wz - c.z) ** 2; if (d < d1) { d2 = d1; b2 = b1; d1 = d; b1 = c; } else if (d < d2) { d2 = d; b2 = c; } }
      const hgt = mplFbm(x * 2.2 + 3, y * 2.2, z * 2.2, seed + 11, 4);
      const det = mplNoise(x * 9, y * 9, z * 9, seed + 12);
      let r, g, bl;
      const sea = 0.44 + 0.04 * Math.sin(lon * 3);
      if (hgt < sea) {
        // seas: deep teal, turquoise in the shallows
        const sh = clamp((hgt - (sea - 0.08)) / 0.08, 0, 1);
        r = 18 + 40 * sh; g = 62 + 90 * sh; bl = 96 + 70 * sh;
      } else {
        // the region's colour, blended softly into the next one's across the seam, with a darker ridge along it
        const seam = clamp((Math.sqrt(d2) - Math.sqrt(d1)) * 5, 0, 1), m = 0.5 + 0.5 * seam, A = b1.b, B = (b2 || b1).b;
        const f = (0.8 + 0.4 * det) * (1 - 0.12 * (1 - seam));
        r = (A[0] * m + B[0] * (1 - m)) * f; g = (A[1] * m + B[1] * (1 - m)) * f; bl = (A[2] * m + B[2] * (1 - m)) * f;
        // the coast a little paler (beaches, salt flats)
        const shore = clamp(1 - (hgt - sea) / 0.025, 0, 1);
        r += (226 - r) * shore * 0.3; g += (204 - g) * shore * 0.3; bl += (170 - bl) * shore * 0.3;
        // night lights: the colonies, in towns along the coasts and the regions' hearts
        const near = clamp(1 - Math.sqrt(d1) * 3.2, 0, 1), coast = clamp(1 - (hgt - sea) / 0.05, 0, 1);
        const speck = hash2(i, j, seed + 13);
        if (b1.city > 0.35 && speck > 0.985 - 0.03 * (near + coast)) lights[t] = 140 + 115 * hash2(j, i, seed + 14);
      }
      // the poles: ice
      const ice = clamp((Math.abs(lat) - 1.08 - 0.12 * (det - 0.5)) / 0.08, 0, 1);
      if (ice > 0) { r += (236 - r) * ice; g += (242 - g) * ice; bl += (248 - bl) * ice; lights[t] = 0; }
      tex[t * 3] = r; tex[t * 3 + 1] = g; tex[t * 3 + 2] = bl;
      // cloud: drifting bands, thicker toward the mid-latitudes
      const cn = mplFbm(x * 3.2 + 7, y * 6, z * 3.2, seed + 21, 3);
      cloud[t] = clamp((cn - 0.52) * 3.2, 0, 1) * 220;
    }
  };
  // Made a few rows at a time (step: ms of a frame), so the menu answers at once while it's made.
  const M = { tex, cloud, lights, W, H, row: 0, done: false };
  M.step = (ms) => { const t0 = performance.now(); while (M.row < H && performance.now() - t0 < ms) doRow(M.row++); M.done = M.row >= H; return M.done; };
  return M;
}

/** The sky behind the planet, made once for the canvas's size: deep space, stars, a faint band of nebula, Corvane's glow. */
function mplMakeSky(w, h) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const g = c.getContext('2d'), seed = 9243;
  const bg = g.createLinearGradient(0, 0, w, h);
  bg.addColorStop(0, '#0c1428'); bg.addColorStop(0.55, '#070b18'); bg.addColorStop(1, '#05070f');
  g.fillStyle = bg; g.fillRect(0, 0, w, h);
  // a faint band of nebula across the sky
  for (let k = 0; k < 14; k++) {
    const x = hash2(k, 1, seed) * w, y = h * (0.15 + 0.7 * hash2(k, 1, seed)) * 0.6 + x * 0.25, r = Math.max(w, h) * (0.08 + 0.12 * hash2(k, 2, seed));
    const gr = g.createRadialGradient(x, y, 0, x, y, r), col = k % 3 ? '120,80,170' : '60,110,170';
    gr.addColorStop(0, `rgba(${col},0.06)`); gr.addColorStop(1, `rgba(${col},0)`);
    g.fillStyle = gr; g.fillRect(x - r, y - r, r * 2, r * 2);
  }
  // stars
  const n = Math.round((w * h) / 2600);
  for (let k = 0; k < n; k++) {
    const x = hash2(k, 3, seed) * w, y = hash2(k, 4, seed) * h, b = hash2(k, 5, seed), s = b > 0.97 ? 1.6 : b > 0.85 ? 1.1 : 0.7;
    g.fillStyle = `rgba(${b > 0.9 ? '255,236,214' : '220,230,255'},${0.25 + 0.6 * b})`;
    g.fillRect(x, y, s * MPL.dpr, s * MPL.dpr);
  }
  // Corvane, just off the top left: its glow
  const sx = -w * 0.08, sy = -h * 0.1, sr = Math.max(w, h) * 0.75;
  const sg = g.createRadialGradient(sx, sy, 0, sx, sy, sr);
  sg.addColorStop(0, 'rgba(255,170,110,0.55)'); sg.addColorStop(0.18, 'rgba(255,130,80,0.18)'); sg.addColorStop(1, 'rgba(255,110,70,0)');
  g.fillStyle = sg; g.fillRect(0, 0, w, h);
  return c;
}

/** Where the planet sits and how big (css px): beside the card on a wide screen, peeking from behind it on a tall one. */
function mplLayout(w, h) {
  if (w >= h * 1.15) {
    const room = (w - 420) / 2, r = clamp(room * 0.4, h * 0.16, h * 0.27); // (beside the card, which is about 420 px wide)
    return { x: w - room / 2 - r * 0.05, y: h * 0.5, r };
  }
  const r = Math.min(w * 0.42, h * 0.22);
  return { x: w * 0.76, y: r * 0.55, r };
}

/** The per-pixel geometry of the sphere image (n × n): each pixel's latitude, longitude and light. */
function mplGeometry(n) {
  const L = MPLANET.light, ll = Math.hypot(L[0], L[1], L[2]), lx = L[0] / ll, ly = L[1] / ll, lz = L[2] / ll;
  const lat = new Float32Array(n * n), lon = new Float32Array(n * n), sun = new Float32Array(n * n), edge = new Float32Array(n * n);
  const axis = 0.32, ca = Math.cos(axis), sa = Math.sin(axis); // (the planet's axis leans a little)
  for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
    const x = ((i + 0.5) / n) * 2 - 1, y = ((j + 0.5) / n) * 2 - 1, rr = x * x + y * y, k = j * n + i;
    if (rr > 1) { edge[k] = -1; continue; }
    const z = Math.sqrt(1 - rr);
    sun[k] = x * lx + y * ly + z * lz;
    edge[k] = Math.min(1, (1 - Math.sqrt(rr)) * n * 0.5); // (anti-aliased rim)
    // into the planet's frame: undo the lean
    const px = x * ca + y * sa, py = -x * sa + y * ca;
    lat[k] = Math.asin(clamp(-py, -1, 1));
    lon[k] = Math.atan2(px, z);
  }
  return { n, lat, lon, sun, edge };
}

/** The sphere's image now: day side lit, the terminator warm, the night side dark with the colonies' lights. */
function mplShade(t) {
  const M = MPL.map, G = MPL.geo, n = G.n, img = MPL.sphere.ctx.createImageData(n, n), px = img.data;
  const rot = (t / MPLANET.turn) * Math.PI * 2, crot = (t / MPLANET.clouds) * Math.PI * 2, W = M.W, H = M.H, TAU = Math.PI * 2;
  const flick = MPL.fights;
  for (let k = 0; k < n * n; k++) {
    const e = G.edge[k];
    if (e < 0) continue;
    const lat = G.lat[k], v = Math.min(H - 1, Math.max(0, ((0.5 - lat / Math.PI) * H) | 0));
    let u = ((G.lon[k] + rot) / TAU) % 1; if (u < 0) u += 1;
    let uc = ((G.lon[k] + crot) / TAU) % 1; if (uc < 0) uc += 1;
    const ti = v * W + ((u * W) | 0), tc = v * W + ((uc * W) | 0);
    const s = G.sun[k], day = clamp(s * 1.6 + 0.12, 0, 1), cl = M.cloud[tc] / 255;
    let r = M.tex[ti * 3], g = M.tex[ti * 3 + 1], b = M.tex[ti * 3 + 2];
    r += (246 - r) * cl; g += (244 - g) * cl; b += (240 - b) * cl;
    // light: lit side, a warm band along the terminator, the night side a deep blue
    const warm = clamp(1 - Math.abs(s - 0.05) * 6, 0, 1);
    const lr = 0.07 + 0.98 * day + 0.25 * warm, lg = 0.08 + 0.92 * day + 0.08 * warm, lb = 0.16 + 0.86 * day - 0.05 * warm;
    r *= lr; g *= lg; b *= lb;
    // night lights (under the cloud, dimmed by it)
    const night = clamp(-s * 3 + 0.1, 0, 1);
    if (night > 0) {
      const L = M.lights[ti] / 255;
      if (L) { const a = L * night * (1 - 0.7 * cl); r += 255 * a; g += 196 * a; b += 120 * a; }
    }
    const o = k * 4;
    px[o] = r; px[o + 1] = g; px[o + 2] = b; px[o + 3] = 255 * e;
  }
  // far off, a fight: a few pixels flaring orange on the night side and fading
  for (const f of flick) {
    const a = f.a;
    if (a <= 0) continue;
    const k = f.k, o = k * 4;
    if (G.edge[k] < 0 || G.sun[k] > -0.05) continue;
    px[o] = Math.min(255, px[o] + 255 * a); px[o + 1] = Math.min(255, px[o + 1] + 150 * a); px[o + 2] = Math.min(255, px[o + 2] + 60 * a);
  }
  MPL.sphere.ctx.putImageData(img, 0, 0);
}

/** The Ring: bands of pale ice and dust round the planet, `half` 'back' (behind it) or 'front'. */
function mplRing(g, P, half) {
  g.save();
  g.translate(P.x, P.y); g.rotate(MPLANET.tilt);
  const bands = [[1.92, 0.09, 'rgba(230,214,190,0.18)'], [1.81, 0.04, 'rgba(240,228,206,0.5)'], [1.69, 0.07, 'rgba(226,206,180,0.34)'], [1.56, 0.03, 'rgba(210,190,170,0.2)'], [1.46, 0.05, 'rgba(232,220,200,0.28)']];
  const flat = 0.2;
  for (const [rk, wk, col] of bands) {
    g.strokeStyle = col; g.lineWidth = Math.max(1, P.r * wk);
    g.beginPath();
    if (half === 'back') g.ellipse(0, 0, P.r * rk, P.r * rk * flat, 0, Math.PI, Math.PI * 2);
    else g.ellipse(0, 0, P.r * rk, P.r * rk * flat, 0, 0, Math.PI);
    g.stroke();
  }
  // the lit side of the Ring a little brighter (toward Corvane)
  if (half === 'front') {
    const gr = g.createLinearGradient(-P.r * 2, 0, P.r * 2, 0);
    gr.addColorStop(0, 'rgba(255,214,170,0.18)'); gr.addColorStop(0.5, 'rgba(255,214,170,0)');
    g.strokeStyle = gr; g.lineWidth = P.r * 0.5;
    g.beginPath(); g.ellipse(0, 0, P.r * 1.69, P.r * 1.69 * flat, 0, 0, Math.PI); g.stroke();
  }
  g.restore();
}

/** Argos: a small grey moon going round on a slanted orbit; in front of the planet or behind it. */
function mplMoon(t, P) {
  const a = (t / MPLANET.moon) * Math.PI * 2 + 2.2, rx = P.r * 2.6, ry = P.r * 0.55;
  const ca = Math.cos(MPLANET.tilt * 0.6), sa = Math.sin(MPLANET.tilt * 0.6);
  const ex = Math.cos(a) * rx, ey = Math.sin(a) * ry;
  return { x: P.x + ex * ca - ey * sa, y: P.y + ex * sa + ey * ca, r: P.r * 0.09, front: Math.sin(a) > 0 };
}
function mplDrawMoon(g, m) {
  const gr = g.createRadialGradient(m.x - m.r * 0.4, m.y - m.r * 0.4, m.r * 0.1, m.x, m.y, m.r);
  gr.addColorStop(0, '#d8d8dc'); gr.addColorStop(0.7, '#8a8a92'); gr.addColorStop(1, '#3a3a44');
  g.fillStyle = gr; g.beginPath(); g.arc(m.x, m.y, m.r, 0, Math.PI * 2); g.fill();
}

/** One frame of the backdrop at time t (seconds). */
function mplDraw(t) {
  const g = MPL.g, w = MPL.w, h = MPL.h, d = MPL.dpr;
  g.setTransform(d, 0, 0, d, 0, 0);
  g.drawImage(MPL.sky, 0, 0, w, h);
  // a few stars twinkle
  for (let k = 0; k < 14; k++) {
    const a = 0.5 + 0.5 * Math.sin(t * (0.5 + hash2(k, 7, 9244)) + k * 2.3);
    g.fillStyle = `rgba(230,236,255,${0.5 * a})`;
    const x = hash2(k, 8, 9244) * w, y = hash2(k, 9, 9244) * h, s = 1 + a;
    g.fillRect(x - s / 2, y - s / 2, s, s);
  }
  const P = mplLayout(w, h), moon = mplMoon(t, P);
  g.globalAlpha = MPL.fade ?? 1; // (fading in once made)
  if (!moon.front) mplDrawMoon(g, moon);
  mplRing(g, P, 'back');
  // the atmosphere's glow round the limb, warmest toward Corvane
  const ag = g.createRadialGradient(P.x, P.y, P.r * 0.92, P.x, P.y, P.r * 1.16);
  ag.addColorStop(0, 'rgba(255,170,130,0.5)'); ag.addColorStop(0.4, 'rgba(240,140,120,0.16)'); ag.addColorStop(1, 'rgba(200,120,140,0)');
  g.fillStyle = ag; g.beginPath(); g.arc(P.x, P.y, P.r * 1.16, 0, Math.PI * 2); g.fill();
  g.imageSmoothingEnabled = true;
  g.drawImage(MPL.sphere.c, P.x - P.r, P.y - P.r, P.r * 2, P.r * 2);
  // the Ring's shadow across the planet (a soft dark band below its line on the day side)
  g.save();
  g.beginPath(); g.arc(P.x, P.y, P.r, 0, Math.PI * 2); g.clip();
  g.translate(P.x, P.y); g.rotate(MPLANET.tilt);
  g.strokeStyle = 'rgba(10,8,20,0.22)'; g.lineWidth = P.r * 0.12;
  g.beginPath(); g.ellipse(-P.r * 0.1, P.r * 0.3, P.r * 1.75, P.r * 0.3, 0, Math.PI * 1.05, Math.PI * 1.95); g.stroke();
  g.restore();
  mplRing(g, P, 'front');
  if (moon.front) mplDrawMoon(g, moon);
  g.globalAlpha = 1;
}

/** Is the backdrop showing (the main menu up, the tab in front)? */
function menuPlanetCovers() { return !!MPL.c && MPL.on && !document.hidden; }

function mplResize() {
  const c = MPL.c, box = c.parentElement.getBoundingClientRect(), d = Math.min(window.devicePixelRatio || 1, 1.5);
  const w = Math.max(1, Math.round(box.width)), h = Math.max(1, Math.round(box.height));
  if (w === MPL.w && h === MPL.h && d === MPL.dpr) return;
  MPL.w = w; MPL.h = h; MPL.dpr = d;
  c.width = Math.round(w * d); c.height = Math.round(h * d);
  MPL.sky = mplMakeSky(c.width, c.height);
  const P = mplLayout(w, h), n = Math.max(64, Math.min(MPLANET.res, Math.round(P.r * 2 * d)));
  if (!MPL.geo || MPL.geo.n !== n) {
    MPL.geo = mplGeometry(n);
    const sc = document.createElement('canvas');
    sc.width = sc.height = n;
    MPL.sphere = { c: sc, ctx: sc.getContext('2d') };
  }
  MPL.last = 0;
}

function mplFrame(now) {
  MPL.raf = 0;
  if (!MPL.on || document.hidden) return;
  MPL.raf = requestAnimationFrame(mplFrame);
  if (now - MPL.last < 1000 / MPLANET.fps) return;
  const still = typeof LESS_MOTION !== 'undefined' && LESS_MOTION && LESS_MOTION.matches;
  const dt = MPL.last ? Math.min(0.2, (now - MPL.last) / 1000) : 0;
  MPL.last = now;
  mplResize();
  if (!MPL.map.done) { MPL.map.step(7); const g = MPL.g; g.setTransform(1, 0, 0, 1, 0, 0); g.drawImage(MPL.sky, 0, 0); MPL.last = 0; return; } // (the sky while the planet is made)
  MPL.fade = Math.min(1, (MPL.fade || 0) + dt * 1.5);
  // (reduced motion: drawn once, faded in, then left as it is until the size changes)
  const key = `${MPL.w}x${MPL.h}@${MPL.dpr}`;
  if (still && MPL.fade >= 1 && MPL.stillKey === key) return;
  MPL.stillKey = still && MPL.fade >= 1 ? key : null;
  if (!still) MPL.t += dt;
  // fights far off: now and then a point on the night side flares and fades
  for (const f of MPL.fights) f.a -= dt * 1.4;
  MPL.fights = MPL.fights.filter((f) => f.a > 0);
  if (!still && Math.random() < dt * 0.9) { const G = MPL.geo, k = Math.floor(Math.random() * G.n * G.n); if (G.edge[k] > 0 && G.sun[k] < -0.1) MPL.fights.push({ k, a: 0.6 + 0.4 * Math.random() }); }
  mplShade(MPL.t);
  mplDraw(MPL.t);
}

/** Start or stop the backdrop as the menu shows or hides, and as the tab comes and goes. */
function mplWatch() {
  const menu = document.getElementById('screen-menu');
  const on = !!menu && !menu.hidden && !document.hidden;
  MPL.on = on;
  if (MPL.c) MPL.c.hidden = !menu || menu.hidden;
  if (on && !MPL.raf) MPL.raf = requestAnimationFrame(mplFrame);
}

function menuPlanetInit() {
  const menu = document.getElementById('screen-menu');
  if (!menu || MPL.c || typeof document.createElement !== 'function') return;
  const c = document.createElement('canvas');
  c.id = 'menu-planet';
  c.setAttribute('aria-hidden', 'true');
  menu.insertBefore(c, menu.firstChild);
  MPL.c = c; MPL.g = c.getContext('2d');
  MPL.map = mplMakeMap();
  MPL.t = 40; // (the colonies' lights in view from the first frame)
  new MutationObserver(mplWatch).observe(menu, { attributes: true, attributeFilter: ['hidden'] });
  document.addEventListener('visibilitychange', mplWatch);
  window.addEventListener('resize', () => { if (MPL.on) MPL.last = 0; });
  mplWatch();
}

if (typeof document !== 'undefined' && document.readyState !== 'loading') menuPlanetInit();
else if (typeof document !== 'undefined') document.addEventListener('DOMContentLoaded', menuPlanetInit);

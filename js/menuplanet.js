'use strict';
/*
 * Terrafall — the main menu's backdrop: Corvane's system, seen from far out (LORE.md: the sky). Looks only.
 *
 * Corvane, the restless orange star, glows off to one side with its corona and bloom (and now and then a flare). Ithaca I
 * goes round it on a slow orbit (MPLANET.orbit seconds), turning as it goes, its lit side always toward the star and its
 * night side showing the colonies' lights, where the war goes on: fronts flickering with gunfire near the lights, fires
 * lingering where they fought, a missile's line arcing between two colonies, a rare bright strike, and after the menu has
 * been open a while, once in a long while, a nuclear blast. The Ring circles the planet, catching the light; Argos goes
 * round it and its shadow crosses the planet; the four vanguard Carriers are tiny lit specks in orbit; ringfall streaks
 * down into the atmosphere; now and then the Wren comes in on its supply loop from the edge of the system.
 *
 * Drawn on its own canvas (#menu-planet), under the menu card, with a soft vignette behind the card so it stays clear. The
 * planet's face (mplMakeMap) is made once from a fixed seed, a few rows a frame at launch; the sphere is shaded from it per
 * pixel in a small image; the sky, the star's glow and the flashes are sprites made once. A dozen frames a second at most,
 * fewer on Graphics Saver (with fewer flashes, and no ringfall, Wren or drifting stars); stopped while the menu is hidden
 * or the tab is in the background; near-still with reduced motion (no flashes: the fires just glow). While it shows, the
 * demo game behind the menu isn't drawn (menuPlanetCovers: main.js).
 */

const MPLANET = {
  texW: 512, texH: 256,   // the planet's map (longitude × latitude)
  res: 300,               // the most pixels across the shaded sphere is made at (it's drawn larger, smoothly)
  fps: 12, fpsSaver: 5,   // frames a second
  orbit: 240,             // seconds for Ithaca I to go once round Corvane
  turn: 150,              // ...to turn once
  clouds: 120,            // ...for its clouds
  moon: 55,               // ...for Argos to go round it
  carrier: 46,            // ...for a Carrier to go round
  tilt: -0.32,            // the Ring's slant (radians)
  wren: 190,              // seconds between the Wren's visits (it takes 70 to come in)
  nukeFirst: 210,         // seconds the menu is open before a nuclear blast may come, then one every nukeGap at most
  nukeGap: [360, 540],
};

const MPL = { c: null, g: null, raf: 0, last: 0, t: 0, open: 0, map: null, sky: null, sphere: null, geo: null, w: 0, h: 0, dpr: 1, on: false,
  war: { fronts: [], fires: [], flashes: [], tracers: [], strikes: [], nextFront: 0, nextStrike: 40, nextTracer: 12, nuke: null, nextNuke: 0 },
  falls: [], nextFall: 4, spr: {} };

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

/** Sprites, made once: a soft disc in colour rgb with alpha falling to the edge (hard: a brighter core). */
function mplSprite(name, rgb, hard) {
  if (MPL.spr[name]) return MPL.spr[name];
  const n = 64, c = document.createElement('canvas');
  c.width = c.height = n;
  const g = c.getContext('2d'), gr = g.createRadialGradient(n / 2, n / 2, 0, n / 2, n / 2, n / 2);
  if (hard) { gr.addColorStop(0, 'rgba(255,255,250,1)'); gr.addColorStop(0.12, `rgba(${rgb},0.95)`); gr.addColorStop(0.4, `rgba(${rgb},0.3)`); }
  else { gr.addColorStop(0, `rgba(${rgb},1)`); gr.addColorStop(0.45, `rgba(${rgb},0.4)`); }
  gr.addColorStop(1, `rgba(${rgb},0)`);
  g.fillStyle = gr; g.fillRect(0, 0, n, n);
  return (MPL.spr[name] = c);
}

/** The sky, made once for the canvas's size: deep space, the far stars and a faint band of nebula. */
function mplMakeSky(w, h) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const g = c.getContext('2d'), seed = 9243;
  const bg = g.createLinearGradient(0, 0, w, h);
  bg.addColorStop(0, '#0a1124'); bg.addColorStop(0.55, '#070b18'); bg.addColorStop(1, '#04060d');
  g.fillStyle = bg; g.fillRect(0, 0, w, h);
  for (let k = 0; k < 14; k++) {
    const x = hash2(k, 1, seed) * w, y = h * (0.1 + 0.5 * hash2(k, 11, seed)) + x * 0.2, r = Math.max(w, h) * (0.08 + 0.12 * hash2(k, 2, seed));
    const gr = g.createRadialGradient(x, y, 0, x, y, r), col = k % 3 ? '120,80,170' : '60,110,170';
    gr.addColorStop(0, `rgba(${col},0.05)`); gr.addColorStop(1, `rgba(${col},0)`);
    g.fillStyle = gr; g.fillRect(x - r, y - r, r * 2, r * 2);
  }
  const n = Math.round((w * h) / 2400), d = MPL.dpr;
  for (let k = 0; k < n; k++) {
    const x = hash2(k, 3, seed) * w, y = hash2(k, 4, seed) * h, b = hash2(k, 5, seed);
    g.fillStyle = `rgba(${b > 0.9 ? '255,236,214' : '214,226,255'},${0.15 + 0.45 * b})`;
    g.fillRect(x, y, (b > 0.96 ? 1.3 : 0.8) * d, (b > 0.96 ? 1.3 : 0.8) * d);
  }
  return c;
}

/** Where everything sits (css px): Corvane and the orbit beside the card on a wide screen, across the top on a tall one. */
function mplLayout(w, h) {
  if (w >= h * 1.15) {
    // (beside the card, a little behind its edge at most; the Ring kept inside the screen at the orbit's far right)
    const r = clamp(Math.min(h * 0.13, (w / 2 - 150) * 0.155), 24, 150), left = w / 2 + 150, right = w - 16 - r * 2, a = (right - left) / 2;
    return { sx: (left + right) / 2, sy: h * 0.46, a, b: a * 0.32, r, card: { x: w / 2, y: h / 2, r: 330 } };
  }
  const a = w * 0.4, r = clamp(w * 0.12, 20, 100);
  return { sx: w * 0.5, sy: Math.max(r * 1.4, h * 0.07), a, b: a * 0.28, r, card: { x: w / 2, y: h * 0.55, r: Math.max(w, h) * 0.6 } };
}

/** The per-pixel geometry of the sphere image (n × n): each pixel's normal, latitude and longitude. */
function mplGeometry(n) {
  const nx = new Float32Array(n * n), ny = new Float32Array(n * n), nz = new Float32Array(n * n), lat = new Float32Array(n * n), lon = new Float32Array(n * n), edge = new Float32Array(n * n);
  const axis = 0.32, ca = Math.cos(axis), sa = Math.sin(axis); // (the planet's axis leans a little)
  for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
    const x = ((i + 0.5) / n) * 2 - 1, y = ((j + 0.5) / n) * 2 - 1, rr = x * x + y * y, k = j * n + i;
    if (rr > 1) { edge[k] = -1; continue; }
    const z = Math.sqrt(1 - rr);
    nx[k] = x; ny[k] = y; nz[k] = z;
    edge[k] = Math.min(1, (1 - Math.sqrt(rr)) * n * 0.5);
    const px = x * ca + y * sa, py = -x * sa + y * ca;
    lat[k] = Math.asin(clamp(-py, -1, 1));
    lon[k] = Math.atan2(px, z);
  }
  return { n, nx, ny, nz, lat, lon, edge, ca, sa };
}

/** Where map point (u 0..1 round, lat) is on the sphere now: { x, y, z } (unit sphere, z toward you), turned by rot. */
function mplOnSphere(u, lat, rot) {
  const G = MPL.geo, lo = u * Math.PI * 2 - rot, cl = Math.cos(lat);
  const px = cl * Math.sin(lo), z = cl * Math.cos(lo), py = -Math.sin(lat);
  return { x: px * G.ca - py * G.sa, y: px * G.sa + py * G.ca, z };
}

/** The state of the system at time t: the planet's place, size and light, Argos, the Carriers. */
function mplState(t, Lo) {
  const th = (t / MPLANET.orbit) * Math.PI * 2 - 0.2, // (it opens on the near side, to the right)
    s = Math.sin(th), c = Math.cos(th), e = Lo.b / Lo.a, ce = Math.sqrt(1 - e * e);
  const px = Lo.sx + Lo.a * c, py = Lo.sy + Lo.b * s, r = Lo.r * (1 + 0.22 * s);
  let L = [-c, -s * e, -s * ce];
  const ll = Math.hypot(L[0], L[1], L[2]); L = L.map((v) => v / ll);
  const rot = (t / MPLANET.turn) * Math.PI * 2, front = s > 0;
  // Argos: round the planet in the Ring's plane, a little inclined
  const ph = (t / MPLANET.moon) * Math.PI * 2 + 0.8, tc = Math.cos(MPLANET.tilt), ts = Math.sin(MPLANET.tilt);
  const mx0 = 3.1 * Math.cos(ph), my0 = 0.5 * Math.sin(ph), mz = 3.1 * Math.sin(ph);
  const moon = { x: mx0 * tc - my0 * ts, y: mx0 * ts + my0 * tc, z: mz };
  return { th, px, py, r, L, rot, front, moon };
}

/** The sphere's image now, lit from L: the day side, a warm terminator, the night side dark with the colonies' lights,
 * and Argos's shadow if it falls on the planet. */
function mplShade(t, st) {
  const M = MPL.map, G = MPL.geo, n = G.n, img = MPL.sphere.ctx.createImageData(n, n), px = img.data;
  const rot = st.rot, crot = (t / MPLANET.clouds) * Math.PI * 2, W = M.W, H = M.H, TAU = Math.PI * 2, [Lx, Ly, Lz] = st.L;
  // Argos's shadow: where the line from it away from Corvane meets the planet (unit sphere), if it does.
  let sh = null;
  const m = st.moon, md = m.x * Lx + m.y * Ly + m.z * Lz;
  if (md > 0) { const q = m.x * m.x + m.y * m.y + m.z * m.z, disc = md * md - (q - 1); if (disc > 0) { const tt = md - Math.sqrt(disc); sh = [m.x - Lx * tt, m.y - Ly * tt, m.z - Lz * tt]; } }
  const shr2 = 0.13 * 0.13;
  for (let k = 0; k < n * n; k++) {
    const e = G.edge[k];
    if (e < 0) continue;
    const lat = G.lat[k], v = Math.min(H - 1, Math.max(0, ((0.5 - lat / Math.PI) * H) | 0));
    let u = ((G.lon[k] + rot) / TAU) % 1; if (u < 0) u += 1;
    let uc = ((G.lon[k] + crot) / TAU) % 1; if (uc < 0) uc += 1;
    const ti = v * W + ((u * W) | 0), tc = v * W + ((uc * W) | 0);
    const nx = G.nx[k], ny = G.ny[k], nz = G.nz[k];
    let s = nx * Lx + ny * Ly + nz * Lz;
    if (sh) { const d2 = (nx - sh[0]) ** 2 + (ny - sh[1]) ** 2 + (nz - sh[2]) ** 2; if (d2 < shr2) s -= (1 - d2 / shr2) * Math.max(0, s) * 0.85; }
    const day = clamp(s * 1.6 + 0.1, 0, 1), cl = M.cloud[tc] / 255;
    let r = M.tex[ti * 3], g = M.tex[ti * 3 + 1], b = M.tex[ti * 3 + 2];
    r += (246 - r) * cl; g += (244 - g) * cl; b += (240 - b) * cl;
    const warm = clamp(1 - Math.abs(s - 0.04) * 6, 0, 1);
    r *= 0.05 + day + 0.28 * warm; g *= 0.06 + 0.93 * day + 0.08 * warm; b *= 0.13 + 0.87 * day - 0.05 * warm;
    const night = clamp(-s * 3 + 0.1, 0, 1);
    if (night > 0) { const Lt = M.lights[ti] / 255; if (Lt) { const a = Lt * night * (1 - 0.7 * cl); r += 255 * a; g += 196 * a; b += 120 * a; } }
    const o = k * 4;
    px[o] = r; px[o + 1] = g; px[o + 2] = b; px[o + 3] = 255 * e;
  }
  MPL.sphere.ctx.putImageData(img, 0, 0);
}

/* ------------------------------------------------------------------ the war down there */

/** A lit map texel (a colony's lights) to fight near: { u, lat }. */
function mplLitSpot() {
  const M = MPL.map;
  for (let k = 0; k < 400; k++) {
    const t = Math.floor(Math.random() * M.W * M.H);
    if (M.lights[t]) return { u: ((t % M.W) + 0.5) / M.W, lat: (0.5 - (Math.floor(t / M.W) + 0.5) / M.H) * Math.PI };
  }
  return { u: Math.random(), lat: (Math.random() - 0.5) * 1.4 };
}

/** The war goes on: fronts start and fall quiet, flashes, fires, missiles' lines, rare strikes, and the rare nuclear blast. */
function mplWarTick(dt, still, saver) {
  const W = MPL.war, T = MPL.t;
  for (const f of W.fires) f.a -= dt / f.life;
  W.fires = W.fires.filter((f) => f.a > 0);
  if (still) { // (reduced motion: no flashes; the fires just glow, a few always burning)
    while (W.fires.length < 5) { const p = mplLitSpot(); W.fires.push({ ...p, a: 1, life: 1e9 }); }
    return;
  }
  // fronts: two or three at a time, each flickering a while before it falls quiet and another starts
  for (const f of W.fronts) f.left -= dt;
  for (const f of W.fronts) if (f.left <= 0) W.fires.push({ u: f.u, lat: f.lat, a: 1, life: 40 + 30 * Math.random() });
  W.fronts = W.fronts.filter((f) => f.left > 0);
  if (W.fronts.length < 3 && T >= W.nextFront) { const p = mplLitSpot(); W.fronts.push({ ...p, left: 18 + 22 * Math.random(), spread: 0.025 + 0.03 * Math.random() }); W.nextFront = T + 6 + 8 * Math.random(); }
  const rate = saver ? 1.2 : 3.2;
  for (const f of W.fronts) {
    if (Math.random() < dt * rate) {
      const big = Math.random() < 0.12;
      W.flashes.push({ u: f.u + (Math.random() - 0.5) * f.spread, lat: f.lat + (Math.random() - 0.5) * f.spread * 0.7, a: 1, life: big ? 0.9 : 0.35, s: big ? 2.2 : 1 });
    }
    if (Math.random() < dt * 0.1 && W.fires.length < 24) W.fires.push({ u: f.u + (Math.random() - 0.5) * f.spread, lat: f.lat, a: 1, life: 30 + 30 * Math.random() });
  }
  for (const f of W.flashes) f.a -= dt / f.life;
  W.flashes = W.flashes.filter((f) => f.a > 0);
  // a missile's line from one colony to another
  if (T >= W.nextTracer && W.fronts.length) {
    const to = W.fronts[Math.floor(Math.random() * W.fronts.length)], from = mplLitSpot();
    W.tracers.push({ a: from, b: to, p: 0, dur: 1.6 + Math.random() });
    W.nextTracer = T + (saver ? 30 : 14) + 14 * Math.random();
  }
  for (const r of W.tracers) r.p += dt / r.dur;
  W.tracers = W.tracers.filter((r) => r.p < 1.4);
  // a rare big strike (a Lance shot, a missile salvo): a brighter flash and a fading ring
  if (T >= W.nextStrike) { const p = W.fronts[0] || mplLitSpot(); W.strikes.push({ u: p.u + 0.01, lat: p.lat, p: 0 }); W.nextStrike = T + 50 + 30 * Math.random(); }
  for (const s of W.strikes) s.p += dt / 6;
  W.strikes = W.strikes.filter((s) => s.p < 1);
  // the nuclear blast: only after the menu has been open a while, then once in a long while
  if (!W.nuke && MPL.open >= MPLANET.nukeFirst && MPL.open >= W.nextNuke) mplNuke();
  if (W.nuke) { W.nuke.p += dt / 28; if (W.nuke.p >= 1) { W.fires.push({ u: W.nuke.u, lat: W.nuke.lat, a: 1, life: 90 }); W.nuke = null; } }
}

/** Set off the nuclear blast now, on the night side near a colony's lights (also a debug hook: MPL.nukeNow). */
function mplNuke() {
  const W = MPL.war, st = MPL.st;
  let best = null;
  for (let k = 0; k < 40; k++) {
    const p = mplLitSpot();
    if (!st) { best = p; break; }
    const q = mplOnSphere(p.u, p.lat, st.rot), lit = q.x * st.L[0] + q.y * st.L[1] + q.z * st.L[2];
    if (q.z > 0.35 && lit < -0.1) { best = p; break; }
    if (!best && q.z > 0.2) best = p;
  }
  best = best || mplLitSpot();
  W.nuke = { u: best.u, lat: best.lat, p: 0 };
  W.nextNuke = MPL.open + MPLANET.nukeGap[0] + Math.random() * (MPLANET.nukeGap[1] - MPLANET.nukeGap[0]);
}

/** The war drawn over the planet (centre px, py, radius r): flashes, fires and smoke, missiles' lines, strikes, the blast. */
function mplWarDraw(g, st, still) {
  const W = MPL.war, { px, py, r, L, rot } = st;
  g.save();
  g.beginPath(); g.arc(px, py, r * 0.995, 0, Math.PI * 2); g.clip();
  const at = (p) => { const q = mplOnSphere(p.u, p.lat, rot); return { x: px + q.x * r, y: py + q.y * r, z: q.z, night: clamp(-(q.x * L[0] + q.y * L[1] + q.z * L[2]) * 2.5 + 0.35, 0, 1) }; };
  const fire = mplSprite('fire', '255,90,40'), smoke = mplSprite('smoke', '90,84,80'), flash = mplSprite('flash', '255,170,90', true), white = mplSprite('white', '235,240,255', true);
  // fires: a red glow by night, a smudge of smoke by day
  for (const f of W.fires) {
    const p = at(f);
    if (p.z <= 0.05) continue;
    const s = r * 0.07 * (0.6 + 0.4 * p.z), fl = still ? 1 : 0.8 + 0.2 * Math.sin(MPL.t * 7 + f.u * 50);
    g.globalCompositeOperation = 'lighter'; g.globalAlpha = Math.min(1, f.a * 2) * p.night * 0.5 * fl * p.z;
    g.drawImage(fire, p.x - s, p.y - s, s * 2, s * 2);
    if (p.night < 0.7) { g.globalCompositeOperation = 'source-over'; g.globalAlpha = Math.min(1, f.a * 2) * (1 - p.night) * 0.35 * p.z; g.drawImage(smoke, p.x - s * 1.6 + s * 0.6, p.y - s * 0.7, s * 3.2, s * 1.4); }
  }
  g.globalCompositeOperation = 'lighter';
  // gunfire and shells: small sharp bursts
  for (const f of W.flashes) {
    const p = at(f);
    if (p.z <= 0.05) continue;
    const s = r * 0.045 * f.s * (0.5 + 0.5 * f.a);
    g.globalAlpha = f.a * (0.25 + 0.75 * p.night) * p.z;
    g.drawImage(flash, p.x - s, p.y - s, s * 2, s * 2);
  }
  // missiles' lines arcing over from one colony to another
  for (const tr of W.tracers) {
    const A = at(tr.a), B = at(tr.b);
    if (A.z <= 0.05 || B.z <= 0.05) continue;
    const mx = (A.x + B.x) / 2 + (px - (A.x + B.x) / 2) * -0.25, my = (A.y + B.y) / 2 + (py - (A.y + B.y) / 2) * -0.25 - r * 0.1;
    const head = Math.min(1, tr.p), tail = Math.max(0, tr.p - 0.35), fade = tr.p > 1 ? 1 - (tr.p - 1) / 0.4 : 1;
    const pt = (q) => ({ x: (1 - q) * (1 - q) * A.x + 2 * (1 - q) * q * mx + q * q * B.x, y: (1 - q) * (1 - q) * A.y + 2 * (1 - q) * q * my + q * q * B.y });
    g.globalAlpha = 0.55 * fade; g.strokeStyle = 'rgba(255,210,150,1)'; g.lineWidth = Math.max(0.7, r * 0.008);
    g.beginPath();
    for (let q = tail, k = 0; q <= head + 1e-6; q += (head - tail) / 8 || 1, k++) { const P = pt(q); if (k) g.lineTo(P.x, P.y); else g.moveTo(P.x, P.y); }
    g.stroke();
    if (tr.p >= 1 && tr.p < 1.15) { const s = r * 0.06; g.globalAlpha = 1 - (tr.p - 1) / 0.15; g.drawImage(flash, B.x - s, B.y - s, s * 2, s * 2); }
  }
  // a big strike: a bright flash and a ring fading out
  for (const s of W.strikes) {
    const p = at(s);
    if (p.z <= 0.05) continue;
    const k = s.p, rr = r * (0.03 + 0.12 * Math.sqrt(k));
    if (k < 0.12) { const fs = r * 0.12 * (1 - k / 0.12); g.globalAlpha = (1 - k / 0.12) * p.z; g.drawImage(white, p.x - fs, p.y - fs, fs * 2, fs * 2); }
    g.globalAlpha = (1 - k) * 0.5 * p.z; g.strokeStyle = 'rgba(255,220,180,1)'; g.lineWidth = Math.max(0.6, r * 0.006);
    g.beginPath(); g.ellipse(p.x, p.y, rr, rr * Math.max(0.3, p.z), 0, 0, Math.PI * 2); g.stroke();
    const gs = r * 0.05; g.globalAlpha = (1 - k) * 0.6 * p.night * p.z; g.drawImage(fire, p.x - gs, p.y - gs, gs * 2, gs * 2);
  }
  // the nuclear blast: a white flash lighting the night around it, a pale ring spreading slowly, an orange glow fading
  const N = W.nuke;
  if (N) {
    const p = at(N), k = N.p;
    if (p.z > 0.02) {
      if (!still && k < 0.06) { const f = 1 - k / 0.06, s = r * (0.25 + 0.45 * f); g.globalAlpha = f * p.z; g.drawImage(white, p.x - s, p.y - s, s * 2, s * 2); }
      if (!still) { const rr = r * (0.05 + 0.3 * Math.sqrt(k)); g.globalAlpha = (1 - k) * 0.55 * p.z; g.strokeStyle = 'rgba(236,240,255,1)'; g.lineWidth = Math.max(0.8, r * 0.012 * (1 - k)); g.beginPath(); g.ellipse(p.x, p.y, rr, rr * Math.max(0.3, p.z), 0, 0, Math.PI * 2); g.stroke(); }
      const gs = r * (0.12 + 0.08 * k); g.globalAlpha = (1 - k) * 0.9 * p.z; g.drawImage(fire, p.x - gs, p.y - gs, gs * 2, gs * 2);
    }
  }
  g.restore();
}

/* ------------------------------------------------------------------ the rest of the system */

/** Corvane: its corona (breathing, flaring now and then), the disc, and the bloom across the lens. */
function mplStar(g, Lo, t, saver) {
  const x = Lo.sx, y = Lo.sy, rs = Lo.r * 0.42;
  const flare = saver ? 0 : Math.max(0, Math.sin((t / 37) * Math.PI * 2)) ** 12; // (it flares often: LORE.md)
  const co = mplSprite('corona', '255,150,80'), core = mplSprite('core', '255,214,160', true);
  g.save();
  g.globalCompositeOperation = 'lighter';
  const R1 = rs * (9 + 2 * flare);
  g.globalAlpha = 0.35 + 0.2 * flare; g.drawImage(co, x - R1, y - R1, R1 * 2, R1 * 2);
  const R2 = rs * 3.4; g.globalAlpha = 0.9; g.drawImage(co, x - R2, y - R2, R2 * 2, R2 * 2);
  const R3 = rs * 1.6; g.globalAlpha = 1; g.drawImage(core, x - R3, y - R3, R3 * 2, R3 * 2);
  // the lens: a long thin streak and a few faint rings toward the middle of the screen
  if (!saver) {
    g.globalAlpha = 0.22 + 0.1 * flare; g.drawImage(core, x - rs * 16, y - rs * 0.18, rs * 32, rs * 0.36);
    const cx = MPL.w / 2, cy = MPL.h / 2;
    for (const [f, s, a] of [[0.35, 0.8, 0.05], [0.6, 0.4, 0.06], [1.25, 1.3, 0.035]]) {
      const gx = x + (cx - x) * f, gy = y + (cy - y) * f, gr = rs * s * 2;
      g.globalAlpha = a; g.drawImage(co, gx - gr, gy - gr, gr * 2, gr * 2);
    }
  }
  g.restore();
}

/** The Ring round the planet, `half` 'back' or 'front', brightest on the side toward Corvane. */
function mplRing(g, st, half) {
  const { px, py, r, L } = st;
  g.save();
  g.translate(px, py); g.rotate(MPLANET.tilt);
  const bands = [[1.92, 0.09, 0.16], [1.81, 0.04, 0.46], [1.69, 0.07, 0.3], [1.56, 0.03, 0.18], [1.46, 0.05, 0.24]];
  const ang = Math.atan2(L[1], L[0]) - MPLANET.tilt, lx = Math.cos(ang), ly = Math.sin(ang);
  const gr = g.createLinearGradient(-lx * r * 2, -ly * r * 2, lx * r * 2, ly * r * 2);
  const lit = 0.55 + 0.45 * Math.max(0, -L[2]); // (back-lit, the Ring glows through)
  gr.addColorStop(0, 'rgba(120,110,120,0.5)'); gr.addColorStop(1, `rgba(244,230,206,${lit})`);
  const nk = MPL.war.nuke && MPL.war.nuke.p < 0.08 ? (1 - MPL.war.nuke.p / 0.08) : 0; // (the blast lights the Ring a moment)
  for (const [rk, wk, a] of bands) {
    g.globalAlpha = Math.min(1, a * 1.8 + nk * 0.4); g.strokeStyle = nk > 0.3 ? 'rgba(250,250,255,0.9)' : gr; g.lineWidth = Math.max(1, r * wk);
    g.beginPath();
    if (half === 'back') g.ellipse(0, 0, r * rk, r * rk * 0.22, 0, Math.PI, Math.PI * 2);
    else g.ellipse(0, 0, r * rk, r * rk * 0.22, 0, 0, Math.PI);
    g.stroke();
  }
  g.restore();
}

/** Argos (a small grey moon, lit from Corvane's side), or nothing if it's behind the planet's disc. */
function mplMoon(g, st) {
  const m = st.moon, x = st.px + m.x * st.r, y = st.py + m.y * st.r, rm = st.r * 0.2;
  const gr = g.createRadialGradient(x + st.L[0] * rm * 0.5, y + st.L[1] * rm * 0.5, rm * 0.1, x, y, rm);
  gr.addColorStop(0, '#dcdce2'); gr.addColorStop(0.65, '#8a8a94'); gr.addColorStop(1, '#2a2a34');
  g.fillStyle = gr; g.beginPath(); g.arc(x, y, rm, 0, Math.PI * 2); g.fill();
}

/** The four vanguard Carriers in orbit: tiny lit specks, a light blinking on each; `front`: those in front of the planet. */
function mplCarriers(g, st, t, front) {
  for (let k = 0; k < 4; k++) {
    const ph = (t / (MPLANET.carrier + k * 4)) * Math.PI * 2 + k * 1.7, inc = 0.35 + 0.25 * k, rad = 1.32 + 0.08 * k;
    const x0 = rad * Math.cos(ph), y0 = rad * Math.sin(ph) * Math.sin(inc) * 0.6, z = rad * Math.sin(ph);
    if ((z > 0) !== front) continue;
    const x = st.px + (x0 * Math.cos(0.5 * k) - y0 * Math.sin(0.5 * k)) * st.r, y = st.py + (x0 * Math.sin(0.5 * k) + y0 * Math.cos(0.5 * k)) * st.r;
    if (!front && Math.hypot(x - st.px, y - st.py) < st.r) continue;
    const blink = (t * 1.3 + k * 0.37) % 1 < 0.12;
    g.fillStyle = 'rgba(220,228,240,0.85)'; g.fillRect(x - 0.9, y - 0.9, 1.8, 1.8);
    if (blink) { g.fillStyle = 'rgba(255,140,110,0.9)'; g.fillRect(x - 1.4, y - 1.4, 2.8, 2.8); }
  }
}

/** Ringfall: now and then a streak from the Ring down into the atmosphere, a small flash where it burns. */
function mplRingfall(g, st, dt) {
  if (MPL.t >= MPL.nextFall) { const a = Math.random() * Math.PI; MPL.falls.push({ a, p: 0 }); MPL.nextFall = MPL.t + 5 + 9 * Math.random(); }
  for (const f of MPL.falls) f.p += dt / 0.9;
  MPL.falls = MPL.falls.filter((f) => f.p < 1);
  const tc = Math.cos(MPLANET.tilt), ts = Math.sin(MPLANET.tilt), fl = mplSprite('fall', '255,220,180', true);
  g.save(); g.globalCompositeOperation = 'lighter';
  for (const f of MPL.falls) {
    const sx0 = 1.6 * Math.cos(f.a), sy0 = 0.35 * Math.sin(f.a), ex0 = 0.98 * Math.cos(f.a * 0.9 + 0.3), ey0 = 0.6 * Math.sin(f.a * 0.9 + 0.3);
    const P = (x, y) => [st.px + (x * tc - y * ts) * st.r, st.py + (x * ts + y * tc) * st.r];
    const k = Math.min(1, f.p * 1.3), [ax, ay] = P(sx0 + (ex0 - sx0) * Math.max(0, k - 0.3), sy0 + (ey0 - sy0) * Math.max(0, k - 0.3)), [bx, by] = P(sx0 + (ex0 - sx0) * k, sy0 + (ey0 - sy0) * k);
    g.globalAlpha = 0.7 * (1 - f.p); g.strokeStyle = 'rgba(255,226,190,1)'; g.lineWidth = 1;
    g.beginPath(); g.moveTo(ax, ay); g.lineTo(bx, by); g.stroke();
    if (f.p > 0.75) { const s = st.r * 0.05; g.globalAlpha = (1 - f.p) * 3; g.drawImage(fl, bx - s, by - s, s * 2, s * 2); }
  }
  g.restore();
}

/** The Wren on its supply loop: every MPLANET.wren seconds it comes in from the edge of the system to Ithaca I. */
function mplWren(g, st, t) {
  const cyc = t % MPLANET.wren, k = cyc / 70;
  if (k >= 1) return;
  const n = Math.floor(t / MPLANET.wren), side = hash2(n, 1, 9251) < 0.5 ? -1 : 1;
  const x0 = side > 0 ? MPL.w + 20 : -20, y0 = MPL.h * (0.1 + 0.3 * hash2(n, 2, 9251));
  const e = k * k * (3 - 2 * k), x1 = st.px + side * st.r * 2.4, y1 = st.py - st.r * 0.6;
  const x = x0 + (x1 - x0) * e, y = y0 + (y1 - y0) * e + Math.sin(k * Math.PI) * MPL.h * 0.06;
  const a = Math.min(1, k * 8, (1 - k) * 6);
  g.save(); g.globalCompositeOperation = 'lighter';
  const tr = g.createLinearGradient(x, y, x + side * 26, y - 4);
  tr.addColorStop(0, `rgba(255,200,140,${0.5 * a})`); tr.addColorStop(1, 'rgba(255,200,140,0)');
  g.strokeStyle = tr; g.lineWidth = 1; g.beginPath(); g.moveTo(x, y); g.lineTo(x + side * 26, y - 4); g.stroke();
  g.fillStyle = `rgba(255,246,230,${0.9 * a})`; g.fillRect(x - 1, y - 1, 2, 2);
  g.restore();
}

/** One frame of the backdrop. */
function mplDraw(dt, still, saver) {
  const g = MPL.g, w = MPL.w, h = MPL.h, d = MPL.dpr, t = MPL.t, Lo = mplLayout(w, h), st = MPL.st;
  g.setTransform(1, 0, 0, 1, 0, 0);
  g.globalAlpha = 1; g.globalCompositeOperation = 'source-over';
  g.drawImage(MPL.sky, 0, 0);
  g.setTransform(d, 0, 0, d, 0, 0);
  // nearer stars, drifting a little against the far ones (depth)
  if (!saver) {
    const dx = Math.sin(t * 0.013) * 10, dy = Math.cos(t * 0.011) * 6;
    for (let k = 0; k < 60; k++) {
      const z = 0.4 + hash2(k, 6, 9244), x = ((hash2(k, 8, 9244) * w + dx * z) % w + w) % w, y = ((hash2(k, 9, 9244) * h + dy * z) % h + h) % h;
      const a = still ? 0.6 : 0.5 + 0.5 * Math.sin(t * (0.5 + hash2(k, 7, 9244)) + k * 2.3);
      g.fillStyle = `rgba(226,234,255,${0.35 + 0.35 * a * z})`; g.fillRect(x, y, 0.8 + z, 0.8 + z);
    }
  }
  g.globalAlpha = MPL.fade ?? 1;
  const behind = !st.front; // (the far side of the orbit: the planet passes behind the star's glare)
  const draw = () => {
    if (st.moon.z < 0) mplMoon(g, st);
    mplCarriers(g, st, t, false);
    mplRing(g, st, 'back');
    const atm = g.createRadialGradient(st.px, st.py, st.r * 0.92, st.px, st.py, st.r * 1.14);
    const ac = `${Math.round(255)},${170},${130}`;
    atm.addColorStop(0, `rgba(${ac},0.35)`); atm.addColorStop(1, `rgba(${ac},0)`);
    g.fillStyle = atm; g.beginPath(); g.arc(st.px, st.py, st.r * 1.14, 0, Math.PI * 2); g.fill();
    g.imageSmoothingEnabled = true;
    g.drawImage(MPL.sphere.c, st.px - st.r, st.py - st.r, st.r * 2, st.r * 2);
    mplWarDraw(g, st, still);
    mplRing(g, st, 'front');
    if (!saver && !still) mplRingfall(g, st, dt);
    if (st.moon.z >= 0) mplMoon(g, st);
    mplCarriers(g, st, t, true);
  };
  if (behind) { draw(); mplStar(g, Lo, t, saver); } else { mplStar(g, Lo, t, saver); draw(); }
  if (!saver && !still) mplWren(g, st, t);
  g.globalAlpha = 1;
  // a soft shade behind the menu card, so it reads clearly over everything
  const C = Lo.card, vg = g.createRadialGradient(C.x, C.y, 0, C.x, C.y, C.r);
  vg.addColorStop(0, 'rgba(4,6,14,0.55)'); vg.addColorStop(0.6, 'rgba(4,6,14,0.35)'); vg.addColorStop(1, 'rgba(4,6,14,0)');
  g.fillStyle = vg; g.fillRect(0, 0, w, h);
}

/** Is the backdrop showing (the main menu up, the tab in front)? */
function menuPlanetCovers() { return !!MPL.c && MPL.on && !document.hidden; }

function mplResize() {
  const c = MPL.c, box = c.parentElement.getBoundingClientRect(), d = Math.min(window.devicePixelRatio || 1, 1.5);
  const w = Math.max(1, Math.round(box.width)), h = Math.max(1, Math.round(box.height));
  if (w === MPL.w && h === MPL.h && d === MPL.dpr) return false;
  MPL.w = w; MPL.h = h; MPL.dpr = d;
  c.width = Math.round(w * d); c.height = Math.round(h * d);
  MPL.sky = mplMakeSky(c.width, c.height);
  const Lo = mplLayout(w, h), n = Math.max(48, Math.min(MPLANET.res, Math.round(Lo.r * 2.5 * d)));
  if (!MPL.geo || MPL.geo.n !== n) {
    MPL.geo = mplGeometry(n);
    const sc = document.createElement('canvas');
    sc.width = sc.height = n;
    MPL.sphere = { c: sc, ctx: sc.getContext('2d') };
  }
  return true;
}

function mplFrame(now) {
  MPL.raf = 0;
  if (!MPL.on || document.hidden) return;
  MPL.raf = requestAnimationFrame(mplFrame);
  const saver = typeof gfxStep === 'function' && gfxStep() === 'saver';
  if (now - MPL.last < 1000 / (saver ? MPLANET.fpsSaver : MPLANET.fps)) return;
  const still = typeof LESS_MOTION !== 'undefined' && LESS_MOTION && LESS_MOTION.matches;
  const dt = MPL.last ? Math.min(0.25, (now - MPL.last) / 1000) : 0;
  MPL.last = now;
  const resized = mplResize();
  if (!MPL.map.done) { MPL.map.step(7); const g = MPL.g; g.setTransform(1, 0, 0, 1, 0, 0); g.drawImage(MPL.sky, 0, 0); MPL.last = 0; return; } // (the sky while the planet is made)
  MPL.fade = Math.min(1, (MPL.fade || 0) + dt * 1.5);
  MPL.open += dt;
  MPL.t += still ? dt * 0.03 : dt; // (reduced motion: near-still)
  const Lo = mplLayout(MPL.w, MPL.h);
  MPL.st = mplState(MPL.t, Lo);
  mplWarTick(dt, still, saver);
  if (!saver || resized || (MPL.frame = (MPL.frame || 0) + 1) % 2 === 0) mplShade(MPL.t, MPL.st);
  mplDraw(dt, still, saver);
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
  MPL.t = 30;
  MPL.nukeNow = mplNuke; // (a debug hook: the rare blast, at once)
  new MutationObserver(mplWatch).observe(menu, { attributes: true, attributeFilter: ['hidden'] });
  document.addEventListener('visibilitychange', mplWatch);
  mplWatch();
}

if (typeof document !== 'undefined' && document.readyState !== 'loading') menuPlanetInit();
else if (typeof document !== 'undefined') document.addEventListener('DOMContentLoaded', menuPlanetInit);

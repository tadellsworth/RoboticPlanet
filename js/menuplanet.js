'use strict';
/*
 * Terrafall — the main menu's backdrop: Corvane's system, seen from far out (LORE.md: the sky). Looks only.
 *
 * Ithaca I fills the middle of the menu's Home, large and still, its lit side toward you: Corvane, the restless orange
 * star, sits behind its left limb with its corona and bloom (and now and then a flare), putting a rim of light round it
 * (mplLayout). It turns, its clouds drift, and the thin night side on its right shows the colonies' lights, where the war
 * goes on: fronts flickering with gunfire near the lights, fires
 * lingering where they fought, a missile's line arcing between two colonies, a rare bright strike, and after the menu has
 * been open a while, once in a long while, a nuclear blast. The Ring circles the planet, catching the light; Argos goes
 * round it and its shadow crosses the planet; the four vanguard Carriers are tiny lit specks in orbit; ringfall streaks
 * down into the atmosphere; now and then the Wren comes in on its supply loop from the edge of the system.
 *
 * Drawn on its own canvas (#menu-planet), under the menu card, with a soft vignette behind the card so it stays clear. The
 * planet's face is the atlas (LORE.md: The atlas): art/lore/ithaca-map.webp, made by tools/atlas/atlas.py, its colour the
 * map and its alpha the colonies' lights (mplAtlas); its clouds, and the face itself if the picture can't be had, are
 * made once from a fixed seed (mplMakeMap), a few rows a frame at launch; the sphere is shaded from it per
 * pixel in a small image; the sky, the star's glow and the flashes are sprites made once. A dozen frames a second at most,
 * fewer on Graphics Saver (with fewer flashes, and no ringfall, Wren or drifting stars); stopped while the menu is hidden
 * or the tab is in the background; near-still with reduced motion (no flashes: the fires just glow). While it shows, the
 * demo game behind the menu isn't drawn (menuPlanetCovers: main.js).
 *
 * Only with the Menu background setting on Planet (menuBg / setMenuBg, kept on this device; Settings, from the main menu
 * or the pause menu; Planet is the default). On Classic the menu shows the AI-vs-AI demo game through its dimmed gradient, as it
 * always did, and none of this is made or run: no canvas, no map, no frames.
 */

const MPLANET = {
  texW: 1024, texH: 512,  // the planet's map (longitude × latitude): the atlas picture (art/lore/ithaca-map.webp) drawn up smoothly,
                          // then the Contingency globe's sharper colour (art/globe/ithaca-2048.webp) when it comes (mplHd)
  atlasWait: 3,           // seconds the planet waits for that picture at launch before it shows its own face
  res: 520, resSaver: 300, // the most pixels across the shaded sphere is made at (it's drawn larger, smoothly), and on Graphics Saver
  fps: 12, fpsSaver: 5,   // frames a second
  orbit: 240,             // seconds for Ithaca I to go once round Corvane
  turn: 150,              // ...to turn once
  clouds: 120,            // ...for its clouds
  moon: 55,               // ...for Argos to go round it
  moonTex: 512,           // the width of Argos's map, made once (mplMoonMap: longitude × latitude, 2:1)
  carrier: 46,            // ...for a Carrier to go round
  tilt: -0.32,            // the Ring's slant (radians)
  wren: 190,              // seconds between the Wren's visits (it takes 70 to come in)
  nukeFirst: 60,          // seconds the menu is open before a nuclear blast may come, then one every nukeGap at most
  nukeGap: [150, 150],
};

const MPL = { c: null, g: null, raf: 0, last: 0, t: 0, open: 0, map: null, sky: null, sphere: null, geo: null, w: 0, h: 0, dpr: 1, on: false,
  war: { fronts: [], fires: [], flashes: [], tracers: [], strikes: [], nextFront: 0, nextStrike: 20, nextTracer: 6, nuke: null, nextNuke: 0 },
  falls: [], nextFall: 4, spr: {} };

/* The Menu background setting: 'planet' (this, the default since the cinematic menu) or 'classic' (the demo game). */
const MENU_BG_KEY = 'terrafall.menubg';
const MENU_BG = ['classic', 'planet'];
let _menuBg = 'planet';
try { const v = localStorage.getItem(MENU_BG_KEY); if (MENU_BG.includes(v)) _menuBg = v; } catch (e) { /* storage unavailable */ }
function menuBg() { return _menuBg; }
/** Pick the menu's background; it changes at once (the planet starts, or stops and is put away). */
function setMenuBg(v) {
  if (!MENU_BG.includes(v)) return;
  _menuBg = v;
  try { localStorage.setItem(MENU_BG_KEY, v); } catch (e) { /* storage unavailable */ }
  if (typeof document !== 'undefined') mplWatch();
}

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
  const tex = new Uint8ClampedArray(W * H * 3), cloud = new Uint8ClampedArray(W * H), lights = new Uint8ClampedArray(W * H), land = new Uint8ClampedArray(W * H).fill(255);
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
  // (a face of its own, at half the map's resolution, each texel made once and copied to its neighbours: dup)
  const dup = (t) => { for (const u of [t + 1, t + W, t + W + 1]) { if (M.clouds !== 'ok') cloud[u] = cloud[t]; lights[u] = lights[t]; tex[u * 3] = tex[t * 3]; tex[u * 3 + 1] = tex[t * 3 + 1]; tex[u * 3 + 2] = tex[t * 3 + 2]; } };
  const doRow = (j) => {
    const lat = (0.5 - (j + 1) / H) * Math.PI, cl = Math.cos(lat), sl = Math.sin(lat);
    for (let i = 0; i < W; i += 2) {
      const lon = ((i + 0.5) / W) * Math.PI * 2, x = cl * Math.cos(lon), y = sl, z = cl * Math.sin(lon), t = j * W + i;
      // cloud: drifting bands, thicker toward the mid-latitudes
      const cn = mplFbm(x * 3.2 + 7, y * 6, z * 3.2, seed + 21, 3);
      if (M.clouds !== 'ok') cloud[t] = clamp((cn - 0.52) * 3.2, 0, 1) * 220; // (until the globe's own clouds come: mplClouds)
      if (M.atlas === 'ok') { if (M.clouds !== 'ok') cloud[t + 1] = cloud[t + W] = cloud[t + W + 1] = cloud[t]; continue; } // (the face is the atlas's)
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
      dup(t);
    }
  };
  // Made a few rows at a time (step: ms of a frame), so the menu answers at once while it's made. The atlas picture is
  // asked for at once; until it comes (or if it can't: mplAtlas) the rows make a face of their own too, and the planet
  // waits for it at most MPLANET.atlasWait seconds.
  const M = { tex, cloud, lights, land, W, H, row: 0, done: false, atlas: 'wait', clouds: 'wait', t0: performance.now() };
  M.step = (ms) => {
    const t0 = performance.now();
    if (M.atlas === 'ok' && M.clouds === 'ok') M.row = H; // (both pictures here: nothing left to make)
    while (M.row < H && performance.now() - t0 < ms) { doRow(M.row); M.row += 2; }
    M.done = M.row >= H && (M.atlas !== 'wait' || performance.now() - M.t0 > MPLANET.atlasWait * 1000);
    return M.done;
  };
  mplAtlas(M);
  mplClouds(M);
  mplHd(M);
  return M;
}

/** The clouds: the Contingency globe's own (art/globe/ithaca-clouds.webp; in the one-file build inline as
 * window.ITHACA_CLOUDS), so the menu planet wears the same weather; the noise clouds stay if the picture can't be had. */
function mplClouds(M) {
  const img = new Image();
  img.onload = () => {
    try {
      const c = document.createElement('canvas');
      c.width = M.W; c.height = M.H;
      const g = c.getContext('2d');
      g.drawImage(img, 0, 0, M.W, M.H);
      const d = g.getImageData(0, 0, M.W, M.H).data;
      for (let t = 0; t < M.W * M.H; t++) M.cloud[t] = Math.min(255, d[t * 4] * 1.05);
      M.clouds = 'ok';
    } catch (e) { M.clouds = 'no'; }
  };
  img.onerror = () => { M.clouds = 'no'; };
  img.src = (typeof window !== 'undefined' && window.ITHACA_CLOUDS) || 'art/globe/ithaca-clouds.webp';
}

/** The face from the atlas picture (art/lore/ithaca-map.webp; in the one-file build, inline as window.ITHACA_MAP): its
 * colour is the map (longitude −180° at the left edge, north up) and its alpha the night lights (255 none, 254 down to
 * 225 ever brighter: towns along the coasts and in the territories' hearts, made by tools/atlas/atlas.py). M.atlas becomes
 * 'ok', or 'no' (no picture, or a page opened from a file, whose canvas can't be read): then the rows' own face stays. */
function mplAtlas(M) {
  const img = new Image();
  img.onload = () => {
    try {
      const c = document.createElement('canvas');
      c.width = M.W; c.height = M.H;
      const g = c.getContext('2d');
      g.drawImage(img, 0, 0, M.W, M.H);
      const d = g.getImageData(0, 0, M.W, M.H).data;
      for (let t = 0; t < M.W * M.H; t++) {
        const a = d[t * 4 + 3];
        M.tex[t * 3] = d[t * 4]; M.tex[t * 3 + 1] = d[t * 4 + 1]; M.tex[t * 3 + 2] = d[t * 4 + 2];
        M.lights[t] = a < 255 && a >= 200 ? Math.min(255, 140 + (254 - a) * 4) : 0;
        const r = d[t * 4], gg = d[t * 4 + 1], b = d[t * 4 + 2];
        M.land[t] = b > r + 14 && b >= gg - 6 ? 0 : 255; // (the sea, for the sun's glint on it)
      }
      M.atlas = 'ok';
    } catch (e) { M.atlas = 'no'; }
  };
  img.onerror = () => { M.atlas = 'no'; };
  img.src = (typeof window !== 'undefined' && window.ITHACA_MAP) || 'art/lore/ithaca-map.webp';
}

/** The sharper colour for the big planet of the menu's Home: the Contingency globe's surface (art/globe/ithaca-2048.webp,
 * the same map), drawn into the map's colour once both it and the atlas are in (the atlas keeps the lights and the sea).
 * Not in the one-file build, which carries only the small atlas inline: there the atlas, drawn up smoothly, is the face. */
function mplHd(M) {
  if (typeof window !== 'undefined' && window.ITHACA_MAP) return;
  const img = new Image();
  img.onload = () => {
    const put = () => {
      if (M.atlas === 'wait') { setTimeout(put, 200); return; }
      if (M.atlas !== 'ok') return;
      try {
        const c = document.createElement('canvas');
        c.width = M.W; c.height = M.H;
        const g = c.getContext('2d');
        g.drawImage(img, 0, 0, M.W, M.H);
        const d = g.getImageData(0, 0, M.W, M.H).data;
        for (let t = 0; t < M.W * M.H; t++) { M.tex[t * 3] = d[t * 4]; M.tex[t * 3 + 1] = d[t * 4 + 1]; M.tex[t * 3 + 2] = d[t * 4 + 2]; }
      } catch (e) { /* (a page opened from a file: the atlas stays) */ }
    };
    put();
  };
  img.src = 'art/globe/ithaca-2048.webp';
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

/**
 * Where everything sits (css px). The main menu's cinematic Home (M2): Ithaca I large and still, its lit side toward
 * you, Corvane behind its left limb putting a rim of light round it. On a wide screen it sits in the space left of the
 * menu's right-hand rail, between the title and the dock; on an upright one across the top, above the title. `px, py, r`
 * the planet, `sx, sy` the star, `L` the light (toward Corvane: from the front, a little left and above).
 */
function mplLayout(w, h) {
  const L = [-0.62, -0.28, 0.73], ll = Math.hypot(L[0], L[1], L[2]), Ln = L.map((v) => v / ll);
  if (w >= h * 1.15) {
    const right = w - (w >= 900 ? 264 : 84), r = clamp(Math.min(h * 0.27, right * 0.21), 40, 380);
    const px = right * 0.745, py = h * 0.45;
    return { px, py, r, sx: px - r * 1.32, sy: py - r * 0.52, L: Ln, a: 0, b: 0 };
  }
  const r = clamp(Math.min(w * 0.32, h * 0.15), 40, 260), px = w * 0.5, py = Math.max(r * 1.25, h * 0.228);
  return { px, py, r, sx: px - r * 1.15, sy: py - r * 0.72, L: Ln, a: 0, b: 0 };
}

/** The planet's marks on the menu's Home (#m-marks: a ticked ring round it, its name on a leader line), placed over it. */
function mplMarks(Lo) {
  const el = typeof document !== 'undefined' && document.getElementById('m-marks');
  if (!el) return;
  const r = Lo.r;
  el.style.left = Lo.px - 2 * r + 'px'; el.style.top = Lo.py - 1.3 * r + 'px';
  el.style.width = 4 * r + 'px'; el.style.height = 2.6 * r + 'px';
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
  const G = MPL.geo, lo = u * Math.PI * 2 + rot, cl = Math.cos(lat);
  const px = cl * Math.sin(lo), z = cl * Math.cos(lo), py = -Math.sin(lat);
  return { x: px * G.ca - py * G.sa, y: px * G.sa + py * G.ca, z };
}

/** The state of the system at time t: the planet's place, size and light, Argos, the Carriers. */
function mplState(t, Lo) {
  // (Home holds it still in front of the star, lit from the front: mplLayout. It turns, its clouds drift, Argos goes round.)
  const th = 0, px = Lo.px, py = Lo.py, r = Lo.r, L = Lo.L;
  const rot = (t / MPLANET.turn) * Math.PI * 2, front = true;
  // Argos: round the planet in the Ring's plane, a little inclined
  const ph = (t / MPLANET.moon) * Math.PI * 2 + 0.8, tc = Math.cos(MPLANET.tilt), ts = Math.sin(MPLANET.tilt);
  const mx0 = 3.1 * Math.cos(ph), my0 = 0.5 * Math.sin(ph), mz = 3.1 * Math.sin(ph);
  const moon = { x: mx0 * tc - my0 * ts, y: mx0 * ts + my0 * tc, z: mz };
  return { th, px, py, r, L, rot, front, moon };
}

/** The light's part of the shading, per pixel, for a light that holds still (Home's: mplLayout): made once for the
 * geometry and the light, so a frame only looks up the map and the clouds. Each pixel: s (the light on it), day, lit, the
 * warm terminator, the haze toward the limb, the night and the sea's glint, as mplLit works them out. */
function mplLightPrep(G, L) {
  const key = G.n + ':' + L.join(',');
  if (G.prep && G.prep.key === key) return G.prep;
  const N = G.n * G.n, P = { key, s: new Float32Array(N), day: new Float32Array(N), lit: new Float32Array(N), warm: new Float32Array(N), fk: new Float32Array(N), air: new Float32Array(N), night: new Float32Array(N), spec: new Float32Array(N) };
  for (let k = 0; k < N; k++) if (G.edge[k] >= 0) mplLit(P, k, G.nx[k] * L[0] + G.ny[k] * L[1] + G.nz[k] * L[2], G.nx[k], G.ny[k], G.nz[k], L);
  return (G.prep = P);
}
/** One pixel's light terms (into P at k) for light s on a pixel with normal (nx, ny, nz), as the Contingency globe is lit. */
function mplLit(P, k, s, nx, ny, nz, L) {
  const sm = clamp((s + 0.18) / 0.73, 0, 1), day = sm * sm * (3 - 2 * sm);
  P.s[k] = s; P.day[k] = day;
  P.lit[k] = 0.035 + day * (0.55 + 0.45 * Math.max(s, 0)) * 1.02;
  P.warm[k] = clamp(1 - Math.abs(s - 0.04) * 5, 0, 1);
  const fres = Math.pow(1 - nz, 2.2);
  P.fk[k] = 1 - 0.35 * fres; P.air[k] = 0.55 * fres * clamp(s + 0.35, 0, 1);
  P.night[k] = clamp(-s * 3 + 0.1, 0, 1);
  let Hx = L[0], Hy = L[1], Hz = L[2] + 1; const hl = Math.hypot(Hx, Hy, Hz) || 1; Hx /= hl; Hy /= hl; Hz /= hl;
  const ndh = Math.max(0, nx * Hx + ny * Hy + nz * Hz), p12 = ndh ** 12;
  P.spec[k] = day > 0 ? (p12 ** 5.8 * 0.38 + p12 * 0.1) * day * 255 : 0;
}

/** The sphere's image now, lit from L: the day side, a warm terminator, the night side dark with the colonies' lights,
 * and Argos's shadow if it falls on the planet. (The light's part is made once: mplLightPrep.) */
function mplShade(t, st) {
  const M = MPL.map, G = MPL.geo, n = G.n, img = MPL.sphere.img || (MPL.sphere.img = MPL.sphere.ctx.createImageData(n, n)), px = img.data;
  const rot = st.rot, crot = (t / MPLANET.clouds) * Math.PI * 2, W = M.W, H = M.H, TAU = Math.PI * 2, [Lx, Ly, Lz] = st.L;
  const P = mplLightPrep(G, st.L);
  // Argos's shadow: where the line from it away from Corvane meets the planet (unit sphere), if it does.
  let sh = null;
  const m = st.moon, md = m.x * Lx + m.y * Ly + m.z * Lz;
  if (md > 0) { const q = m.x * m.x + m.y * m.y + m.z * m.z, disc = md * md - (q - 1); if (disc > 0) { const tt = md - Math.sqrt(disc); sh = [m.x - Lx * tt, m.y - Ly * tt, m.z - Lz * tt]; } }
  const shr2 = 0.13 * 0.13, Q = MPL.shq || (MPL.shq = { s: [0], day: [0], lit: [0], warm: [0], fk: [0], air: [0], night: [0], spec: [0] });
  const rotU = rot / TAU, crotU = crot / TAU;
  for (let k = 0; k < n * n; k++) {
    const e = G.edge[k];
    if (e < 0) continue;
    const v = Math.min(H - 1, Math.max(0, ((0.5 - G.lat[k] / Math.PI) * H) | 0)), lo = G.lon[k] / TAU;
    let u = (lo - rotU) % 1; if (u < 0) u += 1; // (it turns west to east: the land moves to the right)
    let uc = (lo - crotU) % 1; if (uc < 0) uc += 1;
    const ti = v * W + ((u * W) | 0), tc = v * W + ((uc * W) | 0), ts = v * W + ((((uc + 0.004) % 1) * W) | 0);
    // (under Argos's shadow the light is worked out again for the darker s)
    let L0 = P, j = k;
    if (sh) {
      const nx = G.nx[k], ny = G.ny[k], nz = G.nz[k], d2 = (nx - sh[0]) ** 2 + (ny - sh[1]) ** 2 + (nz - sh[2]) ** 2;
      if (d2 < shr2) { const s0 = P.s[k]; mplLit(Q, 0, s0 - (1 - d2 / shr2) * Math.max(0, s0) * 0.85, nx, ny, nz, st.L); L0 = Q; j = 0; }
    }
    const day = L0.day[j], cl = M.cloud[tc] / 255, csh = M.cloud[ts] / 255;
    let r = M.tex[ti * 3], g = M.tex[ti * 3 + 1], b = M.tex[ti * 3 + 2];
    const shade = (1 - 0.28 * csh * (1 - cl) * day) * (1 - 0.2 * cl); // (a cloud's shadow falls a little east of it)
    r *= shade; g *= shade; b *= shade;
    r += (247 - r) * cl * 0.92; g += (247 - g) * cl * 0.92; b += (250 - b) * cl * 0.92;
    const lit = L0.lit[j], warm = L0.warm[j] * (0.6 + 0.4 * (1 - cl));
    r *= lit + 0.3 * warm; g *= lit + 0.1 * warm; b *= lit - 0.02 * warm;
    if (!M.land[ti] && day > 0) { const sp = L0.spec[j] * (1 - cl); r += sp; g += sp * 0.95; b += sp * 0.85; }
    const fk = L0.fk[j], air = L0.air[j];
    r = r * fk + 77 * air; g = g * fk + 140 * air; b = b * fk + 255 * air;
    const night = L0.night[j];
    if (night > 0) { const Lt = M.lights[ti] / 255; if (Lt) { const a = Lt * night * (1 - 0.7 * cl); r += 255 * a; g += 190 * a; b += 110 * a; } }
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
  if (W.fronts.length < (saver ? 3 : 4) && T >= W.nextFront) { const p = mplLitSpot(); W.fronts.push({ ...p, left: 18 + 22 * Math.random(), spread: 0.025 + 0.03 * Math.random() }); W.nextFront = T + 4 + 6 * Math.random(); }
  const rate = saver ? 1.8 : 5; // (busier since Nov 21 2026: the owner found it too calm)
  for (const f of W.fronts) {
    if (Math.random() < dt * rate) {
      const big = Math.random() < 0.18;
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
    W.nextTracer = T + (saver ? 20 : 8) + 10 * Math.random();
  }
  for (const r of W.tracers) r.p += dt / r.dur;
  W.tracers = W.tracers.filter((r) => r.p < 1.4);
  // a rare big strike (a Lance shot, a missile salvo): a brighter flash and a fading ring
  if (T >= W.nextStrike) { const p = W.fronts[0] || mplLitSpot(); W.strikes.push({ u: p.u + 0.01, lat: p.lat, p: 0 }); W.nextStrike = T + 25 + 20 * Math.random(); }
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
  const x = Lo.sx, y = Lo.sy, rs = Lo.r * 0.3; // (smaller than the planet it lights: Home holds it large)
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

/** Argos's face, made once: an equirectangular map (MPLANET.moonTex wide) of grey regolith, the darker, smoother maria
 * (a few round basins with ragged shores, most on the face toward Ithaca I) and craters of every size, a few young ones
 * bright with rays (LORE.md: a grey, airless field of craters; the Lunar biome's look). `alb` its brightness, `mare` how
 * much of it is mare, `gu`, `gv` the slopes of its height (the craters' bowls and rims), east and north, for the light. */
function mplMoonMap() {
  const W = MPLANET.moonTex, H = W / 2, seed = 7717, N = W * H;
  const alb = new Float32Array(N), mare = new Float32Array(N), hgt = new Float32Array(N), gu = new Float32Array(N), gv = new Float32Array(N);
  const pt = (u, lat) => { const lo = u * Math.PI * 2, cl = Math.cos(lat); return [cl * Math.sin(lo), Math.sin(lat), cl * Math.cos(lo)]; };
  const rnd = (k, j) => hash2(k, j, seed);
  const basins = [[0.08, 0.38, 0.4], [0.94, 0.14, 0.34], [0.03, -0.2, 0.28], [0.88, -0.38, 0.22], [0.16, 0.02, 0.18], [0.52, 0.24, 0.24], [0.62, -0.34, 0.16]]
    .map(([u, lat, r]) => ({ p: pt(u, lat), r }));
  const craters = [];
  for (let k = 0; k < 320; k++) {
    const p = pt(rnd(k, 2), Math.asin(rnd(k, 1) * 2 - 1)), r = 0.012 + 0.16 * Math.pow(rnd(k, 3), 4);
    // (a frame on the sphere at its middle, for the angle round it that its rays follow)
    let e1 = [p[2], 0, -p[0]]; const el = Math.hypot(e1[0], e1[2]) || 1; e1 = [e1[0] / el, 0, e1[2] / el];
    const e2 = [p[1] * e1[2] - p[2] * e1[1], p[2] * e1[0] - p[0] * e1[2], p[0] * e1[1] - p[1] * e1[0]];
    craters.push({ p, r, cr: Math.cos(Math.min(Math.PI, r * (rnd(k, 4) < 0.12 ? 4.6 : 1.6))), young: rnd(k, 4) < 0.12, dep: 0.6 + 0.4 * rnd(k, 5), ray: rnd(k, 6) * 100, e1, e2 });
  }
  const doRow = (j) => {
    const lat = (0.5 - (j + 0.5) / H) * Math.PI;
    for (let i = 0; i < W; i++) {
      const [x, y, z] = pt((i + 0.5) / W, lat), t = j * W + i;
      let m = 0;
      const wob = 0.26 * (mplFbm(x * 5 + 3, y * 5, z * 5, seed + 1, 4) - 0.5);
      for (const b of basins) { const d = Math.acos(clamp(x * b.p[0] + y * b.p[1] + z * b.p[2], -1, 1)); m = Math.max(m, clamp((b.r + wob - d) / 0.09, 0, 1)); }
      const n1 = mplFbm(x * 6, y * 6, z * 6, seed + 2, 4), n2 = mplNoise(x * 40, y * 40, z * 40, seed + 3);
      let a = (0.8 + 0.24 * (n1 - 0.5) + 0.08 * (n2 - 0.5)) * (1 - m) + (0.4 + 0.12 * (n1 - 0.5) + 0.03 * (n2 - 0.5)) * m;
      let h = 0.003 * (n2 - 0.5) * (1 - 0.7 * m);
      for (const c of craters) {
        const dot = x * c.p[0] + y * c.p[1] + z * c.p[2];
        if (dot < c.cr) continue;
        const q = Math.acos(clamp(dot, -1, 1)) / c.r; // (its distance from the middle, in its radii)
        const fill = 1 - 0.6 * m; // (the maria flooded the old craters: shallower there)
        if (q < 1) h -= c.r * 0.14 * c.dep * fill * (1 - q * q);
        h += c.r * 0.045 * fill * Math.exp(-(((q - 1) / 0.16) ** 2));
        a += (q < 0.85 ? -0.025 : 0.04 * Math.exp(-(((q - 1) / 0.14) ** 2))) * fill;
        if (c.young) {
          a += 0.16 * Math.exp(-(((q - 1) / 0.25) ** 2)) + (q < 1 ? 0.06 : 0);
          if (q > 1) { // (rays thrown out across whatever lies round it)
            const ang = Math.atan2(x * c.e2[0] + y * c.e2[1] + z * c.e2[2], x * c.e1[0] + y * c.e1[1] + z * c.e1[2]);
            const ray = Math.pow(Math.max(0, Math.sin(ang * 5 + c.ray) * Math.sin(ang * 9 + c.ray * 2)), 3);
            a += 0.13 * ray * Math.max(0, 1 - (q - 1) / 1.8);
          }
        }
      }
      alb[t] = clamp(a, 0.2, 1.15); mare[t] = m; hgt[t] = h;
    }
  };
  // the height's slopes per radian, east along the latitude's circle and north, wrapping round in longitude
  const slopes = () => {
    const du = (Math.PI * 2) / W, dv = Math.PI / H;
    for (let j = 0; j < H; j++) {
      const cl = Math.max(0.15, Math.cos((0.5 - (j + 0.5) / H) * Math.PI));
      for (let i = 0; i < W; i++) {
        const t = j * W + i, e = j * W + ((i + 1) % W), w = j * W + ((i - 1 + W) % W), nn = Math.max(0, j - 1) * W + i, ss = Math.min(H - 1, j + 1) * W + i;
        gu[t] = (hgt[e] - hgt[w]) / (2 * du * cl); gv[t] = (hgt[nn] - hgt[ss]) / (2 * dv);
      }
    }
  };
  // (made a few rows a frame, as the planet's own face is, so the menu never stalls on it; Argos shows when it's done)
  const A = { W, H, alb, mare, gu, gv, done: false, row: 0 };
  A.step = (rows) => { for (let k = 0; k < rows && A.row < H; k++) doRow(A.row++); if (A.row >= H && !A.done) { slopes(); A.done = true; } };
  return A;
}

/** The per-pixel geometry of Argos's disc (n × n, radius n/2 - 1), made once a size: each pixel's normal, the map row
 * and longitude under it (about Argos's axis, slanted as the Ring is), and its east and north directions on screen
 * (turning about the axis never changes them). */
function mplMoonGeometry(n) {
  const N = n * n, G = { n, nx: new Float32Array(N), ny: new Float32Array(N), nz: new Float32Array(N), v: new Int32Array(N), lon: new Float32Array(N), ex: new Float32Array(N * 3), no: new Float32Array(N * 3), edge: new Float32Array(N) };
  const c = Math.cos(MPLANET.tilt), s = Math.sin(MPLANET.tilt), H = MPLANET.moonTex / 2, R = n / 2 - 1;
  for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
    let x = (i + 0.5 - n / 2) / R, y = (j + 0.5 - n / 2) / R;
    const rr = Math.hypot(x, y), k = j * n + i;
    G.edge[k] = clamp((1 - rr) * R + 0.5, 0, 1); // (a pixel's worth of soft edge, no more)
    if (G.edge[k] <= 0) continue;
    if (rr > 1) { x /= rr; y /= rr; }
    const z = Math.sqrt(Math.max(0, 1 - x * x - y * y));
    G.nx[k] = x; G.ny[k] = y; G.nz[k] = z;
    const lx = x * c + y * s, ly = -x * s + y * c, lat = Math.asin(clamp(-ly, -1, 1)), lo = Math.atan2(lx, z), sl = Math.sin(lat);
    G.v[k] = Math.min(H - 1, Math.max(0, ((0.5 - lat / Math.PI) * H) | 0)); G.lon[k] = lo / (Math.PI * 2);
    const E = [Math.cos(lo), 0, -Math.sin(lo)], No = [-sl * Math.sin(lo), -Math.cos(lat), -sl * Math.cos(lo)];
    G.ex[k * 3] = E[0] * c - E[1] * s; G.ex[k * 3 + 1] = E[0] * s + E[1] * c; G.ex[k * 3 + 2] = E[2];
    G.no[k * 3] = No[0] * c - No[1] * s; G.no[k * 3 + 1] = No[0] * s + No[1] * c; G.no[k * 3 + 2] = No[2];
  }
  return G;
}

/** Argos's image (n × n), lit by L with its face turned by `turn` (0..1): airless, so a hard terminator with the crater
 * walls catching the low light along it, a thin bright rim on the limb toward Corvane, and on its night side only a
 * faint coral planetshine from Ithaca I. Cached: made again only when it has turned a step or the size or light change. */
function mplMoonShade(n, L, turn) {
  const A = MPL.moonMap;
  if (!MPL.moonGeo || MPL.moonGeo.n !== n) {
    MPL.moonGeo = mplMoonGeometry(n);
    const c = document.createElement('canvas'); c.width = c.height = n;
    MPL.moonImg = { c, ctx: c.getContext('2d'), img: null, key: '' };
  }
  const key = turn + ':' + L.join(','), I = MPL.moonImg;
  if (I.key === key) return I.c;
  I.key = key;
  const G = MPL.moonGeo, img = I.img || (I.img = I.ctx.createImageData(n, n)), px = img.data, W = A.W;
  const [Lx, Ly, Lz] = L, l2 = Math.hypot(Lx, Ly) || 1, bump = 1.7;
  for (let k = 0; k < n * n; k++) {
    const o = k * 4, e = G.edge[k];
    if (e <= 0) { px[o + 3] = 0; continue; }
    let u = (G.lon[k] + turn) % 1; if (u < 0) u += 1;
    const t = G.v[k] * W + ((u * W) | 0), a = A.alb[t], m = A.mare[t], k3 = k * 3, su = A.gu[t] * bump, sv = A.gv[t] * bump;
    const nx0 = G.nx[k], ny0 = G.ny[k], nz0 = G.nz[k];
    let nx = nx0 - su * G.ex[k3] - sv * G.no[k3], ny = ny0 - su * G.ex[k3 + 1] - sv * G.no[k3 + 1], nz = nz0 - su * G.ex[k3 + 2] - sv * G.no[k3 + 2];
    const nl = Math.hypot(nx, ny, nz) || 1; nx /= nl; ny /= nl; nz /= nl;
    const mu0 = nx * Lx + ny * Ly + nz * Lz, g0 = nx0 * Lx + ny0 * Ly + nz0 * Lz;
    // regolith: Lommel-Seeliger (lit nearly flat out to the limb, as a moon is) with a little Lambert in it
    let lit = 0;
    if (mu0 > 0) { const mu = Math.max(0.08, nz0); lit = ((1.3 * mu0) / (mu0 + mu)) * 0.68 + mu0 * 0.36; lit *= clamp(mu0 / 0.03, 0, 1); }
    // the rim: a thin bright edge on the limb toward the light, fading round to the terminator
    const side = (nx0 * Lx + ny0 * Ly) / l2 / Math.max(0.2, Math.hypot(nx0, ny0));
    const rim = Math.pow(1 - nz0, 4) * clamp(side, 0, 1) * clamp(g0 * 4 + 0.4, 0, 1) * 0.9;
    const shine = 0.045 * clamp(-g0 * 3 + 0.25, 0, 1); // (planetshine)
    // (the maria a shade browner, the highlands a cool pale grey; Corvane's light a little warm)
    const cr = a * (1 - m * 0.03), cg = a * (1 - m * 0.06), cb = a * (1 - m * 0.1);
    px[o] = clamp(cr * (lit * 258 + shine * 160) + rim * 255, 0, 255);
    px[o + 1] = clamp(cg * (lit * 248 + shine * 110) + rim * 242, 0, 255);
    px[o + 2] = clamp(cb * (lit * 236 + shine * 96) + rim * 226, 0, 255);
    px[o + 3] = 255 * e;
  }
  I.ctx.putImageData(img, 0, 0);
  return I.c;
}

/** Argos, a small grey moon lit from Corvane's side, drawn sharp at the canvas's own pixels (none of the planet's soft
 * glow on it): its image is shaded at the size it shows (mplMoonShade) and turns with its orbit, one face always
 * toward Ithaca I. */
function mplMoon(g, st) {
  const A = MPL.moonMap || (MPL.moonMap = mplMoonMap());
  if (!A.done) { A.step(6); if (A.done) A.at = performance.now(); return; }
  const m = st.moon, d = MPL.dpr, x = (st.px + m.x * st.r) * d, y = (st.py + m.y * st.r) * d, rm = st.r * 0.2 * d;
  const n = Math.min(MPL.saver ? 128 : 256, Math.max(16, Math.ceil(rm * 2) + 2)), s = (n * rm) / (n / 2 - 1);
  // (tidally locked: the point under the planet stays the map's middle; a step is 1/360 of a turn, a few shadings a second)
  const turn = ((Math.round((-Math.atan2(-m.x, -m.z) / (Math.PI * 2)) * 360) / 360) % 1 + 1) % 1;
  const c = mplMoonShade(n, st.L, turn);
  g.save();
  g.setTransform(1, 0, 0, 1, 0, 0);
  g.imageSmoothingEnabled = true;
  g.globalAlpha *= clamp((performance.now() - A.at) / 1200, 0, 1); // (it fades in once its map is made)
  g.drawImage(c, x - s / 2, y - s / 2, s, s);
  g.restore();
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
    // the halo of air: blue, as the Contingency globe's, thicker on the side toward Corvane
    const hx = st.px + st.L[0] * st.r * 0.07, hy = st.py + st.L[1] * st.r * 0.07;
    const atm = g.createRadialGradient(hx, hy, st.r * 0.94, hx, hy, st.r * 1.2);
    atm.addColorStop(0, 'rgba(110,170,255,0.55)'); atm.addColorStop(0.25, 'rgba(92,150,255,0.22)'); atm.addColorStop(1, 'rgba(92,150,255,0)');
    g.fillStyle = atm; g.beginPath(); g.arc(hx, hy, st.r * 1.2, 0, Math.PI * 2); g.fill();
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
  // (the menu shades the edges itself, over this: #screen-menu::after in style.css)
}

/** Is the backdrop showing (the main menu up, the tab in front)? */
function menuPlanetCovers() { return !!MPL.c && MPL.on && !document.hidden; }

function mplResize() {
  const c = MPL.c, box = c.parentElement.getBoundingClientRect(), d = Math.min(window.devicePixelRatio || 1, 1.5);
  const w = Math.max(1, Math.round(box.width)), h = Math.max(1, Math.round(box.height));
  const sv = typeof gfxStep === 'function' && gfxStep() === 'saver';
  if (w === MPL.w && h === MPL.h && d === MPL.dpr && sv === MPL.saver) return false;
  MPL.w = w; MPL.h = h; MPL.dpr = d; MPL.saver = sv;
  c.width = Math.round(w * d); c.height = Math.round(h * d);
  MPL.sky = mplMakeSky(c.width, c.height);
  const saver = typeof gfxStep === 'function' && gfxStep() === 'saver';
  const Lo = mplLayout(w, h), n = Math.max(48, Math.min(saver ? MPLANET.resSaver : MPLANET.res, Math.round(Lo.r * 2 * d)));
  mplMarks(Lo);
  if (!MPL.geo || MPL.geo.n !== n) {
    MPL.geo = mplGeometry(n);
    const sc = document.createElement('canvas');
    sc.width = sc.height = n;
    MPL.sphere = { c: sc, ctx: sc.getContext('2d'), img: null };
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

/** Start or stop the backdrop as the menu shows or hides, as the tab comes and goes, and with the Menu background setting. */
function mplWatch() {
  const menu = document.getElementById('screen-menu');
  if (!menu) return;
  const want = _menuBg === 'planet';
  if (want && !MPL.c) mplMake(menu);
  const on = want && !menu.hidden && !document.hidden;
  MPL.on = on;
  if (MPL.c) MPL.c.hidden = !want || menu.hidden;
  menu.classList.toggle('has-planet', want);
  const marks = document.getElementById('m-marks');
  if (marks) { marks.hidden = !want; if (want) mplMarks(mplLayout(window.innerWidth, window.innerHeight)); }
  if (!on && MPL.raf) { cancelAnimationFrame(MPL.raf); MPL.raf = 0; }
  if (on && !MPL.raf) { MPL.last = 0; MPL.raf = requestAnimationFrame(mplFrame); }
}

/** The canvas and the planet's map: made the first time the Planet background is wanted (never on Classic). */
function mplMake(menu) {
  const c = document.createElement('canvas');
  c.id = 'menu-planet';
  c.setAttribute('aria-hidden', 'true');
  menu.insertBefore(c, menu.firstChild);
  MPL.c = c; MPL.g = c.getContext('2d');
  MPL.map = mplMakeMap();
  MPL.t = 128; // (it opens with the Rust, the coral world, toward you)
  MPL.nukeNow = mplNuke; // (a debug hook: the rare blast, at once)
}

let _mplInit = false;
function menuPlanetInit() {
  const menu = document.getElementById('screen-menu');
  if (!menu || _mplInit || typeof document.createElement !== 'function') return;
  _mplInit = true;
  new MutationObserver(mplWatch).observe(menu, { attributes: true, attributeFilter: ['hidden'] });
  document.addEventListener('visibilitychange', mplWatch);
  mplWatch();
}

if (typeof document !== 'undefined' && document.readyState !== 'loading') menuPlanetInit();
else if (typeof document !== 'undefined') document.addEventListener('DOMContentLoaded', menuPlanetInit);

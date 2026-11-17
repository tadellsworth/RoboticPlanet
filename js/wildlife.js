'use strict';
/*
 * Terrafall — the wildlife: Earth's animals from the Pathfinder's garden in the green land and at its edges, small native
 * creatures where the ringfall made the land strange, and nothing on Argos (LORE.md, The Pathfinder's garden).
 *
 * Looks only. Nothing here changes the game: S is only read (the map, the effects, the Murmur's clock and nests), no order
 * is sent and nothing is saved. Two players needn't see the same animals, so they live in FAUNA alone and move by the
 * frame's own clock (Math.random is fine here: this is display code, never the simulation's).
 *
 * - Where: the map is read in cells of FAUNA_CELL tiles (faunaHab: trees, open ground, lake shores and shallows, rock).
 *   Each cell keeps a roster of what lives there (faunaRoster, from the planet's seed, so the same animals are there when
 *   you pan back), and only the cells round the view are kept, moved and drawn. Nothing rests on a road, a building, a
 *   deposit or water it can't stand in.
 * - When: by the light on screen (the Day and night setting, photo mode's slider: TOD.state): the day animals bed down at
 *   dusk and the night ones come out. Storms keep the birds down; rain puts the fireflies out.
 * - The war: gunfire and blasts (read from S.fx) send flocks up and herds running, and the ground stays empty until it
 *   has been quiet FAUNA_QUIET seconds. Animals step aside from robots and convoys. Carrion birds circle a new wreck.
 * - The Murmur (read only: murmurNight and the day's clock, the nests and tunnel exits, the packs): the birds fall silent
 *   FAUNA_DREAD seconds before a Murmur night (faunaHush: js/audio.js hushes the day calls), flocks lift and herds bolt
 *   from the nests and exits, moths scatter from lights the packs come near, and at dawn the birds come back singing
 *   (faunaChorus). In the Hollow, the glow-worms go out and the crawlers hide in the lull before a surge.
 * - Drawn in two layers (render.js): faunaGround (before the buildings and robots: animals on the ground and perched in
 *   the trees, tracks in the snow) and faunaAir (after the smoke, under the aircraft: birds in flight and their shadows,
 *   and the night's glows: fireflies, eyes, glow-worms, moths round the lights). Never selectable, no team colours.
 * - Cost: none on the Saver Graphics step; at most FAUNA_CAP animals at Auto, more on High and Ultra (FAUNA_STEP).
 */

const FAUNA_CELL = 8;     // tiles along each side of a cell
const FAUNA_QUIET = 40;   // game seconds without shots or blasts nearby before the animals come back
const FAUNA_DREAD = 75;   // seconds before a Murmur night that the animals sense them coming
const FAUNA_CAP = 150;    // animals at once at Auto
const FAUNA_STEP = { saver: 0, auto: 1, high: 1.25, ultra: 1.5 }; // how many next to Auto, by the Graphics step
/** The biomes whose birdsong falls silent before a Murmur night and comes back as a dawn chorus (faunaHush, faunaChorus). */
const FAUNA_SONG = { jungle: 1, autumn: 1, savanna: 1, swamp: 1 };

/*
 * The animals. mode: how it lives (FAUNA_MODES); act: when it's out ('day', 'night', 'dusk' or 'all'); hab: the cell
 * habitat it lives in (faunaHab), min of it a cell needs, p the chance a cell has a group (two where there's plenty);
 * n: how many in a group; z: the zoom (px a tile) it is drawn from; size: its length in tiles; col: body, light, dark.
 * alt: the habitat it takes where a cell has too little of hab (deer: the forest edges, away from lakes); high: how high
 * it soars (tiles); bold: it doesn't flee the fighting (the scavengers, the geese passing high over).
 */
const FAUNA_KINDS = {
  songbird: { mode: 'flock', draw: 'bird', act: 'day', hab: 'tree', min: 4, p: 0.8, n: [5, 9], z: 22, size: 0.19, col: ['#6e5a42', '#e2c08a', '#221a14'], forage: 'edge' },
  snowbird: { mode: 'flock', draw: 'bird', act: 'day', hab: 'perch', min: 1, p: 0.55, n: [6, 10], z: 22, size: 0.18, col: ['#ece8e0', '#a07a52', '#3e3630'], ground: true, forage: 'open' },
  deer: { mode: 'herd', draw: 'deer', act: 'day', hab: 'shore', min: 2, p: 0.7, alt: 'edge', n: [2, 4], z: 12, size: 0.48, speed: 0.32, run: 2.7, col: ['#8e5c36', '#e8dccb', '#4a2e1a'] },
  herd: { mode: 'herd', draw: 'antelope', act: 'day', hab: 'open', min: 26, p: 0.5, n: [5, 10], z: 9, size: 0.46, speed: 0.26, run: 2.9, col: ['#4c4038', '#8c7c6a', '#1c1814'], spread: 1.6 },
  fox: { mode: 'herd', draw: 'fox', act: 'day', hab: 'open', min: 10, p: 0.45, n: [1, 1], z: 14, size: 0.38, speed: 0.6, run: 2.5, col: ['#c0602c', '#f2e6d6', '#2a1a10'], roam: true },
  hare: { mode: 'herd', draw: 'hare', act: 'day', hab: 'open', min: 12, p: 0.55, n: [1, 3], z: 16, size: 0.28, speed: 0.45, run: 3.2, col: ['#f4eee2', '#ffffff', '#3a3632'], hop: true, spread: 2.4, roam: true },
  arcticfox: { mode: 'herd', draw: 'fox', act: 'night', hab: 'open', min: 16, p: 0.4, n: [1, 1], z: 14, size: 0.36, speed: 0.75, run: 2.5, col: ['#e2e2de', '#ffffff', '#6c6c74'], roam: true, tracks: true, lift: 0.3 },
  heron: { mode: 'wade', draw: 'heron', act: 'day', hab: 'shallow', min: 2, p: 0.65, n: [1, 1], z: 12, size: 0.52, col: ['#8e98a2', '#e4e8ec', '#2c3036'] },
  geese: { mode: 'swim', draw: 'goose', act: 'day', hab: 'shallow', min: 5, p: 0.4, n: [3, 6], z: 12, size: 0.38, col: ['#8a7e6e', '#ece4d4', '#1e1c1a'] },
  frog: { mode: 'small', draw: 'frog', act: 'all', hab: 'shore', min: 2, p: 0.6, n: [2, 4], z: 24, size: 0.09, col: ['#5f7c36', '#a8c65c', '#222e18'], hop: true },
  lizard: { mode: 'small', draw: 'lizard', act: 'day', hab: 'rock', min: 2, p: 0.7, n: [1, 3], z: 20, size: 0.24, col: ['#d6ae7a', '#f2dcae', '#6a4424'], dart: true },
  beetle: { mode: 'small', draw: 'beetle', act: 'day', hab: 'open', min: 10, p: 0.6, n: [2, 5], z: 22, size: 0.16, col: ['#221c1a', '#f08a3a', '#000000'] },
  crawler: { mode: 'small', draw: 'crawler', act: 'all', hab: 'open', min: 8, p: 0.6, n: [1, 3], z: 16, size: 0.24, col: ['#c4bcc8', '#ece6f0', '#6a6070'], lift: 0.45 },
  owl: { mode: 'perch', draw: 'owl', act: 'night', hab: 'tree', min: 6, p: 0.4, n: [1, 1], z: 14, size: 0.24, col: ['#7c644a', '#ccb48e', '#2a2018'], eyes: '#ffc860', lift: 0.45 },
  snowyowl: { mode: 'perch', draw: 'owl', act: 'night', hab: 'perch', min: 1, p: 0.35, n: [1, 1], z: 14, size: 0.25, col: ['#f2f2ee', '#ffffff', '#5c5c64'], eyes: '#ffe060', lift: 0.5 },
  crow1: { mode: 'perch', draw: 'crow', act: 'day', hab: 'dead', min: 1, p: 0.35, n: [1, 1], z: 14, size: 0.22, col: ['#222026', '#56525e', '#0c0c0e'], bold: true },
  bat: { mode: 'flit', draw: 'bat', act: 'night', hab: 'tree', min: 4, p: 0.5, n: [2, 4], z: 11, size: 0.26, col: ['#625458', '#9a8a90', '#3a3034'], lift: 0.55 },
  duskbat: { mode: 'flit', draw: 'bat', act: 'dusk', hab: 'rock', min: 2, p: 0.5, n: [2, 4], z: 11, size: 0.26, col: ['#4a3a34', '#8a7068', '#2e221c'], lift: 0.3 },
  embermoth: { mode: 'flit', draw: 'moth', act: 'night', hab: 'open', min: 8, p: 0.55, n: [3, 6], z: 11, size: 0.07, col: ['#5a2a14', '#ffb060', '#1a0c06'], glow: '#ff8a30', slow: true },
  floater: { mode: 'drift', draw: 'floater', act: 'all', hab: 'open', min: 6, p: 0.65, n: [1, 3], z: 9, size: 0.3, col: ['#c8a0e8', '#f6dcff', '#6a3a92'], glow: '#d890ff' },
  vulture: { mode: 'soar', draw: 'raptor', act: 'day', hab: 'open', min: 20, p: 0.16, n: [1, 3], z: 8, size: 0.62, col: ['#3e322a', '#a8987e', '#1a1412'], bold: true, high: 2.6 },
  hawk: { mode: 'soar', draw: 'raptor', act: 'day', hab: 'any', min: 0, p: 0.14, n: [1, 1], z: 8, size: 0.44, col: ['#7a5236', '#dcc4a2', '#2a1a10'], bold: true, high: 2.2 },
  crow: { mode: 'soar', draw: 'raptor', act: 'day', hab: 'any', min: 0, p: 0, n: [2, 4], z: 8, size: 0.3, col: ['#222026', '#4e4a56', '#0c0c0e'], bold: true, high: 1.5 },
  raven: { mode: 'soar', draw: 'raptor', act: 'day', hab: 'any', min: 0, p: 0, n: [2, 3], z: 8, size: 0.36, col: ['#1c1a20', '#46424e', '#08080a'], bold: true, high: 1.7 },
  vgeese: { mode: 'vee', draw: 'goose', act: 'day', size: 0.3, z: 6, n: [7, 11], bold: true, col: ['#8a7e6e', '#ece4d4', '#1e1c1a'] },
};
/*
 * Who lives where: kinds (FAUNA_KINDS), glows (the night's lights: fireflies, eyes in the grass, glow-worms), what circles
 * the colony's lights at night, the carrion birds over a wreck, and which of the biome's plants (S.decor, 1-6) are trees
 * birds perch in, shrubs, grass and dead trees.
 */
const FAUNA_LIFE = {
  jungle: { kinds: ['songbird', 'deer', 'owl'], glows: ['firefly'], light: 'moth', carrion: 'crow', trees: [1, 2, 3, 4] },
  autumn: { kinds: ['fox', 'geese', 'bat'], migrant: 'vgeese', light: 'moth', carrion: 'crow', trees: [1, 2, 3, 4, 6] },
  savanna: { kinds: ['herd', 'vulture'], glows: ['eyes'], light: 'moth', carrion: 'vulture', trees: [1, 2, 5, 6] },
  swamp: { kinds: ['heron', 'frog'], glows: ['firefly'], light: 'moth', carrion: 'crow', trees: [1, 4, 6] },
  polar: { kinds: ['hare', 'snowbird', 'snowyowl', 'arcticfox'], light: 'moth', carrion: 'raven', trees: [3], perch: [1, 3, 5] },
  desert: { kinds: ['lizard', 'hawk', 'duskbat'], light: 'moth', carrion: 'vulture', trees: [] },
  volcanic: { kinds: ['beetle', 'crow1', 'embermoth'], light: 'embermoth', carrion: 'crow', trees: [], dead: [1] },
  alien: { kinds: ['floater'], light: 'mote', carrion: 'floater', trees: [] },
  hollow: { kinds: ['crawler'], glows: ['glowworm'], trees: [] },
};
const FAUNA_GLOW = { firefly: '#d4ff6a', eyes: '#d8ff8a', glowworm: '#7fe8ff', moth: '#fff0d0', embermoth: '#ff8a30', mote: '#e6a0ff' };
/** How far (tiles) each kind of effect in S.fx is heard: gunfire, blasts, fire. */
const FAUNA_FEAR = { muzzle: 7, flash: 10, boom: 10, nuke: 40, fuelblast: 14, flak: 8, pulsebeam: 7, flame: 6, arc: 5, collapse: 9, quake: 9 };

const FAUNA = {
  of: null, cells: new Map(), spook: new Map(), list: [], fear: [], carrion: [], prints: [], lights: [], scatter: new Map(),
  seen: new WeakSet(), t: 0, L: 0, n: 0, shade: new Map(), shadeKey: '', next: 0, murAt: 0, lightAt: 0, veeAt: 0,
  mur: { on: false, danger: [], packs: [], dread: false, night: false, lull: false, came: false },
};

/* ------------------------------------------------------------------ for js/audio.js */

/** How hushed the day's birdsong is (0 to 1): from FAUNA_DREAD seconds before a Murmur night (the game's clock) to dawn. */
function faunaHush() {
  if (!faunaSongs()) return 0;
  if (murmurNight(S.time)) return 1;
  const x = dayClock(S.time), from = NIGHT_FROM - FAUNA_DREAD;
  return x >= from && x < NIGHT_FROM ? clamp((x - from) / 12, 0, 1) : 0;
}
/** The dawn chorus after a Murmur night (0 to 1): the birds coming back, for about fifty seconds from dawn. */
function faunaChorus() {
  if (!faunaSongs() || S.time < NIGHT_TO) return 0;
  const d = (dayClock(S.time) - NIGHT_TO + TOD_LEN) % TOD_LEN;
  return d < 50 ? 1 - d / 50 : 0;
}
function faunaSongs() {
  return !!(S && S.wildlife && FAUNA_SONG[biome()] && typeof murmurNight === 'function' && !alwaysNightMap());
}

/**
 * A flock lifting near the camera: a soft flutter of wings, panned to where it is, through the land's own bus
 * (AUDIO.natureBus) and well under the ambience; louder zoomed in, a bigger flock a little more.
 */
function faunaFlutter(x, y, n) {
  if (typeof sfxReady !== 'function' || !sfxReady() || !AUDIO.natureBus || FAUNA.t - (FAUNA.flutAt || -9) < 1.2) return;
  const p = worldToScreen(x, y);
  if (p.x < -20 || p.y < -20 || p.x > R.w + 20 || p.y > R.h + 20) return;
  FAUNA.flutAt = FAUNA.t;
  const ac = AUDIO.ctx, g = ac.createGain();
  g.gain.value = 0.7 * zoomLoud() * Math.min(1, 0.45 + n / 12);
  if (ac.createStereoPanner) { const pan = ac.createStereoPanner(); pan.pan.value = clamp((p.x / R.w) * 2 - 1, -0.8, 0.8); g.connect(pan).connect(AUDIO.natureBus); } else g.connect(AUDIO.natureBus);
  setTimeout(() => { try { g.disconnect(); } catch (e) { /* gone */ } }, 3000);
  const N = 6 + Math.min(10, n);
  for (let k = 0; k < N; k++) _noise(0.07, 0.022 * (1 - (0.6 * k) / N), { type: 'bandpass', freq: 650 + Math.random() * 900, q: 1.3, attack: 0.008, delay: k * 0.055 + Math.random() * 0.035, dest: g });
}

/** Geese passing over: a few far-off honks (as faunaFlutter, through the land's bus). */
function faunaHonk(x, y) {
  if (typeof sfxReady !== 'function' || !sfxReady() || !AUDIO.natureBus) return;
  const p = worldToScreen(x, y), ac = AUDIO.ctx, g = ac.createGain();
  g.gain.value = 0.5 * Math.max(0.3, zoomLoud());
  if (ac.createStereoPanner) { const pan = ac.createStereoPanner(); pan.pan.value = clamp((p.x / Math.max(1, R.w)) * 2 - 1, -0.8, 0.8); g.connect(pan).connect(AUDIO.natureBus); } else g.connect(AUDIO.natureBus);
  setTimeout(() => { try { g.disconnect(); } catch (e) { /* gone */ } }, 5000);
  for (let k = 0, n = 3 + Math.floor(Math.random() * 3); k < n; k++) {
    const f = 300 + Math.random() * 60, d = k * (0.35 + Math.random() * 0.3);
    _tone(f, 0.16, 'triangle', 0.012, f * 0.86, d, g); _tone(f * 2, 0.12, 'sine', 0.004, f * 1.7, d + 0.01, g);
  }
}

/* ------------------------------------------------------------------ the map, read in cells */

function faunaReset() {
  const F = FAUNA;
  F.of = S; F.cells.clear(); F.spook.clear(); F.list.length = 0; F.fear.length = 0; F.carrion.length = 0; F.prints.length = 0;
  F.lights.length = 0; F.scatter.clear(); F.seen = new WeakSet(); F.n = 0; F.veeAt = 0; F.murAt = 0; F.lightAt = 0;
  F.life = FAUNA_LIFE[biome()] || null;
  // (what's already in the effects when a game is loaded is old news)
  if (S && S.fx) for (const f of S.fx) F.seen.add(f);
}

/** Is tile t in use (a road, a building, a deposit, a plan, a rail or a pipe): nothing rests on it. */
function faunaBusy(t) { return S.road[t] || S.bAt[t] || S.res[t] || S.plan[t] || (S.rail && S.rail[t]) || (S.pipe && S.pipe[t]); }
/** Is (i, j) water an animal could stand or swim in (not lava, not the ashlands' lakes, which are lava too)? */
function faunaWet(i, j) { if (!inMap(i, j)) return false; const t = j * S.W + i; return S.terrain[t] === T_WATER && !(S.lava && S.lava[t]) && biome() !== 'volcanic'; }
function faunaNext(i, j, ter) {
  for (const [di, dj] of ARM_DIRS) { const a = i + di, b = j + dj; if (inMap(a, b) && S.terrain[b * S.W + a] === ter && (ter !== T_WATER || faunaWet(a, b))) return true; }
  return false;
}

/** What cell (ci, cj) offers: tile lists by habitat (trees, open ground, shore, shallows, rock faces, shrubs, dead trees). */
function faunaHab(ci, cj) {
  const H = { tree: [], open: [], shore: [], shallow: [], water: [], rock: [], perch: [], dead: [], edge: [] };
  const Lf = FAUNA.life || {}, W = S.W, i0 = ci * FAUNA_CELL, j0 = cj * FAUNA_CELL;
  for (let j = j0; j < Math.min(S.H, j0 + FAUNA_CELL); j++) for (let i = i0; i < Math.min(W, i0 + FAUNA_CELL); i++) {
    const t = j * W + i, ter = S.terrain[t];
    if (ter === T_WATER) {
      if (!faunaWet(i, j)) continue;
      H.water.push(t);
      if (faunaNext(i, j, T_GROUND)) H.shallow.push(t);
    } else if (ter === T_ROCK) {
      if (faunaNext(i, j, T_GROUND)) H.rock.push(t);
    } else if (ter === T_GROUND) {
      if (faunaBusy(t)) continue;
      const v = S.decor ? S.decor[t] : 0, k = v ? ((v - 1) % PLANT_KINDS) + 1 : 0;
      if (k && Lf.perch && Lf.perch.includes(k)) H.perch.push(t);
      if (k && Lf.dead && Lf.dead.includes(k)) H.dead.push(t);
      if (k && Lf.trees && Lf.trees.includes(k)) { H.tree.push(t); continue; }
      H.open.push(t);
      if (faunaNext(i, j, T_WATER)) H.shore.push(t);
      // (deer away from water: open ground by the trees)
      else if (Lf.trees && Lf.trees.length && faunaNearTree(i, j, Lf.trees)) H.edge.push(t);
    }
  }
  return H;
}
function faunaNearTree(i, j, trees) {
  for (const [di, dj] of ARM_DIRS) {
    const a = i + di, b = j + dj;
    if (!inMap(a, b)) continue;
    const v = S.decor ? S.decor[b * S.W + a] : 0;
    if (v && trees.includes(((v - 1) % PLANT_KINDS) + 1) && S.terrain[b * S.W + a] === T_GROUND) return true;
  }
  return false;
}

/** The roster of cell c: which of its biome's animals live there (from the planet's seed: the same each time it's seen). */
function faunaRoster(c) {
  const Lf = FAUNA.life, out = [];
  if (!Lf) return out;
  const seed = ((S.seed | 0) ^ 0x5a17) | 0;
  Lf.kinds.forEach((kind, ki) => {
    const K = FAUNA_KINDS[kind];
    let hab = K.hab, n = hab === 'any' ? 64 : c.hab[hab].length;
    if (n < K.min && K.alt && c.hab[K.alt].length >= K.min * 3) { hab = K.alt; n = c.hab[hab].length; } // (deer: lake shores, else forest edges)
    if (n < K.min) return;
    const groups = n >= K.min * 5 && K.mode !== 'soar' ? 2 : 1;
    for (let g = 0; g < groups; g++) {
      const h = (s) => hash2(c.key, ki * 13 + g, seed + s);
      if (h(0) < K.p * (hab === K.alt ? 0.5 : 1)) out.push({ kind, K, hab, rank: h(1), thr: h(2), a: null, back: 0, fled: false });
    }
  });
  return out;
}

function faunaCell(ci, cj) {
  const key = ci + cj * 4096;
  let c = FAUNA.cells.get(key);
  if (!c) {
    c = { key, ci, cj, x0: ci * FAUNA_CELL, y0: cj * FAUNA_CELL, hab: faunaHab(ci, cj), habAt: FAUNA.t, roster: null, keep: 0, since: -1 };
    c.roster = faunaRoster(c);
    FAUNA.cells.set(key, c);
  }
  return c;
}

/** Has cell c been quiet (no shots or blasts near it) long enough for its animals to be about? */
function faunaQuiet(c) { const s = FAUNA.spook.get(c.key); return s === undefined || S.time - s > FAUNA_QUIET || S.time < s; }

/* ------------------------------------------------------------------ what the animals sense */

/** The light on screen: 0 day, about 0.55 evening, 1 night (TOD: the display setting and photo mode's slider). */
function faunaLight() { return typeof TOD !== 'undefined' && TOD.active && TOD.state ? TOD.state.lights : 0; }

/** Is entry e's kind out at this light (each with its own threshold, so they come and go a few at a time)? */
function faunaActive(e) {
  const L = FAUNA.L, K = e.K;
  if (K.act === 'day') return L < 0.3 + 0.4 * e.thr && !FAUNA.mur.dread;
  if (K.act === 'night') return L > 0.4 + 0.45 * e.thr;
  if (K.act === 'dusk') return L > 0.25 + 0.2 * e.thr && L < 0.9;
  return true;
}

/** New shots, blasts and wrecks (S.fx, read only): they put the animals up, and wrecks draw the carrion birds. */
function faunaHear(v) {
  const F = FAUNA;
  F.fear.length = 0;
  for (const f of S.fx) {
    if (F.seen.has(f)) continue;
    F.seen.add(f);
    let r = FAUNA_FEAR[f.type] || 0;
    if (f.type === 'fire' && f.life >= 5) faunaCarrion(f.x, f.y); // (a wreck burning: a robot or a building)
    if (!r) continue;
    if (f.type === 'boom' || f.type === 'flash') r += 4 * Math.min(2, f.r || 0.6);
    if (f.x < v.x0 - r - 4 || f.x > v.x1 + r + 4 || f.y < v.y0 - r - 4 || f.y > v.y1 + r + 4) continue;
    F.fear.push({ x: f.x, y: f.y, r });
    // (the cells within reach go quiet for a while)
    const c0 = Math.floor((f.x - r) / FAUNA_CELL), c1 = Math.floor((f.x + r) / FAUNA_CELL), d0 = Math.floor((f.y - r) / FAUNA_CELL), d1 = Math.floor((f.y + r) / FAUNA_CELL);
    for (let cj = d0; cj <= d1; cj++) for (let ci = c0; ci <= c1; ci++) {
      const cx = clamp(f.x, ci * FAUNA_CELL, (ci + 1) * FAUNA_CELL), cy = clamp(f.y, cj * FAUNA_CELL, (cj + 1) * FAUNA_CELL);
      if (dist2(cx, cy, f.x, f.y) < r * r * 0.6) F.spook.set(ci + cj * 4096, S.time);
    }
  }
}

/** A new wreck at (x, y): carrion birds (or, over the Bloom, floaters) come and circle it for a minute or two. */
function faunaCarrion(x, y) {
  const F = FAUNA;
  if (!F.life || !F.life.carrion) return;
  for (const s of F.carrion) if (dist2(s.x, s.y, x, y) < 16) { s.until = Math.max(s.until, S.time + 70); return; }
  if (F.carrion.length > 12) F.carrion.shift();
  F.carrion.push({ x, y, at: S.time + 8 + Math.random() * 14, until: S.time + 70 + Math.random() * 60, a: null });
}

/** The Murmur, read only: are they coming (dread: FAUNA_DREAD seconds before their night), up, or in the lull of a surge? */
function faunaMurmur(v) {
  const M = FAUNA.mur;
  M.on = !!(S.wildlife && typeof murmurNight === 'function');
  M.danger.length = 0; M.packs.length = 0;
  M.dread = M.night = M.lull = false;
  if (!M.on) return;
  const always = alwaysNightMap(), x = dayClock(S.time);
  M.night = murmurNight(S.time);
  M.lull = always && murmurLull(S.time);
  M.dread = !always && (M.night || (x >= NIGHT_FROM - FAUNA_DREAD && x < NIGHT_FROM));
  if (M.night) M.came = true;
  const m = 24;
  for (const b of S.buildings) {
    if (b.dead || !(isNestB(b) || b.type === 'burrow')) continue;
    if (b.x > v.x0 - m && b.x < v.x1 + m && b.y > v.y0 - m && b.y < v.y1 + m) M.danger.push({ x: b.x + 0.5, y: b.y + 0.5 });
  }
  if (M.night || M.lull) for (const u of S.bots) {
    if (u.dead || u.inside || !BOTS[u.type].wild) continue;
    if (u.x > v.x0 - 12 && u.x < v.x1 + 12 && u.y > v.y0 - 12 && u.y < v.y1 + 12) M.packs.push({ x: u.x, y: u.y });
  }
}
/** The nearest of list (danger spots or packs) within r tiles of (x, y), or null. */
function faunaNearest(list, x, y, r) {
  let best = null, bd = r * r;
  for (const p of list) { const d = dist2(p.x, p.y, x, y); if (d < bd) { bd = d; best = p; } }
  return best;
}

/** The robots round the view (where the animals step aside from them): positions, and whether they're warbots. */
function faunaBots(v) {
  const out = FAUNA.bots || (FAUNA.bots = []);
  out.length = 0;
  for (const u of S.bots) {
    if (u.dead || u.inside || u.ride >= 0 || (BOTS[u.type].air && u.flight)) continue;
    if (u.x < v.x0 - 3 || u.x > v.x1 + 3 || u.y < v.y0 - 3 || u.y > v.y1 + 3) continue;
    out.push(u);
  }
  return out;
}

/* ------------------------------------------------------------------ the frame */

/** Once a frame (from faunaGround): bring the cells round the view up to date, spawn, move and retire the animals. */
function faunaFrame(z, v0, v1) {
  const F = FAUNA, dt = Math.min(0.1, R.dt || 0);
  if (F.of !== S || F.biome !== biome()) { faunaReset(); F.biome = biome(); }
  F.k = FAUNA_STEP[typeof gfxStep === 'function' ? gfxStep() : 'auto'] ?? 1;
  if (!F.k || !F.life) { if (F.list.length || !F.off) { faunaReset(); F.off = true; } return false; }
  if (F.off) { F.off = false; faunaReset(); }
  F.t += dt; F.z = z; F.dt = dt; F.frame = (F.frame || 0) + 1;
  F.L = faunaLight();
  const v = F.v = { x0: v0.x, y0: v0.y, x1: v1.x, y1: v1.y };
  // The weather: storms keep the birds down; rain puts the fireflies out; an aurora lights the floaters.
  F.storm = 0; F.rain = 0; F.aurora = 0;
  const W = weatherOn() && typeof weatherAt === 'function' ? weatherAt(S.time) : null;
  if (W) { if (['rain', 'snow', 'sand', 'leaves', 'dust'].includes(W.kind)) F.storm = W.k; if (W.kind === 'rain') F.rain = W.k; if (W.kind === 'aurora') F.aurora = W.k; }
  if (S.event && S.event.type === 'dust') F.storm = 1;
  faunaHear(v);
  if (F.t >= F.murAt) { F.murAt = F.t + 0.5; faunaMurmur(v); }
  // The cells round the view (kept), and those on screen (where animals appear).
  const m = 2, c0 = Math.max(0, Math.floor((v.x0 - m) / FAUNA_CELL)), c1 = Math.min(Math.ceil(S.W / FAUNA_CELL) - 1, Math.floor((v.x1 + m) / FAUNA_CELL));
  const d0 = Math.max(0, Math.floor((v.y0 - m) / FAUNA_CELL)), d1 = Math.min(Math.ceil(S.H / FAUNA_CELL) - 1, Math.floor((v.y1 + m) / FAUNA_CELL));
  const spawn = F.t >= F.next;
  if (spawn) F.next = F.t + 0.3;
  for (let cj = d0; cj <= d1; cj++) for (let ci = c0; ci <= c1; ci++) {
    const c = faunaCell(ci, cj);
    c.keep = F.t;
    const shown = c.x0 + FAUNA_CELL > v.x0 && c.x0 < v.x1 && c.y0 + FAUNA_CELL > v.y0 && c.y0 < v.y1;
    if (!shown) { c.since = -1; continue; }
    if (c.since < 0) c.since = F.t;
    if (spawn) {
      if (F.t - c.habAt > 6) { c.hab = faunaHab(ci, cj); c.habAt = F.t; } // (the colony builds over the land: looked at again now and then)
      for (const e of c.roster) if (!e.a) faunaTrySpawn(c, e);
    }
  }
  // Cells left behind go, with their animals.
  for (const [key, c] of F.cells) if (F.t - c.keep > 2) { for (const e of c.roster) if (e.a) e.a.done = true; F.cells.delete(key); }
  faunaCarrionTick();
  if (F.life.migrant) faunaMigrants();
  // Move everything.
  const bots = faunaBots(v);
  F.n = 0;
  for (const a of F.list) {
    if (a.done) continue;
    faunaReact(a);
    FAUNA_MODES[a.K.mode].tick(a, dt, bots);
    if (a.out) a.vis -= dt * 1.2;
    if (a.vis <= 0 && (a.out || a.st === 'leave' || a.st === 'flee')) a.done = true;
    // (gone far off the view, or too far out to be seen at this zoom)
    const p = a.m[0];
    if (p && (p.x < v.x0 - 14 || p.x > v.x1 + 14 || p.y < v.y0 - 14 || p.y > v.y1 + 14) && (a.st === 'flee' || a.st === 'leave' || a.cell === null)) a.done = true;
    if (z < a.K.z * 0.8) { a.done = true; a.zoom = true; }
    if (!a.done) F.n += a.m.length;
  }
  let w = 0;
  for (const a of F.list) {
    if (a.done) {
      // (chased off: it comes back once it's quiet, from off the view; bedded down: not for a while)
      if (a.e) { a.e.a = null; if (a.st === 'flee') a.e.fled = true; if (!a.zoom && (a.out || a.st !== 'live')) a.e.back = Math.max(a.e.back, S.time + (a.st === 'flee' ? 6 : 15)); }
      continue;
    }
    F.list[w++] = a;
  }
  F.list.length = w;
  // Tracks in the snow fade.
  if (F.prints.length && F.prints[0].t < F.t - 50) { let k = 0; while (k < F.prints.length && F.prints[k].t < F.t - 50) k++; F.prints.splice(0, k); }
  if (F.L > 0.3 && F.t >= F.lightAt) { F.lightAt = F.t + 0.5; faunaLights(v0, v1); }
  return true;
}

/** Bring roster entry e of cell c out, if its kind is about now and there's room. */
function faunaTrySpawn(c, e) {
  const F = FAUNA, K = e.K, M = F.mur;
  if (e.back - S.time > 60) e.back = 0; // (the clock went back: a save loaded in its place)
  if (F.z < K.z || e.back > S.time || !faunaActive(e) || e.rank > Math.min(1, 0.8 * F.k) || F.n >= faunaCap()) return;
  if (!faunaQuiet(c)) return;
  if ((K.mode === 'soar' || K.mode === 'flit' || K.mode === 'vee') && F.storm > 0.35) return;
  const cx = c.x0 + FAUNA_CELL / 2, cy = c.y0 + FAUNA_CELL / 2;
  if (M.on && (M.night || M.lull) && (faunaNearest(M.danger, cx, cy, 12) || faunaNearest(M.packs, cx, cy, 9))) return;
  if (M.lull && K.mode === 'small') return;
  // How it appears: in a cell just come on screen it was there all along; otherwise it wakes where it sleeps, or (chased
  // off, or back after a Murmur night) comes in from off the view.
  const how = F.t - c.since < 1 ? 'place' : e.fled || (M.came && K.act === 'day') ? 'arrive' : 'wake';
  const n = Math.round(K.n[0] + (K.n[1] - K.n[0]) * hash2(c.key, e.rank * 1000 | 0, 7) * (F.k > 1 ? 1 : 0.85));
  const a = { K, kind: e.kind, e, cell: c, hab: e.hab, m: [], st: 'live', t: 0, vis: how === 'wake' ? 0 : 1, out: false, done: false };
  if (!FAUNA_MODES[K.mode].make(a, c, how, Math.max(1, n))) { e.back = S.time + 20; return; }
  e.a = a; e.fled = false;
  F.list.push(a);
  F.n += a.m.length;
}

/** How many animals at most, now: FAUNA_CAP at Auto (FAUNA_STEP), fewer zoomed right out, where they're specks. */
function faunaCap() { return FAUNA_CAP * FAUNA.k * clamp(FAUNA.z / 36, 0.55, 1); }

/** Fear, the Murmur and the light: whether animal a stays, beds down, or runs. */
function faunaReact(a) {
  const F = FAUNA, M = F.mur, K = a.K;
  if (a.st === 'flee' || a.out) return;
  const p = a.m[0];
  if (!p) return;
  // Shots and blasts within its reach (the scavengers don't mind them).
  if (!K.bold) for (const f of F.fear) if (dist2(p.x, p.y, f.x, f.y) < f.r * f.r) { faunaFlee(a, f.x, f.y); return; }
  if (M.on) {
    // Before a Murmur night, the animals near a nest or a tunnel exit leave first; at night they run from the packs.
    if (M.dread && K.act === 'day') {
      const d = faunaNearest(M.danger, p.x, p.y, 18);
      if (d) { if (a.dreadAt === undefined) a.dreadAt = F.t + Math.random() * 6; if (F.t >= a.dreadAt) faunaFlee(a, d.x, d.y); return; } // (a few at a time)
    }
    const pk = (M.night || M.lull) && faunaNearest(M.packs, p.x, p.y, 6);
    if (pk) { faunaFlee(a, pk.x, pk.y); return; }
    if (M.lull && K.mode === 'small') { a.out = true; return; }
  }
  if (a.e && !faunaActive(a.e)) faunaLeave(a);
  else if ((K.mode === 'soar' || K.mode === 'flit') && F.storm > 0.5) faunaLeave(a);
}

/** Animal a runs (or flies, or hides) from (sx, sy). */
function faunaFlee(a, sx, sy) {
  a.st = 'flee';
  const mode = FAUNA_MODES[a.K.mode];
  if (mode.flee) mode.flee(a, sx, sy); else a.out = true;
}
/** Animal a beds down for the night (or the day): it goes to cover and out of sight. */
function faunaLeave(a) {
  if (a.st === 'leave') return;
  a.st = 'leave';
  const mode = FAUNA_MODES[a.K.mode];
  if (mode.leave) mode.leave(a); else a.out = true;
}

/* ------------------------------------------------------------------ moving */

function faunaWrap(a) { a %= Math.PI * 2; return a > Math.PI ? a - Math.PI * 2 : a < -Math.PI ? a + Math.PI * 2 : a; }
function faunaTurn(m, ang, dt, rate) { m.f += faunaWrap(ang - m.f) * Math.min(1, dt * (rate || 8)); }
/** A random tile from list (near (x, y) within r tiles when given), as its centre: { x, y, t }, or null. */
function faunaPick(list, x, y, r) {
  if (!list || !list.length) return null;
  for (let k = 0; k < 8; k++) {
    const t = list[Math.floor(Math.random() * list.length)], i = t % S.W, j = (t / S.W) | 0;
    if (x === undefined || dist2(i + 0.5, j + 0.5, x, y) <= r * r) return { x: i + 0.5, y: j + 0.5, t };
  }
  return x === undefined ? null : faunaPick(list);
}
/** Can a walker stand at (x, y): open ground, no building (roads are crossed, never rested on). */
function faunaStand(x, y, rest) {
  const i = Math.floor(x), j = Math.floor(y);
  if (!inMap(i, j)) return false;
  const t = j * S.W + i;
  if (S.terrain[t] !== T_GROUND || S.bAt[t]) return false;
  return !rest || !faunaBusy(t);
}
/** Can a walker go straight from (x0, y0) to (x1, y1): open ground all the way, no climbing a cliff (but by a ramp)? */
function faunaPath(x0, y0, x1, y1, swim) {
  const d = Math.hypot(x1 - x0, y1 - y0), n = Math.max(1, Math.ceil(d / 0.4));
  let pe = -1;
  for (let k = 0; k <= n; k++) {
    const x = x0 + ((x1 - x0) * k) / n, y = y0 + ((y1 - y0) * k) / n, i = Math.floor(x), j = Math.floor(y);
    if (!inMap(i, j)) return false;
    const t = j * S.W + i;
    if (swim) { if (!faunaWet(i, j)) return false; continue; }
    if (S.terrain[t] !== T_GROUND || S.bAt[t]) return false;
    if (pe >= 0 && S.elev[t] !== pe && !S.ramp[t]) return false;
    pe = S.elev[t];
  }
  return true;
}
/** Somewhere to run to from (x, y), away from (sx, sy), about d tiles: the straightest way that's open, or null. */
function faunaAway(x, y, sx, sy, d, swim) {
  const a0 = Math.atan2(y - sy, x - sx) + (Math.random() - 0.5) * 0.4;
  for (const dd of [d, d * 0.6, d * 0.35]) for (const off of [0, 0.45, -0.45, 0.9, -0.9, 1.35, -1.35]) {
    const tx = x + Math.cos(a0 + off) * dd, ty = y + Math.sin(a0 + off) * dd;
    if (faunaPath(x, y, tx, ty, swim)) return { x: tx, y: ty };
  }
  return null;
}
/** Move member m toward (m.tx, m.ty) at m.sp tiles a second, turning to face the way; true once there. */
function faunaMove(m, dt, rate) {
  const dx = m.tx - m.x, dy = m.ty - m.y, d = Math.hypot(dx, dy);
  if (d < 0.004) { m.x = m.tx; m.y = m.ty; return true; }
  const s = Math.min(d, m.sp * dt);
  m.x += (dx / d) * s; m.y += (dy / d) * s;
  faunaTurn(m, Math.atan2(dy, dx), dt, rate || 10);
  return s >= d - 1e-6;
}
/** Set member m flying to (tx, ty) at about sp tiles a second, cruising at `cruise` tiles up. */
function faunaFly(m, tx, ty, sp, cruise) {
  m.sx = m.x; m.sy = m.y; m.tx = tx; m.ty = ty; m.D = Math.max(0.01, Math.hypot(tx - m.x, ty - m.y));
  m.sp = sp * (0.85 + Math.random() * 0.3); m.fly = 1; m.cruise = cruise;
}
/** A flying member's step: along its way, rising to cruise and coming down at the end; false once landed. */
function faunaFlyStep(m, dt) {
  if (m.wait > 0) { m.wait -= dt; return true; }
  const there = faunaMove(m, dt, 6);
  const d = Math.hypot(m.tx - m.x, m.ty - m.y), p = clamp(1 - d / m.D, 0, 1);
  m.h = Math.min(m.cruise, m.D * 1.6 * p * (1 - p) + (m.lift || 0) * (1 - p));
  m.ph += dt * (m.h > 0.6 ? 14 : 20);
  if (there) { m.fly = 0; m.h = 0; m.lift = 0; return false; }
  return true;
}
/** Somewhere off the view, about d tiles from (x, y) on the side away from (sx, sy) (or any side). */
function faunaOff(x, y, sx, sy, d) {
  const v = FAUNA.v, a = sx === undefined ? Math.random() * Math.PI * 2 : Math.atan2(y - sy, x - sx) + (Math.random() - 0.5) * 0.6;
  let tx = x + Math.cos(a) * d, ty = y + Math.sin(a) * d;
  // (pushed on until it's off the screen)
  for (let k = 0; k < 6 && tx > v.x0 - 2 && tx < v.x1 + 2 && ty > v.y0 - 2 && ty < v.y1 + 2; k++) { tx += Math.cos(a) * 6; ty += Math.sin(a) * 6; }
  return { x: tx, y: ty };
}
/** The animals near (x, y) shy from a robot within r tiles: the nearest such, or null. */
function faunaBotNear(bots, x, y, r) {
  let best = null, bd = r * r;
  for (const u of bots) { const d = dist2(u.x, u.y, x, y); if (d < bd) { bd = d; best = u; } }
  return best;
}
function faunaMember(x, y) { return { x, y, h: 0, f: Math.random() * Math.PI * 2, ph: Math.random() * 10, tx: x, ty: y, sp: 0, t: Math.random() * 4, fly: 0, wait: 0 }; }
/** A spot near (x, y) within r tiles where a walker can stand (and rest), or (x, y) itself. */
function faunaNearSpot(x, y, r, hab) {
  for (let k = 0; k < 10; k++) {
    const tx = x + (Math.random() * 2 - 1) * r, ty = y + (Math.random() * 2 - 1) * r;
    if (hab ? faunaInHab(tx, ty, hab) : faunaStand(tx, ty, true)) return { x: tx, y: ty };
  }
  return { x, y };
}
/** Is (x, y) in one of the given habitat tiles (a Set of tile indices)? */
function faunaInHab(x, y, set) { const i = Math.floor(x), j = Math.floor(y); return inMap(i, j) && set.has(j * S.W + i); }
/** A point well inside tile t (its middle, nudged at random within m of it). */
function faunaIn(t, m) { return { x: (t % S.W) + 0.5 + (Math.random() - 0.5) * 2 * m, y: ((t / S.W) | 0) + 0.5 + (Math.random() - 0.5) * 2 * m }; }

/* ------------------------------------------------------------------ the ways of life */

const FAUNA_MODES = {
  /* Small birds in a flock: perched in a stand of trees (or hopping in the snow), hopping now and then, the whole flock
   * moving to another stand every half a minute or so; up and away at a shot. */
  flock: {
    make(a, c, how, n) {
      const list = c.hab[a.hab].concat(a.K.forage ? c.hab[a.K.forage] : []);
      const first = faunaPick(c.hab[a.hab]);
      if (!first) return false;
      a.spots = FAUNA_MODES.flock.stand(list, first.x, first.y);
      const off = how === 'arrive' ? faunaOff(first.x, first.y, undefined, undefined, 12) : null;
      for (let k = 0; k < n; k++) {
        const p = FAUNA_MODES.flock.perch(a);
        const m = faunaMember(p.x, p.y);
        if (off) { m.x = off.x + (Math.random() - 0.5) * 1.2; m.y = off.y + (Math.random() - 0.5) * 1.2; faunaFly(m, p.x, p.y, 2.6, 1.3); m.lift = 1; }
        a.m.push(m);
      }
      a.t = 10 + Math.random() * 20;
      return true;
    },
    /** A few tiles of list near (x, y): where the flock sits. */
    stand(list, x, y) {
      const near = list.filter((t) => dist2((t % S.W) + 0.5, ((t / S.W) | 0) + 0.5, x, y) < 7);
      return near.length ? near : list.slice(0, 1);
    },
    perch(a) { const t = a.spots[Math.floor(Math.random() * a.spots.length)]; return faunaIn(t, 0.3); },
    tick(a, dt, bots) {
      const F = FAUNA;
      let flying = 0;
      for (const m of a.m) {
        if (m.fly) { if (faunaFlyStep(m, dt)) flying++; continue; }
        if (a.st === 'leave') continue;
        m.t -= dt;
        // A hop to another perch (more often on the ground), or a peck and a look round.
        if (m.t <= 0) {
          m.t = (a.K.ground ? 1.2 : 2) + Math.random() * 4;
          if (Math.random() < 0.55 && !(F.storm > 0.35)) { const p = FAUNA_MODES.flock.perch(a); faunaFly(m, p.x, p.y, 1.4, 0.35); }
          else m.f += (Math.random() - 0.5) * 2.4;
        }
        // (a robot coming by a flock on the ground: it lifts and settles again a little way off)
        if (a.K.ground && (F.frame + a.m.indexOf(m)) % 4 === 0 && faunaBotNear(bots, m.x, m.y, 1.2)) { const p = FAUNA_MODES.flock.perch(a); faunaFly(m, p.x, p.y, 2.2, 0.6); }
      }
      if (a.st === 'flee') { if (!flying) a.out = true; a.vis -= flying ? 0 : dt; return; }
      if (a.st === 'leave') { if (!flying) a.vis -= dt * 0.5; return; }
      a.vis = Math.min(1, a.vis + dt * 0.5);
      // Now and then the flock moves on: to another stand of trees in its cell.
      a.t -= dt;
      if (a.t <= 0 && !flying) {
        a.t = 12 + Math.random() * 25;
        if (F.storm > 0.35 || !a.cell) return;
        const list = a.cell.hab[a.hab].concat(a.K.forage ? a.cell.hab[a.K.forage] : []), to = faunaPick(a.cell.hab[a.hab]);
        if (!to) { faunaLeave(a); return; }
        a.spots = FAUNA_MODES.flock.stand(list, to.x, to.y);
        for (const m of a.m) { const p = FAUNA_MODES.flock.perch(a); faunaFly(m, p.x, p.y, 2.3, 1.1); m.wait = Math.random() * 0.4; }
      }
    },
    flee(a, sx, sy) {
      const p = a.m[0];
      const to = faunaOff(p.x, p.y, sx, sy, 16);
      for (const m of a.m) { faunaFly(m, to.x + (Math.random() - 0.5) * 2, to.y + (Math.random() - 0.5) * 2, 4.4, 1.6); m.wait = Math.random() * 0.25; m.lift = 0.3; }
      faunaFlutter(p.x, p.y, a.m.length);
    },
    leave(a) { /* (they settle where they are and go still: out of sight as the light goes; see tick) */ },
  },

  /* Grazers and walkers: a herd (or a pair of deer, a fox, a few hares) grazing, the herd drifting to new ground now and
   * then; they step aside from robots, bolt from shots, and walk off into cover to bed down. */
  herd: {
    make(a, c, how, n) {
      const K = a.K, list = c.hab[a.hab];
      a.set = new Set(c.hab.open);
      const at = faunaPick(list);
      if (!at) return false;
      a.x = at.x; a.y = at.y;
      const from = how === 'arrive' ? FAUNA_MODES.herd.edge(a, at) : null;
      if (how !== 'place') a.vis = 0;
      for (let k = 0; k < n; k++) {
        const s = faunaNearSpot(at.x, at.y, K.spread || 1, a.set);
        const m = faunaMember(s.x, s.y);
        m.head = Math.random() < 0.5;
        if (from && faunaPath(from.x, from.y, s.x, s.y)) { m.x = from.x + (Math.random() - 0.5) * 0.6; m.y = from.y + (Math.random() - 0.5) * 0.6; m.sp = K.speed * 2; m.mv = 1; }
        a.m.push(m);
      }
      a.t = (K.roam ? 4 : 12) + Math.random() * 20;
      return true;
    },
    /** Where a herd coming back walks in from: cover (trees) nearby, or the edge of the view. */
    edge(a, at) {
      const tr = a.cell.hab.tree.length ? faunaPick(a.cell.hab.tree, at.x, at.y, 4) : null;
      if (tr) return tr;
      const o = faunaOff(at.x, at.y, undefined, undefined, 3);
      return faunaStand(o.x, o.y) ? o : null;
    },
    tick(a, dt, bots) {
      const K = a.K, F = FAUNA;
      if (a.st !== 'leave' && a.st !== 'flee') a.vis = Math.min(1, a.vis + dt * 0.6);
      else if (a.st === 'leave' && a.m.every((m) => !m.mv)) a.vis -= dt * 0.5;
      // The herd moves on to new ground now and then (a fox or a hare more often).
      a.t -= dt;
      if (a.st === 'live' && a.t <= 0 && a.cell) {
        a.t = (K.roam ? 5 : 15) + Math.random() * (K.roam ? 10 : 25);
        const to = faunaPick(a.cell.hab[a.hab].length ? a.cell.hab[a.hab] : a.cell.hab.open, a.x, a.y, K.roam ? 6 : 4);
        if (to) {
          a.x = to.x; a.y = to.y;
          for (const m of a.m) {
            const s = faunaNearSpot(to.x, to.y, K.spread || 1, a.set);
            if (faunaPath(m.x, m.y, s.x, s.y)) { m.tx = s.x; m.ty = s.y; m.sp = K.speed * (0.8 + Math.random() * 0.4); m.mv = 1; m.wait = Math.random() * 2; }
          }
        }
      }
      let k = 0;
      for (const m of a.m) {
        k++;
        if (m.wait > 0) { m.wait -= dt; continue; }
        // Stepping aside from a robot coming by (warbots on the move put the whole herd to flight).
        if (a.st !== 'flee' && (F.frame + k) % 4 === 0) {
          const u = faunaBotNear(bots, m.x, m.y, 1.5);
          if (u) {
            if (BOTS[u.type].army && u.path && a.st === 'live') { faunaFlee(a, u.x, u.y); return; }
            const s = faunaAway(m.x, m.y, u.x, u.y, 2.2);
            if (s) { m.tx = s.x; m.ty = s.y; m.sp = K.run * 0.6; m.mv = 1; m.head = true; }
          }
        }
        if (m.mv) {
          const there = faunaMove(m, dt);
          m.ph += dt * (K.hop ? 9 : 4 + m.sp * 7);
          if (K.hop) m.h = Math.abs(Math.sin(m.ph)) * Math.min(0.12, m.sp * 0.05);
          if (K.tracks && Math.hypot(m.x - (m.px ?? m.x + 1), m.y - (m.py ?? 0)) > 0.17) { m.px = m.x; m.py = m.y; F.prints.push({ x: m.x, y: m.y, f: m.f, s: (m.side = -(m.side || 1)), t: F.t }); if (F.prints.length > 400) F.prints.shift(); }
          if (there) { m.mv = 0; m.h = 0; m.t = 1.5 + Math.random() * 5; if (a.st === 'flee') m.alert = 3; }
          continue;
        }
        if (a.st === 'flee' || a.st === 'leave') continue;
        // Grazing: head down, head up for a look round, a step or two.
        m.t -= dt;
        if (m.alert > 0) { m.alert -= dt; m.head = true; continue; }
        if (m.t <= 0) {
          m.t = 2 + Math.random() * (K.roam ? 3 : 7);
          const r = Math.random();
          if (r < 0.4) m.head = !m.head;
          else if (r < 0.8) { const s = faunaNearSpot(a.x, a.y, K.spread || 1, a.set); if (faunaPath(m.x, m.y, s.x, s.y)) { m.tx = s.x; m.ty = s.y; m.sp = K.speed * 0.6; m.mv = 1; m.head = false; } }
          else m.f += (Math.random() - 0.5) * 1.5;
        }
      }
      if (a.st === 'flee' && a.m.every((m) => !m.mv)) {
        // (out of breath and off the screen: gone; still on it: they stand a moment, then graze where they are)
        const p = a.m[0], v = F.v;
        if (p.x < v.x0 - 1 || p.x > v.x1 + 1 || p.y < v.y0 - 1 || p.y > v.y1 + 1) a.done = true;
        else { a.st = 'live'; a.x = p.x; a.y = p.y; a.t = 20; a.set = new Set(a.cell ? a.cell.hab.open : []); }
      }
    },
    flee(a, sx, sy) {
      const p = a.m[0], to = faunaAway(p.x, p.y, sx, sy, 9);
      if (!to) { a.out = true; return; }
      for (const m of a.m) {
        const s = faunaAway(m.x, m.y, sx, sy, 9) || { x: to.x, y: to.y };
        m.tx = s.x + (Math.random() - 0.5); m.ty = s.y + (Math.random() - 0.5); m.sp = a.K.run * (0.85 + Math.random() * 0.3); m.mv = 1; m.head = true; m.wait = Math.random() * 0.3;
        if (!faunaPath(m.x, m.y, m.tx, m.ty)) { m.tx = s.x; m.ty = s.y; }
      }
    },
    leave(a) {
      // Off into the trees nearby (or just down in the grass where they stand) as the light goes.
      const p = a.m[0], tr = a.cell && a.cell.hab.tree.length ? faunaPick(a.cell.hab.tree, p.x, p.y, 4) : null;
      for (const m of a.m) {
        if (tr && faunaPath(m.x, m.y, tr.x, tr.y)) { m.tx = tr.x + (Math.random() - 0.5) * 0.5; m.ty = tr.y + (Math.random() - 0.5) * 0.5; m.sp = a.K.speed; m.mv = 1; m.wait = Math.random() * 3; }
        else m.mv = 0;
      }
    },
  },

  /* A heron in the shallows: stock still, a slow step now and then, a quick strike at a fish; it flies off at a shot. */
  wade: {
    make(a, c, how) {
      a.set = new Set(c.hab.shallow);
      const t = c.hab.shallow[Math.floor(Math.random() * c.hab.shallow.length)];
      const p = FAUNA_MODES.wade.spot(t), m = faunaMember(p.x, p.y);
      m.t = 3 + Math.random() * 10;
      if (how === 'arrive') { const o = faunaOff(p.x, p.y, undefined, undefined, 10); m.x = o.x; m.y = o.y; faunaFly(m, p.x, p.y, 1.8, 1.2); m.lift = 0.8; }
      a.m.push(m);
      return true;
    },
    /** Where a heron stands in shallow tile t: toward the bank. */
    spot(t) {
      const i = t % S.W, j = (t / S.W) | 0;
      let x = i + 0.5, y = j + 0.5;
      for (const [di, dj] of ARM_DIRS) if (inMap(i + di, j + dj) && S.terrain[(j + dj) * S.W + i + di] === T_GROUND) { x += di * 0.28; y += dj * 0.28; }
      return { x: x + (Math.random() - 0.5) * 0.2, y: y + (Math.random() - 0.5) * 0.2 };
    },
    tick(a, dt) {
      const m = a.m[0];
      if (m.fly) { faunaFlyStep(m, dt); if (!m.fly && a.st === 'flee') a.out = true; return; }
      if (a.st === 'flee') { a.out = true; return; }
      if (a.st === 'leave') { a.vis -= dt * 0.4; return; }
      a.vis = Math.min(1, a.vis + dt * 0.5);
      if (m.mv) { if (faunaMove(m, dt, 3)) { m.mv = 0; m.t = 4 + Math.random() * 12; } else if (Math.random() < dt * 1.5) m.rip = FAUNA.t; return; }
      m.t -= dt;
      if (m.t <= 0) {
        m.t = 4 + Math.random() * 12;
        if (Math.random() < 0.35) { m.strike = FAUNA.t; m.rip = FAUNA.t + 0.15; return; }
        const t = faunaPick([...a.set], m.x, m.y, 1.6);
        if (t) { const p = FAUNA_MODES.wade.spot(t.t); if (faunaPath(m.x, m.y, p.x, p.y, true) || Math.hypot(p.x - m.x, p.y - m.y) < 0.7) { m.tx = p.x; m.ty = p.y; m.sp = 0.14; m.mv = 1; m.rip = FAUNA.t; } }
      }
    },
    flee(a, sx, sy) { const m = a.m[0], o = faunaOff(m.x, m.y, sx, sy, 14); faunaFly(m, o.x, o.y, 2.2, 1.4); m.lift = 0.2; },
  },

  /* Geese on a lake: drifting slowly, a few together; up and away in a line at a shot. */
  swim: {
    make(a, c, how, n) {
      const water = c.hab.water;
      if (!water.length) return false;
      a.set = new Set(water);
      const at = faunaPick(c.hab.shallow);
      a.x = at.x; a.y = at.y;
      for (let k = 0; k < n; k++) { const s = faunaNearSpot(at.x, at.y, 0.9, a.set), m = faunaMember(s.x, s.y); m.t = Math.random() * 6; a.m.push(m); }
      if (how === 'wake') a.vis = 0;
      return true;
    },
    tick(a, dt) {
      let air = 0;
      for (const m of a.m) {
        if (m.fly) { if (faunaFlyStep(m, dt)) air++; continue; }
        if (a.st === 'flee') continue;
        if (m.mv) { m.ph += dt * 2; if (faunaMove(m, dt, 2)) { m.mv = 0; m.t = 3 + Math.random() * 8; } continue; }
        m.t -= dt;
        if (m.t <= 0 && a.st === 'live') {
          m.t = 4 + Math.random() * 8;
          const s = faunaNearSpot(a.x, a.y, 1.4, a.set);
          if (faunaPath(m.x, m.y, s.x, s.y, true)) { m.tx = s.x; m.ty = s.y; m.sp = 0.1 + Math.random() * 0.08; m.mv = 1; }
        }
      }
      if (a.st === 'flee') { if (!air) a.out = true; return; }
      if (a.st === 'leave') { a.vis -= dt * 0.4; return; }
      a.vis = Math.min(1, a.vis + dt * 0.4);
    },
    flee(a, sx, sy) {
      const p = a.m[0], o = faunaOff(p.x, p.y, sx, sy, 16);
      a.m.forEach((m, k) => { faunaFly(m, o.x + k * 0.4, o.y + k * 0.3, 2.6, 1.5); m.wait = k * 0.18; m.lift = 0.2; });
      faunaFlutter(p.x, p.y, a.m.length + 4);
    },
  },

  /* Small things on the ground: frogs at the water's edge, lizards on the rocks, beetles on the ash, crawlers in the dark;
   * still a while, then a hop, a dart or a crawl; at a shot they're gone. */
  small: {
    make(a, c, how, n) {
      const list = c.hab[a.hab];
      a.list = list;
      const at = faunaPick(list);
      if (!at) return false;
      for (let k = 0; k < n; k++) {
        const t = faunaPick(list, at.x, at.y, 2.5) || at, p = FAUNA_MODES.small.spot(a, t.t);
        const m = faunaMember(p.x, p.y);
        m.t = Math.random() * 3;
        a.m.push(m);
      }
      if (how !== 'place') a.vis = 0;
      return true;
    },
    /** Where in tile t: a lizard on a rock sits by its edge, in the sun; anything else anywhere in it. */
    spot(a, t) {
      if (a.hab !== 'rock') return faunaIn(t, 0.36);
      const i = t % S.W, j = (t / S.W) | 0;
      for (const [di, dj] of ARM_DIRS) if (inMap(i + di, j + dj) && S.terrain[(j + dj) * S.W + i + di] === T_GROUND) return { x: i + 0.5 + di * 0.3 + (Math.random() - 0.5) * (dj ? 0.6 : 0.15), y: j + 0.5 + dj * 0.3 + (Math.random() - 0.5) * (di ? 0.6 : 0.15) };
      return faunaIn(t, 0.3);
    },
    tick(a, dt, bots) {
      const K = a.K;
      if (a.st === 'flee' || a.st === 'leave') a.vis -= dt * (a.st === 'flee' ? 2 : 0.6);
      else a.vis = Math.min(1, a.vis + dt * 0.7);
      for (const m of a.m) {
        if (m.mv) {
          const there = faunaMove(m, dt, 14);
          m.ph += dt * (K.hop ? 1 / 0.32 : 14);
          if (K.hop) { m.hp = Math.min(1, (m.hp || 0) + dt / 0.32); m.h = Math.sin(m.hp * Math.PI) * 0.08; }
          if (there) { m.mv = 0; m.h = 0; m.hp = 0; m.t = (K.dart ? 1 : 2) + Math.random() * (K.dart ? 4 : 6); }
          continue;
        }
        if (a.st !== 'live') continue;
        m.t -= dt;
        const near = (FAUNA.frame + a.m.indexOf(m)) % 4 === 0 && faunaBotNear(bots, m.x, m.y, 1);
        if (m.t <= 0 || near) {
          const t = faunaPick(a.list, m.x, m.y, K.dart ? 0.9 : 0.6);
          if (!t) continue;
          const p = FAUNA_MODES.small.spot(a, t.t), d = Math.hypot(p.x - m.x, p.y - m.y);
          const go = K.dart ? Math.min(1, 0.8 / Math.max(0.01, d)) : K.hop ? Math.min(1, 0.4 / Math.max(0.01, d)) : Math.min(1, 0.45 / Math.max(0.01, d));
          m.tx = m.x + (p.x - m.x) * go; m.ty = m.y + (p.y - m.y) * go;
          m.sp = K.dart ? 2.4 : K.hop ? 1.2 : a.kind === 'crawler' ? 0.22 : 0.14; m.mv = 1; m.hp = 0;
          m.t = 1;
        } else if (Math.random() < dt * 0.4) m.f += (Math.random() - 0.5) * 1.2;
      }
    },
    flee(a, sx, sy) {
      for (const m of a.m) { const d = Math.hypot(m.x - sx, m.y - sy) || 1; m.tx = m.x + ((m.x - sx) / d) * 0.5; m.ty = m.y + ((m.y - sy) / d) * 0.5; m.sp = 2; m.mv = 1; m.hp = 0; }
    },
  },

  /* One bird in a tree: an owl by night (eyes catching the light), a crow on a dead tree by day; it shifts and looks
   * round, moves to another tree now and then, and is off at a shot. */
  perch: {
    make(a, c, how) {
      const at = faunaPick(c.hab[a.hab]);
      if (!at) return false;
      const p = faunaIn(at.t, 0.18), m = faunaMember(p.x, p.y);
      m.t = 8 + Math.random() * 30;
      if (how === 'arrive' || (how === 'wake' && a.K.act === 'night')) { const o = faunaOff(p.x, p.y, undefined, undefined, 8); m.x = o.x; m.y = o.y; faunaFly(m, p.x, p.y, 1.6, 1); m.lift = 0.6; a.vis = 1; }
      a.m.push(m);
      return true;
    },
    tick(a, dt) {
      const m = a.m[0];
      if (m.fly) { faunaFlyStep(m, dt); if (!m.fly && a.st === 'flee') a.out = true; return; }
      if (a.st === 'flee') { a.out = true; return; }
      if (a.st === 'leave') { a.vis -= dt * 0.4; return; }
      a.vis = Math.min(1, a.vis + dt * 0.5);
      m.look = Math.sin(FAUNA.t * 0.5 + m.ph) * (a.kind === 'crow1' ? 0.6 : 1.4);
      m.t -= dt;
      if (m.t <= 0 && a.cell) {
        m.t = 15 + Math.random() * 40;
        const to = faunaPick(a.cell.hab[a.hab], m.x, m.y, 5);
        if (to && !(FAUNA.storm > 0.35)) { const p = faunaIn(to.t, 0.18); faunaFly(m, p.x, p.y, 1.5, 0.9); }
        else m.flap = FAUNA.t;
      }
    },
    flee(a, sx, sy) { const m = a.m[0], o = faunaOff(m.x, m.y, sx, sy, 14); faunaFly(m, o.x, o.y, 2.8, 1.3); m.lift = 0.3; },
  },

  /* Fliers round a spot at dusk and night: bats over the trees and rocks (and hunting round the lights), ember moths
   * over the ash; they scatter at a shot. */
  flit: {
    make(a, c, how, n) {
      const at = faunaPick(c.hab[a.hab]);
      if (!at) return false;
      a.x = at.x; a.y = at.y; a.t = 8 + Math.random() * 12;
      for (let k = 0; k < n; k++) {
        const m = faunaMember(at.x, at.y);
        m.r = 0.4 + Math.random() * 1.1; m.w = (1.2 + Math.random() * 1.4) * (Math.random() < 0.5 ? -1 : 1) * (a.K.slow ? 0.6 : 1); m.a = Math.random() * 6.3; m.h = 0.6 + Math.random() * 0.6;
        a.m.push(m);
      }
      a.vis = 0;
      return true;
    },
    tick(a, dt) {
      const F = FAUNA;
      if (a.st === 'flee' || a.st === 'leave') a.vis -= dt * (a.st === 'flee' ? 1.2 : 0.5);
      else a.vis = Math.min(1, a.vis + dt * 0.5);
      a.t -= dt;
      if (a.t <= 0 && a.st === 'live' && a.cell) {
        a.t = 8 + Math.random() * 14;
        // (bats go hunting round a light near by, when there is one)
        const lt = a.kind !== 'embermoth' && F.lights.length ? F.lights[Math.floor(Math.random() * F.lights.length)] : null;
        const to = lt && dist2(lt.x, lt.y, a.x, a.y) < 64 && Math.random() < 0.5 ? lt : faunaPick(a.cell.hab[a.hab], a.x, a.y, 5);
        if (to) { a.x = to.x; a.y = to.y; }
      }
      for (const m of a.m) {
        m.a += m.w * dt * (a.st === 'flee' ? 2 : 1);
        if (a.st === 'flee') m.r += dt * 4;
        const wob = Math.sin(F.t * (a.K.slow ? 3 : 6) + m.ph) * 0.25;
        const tx = a.x + Math.cos(m.a) * (m.r + wob), ty = a.y + Math.sin(m.a) * (m.r + wob) * 0.7;
        const dx = tx - m.x, dy = ty - m.y, k = Math.min(1, dt * (a.K.slow ? 2 : 5));
        m.x += dx * k; m.y += dy * k;
        if (Math.abs(dx) + Math.abs(dy) > 0.001) faunaTurn(m, Math.atan2(dy, dx), dt, 12);
        m.ph += dt * (a.K.slow ? 22 : 30);
      }
      if (a.vis <= 0 && a.st !== 'live') a.out = true;
    },
    flee(a) { /* (they scatter outward and are gone: see tick) */ },
    leave(a) { /* (they fade into the dark: see tick) */ },
  },

  /* The Bloom's floaters: bells drifting slowly on the air, pulsing, trailing their threads; they glow after dark. */
  drift: {
    make(a, c, how, n) {
      const at = faunaPick(c.hab[a.hab]) || faunaPick(c.hab.water);
      if (!at) return false;
      a.x = at.x; a.y = at.y;
      for (let k = 0; k < n; k++) {
        const m = faunaMember(at.x + (Math.random() - 0.5) * 2, at.y + (Math.random() - 0.5) * 2);
        m.h = 0.7 + Math.random() * 0.6; m.vx = 0; m.vy = 0; m.sc = 0.8 + Math.random() * 0.45;
        a.m.push(m);
      }
      if (how !== 'place') a.vis = 0;
      return true;
    },
    tick(a, dt) {
      const F = FAUNA;
      if (a.st === 'flee' || a.st === 'leave') a.vis -= dt * 0.35;
      else a.vis = Math.min(1, a.vis + dt * 0.3);
      if (a.vis <= 0 && a.st !== 'live') a.out = true;
      // (drawn to a fresh wreck, as the Murmur are: they hang over it a while)
      const goal = a.goal;
      if (goal && S.time > goal.until && a.st === 'live') faunaLeave(a);
      for (const m of a.m) {
        const ang = Math.sin(F.t * 0.07 + m.ph) * 3 + m.ph;
        let ax = Math.cos(ang) * 0.05, ay = Math.sin(ang) * 0.05;
        const gx = goal ? goal.x : a.x, gy = goal ? goal.y : a.y, far = Math.hypot(gx - m.x, gy - m.y);
        if (far > (goal ? 1.2 : 3)) { ax += ((gx - m.x) / far) * 0.06; ay += ((gy - m.y) / far) * 0.06; }
        if (a.st === 'flee' && a.from) { const d = Math.hypot(m.x - a.from.x, m.y - a.from.y) || 1; ax += ((m.x - a.from.x) / d) * 0.2; ay += ((m.y - a.from.y) / d) * 0.2; }
        m.vx = (m.vx + ax * dt) * (1 - dt * 0.3); m.vy = (m.vy + ay * dt) * (1 - dt * 0.3);
        const sp = Math.hypot(m.vx, m.vy), most = a.st === 'flee' ? 0.6 : 0.22;
        if (sp > most) { m.vx *= most / sp; m.vy *= most / sp; }
        m.x += m.vx * dt; m.y += m.vy * dt;
        m.ph += dt;
      }
    },
    flee(a, sx, sy) { a.from = { x: sx, y: sy }; },
  },

  /* Big birds circling on the air: vultures over the Long Grass, the Rust's hawk, and carrion birds over a new wreck. */
  soar: {
    make(a, c, how, n) {
      const at = c ? (faunaPick(c.hab[a.hab]) || { x: c.x0 + 4, y: c.y0 + 4 }) : a.goal;
      a.x = at.x; a.y = at.y; a.r = a.K.size * 4 + 0.8 + Math.random() * 1.2; a.w = (0.35 + Math.random() * 0.2) * (Math.random() < 0.5 ? -1 : 1);
      a.ang = Math.random() * 6.3; a.vx = (Math.random() - 0.5) * 0.15; a.vy = (Math.random() - 0.5) * 0.15;
      for (let k = 0; k < n; k++) {
        const m = faunaMember(at.x, at.y);
        m.k = (k * Math.PI * 2) / n + Math.random() * 0.6; m.rr = a.r * (0.7 + Math.random() * 0.5); m.alt = (a.K.high || 2) * (0.85 + Math.random() * 0.3);
        const p = FAUNA_MODES.soar.orbit(a, m);
        m.x = p.x; m.y = p.y; m.h = m.alt;
        if (how !== 'place') { const o = faunaOff(p.x, p.y, undefined, undefined, 10); m.x = o.x; m.y = o.y; m.join = 1; m.wait = k * 1.2; }
        a.m.push(m);
      }
      return true;
    },
    orbit(a, m) { const t = a.ang + m.k; return { x: a.x + Math.cos(t) * m.rr, y: a.y + Math.sin(t) * m.rr * 0.85 }; },
    tick(a, dt) {
      a.ang += a.w * dt;
      if (!a.goal) { a.x += a.vx * dt; a.y += a.vy * dt; if (a.cell) { const cx = a.cell.x0 + 4, cy = a.cell.y0 + 4; a.vx += (cx - a.x) * 0.002; a.vy += (cy - a.y) * 0.002; } }
      if (a.goal && S.time > a.goal.until && a.st === 'live') faunaLeave(a);
      let near = 0;
      for (const m of a.m) {
        m.ph += dt * 2;
        if (m.wait > 0) { m.wait -= dt; continue; }
        if (a.st === 'leave' || a.st === 'flee') {
          if (!m.off) { const o = faunaOff(m.x, m.y, a.x, a.y, 12); m.off = o; }
          const dx = m.off.x - m.x, dy = m.off.y - m.y, d = Math.hypot(dx, dy) || 1;
          m.x += (dx / d) * 1.6 * dt; m.y += (dy / d) * 1.6 * dt; faunaTurn(m, Math.atan2(dy, dx), dt, 2);
          if (d > 0.5) near++;
          continue;
        }
        const p = FAUNA_MODES.soar.orbit(a, m), dx = p.x - m.x, dy = p.y - m.y, d = Math.hypot(dx, dy);
        if (m.join && d > 0.2) { const s = Math.min(d, 1.8 * dt); m.x += (dx / d) * s; m.y += (dy / d) * s; faunaTurn(m, Math.atan2(dy, dx), dt, 3); continue; }
        m.join = 0;
        m.x = p.x; m.y = p.y;
        m.f = a.ang + m.k + (a.w > 0 ? Math.PI / 2 : -Math.PI / 2);
      }
      if ((a.st === 'leave' || a.st === 'flee') && !near) a.out = true;
    },
    flee(a) { faunaLeave(a); },
    leave(a) { a.st = 'leave'; },
  },

  /* Geese crossing the map in a V, high up, now and then (Emberwood by day): not tied to any cell. */
  vee: {
    make(a, c, how, n) {
      const v = FAUNA.v, w = v.x1 - v.x0, h = v.y1 - v.y0, side = Math.random() < 0.5 ? -1 : 1;
      const y = v.y0 + h * (0.2 + Math.random() * 0.6), x = side < 0 ? v.x0 - 6 : v.x1 + 6;
      a.f = side < 0 ? (Math.random() - 0.5) * 0.5 : Math.PI + (Math.random() - 0.5) * 0.5;
      a.x = x; a.y = y; a.sp = 1.9 + Math.random() * 0.4; a.len = w + 16;
      for (let k = 0; k < n; k++) { const m = faunaMember(x, y); m.rank = Math.ceil(k / 2); m.side = k % 2 ? -1 : 1; m.h = 2.8; m.f = a.f; a.m.push(m); }
      FAUNA_MODES.vee.place(a);
      return true;
    },
    place(a) {
      const c = Math.cos(a.f), s = Math.sin(a.f);
      for (const m of a.m) {
        const back = m.rank * 0.42, out = m.rank * 0.36 * m.side + Math.sin(FAUNA.t * 0.8 + m.ph) * 0.04;
        m.x = a.x - c * back - s * out; m.y = a.y - s * back + c * out; m.f = a.f;
      }
    },
    tick(a, dt) {
      a.x += Math.cos(a.f) * a.sp * dt; a.y += Math.sin(a.f) * a.sp * dt; a.len -= a.sp * dt;
      for (const m of a.m) m.ph += dt * 7;
      FAUNA_MODES.vee.place(a);
      if (!a.honked && a.m[0].x > FAUNA.v.x0 && a.m[0].x < FAUNA.v.x1) { a.honked = true; faunaHonk(a.x, a.y); }
      if (a.len < 0) a.done = true;
    },
  },
};

/** Emberwood's geese: a V crosses over now and then, by day, in fair weather. */
function faunaMigrants() {
  const F = FAUNA, K = FAUNA_KINDS[F.life.migrant];
  if (F.t < F.veeAt) return;
  F.veeAt = F.t + 50 + Math.random() * 70;
  if (F.L > 0.45 || F.storm > 0.2 || F.mur.dread || F.z < K.z || F.list.some((a) => a.K === K)) return;
  const a = { K, kind: F.life.migrant, e: null, cell: null, m: [], st: 'live', t: 0, vis: 1, out: false, done: false };
  FAUNA_MODES.vee.make(a, null, 'arrive', Math.round(K.n[0] + Math.random() * (K.n[1] - K.n[0])));
  F.list.push(a);
}

/** The carrion birds: over each wreck on screen in daylight, a few come, circle a minute or two, and go. */
function faunaCarrionTick() {
  const F = FAUNA, v = F.v, kind = F.life.carrion;
  if (!kind) return;
  for (let k = F.carrion.length - 1; k >= 0; k--) {
    const s = F.carrion[k];
    if (S.time > s.until + 30 || S.time < s.at - 60) { F.carrion.splice(k, 1); continue; }
    if (s.a && !s.a.done) continue;
    if (s.a || S.time < s.at || S.time > s.until - 15) continue;
    if (s.x < v.x0 - 2 || s.x > v.x1 + 2 || s.y < v.y0 - 2 || s.y > v.y1 + 2) continue;
    const K = FAUNA_KINDS[kind];
    if (F.z < K.z || (kind !== 'floater' && (F.L > 0.5 || F.storm > 0.35))) continue;
    const a = { K, kind, e: null, cell: null, m: [], st: 'live', t: 0, vis: 1, out: false, done: false, goal: s };
    if (kind === 'floater') {
      const ang = Math.random() * Math.PI * 2, fx = clamp(Math.floor(s.x + Math.cos(ang) * 4), 0, S.W - 1), fy = clamp(Math.floor(s.y + Math.sin(ang) * 4), 0, S.H - 1);
      a.hab = 'open';
      FAUNA_MODES.drift.make(a, { hab: { open: [tIdx(fx, fy)], water: [] } }, 'arrive', 2);
    }
    else { FAUNA_MODES.soar.make(a, null, 'arrive', Math.round(K.n[0] + Math.random() * (K.n[1] - K.n[0]))); a.x = s.x; a.y = s.y; a.r = 1 + Math.random() * 0.6; for (const m of a.m) m.rr = a.r * (0.7 + Math.random() * 0.5); }
    s.a = a;
    F.list.push(a);
  }
}

/** The lights moths circle at night: streetlamps and the buildings' lights on screen, the Command Bases first. */
function faunaLights(v0, v1) {
  const F = FAUNA, out = F.lights;
  out.length = 0;
  if (!F.life.light) return;
  const cx = (v0.x + v1.x) / 2, cy = (v0.y + v1.y) / 2, all = [];
  for (const b of S.buildings) {
    if (b.dead || !b.built || b.owner < 0 || BDEFS[b.type].wild || BDEFS[b.type].viaduct) continue;
    if (b.x < v0.x - 1 || b.x > v1.x || b.y < v0.y - 1 || b.y > v1.y + 1) continue;
    const base = b.type === 'lander';
    all.push({ x: b.x + 0.5, y: b.y + 0.5, up: base ? 0.95 : 0.6, n: base ? 6 : 3, key: 'b' + b.id, d: dist2(b.x, b.y, cx, cy) * (base ? 0.2 : 1) });
  }
  if (S.road && typeof streetLamps === 'function') for (const l of streetLamps(v0, v1)) all.push({ x: l.x + 0.32, y: l.y, up: 0.79, n: 2, key: 'l' + l.i + ',' + l.j, d: dist2(l.x, l.y, cx, cy) * 0.6 });
  all.sort((p, q) => p.d - q.d);
  const most = Math.round(10 * F.k);
  for (let k = 0; k < all.length && out.length < most; k++) {
    const l = all[k];
    if (hash2(l.x * 7 | 0, l.y * 7 | 0, 41) < 0.35 && l.up < 0.9) continue; // (not every light draws them)
    out.push(l);
  }
}

/* ------------------------------------------------------------------ drawing */

/** A colour as the light on screen shows it (TOD's grade), a share `lift` of the way back to itself (so a night animal still reads). */
function faunaCol(hex, lift, alpha) {
  const F = FAUNA, key = hex + (lift || 0) + (alpha === undefined ? '' : alpha);
  let c = F.shade.get(key);
  if (c) return c;
  const v = parseInt(hex.slice(1), 16), rgb = [(v >> 16) & 255, (v >> 8) & 255, v & 255];
  const st = typeof TOD !== 'undefined' && TOD.active && TOD.state ? TOD.state : null;
  const out = rgb.map((x, k) => { const g = st ? clamp(x * st.mul[k] + st.add[k] * 255, 0, 255) : x; return Math.round(g + (x - g) * (lift || 0)); });
  c = alpha === undefined ? `rgb(${out.join(',')})` : `rgba(${out.join(',')},${alpha})`;
  F.shade.set(key, c);
  return c;
}
function faunaShadeFrame() {
  const F = FAUNA, st = typeof TOD !== 'undefined' && TOD.active && TOD.state ? TOD.state : null;
  const key = st ? st.mul.map((x) => x.toFixed(3)).join() + st.add.map((x) => x.toFixed(3)).join() : 'day';
  if (key !== F.shadeKey) { F.shadeKey = key; F.shade.clear(); }
}

/** The wildlife on the ground (render.js, before the buildings and robots): moves everything, then draws what stands or sits. */
function faunaGround(ctx, ox, oy, z, v0, v1) {
  if (FAUNA.broken) return;
  try { faunaGroundDraw(ctx, ox, oy, z, v0, v1); } catch (e) { faunaBroke(e); }
}
/** The wildlife went wrong: it's only scenery, so it stops (said once) rather than costing the game its frames and saves. */
function faunaBroke(e) { FAUNA.broken = true; FAUNA.list.length = 0; if (typeof console !== 'undefined') console.error('Terrafall: the wildlife stopped.', e); }
function faunaGroundDraw(ctx, ox, oy, z, v0, v1) {
  if (!S || !faunaFrame(z, v0, v1)) return;
  const F = FAUNA;
  faunaShadeFrame();
  ctx.save();
  // Tracks in the snow.
  if (F.prints.length && z >= 14) {
    ctx.fillStyle = faunaCol('#7c8aa0', 0.3);
    for (const p of F.prints) {
      const x = ox + p.x * z, y = oy + p.y * z;
      if (x < -10 || y < -10 || x > R.w + 10 || y > R.h + 10) continue;
      ctx.globalAlpha = 0.5 * (1 - (F.t - p.t) / 50);
      const c = Math.cos(p.f), s = Math.sin(p.f), o = p.s * z * 0.035;
      ctx.beginPath(); ctx.ellipse(x - s * o, y + c * o, z * 0.022, z * 0.016, p.f, 0, Math.PI * 2); ctx.fill();
    }
    ctx.globalAlpha = 1;
  }
  for (const a of F.list) {
    if (a.done || a.vis <= 0) continue;
    const D = FAUNA_DRAW[a.K.draw];
    for (const m of a.m) {
      if (m.h > 0.25 && a.K.mode !== 'herd' && a.K.mode !== 'small') continue; // (in the air: faunaAir)
      if (a.K.mode === 'soar' || a.K.mode === 'vee' || a.K.mode === 'flit' || a.K.mode === 'drift') continue;
      const x = ox + m.x * z, y = oy + m.y * z;
      if (x < -z || y < -z || x > R.w + z || y > R.h + z) continue;
      ctx.globalAlpha = clamp(a.vis, 0, 1);
      D(ctx, x, y, Math.max(2, a.K.size * z), m, a, false);
    }
  }
  ctx.restore();
}

/** The wildlife in the air (render.js, after the smoke and under the aircraft): fliers and their shadows, and the night's glows. */
function faunaAir(ctx, ox, oy, z) {
  if (FAUNA.broken) return;
  try { faunaAirDraw(ctx, ox, oy, z); } catch (e) { faunaBroke(e); }
}
function faunaAirDraw(ctx, ox, oy, z) {
  const F = FAUNA;
  if (!S || !F.k || !F.life || F.of !== S) return;
  ctx.save();
  const sun = 1 - clamp(F.L, 0, 1);
  // Shadows on the ground first, then the fliers, lowest first.
  const air = [];
  for (const a of F.list) {
    if (a.done || a.vis <= 0) continue;
    const mode = a.K.mode, flier = mode === 'soar' || mode === 'vee' || mode === 'flit' || mode === 'drift';
    for (const m of a.m) {
      if (!flier && !(m.h > 0.25 && mode !== 'herd' && mode !== 'small')) continue;
      const x = ox + m.x * z, y = oy + m.y * z, s = Math.max(2, a.K.size * z) * (1 + 0.08 * m.h);
      if (x < -3 * z || y < -3 * z || x > R.w + 3 * z || y > R.h + 3 * z) continue;
      air.push({ a, m, x, y, s });
    }
  }
  if (sun > 0.05) {
    for (const p of air) {
      if (p.a.K.mode === 'flit') continue;
      ctx.globalAlpha = clamp(p.a.vis, 0, 1) * sun * clamp(0.28 - p.m.h * 0.04, 0.12, 0.28);
      FAUNA_DRAW[p.a.K.draw](ctx, p.x + p.m.h * z * 0.55, p.y + p.m.h * z * 0.8, p.s, p.m, p.a, 'shadow');
    }
  }
  air.sort((p, q) => p.m.h - q.m.h);
  for (const p of air) { ctx.globalAlpha = clamp(p.a.vis, 0, 1); FAUNA_DRAW[p.a.K.draw](ctx, p.x, p.y, p.s, p.m, p.a, true); }
  ctx.globalAlpha = 1;
  // The night's lights: glows, eyes, moths round the lamps.
  if (F.L > 0.2 || F.life.glows && F.life.glows.includes('glowworm')) faunaGlows(ctx, ox, oy, z);
  ctx.restore();
}

/** Cell c's glow-worms: up to two on each rock face beside the floor, kept until the cell's habitat is read again. */
function faunaWorms(c) {
  if (c.worms && c.wormsAt === c.habAt) return c.worms;
  c.wormsAt = c.habAt; c.worms = [];
  for (const tt of c.hab.rock) {
    const i = tt % S.W, j = (tt / S.W) | 0, sides = ARM_DIRS.filter(([di, dj]) => inMap(i + di, j + dj) && S.terrain[(j + dj) * S.W + i + di] === T_GROUND);
    for (let k = 0; k < 2 && sides.length; k++) {
      const [di, dj] = sides[(hash2(tt, k, 78) * sides.length) | 0];
      c.worms.push({ h: hash2(tt, k, 77), x: i + 0.5 + di * 0.46 + (hash2(tt, k, 79) - 0.5) * (dj ? 0.9 : 0.1), y: j + 0.5 + dj * 0.46 + (hash2(tt, k, 80) - 0.5) * (di ? 0.9 : 0.1) - 0.12 });
    }
  }
  return c.worms;
}
/** Cell c's fireflies: where each one hovers (over the trees, the shore or open ground). */
function faunaFlies(c) {
  if (c.flies && c.fliesAt === c.habAt) return c.flies;
  c.fliesAt = c.habAt; c.flies = [];
  for (let k = 0; k < 21; k++) {
    const pool = k % 2 ? c.hab.tree : c.hab.shore.length ? c.hab.shore : c.hab.open;
    if (!pool.length) continue;
    const tt = pool[(hash2(c.key, k, 91) * pool.length) | 0];
    c.flies.push({ k, h: hash2(c.key, k, 92), x: (tt % S.W) + 0.5, y: ((tt / S.W) | 0) + 0.5 });
  }
  return c.flies;
}

/** A soft glow dot (lighter): glowSprite, the battle effects' own. */
function faunaDot(ctx, x, y, r, color, a) {
  if (!(a > 0.01) || !(r > 0.3)) return;
  ctx.globalAlpha = Math.min(1, a);
  ctx.drawImage(glowSprite(color), x - r, y - r, r * 2, r * 2);
}

/** The night's glows: fireflies, eyes in the grass, glow-worms on the cavern walls; owls' eyes; moths round the lights. */
function faunaGlows(ctx, ox, oy, z) {
  const F = FAUNA, t = F.t, M = F.mur, L = F.L;
  ctx.globalCompositeOperation = 'lighter';
  const hidden = (x, y) => (M.on && (M.night || M.lull) && faunaNearest(M.packs, x, y, 5)) || false;
  for (const c of F.cells.values()) {
    if (c.since < 0) continue;
    for (const g of F.life.glows || []) {
      if (g === 'glowworm') {
        // On the cavern walls (rock faces beside the floor): tiny blue-green points, twinkling. The lull before a surge puts
        // them out one by one; while it lasts they stay dark near the nests, the exits and the packs.
        if (z < 10) continue;
        const most = 0.42 * F.k, lull = M.lull ? (NIGHT_FROM - dayClock(S.time)) / 60 : 1;
        for (const w of faunaWorms(c)) {
          if (w.h > most) continue;
          const fade = M.lull ? clamp((lull - w.h * 0.8) * 5, 0, 1) : 1;
          if (fade <= 0) continue;
          const x = ox + w.x * z, y = oy + w.y * z;
          if (x < -5 || y < -5 || x > R.w + 5 || y > R.h + 5) continue;
          if (M.night && (faunaNearest(M.danger, w.x, w.y, 8) || faunaNearest(M.packs, w.x, w.y, 6))) continue;
          faunaDot(ctx, x, y, Math.max(1.4, z * 0.045), FAUNA_GLOW.glowworm, 0.85 * (0.55 + 0.45 * Math.sin(t * (0.6 + w.h) + w.h * 40)) * fade);
        }
        continue;
      }
      if (L < 0.45) continue;
      const night = clamp((L - 0.45) / 0.4, 0, 1);
      if (!faunaQuiet(c)) continue;
      if (g === 'firefly') {
        if (F.rain > 0.3) continue;
        const n = Math.round((biome() === 'swamp' ? 14 : 10) * Math.min(1.5, F.k));
        for (const fl of faunaFlies(c)) {
          if (fl.k >= n) continue;
          const wx = fl.x + Math.sin(t * (0.3 + 0.2 * fl.h) + fl.k) * 0.6, wy = fl.y + Math.cos(t * (0.25 + 0.2 * fl.h) + fl.k * 2) * 0.5;
          const blink = Math.max(0, Math.sin(t * (1.1 + fl.h * 1.5) + fl.h * 30));
          if (blink < 0.3 || hidden(wx, wy)) continue;
          faunaDot(ctx, ox + wx * z, oy + wy * z - z * 0.2, Math.max(3, z * 0.13), FAUNA_GLOW.firefly, 0.9 * blink * night);
        }
      } else if (g === 'eyes') {
        // Eyes in the grass: a pair here and there, catching the light, blinking, gone and somewhere else.
        const pool = c.hab.edge.length ? c.hab.edge : c.hab.open;
        if (!pool.length || z < 12) continue;
        for (let k = 0; k < Math.round(3 * Math.min(1.5, F.k)); k++) {
          const slot = Math.floor((t + hash2(c.key, k, 93) * 20) / 14), h = hash2(c.key * 31 + k, slot, 94);
          if (h < 0.4) continue;
          const tt = pool[(hash2(c.key + k, slot, 95) * pool.length) | 0], ph = ((t + hash2(c.key, k, 93) * 20) % 14) / 14;
          const on = Math.min(1, ph * 6, (1 - ph) * 4) * (Math.sin(t * 9 + k) > -0.85 ? 1 : 0);
          const ex = (tt % S.W) + 0.5 + (h - 0.5) * 0.6, ey = ((tt / S.W) | 0) + 0.5 + (hash2(tt, slot, 96) - 0.5) * 0.6;
          if (on <= 0 || hidden(ex, ey)) continue;
          const x = ox + ex * z, y = oy + ey * z, gap = z * 0.035, r = Math.max(1.3, z * 0.035);
          faunaDot(ctx, x - gap, y, r, FAUNA_GLOW.eyes, 0.9 * on * night); faunaDot(ctx, x + gap, y, r, FAUNA_GLOW.eyes, 0.9 * on * night);
        }
      }
    }
  }
  // Owls' eyes, ember moths and the floaters' glow.
  for (const a of F.list) {
    if (a.done || a.vis <= 0) continue;
    const K = a.K;
    if (K.eyes && L > 0.4) for (const m of a.m) {
      if (m.fly || Math.sin(F.t * 0.9 + m.ph * 7) < -0.95) continue; // (a blink now and then)
      // (in the face of FAUNA_DRAW.owl, turning as it looks round)
      const sz = Math.max(2, K.size * z), hx = ox + m.x * z + Math.sin(m.look || 0) * sz * 0.08, hy = oy + m.y * z - sz * 0.53, r = Math.max(1.8, z * 0.04);
      faunaDot(ctx, hx - sz * 0.06, hy, r, K.eyes, 0.9 * a.vis); faunaDot(ctx, hx + sz * 0.06, hy, r, K.eyes, 0.9 * a.vis);
    }
    if (K.glow) {
      const k = K.mode === 'drift' ? clamp(L * 1.2 + F.aurora * 0.6, 0, 1) : 1;
      if (k > 0.02) for (const m of a.m) {
        const x = ox + m.x * z, y = oy + m.y * z;
        const pulse = K.mode === 'drift' ? 0.75 + 0.25 * Math.sin(m.ph * 2.2) : 0.6 + 0.4 * Math.sin(m.ph * 0.5 + F.t * 5);
        faunaDot(ctx, x, y, z * (K.mode === 'drift' ? K.size * m.sc * 1.3 : 0.16), K.glow, (K.mode === 'drift' ? 0.55 : 1) * k * pulse * a.vis);
      }
    }
  }
  // Moths (or the biome's own) round the colony's lights.
  const kind = F.life.light, col = FAUNA_GLOW[kind];
  if (kind && L > 0.3 && z >= 12) {
    const on = clamp((L - 0.3) / 0.4, 0, 1);
    for (const l of F.lights) {
      let sc = F.scatter.get(l.key);
      // (a pack of the Murmur coming near: they scatter, and keep away a while)
      if ((sc === undefined || F.t - sc > 25) && M.on && M.night && faunaNearest(M.packs, l.x, l.y, 6)) F.scatter.set(l.key, sc = F.t);
      if (sc === undefined && F.fear.some((f) => dist2(f.x, f.y, l.x, l.y) < 25)) F.scatter.set(l.key, sc = F.t);
      const gone = sc !== undefined ? (F.t - sc) / 1.6 : -1;
      if (gone > 1 && F.t - sc < 25) continue;
      if (gone > 1) F.scatter.delete(l.key);
      const lx = ox + l.x * z, ly = oy + (l.y - l.up) * z;
      if (lx < -z || ly < -z || lx > R.w + z || ly > R.h + z) continue;
      const n = Math.round(l.n * Math.min(1.5, F.k));
      for (let k = 0; k < n; k++) {
        const h1 = hash2(l.x * 13 | 0, k, 51), h2 = hash2(l.y * 13 | 0, k, 52), h3 = hash2(k, l.x * 7 | 0, 53);
        const w = (1.4 + 2.2 * h1) * (h2 < 0.5 ? -1 : 1), th = t * w + h3 * 6.3, r = z * (0.12 + 0.24 * h2) * (1 + 0.25 * Math.sin(t * 1.7 + k));
        let x = lx + Math.cos(th) * r, y = ly + Math.sin(th) * r * 0.6 + Math.sin(t * 6 + k) * z * 0.03, a = on;
        if (gone >= 0 && gone <= 1) { x += Math.cos(th) * gone * z * 3; y += Math.sin(th) * gone * z * 2 - gone * z; a *= 1 - gone; }
        const flick = 0.6 + 0.4 * Math.abs(Math.sin(t * 30 + k * 3));
        faunaDot(ctx, x, y, Math.max(1.2, z * (kind === 'moth' ? 0.035 : 0.05)), col, 0.75 * a * flick);
      }
    }
  }
  ctx.globalCompositeOperation = 'source-over';
  ctx.globalAlpha = 1;
}

/* ------------------------------------------------------------------ the animals, drawn */

/** A filled ellipse at (x, y) turned by f, as part of the current path. */
function faunaEll(ctx, x, y, rx, ry, f) { ctx.moveTo(x + Math.cos(f) * rx, y + Math.sin(f) * rx); ctx.ellipse(x, y, rx, ry, f, 0, Math.PI * 2); }

/**
 * A bird seen from above in flight: wings out (foreshortened as they beat; held flat in a glide), body and head.
 * part: 'shadow' (the same shape in the shadow's colour), or true (the bird).
 */
function faunaWings(ctx, x, y, s, f, flap, cols, part, o) {
  const c = Math.cos(f), sn = Math.sin(f), P = (u, v) => [x + u * c - v * sn, y + u * sn + v * c];
  const glide = o && o.glide, beat = glide ? 0.96 + 0.04 * Math.sin(flap * 0.3) : 0.42 + 0.58 * Math.abs(Math.cos(flap));
  const half = s * 0.55 * beat, back = s * (0.16 + (glide ? 0.04 : 0.1 * Math.sin(flap))), chord = s * (o && o.broad ? 0.2 : 0.13);
  const shadow = part === 'shadow';
  ctx.fillStyle = shadow ? 'rgba(0,0,0,1)' : faunaCol(cols[o && o.wing ? 2 : 0], o && o.lift);
  ctx.beginPath();
  for (const side of [-1, 1]) {
    const a = P(s * 0.08, 0), tip = P(-back, side * half), mid = P(s * 0.06 - back * 0.3, side * half * 0.55), tr = P(-back * 0.6 - chord, side * half * 0.5), r = P(-s * 0.12, side * s * 0.03);
    ctx.moveTo(a[0], a[1]); ctx.quadraticCurveTo(mid[0], mid[1], tip[0], tip[1]); ctx.quadraticCurveTo(tr[0], tr[1], r[0], r[1]); ctx.closePath();
  }
  const hb = P(o && o.neck ? s * 0.34 : s * 0.2, 0);
  faunaEll(ctx, x, y, s * 0.22, s * 0.07, f);
  if (s < 10) faunaEll(ctx, hb[0], hb[1], s * 0.06, s * 0.05, f); // (small: all in one shape)
  ctx.fill();
  if (shadow || s < 10) return;
  // (the head: a goose's black neck stretched out ahead)
  ctx.fillStyle = faunaCol(o && o.neck ? cols[2] : cols[0], o && o.lift);
  ctx.beginPath();
  if (o && o.neck) { const n0 = P(s * 0.16, 0); faunaEll(ctx, (n0[0] + hb[0]) / 2, (n0[1] + hb[1]) / 2, s * 0.11, s * 0.028, f); }
  faunaEll(ctx, hb[0], hb[1], s * 0.06, s * 0.05, f);
  ctx.fill();
  if (o && o.band) { ctx.fillStyle = faunaCol(cols[1], o && o.lift); ctx.beginPath(); const l = P(-back * 0.3, -half * 0.5), rr = P(-back * 0.3, half * 0.5); faunaEll(ctx, l[0], l[1], s * 0.08, s * 0.02, f); faunaEll(ctx, rr[0], rr[1], s * 0.08, s * 0.02, f); ctx.fill(); }
}

/** Which way an animal seen side on faces: right (1) or left (-1), by its heading (it turns round only past the vertical, so it doesn't flicker). */
function faunaSide(m) { const c = Math.cos(m.f); if (c > 0.25) m.dir = 1; else if (c < -0.25) m.dir = -1; return m.dir || (m.dir = c < 0 ? -1 : 1); }
/** A soft round shadow under something on the ground. */
function faunaShadow(ctx, x, y, rx, ry) { ctx.fillStyle = 'rgba(0,0,0,0.2)'; ctx.beginPath(); ctx.ellipse(x + rx * 0.15, y + ry * 0.5, rx, ry, 0, 0, Math.PI * 2); ctx.fill(); }

const FAUNA_DRAW = {
  /** A small bird: perched (seen side on, a plump body, head, tail; breast lighter) or in flight (faunaWings). */
  bird(ctx, x, y, s, m, a, air) {
    const K = a.K, col = K.col;
    if (air) { faunaWings(ctx, x, y, s * 1.8, m.f, m.ph, col, air, { wing: true }); return; }
    const d = faunaSide(m), peck = Math.sin(FAUNA.t * 3 + m.ph * 5) > 0.7 ? 1 : 0;
    if (K.ground) faunaShadow(ctx, x, y, s * 0.3, s * 0.1);
    ctx.save(); ctx.translate(x, y); ctx.scale(d, 1);
    ctx.fillStyle = faunaCol(col[0]);
    ctx.beginPath(); faunaEll(ctx, 0, -s * 0.2, s * 0.3, s * 0.19, -0.25); ctx.moveTo(-s * 0.18, -s * 0.18); ctx.lineTo(-s * 0.52, -s * 0.02); ctx.lineTo(-s * 0.46, s * 0.04); ctx.closePath();
    faunaEll(ctx, s * 0.24, -s * (peck ? 0.22 : 0.36), s * 0.14, s * 0.13, 0);
    ctx.fill();
    ctx.fillStyle = faunaCol(K.ground ? col[2] : col[1]);
    ctx.beginPath(); faunaEll(ctx, s * 0.08, -s * 0.12, s * 0.17, s * 0.1, -0.3); ctx.fill();
    if (s > 4) {
      ctx.fillStyle = faunaCol(col[2]); ctx.beginPath();
      ctx.moveTo(s * 0.36, -s * (peck ? 0.24 : 0.38)); ctx.lineTo(s * 0.48, -s * (peck ? 0.16 : 0.34)); ctx.lineTo(s * 0.36, -s * (peck ? 0.18 : 0.32));
      if (!K.ground) faunaEll(ctx, s * 0.22, -s * (peck ? 0.27 : 0.41), s * 0.11, s * 0.06, 0);
      ctx.fill();
    }
    ctx.restore();
  },

  /** Four-footed animals, seen from the side (as the game's three-quarter view shows them): a deer, an antelope, a fox, a hare. */
  deer(ctx, x, y, s, m, a, air) { FAUNA_DRAW.beast(ctx, x, y, s, m, a, 'deer'); },
  antelope(ctx, x, y, s, m, a, air) { FAUNA_DRAW.beast(ctx, x, y, s, m, a, 'antelope'); },
  fox(ctx, x, y, s, m, a, air) { FAUNA_DRAW.beast(ctx, x, y, s, m, a, 'fox'); },
  hare(ctx, x, y, s, m, a, air) { FAUNA_DRAW.hare(ctx, x, y, s, m, a); },
  /**
   * Legs (swinging as it walks, stretched at a run), body, belly and rump, the neck up (or down to the grass as it grazes)
   * and the head with its ears; an antelope's flank stripe and horns, a fox's brush with its white tip.
   */
  beast(ctx, x, y, s, m, a, kind) {
    const K = a.K, col = K.col, lift = K.lift, d = faunaSide(m), fox = kind === 'fox';
    const legH = s * (fox ? 0.13 : kind === 'antelope' ? 0.24 : 0.27), by = -legH - s * (fox ? 0.06 : 0.09), bw = s * (fox ? 0.065 : kind === 'antelope' ? 0.12 : 0.105);
    faunaShadow(ctx, x, y, s * 0.32, s * 0.06);
    ctx.save(); ctx.translate(x, y); ctx.scale(d, 1);
    // Legs: a walk swings them in pairs; a run stretches them out fore and aft.
    const run = m.mv && m.sp > K.speed * 1.5, sw = m.mv ? Math.sin(m.ph) * s * (run ? 0.11 : 0.06) : 0;
    ctx.strokeStyle = faunaCol(fox ? col[2] : col[0], lift); ctx.lineWidth = Math.max(1, s * 0.04); ctx.lineCap = 'round';
    ctx.beginPath();
    for (const [lx, k] of [[-s * 0.2, 1], [-s * 0.14, -1], [s * 0.15, -1], [s * 0.2, 1]]) {
      const tip = run ? (lx > 0 ? s * 0.08 : -s * 0.08) * (0.6 + 0.4 * Math.sin(m.ph)) : sw * k;
      ctx.moveTo(lx, by + bw * 0.5); ctx.lineTo(lx + tip, run ? -s * 0.03 : 0);
    }
    ctx.stroke();
    // Tail behind (a fox's long brush).
    if (fox && s > 8) {
      const wag = Math.sin(m.ph * 0.5) * 0.08;
      ctx.fillStyle = faunaCol(col[0], lift); ctx.beginPath(); faunaEll(ctx, -s * 0.38, by + s * 0.03, s * 0.17, s * 0.055, 0.22 + wag); ctx.fill();
      ctx.fillStyle = faunaCol(col[1], lift); ctx.beginPath(); faunaEll(ctx, -s * 0.53, by + s * 0.07, s * 0.05, s * 0.04, 0.3); ctx.fill();
    }
    // Body, and the neck up to the head (down to the grass while it grazes).
    const up = m.head || m.mv, hx = s * (fox ? 0.3 : 0.31), hy = up ? (fox ? by - s * 0.06 : by - s * 0.24) : -s * 0.05, ha = up ? 0.25 : 1.25;
    ctx.fillStyle = faunaCol(col[0], lift);
    ctx.beginPath(); faunaEll(ctx, 0, by, s * (fox ? 0.24 : 0.27), bw, 0);
    if (!fox || !up) { ctx.moveTo(s * 0.13, by - bw * 0.6); ctx.lineTo(hx - s * 0.04, hy - s * 0.03); ctx.lineTo(hx + s * 0.02, hy + s * 0.04); ctx.lineTo(s * 0.25, by + bw * 0.3); ctx.closePath(); }
    faunaEll(ctx, hx, hy, s * (fox ? 0.075 : 0.07), s * 0.045, ha);
    if (fox) { ctx.moveTo(hx + s * 0.04, hy - s * 0.025); ctx.lineTo(hx + s * 0.15, hy + s * 0.02); ctx.lineTo(hx + s * 0.03, hy + s * 0.035); ctx.closePath(); }
    else faunaEll(ctx, hx + Math.cos(ha) * s * 0.07, hy + Math.sin(ha) * s * 0.07, s * 0.04, s * 0.03, ha);
    ctx.fill();
    // Belly and rump (a deer's white flag), an antelope's dark flank stripe, a fox's white chest.
    if (s > 11) {
      ctx.fillStyle = faunaCol(col[1], lift);
      ctx.beginPath(); faunaEll(ctx, s * 0.0, by + bw * 0.72, s * 0.13, bw * 0.26, 0);
      if (kind === 'deer') faunaEll(ctx, -s * 0.255, by - bw * 0.2, s * 0.035, bw * 0.55, 0);
      else if (fox) faunaEll(ctx, s * 0.22, by + bw * 0.2, s * 0.05, bw * 0.6, 0.4);
      ctx.fill();
      // (a deer's darker back; a wildebeest's dark mane and shoulders)
      ctx.fillStyle = faunaCol(col[2], lift, kind === 'antelope' ? 0.85 : 0.35);
      ctx.beginPath(); if (kind === 'antelope') faunaEll(ctx, s * 0.14, by - bw * 0.35, s * 0.12, bw * 0.55, -0.35); else if (!fox) faunaEll(ctx, -s * 0.02, by - bw * 0.62, s * 0.22, bw * 0.3, 0); ctx.fill();
    }
    // Ears, and an antelope's horns.
    if (s < 9) { ctx.restore(); return; }
    ctx.fillStyle = faunaCol(fox ? col[0] : col[2], lift);
    ctx.beginPath();
    if (fox) { for (const e of [0, 1]) { const ex = hx - s * (0.02 + e * 0.04); ctx.moveTo(ex - s * 0.025, hy - s * 0.03); ctx.lineTo(ex, hy - s * 0.11); ctx.lineTo(ex + s * 0.025, hy - s * 0.03); ctx.closePath(); } }
    else faunaEll(ctx, hx - s * 0.05, hy - s * 0.045, s * 0.045, s * 0.017, up ? -0.7 : 0.4);
    ctx.fill();
    if (kind === 'antelope') {
      ctx.strokeStyle = faunaCol('#2a221a', lift); ctx.lineWidth = Math.max(0.8, s * 0.022);
      ctx.beginPath(); ctx.moveTo(hx - s * 0.03, hy - s * 0.03); ctx.quadraticCurveTo(hx - s * 0.1, hy - s * 0.05, hx - s * 0.06, hy - s * 0.12); ctx.stroke();
    }
    ctx.restore();
  },
  /** A hare: hunched on its big hind legs, long ears up (laid back as it runs), a white scut; it bounds. */
  hare(ctx, x, y, s, m, a) {
    const K = a.K, col = K.col, d = faunaSide(m), hop = (m.h || 0) * FAUNA.z, run = !!m.mv;
    ctx.fillStyle = 'rgba(30,40,60,0.3)'; ctx.beginPath(); ctx.ellipse(x + s * 0.04, y, s * 0.28, s * 0.075, 0, 0, Math.PI * 2); ctx.fill();
    ctx.save(); ctx.translate(x, y - hop); ctx.scale(d, 1);
    ctx.fillStyle = faunaCol(col[0], K.lift);
    ctx.beginPath();
    faunaEll(ctx, 0, -s * 0.15, s * (run ? 0.26 : 0.21), s * 0.13, run ? 0 : -0.2);
    faunaEll(ctx, -s * 0.1, -s * 0.09, s * 0.12, s * 0.09, 0);
    faunaEll(ctx, s * 0.2, -s * (run ? 0.2 : 0.27), s * 0.085, s * 0.07, 0.2);
    faunaEll(ctx, s * (run ? 0.08 : 0.15), -s * (run ? 0.29 : 0.44), s * 0.035, s * 0.14, run ? 1.1 : -0.25);
    ctx.strokeStyle = faunaCol('#7c766c', K.lift, 0.55); ctx.lineWidth = Math.max(0.8, s * 0.025); ctx.stroke(); // (white on the snow: a fine outline)
    ctx.fill();
    ctx.fillStyle = faunaCol(col[1], K.lift); ctx.beginPath(); faunaEll(ctx, -s * 0.22, -s * 0.17, s * 0.05, s * 0.05, 0); ctx.fill();
    if (s > 6) { ctx.fillStyle = faunaCol(col[2], K.lift); ctx.beginPath(); faunaEll(ctx, s * (run ? 0.0 : 0.11), -s * (run ? 0.3 : 0.56), s * 0.02, s * 0.03, 0); ctx.fill(); }
    ctx.restore();
  },

  /** A heron standing in the shallows: rings on the water round its legs, grey body, the neck in an S (shot out to strike), dagger bill. */
  heron(ctx, x, y, s, m, a, air) {
    const K = a.K, col = K.col;
    if (air) { faunaWings(ctx, x, y, s * 1.9, m.f, m.ph * 0.55, col, air, { broad: true, neck: true }); return; }
    const F = FAUNA, d = faunaSide(m);
    if (m.rip !== undefined && F.t - m.rip < 1.6 && F.t >= m.rip) {
      const k = (F.t - m.rip) / 1.6;
      ctx.strokeStyle = faunaCol('#dfeef2', 0.2, 0.5 * (1 - k)); ctx.lineWidth = Math.max(0.6, s * 0.02);
      ctx.beginPath(); ctx.ellipse(x, y, s * (0.1 + 0.35 * k), s * (0.035 + 0.12 * k), 0, 0, Math.PI * 2); ctx.stroke();
    }
    ctx.fillStyle = faunaCol('#0c1418', 0, 0.25); ctx.beginPath(); ctx.ellipse(x, y, s * 0.12, s * 0.035, 0, 0, Math.PI * 2); ctx.fill();
    const strike = m.strike !== undefined && F.t - m.strike < 0.4 ? Math.sin(((F.t - m.strike) / 0.4) * Math.PI) : 0;
    ctx.save(); ctx.translate(x, y); ctx.scale(d, 1);
    ctx.strokeStyle = faunaCol(col[2]); ctx.lineWidth = Math.max(0.8, s * 0.022); ctx.lineCap = 'round';
    ctx.beginPath(); for (const lx of [-s * 0.02, s * 0.03]) { ctx.moveTo(lx, -s * 0.03); ctx.lineTo(lx * 1.5, -s * 0.33); } ctx.stroke();
    ctx.fillStyle = faunaCol(col[0]);
    ctx.beginPath(); faunaEll(ctx, -s * 0.02, -s * 0.4, s * 0.17, s * 0.075, -0.35); ctx.moveTo(-s * 0.14, -s * 0.37); ctx.lineTo(-s * 0.26, -s * 0.28); ctx.lineTo(-s * 0.12, -s * 0.33); ctx.fill();
    ctx.fillStyle = faunaCol(col[2], 0, 0.5); ctx.beginPath(); faunaEll(ctx, -s * 0.05, -s * 0.42, s * 0.12, s * 0.04, -0.35); ctx.fill();
    // the neck, from the shoulders in an S up to the head (shot forward and down to strike)
    const hx = s * (0.14 + 0.28 * strike), hy = -s * (0.74 - 0.42 * strike);
    ctx.strokeStyle = faunaCol(col[1]); ctx.lineWidth = Math.max(1, s * 0.045);
    ctx.beginPath(); ctx.moveTo(s * 0.11, -s * 0.46); ctx.quadraticCurveTo(s * (0.02 + 0.2 * strike), -s * (0.6 - 0.15 * strike), hx, hy); ctx.stroke();
    ctx.fillStyle = faunaCol(col[1]); ctx.beginPath(); faunaEll(ctx, hx, hy, s * 0.045, s * 0.035, 0); ctx.fill();
    ctx.strokeStyle = faunaCol('#c8a040'); ctx.lineWidth = Math.max(0.8, s * 0.022);
    ctx.beginPath(); ctx.moveTo(hx + s * 0.03, hy); ctx.lineTo(hx + s * 0.16, hy + s * (0.02 + 0.08 * strike)); ctx.stroke();
    ctx.strokeStyle = faunaCol(col[2]); ctx.lineWidth = Math.max(0.6, s * 0.015);
    ctx.beginPath(); ctx.moveTo(hx - s * 0.02, hy - s * 0.02); ctx.lineTo(hx - s * 0.12, hy - s * 0.04); ctx.stroke();
    ctx.restore();
  },

  /** A goose: on the water, side on (black neck up, white chin; a wake behind it as it paddles), or flying (neck out). */
  goose(ctx, x, y, s, m, a, air) {
    const col = a.K.col;
    if (air) { faunaWings(ctx, x, y, s * 1.6, m.f, m.ph, col, air, { neck: true, broad: true, band: true }); return; }
    const d = faunaSide(m);
    if (m.mv) {
      ctx.strokeStyle = faunaCol('#e6eef0', 0.2, 0.35); ctx.lineWidth = Math.max(0.6, s * 0.02);
      const c = Math.cos(m.f), sn = Math.sin(m.f);
      ctx.beginPath(); for (const v of [-1, 1]) { ctx.moveTo(x - c * s * 0.2, y - sn * s * 0.2); ctx.lineTo(x - c * s * 0.7 - sn * v * s * 0.25, y - sn * s * 0.7 + c * v * s * 0.25); } ctx.stroke();
    }
    ctx.strokeStyle = faunaCol('#dfeef2', 0.2, 0.35); ctx.lineWidth = Math.max(0.6, s * 0.02);
    ctx.beginPath(); ctx.ellipse(x, y, s * 0.3, s * 0.06, 0, 0, Math.PI * 2); ctx.stroke();
    ctx.save(); ctx.translate(x, y); ctx.scale(d, 1);
    const bob = Math.sin(FAUNA.t * 1.5 + m.ph) * s * 0.01;
    ctx.fillStyle = faunaCol(col[0]);
    ctx.beginPath(); ctx.ellipse(0, -s * 0.03 + bob, s * 0.27, s * 0.1, 0, Math.PI, 0); ctx.lineTo(-s * 0.34, -s * 0.12 + bob); ctx.closePath(); ctx.fill();
    ctx.fillStyle = faunaCol(col[1]); ctx.beginPath(); ctx.ellipse(-s * 0.05, -s * 0.03 + bob, s * 0.18, s * 0.03, 0, Math.PI, 0); ctx.fill();
    ctx.strokeStyle = faunaCol(col[2]); ctx.lineWidth = Math.max(1, s * 0.055); ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(s * 0.17, -s * 0.08 + bob); ctx.quadraticCurveTo(s * 0.23, -s * 0.2, s * 0.22, -s * 0.36 + bob); ctx.stroke();
    ctx.fillStyle = faunaCol(col[2]); ctx.beginPath(); faunaEll(ctx, s * 0.25, -s * 0.37 + bob, s * 0.06, s * 0.04, 0); ctx.fill();
    if (s > 5) { ctx.fillStyle = faunaCol(col[1]); ctx.beginPath(); faunaEll(ctx, s * 0.23, -s * 0.34 + bob, s * 0.025, s * 0.02, 0); ctx.fill(); }
    ctx.restore();
  },

  /** A frog: a green blob with eyes, its legs out as it hops. */
  frog(ctx, x, y, s, m, a) {
    const col = a.K.col, c = Math.cos(m.f), sn = Math.sin(m.f);
    faunaShadow(ctx, x, y, s * 0.4, s * 0.25);
    y -= (m.h || 0) * FAUNA.z;
    ctx.fillStyle = faunaCol(col[0]);
    ctx.beginPath(); faunaEll(ctx, x, y, s * 0.45, s * 0.36, m.f);
    if (m.mv) for (const v of [-1, 1]) faunaEll(ctx, x - c * s * 0.45 - sn * v * s * 0.25, y - sn * s * 0.45 + c * v * s * 0.25, s * 0.3, s * 0.08, m.f - v * 0.4);
    ctx.fill();
    ctx.fillStyle = faunaCol(col[1]); ctx.beginPath(); for (const v of [-1, 1]) faunaEll(ctx, x + c * s * 0.25 - sn * v * s * 0.17, y + sn * s * 0.25 + c * v * s * 0.17, s * 0.1, s * 0.1, 0); ctx.fill();
  },

  /** A lizard: slim body, the tail swinging as it darts, little legs splayed. */
  lizard(ctx, x, y, s, m, a) {
    const col = a.K.col, c = Math.cos(m.f), sn = Math.sin(m.f), P = (u, v) => [x + (u * c - v * sn) * s, y + (u * sn + v * c) * s];
    const sw = Math.sin(m.ph) * (m.mv ? 0.12 : 0.04);
    ctx.strokeStyle = faunaCol(col[0]); ctx.lineCap = 'round';
    ctx.lineWidth = Math.max(0.7, s * 0.07);
    ctx.beginPath(); const t0 = P(-0.15, 0), t1 = P(-0.35, sw), t2 = P(-0.62, -sw * 1.4); ctx.moveTo(t0[0], t0[1]); ctx.quadraticCurveTo(t1[0], t1[1], t2[0], t2[1]); ctx.stroke();
    ctx.lineWidth = Math.max(0.6, s * 0.05);
    ctx.beginPath(); for (const [u, v, k] of [[0.12, 1, 1], [0.12, -1, -1], [-0.1, 1, -1], [-0.1, -1, 1]]) { const p = P(u, 0), q = P(u + k * sw * 0.8 + 0.05, v * 0.16); ctx.moveTo(p[0], p[1]); ctx.lineTo(q[0], q[1]); } ctx.stroke();
    ctx.fillStyle = faunaCol(col[0]); ctx.beginPath(); faunaEll(ctx, x, y, s * 0.24, s * 0.075, m.f); const h = P(0.27, 0); faunaEll(ctx, h[0], h[1], s * 0.08, s * 0.055, m.f); ctx.fill();
    if (s > 5) { ctx.fillStyle = faunaCol(col[2], 0, 0.5); ctx.beginPath(); faunaEll(ctx, x, y, s * 0.18, s * 0.03, m.f); ctx.fill(); }
  },

  /** An ash beetle: a dark shell with a faint ember sheen. */
  beetle(ctx, x, y, s, m, a) {
    const col = a.K.col, c = Math.cos(m.f), sn = Math.sin(m.f);
    ctx.fillStyle = faunaCol(col[0]); ctx.beginPath(); faunaEll(ctx, x, y, s * 0.5, s * 0.34, m.f); faunaEll(ctx, x + c * s * 0.48, y + sn * s * 0.48, s * 0.16, s * 0.16, 0); ctx.fill();
    ctx.strokeStyle = faunaCol(col[1], 0.5, 0.7); ctx.lineWidth = Math.max(0.5, s * 0.06);
    ctx.beginPath(); ctx.moveTo(x - c * s * 0.1 - sn * s * 0.18, y - sn * s * 0.1 + c * s * 0.18); ctx.lineTo(x + c * s * 0.25 - sn * s * 0.12, y + sn * s * 0.25 + c * s * 0.12); ctx.stroke();
  },

  /** A blind cave crawler: pale segments, a ripple of legs, long feelers out ahead. */
  crawler(ctx, x, y, s, m, a) {
    const K = a.K, col = K.col, c = Math.cos(m.f), sn = Math.sin(m.f), P = (u, v) => [x + (u * c - v * sn) * s, y + (u * sn + v * c) * s];
    faunaShadow(ctx, x, y, s * 0.4, s * 0.12);
    ctx.strokeStyle = faunaCol(col[2], K.lift); ctx.lineWidth = Math.max(0.6, s * 0.03); ctx.lineCap = 'round';
    ctx.beginPath();
    for (let k = 0; k < 4; k++) for (const v of [-1, 1]) { const u = 0.2 - k * 0.14, sw = Math.sin(m.ph + k * 1.2) * (m.mv ? 0.05 : 0.01) * v; const p = P(u, 0), q = P(u + sw, v * 0.2); ctx.moveTo(p[0], p[1]); ctx.lineTo(q[0], q[1]); }
    for (const v of [-1, 1]) { const p = P(0.32, v * 0.02), q = P(0.6, v * (0.15 + 0.04 * Math.sin(FAUNA.t * 3 + m.ph))); ctx.moveTo(p[0], p[1]); ctx.lineTo(q[0], q[1]); }
    ctx.stroke();
    ctx.fillStyle = faunaCol(col[0], K.lift); ctx.beginPath();
    for (let k = 0; k < 4; k++) { const p = P(0.26 - k * 0.15, 0); faunaEll(ctx, p[0], p[1], s * 0.09, s * (0.075 - k * 0.008), m.f); }
    ctx.fill();
  },

  /** An owl on a branch, from the front: round, a pale face turning to look round, ear tufts. (Its eyes glow in faunaGlows.) */
  owl(ctx, x, y, s, m, a, air) {
    const K = a.K, col = K.col;
    if (air) { faunaWings(ctx, x, y, s * 1.7, m.f, m.ph * 0.6, col, air, { broad: true, lift: K.lift }); return; }
    const look = Math.sin(m.look || 0) * s * 0.08;
    ctx.fillStyle = faunaCol(col[0], K.lift);
    ctx.beginPath(); faunaEll(ctx, x, y - s * 0.22, s * 0.22, s * 0.3, 0); faunaEll(ctx, x + look * 0.4, y - s * 0.52, s * 0.19, s * 0.16, 0);
    for (const v of [-1, 1]) { ctx.moveTo(x + look * 0.4 + v * s * 0.1, y - s * 0.6); ctx.lineTo(x + look * 0.4 + v * s * 0.17, y - s * 0.74); ctx.lineTo(x + look * 0.4 + v * s * 0.17, y - s * 0.58); ctx.closePath(); }
    ctx.fill();
    ctx.fillStyle = faunaCol(col[1], K.lift); ctx.beginPath(); faunaEll(ctx, x + look, y - s * 0.51, s * 0.14, s * 0.1, 0); faunaEll(ctx, x, y - s * 0.16, s * 0.12, s * 0.17, 0); ctx.fill();
    if (s > 6) { ctx.fillStyle = faunaCol(col[2], K.lift); ctx.beginPath(); for (const v of [-1, 1]) faunaEll(ctx, x + look + v * s * 0.06, y - s * 0.53, s * 0.03, s * 0.03, 0); ctx.fill(); }
  },

  /** A crow on a dead tree, side on: black, tail down, a flick of the wings now and then. */
  crow(ctx, x, y, s, m, a, air) {
    const col = a.K.col;
    if (air) { faunaWings(ctx, x, y, s * 1.8, m.f, m.ph, col, air); return; }
    const d = faunaSide(m), flap = m.flap !== undefined && FAUNA.t - m.flap < 0.6, tilt = Math.sin(m.look || 0) * 0.3;
    ctx.save(); ctx.translate(x, y); ctx.scale(d, 1);
    ctx.fillStyle = faunaCol(col[0]);
    ctx.beginPath(); faunaEll(ctx, 0, -s * 0.25, s * 0.28, s * 0.15, -0.45);
    ctx.moveTo(-s * 0.16, -s * 0.16); ctx.lineTo(-s * 0.42, s * 0.06); ctx.lineTo(-s * 0.3, s * 0.08); ctx.closePath();
    faunaEll(ctx, s * 0.22, -s * 0.45, s * 0.12, s * 0.1, tilt);
    if (flap) { ctx.moveTo(-s * 0.05, -s * 0.35); ctx.lineTo(-s * 0.2, -s * 0.75); ctx.lineTo(s * 0.12, -s * 0.38); ctx.closePath(); }
    ctx.fill();
    ctx.strokeStyle = faunaCol(col[1]); ctx.lineWidth = Math.max(0.7, s * 0.06);
    ctx.beginPath(); ctx.moveTo(s * 0.3, -s * 0.46); ctx.lineTo(s * 0.46, -s * 0.42 + tilt * s * 0.2); ctx.stroke();
    ctx.restore();
  },

  /** A bat: dark jagged wings, beating fast. */
  bat(ctx, x, y, s, m, a, part) { faunaWings(ctx, x, y, s, m.f, m.ph, a.K.col, part === 'shadow' ? 'shadow' : true, { broad: true, wing: true, lift: a.K.lift }); },

  /** An ember moth: a speck of dark wing round its glow (faunaGlows). */
  moth(ctx, x, y, s, m, a, part) {
    if (part === 'shadow') return;
    const w = Math.abs(Math.sin(m.ph)) * s * 0.6 + s * 0.2;
    ctx.fillStyle = faunaCol(a.K.col[0], 0.4); ctx.beginPath(); faunaEll(ctx, x, y, s * 0.3, w, m.f); ctx.fill();
  },

  /** A floater: a translucent bell, pulsing, its threads trailing under it (lit from within after dark: faunaGlows). */
  floater(ctx, x, y, s, m, a, part) {
    const col = a.K.col, sc = m.sc || 1, pulse = 1 + 0.08 * Math.sin(m.ph * 2.2), r = s * 0.5 * sc * pulse, hy = s * 0.42 * sc / pulse;
    if (part === 'shadow') { ctx.beginPath(); ctx.ellipse(x, y, r, r * 0.5, 0, 0, Math.PI * 2); ctx.fillStyle = 'rgba(0,0,0,1)'; ctx.fill(); return; }
    const L = FAUNA.L, lit = clamp(L * 1.2 + FAUNA.aurora * 0.6, 0, 1), lift = 0.35 + 0.5 * lit;
    // the threads
    ctx.strokeStyle = faunaCol(col[1], lift, 0.45); ctx.lineWidth = Math.max(0.6, s * 0.025); ctx.lineCap = 'round';
    ctx.beginPath();
    for (let k = 0; k < 5; k++) {
      const u = (k / 4 - 0.5) * r * 1.4, sw = Math.sin(m.ph * 1.6 + k) * s * 0.08;
      ctx.moveTo(x + u, y); ctx.quadraticCurveTo(x + u + sw, y + s * 0.35 * sc, x + u - sw * 0.5, y + s * (0.7 + 0.1 * Math.sin(k)) * sc);
    }
    ctx.stroke();
    // the bell
    ctx.fillStyle = faunaCol(col[0], lift, 0.55);
    ctx.beginPath(); ctx.ellipse(x, y, r, hy, 0, Math.PI, 0); ctx.ellipse(x, y, r, r * 0.22, 0, 0, Math.PI); ctx.fill();
    ctx.fillStyle = faunaCol(col[1], lift, 0.5);
    ctx.beginPath(); ctx.ellipse(x - r * 0.2, y - hy * 0.55, r * 0.35, hy * 0.25, -0.3, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = faunaCol(col[2], lift, 0.5); ctx.lineWidth = Math.max(0.6, s * 0.02);
    ctx.beginPath(); ctx.ellipse(x, y, r, r * 0.22, 0, 0, Math.PI * 2); ctx.stroke();
  },

  /** A big bird on the air: a vulture, a hawk, a crow or a raven, gliding round (a few beats now and then). */
  raptor(ctx, x, y, s, m, a, part) {
    const beat = Math.sin(m.ph * 0.5) > 0.85;
    faunaWings(ctx, x, y, s, m.f, beat ? m.ph * 7 : 0, a.K.col, part === 'shadow' ? 'shadow' : true, { glide: !beat, broad: true, band: a.kind === 'vulture' || a.kind === 'hawk' });
  },
};

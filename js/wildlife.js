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
const FAUNA_SONG = { jungle: 1, autumn: 1, savanna: 1, swamp: 1, tropical: 1 };

/*
 * The animals. mode: how it lives (FAUNA_MODES); act: when it's out ('day', 'night', 'dusk' or 'all'); hab: the cell
 * habitat it lives in (faunaHab), min of it a cell needs, p the chance a cell has a group (two where there's plenty);
 * n: how many in a group; z: the zoom (px a tile) it is drawn from; size: its length in tiles; col: body, light, dark.
 * alt: the habitat it takes where a cell has too little of hab (deer: the forest edges, away from lakes); high: how high
 * it soars (tiles); bold: it doesn't flee the fighting (the scavengers, the geese passing high over).
 */
const FAUNA_KINDS = {
  turtle: { mode: 'herd', draw: 'turtle', act: 'day', hab: 'shore', alt: 'open', min: 3, p: 0.61, n: [1, 3], z: 16, size: 0.36,
    speed: 0.25, run: 0.88, roam: true, col: ['#6b794c', '#c4b583', '#384531'] },
  alligator: { mode: 'herd', draw: 'alligator', act: 'all', hab: 'shore', alt: 'open', min: 3, p: 0.55, n: [1, 2], z: 12, size: 0.71,
    speed: 0.32, run: 2.0, roam: true, col: ['#4f6147', '#94a06b', '#293c32'] },
  hinge: { mode: 'herd', draw: 'hinge', act: 'all', hab: 'open', min: 6, p: 0.71, n: [2, 3], z: 12, size: 0.54,
    speed: 0.38, run: 2.2, roam: true, col: ['#806073', '#e9ac76', '#342839'], lift: 0.27 },
  switchtail: { mode: 'herd', draw: 'switchtail', act: 'all', hab: 'open', min: 8, p: 0.56, n: [1, 3], z: 13, size: 0.49,
    speed: 0.47, run: 2.6, roam: true, col: ['#686782', '#edbb85', '#343044'], lift: 0.32 },
  sailwing: { mode: 'soar', draw: 'sailwing', act: 'all', hab: 'open', min: 7, p: 0.31, n: [1, 2], z: 10, size: 0.46,
    high: 1.5, col: ['#906580', '#ebaf83', '#473151'], lift: 0.35 },
  gull: { mode: 'flock', draw: 'gull', act: 'day', hab: 'shore', alt: 'open', min: 3, p: 0.84, n: [3, 6], z: 13, size: 0.33,
    col: ['#f1f0e8', '#bcc5c7', '#343d42'], ground: true },
  songbird: { mode: 'flock', draw: 'bird', act: 'day', hab: 'tree', min: 4, p: 0.8, n: [5, 9], z: 22, size: 0.19, col: ['#6e5a42', '#e2c08a', '#221a14'], forage: 'edge' },
  snowbird: { mode: 'flock', draw: 'bird', act: 'day', hab: 'perch', alt: 'open', min: 1, p: 0.55, n: [6, 10], z: 22, size: 0.18, col: ['#ece8e0', '#a07a52', '#3e3630'], ground: true, forage: 'open' },
  deer: { mode: 'herd', draw: 'deer', act: 'day', hab: 'shore', min: 2, p: 0.7, alt: 'edge', n: [2, 4], z: 12, size: 0.48, speed: 0.32, run: 2.7, col: ['#8e5c36', '#e8dccb', '#4a2e1a'] },
  // Bison (Steamwells): a small herd grazing the warm grassland between the springs.
  bison: { mode: 'herd', draw: 'bison', act: 'day', hab: 'open', min: 20, p: 0.6, n: [3, 6], z: 10, size: 0.7, speed: 0.2, run: 2.2, col: ['#5a3a24', '#8a6440', '#20140c'], spread: 1.4 },
  herd: { mode: 'herd', draw: 'antelope', act: 'day', hab: 'open', min: 26, p: 0.5, n: [5, 10], z: 9, size: 0.46, speed: 0.26, run: 2.9, col: ['#635f57', '#969083', '#232321'], spread: 1.6 },
  fox: { mode: 'herd', draw: 'fox', act: 'day', hab: 'open', min: 10, p: 0.45, n: [1, 1], z: 14, size: 0.38, speed: 0.6, run: 2.5, col: ['#c0602c', '#f2e6d6', '#2a1a10'], roam: true },
  hare: { mode: 'herd', draw: 'hare', act: 'day', hab: 'open', min: 12, p: 0.55, n: [1, 3], z: 16, size: 0.28, speed: 0.45, run: 3.2, col: ['#f4eee2', '#ffffff', '#3a3632'], hop: true, spread: 2.4, roam: true },
  arcticfox: { mode: 'herd', draw: 'fox', act: 'night', hab: 'open', min: 16, p: 0.4, n: [1, 1], z: 14, size: 0.36, speed: 0.75, run: 2.5, col: ['#e2e2de', '#ffffff', '#6c6c74'], roam: true, tracks: true, lift: 0.3 },
  heron: { mode: 'wade', draw: 'heron', act: 'day', hab: 'shallow', min: 2, p: 0.65, n: [1, 1], z: 12, size: 0.52, col: ['#8e98a2', '#e4e8ec', '#2c3036'] },
  geese: { mode: 'swim', draw: 'goose', act: 'day', hab: 'shallow', min: 5, p: 0.4, n: [3, 6], z: 12, size: 0.38, col: ['#8a7e6e', '#ece4d4', '#1e1c1a'] },
  frog: { mode: 'small', draw: 'frog', act: 'all', hab: 'shore', min: 2, p: 0.6, n: [2, 4], z: 24, size: 0.09, col: ['#5f7c36', '#a8c65c', '#222e18'], hop: true },
  lizard: { mode: 'small', draw: 'lizard', act: 'day', hab: 'rock', alt: 'open', min: 2, p: 0.7, n: [1, 3], z: 20, size: 0.24, col: ['#d6ae7a', '#f2dcae', '#6a4424'], dart: true },
  beetle: { mode: 'small', draw: 'beetle', act: 'day', hab: 'open', min: 10, p: 0.6, n: [2, 5], z: 22, size: 0.16, col: ['#221c1a', '#f08a3a', '#000000'] },
  crawler: { mode: 'small', draw: 'crawler', act: 'all', hab: 'open', min: 8, p: 0.6, n: [1, 3], z: 16, size: 0.24, col: ['#c4bcc8', '#ece6f0', '#6a6070'], lift: 0.45 },
  owl: { mode: 'perch', draw: 'owl', act: 'night', hab: 'tree', min: 6, p: 0.4, n: [1, 1], z: 14, size: 0.24, col: ['#7c644a', '#ccb48e', '#2a2018'], eyes: '#ffc860', lift: 0.45 },
  snowyowl: { mode: 'perch', draw: 'owl', act: 'night', hab: 'perch', min: 1, p: 0.35, n: [1, 1], z: 14, size: 0.25, col: ['#f2f2ee', '#ffffff', '#5c5c64'], eyes: '#ffe060', lift: 0.5 },
  crow1: { mode: 'perch', draw: 'crow', act: 'day', hab: 'dead', min: 1, p: 0.35, n: [1, 1], z: 14, size: 0.22, col: ['#222026', '#56525e', '#0c0c0e'], bold: true },
  bat: { mode: 'flit', draw: 'bat', act: 'night', hab: 'tree', min: 4, p: 0.5, n: [2, 4], z: 11, size: 0.26, col: ['#625458', '#9a8a90', '#3a3034'], lift: 0.55 },
  duskbat: { mode: 'flit', draw: 'bat', act: 'dusk', hab: 'rock', min: 2, p: 0.5, n: [2, 4], z: 11, size: 0.26, col: ['#4a3a34', '#8a7068', '#2e221c'], lift: 0.3 },
  embermoth: { mode: 'flit', draw: 'moth', act: 'night', hab: 'open', min: 8, p: 0.55, n: [3, 6], z: 11, size: 0.07, col: ['#5a2a14', '#ffb060', '#1a0c06'], glow: '#ff8a30', slow: true },
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
  jungle: { kinds: ['deer', 'fox', 'songbird', 'owl'], glows: ['firefly'], light: 'moth', carrion: 'crow', trees: [1, 2, 3, 4] },
  autumn: { kinds: ['deer', 'fox', 'geese', 'songbird'], migrant: 'vgeese', light: 'moth', carrion: 'crow', trees: [1, 2, 3, 4, 6] },
  savanna: { kinds: ['herd', 'hare', 'vulture'], glows: ['eyes'], light: 'moth', carrion: 'vulture', trees: [1, 2, 5, 6] },
  swamp: { kinds: ['alligator', 'turtle', 'heron', 'songbird'], glows: ['firefly'], light: 'moth', carrion: 'crow', trees: [1, 4, 6] },
  polar: { kinds: ['hare', 'snowbird', 'snowyowl', 'arcticfox'], light: 'moth', carrion: 'raven', trees: [3], perch: [1, 3, 5] },
  desert: { kinds: ['lizard', 'hare', 'hawk', 'duskbat'], light: 'moth', carrion: 'vulture', trees: [] },
  volcanic: { kinds: ['beetle', 'lizard', 'crow1', 'hawk', 'embermoth'], light: 'embermoth', carrion: 'crow', trees: [], dead: [1] },
  springs: { kinds: ['bison', 'lizard', 'turtle', 'gull'], trees: [] },
  tropical: { kinds: ['lizard', 'turtle', 'gull', 'songbird'], light: 'moth', trees: [1, 2, 3] },
  alien: { kinds: ['hinge', 'switchtail', 'sailwing'], trees: [] },
  hollow: { kinds: ['crawler', 'hinge', 'sailwing'], glows: ['glowworm'], trees: [] },
};
const FAUNA_GLOW = { firefly: '#d4ff6a', eyes: '#d8ff8a', glowworm: '#7fe8ff', moth: '#fff0d0', embermoth: '#ff8a30' };
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
/** How much of the land in view is battlefield (War scars: cratered or burned out), 0 to 1: the birdsong there thins out (js/audio.js). */
function faunaScarred() { return FAUNA.scarred || 0; }
function faunaScarCount(v) {
  if (!S.ash) { FAUNA.scarred = 0; return; }
  let n = 0, k = 0;
  for (let j = Math.max(0, Math.floor(v.y0)); j < Math.min(S.H, Math.ceil(v.y1)); j += 2) for (let i = Math.max(0, Math.floor(v.x0)); i < Math.min(S.W, Math.ceil(v.x1)); i += 2) {
    const t = j * S.W + i;
    if (S.terrain[t] !== T_GROUND) continue;
    n++; if (scarDead(t)) k++;
  }
  FAUNA.scarred = n ? Math.min(1, (k / n) * 1.6) : 0;
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
function faunaBusy(t) { return S.road[t] || S.bAt[t] || S.res[t] || S.plan[t] || (S.rail && S.rail[t]) || (S.pipe && S.pipe[t]) || (S.ash && scarDead(t)); } // (War scars: nothing lives on cratered or burned-out ground)
/** Visible footprint of roads, track and buildings. Planned roads only matter once laid. */
function faunaDevelopment(x, y) {
  const i = Math.floor(x), j = Math.floor(y);
  let pressure = 0, nearby = null;
  for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) {
    const xx = i + dx, yy = j + dy;
    if (Math.abs(dx) + Math.abs(dy) > 2 || !inMap(xx, yy)) continue;
    const t = tIdx(xx, yy), owner = S.bAt[t] ? getE(S.bAt[t])?.owner : -1;
    const building = owner >= 0 && !isWild(owner);
    if (!building && !S.road[t] && !S.rail?.[t]) continue;
    const d = Math.abs(dx) + Math.abs(dy);
    if (d <= 1) return { x: xx + 0.5, y: yy + 0.5 };
    pressure += building ? 1.5 : 0.38;
    nearby = { x: xx + 0.5, y: yy + 0.5 };
  }
  return pressure >= 3 ? nearby : null;
}
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
      if (!faunaWet(i, j) || faunaDevelopment(i + 0.5, j + 0.5)) continue;
      H.water.push(t);
      if (faunaNext(i, j, T_GROUND)) H.shallow.push(t);
    } else if (ter === T_ROCK) {
      if (faunaNext(i, j, T_GROUND) && !faunaDevelopment(i + 0.5, j + 0.5)) H.rock.push(t);
    } else if (ter === T_GROUND) {
      if (faunaBusy(t) || faunaDevelopment(i + 0.5, j + 0.5)) continue;
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
    if (n < K.min && K.alt && c.hab[K.alt].length >= K.min * 2) { hab = K.alt; n = c.hab[hab].length; } // (deer: lake shores, else forest edges)
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
    if (f.type === 'boom' && S.ash) faunaKilled(f.x, f.y, (f.r || 0.6) * 1.3); // (War scars: the blast kills what it catches; its bones are the game's, S.bones)
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

/**
 * A blast at (x, y) of reach r (War scars): the animals on the ground in it are killed, gone at once, not fled (the game
 * itself leaves their bones: scarFauna). Birds aloft and the bold scavengers get away.
 */
function faunaKilled(x, y, r) {
  for (const a of FAUNA.list) {
    if (a.done || a.K.bold) continue;
    const m = a.m[0];
    if (!m || m.fly || dist2(m.x, m.y, x, y) > r * r) continue;
    a.done = true; a.st = 'dead';
    if (a.e) a.e.back = S.time + 90;
  }
}

/** A new wreck at (x, y): carrion birds come and circle it for a minute or two. */
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
  // The weather: storms keep the birds down; rain puts the fireflies out.
  F.storm = 0; F.rain = 0;
  const W = weatherOn() && typeof weatherAt === 'function' ? weatherAt(S.time) : null;
  if (W) { if (['rain', 'snow', 'sand', 'leaves', 'dust'].includes(W.kind)) F.storm = W.k; if (W.kind === 'rain') F.rain = W.k; }
  if (S.event && S.event.type === 'dust') F.storm = 1;
  faunaHear(v);
  if (F.t >= F.murAt) { F.murAt = F.t + 0.5; faunaMurmur(v); faunaScarCount(v); }
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
    if (a.displaced && a.m.every((m) => !m.mv && !m.fly && !m.wait)) a.out = true;
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
  if (!faunaQuiet(c) || (e.hab !== 'any' && c.hab[e.hab].length < K.min)) return;
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
  if (!K.bold && F.t >= (a.developmentAt || 0)) {
    a.developmentAt = F.t + 0.65;
    for (const m of a.m) {
      const works = faunaDevelopment(m.x, m.y);
      if (!works) continue;
      a.displaced = true;
      const sx = works.x === m.x && works.y === m.y ? p.x - 1 : works.x;
      faunaFlee(a, sx, works.y);
      return;
    }
  }
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
  return !rest || (!faunaBusy(t) && !faunaDevelopment(x, y));
}
/** Can a walker go straight from (x0, y0) to (x1, y1): open ground all the way, no climbing a cliff (but by a ramp)? */
function faunaPath(x0, y0, x1, y1, swim) {
  const d = Math.hypot(x1 - x0, y1 - y0), n = Math.max(1, Math.ceil(d / 0.4));
  let pe = -1;
  const start = tIdx(Math.floor(x0), Math.floor(y0));
  for (let k = 0; k <= n; k++) {
    const x = x0 + ((x1 - x0) * k) / n, y = y0 + ((y1 - y0) * k) / n, i = Math.floor(x), j = Math.floor(y);
    if (!inMap(i, j)) return false;
    const t = j * S.W + i;
    if (swim) { if (!faunaWet(i, j)) return false; continue; }
    if (S.terrain[t] !== T_GROUND || (t !== start && S.bAt[t])) return false;
    if (pe >= 0 && S.elev[t] !== pe && !S.ramp[t]) return false;
    pe = S.elev[t];
  }
  return true;
}
/** Somewhere to run to from (x, y), away from (sx, sy), about d tiles: the straightest way that's open, or null. */
function faunaAway(x, y, sx, sy, d, swim, habitat) {
  const a0 = Math.atan2(y - sy, x - sx) + (Math.random() - 0.5) * 0.4;
  for (const dd of [d, d * 0.6, d * 0.35]) for (const off of [0, 0.45, -0.45, 0.9, -0.9, 1.35, -1.35]) {
    const tx = x + Math.cos(a0 + off) * dd, ty = y + Math.sin(a0 + off) * dd;
    if ((!habitat || faunaStand(tx, ty, true)) && faunaPath(x, y, tx, ty, swim)) return { x: tx, y: ty };
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
function faunaInHab(x, y, set) { const i = Math.floor(x), j = Math.floor(y); return inMap(i, j) && set.has(j * S.W + i) && !faunaBusy(j * S.W + i) && !faunaDevelopment(x, y); }
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
      const K = a.K, list = c.hab[a.hab].filter((t) => faunaStand(t % S.W + 0.5, (t / S.W | 0) + 0.5, true));
      a.set = new Set(c.hab.open.concat(c.hab[a.hab]));
      const at = faunaPick(list);
      if (!at) return false;
      a.x = at.x; a.y = at.y;
      const from = how === 'arrive' ? FAUNA_MODES.herd.edge(a, at) : null;
      if (how !== 'place') a.vis = 0;
      for (let k = 0; k < n; k++) {
        const s = faunaNearSpot(at.x, at.y, K.spread || 1, a.set);
        const m = faunaMember(s.x, s.y);
        m.head = Math.random() < 0.5;
        m.antlers = a.kind === 'deer' && Math.random() < 0.38;
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
        if (to && faunaStand(to.x, to.y, true)) {
          a.x = to.x; a.y = to.y;
          a.set = new Set(a.cell.hab.open.concat(a.cell.hab[a.hab]));
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
          else if (r < 0.8) { const s = faunaNearSpot(a.x, a.y, K.spread || 1, a.set); if (faunaStand(s.x, s.y, true) && faunaPath(m.x, m.y, s.x, s.y)) { m.tx = s.x; m.ty = s.y; m.sp = K.speed * 0.6; m.mv = 1; m.head = false; } }
          else m.f += (Math.random() - 0.5) * 1.5;
        }
      }
      if (a.st === 'flee' && !a.displaced && a.m.every((m) => !m.mv)) {
        // (out of breath and off the screen: gone; still on it: they stand a moment, then graze where they are)
        const p = a.m[0], v = F.v;
        if (p.x < v.x0 - 1 || p.x > v.x1 + 1 || p.y < v.y0 - 1 || p.y > v.y1 + 1) a.done = true;
        else { a.st = 'live'; a.x = p.x; a.y = p.y; a.t = 20; a.set = new Set(a.cell ? a.cell.hab.open : []); }
      }
    },
    flee(a, sx, sy) {
      const p = a.m[0], to = faunaAway(p.x, p.y, sx, sy, 9, false, a.displaced);
      if (!to) { a.out = true; return; }
      for (const m of a.m) {
        const s = faunaAway(m.x, m.y, sx, sy, 9, false, a.displaced) || to;
        if (!faunaPath(m.x, m.y, s.x, s.y)) { m.mv = 0; m.wait = 0; continue; }
        m.tx = s.x + (Math.random() - 0.5); m.ty = s.y + (Math.random() - 0.5); m.sp = a.K.run * (0.85 + Math.random() * 0.3); m.mv = 1; m.head = true; m.wait = Math.random() * 0.3;
        if ((a.displaced && !faunaStand(m.tx, m.ty, true)) || !faunaPath(m.x, m.y, m.tx, m.ty)) { m.tx = s.x; m.ty = s.y; }
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
    if (F.z < K.z || F.L > 0.5 || F.storm > 0.35) continue;
    const a = { K, kind, e: null, cell: null, m: [], st: 'live', t: 0, vis: 1, out: false, done: false, goal: s };
    FAUNA_MODES.soar.make(a, null, 'arrive', Math.round(K.n[0] + Math.random() * (K.n[1] - K.n[0])));
    a.r = 1 + Math.random() * 0.6;
    for (const m of a.m) m.rr = a.r * (0.7 + Math.random() * 0.5);
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
      if (a.K.mode === 'soar' || a.K.mode === 'vee' || a.K.mode === 'flit') continue;
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
    const mode = a.K.mode, flier = mode === 'soar' || mode === 'vee' || mode === 'flit';
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
          faunaDot(ctx, x, y, Math.max(3, z * 0.1), FAUNA_GLOW.glowworm, 0.95 * (0.55 + 0.45 * Math.sin(t * (0.6 + w.h) + w.h * 40)) * fade);
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
          const x = ox + ex * z, y = oy + ey * z, gap = z * 0.045, r = Math.max(2.4, z * 0.075);
          faunaDot(ctx, x - gap, y, r, FAUNA_GLOW.eyes, 0.9 * on * night); faunaDot(ctx, x + gap, y, r, FAUNA_GLOW.eyes, 0.9 * on * night);
        }
      }
    }
  }
  // Owls' eyes, ember moths.
  for (const a of F.list) {
    if (a.done || a.vis <= 0) continue;
    const K = a.K;
    if (K.eyes && L > 0.4) for (const m of a.m) {
      if (m.fly || Math.sin(F.t * 0.9 + m.ph * 7) < -0.95) continue; // (a blink now and then)
      // (in the face of FAUNA_DRAW.owl, turning as it looks round)
      const sz = Math.max(2, K.size * z), hx = ox + m.x * z + Math.sin(m.look || 0) * sz * 0.08, hy = oy + m.y * z - sz * 0.53, r = Math.max(2.4, z * 0.065);
      faunaDot(ctx, hx - sz * 0.06, hy, r, K.eyes, 0.9 * a.vis); faunaDot(ctx, hx + sz * 0.06, hy, r, K.eyes, 0.9 * a.vis);
    }
    if (K.glow) {
      for (const m of a.m) {
        const x = ox + m.x * z, y = oy + m.y * z;
        const pulse = 0.6 + 0.4 * Math.sin(m.ph * 0.5 + F.t * 5);
        faunaDot(ctx, x, y, z * 0.16, K.glow, pulse * a.vis);
      }
    }
  }
  // Moths (or the biome's own) round the colony's lights.
  const kind = F.life.light, col = FAUNA_GLOW[kind];
  if (kind && L > 0.3 && z >= 12 && gfxStep() !== 'saver' && !(onTouch() && Math.min(R.w, R.h) < 600)) {
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
      const n = Math.round(l.n * Math.min(1, F.k) * 0.45);
      for (let k = 0; k < n; k++) {
        const h1 = hash2(l.x * 13 | 0, k, 51), h2 = hash2(l.y * 13 | 0, k, 52), h3 = hash2(k, l.x * 7 | 0, 53);
        const w = (1.4 + 2.2 * h1) * (h2 < 0.5 ? -1 : 1), th = t * w + h3 * 6.3, r = z * (0.12 + 0.24 * h2) * (1 + 0.25 * Math.sin(t * 1.7 + k));
        let x = lx + Math.cos(th) * r, y = ly + Math.sin(th) * r * 0.6 + Math.sin(t * 6 + k) * z * 0.03, a = on;
        if (gone >= 0 && gone <= 1) { x += Math.cos(th) * gone * z * 3; y += Math.sin(th) * gone * z * 2 - gone * z; a *= 1 - gone; }
        const flick = 0.6 + 0.4 * Math.abs(Math.sin(t * 30 + k * 3));
        faunaDot(ctx, x, y, Math.max(1.8, z * (kind === 'moth' ? 0.056 : 0.072)), col, 0.85 * a * flick);
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
  if (!shadow && o && o.tips) {
    ctx.fillStyle = faunaCol(cols[2]); ctx.beginPath();
    for (const side of [-1, 1]) {
      const tip = P(-back, side * half), inner = P(-back * 0.63, side * half * 0.78), outer = P(-back - chord * 0.11, side * half * 0.88);
      ctx.moveTo(inner[0], inner[1]); ctx.quadraticCurveTo(tip[0] + c * s * 0.04, tip[1] + sn * s * 0.04, tip[0], tip[1]);
      ctx.lineTo(outer[0], outer[1]); ctx.closePath();
    }
    ctx.fill();
  }
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

/** Jointed fore and hind legs, with far feet offset to match the game's raised side view. */
function faunaHoofLegs(ctx, m, run, bob, hind, fore, rump, chest, width, shade, coat) {
  for (const far of [true, false]) for (const front of [false, true]) {
    const hip = (front ? fore : hind) + (far ? 0.047 : 0);
    const top = (front ? chest : rump) + bob - (far ? 0.021 : 0);
    const swing = m.mv ? Math.sin(m.ph + (front === far ? Math.PI : 0)) : 0;
    const foot = hip + swing * (run ? 0.176 : 0.074);
    const ground = (far ? -0.064 : 0) - Math.max(0, swing) * (run ? 0.09 : 0.03);
    const joint = hip + (foot - hip) * 0.43 - (front ? 0.006 : 0.063);
    const leg = faunaCol(far ? shade : coat);
    ctx.strokeStyle = leg; ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.lineWidth = width * (front ? 0.84 : 1.16);
    ctx.beginPath(); ctx.moveTo(hip, top);
    ctx.quadraticCurveTo(hip + (front ? 0.012 : 0.049), (top + ground) * 0.50, joint, ground - 0.137); ctx.stroke();
    ctx.lineWidth = width * 0.66;
    ctx.beginPath(); ctx.moveTo(joint, ground - 0.141); ctx.lineTo(foot, ground - 0.026); ctx.stroke();
    ctx.strokeStyle = faunaCol(shade); ctx.lineWidth = width * 0.68;
    ctx.beginPath(); ctx.moveTo(foot - 0.014, ground - 0.018); ctx.lineTo(foot + width * 0.61, ground - 0.015); ctx.stroke();
  }
}

/** The Bloom animals share dark flexible plates with a pale, warm-lit edge. */
function bloomShell(ctx, shell, shade, lo, hi) {
  const g = ctx.createLinearGradient(0, lo, 0, hi);
  g.addColorStop(0, faunaCol('#c89aa7', 0.42));
  g.addColorStop(0.35, faunaCol(shell, 0.35));
  g.addColorStop(1, faunaCol(shade, 0.31));
  return g;
}

/** The paired amber eye spots sit inside a darker margin on all three species. */
function bloomEyes(ctx, x, y, seam, s) {
  ctx.fillStyle = faunaCol('#232035', 0.32); ctx.beginPath();
  faunaEll(ctx, x, -y, 0.044, 0.026, -0.3); faunaEll(ctx, x, y, 0.044, 0.026, 0.3); ctx.fill();
  ctx.fillStyle = faunaCol(seam, 0.76); ctx.beginPath();
  const radius = Math.max(0.019, 0.27 / s);
  faunaEll(ctx, x + 0.011, -y, radius, radius * 0.67, 0);
  faunaEll(ctx, x + 0.011, y, radius, radius * 0.67, 0); ctx.fill();
}

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

  gull(ctx, x, y, s, m, a, air) {
    if (air) { faunaWings(ctx, x, y, s * 2.05, m.f, m.ph * 0.72, a.K.col, air, { broad: true, tips: true }); return; }
    faunaShadow(ctx, x, y, s * 0.35, s * 0.13);
    ctx.save(); ctx.translate(x, y); ctx.scale(faunaSide(m), 1);
    ctx.fillStyle = faunaCol(a.K.col[0]); ctx.beginPath();
    faunaEll(ctx, -s * 0.045, -s * 0.22, s * 0.32, s * 0.16, -0.24);
    faunaEll(ctx, s * 0.22, -s * 0.37, s * 0.13, s * 0.11, 0.05);
    ctx.fill();
    ctx.fillStyle = faunaCol(a.K.col[1]); ctx.beginPath();
    faunaEll(ctx, -s * 0.14, -s * 0.23, s * 0.22, s * 0.10, -0.22); ctx.fill();
    ctx.fillStyle = faunaCol('#ca9d4c'); ctx.beginPath();
    ctx.moveTo(s * 0.32, -s * 0.41); ctx.lineTo(s * 0.50, -s * 0.34); ctx.lineTo(s * 0.33, -s * 0.32); ctx.fill();
    ctx.restore();
  },

  /** White-tailed deer proportions, with a slender neck and a white flag on the tail. */
  deer(ctx, x, y, s, m, a) {
    const [coat, cream, shade] = a.K.col;
    const run = m.mv && m.sp > a.K.speed * 1.5, bob = run ? Math.sin(m.ph * 2) * 0.038 : 0;
    const graze = !m.mv && !m.head;
    faunaShadow(ctx, x, y, s * 0.36, s * 0.072);
    ctx.save(); ctx.translate(x, y); ctx.scale(faunaSide(m) * s, s);
    faunaHoofLegs(ctx, m, run, bob, -0.241, 0.198, -0.351, -0.379, 0.041, shade, coat);
    ctx.translate(0, bob);

    const fur = ctx.createLinearGradient(0, -0.57, 0, -0.27);
    fur.addColorStop(0, faunaCol('#785035')); fur.addColorStop(0.55, faunaCol(coat)); fur.addColorStop(1, faunaCol('#ad8056'));
    ctx.fillStyle = fur; ctx.beginPath(); ctx.moveTo(-0.351, -0.456);
    ctx.bezierCurveTo(-0.322, -0.558, -0.218, -0.543, -0.116, -0.521);
    ctx.bezierCurveTo(0.011, -0.489, 0.124, -0.551, 0.208, -0.559);
    ctx.bezierCurveTo(0.312, -0.529, 0.307, -0.411, 0.240, -0.348);
    ctx.quadraticCurveTo(0.107, -0.332, 0.048, -0.356);
    ctx.bezierCurveTo(-0.060, -0.327, -0.140, -0.321, -0.210, -0.347);
    ctx.bezierCurveTo(-0.288, -0.317, -0.372, -0.370, -0.351, -0.456); ctx.fill();

    // Pale belly and the underside of the tail. The tail lifts in a run.
    ctx.fillStyle = faunaCol(cream);
    ctx.beginPath(); faunaEll(ctx, -0.075, -0.351, 0.137, 0.017, -0.065); ctx.fill();
    ctx.save(); ctx.translate(-0.324, -0.478); ctx.rotate(run ? 0.45 : -0.76);
    ctx.beginPath(); ctx.moveTo(0.018, 0.010); ctx.quadraticCurveTo(-0.032, -0.035, -0.109, -0.015);
    ctx.quadraticCurveTo(-0.081, 0.038, -0.014, 0.036); ctx.fill();
    ctx.fillStyle = faunaCol(coat); ctx.beginPath(); ctx.moveTo(0.012, 0.013);
    ctx.quadraticCurveTo(-0.028, -0.041, -0.109, -0.015); ctx.quadraticCurveTo(-0.071, 0.000, -0.024, 0.018); ctx.fill();
    ctx.restore();

    const hx = graze ? 0.503 : 0.305, hy = graze ? -0.169 : -0.692;
    if (graze) {
      // The neck sweeps out from the shoulder and tapers where it meets the back of the skull.
      const neck = ctx.createLinearGradient(0.14, -0.455, 0.49, -0.19);
      neck.addColorStop(0, faunaCol(coat)); neck.addColorStop(0.37, faunaCol(coat));
      neck.addColorStop(1, faunaCol('#ac7a52'));
      ctx.fillStyle = neck; ctx.beginPath(); ctx.moveTo(0.125, -0.526);
      ctx.bezierCurveTo(0.255, -0.571, 0.359, -0.422, 0.424, -0.309);
      ctx.quadraticCurveTo(0.471, -0.239, 0.522, -0.218);
      ctx.quadraticCurveTo(0.518, -0.173, 0.476, -0.139);
      ctx.bezierCurveTo(0.415, -0.169, 0.387, -0.246, 0.321, -0.298);
      ctx.quadraticCurveTo(0.252, -0.352, 0.177, -0.366); ctx.fill();
    } else {
      ctx.fillStyle = faunaCol(coat); ctx.beginPath(); ctx.moveTo(0.106, -0.520);
      ctx.quadraticCurveTo(hx - 0.140, hy + 0.113, hx - 0.041, hy - 0.035);
      ctx.lineTo(hx + 0.045, hy + 0.035);
      ctx.quadraticCurveTo(hx - 0.048, hy + 0.192, 0.223, -0.360); ctx.fill();
      ctx.fillStyle = faunaCol('#c49b73'); ctx.beginPath(); ctx.moveTo(hx + 0.028, hy + 0.030);
      ctx.quadraticCurveTo(hx - 0.046, hy + 0.183, 0.223, -0.368);
      ctx.quadraticCurveTo(hx - 0.037, hy + 0.153, hx + 0.012, hy + 0.006); ctx.fill();
    }

    ctx.translate(hx, hy); ctx.rotate(graze ? 1.25 : 0.16);
    ctx.fillStyle = faunaCol(shade); ctx.beginPath(); faunaEll(ctx, -0.037, -0.058, 0.068, 0.025, -1.31); ctx.fill();
    ctx.fillStyle = faunaCol(coat); ctx.beginPath(); ctx.moveTo(-0.078, -0.014);
    ctx.quadraticCurveTo(-0.050, -0.074, 0.019, -0.056);
    ctx.lineTo(0.134, 0.000); ctx.quadraticCurveTo(0.156, 0.028, 0.116, 0.044);
    ctx.quadraticCurveTo(0.063, 0.052, -0.035, 0.033); ctx.fill();
    ctx.fillStyle = faunaCol(cream); ctx.beginPath();
    faunaEll(ctx, 0.100, 0.032, 0.036, 0.015, 0.08); faunaEll(ctx, -0.005, 0.030, 0.041, 0.017, 0.12); ctx.fill();
    ctx.fillStyle = faunaCol(coat); ctx.beginPath();
    ctx.moveTo(-0.027, -0.040); ctx.quadraticCurveTo(-0.113, -0.021, -0.148, -0.116);
    ctx.quadraticCurveTo(-0.061, -0.129, -0.027, -0.040); ctx.fill();
    ctx.fillStyle = faunaCol('#c7a082'); ctx.beginPath(); faunaEll(ctx, -0.100, -0.085, 0.041, 0.013, 0.46); ctx.fill();
    ctx.fillStyle = faunaCol('#32231a'); ctx.beginPath();
    faunaEll(ctx, 0.029, -0.022, 0.014, 0.011, 0); faunaEll(ctx, 0.135, 0.015, 0.019, 0.014, 0); ctx.fill();
    if (m.antlers && s >= 11) {
      ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.lineWidth = Math.max(0.012, 0.36 / s);
      ctx.strokeStyle = faunaCol('#89715a');
      ctx.beginPath(); ctx.moveTo(-0.035, -0.051);
      ctx.quadraticCurveTo(0.024, -0.133, -0.021, -0.209); ctx.quadraticCurveTo(-0.043, -0.256, 0.013, -0.292);
      ctx.moveTo(-0.026, -0.216); ctx.lineTo(-0.064, -0.281); ctx.stroke();
      ctx.strokeStyle = faunaCol('#c6a680');
      ctx.beginPath(); ctx.moveTo(-0.006, -0.047); ctx.quadraticCurveTo(-0.093, -0.104, -0.106, -0.177);
      ctx.quadraticCurveTo(-0.127, -0.251, -0.043, -0.266);
      ctx.moveTo(-0.073, -0.115); ctx.quadraticCurveTo(-0.044, -0.159, -0.055, -0.198);
      ctx.moveTo(-0.111, -0.186); ctx.lineTo(-0.146, -0.253);
      ctx.moveTo(-0.094, -0.247); ctx.lineTo(-0.089, -0.307); ctx.stroke();
    }
    ctx.restore();
  },

  /** Blue wildebeest proportions, with a deep chest, angular mane and narrow hindquarters. */
  antelope(ctx, x, y, s, m, a) {
    const [coat, light, shade] = a.K.col;
    const run = m.mv && m.sp > a.K.speed * 1.5, bob = run ? Math.sin(m.ph * 2) * 0.024 : 0;
    const graze = !m.mv && !m.head;
    faunaShadow(ctx, x, y, s * 0.43, s * 0.084);
    ctx.save(); ctx.translate(x, y); ctx.scale(faunaSide(m) * s, s);
    faunaHoofLegs(ctx, m, run, bob, -0.293, 0.205, -0.330, -0.339, 0.055, shade, coat);
    ctx.translate(0, bob);

    const tailX = -0.452 + Math.sin(FAUNA.t * 1.7 + m.ph) * 0.035;
    ctx.strokeStyle = faunaCol(shade); ctx.lineWidth = 0.023;
    ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(-0.370, -0.440);
    ctx.quadraticCurveTo(-0.487, -0.320, tailX, -0.203); ctx.stroke();
    ctx.fillStyle = faunaCol(shade); ctx.beginPath(); ctx.moveTo(tailX - 0.016, -0.240);
    ctx.quadraticCurveTo(tailX - 0.052, -0.180, tailX - 0.012, -0.120);
    ctx.quadraticCurveTo(tailX + 0.044, -0.159, tailX + 0.008, -0.239); ctx.fill();

    const fur = ctx.createLinearGradient(-0.09, -0.622, 0.055, -0.279);
    fur.addColorStop(0, faunaCol(light)); fur.addColorStop(0.58, faunaCol(coat)); fur.addColorStop(1, faunaCol('#514a42'));
    ctx.fillStyle = fur; ctx.beginPath(); ctx.moveTo(-0.400, -0.394);
    ctx.bezierCurveTo(-0.409, -0.474, -0.351, -0.495, -0.265, -0.511);
    ctx.bezierCurveTo(-0.098, -0.532, 0.052, -0.584, 0.132, -0.612);
    ctx.bezierCurveTo(0.234, -0.647, 0.310, -0.563, 0.324, -0.489);
    ctx.bezierCurveTo(0.358, -0.368, 0.303, -0.262, 0.222, -0.258);
    ctx.bezierCurveTo(0.106, -0.264, 0.000, -0.307, -0.144, -0.320);
    ctx.bezierCurveTo(-0.247, -0.335, -0.373, -0.311, -0.400, -0.394); ctx.fill();

    const hx = graze ? 0.358 : 0.334, hy = graze ? -0.285 : -0.517;
    ctx.fillStyle = faunaCol('#534a41'); ctx.beginPath(); ctx.moveTo(0.151, -0.586);
    ctx.quadraticCurveTo(0.233, -0.649, hx + 0.034, hy - 0.070);
    ctx.lineTo(hx + 0.042, hy + 0.074); ctx.quadraticCurveTo(0.315, -0.293, 0.231, -0.263); ctx.fill();
    // Uneven crest and throat fringe sit over the sloping shoulder, with brindling behind them.
    ctx.fillStyle = faunaCol(shade); ctx.beginPath(); ctx.moveTo(-0.011, -0.558);
    ctx.lineTo(0.054, -0.627); ctx.lineTo(0.047, -0.647); ctx.lineTo(0.108, -0.644);
    ctx.lineTo(0.127, -0.676); ctx.lineTo(0.174, -0.664); ctx.lineTo(0.180, -0.687);
    ctx.quadraticCurveTo(0.258, -0.665, hx + 0.028, hy - 0.062);
    ctx.lineTo(hx - 0.046, hy - 0.013); ctx.quadraticCurveTo(0.219, -0.577, 0.129, -0.578); ctx.fill();
    ctx.beginPath(); ctx.moveTo(0.254, -0.402); ctx.lineTo(hx + 0.016, hy + 0.066);
    ctx.quadraticCurveTo(hx + 0.006, hy + 0.108, 0.278, -0.274);
    ctx.lineTo(0.253, -0.242); ctx.lineTo(0.254, -0.284); ctx.lineTo(0.215, -0.264); ctx.closePath(); ctx.fill();
    if (s >= 13) {
      ctx.strokeStyle = faunaCol(shade, 0, 0.50); ctx.lineWidth = 0.023;
      ctx.beginPath();
      for (const [stripeX, stripeY, length] of [[-0.049, -0.547, 0.113], [0.004, -0.565, 0.147], [0.063, -0.588, 0.171], [0.126, -0.590, 0.180], [0.188, -0.556, 0.166]]) {
        ctx.moveTo(stripeX, stripeY); ctx.quadraticCurveTo(stripeX - 0.033, stripeY + length * 0.58, stripeX + 0.028, stripeY + length);
      }
      ctx.stroke();
    }

    ctx.translate(hx, hy); ctx.rotate(graze ? 1.20 : 0.41);
    ctx.fillStyle = faunaCol('#887a63'); ctx.beginPath(); ctx.moveTo(0.013, -0.059);
    ctx.bezierCurveTo(0.035, -0.123, 0.085, -0.160, 0.051, -0.209);
    ctx.quadraticCurveTo(0.113, -0.176, 0.072, -0.116); ctx.lineTo(0.043, -0.049); ctx.fill();
    ctx.fillStyle = faunaCol(shade); ctx.beginPath(); ctx.moveTo(-0.095, -0.020);
    ctx.quadraticCurveTo(-0.068, -0.090, 0.018, -0.079);
    ctx.bezierCurveTo(0.072, -0.065, 0.136, -0.039, 0.214, -0.027);
    ctx.quadraticCurveTo(0.256, -0.005, 0.228, 0.055);
    ctx.quadraticCurveTo(0.173, 0.088, 0.112, 0.053);
    ctx.lineTo(0.039, 0.060); ctx.lineTo(0.013, 0.167); ctx.lineTo(-0.022, 0.111);
    ctx.lineTo(-0.032, 0.067); ctx.quadraticCurveTo(-0.092, 0.047, -0.095, -0.020); ctx.fill();
    ctx.fillStyle = faunaCol('#67615a'); ctx.beginPath();
    faunaEll(ctx, 0.200, 0.027, 0.053, 0.039, 0.1); faunaEll(ctx, -0.072, -0.046, 0.064, 0.023, -2.55); ctx.fill();
    // The near horn drops outward and hooks up, with a broad base and a fine dark point.
    ctx.fillStyle = faunaCol('#c0ad90'); ctx.beginPath(); ctx.moveTo(0.027, -0.060);
    ctx.bezierCurveTo(-0.038, -0.022, -0.128, -0.008, -0.172, -0.047);
    ctx.quadraticCurveTo(-0.208, -0.095, -0.163, -0.158);
    ctx.quadraticCurveTo(-0.184, -0.068, -0.107, -0.074);
    ctx.quadraticCurveTo(-0.049, -0.077, 0.002, -0.108); ctx.fill();
    ctx.fillStyle = faunaCol('#191a19'); ctx.beginPath();
    faunaEll(ctx, 0.074, -0.029, 0.015, 0.013, 0); faunaEll(ctx, 0.219, 0.011, 0.013, 0.010, 0); ctx.fill();
    ctx.restore();
  },
  /** The Steamwells bison has a short, sloping rump behind a tall shoulder hump and a low, bearded head. */
  bison(ctx, x, y, s, m, a) {
    const [coat, light, shade] = a.K.col;
    const run = m.mv && m.sp > a.K.speed * 1.5, bob = run ? Math.sin(m.ph * 2) * 0.027 : 0;
    faunaShadow(ctx, x, y, s * 0.42, s * 0.084);
    ctx.save(); ctx.translate(x, y); ctx.scale(faunaSide(m) * s, s);
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';

    // Stocky legs with a visible hock on the hind pair. The far feet sit higher in the game's view.
    const leg = (front, far) => {
      const hip = front ? 0.185 : -0.27;
      const stride = m.mv ? Math.sin(m.ph + (front === far ? Math.PI : 0)) : 0;
      const step = stride * (run ? 0.16 : 0.065), foot = hip + step + (far ? 0.055 : 0);
      const ground = (far ? -0.055 : 0) - Math.max(0, stride) * (run ? 0.08 : 0.025);
      const joint = hip + step * 0.40 - (front ? 0.017 : 0.062);
      const top = (front ? -0.305 : -0.29) + bob - (far ? 0.022 : 0);
      ctx.fillStyle = faunaCol(far ? shade : front ? '#492c1d' : coat);
      ctx.beginPath(); ctx.moveTo(hip - 0.055, top); ctx.lineTo(hip + 0.062, top);
      ctx.quadraticCurveTo(hip + 0.062, top + 0.07, joint + 0.028, ground - 0.09);
      ctx.lineTo(foot + 0.029, ground - 0.024); ctx.lineTo(foot - 0.031, ground - 0.025);
      ctx.lineTo(joint - 0.027, ground - 0.088); ctx.quadraticCurveTo(hip - 0.046, top + 0.075, hip - 0.055, top); ctx.fill();
      ctx.fillStyle = faunaCol('#1c1511');
      ctx.beginPath(); ctx.moveTo(foot - 0.030, ground - 0.045); ctx.lineTo(foot + 0.029, ground - 0.046);
      ctx.lineTo(foot + 0.047, ground - 0.006); ctx.lineTo(foot - 0.032, ground); ctx.fill();
    };
    leg(false, true); leg(true, true);
    leg(false, false); leg(true, false);
    ctx.translate(0, bob);

    const tail = -0.435 + 0.028 * Math.sin(FAUNA.t * 2 + m.ph);
    ctx.strokeStyle = faunaCol(shade); ctx.lineWidth = 0.025;
    ctx.beginPath(); ctx.moveTo(-0.37, -0.405); ctx.quadraticCurveTo(-0.44, -0.36, tail, -0.265); ctx.stroke();
    ctx.fillStyle = faunaCol(shade); ctx.beginPath(); faunaEll(ctx, tail, -0.257, 0.023, 0.044, 0.14); ctx.fill();

    const fur = ctx.createLinearGradient(-0.20, -0.60, 0.17, -0.21);
    fur.addColorStop(0, faunaCol(light)); fur.addColorStop(0.42, faunaCol(coat)); fur.addColorStop(1, faunaCol('#3e2518'));
    ctx.fillStyle = fur; ctx.beginPath(); ctx.moveTo(-0.389, -0.362);
    ctx.bezierCurveTo(-0.396, -0.435, -0.31, -0.499, -0.213, -0.500);
    ctx.bezierCurveTo(-0.113, -0.505, -0.073, -0.595, 0.028, -0.651);
    ctx.bezierCurveTo(0.113, -0.712, 0.213, -0.676, 0.251, -0.613);
    ctx.bezierCurveTo(0.292, -0.564, 0.329, -0.490, 0.320, -0.422);
    ctx.quadraticCurveTo(0.338, -0.291, 0.258, -0.212);
    ctx.lineTo(0.222, -0.239); ctx.lineTo(0.181, -0.212); ctx.lineTo(0.141, -0.240);
    ctx.bezierCurveTo(0.050, -0.228, -0.060, -0.259, -0.146, -0.257);
    ctx.bezierCurveTo(-0.254, -0.255, -0.356, -0.268, -0.389, -0.362); ctx.fill();

    // The shaggy mane ends partway down the flank, where the summer coat lies flat.
    ctx.fillStyle = faunaCol('#482d20');
    ctx.beginPath(); ctx.moveTo(0.077, -0.663);
    ctx.bezierCurveTo(0.223, -0.716, 0.255, -0.613, 0.317, -0.474);
    ctx.quadraticCurveTo(0.359, -0.296, 0.258, -0.212);
    ctx.lineTo(0.222, -0.239); ctx.lineTo(0.181, -0.212); ctx.lineTo(0.141, -0.240);
    ctx.lineTo(0.091, -0.253); ctx.lineTo(0.080, -0.291); ctx.lineTo(0.047, -0.279);
    ctx.bezierCurveTo(0.058, -0.424, 0.004, -0.437, 0.045, -0.554);
    ctx.quadraticCurveTo(0.063, -0.608, 0.077, -0.663); ctx.fill();

    if (s >= 17) {
      ctx.strokeStyle = faunaCol('#a7784b', 0, 0.32); ctx.lineWidth = 0.012;
      ctx.beginPath(); ctx.moveTo(-0.33, -0.412); ctx.quadraticCurveTo(-0.29, -0.46, -0.15, -0.466);
      for (const [fx, fy, length] of [[0.062, -0.601, 0.062], [0.103, -0.636, 0.079], [0.161, -0.624, 0.041], [0.194, -0.603, 0.091], [0.094, -0.483, 0.090], [0.142, -0.449, 0.040], [0.189, -0.495, 0.116]]) {
        ctx.moveTo(fx, fy); ctx.quadraticCurveTo(fx - 0.026, fy + length * 0.61, fx - 0.005, fy + length);
      }
      ctx.stroke();
    }

    // Lower the neck as the head pivots, so a grazing muzzle reaches the grass.
    const grazing = !m.head && !m.mv;
    if (grazing) {
      ctx.fillStyle = faunaCol('#482d20');
      ctx.beginPath(); ctx.moveTo(0.219, -0.534);
      ctx.quadraticCurveTo(0.31, -0.529, 0.361, -0.313);
      ctx.lineTo(0.255, -0.260);
      ctx.quadraticCurveTo(0.221, -0.400, 0.195, -0.428); ctx.fill();
    }
    ctx.translate(grazing ? 0.288 : 0.250, grazing ? -0.288 : -0.450);
    ctx.rotate(grazing ? 1.23 + Math.sin(FAUNA.t * 2 + m.ph) * 0.065 : 0.20 + (m.mv ? Math.sin(m.ph) * 0.045 : 0));
    ctx.fillStyle = faunaCol('#342218'); ctx.beginPath(); faunaEll(ctx, 0.101, -0.052, 0.067, 0.032, -0.65); ctx.fill();
    ctx.beginPath(); ctx.moveTo(-0.055, -0.092);
    ctx.bezierCurveTo(0.015, -0.153, 0.118, -0.139, 0.161, -0.079);
    ctx.lineTo(0.267, -0.010); ctx.quadraticCurveTo(0.290, 0.033, 0.224, 0.070);
    ctx.lineTo(0.171, 0.066); ctx.lineTo(0.114, 0.168); ctx.lineTo(0.085, 0.142);
    ctx.lineTo(0.055, 0.160); ctx.lineTo(0.043, 0.105); ctx.quadraticCurveTo(-0.025, 0.104, -0.055, 0.026); ctx.fill();
    ctx.fillStyle = faunaCol('#766153'); ctx.beginPath(); faunaEll(ctx, 0.230, 0.033, 0.053, 0.039, -0.14); ctx.fill();
    ctx.fillStyle = faunaCol('#64442e'); ctx.beginPath(); faunaEll(ctx, -0.017, -0.081, 0.08, 0.039, -0.15); ctx.fill();

    // Short upswept horns, darkest at their roots and points.
    ctx.fillStyle = faunaCol('#c0a788');
    ctx.beginPath(); ctx.moveTo(0.019, -0.096); ctx.quadraticCurveTo(-0.031, -0.108, -0.058, -0.147);
    ctx.quadraticCurveTo(-0.080, -0.190, -0.046, -0.221); ctx.quadraticCurveTo(-0.057, -0.156, 0.032, -0.132); ctx.fill();
    if (s >= 13) {
      ctx.fillStyle = faunaCol('#866e57');
      ctx.beginPath(); ctx.moveTo(0.076, -0.111); ctx.quadraticCurveTo(0.091, -0.171, 0.121, -0.183);
      ctx.quadraticCurveTo(0.111, -0.145, 0.106, -0.104); ctx.fill();
      ctx.fillStyle = faunaCol('#1c1511'); ctx.beginPath();
      faunaEll(ctx, 0.130, -0.047, 0.017, 0.012, 0); faunaEll(ctx, 0.256, 0.027, 0.014, 0.009, 0);
      ctx.fill();
    }
    ctx.restore();
  },
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

  turtle(ctx, x, y, s, m, a) {
    faunaShadow(ctx, x, y, s * 0.39, s * 0.24);
    ctx.save(); ctx.translate(x, y); ctx.rotate(m.f); ctx.scale(s, s);
    const [shell, scutes, skin] = a.K.col, p = m.mv ? Math.sin(m.ph) * 0.12 : 0;
    ctx.fillStyle = faunaCol(skin);
    ctx.beginPath();
    for (const side of [-1, 1]) {
      faunaEll(ctx, 0.14 + side * p, side * 0.225, 0.15, 0.075, side * -0.65);
      faunaEll(ctx, -0.22 - side * p, side * 0.195, 0.13, 0.07, side * 0.75);
    }
    faunaEll(ctx, 0.34, 0.015, 0.17, 0.09, 0); ctx.fill();
    const g = ctx.createLinearGradient(0, -0.24, 0.1, 0.25);
    g.addColorStop(0, faunaCol(scutes)); g.addColorStop(0.39, faunaCol(shell)); g.addColorStop(1, faunaCol(skin));
    ctx.fillStyle = g; ctx.beginPath(); faunaEll(ctx, -0.025, 0, 0.35, 0.26, 0); ctx.fill();
    ctx.strokeStyle = faunaCol(skin, 0, 0.72); ctx.lineWidth = 0.028;
    ctx.beginPath(); ctx.moveTo(-0.35, 0); ctx.lineTo(-0.17, -0.10); ctx.lineTo(0.06, -0.12); ctx.lineTo(0.22, 0);
    ctx.lineTo(0.06, 0.11); ctx.lineTo(-0.17, 0.10); ctx.closePath();
    for (const side of [-1, 1]) { ctx.moveTo(-0.17, side * 0.1); ctx.lineTo(-0.2, side * 0.22); ctx.moveTo(0.06, side * 0.11); ctx.lineTo(0.12, side * 0.2); }
    ctx.stroke(); ctx.restore();
  },

  /** Blackwater's broad-snouted alligator, seen from above with a muscular, flexing tail. */
  alligator(ctx, x, y, s, m, a) {
    faunaShadow(ctx, x - Math.cos(m.f) * s * 0.12, y, s * 0.46, s * 0.14);
    ctx.save(); ctx.translate(x, y); ctx.rotate(m.f); ctx.scale(s, s);
    const [olive, ridge, dark] = a.K.col;
    const wag = Math.sin((m.mv ? m.ph * 0.76 : FAUNA.t * 1.3) + 0.25) * (m.mv ? 0.23 : 0.075);
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    for (const side of [-1, 1]) for (const front of [false, true]) {
      const hip = front ? 0.17 : -0.24, stride = m.mv ? Math.sin(m.ph + (front === (side > 0) ? 0 : Math.PI)) * 0.085 : 0;
      const knee = hip - (front ? 0.078 : 0.102) + stride * 0.5, foot = hip + (front ? 0.047 : -0.01) + stride;
      ctx.strokeStyle = faunaCol(dark); ctx.lineWidth = front ? 0.070 : 0.087;
      ctx.beginPath(); ctx.moveTo(hip, side * 0.085); ctx.quadraticCurveTo(knee - 0.025, side * 0.157, knee, side * 0.202);
      ctx.quadraticCurveTo(knee + 0.011, side * 0.24, foot, side * 0.25); ctx.stroke();
      ctx.fillStyle = faunaCol(olive);
      ctx.beginPath(); faunaEll(ctx, foot, side * 0.25, 0.05, 0.025, side * 0.28); ctx.fill();
      if (s >= 15) {
        ctx.strokeStyle = faunaCol(olive); ctx.lineWidth = 0.012;
        ctx.beginPath();
        for (const toe of [-1, 0, 1]) {
          ctx.moveTo(foot + 0.012, side * (0.25 + toe * 0.011));
          ctx.quadraticCurveTo(foot + 0.043, side * (0.251 + toe * 0.018), foot + 0.073 - Math.abs(toe) * 0.01, side * (0.258 + toe * 0.026));
        }
        ctx.stroke();
      }
    }

    const tail = ctx.createLinearGradient(-0.88, wag * 0.4, -0.24, 0.035);
    tail.addColorStop(0, faunaCol(dark)); tail.addColorStop(1, faunaCol(olive));
    ctx.fillStyle = tail; ctx.beginPath(); ctx.moveTo(-0.229, -0.098);
    ctx.bezierCurveTo(-0.55, -0.119, -0.84, wag - 0.11, -1.048, wag * 0.68);
    ctx.bezierCurveTo(-0.98, wag + 0.049, -0.67, 0.026 + wag * 0.45, -0.412, 0.068);
    ctx.quadraticCurveTo(-0.32, 0.102, -0.221, 0.112); ctx.fill();

    const skin = ctx.createLinearGradient(0, -0.17, 0, 0.18);
    skin.addColorStop(0, faunaCol('#7b8969')); skin.addColorStop(0.38, faunaCol(olive)); skin.addColorStop(1, faunaCol(dark));
    ctx.fillStyle = skin; ctx.beginPath(); ctx.moveTo(-0.449, -0.057);
    ctx.bezierCurveTo(-0.329, -0.116, -0.177, -0.198, 0.013, -0.154);
    ctx.bezierCurveTo(0.194, -0.125, 0.214, -0.091, 0.350, -0.088);
    ctx.lineTo(0.384, 0.095);
    ctx.bezierCurveTo(0.162, 0.135, 0.011, 0.180, -0.134, 0.161);
    ctx.quadraticCurveTo(-0.340, 0.142, -0.444, 0.058);
    ctx.quadraticCurveTo(-0.484, 0.002, -0.449, -0.057); ctx.fill();

    // Two main rows of raised scutes and a taper of paired ridges down the tail.
    for (const side of [-1, 1]) {
      for (let k = 0; k < 6; k++) {
        const xx = -0.366 + k * 0.081, yy = side * (0.046 + Math.sin(k * Math.PI / 7) * 0.024);
        ctx.fillStyle = faunaCol(dark); ctx.beginPath(); ctx.moveTo(xx - 0.028, yy);
        ctx.lineTo(xx + 0.004, yy - 0.030); ctx.lineTo(xx + 0.034, yy - 0.004);
        ctx.lineTo(xx + 0.016, yy + 0.025); ctx.closePath(); ctx.fill();
        if (s >= 14) {
          ctx.strokeStyle = faunaCol(ridge, 0, 0.7); ctx.lineWidth = 0.010;
          ctx.beginPath(); ctx.moveTo(xx - 0.020, yy - 0.002); ctx.lineTo(xx + 0.006, yy - 0.021);
          ctx.lineTo(xx + 0.027, yy - 0.007); ctx.stroke();
        }
      }
      if (s >= 14) {
        ctx.strokeStyle = faunaCol(ridge, 0, 0.64); ctx.lineWidth = 0.014;
        ctx.beginPath(); ctx.moveTo(-0.36, side * 0.038);
        ctx.quadraticCurveTo(-0.656, side * 0.034 + wag * 0.19, -0.914, wag * 0.65 + side * 0.010); ctx.stroke();
      }
    }

    // Raised eyes at the skull, a narrowing at the jaw hinge and a wide U-shaped snout.
    const head = ctx.createLinearGradient(0.37, -0.114, 0.37, 0.110);
    head.addColorStop(0, faunaCol(ridge)); head.addColorStop(0.52, faunaCol(olive)); head.addColorStop(1, faunaCol(dark));
    ctx.fillStyle = faunaCol('#23332d'); ctx.beginPath(); faunaEll(ctx, 0.455, 0.016, 0.24, 0.108, 0); ctx.fill();
    ctx.fillStyle = head; ctx.beginPath(); ctx.moveTo(0.233, -0.076);
    ctx.quadraticCurveTo(0.296, -0.126, 0.366, -0.100);
    ctx.quadraticCurveTo(0.430, -0.059, 0.486, -0.076);
    ctx.quadraticCurveTo(0.629, -0.109, 0.666, -0.058);
    ctx.quadraticCurveTo(0.711, 0.001, 0.664, 0.056);
    ctx.quadraticCurveTo(0.618, 0.102, 0.484, 0.072);
    ctx.quadraticCurveTo(0.420, 0.071, 0.352, 0.101);
    ctx.quadraticCurveTo(0.275, 0.117, 0.231, 0.072); ctx.fill();
    for (const side of [-1, 1]) {
      ctx.fillStyle = faunaCol('#384839'); ctx.beginPath(); faunaEll(ctx, 0.335, side * 0.076, 0.052, 0.031, side * -0.32); ctx.fill();
      ctx.fillStyle = faunaCol('#c8b677'); ctx.beginPath(); faunaEll(ctx, 0.366, side * 0.079, 0.020, 0.012, side * -0.28); ctx.fill();
      if (s >= 12) {
        ctx.fillStyle = faunaCol('#182722'); ctx.beginPath();
        faunaEll(ctx, 0.370, side * 0.079, 0.008, 0.009, 0); faunaEll(ctx, 0.625, side * 0.031, 0.018, 0.010, side * 0.43); ctx.fill();
      }
    }
    ctx.restore();
  },

  /** The hinge-back opens segmented shell plates as its soft body flexes. */
  hinge(ctx, x, y, s, m, a) {
    faunaShadow(ctx, x, y, s * 0.42, s * 0.17);
    ctx.save(); ctx.translate(x, y); ctx.rotate(m.f); ctx.scale(s, s);
    const [shell, seam, shade] = a.K.col;
    const gap = 0.021 + 0.024 * (0.5 + 0.5 * Math.sin(FAUNA.t * 1.6 + m.ph));
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    for (const side of [-1, 1]) for (let k = 0; k < 3; k++) {
      const root = -0.265 + k * 0.217, swing = m.mv ? Math.sin(m.ph + side * Math.PI * 0.5 + k * 2.05) * 0.087 : 0;
      const knee = root + (k - 1) * 0.125 + swing * 0.7;
      const foot = knee - 0.066 + swing * 0.45, span = side * (0.31 - 0.015 * Math.abs(k - 1));
      ctx.strokeStyle = faunaCol(shade, 0.26); ctx.lineWidth = 0.071;
      ctx.beginPath(); ctx.moveTo(root, side * 0.087); ctx.quadraticCurveTo(knee + 0.037, side * 0.165, knee, side * 0.234); ctx.stroke();
      ctx.strokeStyle = faunaCol(shell, 0.34); ctx.lineWidth = 0.042;
      ctx.beginPath(); ctx.moveTo(knee, side * 0.225); ctx.quadraticCurveTo(knee - 0.037, side * 0.264, foot, span); ctx.stroke();
      ctx.fillStyle = faunaCol(shade, 0.30); ctx.beginPath(); faunaEll(ctx, foot - 0.014, span, 0.034, 0.017, side * 0.36); ctx.fill();
    }
    ctx.fillStyle = faunaCol(shade, 0.27); ctx.beginPath(); faunaEll(ctx, -0.09, 0, 0.39, 0.207, 0); ctx.fill();
    ctx.fillStyle = faunaCol(seam, 0.61); ctx.beginPath(); faunaEll(ctx, -0.089, 0, 0.336, gap, 0); ctx.fill();

    const armor = bloomShell(ctx, shell, shade, -0.225, 0.258);
    const widths = [0.148, 0.200, 0.220, 0.171];
    for (const side of [-1, 1]) {
      for (let k = 0; k < widths.length; k++) {
        const root = -0.459 + k * 0.166, width = widths[k];
        ctx.fillStyle = armor; ctx.beginPath(); ctx.moveTo(root, side * gap * 1.02);
        ctx.quadraticCurveTo(root - 0.037, side * (gap + width * 0.94), root + 0.089, side * width);
        ctx.quadraticCurveTo(root + 0.161, side * (width + 0.027), root + 0.195, side * (width * 0.70));
        ctx.quadraticCurveTo(root + 0.209, side * width * 0.30, root + 0.152, side * gap);
        ctx.quadraticCurveTo(root + 0.082, side * (gap * 0.27), root, side * gap); ctx.fill();
        if (s >= 14) {
          ctx.strokeStyle = faunaCol('#dec1c3', 0.30, 0.44); ctx.lineWidth = 0.013;
          ctx.beginPath(); ctx.moveTo(root + 0.030, side * (width * 0.84));
          ctx.quadraticCurveTo(root + 0.091, side * (width + 0.005), root + 0.160, side * (width * 0.71)); ctx.stroke();
        }
      }
    }
    ctx.fillStyle = faunaCol(shade, 0.25); ctx.beginPath(); faunaEll(ctx, 0.350, 0, 0.167, 0.117, 0); ctx.fill();
    ctx.fillStyle = bloomShell(ctx, shell, shade, -0.106, 0.104);
    ctx.beginPath(); ctx.moveTo(0.273, -0.116); ctx.bezierCurveTo(0.392, -0.139, 0.474, -0.083, 0.502, -0.015);
    ctx.bezierCurveTo(0.481, 0.093, 0.377, 0.136, 0.273, 0.116);
    ctx.quadraticCurveTo(0.295, 0, 0.273, -0.116); ctx.fill();
    bloomEyes(ctx, 0.430, 0.053, seam, s);
    ctx.restore();
  },

  /** The switchtail braces on two hooked feet and balances with independently flexing tails. */
  switchtail(ctx, x, y, s, m, a) {
    faunaShadow(ctx, x, y, s * 0.41, s * 0.09);
    ctx.save(); ctx.translate(x, y); ctx.scale(faunaSide(m) * s, s);
    const [shell, seam, shade] = a.K.col, stride = m.mv ? Math.sin(m.ph) : 0;
    const bob = m.mv ? Math.cos(m.ph * 2) * 0.025 : 0;
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    for (const side of [-1, 1]) {
      const step = side * stride * 0.13, rise = side < 0 ? -0.052 : 0;
      ctx.strokeStyle = faunaCol(side < 0 ? shade : shell, 0.30); ctx.lineWidth = side < 0 ? 0.064 : 0.079;
      ctx.beginPath(); ctx.moveTo(-0.069, -0.292 + bob);
      ctx.quadraticCurveTo(0.059 + step * 0.58, -0.252, 0.035 + step * 0.57, -0.177 + rise);
      ctx.lineTo(-0.100 + step, -0.100 + rise); ctx.stroke();
      ctx.strokeStyle = faunaCol(shade, 0.3); ctx.lineWidth = 0.034;
      ctx.beginPath(); ctx.moveTo(-0.100 + step, -0.101 + rise);
      ctx.lineTo(-0.043 + step, -0.020 + rise); ctx.quadraticCurveTo(-0.004 + step, -0.038 + rise, 0.035 + step, -0.010 + rise); ctx.stroke();
    }
    ctx.translate(0, bob);
    for (const side of [-1, 1]) {
      const tip = -0.252 + side * (0.116 + stride * 0.067);
      ctx.fillStyle = faunaCol(side < 0 ? shade : shell, 0.34);
      ctx.beginPath(); ctx.moveTo(-0.243, -0.341 + side * 0.015);
      ctx.bezierCurveTo(-0.458, -0.281 + side * 0.068, -0.605, tip + 0.083, -0.760, tip);
      ctx.bezierCurveTo(-0.596, tip + 0.026, -0.477, -0.369 + side * 0.057, -0.215, -0.394 + side * 0.015); ctx.fill();
    }

    ctx.fillStyle = bloomShell(ctx, shell, shade, -0.49, -0.22);
    ctx.beginPath(); ctx.moveTo(-0.352, -0.333);
    ctx.bezierCurveTo(-0.286, -0.446, -0.091, -0.469, 0.073, -0.422);
    ctx.quadraticCurveTo(0.138, -0.400, 0.163, -0.473);
    ctx.quadraticCurveTo(0.222, -0.557, 0.297, -0.513);
    ctx.quadraticCurveTo(0.333, -0.435, 0.242, -0.379);
    ctx.bezierCurveTo(0.148, -0.320, 0.072, -0.243, -0.060, -0.247);
    ctx.quadraticCurveTo(-0.234, -0.254, -0.352, -0.333); ctx.fill();

    // Leaf-thin sensory vanes fold back while moving. Their warm edges match the hinge-back's seams.
    for (const side of [-1, 1]) {
      const root = side < 0 ? 0.237 : 0.188, tip = root - (m.mv ? 0.18 : 0.095);
      const crest = side < 0 ? -0.696 : -0.742;
      const vane = ctx.createLinearGradient(root, -0.509, tip, crest);
      vane.addColorStop(0, faunaCol(shade, 0.38)); vane.addColorStop(1, faunaCol(seam, 0.61));
      ctx.fillStyle = vane; ctx.beginPath(); ctx.moveTo(root + 0.052, -0.514);
      ctx.quadraticCurveTo(root + 0.038, crest + 0.078, tip, crest);
      ctx.quadraticCurveTo(tip - 0.078, crest + 0.135, root - 0.028, -0.515); ctx.fill();
    }
    ctx.fillStyle = faunaCol(shade, 0.36); ctx.beginPath(); ctx.moveTo(0.186, -0.494);
    ctx.bezierCurveTo(0.248, -0.559, 0.373, -0.548, 0.422, -0.477);
    ctx.quadraticCurveTo(0.389, -0.423, 0.311, -0.422);
    ctx.quadraticCurveTo(0.236, -0.418, 0.186, -0.494); ctx.fill();
    ctx.strokeStyle = faunaCol('#c6a0aa', 0.49, 0.75); ctx.lineWidth = 0.024;
    ctx.beginPath(); ctx.moveTo(-0.283, -0.373);
    ctx.quadraticCurveTo(-0.172, -0.425, -0.043, -0.394); ctx.quadraticCurveTo(0.038, -0.362, 0.110, -0.388); ctx.stroke();
    if (s >= 15) {
      ctx.strokeStyle = faunaCol(shade, 0.28, 0.56); ctx.lineWidth = 0.012;
      ctx.beginPath();
      for (let k = 0; k < 4; k++) {
        const px = -0.214 + k * 0.073;
        ctx.moveTo(px, -0.386); ctx.quadraticCurveTo(px + 0.032, -0.362, px + 0.047, -0.313);
      }
      ctx.stroke();
    }
    ctx.save(); ctx.translate(0.342, -0.490); ctx.rotate(0.25);
    bloomEyes(ctx, 0, 0.029, seam, s);
    ctx.restore(); ctx.restore();
  },

  /** The sailwing's living membranes flex along their ribs and bank with the animal. */
  sailwing(ctx, x, y, s, m, a, part) {
    ctx.save(); ctx.translate(x, y); ctx.rotate(m.f); ctx.scale(s, s);
    const [shell, seam, shade] = a.K.col, shadow = part === 'shadow';
    const bank = Math.sin(m.ph * 0.44) * 0.12, beat = Math.sin(m.ph * 1.18);
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    for (const side of [-1, 1]) {
      const span = side * (0.72 + 0.12 * beat + side * bank), tip = -0.233 - 0.09 * beat;
      ctx.fillStyle = '#111';
      if (!shadow) {
        const sail = ctx.createLinearGradient(0, 0, tip, span);
        sail.addColorStop(0, faunaCol(shade, 0.31)); sail.addColorStop(0.52, faunaCol(shell, 0.39));
        sail.addColorStop(1, faunaCol('#d9a5af', 0.50));
        ctx.fillStyle = sail;
      }
      ctx.beginPath(); ctx.moveTo(0.226, side * 0.087);
      ctx.bezierCurveTo(0.252, span * 0.44, 0.061, span * 0.83, tip, span);
      ctx.quadraticCurveTo(tip + 0.016, span * 0.70, -0.393, span * 0.66);
      ctx.quadraticCurveTo(-0.241, span * 0.46, -0.457, span * 0.38);
      ctx.quadraticCurveTo(-0.252, span * 0.27, -0.273, side * 0.048); ctx.fill();
      if (shadow) continue;
      ctx.strokeStyle = faunaCol('#ebbbc1', 0.55, 0.65); ctx.lineWidth = 0.019;
      ctx.beginPath(); ctx.moveTo(0.220, side * 0.087);
      ctx.bezierCurveTo(0.247, span * 0.44, 0.061, span * 0.83, tip, span); ctx.stroke();
      if (s >= 13) {
        ctx.strokeStyle = faunaCol(shade, 0.34, 0.74); ctx.lineWidth = 0.018;
        ctx.beginPath();
        ctx.moveTo(0.176, side * 0.091); ctx.quadraticCurveTo(0.119, span * 0.57, tip, span);
        ctx.moveTo(0.045, side * 0.088); ctx.quadraticCurveTo(-0.046, span * 0.46, -0.393, span * 0.66);
        ctx.moveTo(-0.089, side * 0.074); ctx.quadraticCurveTo(-0.226, span * 0.30, -0.457, span * 0.38); ctx.stroke();
      }
    }

    ctx.fillStyle = shadow ? '#111' : bloomShell(ctx, shell, shade, -0.114, 0.118);
    ctx.beginPath(); ctx.moveTo(-0.649, 0);
    ctx.quadraticCurveTo(-0.381, -0.065, -0.220, -0.112);
    ctx.bezierCurveTo(0.024, -0.194, 0.326, -0.104, 0.460, 0);
    ctx.bezierCurveTo(0.326, 0.103, 0.032, 0.195, -0.222, 0.108);
    ctx.quadraticCurveTo(-0.400, 0.049, -0.649, 0); ctx.fill();
    if (!shadow) {
      ctx.strokeStyle = faunaCol(seam, 0.54, 0.85); ctx.lineWidth = 0.024;
      ctx.beginPath(); ctx.moveTo(-0.405, 0);
      ctx.quadraticCurveTo(-0.133, -0.014, 0.248, 0); ctx.stroke();
      bloomEyes(ctx, 0.343, 0.037, seam, s);
    }
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

  /** A big bird on the air: a vulture, a hawk, a crow or a raven, gliding round (a few beats now and then). */
  raptor(ctx, x, y, s, m, a, part) {
    const beat = Math.sin(m.ph * 0.5) > 0.85;
    faunaWings(ctx, x, y, s, m.f, beat ? m.ph * 7 : 0, a.K.col, part === 'shadow' ? 'shadow' : true, { glide: !beat, broad: true, band: a.kind === 'vulture' || a.kind === 'hawk' });
  },
};

/* ------------------------------------------------------------------ marine wildlife */

/** Open liquid water, including on a tidal map after the tide has changed. */
function marineWater(x, y) {
  const i = Math.floor(x), j = Math.floor(y);
  if (!faunaWet(i, j)) return false;
  const t = tIdx(i, j);
  return !(S.road[t] || S.rail[t] || S.ford?.[t] || S.tidal?.[t]);
}

/** Stable, short appearances in open water that neither ships nor the simulation have to track. */
function drawSeaLife(ctx, ox, oy, z, v0, v1) {
  if (!navalMap() || z < 12 || (LESS_MOTION && LESS_MOTION.matches) || biome() === 'lunar' || biome() === 'volcanic') return;
  const cell = 7, now = R.time, seed = S.seed | 0, night = TOD.active ? TOD.state.lights : 0;
  let budget = gfxStep() === 'saver' ? 3 : 9;
  ctx.save();
  for (let j = Math.max(0, Math.floor(v0.y / cell) - 1); j <= Math.min(S.H / cell, v1.y / cell + 1) && budget > 0; j++) {
    for (let i = Math.max(0, Math.floor(v0.x / cell) - 1); i <= Math.min(S.W / cell, v1.x / cell + 1) && budget > 0; i++) {
      const period = 13 + 12 * hash2(i, j, seed + 371);
      const clock = now + period * hash2(j, i, seed + 372), cycle = Math.floor(clock / period), age = clock - cycle * period;
      const toss = hash2(i * 11 + cycle, j * 5, seed + 373);
      const kind = toss < 0.61 ? 'fish' : toss < 0.94 ? 'dolphin' : 'whale';
      const duration = kind === 'whale' ? 4.6 : kind === 'dolphin' ? 3.7 : 2.4;
      if (age >= duration) continue;
      const x = i * cell + 1.1 + (cell - 2.2) * hash2(i, j + cycle * 7, seed + 374);
      const y = j * cell + 1.1 + (cell - 2.2) * hash2(i - cycle * 11, j, seed + 375);
      const angle = hash2(i + cycle, j, seed + 376) * Math.PI * 2, dx = Math.cos(angle), dy = Math.sin(angle);
      const width = kind === 'whale' ? 2.6 : kind === 'dolphin' ? 1.55 : 0.7;
      if (!marineWater(x, y) || !marineWater(x - dx * width, y - dy * width) || !marineWater(x + dx * width, y + dy * width) ||
        !marineWater(x - dy * width * 0.55, y + dx * width * 0.55) || !marineWater(x + dy * width * 0.55, y - dx * width * 0.55)) continue;
      if (kind === 'whale' && (!marineWater(x - 2.6, y - 2.6) || !marineWater(x + 2.6, y + 2.6))) continue;
      ctx.globalAlpha = (1 - 0.62 * night) * Math.min(1, age * 5, (duration - age) * 2.5);
      if (kind === 'whale') drawWhaleBlow(ctx, ox + x * z, oy + y * z, z, angle, age);
      else {
        const dolphin = kind === 'dolphin', spacing = dolphin ? 0.12 : 0.18;
        for (let k = 0; k < (dolphin ? 2 : 3); k++) {
          const local = age - k * (dolphin ? 0.48 : 0.23);
          if (local <= 0 || local >= duration - 0.65) continue;
          const run = (local / (duration - 0.65) - 0.5) * width * 1.8 - k * spacing;
          const side = (k % 2 ? -1 : 1) * k * spacing;
          const sx = x + dx * run - dy * side, sy = y + dy * run + dx * side;
          if (marineWater(sx, sy)) drawSeaLeap(ctx, ox + sx * z, oy + sy * z, z, angle, local, dolphin);
        }
      }
      budget--;
    }
  }
  ctx.restore();
}

function marineRipple(ctx, x, y, z, p, strength) {
  ctx.save();
  ctx.globalAlpha *= strength * (1 - p);
  ctx.strokeStyle = '#c8eadf'; ctx.lineWidth = Math.max(0.55, z * 0.016);
  const size = (0.07 + p * 0.36) * z;
  ctx.beginPath(); ctx.ellipse(x, y, size, size * 0.48, 0, 0, Math.PI * 2); ctx.stroke();
  ctx.restore();
}

function drawSeaLeap(ctx, x, y, z, angle, time, dolphin) {
  const cycle = dolphin ? 1.48 : 0.83, flight = dolphin ? 0.72 : 0.40;
  const t = time % cycle, p = t / flight;
  if (p >= 1) { marineRipple(ctx, x, y, z, Math.min(1, (t - flight) * 2.7), dolphin ? 0.85 : 0.6); return; }
  const rise = Math.sin(p * Math.PI) * z * (dolphin ? 0.48 : 0.24), size = z * (dolphin ? 0.47 : 0.21);
  if (p < 0.2 || p > 0.8) marineRipple(ctx, x, y, z, p < 0.2 ? p * 2 : (p - 0.8) * 2, 0.84);
  ctx.save();
  ctx.translate(x, y - rise);
  const left = Math.cos(angle) < 0;
  if (left) ctx.scale(-1, 1);
  ctx.rotate(Math.sin(angle) * (left ? -0.43 : 0.43) + (p - 0.5) * 0.99);
  ctx.scale(size, size);
  const g = ctx.createLinearGradient(0, -0.26, 0, 0.25);
  g.addColorStop(0, dolphin ? '#244858' : '#427585');
  g.addColorStop(0.52, dolphin ? '#789fa7' : '#a4cbbe');
  g.addColorStop(1, '#d6e4d4');
  ctx.fillStyle = g;
  if (!dolphin) {
    ctx.beginPath(); ctx.moveTo(-0.24, 0);
    ctx.quadraticCurveTo(0.04, -0.36, 0.43, -0.04);
    ctx.quadraticCurveTo(0.2, 0.27, -0.24, 0.09);
    ctx.lineTo(-0.61, 0.24); ctx.lineTo(-0.48, 0.04); ctx.lineTo(-0.64, -0.17);
    ctx.closePath(); ctx.fill(); ctx.restore(); return;
  }
  ctx.beginPath(); ctx.moveTo(-0.42, 0.02);
  ctx.bezierCurveTo(-0.20, -0.13, 0.10, -0.35, 0.37, -0.21);
  ctx.quadraticCurveTo(0.45, -0.18, 0.44, -0.07);
  ctx.quadraticCurveTo(0.64, -0.03, 0.54, 0.045);
  ctx.quadraticCurveTo(0.18, 0.08, -0.43, 0.09);
  ctx.lineTo(-0.66, 0.21); ctx.lineTo(-0.57, 0.045); ctx.lineTo(-0.72, -0.12); ctx.closePath(); ctx.fill();
  ctx.fillStyle = '#365d6d';
  ctx.beginPath(); ctx.moveTo(-0.18, -0.18);
  ctx.quadraticCurveTo(-0.28, -0.40, -0.06, -0.39); ctx.lineTo(0.12, -0.23); ctx.fill();
  ctx.restore();
}

function drawWhaleBlow(ctx, x, y, z, angle, age) {
  const fade = Math.sin(Math.PI * Math.min(1, age / 4.5));
  marineRipple(ctx, x, y + z * 0.1, z * 2.5, (age * 0.6) % 1, fade * 0.55);
  ctx.save();
  ctx.globalAlpha *= 0.55 * fade;
  ctx.translate(x, y); ctx.rotate(angle);
  ctx.fillStyle = '#1e485a'; ctx.beginPath(); ctx.ellipse(0, 0, z * 0.77, z * 0.19, 0, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = '#70969f'; ctx.lineWidth = Math.max(0.6, z * 0.021);
  ctx.beginPath(); ctx.ellipse(0, 0, z * 0.67, z * 0.135, 0, Math.PI * 1.08, Math.PI * 1.85); ctx.stroke();
  ctx.restore();
  const mist = wxCloud('225,240,236'), t = age - 0.45;
  if (t <= 0 || t > 2.4) return;
  ctx.save();
  const alpha = ctx.globalAlpha;
  for (let k = 0; k < 7; k++) {
    const p = t - k * 0.1;
    if (p < 0 || p > 1.65) continue;
    const up = Math.min(1, p * 1.8), width = z * (0.17 + p * 0.24);
    ctx.globalAlpha = alpha * 0.8 * (1 - p / 1.65);
    for (const side of [-1, 1]) {
      const xx = x + (side * up * up * (0.16 + p * 0.12) + p * 0.09) * z, yy = y - z * (0.08 + up * 1.12);
      ctx.drawImage(mist, xx - width / 2, yy - width / 2, width, width);
    }
  }
  ctx.restore();
}

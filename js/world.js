'use strict';
/*
 * Botfall — world state: map generation, entities, territory, placement rules, save/load.
 *
 * All game state lives in the global `S` and is plain JSON-friendly data (entities refer to
 * each other by numeric id, never by object reference), so saving is just serialising S.
 */

let S = null;

function tIdx(i, j) { return j * S.W + i; }
function inMap(i, j) { return i >= 0 && j >= 0 && i < S.W && j < S.H; }
function getE(id) { return id ? S.byId.get(id) || null : null; }

/* ------------------------------------------------------------------ map generation */

/**
 * Generates a point-symmetric map (rotated 180°) so both sides are equally fair.
 * Player 0 starts near the bottom, player 1 near the top.
 *
 * Terrain has several elevation levels. Cliffs between levels block bots; slopes (ramps)
 * at a few narrow passes connect them, so every reachable area is linked but routes can be long.
 * cfg.rough (0 flat … 4 mountainous) and cfg.rich (0 scarce … 4 abundant) come from the
 * new-game settings.
 */
function generateMap(seed, W, H, cfg) {
  cfg = cfg || {};
  const TPR = TERRAIN_PRESETS[cfg.rough ?? DEFAULT_ROUGH];
  const RPR = RESOURCE_PRESETS[cfg.rich ?? DEFAULT_RICH];
  const N = W * H;
  const terrain = new Uint8Array(N), res = new Uint8Array(N), amt = new Uint8Array(N);
  const elev = new Uint8Array(N), ramp = new Uint8Array(N);
  const id = (i, j) => j * W + i;
  const mir = (t) => N - 1 - t; // the tile rotated 180° about the map centre
  const sH = seed * 7 + 11, sM = seed * 13 + 5, sB = seed * 31 + 9, sC = seed * 17 + 3, sR = seed * 3 + 1;
  const sE = seed * 19 + 23, sO = seed * 29 + 41;
  const half = Math.floor(H / 2);
  const L = TPR.levels;
  const thresholds = [];
  const step = L >= 5 ? 0.07 : L >= 4 ? 0.085 : 0.1;
  for (let k = 0; k < L - 1; k++) thresholds.push(0.5 + (k - (L - 2) / 2) * step);
  const baseLevel = Math.floor((L - 1) / 2);
  const dens = RPR.density;

  // 1) Terrain and elevation for the bottom half.
  for (let j = half; j < H; j++) {
    for (let i = 0; i < W; i++) {
      const h = fbm(i / 8.5, j / 8.5, sH, 4);
      const t = id(i, j);
      terrain[t] = h > TPR.rock ? T_ROCK : h < 0.29 ? T_WATER : T_GROUND;
      const e = fbm(i / TPR.scale, j / TPR.scale, sE, 3);
      let lv = 0;
      for (const th of thresholds) if (e >= th) lv++;
      elev[t] = lv;
    }
  }
  // 2) Resources come in separate fields (clusters) with open ground between them, so holding
  //    the land around a field matters. Fields are laid out on the bottom half, then mirrored.
  const rng = makeRng(seed ^ 0x5bd1e995);
  const bx = Math.floor(W / 2), by = H - 7;
  const fert = new Uint8Array(N);
  const F_FERTILE = 100;
  const stampDens = clamp(dens, 0.7, 1.15);
  const fields = [];
  // force: the field and a ring of ground around it become open land, so it is never cut off by
  // water or crags (used for the guaranteed fields). Fields near the base sit on its terrace.
  const field = (cx, cy, rad, type, fill, force) => {
    fields.push({ x: cx, y: cy, r: rad });
    const near = dist2(cx, cy, bx, by) < 100;
    if (force && type !== -1) {
      const m = rad + 1.5;
      for (let j = Math.floor(cy - m); j <= Math.ceil(cy + m); j++) {
        for (let i = Math.floor(cx - m); i <= Math.ceil(cx + m); i++) {
          if (i < 1 || j < half || i >= W - 1 || j >= H - 1 || dist2(i, j, cx, cy) > m * m) continue;
          terrain[id(i, j)] = T_GROUND;
          if (near) elev[id(i, j)] = baseLevel;
        }
      }
    }
    for (let j = Math.floor(cy - rad); j <= Math.ceil(cy + rad); j++) {
      for (let i = Math.floor(cx - rad); i <= Math.ceil(cx + rad); i++) {
        if (i < 1 || j < half || i >= W - 1 || j >= H - 1) continue;
        const d2 = dist2(i, j, cx, cy);
        if (d2 > rad * rad) continue;
        const t = id(i, j);
        if (force) terrain[t] = T_GROUND;
        else if (terrain[t] !== T_GROUND) continue;
        if (type === -1) { res[t] = R_NONE; fert[t] = 0; elev[t] = baseLevel; continue; }
        // Denser in the middle of the field, thinning out at the edge.
        if (rng() >= fill * (1 - 0.45 * d2 / (rad * rad + 0.01))) continue;
        if (type === F_FERTILE) { fert[t] = 1; res[t] = R_NONE; } else { res[t] = type; fert[t] = 0; }
      }
    }
  };
  const jit = () => Math.floor(rng() * 3) - 1;
  // The landing zone is one flat terrace so the starter fields are always within easy reach.
  for (let j = by - 7; j <= Math.min(H - 1, by + 7); j++) {
    for (let i = bx - 7; i <= bx + 7; i++) if (dist2(i, j, bx, by) <= 49.5) elev[id(i, j)] = baseLevel;
  }
  // Starter fields inside the landing zone.
  field(bx - 6 + jit(), by - 2 + jit(), 2.5, R_STALK, 0.85 * stampDens, true);
  field(bx - 4, by + 4, 1.4, R_STALK, 0.8 * stampDens, true);
  field(bx + 6 + jit(), by + jit(), 1.8, R_BOULDER, 0.8 * stampDens, true);
  field(bx - 4 + jit(), by - 5, 1.3, R_ORE, 0.9 * stampDens, true);
  field(bx + 4 + jit(), by - 5, 1.3, R_CRYSTAL, 0.9 * stampDens, true);
  field(bx + 2, by + 4, 1.2, R_BOULDER, 0.7 * stampDens, true);
  field(bx, by - 7.5, 2.0, F_FERTILE, 0.85, true);
  // Richer fields just beyond the starting border reward expanding with Outposts.
  field(bx + 8 + jit(), by - 11 + jit(), 1.6, R_ORE, 0.8 * stampDens, true);
  field(bx - 9 + jit(), by - 10 + jit(), 1.5, R_CRYSTAL, 0.8 * stampDens, true);
  field(bx + 1 + jit(), by - 13, 1.1, R_OIL, 0.9, true);
  // Contested fields near the middle (mirrored, so there is one on each side) and an oil field
  // right in the centre that both sides want.
  field(Math.floor(W / 2) - 6, half + 3, 1.7, R_ORE, 0.85, true);
  field(Math.floor(W / 2) + 5, half + 2, 1.4, R_CRYSTAL, 0.85, true);
  field(Math.floor(W / 2) - 1, half + 1, 1.2, R_OIL, 0.9, true);
  // More fields scattered over the rest of the half, kept apart from each other and the base.
  // Richer settings mean more fields and slightly bigger ones. Rare fields are placed first so a
  // crowded map never squeezes them out.
  const areaK = (W * H) / (40 * 56), rK = Math.pow(dens, 0.25);
  const want = (n) => { const x = n * areaK * Math.sqrt(dens); return Math.floor(x) + (rng() < x - Math.floor(x) ? 1 : 0); };
  const bag = [];
  const add = (n, type, r0, r1, fill) => { for (let k = want(n); k > 0; k--) bag.push({ type, r: (r0 + rng() * (r1 - r0)) * rK, fill }); };
  add(0.6, R_OIL, 0.9, 1.2, 0.9);
  add(1.5, F_FERTILE, 1.8, 2.5, 0.85);
  add(2, R_ORE, 1.3, 1.7, 0.8);
  add(2, R_CRYSTAL, 1.2, 1.6, 0.8);
  add(4, R_BOULDER, 1.4, 2.0, 0.75);
  add(5, R_STALK, 2.2, 3.0, 0.75);
  for (const f of bag) {
    for (let tries = 0, gap = 1.5; tries < 80; tries++) {
      if (tries === 30) gap = 0; // crowded map: let fields sit closer together
      if (tries === 55) gap = -1;
      const x = 2 + rng() * (W - 5), y = half + 1 + rng() * (H - half - 3);
      if (terrain[id(Math.floor(x), Math.floor(y))] !== T_GROUND) continue;
      if (dist2(x, y, bx, by) < 64) continue;
      if (fields.some((o) => dist2(x, y, o.x, o.y) < (o.r + f.r + gap) ** 2)) continue;
      field(x, y, f.r, f.type, f.fill, false);
      break;
    }
  }

  // 3) Player 0 base: a flat landing zone.
  field(bx, by, 3.4, -1, 0, true);
  fields.pop();

  // 4) Mirror the bottom half onto the top half.
  const mirror = () => {
    for (let t = 0; t < N; t++) {
      if (((t / W) | 0) >= half) continue;
      const m2 = mir(t);
      terrain[t] = terrain[m2]; res[t] = res[m2]; elev[t] = elev[m2]; fert[t] = fert[m2];
    }
  };
  mirror();

  const ground = (t) => terrain[t] === T_GROUND;
  const orth = (t, fn) => {
    const i = t % W, j = (t / W) | 0;
    if (i > 0) fn(t - 1);
    if (i < W - 1) fn(t + 1);
    if (j > 0) fn(t - W);
    if (j < H - 1) fn(t + W);
  };
  const reachable = (useElev) => {
    const seen = new Uint8Array(N), q = [id(bx, by)];
    seen[q[0]] = 1;
    while (q.length) {
      const t = q.pop();
      orth(t, (u) => {
        if (seen[u] || !ground(u)) return;
        if (useElev && elev[u] !== elev[t] && !(Math.abs(elev[u] - elev[t]) === 1 && (ramp[u] || ramp[t]))) return;
        seen[u] = 1; q.push(u);
      });
    }
    return seen;
  };

  // 5) Make sure the two bases are connected by land; carve a winding corridor if not.
  if (!reachable(false)[id(W - 1 - bx, H - 1 - by)]) {
    let x = bx, y = by;
    while (y >= half) {
      for (let dj = -1; dj <= 1; dj++) for (let di = -1; di <= 1; di++) {
        const i = Math.round(x) + di, j = Math.round(y) + dj;
        if (i >= 0 && j >= half && i < W && j < H && terrain[id(i, j)] !== T_GROUND) {
          terrain[id(i, j)] = T_GROUND; res[id(i, j)] = R_NONE;
        }
      }
      y -= 1;
      x += clamp((W / 2 - x) * 0.25 + (rng() - 0.5) * 1.5, -1, 1);
    }
    mirror();
  }

  // 6) Shape the levels into clean terraces, then connect them with ramps.
  if (L > 1) {
    const levelComponents = () => {
      const comp = new Int32Array(N).fill(-1), sizes = [];
      for (let t = 0; t < N; t++) {
        if (!ground(t) || comp[t] >= 0) continue;
        const c = sizes.length, q = [t];
        comp[t] = c;
        let n = 0;
        while (q.length) {
          const a = q.pop();
          n++;
          orth(a, (b) => { if (comp[b] < 0 && ground(b) && elev[b] === elev[a]) { comp[b] = c; q.push(b); } });
        }
        sizes.push(n);
      }
      return { comp, sizes };
    };
    // Absorb tiny specks of one level into their surroundings (decide for all, then apply,
    // so the result stays symmetric).
    for (let pass = 0; pass < 2; pass++) {
      const { comp, sizes } = levelComponents();
      const hist = new Map();
      for (let t = 0; t < N; t++) {
        if (!ground(t) || sizes[comp[t]] >= 10) continue;
        const hc = hist.get(comp[t]) || {};
        orth(t, (u) => { if (ground(u) && elev[u] !== elev[t]) hc[elev[u]] = (hc[elev[u]] || 0) + 1; });
        hist.set(comp[t], hc);
      }
      const target = new Map();
      for (const [c, hc] of hist) {
        let best = -1, bn = 0;
        for (const k in hc) if (hc[k] > bn || (hc[k] === bn && +k < best)) { bn = hc[k]; best = +k; }
        if (best >= 0) target.set(c, best);
      }
      for (let t = 0; t < N; t++) if (ground(t) && target.has(comp[t])) elev[t] = target.get(comp[t]);
    }
    // Neighbouring tiles differ by at most one level, so every cliff is climbable with a ramp.
    for (let changed = true; changed;) {
      changed = false;
      for (let t = 0; t < N; t++) {
        if (!ground(t)) continue;
        let m = elev[t];
        orth(t, (u) => { if (ground(u) && elev[u] + 1 < m) m = elev[u] + 1; });
        if (m < elev[t]) { elev[t] = m; changed = true; }
      }
    }
    // Ramps: first the fewest needed to connect every level-area (narrow passes), then a few
    // extras along long cliffs. Each ramp is placed together with its mirror image.
    const { comp } = levelComponents();
    const parent = [];
    for (let c = 0; c < N; c++) parent.push(c);
    const find = (c) => { while (parent[c] !== c) { parent[c] = parent[parent[c]]; c = parent[c]; } return c; };
    const cands = [];
    for (let t = 0; t < N; t++) {
      if (!ground(t)) continue;
      orth(t, (u) => {
        if (!ground(u) || elev[u] !== elev[t] + 1) return;
        const ct = Math.min(t, mir(t)), cu = ct === t ? u : mir(u);
        cands.push({ t, u, key: hash2(ct, cu - ct + 3 * W, seed) });
      });
    }
    cands.sort((a, b) => a.key - b.key || a.t - b.t);
    const addRamp = (t, u) => {
      for (const [a, b] of [[t, u], [mir(t), mir(u)]]) {
        ramp[a] = 1;
        res[a] = R_NONE;
        parent[find(comp[a])] = find(comp[b]);
      }
      // Sometimes make the pass two tiles wide.
      if (hash2(t, u, seed + 99) < 0.4) {
        const p = Math.abs(u - t) === 1 ? W : 1;
        for (const d of [p, -p]) {
          const t2 = t + d, u2 = u + d;
          if (t2 < 0 || u2 < 0 || t2 >= N || u2 >= N || Math.abs((t2 % W) - (t % W)) > 1) continue;
          if (ground(t2) && ground(u2) && !ramp[t2] && elev[t2] === elev[t] && elev[u2] === elev[t] + 1) {
            ramp[t2] = 1; res[t2] = R_NONE; ramp[mir(t2)] = 1; res[mir(t2)] = R_NONE;
            break;
          }
        }
      }
    };
    for (const c of cands) if (find(comp[c.t]) !== find(comp[c.u])) addRamp(c.t, c.u);
    const nearRamp = (t, r) => {
      const i = t % W, j = (t / W) | 0;
      for (let y = Math.max(0, j - r); y <= Math.min(H - 1, j + r); y++) {
        for (let x = Math.max(0, i - r); x <= Math.min(W - 1, i + r); x++) if (ramp[id(x, y)]) return true;
      }
      return false;
    };
    for (const c of cands) {
      if (hash2(c.t, c.u, seed + 7) < TPR.extra && !nearRamp(c.t, TPR.gap) && !nearRamp(c.u, TPR.gap)) addRamp(c.t, c.u);
    }
    // Safety net: if the bases still can't reach each other, flatten the map.
    if (!reachable(true)[id(W - 1 - bx, H - 1 - by)]) { elev.fill(baseLevel); ramp.fill(0); }
  } else {
    elev.fill(0);
  }

  for (let t = 0; t < N; t++) if (res[t]) amt[t] = clamp(Math.round(RES[res[t]].amount * RPR.amount), 1, 255);
  const grow = new Float32Array(N).fill(1);
  for (let t = 0; t < N; t++) if (terrain[t] !== T_GROUND) fert[t] = 0;
  return { terrain, res, amt, grow, elev, ramp, fert, bases: [{ x: bx, y: by }, { x: W - 1 - bx, y: H - 1 - by }] };
}

/* ------------------------------------------------------------------ new game */

/**
 * opts.mode: 'versus' (race a rival AI to capture its Lander) or 'colony' (no rival, a bigger
 * map to settle at your own pace). opts.difficulty applies to versus only.
 */
function newGame(opts) {
  const mode = opts.mode === 'colony' ? 'colony' : 'versus';
  const settings = {
    size: clamp(opts.size ?? DEFAULT_SIZE[mode], 0, SIZE_PRESETS.length - 1),
    rough: clamp(opts.rough ?? DEFAULT_ROUGH, 0, TERRAIN_PRESETS.length - 1),
    rich: clamp(opts.rich ?? DEFAULT_RICH, 0, RESOURCE_PRESETS.length - 1),
  };
  const W = SIZE_PRESETS[settings.size].w, H = SIZE_PRESETS[settings.size].h;
  const seed = opts.seed >>> 0;
  const diff = DIFFICULTY[opts.difficulty] ? opts.difficulty : 'normal';
  const m = generateMap(seed, W, H, settings);
  if (opts.layout) opts.layout(m, W, H); // missions hand-place features on their planet
  S = {
    v: 1, mode, seed, W, H, settings, difficulty: diff, time: 0, nextId: 1, winner: -1, milestone: 0,
    terrain: m.terrain, res: m.res, amt: m.amt, grow: m.grow, elev: m.elev, ramp: m.ramp, fert: m.fert,
    road: new Uint8Array(W * H), pave: new Uint8Array(W * H),
    owner: new Int8Array(W * H).fill(-1),
    resRes: new Uint8Array(W * H),
    bAt: new Int32Array(W * H),
    players: [0, 1].map((p) => ({
      id: p,
      absent: mode === 'colony' && p === 1,
      ai: (p === 1 && mode !== 'colony') || (p === 0 && !!opts.autoplay),
      mult: p === 1 ? DIFFICULTY[diff].mult : 1,
      lander: 0,
      stats: { built: 0, bots: 0, captured: 0, lost: 0, outposts: 0, startBots: 0 },
      made: {}, madeBots: {},
      aiT: 0, nextAttack: 0,
    })),
    buildings: [], bots: [], fx: [], msgs: [], rallies: [], missiles: [],
    dirtyTiles: [], territoryVer: 0, tick: 0, hist: newHistory(),
  };
  if (opts.autoplay) S.players[0].mult = DIFFICULTY[diff].mult;
  S.byId = new Map();
  for (let p = 0; p < 2; p++) {
    if (S.players[p].absent) continue;
    const base = m.bases[p];
    const L = addBuilding(p, 'lander', base.x, base.y, true);
    S.players[p].lander = L.id;
    for (const g in START_STOCK) L.stock[g] = START_STOCK[g] + (p === 1 ? DIFFICULTY[diff].bonus : 0);
    for (const type in START_BOTS) for (let k = 0; k < START_BOTS[type]; k++) enterBuilding(addBot(p, type, base.x, base.y), L);
    for (let k = 0; k < (mode === 'colony' ? 0 : START_WARBOTS); k++) {
      const w = addBot(p, 'warbot', base.x, base.y);
      enterBuilding(w, L);
    }
    S.players[p].stats.startBots = S.players[p].stats.bots;
  }
  computeZones();
  computeTerritory();
  if (opts.setup) opts.setup(S);
  return S;
}

/* ------------------------------------------------------------------ elevation */

/**
 * Can a bot step between orthogonally adjacent tiles a and b? Same level: yes. One level apart:
 * only if either tile is a ramp. Cliffs of more than one level are never climbable.
 */
function canStep(a, b) {
  if (S.terrain[a] !== T_GROUND || S.terrain[b] !== T_GROUND) return false;
  const d = S.elev[a] - S.elev[b];
  if (d === 0) return true;
  return (d === 1 || d === -1) && (S.ramp[a] === 1 || S.ramp[b] === 1);
}

/** Label every walkable tile with the id of the area bots can reach from it (ignoring buildings). */
function computeZones() {
  const N = S.W * S.H, W = S.W;
  const z = new Int32Array(N).fill(-1);
  let next = 0;
  for (let t = 0; t < N; t++) {
    if (S.terrain[t] !== T_GROUND || z[t] >= 0) continue;
    const q = [t];
    z[t] = next;
    while (q.length) {
      const a = q.pop(), i = a % W;
      const nb = [i > 0 ? a - 1 : -1, i < W - 1 ? a + 1 : -1, a - W, a + W];
      for (const b of nb) {
        if (b < 0 || b >= N || z[b] >= 0 || !canStep(a, b)) continue;
        z[b] = next;
        q.push(b);
      }
    }
    next++;
  }
  S.zone = z;
}

/** The area a player's bots can reach (the one their Lander stands in). */
function homeZone(p) {
  const L = getE(S.players[p].lander);
  return L && L.owner === p ? S.zone[tIdx(L.x, L.y)] : -2;
}

/** Count resource nodes in reach of (cx, cy) that bots there can actually walk to. */
function reachableRes(cx, cy, radius, type) {
  return countResIn(cx, cy, radius, type, false, S.zone[tIdx(cx, cy)]);
}

/* ------------------------------------------------------------------ entities */

function addBuilding(owner, type, x, y, built) {
  const def = BDEFS[type];
  const b = {
    id: S.nextId++, ent: 'b', type, owner, x, y,
    built: !!built, progress: built ? 1 : 0,
    stock: {}, inc: {}, res: {},
    staff: 0, staffInc: 0, builder: 0,
    garrison: [], garInc: 0,
    timer: 0, cd: 0, shots: 0, aim: -Math.PI / 2,
    armor: built ? def.armor : 4, lastHit: -99, lastAlert: -99,
    // The player's Foundry builds only bots they order; an AI-run Foundry picks its own mode.
    mode: !S.players[owner].ai ? 'off' : S.mode === 'colony' ? 'worker' : 'alt', altNext: 'worker', status: '', born: S.time,
  };
  S.buildings.push(b);
  S.byId.set(b.id, b);
  S.bAt[tIdx(x, y)] = b.id;
  return b;
}

function addBot(owner, type, x, y) {
  const maxHp = BOTS[type].hp;
  const bot = {
    id: S.nextId++, ent: 'u', type, owner,
    x: x + 0.5, y: y + 0.5, path: null, pi: 0,
    task: null, carry: null, carryN: 0, hp: maxHp, maxHp,
    inside: 0, cd: 0, fight: 0, scanT: 0, idleT: 0, face: 0, busy: 0, bat: 100,
  };
  if (type === 'warbot') bot.ammo = WARBOT_AMMO;
  S.bots.push(bot);
  S.byId.set(bot.id, bot);
  S.players[owner].stats.bots++;
  return bot;
}

function enterBuilding(bot, b) {
  bot.inside = b.id;
  bot.x = b.x + 0.5; bot.y = b.y + 0.5;
  bot.path = null;
  if (bot.type === 'warbot' && BDEFS[b.type].mil && !b.garrison.includes(bot.id)) b.garrison.push(bot.id);
}

function exitBuilding(bot) {
  if (!bot.inside) return;
  const b = getE(bot.inside);
  if (b) {
    const k = b.garrison.indexOf(bot.id);
    if (k >= 0) b.garrison.splice(k, 1);
  }
  bot.inside = 0;
}

function playerBuildings(p) { return S.buildings.filter((b) => b.owner === p && !b.dead); }
function playerBots(p) { return S.bots.filter((u) => u.owner === p && !u.dead); }

/* ------------------------------------------------------------------ territory */

/**
 * Each tile belongs to the nearest military building (Lander/Outpost) whose radius covers it.
 * A tile holding a player's building stays theirs as long as one of their military buildings
 * still covers it — so buildings are only lost when the military building protecting them falls.
 * Non-military buildings left outside their owner's territory are destroyed.
 */
function computeTerritory() {
  const { W, H } = S;
  const N = W * H;
  const d = [new Float32Array(N).fill(Infinity), new Float32Array(N).fill(Infinity)];
  for (const b of S.buildings) {
    if (b.dead || !b.built || !BDEFS[b.type].mil) continue;
    const r = BDEFS[b.type].terr, r2 = r * r + 0.3;
    for (let j = Math.max(0, b.y - r); j <= Math.min(H - 1, b.y + r); j++) {
      for (let i = Math.max(0, b.x - r); i <= Math.min(W - 1, b.x + r); i++) {
        const dd = dist2(i, j, b.x, b.y);
        const t = j * W + i;
        if (dd <= r2 && dd < d[b.owner][t]) d[b.owner][t] = dd;
      }
    }
  }
  for (let t = 0; t < N; t++) {
    const c0 = d[0][t], c1 = d[1][t];
    const bid = S.bAt[t];
    if (bid) {
      const b = getE(bid);
      if (b && d[b.owner][t] < Infinity) { S.owner[t] = b.owner; continue; }
    }
    if (c0 === Infinity && c1 === Infinity) S.owner[t] = -1;
    else if (c0 < c1) S.owner[t] = 0;
    else if (c1 < c0) S.owner[t] = 1;
    else S.owner[t] = S.owner[t]; // exact tie: whoever held it keeps it
  }
  S.territoryVer++;
  for (const b of S.buildings.slice()) {
    if (b.dead || BDEFS[b.type].mil) continue;
    if (S.owner[tIdx(b.x, b.y)] !== b.owner) {
      postMsg(b.owner, `${BDEFS[b.type].name} was lost — it is no longer inside your territory.`, b.x, b.y, 'bad');
      destroyBuilding(b, true);
    }
  }
}

/** Share of the walkable land (ground tiles) a player has claimed, 0..1. */
function landShare(p) {
  let land = 0, mine = 0;
  const home = homeZone(p);
  for (let t = 0; t < S.W * S.H; t++) {
    if (S.terrain[t] !== T_GROUND || S.zone[t] !== home) continue;
    land++;
    if (S.owner[t] === p) mine++;
  }
  return land ? mine / land : 0;
}

/* ------------------------------------------------------------------ placement */

function countResIn(cx, cy, radius, type, matureOnly, zone) {
  let n = 0;
  const r2 = radius * radius + 0.3;
  for (let j = Math.max(0, cy - radius); j <= Math.min(S.H - 1, cy + radius); j++) {
    for (let i = Math.max(0, cx - radius); i <= Math.min(S.W - 1, cx + radius); i++) {
      const t = j * S.W + i;
      if (zone !== undefined && S.zone[t] !== zone) continue;
      if (S.res[t] === type && dist2(i, j, cx, cy) <= r2 && (!matureOnly || S.grow[t] >= 1)) n++;
    }
  }
  return n;
}

/** Fertile tiles around (cx, cy) a Bio Farm there could plant (not built on, same walkable area). */
function fertileIn(cx, cy, radius) {
  let n = 0;
  const r2 = radius * radius + 0.3, zone = S.zone[tIdx(cx, cy)];
  for (let j = Math.max(0, cy - radius); j <= Math.min(S.H - 1, cy + radius); j++) {
    for (let i = Math.max(0, cx - radius); i <= Math.min(S.W - 1, cx + radius); i++) {
      const t = j * S.W + i;
      if (!S.fert[t] || S.bAt[t] || S.ramp[t] || S.zone[t] !== zone || (i === cx && j === cy)) continue;
      if (dist2(i, j, cx, cy) <= r2) n++;
    }
  }
  return n;
}

function isWalkable(i, j) {
  if (!inMap(i, j)) return false;
  const t = tIdx(i, j);
  return S.terrain[t] === T_GROUND && !S.bAt[t];
}

/**
 * Would a building on tile t cut the walkable tiles around it off from each other (for example by
 * plugging a narrow pass or the foot of a slope)? Checks a small window first, then the whole map.
 */
const _wb = { seen: null, gen: 0, q: null };

function wouldBlock(t) {
  const W = S.W, N = S.W * S.H;
  const ti = t % W, tj = (t / W) | 0;
  const nb = (a, k) => (k === 0 ? (a % W > 0 ? a - 1 : -1) : k === 1 ? (a % W < W - 1 ? a + 1 : -1) : k === 2 ? a - W : a + W);
  const ends = [];
  for (let k = 0; k < 4; k++) {
    const u = nb(t, k);
    if (u >= 0 && u < N && !S.bAt[u] && canStep(t, u)) ends.push(u);
  }
  if (ends.length <= 1) return false;
  if (!_wb.seen || _wb.seen.length !== N) { _wb.seen = new Uint32Array(N); _wb.q = new Int32Array(N); _wb.gen = 0; }
  const seen = _wb.seen, q = _wb.q;
  const reachesAll = (limit) => {
    const gen = ++_wb.gen;
    let head = 0, tail = 0, left = ends.length - 1;
    seen[ends[0]] = gen; q[tail++] = ends[0];
    while (head < tail) {
      const a = q[head++];
      for (let k = 0; k < 4; k++) {
        const b = nb(a, k);
        if (b < 0 || b >= N || b === t || seen[b] === gen || S.bAt[b] || !canStep(a, b)) continue;
        if (limit && (Math.abs((b % W) - ti) > limit || Math.abs(((b / W) | 0) - tj) > limit)) continue;
        seen[b] = gen;
        if (ends.indexOf(b) >= 0 && --left === 0) return true;
        q[tail++] = b;
      }
    }
    return false;
  };
  return !reachesAll(5) && !reachesAll(0);
}

/** Can `owner` start a `type` construction site at tile (i, j)? Returns {ok, reason}. */
function canPlace(owner, type, i, j, skipBlockCheck) {
  const def = BDEFS[type];
  if (!def || !def.cost) return { ok: false, reason: 'Cannot build that.' };
  if (!inMap(i, j)) return { ok: false, reason: 'Outside the map.' };
  const t = tIdx(i, j);
  if (S.owner[t] !== owner) return { ok: false, reason: 'You can only build inside your territory.' };
  if (S.terrain[t] !== T_GROUND) return { ok: false, reason: 'The ground here is not buildable.' };
  if (def.pump) {
    if (S.res[t] !== R_OIL) return { ok: false, reason: 'Build an Oil Pump right on top of an oil seep.' };
  } else if (S.res[t]) return { ok: false, reason: 'Clear the resources here first.' };
  if (S.bAt[t]) return { ok: false, reason: 'There is already a building here.' };
  if (S.ramp[t]) return { ok: false, reason: 'Too steep: this is a slope.' };
  if (S.zone[t] !== homeZone(owner)) return { ok: false, reason: 'Your bots cannot reach this spot. Find a slope up, or build a Ramp.' };
  if (def.ramp) {
    let cliff = false;
    for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      if (!inMap(i + di, j + dj)) continue;
      const u = tIdx(i + di, j + dj);
      if (S.terrain[u] === T_GROUND && Math.abs(S.elev[u] - S.elev[t]) === 1 && !canStep(t, u)) cliff = true;
    }
    if (!cliff) return { ok: false, reason: 'Place a Ramp right at the foot or top of a one-level cliff.' };
    if (!skipBlockCheck && wouldBlock(t)) return { ok: false, reason: 'That would block the only way through here.' };
    return { ok: true, reason: '' };
  }
  if (S.road[t]) return { ok: false, reason: 'There is a path here.' };
  let open = 0;
  for (let dj = -1; dj <= 1; dj++) for (let di = -1; di <= 1; di++) {
    if (!di && !dj) continue;
    if (!inMap(i + di, j + dj)) continue;
    const u = tIdx(i + di, j + dj);
    if (S.bAt[u]) return { ok: false, reason: 'Too close to another building.' };
    if ((di === 0 || dj === 0) && canStep(t, u)) open++;
  }
  if (open < 2) return { ok: false, reason: 'Bots could not reach this spot.' };
  if (def.mil) {
    for (const b of S.buildings) {
      if (!b.dead && b.owner === owner && BDEFS[b.type].mil && dist2(b.x, b.y, i, j) < 16) {
        return { ok: false, reason: 'Too close to another military building.' };
      }
    }
  }
  if (def.gather && reachableRes(i, j, def.radius, def.gather) === 0) {
    return { ok: false, reason: `No ${RES[def.gather].name.toLowerCase()}s within reach.` };
  }
  if (def.farm && fertileIn(i, j, def.radius) === 0) return { ok: false, reason: 'No fertile soil within reach.' };
  // The most expensive check goes last.
  if (!skipBlockCheck && wouldBlock(t)) return { ok: false, reason: 'That would block the only way through here.' };
  return { ok: true, reason: '' };
}

function siteCount(owner) {
  let n = 0;
  for (const b of S.buildings) if (!b.dead && b.owner === owner && !b.built) n++;
  return n;
}

function placeSite(owner, type, i, j) {
  const chk = canPlace(owner, type, i, j);
  if (!chk.ok) return chk;
  if (siteCount(owner) >= MAX_SITES) return { ok: false, reason: `Maximum of ${MAX_SITES} construction sites reached.` };
  const b = addBuilding(owner, type, i, j, false);
  markDirty(i, j);
  return { ok: true, building: b };
}

/** Paths (roads) speed up bots. They can be painted on open ground inside your territory. */
function canRoad(owner, i, j) {
  if (!inMap(i, j)) return false;
  const t = tIdx(i, j);
  return S.owner[t] === owner && S.terrain[t] === T_GROUND && !S.bAt[t] && !S.res[t];
}

function setRoad(i, j, on) {
  const t = tIdx(i, j);
  if (!!S.road[t] === !!on) return;
  S.road[t] = on ? 1 : 0;
  S.pave[t] = on ? 1 : 0;
  markDirty(i, j);
  for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) if (inMap(i + di, j + dj)) markDirty(i + di, j + dj);
}

/** Set an existing path tile's surface: 1 gravel, 2 concrete, 3 asphalt. */
function setPave(i, j, tier) {
  const t = tIdx(i, j);
  if (!S.road[t] || S.pave[t] === tier) return;
  S.pave[t] = tier;
  S.topPaveCache = 0;
  markDirty(i, j);
}

/** The best path surface anywhere on the map (route planning needs it for an exact estimate). */
function topPave() {
  if (S.topPaveCache) return S.topPaveCache;
  let top = 1;
  for (let t = 0; t < S.W * S.H && top < 3; t++) if (S.road[t] && S.pave[t] > top) top = S.pave[t];
  S.topPaveCache = top;
  return top;
}

/** Make an existing path tile two-way (1) or one-way (2 east, 3 south, 4 west, 5 north). */
function setRoadDir(i, j, v) {
  const t = tIdx(i, j);
  if (!S.road[t] || S.road[t] === v) return;
  S.road[t] = v;
  markDirty(i, j);
  for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) if (inMap(i + di, j + dj)) markDirty(i + di, j + dj);
}

function markDirty(i, j) { S.dirtyTiles.push(tIdx(i, j)); }

/* ------------------------------------------------------------------ removal */

/** Release any reservations a bot's current task holds, then clear the task. */
function cancelTask(bot) {
  const t = bot.task;
  if (!t) return;
  switch (t.type) {
    case 'haul': {
      const src = getE(t.src), dst = getE(t.dst);
      if (t.phase === 'toSrc' && src) bump(src.res, t.good, -(t.n || 1));
      if (dst) bump(dst.inc, t.good, -(t.n || 1));
      break;
    }
    case 'build': {
      const s = getE(t.site);
      if (s && s.builder === bot.id) s.builder = 0;
      break;
    }
    case 'staff': {
      const b = getE(t.bld);
      if (b) {
        if (b.staff === bot.id) b.staff = 0;
        if (b.staffInc === bot.id) b.staffInc = 0;
      }
      if (t.node >= 0) S.resRes[t.node] = 0;
      break;
    }
    case 'garrison': {
      const b = getE(t.bld);
      if (b) b.garInc = Math.max(0, b.garInc - 1);
      break;
    }
  }
  bot.task = null;
  bot.path = null;
}

function taskRefs(task, id) {
  if (!task) return false;
  return task.src === id || task.dst === id || task.site === id || task.bld === id || task.target === id || task.home === id;
}

function killBot(bot) {
  if (bot.dead) return;
  cancelTask(bot);
  exitBuilding(bot);
  for (const b of S.buildings) {
    if (b.staff === bot.id) b.staff = 0;
    if (b.staffInc === bot.id) b.staffInc = 0;
    if (b.builder === bot.id) b.builder = 0;
  }
  bot.dead = true;
  S.byId.delete(bot.id);
  S.players[bot.owner].stats.lost++;
  addFx('boom', bot.x, bot.y, { r: bot.type === 'warbot' ? 0.7 : 0.45 });
  sfx('boom');
}

/** Detach every bot that depends on building b (tasks, staff, garrison, idle inside). */
function releaseBotsFrom(b, killInside) {
  for (const u of S.bots) {
    if (u.dead) continue;
    if (taskRefs(u.task, b.id)) cancelTask(u);
    if (u.inside === b.id) {
      if (killInside && (u.type === 'warbot' || b.staff === u.id)) { killBot(u); continue; }
      exitBuilding(u);
    }
  }
  b.staff = 0; b.staffInc = 0; b.builder = 0; b.garInc = 0;
  b.garrison.length = 0;
  b.inc = {}; b.res = {};
}

/** Remove a building. `burn` = destroyed by force (bots inside die); otherwise bots walk out. */
function destroyBuilding(b, burn) {
  if (b.dead) return;
  releaseBotsFrom(b, !!burn);
  b.dead = true;
  S.byId.delete(b.id);
  S.bAt[tIdx(b.x, b.y)] = 0;
  markDirty(b.x, b.y);
  addFx('boom', b.x + 0.5, b.y + 0.5, { r: 1.3 });
  if (burn) addFx('smoke', b.x + 0.5, b.y + 0.5, { r: 1 });
  sfx('boom');
  if (BDEFS[b.type].mil && b.built) computeTerritory();
}

/* ------------------------------------------------------------------ messages & effects */

function postMsg(player, text, x, y, kind) {
  if (player !== 0) return;
  S.msgs.push({ text, x, y, kind: kind || 'info', t: S.time });
}

function addFx(type, x, y, data) {
  const f = { type, x, y, t: 0, life: type === 'smoke' ? 2.5 : type === 'laser' ? 0.25 : type === 'float' ? 1.2 : 0.6 };
  if (data) Object.assign(f, data);
  S.fx.push(f);
}

/* ------------------------------------------------------------------ save / load */

const SAVE_KEY = 'botfall.save.v1';
const TYPED_FIELDS = {
  terrain: Uint8Array, res: Uint8Array, amt: Uint8Array, grow: Float32Array, road: Uint8Array, owner: Int8Array,
  resRes: Uint8Array, elev: Uint8Array, ramp: Uint8Array, fert: Uint8Array, pave: Uint8Array,
};

function serializeGame() {
  const o = {};
  for (const k in S) {
    if (k === 'byId' || k === 'fx' || k === 'msgs' || k === 'dirtyTiles' || k === 'bAt' || k === 'zone') continue;
    o[k] = TYPED_FIELDS[k] ? Array.from(S[k], (v) => (k === 'grow' ? Math.round(v * 100) / 100 : v)) : S[k];
  }
  o.buildings = S.buildings.filter((b) => !b.dead);
  o.bots = S.bots.filter((u) => !u.dead);
  return JSON.stringify(o);
}

function deserializeGame(json) {
  const o = JSON.parse(json);
  if (!o || o.v !== 1) throw new Error('Unsupported save');
  // Saves from before elevation existed load as flat maps.
  if (!o.elev) { o.elev = new Array(o.W * o.H).fill(0); o.ramp = new Array(o.W * o.H).fill(0); }
  // Saves from before fertile soil and oil existed get them from the map's generator, on tiles
  // that are still free.
  if (!o.fert) {
    let m = null;
    try { m = generateMap(o.seed, o.W, o.H, o.settings); } catch (e) { m = null; }
    o.fert = new Array(o.W * o.H).fill(0);
    if (m && m.fert.length === o.fert.length) {
      const taken = new Set(o.buildings.map((b) => b.y * o.W + b.x));
      for (let t = 0; t < o.fert.length; t++) {
        if (o.terrain[t] !== T_GROUND || o.ramp[t] || taken.has(t)) continue;
        if (m.fert[t] && !o.res[t]) o.fert[t] = 1;
        if (m.res[t] === R_OIL && !o.res[t] && !(o.road && o.road[t])) { o.res[t] = R_OIL; o.amt[t] = m.amt[t]; }
      }
    }
  }
  // Saves from before road surfaces: every path is gravel.
  if (!o.pave) o.pave = o.road.map((v) => (v ? 1 : 0));
  for (const k in TYPED_FIELDS) o[k] = TYPED_FIELDS[k].from(o[k]);
  o.hist = o.hist || newHistory();
  for (const P of o.players) { P.made = P.made || {}; P.madeBots = P.madeBots || {}; P.stats.outposts = P.stats.outposts || 0; P.stats.startBots = P.stats.startBots ?? 18; }
  o.fx = []; o.msgs = []; o.dirtyTiles = [];
  o.rallies = o.rallies || [];
  o.missiles = o.missiles || [];
  o.bAt = new Int32Array(o.W * o.H);
  o.byId = new Map();
  S = o;
  for (const b of S.buildings) {
    S.byId.set(b.id, b);
    S.bAt[tIdx(b.x, b.y)] = b.id;
    if (b.type === 'foundry' && !S.players[b.owner].ai) b.mode = 'off'; // older saves: build on order only
  }
  for (const u of S.bots) {
    S.byId.set(u.id, u);
    if (u.type === 'warbot' && u.ammo === undefined) u.ammo = WARBOT_AMMO;
    u.carryN = u.carry ? u.carryN || 1 : 0;
  }
  computeZones();
  return S;
}

function saveGame() {
  if (!S || S.winner >= 0 || S.players[0].ai) return false;
  try { localStorage.setItem(SAVE_KEY, serializeGame()); return true; } catch (e) { return false; }
}

function hasSave() {
  try { return !!localStorage.getItem(SAVE_KEY); } catch (e) { return false; }
}

function loadGame() {
  try {
    const json = localStorage.getItem(SAVE_KEY);
    if (!json) return null;
    return deserializeGame(json);
  } catch (e) { return null; }
}

function clearSave() {
  try { localStorage.removeItem(SAVE_KEY); } catch (e) { /* storage unavailable */ }
}

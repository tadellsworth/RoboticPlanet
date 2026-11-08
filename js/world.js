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
 */
function generateMap(seed, W, H) {
  const N = W * H;
  const terrain = new Uint8Array(N), res = new Uint8Array(N), amt = new Uint8Array(N);
  const id = (i, j) => j * W + i;
  const sH = seed * 7 + 11, sM = seed * 13 + 5, sB = seed * 31 + 9, sC = seed * 17 + 3, sR = seed * 3 + 1;
  const half = H / 2;

  // 1) Terrain and resources for the bottom half.
  for (let j = half; j < H; j++) {
    for (let i = 0; i < W; i++) {
      const h = fbm(i / 8.5, j / 8.5, sH, 4);
      const t = id(i, j);
      terrain[t] = h > 0.67 ? T_ROCK : h < 0.29 ? T_WATER : T_GROUND;
    }
  }
  for (let j = half; j < H; j++) {
    for (let i = 0; i < W; i++) {
      const t = id(i, j);
      if (terrain[t] !== T_GROUND) continue;
      const r = hash2(i, j, sR);
      const m = fbm(i / 6, j / 6, sM, 3);
      const b = fbm(i / 5 + 40, j / 5 + 40, sB, 2);
      const c = fbm(i / 4 + 90, j / 4 + 90, sC, 2);
      let nearRock = false;
      for (let dj = -1; dj <= 1; dj++) for (let di = -1; di <= 1; di++) {
        const x = i + di, y = j + dj;
        if (x >= 0 && y >= 0 && x < W && y < H && terrain[id(x, y)] === T_ROCK) nearRock = true;
      }
      if (m > 0.6 && r < 0.62) res[t] = R_STALK;
      else if (nearRock && r < 0.22) res[t] = R_ORE;
      else if (c > 0.72 && r < 0.55) res[t] = R_CRYSTAL;
      else if (b > 0.66 && r < 0.5) res[t] = R_BOULDER;
    }
  }

  // 2) Player 0 base: clear the landing zone and guarantee starter resource patches.
  const rng = makeRng(seed ^ 0x5bd1e995);
  const bx = Math.floor(W / 2), by = H - 7;
  const stamp = (cx, cy, rad, type, density) => {
    for (let j = Math.floor(cy - rad); j <= Math.ceil(cy + rad); j++) {
      for (let i = Math.floor(cx - rad); i <= Math.ceil(cx + rad); i++) {
        if (i < 1 || j < half + 1 || i >= W - 1 || j >= H - 1) continue;
        if (dist2(i, j, cx, cy) > rad * rad) continue;
        const t = id(i, j);
        if (type === -1) { terrain[t] = T_GROUND; res[t] = R_NONE; continue; }
        terrain[t] = T_GROUND;
        if (rng() < density) res[t] = type;
      }
    }
  };
  const jit = () => Math.floor(rng() * 3) - 1;
  stamp(bx - 6 + jit(), by - 1 + jit(), 2.2, R_STALK, 0.75);
  stamp(bx + 6 + jit(), by + jit(), 1.7, R_BOULDER, 0.7);
  stamp(bx - 4 + jit(), by - 6, 1.4, R_ORE, 0.85);
  stamp(bx + 4 + jit(), by - 6, 1.4, R_CRYSTAL, 0.85);
  stamp(bx + 1, by + 4, 1.2, R_BOULDER, 0.6);
  // Richer fields beyond the starting territory reward expanding with Outposts.
  stamp(bx + 8 + jit(), by - 11 + jit(), 1.6, R_ORE, 0.8);
  stamp(bx - 9 + jit(), by - 10 + jit(), 1.5, R_CRYSTAL, 0.8);
  // Contested fields near the middle of the map (mirrored, so there is one on each side).
  stamp(Math.floor(W / 2) - 6, half + 3, 1.7, R_ORE, 0.85);
  stamp(Math.floor(W / 2) + 5, half + 2, 1.4, R_CRYSTAL, 0.85);
  stamp(bx, by, 3.3, -1, 0);

  // 3) Mirror the bottom half onto the top half.
  const mirror = () => {
    for (let j = 0; j < half; j++) for (let i = 0; i < W; i++) {
      const s = id(W - 1 - i, H - 1 - j), t = id(i, j);
      terrain[t] = terrain[s]; res[t] = res[s];
    }
  };
  mirror();

  // 4) Make sure the two bases are connected by land; carve a winding corridor if not.
  const passable = (t) => terrain[t] === T_GROUND;
  const reach = () => {
    const seen = new Uint8Array(N), q = [id(bx, by)];
    seen[q[0]] = 1;
    while (q.length) {
      const t = q.pop(), i = t % W, j = (t / W) | 0;
      for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const x = i + di, y = j + dj;
        if (x < 0 || y < 0 || x >= W || y >= H) continue;
        const u = id(x, y);
        if (!seen[u] && passable(u)) { seen[u] = 1; q.push(u); }
      }
    }
    return seen[id(W - 1 - bx, H - 1 - by)] === 1;
  };
  if (!reach()) {
    let x = bx, y = by;
    const tx = W / 2, ty = half;
    while (y >= half) {
      for (let dj = -1; dj <= 1; dj++) for (let di = -1; di <= 1; di++) {
        const i = Math.round(x) + di, j = Math.round(y) + dj;
        if (i >= 0 && j >= half && i < W && j < H && terrain[id(i, j)] !== T_GROUND) {
          terrain[id(i, j)] = T_GROUND; res[id(i, j)] = R_NONE;
        }
      }
      y -= 1;
      x += clamp((tx - x) * 0.25 + (rng() - 0.5) * 1.5, -1, 1);
    }
    mirror();
  }

  for (let t = 0; t < N; t++) if (res[t]) amt[t] = RES[res[t]].amount;
  const grow = new Float32Array(N).fill(1);
  return { terrain, res, amt, grow, bases: [{ x: bx, y: by }, { x: W - 1 - bx, y: H - 1 - by }] };
}

/* ------------------------------------------------------------------ new game */

/**
 * opts.mode: 'versus' (race a rival AI to capture its Lander) or 'colony' (no rival, a bigger
 * map to settle at your own pace). opts.difficulty applies to versus only.
 */
function newGame(opts) {
  const mode = opts.mode === 'colony' ? 'colony' : 'versus';
  const W = mode === 'colony' ? COLONY_W : MAP_W, H = mode === 'colony' ? COLONY_H : MAP_H;
  const seed = opts.seed >>> 0;
  const diff = DIFFICULTY[opts.difficulty] ? opts.difficulty : 'normal';
  const m = generateMap(seed, W, H);
  S = {
    v: 1, mode, seed, W, H, difficulty: diff, time: 0, nextId: 1, winner: -1, milestone: 0,
    terrain: m.terrain, res: m.res, amt: m.amt, grow: m.grow,
    road: new Uint8Array(W * H),
    owner: new Int8Array(W * H).fill(-1),
    resRes: new Uint8Array(W * H),
    bAt: new Int32Array(W * H),
    players: [0, 1].map((p) => ({
      id: p,
      absent: mode === 'colony' && p === 1,
      ai: (p === 1 && mode !== 'colony') || (p === 0 && !!opts.autoplay),
      mult: p === 1 ? DIFFICULTY[diff].mult : 1,
      lander: 0,
      stats: { built: 0, bots: 0, captured: 0, lost: 0 },
      aiT: 0, nextAttack: 0,
    })),
    buildings: [], bots: [], fx: [], msgs: [],
    dirtyTiles: [], territoryVer: 0, tick: 0,
  };
  if (opts.autoplay) S.players[0].mult = DIFFICULTY[diff].mult;
  S.byId = new Map();
  for (let p = 0; p < 2; p++) {
    if (S.players[p].absent) continue;
    const base = m.bases[p];
    const L = addBuilding(p, 'lander', base.x, base.y, true);
    S.players[p].lander = L.id;
    for (const g in START_STOCK) L.stock[g] = START_STOCK[g] + (p === 1 ? DIFFICULTY[diff].bonus : 0);
    for (let k = 0; k < START_WORKERS; k++) enterBuilding(addBot(p, 'worker', base.x, base.y), L);
    for (let k = 0; k < (mode === 'colony' ? 0 : START_WARBOTS); k++) {
      const w = addBot(p, 'warbot', base.x, base.y);
      enterBuilding(w, L);
    }
  }
  computeTerritory();
  return S;
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
    mode: S.mode === 'colony' ? 'worker' : 'alt', altNext: 'worker', status: '', born: S.time,
  };
  S.buildings.push(b);
  S.byId.set(b.id, b);
  S.bAt[tIdx(x, y)] = b.id;
  return b;
}

function addBot(owner, type, x, y) {
  const maxHp = type === 'warbot' ? 12 : 5;
  const bot = {
    id: S.nextId++, ent: 'u', type, owner,
    x: x + 0.5, y: y + 0.5, path: null, pi: 0,
    task: null, carry: null, hp: maxHp, maxHp,
    inside: 0, cd: 0, fight: 0, scanT: 0, idleT: 0, face: 0, busy: 0,
  };
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
  for (let t = 0; t < S.W * S.H; t++) {
    if (S.terrain[t] !== T_GROUND) continue;
    land++;
    if (S.owner[t] === p) mine++;
  }
  return land ? mine / land : 0;
}

/* ------------------------------------------------------------------ placement */

function countResIn(cx, cy, radius, type, matureOnly) {
  let n = 0;
  const r2 = radius * radius + 0.3;
  for (let j = Math.max(0, cy - radius); j <= Math.min(S.H - 1, cy + radius); j++) {
    for (let i = Math.max(0, cx - radius); i <= Math.min(S.W - 1, cx + radius); i++) {
      const t = j * S.W + i;
      if (S.res[t] === type && dist2(i, j, cx, cy) <= r2 && (!matureOnly || S.grow[t] >= 1)) n++;
    }
  }
  return n;
}

function isWalkable(i, j) {
  if (!inMap(i, j)) return false;
  const t = tIdx(i, j);
  return S.terrain[t] === T_GROUND && !S.bAt[t];
}

/** Can `owner` start a `type` construction site at tile (i, j)? Returns {ok, reason}. */
function canPlace(owner, type, i, j) {
  const def = BDEFS[type];
  if (!def || !def.cost) return { ok: false, reason: 'Cannot build that.' };
  if (!inMap(i, j)) return { ok: false, reason: 'Outside the map.' };
  const t = tIdx(i, j);
  if (S.owner[t] !== owner) return { ok: false, reason: 'You can only build inside your territory.' };
  if (S.terrain[t] !== T_GROUND) return { ok: false, reason: 'The ground here is not buildable.' };
  if (S.res[t]) return { ok: false, reason: 'Clear the resources here first.' };
  if (S.bAt[t]) return { ok: false, reason: 'There is already a building here.' };
  if (S.road[t]) return { ok: false, reason: 'There is a path here.' };
  let open = 0;
  for (let dj = -1; dj <= 1; dj++) for (let di = -1; di <= 1; di++) {
    if (!di && !dj) continue;
    if (!inMap(i + di, j + dj)) continue;
    const u = tIdx(i + di, j + dj);
    if (S.bAt[u]) return { ok: false, reason: 'Too close to another building.' };
    if ((di === 0 || dj === 0) && S.terrain[u] === T_GROUND) open++;
  }
  if (open < 2) return { ok: false, reason: 'Bots could not reach this spot.' };
  if (def.mil) {
    for (const b of S.buildings) {
      if (!b.dead && b.owner === owner && BDEFS[b.type].mil && dist2(b.x, b.y, i, j) < 16) {
        return { ok: false, reason: 'Too close to another military building.' };
      }
    }
  }
  if (def.gather && countResIn(i, j, def.radius, def.gather) === 0) {
    return { ok: false, reason: `No ${RES[def.gather].name.toLowerCase()}s within reach.` };
  }
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
      if (t.phase === 'toSrc' && src) bump(src.res, t.good, -1);
      if (dst) bump(dst.inc, t.good, -1);
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
const TYPED_FIELDS = { terrain: Uint8Array, res: Uint8Array, amt: Uint8Array, grow: Float32Array, road: Uint8Array, owner: Int8Array, resRes: Uint8Array };

function serializeGame() {
  const o = {};
  for (const k in S) {
    if (k === 'byId' || k === 'fx' || k === 'msgs' || k === 'dirtyTiles' || k === 'bAt') continue;
    o[k] = TYPED_FIELDS[k] ? Array.from(S[k], (v) => (k === 'grow' ? Math.round(v * 100) / 100 : v)) : S[k];
  }
  o.buildings = S.buildings.filter((b) => !b.dead);
  o.bots = S.bots.filter((u) => !u.dead);
  return JSON.stringify(o);
}

function deserializeGame(json) {
  const o = JSON.parse(json);
  if (!o || o.v !== 1) throw new Error('Unsupported save');
  for (const k in TYPED_FIELDS) o[k] = TYPED_FIELDS[k].from(o[k]);
  o.fx = []; o.msgs = []; o.dirtyTiles = [];
  o.bAt = new Int32Array(o.W * o.H);
  o.byId = new Map();
  S = o;
  for (const b of S.buildings) { S.byId.set(b.id, b); S.bAt[tIdx(b.x, b.y)] = b.id; }
  for (const u of S.bots) S.byId.set(u.id, u);
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

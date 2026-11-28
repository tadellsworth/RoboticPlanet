'use strict';
/*
 * Terrafall — the mission campaign, which is also the tutorial: it starts with the very basics and, chapter by
 * chapter, teaches every part of the game. Missions are on hand-picked planets, each with its own goals, starting
 * conditions and hand-placed features, and the five difficulty levels rivals have (Settler, Pioneer, Colonist,
 * Commander, Warlord: DIFFICULTY in js/defs.js; bigger goals, less in the Command Base, a clock, tougher rivals). Every mission is open from the start; finishing one ticks it off at that difficulty, and
 * the Missions list marks the first one not yet finished as Next up.
 *
 * The campaign is in eight chapters, played in this order: First Steps (one idea at a time: a building and its road,
 * Stone and Cement, batteries, the first Alloy), Growing the Colony (bots, farmed Fuel, regrowing groves, Outposts),
 * Roads and Traffic, Industry and Trade, Sea and Sky (ports, bridges over canyons, airships and earthworks; all in Colony games, so the economy is learned in peace), Into the Void
 * (spacecraft out on the Orbital platforms: the Launch Pad, a Shuttle run, a Dropship landing past a raised drawbridge, a derelict module; salvage in
 * the Graveyard), then First Contact (the Murmur's nests, their cavern lair the Hollow, their craft and other forms, a rival to practise on, a border
 * war, a chokepoint to hold) and War (with The Void Fleet's fleet action and siege in space after Siege Breakers), including the Uplinks race in
 * King of the Hill before Final Descent. From the second mission on, setup puts down the colony the earlier
 * missions taught (`kit`), so each one is spent on its new idea.
 *
 * A mission: { id (progress is saved by it: keep it when a mission is reworked), name, chapter (the list's heading:
 * a chapter's missions sit together, in order), brief (two sentences at most), intro: [up to 5 lines for the briefing
 * card], mode, seed, size, rough, rich, biome, shape, players, style (the rival's doctrine, a PERSONALITIES key, or 'random'),
 * victory (a way to win other than capture, a VICTORY key: 'uplinks' places the Uplinks), rival: [Settler, Colonist,
 * Commander] (its level), rivalBonus (extra of every good in its Command Base), passive: [Settler, Colonist, Commander] (a rival that
 * never attacks), limit (minutes per difficulty, 0 none: Pioneer has Settler's, Warlord Commander's), nuke/war/lab/events/mega (switch on what missions otherwise
 * leave out: a Nuclear race, warbots and defences in Colony, the Research Lab, planet events, Megastructures), pressOn (the rival's
 * trade convoys keep to schedule, out of a besieged base and past raiders: convoysPress), murmur ('quiet' or
 * 'active': the Murmur, with their nests, tunnels and nights; the older wildlife: true is Active), layout(m, W) (edits the generated map), setup(S, diff) (after the landing; S.mission already exists), goals
 * (1 to 4, met in any order, shown one at a time as the next goal) }.
 * A goal: { kind, n (one number or [Settler, Colonist, Commander]), hint (how to do it, shown while it's the next goal: the
 * real button names in <b> and keys in <kbd>), ui (CSS selector of the button(s) to light up meanwhile; when none is
 * on screen the button that opens them lights up, and for a panel button a ring pulses on the building to tap: `at`,
 * a building type, or the one the hint names), focus(S) (a specific target or { e, ui } for a goal with stages), text (its own objective text, "{n}" for the number, or [one, many] to
 * pick by the number), hold (it must still hold at the end: a goal once met otherwise stays met), wait (for a `built`
 * goal: the hint while its site goes up, else a stock one says to wait, or to Lay road to a site with none) }.
 * Goal kinds the game counts by itself:
 *   built     have `n` finished buildings of `type`
 *   made      produce `n` of `good` over the mission (not starting stock or goods a setup adds)
 *   bots      build `n` new bots (any type, or `type`) at the Foundry or a yard (not the ones you start with)
 *   own       have `n` bots of `type` at once
 *   paths     have `n` road tiles of surface `tier` or better (1 road, 2 asphalt)
 *   oneway    have `n` one-way road tiles
 *   lights    have `n` traffic lights up
 *   land      claim `n` percent of the land
 *   outposts  capture `n` rival Outposts (or other garrisons)
 *   capture   capture the rival Command Base (the capture lock below keeps it for last)
 * Any other kind is a name for a goal that counts itself with `count(P, S)` (P is player 0) and has its own `text`:
 * placed, linked, moved, bridges, ramps, research, line, trades, nests, looted, survive, nukes and so on.
 *
 * Helpers: for layout, mapTiles, placeField, placeFertile and mirrored (both sides alike in Versus); for setup,
 * preBuild (one finished building, road-joined if asked) and kit(S, types, workers) (the colony so far: KIT6 is
 * gathering, Cement, a Fuel Station, Alloy, Chips and the Bot Foundry, KIT7 adds a Bio Farm, KIT8 a Grove Planter); for
 * counts, ownTiles.
 * The capture lock (captureLocked): while any other goal is open, the last rival's Command Base can't be taken, so a
 * mission is never lost by winning too soon.
 */

const CAMPAIGN_KEY = 'botfall.campaign';
/*
 * The levels: a mission's `diff` is an index into DIFF_ORDER (0 Settler, 1 Pioneer, 2 Colonist, 3 Commander,
 * 4 Warlord). Missions were tuned on three levels, and their per-level values ([a, b, c]: goal sizes, rival
 * levels, clocks, setup numbers) stay written that way: a is Settler, b Colonist, c Commander (the old Easy, Normal
 * and Hard), Pioneer falls between a and b, and Warlord goes half a step past c (one rival level up, a goal half
 * again as much bigger). A five-long array gives each level its own value. mPick reads either.
 */
const MISSION_DIFFS = DIFF_ORDER;
const MISSION_DIFF_NAMES = DIFF_ORDER.map((k) => DIFFICULTY[k].label);
const MISSION_DIFF_DEFAULT = 2; // Colonist (the old Normal)
/** Where the old three levels (Easy, Normal, Hard) went: progress and saves from before carry over. */
const MISSION_OLD_DIFF = [0, 2, 3];

function mPick(v, d) {
  if (!Array.isArray(v)) return v;
  if (v.length !== 3) return v[Math.min(d, v.length - 1)];
  const [a, b, c] = v;
  if (d === 0 || d === 2 || d === 3) return v[d === 0 ? 0 : d - 1];
  if (typeof a === 'number') {
    const int = Number.isInteger(a) && Number.isInteger(b) && Number.isInteger(c), floor = Math.min(a, b, c) >= 0 ? 0 : -Infinity;
    if (d === 1) return int ? a + Math.trunc((b - a) / 2) : (a + b) / 2;
    return Math.max(floor, int ? c + Math.ceil((c - b) / 2) : c + (c - b) / 2);
  }
  if (typeof a === 'string' && DIFFICULTY[a]) {
    const i = (k) => DIFF_ORDER.indexOf(k);
    return d === 1 ? DIFF_ORDER[Math.floor((i(a) + i(b)) / 2)] : DIFF_ORDER[Math.min(DIFF_ORDER.length - 1, i(c) + 1)];
  }
  return d === 1 ? a : c; // (a switch, passive: Pioneer as Settler, Warlord as Commander)
}

/** A mission's time limit at level d, in minutes (0 none): Pioneer keeps Settler's, Warlord Commander's. */
function mLimit(def, d) { const L = def.limit || []; return (L.length === 5 ? L[d] : L[[0, 0, 1, 2, 2][d]]) || 0; }

/* --- hand-placed features: helpers that edit a freshly generated map (generateMap's output) --- */

function mapTiles(m, W, cx, cy, r, fn) {
  const H = m.terrain.length / W;
  for (let j = Math.floor(cy - r); j <= Math.ceil(cy + r); j++) {
    for (let i = Math.floor(cx - r); i <= Math.ceil(cx + r); i++) {
      if (i < 1 || j < 1 || i >= W - 1 || j >= H - 1 || dist2(i, j, cx, cy) > r * r) continue;
      const t = j * W + i;
      // Keep landing zones clear.
      if (m.bases.some((b) => dist2(i, j, b.x, b.y) < 12)) continue;
      fn(t, i, j);
    }
  }
}

/** Scatter a resource field on open ground (fill = share of tiles that get a node). */
function placeField(m, W, cx, cy, r, type, fill, seed) {
  mapTiles(m, W, cx, cy, r, (t, i, j) => {
    if (m.terrain[t] !== T_GROUND || m.ramp[t] || hash2(i, j, seed || 77) > fill) return;
    m.res[t] = type; m.amt[t] = RES[type].amount; m.grow[t] = 1; m.fert[t] = 0;
  });
}

function placeFertile(m, W, cx, cy, r) {
  mapTiles(m, W, cx, cy, r, (t) => { if (m.terrain[t] === T_GROUND && !m.ramp[t] && !m.res[t]) m.fert[t] = 1; });
}

/**
 * For a mission's setup: a finished `type` for `owner` on the nearest open spot to (x, y) it may stand on (within
 * `reach` tiles), joined to the owner's roads by finished road when `road` is set. Returns the building, or null.
 */
/**
 * Made Ready's land (Terraforming stage 5): east of the Command Base a dry basin closed in by a ridge a level up, a 3 by 3
 * shelf on the ridge's west side for the Reservoir and a ramp up to it; north of the base a two-level mesa with room for
 * the Leveller south of it (its yard cleared). What lay there is cleared; the ground is put back to the base's level first.
 */
function madeReadyLand(S, L) {
  const e0 = S.elev[tIdx(L.x, L.y)], BX = L.x + 11.5, BY = L.y - 2.5, MX = L.x - 4, MY = L.y - 11;
  for (let j = Math.max(1, L.y - 18); j <= Math.min(S.H - 2, L.y + 6); j++) for (let i = Math.max(1, L.x - 12); i <= Math.min(S.W - 2, L.x + 19); i++) {
    const t = tIdx(i, j), d = Math.hypot(i + 0.5 - BX, j + 0.5 - BY), m = Math.max(Math.abs(i + 0.5 - MX) / 3.5, Math.abs(j + 0.5 - MY) / 2.5);
    const shelf = i >= L.x + 4 && i <= L.x + 6 && j >= L.y - 5 && j <= L.y - 3, yard = i >= L.x - 6 && i <= L.x - 2 && j >= L.y - 7 && j <= L.y - 4;
    if (d >= 7 && m >= 1.35 && !shelf && !yard) continue;
    if (S.bAt[t]) continue;
    S.terrain[t] = T_GROUND; S.res[t] = R_NONE; S.amt[t] = 0; S.road[t] = 0; S.ramp[t] = 0; S.fert[t] = 0; if (S.decor) S.decor[t] = 0; if (S.ford) S.ford[t] = 0;
    S.elev[t] = e0;
    if ((d >= 4.4 && d < 6.6) || shelf) S.elev[t] = e0 + 1;
    if (m < 1) S.elev[t] = e0 + (m < 0.55 ? 2 : 1);
  }
  const up = tIdx(L.x + 3, L.y - 5); // (a ramp up onto the shelf from the base's side, by the Reservoir's door)
  if (!S.bAt[up]) { S.terrain[up] = T_GROUND; S.res[up] = R_NONE; S.elev[up] = e0 + 1; S.ramp[up] = 1; }
  for (const r of [tIdx(Math.floor(BX), Math.floor(BY) - 6), tIdx(L.x + 5, L.y - 1)]) if (S.elev[r] === e0 + 1 && !S.bAt[r]) S.ramp[r] = 1; // (and up onto the ridge from the north and the south-west, so the shelf is not its only way up)
  terrainChanged();
}

function preBuild(owner, type, x, y, opts) {
  const o = opts || {}, reach = o.reach || 12;
  for (let r = 0; r <= reach; r++) {
    for (let j = y - r; j <= y + r; j++) for (let i = x - r; i <= x + r; i++) {
      if (Math.max(Math.abs(i - x), Math.abs(j - y)) !== r || !inMap(i, j) || !canPlace(owner, type, i, j).ok) continue;
      const b = addBuilding(owner, type, i, j, true);
      if (o.stock) for (const g in o.stock) b.stock[g] = (b.stock[g] || 0) + o.stock[g];
      if (o.road) { const route = roadRouteTo(owner, b) || []; for (const t of route) setRoad(t % S.W, (t / S.W) | 0, true, owner); }
      return b;
    }
  }
  return null;
}

// Arterial's two prepared strips, with a parallel ordinary service road.
function arterialRoute(base) {
  return { x: base.x + 5, north: base.y - 20, south: base.y - 5 };
}

function arterialPairs(P, S, surfaced) {
  const { x, north, south } = arterialRoute(getE(P.lander));
  let pairs = 0;
  for (let y = north; y <= south; y++) {
    const out = tIdx(x, y), back = tIdx(x - 1, y);
    const lane = (t, dir) => S.road[t] === dir && wayOwner(t) === P.id &&
      (S.pave[t] === 3 || (!surfaced && S.paveMark[t] === 2));
    if (lane(out, 5) && lane(back, 3)) pairs++;
  }
  return pairs;
}

/**
 * Siege Breakers: the Warden's outer works, there from the start whatever it goes on to build itself (since the rival
 * AI got thriftier, the Easy Warden built two turrets and no Wall, its army was gone by minute 8, and "Take out 3 Walls
 * or turrets" was left with nothing to take out). A line of Wall across the way in from the player's side, 7 tiles
 * out from its Command Base and 7 long, with guns behind it: two Pulse Turrets, and a Minigun Nest from Colonist up.
 */
function siegeWorks(S, diff) {
  const R = getE(S.players[1].lander), L = getE(S.players[0].lander);
  const dx = L.x - R.x, dy = L.y - R.y, d = Math.sqrt(dx * dx + dy * dy) || 1, fx = dx / d, fy = dy / d, px = -fy, py = fx;
  const cx = R.x + fx * 7, cy = R.y + fy * 7;
  for (let k = -3; k <= 3; k++) {
    const i = Math.round(cx + px * k), j = Math.round(cy + py * k);
    if (inMap(i, j) && canPlace(1, 'wall', i, j).ok) addBuilding(1, 'wall', i, j, true);
  }
  const gun = (type, side, stock) => preBuild(1, type, Math.round(cx - fx * 2.5 + px * side), Math.round(cy - fy * 2.5 + py * side), { reach: 3, stock });
  gun('turret', -2, { crystal: 20 });
  gun('turret', 2, { crystal: 20 });
  if (diff >= 2) gun('minigun', 0, { ammo: 12 });
  computeTerritory();
}

/**
 * Mooring Lines: a foothold on the nearest mesa with Crystal, 14 to 30 tiles from the Command Base L across the canyon
 * (another area, with room round it): a Drop Outpost as a Cargo Plane drops one (supplied by air, holding the Cement and
 * Alloy for a Mooring Mast, Fuel for its chargers), with two Workers who build there by hand.
 */
function mooringFoothold(S, L) {
  const home = S.zone[tIdx(L.x, L.y)];
  let best = null, bd = Infinity;
  for (let j = 2; j < S.H - 2; j++) for (let i = 2; i < S.W - 2; i++) {
    const t = tIdx(i, j), d = dist(i, j, L.x, L.y), z = S.zone[t];
    if (z === home || z < 0 || S.terrain[t] !== T_GROUND || S.res[t] || S.bAt[t] || S.ramp[t] || d < 14 || d > 30 || d >= bd) continue;
    let cr = 0, room = 0;
    for (let dj = -5; dj <= 5; dj++) for (let di = -5; di <= 5; di++) {
      if (!inMap(i + di, j + dj)) continue;
      const u = tIdx(i + di, j + dj);
      if (S.zone[u] !== z) continue;
      if (S.res[u] === R_CRYSTAL) cr++;
      if (Math.abs(di) <= 3 && Math.abs(dj) <= 3 && S.terrain[u] === T_GROUND && !S.res[u]) room++;
    }
    if (cr >= 3 && room >= 25) { bd = d; best = t; }
  }
  if (best === null) return null;
  const b = addBuilding(0, 'dropost', best % S.W, (best / S.W) | 0, true);
  b.airSupply = true; b.keep = { fuel: 3 }; b.deployedAt = S.time;
  b.stock.cement = 10; b.stock.alloy = 6; b.stock.fuel = 6;
  computeTerritory(); computeZones();
  for (let k = 0; k < 2; k++) { const w = addBot(0, 'worker', b.x, b.y); enterBuilding(w, b); }
  S.players[0].stats.startBots = S.players[0].stats.bots;
  return b;
}

/**
 * Into the Void's setup (Orbital platforms): the deck on the home deck's west, cut off (both its drawbridges stuck up for
 * good), with a Drop Outpost of yours on it that asks for Cement and Fiber and has Supply by air on (a Shuttle's first run),
 * the drifting asteroids, and one derelict Solar Array adrift off the cut-off deck's far end, out of that Outpost's land
 * (an Outpost built by the Workers a Dropship lands there takes it). S.mission.farT: a tile of the cut-off deck.
 */
function voidFoothold(S, L) {
  const O = S.orb;
  if (!O) return;
  const home = O.plats.findIndex((D) => L.x >= D.x0 && L.x <= D.x1 && L.y >= D.y0 && L.y <= D.y1);
  // the deck joined to home by a bridge, west of home's middle
  let far = -1;
  for (const B of O.br) { const o = B.a === home ? B.b : B.b === home ? B.a : -1; if (o >= 0 && O.plats[o].kind === 'deck' && (far < 0 || O.plats[o].x0 < O.plats[far].x0)) far = o; }
  if (far < 0) return;
  const D = O.plats[far], cx = Math.floor((D.x0 + D.x1) / 2);
  // its Outpost, at the deck's middle, before the bridges go up (while Workers could still walk there)
  let ot = -1;
  for (let r = 0; r <= 4 && ot < 0; r++) for (let j = D.y0 + 2; j <= D.y1 - 2 && ot < 0; j++) for (let i = D.x0 + 1; i <= D.x1 - 1; i++) { const t = tIdx(i, j); if (Math.abs(j - (Math.floor((D.y0 + D.y1) / 2) + 2)) === r && S.terrain[t] === T_GROUND && !S.bAt[t] && !S.res[t] && !S.road[t] && !orbTile(t)) { ot = t; break; } }
  const b = ot >= 0 ? addBuilding(0, 'dropost', ot % S.W, (ot / S.W) | 0, true) : null; // (a Drop Outpost: storage, so its supply orders stand)
  if (b) { b.airSupply = true; b.keep = { cement: 6, fiber: 4 }; b.deployedAt = S.time; computeTerritory(); }
  for (let k = 0; k < O.br.length; k++) {
    const B = O.br[k];
    if (B.a !== far && B.b !== far) continue;
    orbFlip(k, true); B.mv = 0; B.cd = 1e9; // (stuck: no order moves it)
  }
  computeZones();
  S.mission.farT = tIdx(cx, Math.floor((D.y0 + D.y1) / 2));
  spaceSetup(S.seed);
  // the Solar Array: open space off the cut-off deck's north end, out of its Outpost's land, the nearest such to the deck
  let best = null, bd = Infinity;
  for (let j = 1; j < S.H - 2; j++) for (let i = 1; i < S.W - 2; i++) {
    const sq4 = [[i, j], [i + 1, j], [i, j + 1], [i + 1, j + 1]].map(([a, c]) => tIdx(a, c));
    if (!sq4.every((t) => voidTile(t) && !orbTile(t) && S.owner[t] < 0)) continue;
    let shore = false;
    for (let c = j - 2; c <= j + 3 && !shore; c++) for (let a = i - 2; a <= i + 3; a++) if (inMap(a, c) && S.terrain[tIdx(a, c)] === T_GROUND && S.zone[tIdx(a, c)] === S.zone[S.mission.farT]) { shore = true; break; }
    if (!shore || j > D.y0 || S.owner[modShore(i, j)] >= 0) continue; // (off the deck's north end, out of its Outpost's land)
    const d = dist(i + 1, j + 1, cx, D.y0);
    if (d < bd) { bd = d; best = { i, j }; }
  }
  S.space.mods = best ? [{ id: 1, k: 'solar', x: best.i, y: best.j, st: modShore(best.i, best.j), owner: -1, jam: 0, done: 0, tw: 1 }] : [];
}

/** The same feature at (x, y) and at its mirror image, so both sides stay fair in Versus. */
function mirrored(W, H, x, y, fn) { fn(x, y); fn(W - 1 - x, H - 1 - y); }

/**
 * The colony the first chapters have taught (kit's usual lists): gathering, Cement, a Fuel Station, Alloy, Chips, bots;
 * KIT7 adds a Bio Farm, KIT8 a Grove Planter too. (Without one the Harvester's groves, some 30 to 45 Fiber, are gone
 * in 5 to 8 minutes into the Smelter, and a slow player is down to the Command Base's salvage: so from Pipe Dreams on.)
 */
const KIT6 = ['harvester', 'quarry', 'kiln', 'charger', 'mine', 'tap', 'smelter', 'fab', 'foundry'];
const KIT7 = [...KIT6, 'farm'];
const KIT8 = [...KIT7, 'grower'];

/**
 * For a mission's setup: the colony the player has built so far. Each building of `types`, finished, where the rival
 * AI would put it (aiFindSpot), joined to the roads (a Fuel Station with 4 Fuel in it); a type with no spot is
 * skipped. Then an Agribot for each Bio Farm and Grove Planter beyond the one the colony lands with, and `workers`
 * more Workers, in the Command Base (they count as the colony's start, not as bots made). Returns the buildings it put
 * down, by type.
 */
function kit(S, types, workers) {
  const P = S.players[0], L = getE(P.lander), out = {};
  for (const type of types) {
    const s = aiFindSpot(0, type, L);
    if (!s) continue;
    const b = preBuild(0, type, s.x, s.y, { road: true, reach: 3, stock: type === 'charger' ? { fuel: 4 } : null });
    if (b) out[type] = b;
    computeTerritory();
  }
  const crews = Object.keys(out).filter((t) => BDEFS[t].crew === 'agribot').length;
  for (let k = S.bots.filter((u) => !u.dead && u.owner === 0 && u.type === 'agribot').length; k < crews; k++) enterBuilding(addBot(0, 'agribot', L.x, L.y), L);
  for (let k = 0; k < (workers || 0); k++) enterBuilding(addBot(0, 'worker', L.x, L.y), L);
  P.stats.startBots = P.stats.bots;
  return out;
}

/**
 * For goals: how many tiles pass test(t) and are player 0's. A tile with road or track on it counts when that way is
 * player 0's (wayOwner); one with neither (pipe, say) counts on the test alone, so a pipe test says whose it is
 * itself (S.pipe[t] === 1 is player 0's pipe).
 */
function ownTiles(test) {
  let n = 0;
  for (let t = 0, N = S.W * S.H; t < N; t++) if (test(t) && (S.road[t] || S.rail[t] ? wayOwner(t) === 0 : true)) n++;
  return n;
}

/**
 * For goals: player P's Ports a Ferry founded (they claim land) on another island, which no dry land joins to its
 * Command Base.
 */
function overseasPorts(P, S) {
  const L = getE(P.lander), ports = S.buildings.filter((b) => !b.dead && b.owner === P.id && b.built && b.type === 'port' && b.claim > 0);
  if (!ports.length || !L) return [];
  const N = S.W * S.H, land = new Uint8Array(N), q = [tIdx(L.x, L.y)];
  land[q[0]] = 1;
  while (q.length) {
    const a = q.pop(), i = a % S.W;
    for (const b of [i > 0 ? a - 1 : -1, i < S.W - 1 ? a + 1 : -1, a - S.W, a + S.W]) if (b >= 0 && b < N && !land[b] && S.terrain[b] !== T_WATER) { land[b] = 1; q.push(b); }
  }
  return ports.filter((b) => !land[tIdx(b.x, b.y)]);
}

/* --- the campaign --- */

// (Every mission is on Rich resources: the amount it was made and balanced with, before resources were lowered a notch.)
/*
 * The Atmosphere Engine's missions (Rain, Seed Vault, Under the Bloom, Landing Zone): the player's Engine, and how many
 * of their Bio Farms stand on the land it changed (Rain or more).
 */
function aeOwn(S) { return S.buildings.find((b) => !b.dead && b.owner === 0 && BDEFS[b.type].atmos) || null; }
function aeFarms(S) { return S.buildings.filter((b) => !b.dead && b.built && b.owner === 0 && b.type === 'farm' && S.green && S.green[tIdx(b.x, b.y)] >= 2).length; }
/** Some of Command Base L's stock for the Engine and its two Generators (and their Fuel). */
function aeKit(L, fiber) { L.stock.cement += 60; L.stock.alloy += 48; L.stock.chip += 26; L.stock.crystal += 32; L.stock.fiber = (L.stock.fiber || 0) + (fiber ?? 22); L.stock.fuel += 24; }
/** Open level ground a robot can stand on, nearest (x, y) and at least 12 tiles from Command Base L: { x, y }. */
function aeOpenNear(S, x, y, L) {
  let best = { x, y }, bd = Infinity;
  for (let j = 1; j < S.H - 1; j++) for (let i = 1; i < S.W - 1; i++) {
    const t = tIdx(i, j), d = dist2(i, j, x, y);
    if (d >= bd || S.terrain[t] !== T_GROUND || S.res[t] || S.bAt[t] || S.road[t] || S.ramp[t] || dist2(i, j, L.x, L.y) < 144 || !walkable(t)) continue;
    if (![[1, 0], [-1, 0], [0, 1], [0, -1]].every(([a, b]) => walkable(tIdx(i + a, j + b)) && !S.res[tIdx(i + a, j + b)])) continue;
    bd = d; best = { x: i, y: j };
  }
  return best;
}
const AE_BUILT = { kind: 'built', type: 'atmos', n: 1,
  hint: '<b>Build</b> (<kbd>B</kbd>) → <b>Mega</b> (<kbd>5</kbd>) → <b>Atmosphere Engine</b> (<kbd>N</kbd>). Then <b>Lay road</b> to it.',
  ui: "#btn-build, #build-tabs [data-g='mega'], .bcard[data-t='atmos'], #sh-layroad" };
/**
 * Overcast: rival E's Atmosphere Engine, built, at stage `st`, on its land as near its Command Base as there is room and
 * far enough from the player's Command Base L for its storm to reach L; its two Generators beside it, full of Fuel.
 */
function ocEngine(S, E, L, st) {
  const p = E.owner, far = ATMOS.r[st - 1] + STORM.r + 2;
  // (open level ground for its 4 x 4 and a tile round it, its stone and groves cleared: the Steward made room for it)
  const room = (i, j) => { for (let b = -1; b <= 4; b++) for (let a = -1; a <= 4; a++) { if (!inMap(i + a, j + b)) return false; const t = tIdx(i + a, j + b); if (S.terrain[t] !== T_GROUND || S.bAt[t] || S.ramp[t] || S.road[t] || (S.owner[t] >= 0 && S.owner[t] !== p) || ((a >= 0 && a < 4 && b >= 0 && b < 4) && S.res[t] && S.res[t] !== R_BOULDER && S.res[t] !== R_STALK)) return false; } return true; };
  let sp = null, bd = Infinity;
  for (let j = 1; j < S.H - 5; j++) for (let i = 1; i < S.W - 5; i++) {
    const d = dist(i + 2, j + 2, E.x + 0.5, E.y + 0.5);
    if (d < 5 || d >= bd || dist(i + 2, j + 2, L.x + 0.5, L.y + 0.5) < far || !room(i, j)) continue;
    bd = d; sp = [i, j];
  }
  if (!sp) return null;
  for (let b = 0; b < 4; b++) for (let a = 0; a < 4; a++) { const t = tIdx(sp[0] + a, sp[1] + b); S.res[t] = R_NONE; S.amt[t] = 0; markDirty(sp[0] + a, sp[1] + b); }
  const b = addBuilding(p, 'atmos', sp[0], sp[1], true);
  b.aeT = ATMOS.stages[st - 1] + 1; b.aeStage = st; b.aeP = ATMOS.r[st - 1];
  computeTerritory();
  for (let n = 0; n < ATMOS.gens; n++) {
    let g = null, gd = Infinity;
    for (let j = b.y - 6; j <= b.y + 9; j++) for (let i = b.x - 6; i <= b.x + 9; i++) {
      if (!inMap(i, j) || footDist(b, i + 0.5, j + 0.5) > ATMOS.reach || !canPlace(p, 'generator', i, j).ok) continue;
      const d = dist2(i, j, E.x, E.y);
      if (d < gd) { gd = d; g = [i, j]; }
    }
    if (g) { const G = addBuilding(p, 'generator', g[0], g[1], true); G.stock.fuel = BDEFS.generator.fuelCap; }
  }
  b.aeSrc = 'gen';
  return b;
}
const aeStageGoal = (n, text, hint, ui = '#btn-speed') => ({ kind: 'atmosStage', n, text, at: 'atmos', count: (P) => P.stats.atmosStage || 0, hint, ui });

const MISSIONS = [
  // Chapter 1, First Steps. One idea at a time: your first building and road, Stone and Cement, batteries, and the first Alloy.
  {
    id: 'touchdown', name: 'Touchdown', chapter: 'First Steps',
    brief: 'Your first landing. Place a Harvester by the stalk groves, join it to your roads and watch the Fiber come in. Press / for keyboard shortcuts.',
    intro: [
      'Drag to look around (with a mouse: right-drag or W A S D); pinch or scroll to zoom.',
      'A new building starts as a site: Haulers bring its materials from the Command Base, then a Worker builds it.',
      'Haulers only drive on roads, so every building needs a road to storage. Tap anything for its panel; its <b>?</b> explains it.',
      'Your goals sit at the top; the glowing button is the one to press next. Space pauses, H finds your base.',
      'The Fuel Station by your base keeps the robots charged. More on that soon.',
    ],
    mode: 'colony', seed: 1101, size: 0, rough: 0, rich: 3, biome: 'jungle', shape: 0, limit: [0, 0, 8],
    layout(m, W) {
      const b = m.bases[0];
      mapTiles(m, W, b.x, b.y, 10, (t) => { if (m.res[t] === R_STALK) { m.res[t] = 0; m.amt[t] = 0; } });
      placeField(m, W, b.x - 9, b.y - 4, 2.2, R_STALK, 0.8, 7);
    },
    setup(S) { kit(S, ['charger']); },
    goals: [
      { kind: 'placed', type: 'harvester', n: 1, text: 'Place a Harvester by the groves',
        count: (P, S) => S.buildings.filter((b) => !b.dead && b.owner === 0 && b.type === 'harvester').length,
        hint: '<b>Build</b> (<kbd>B</kbd>) → <b>Gather</b> (<kbd>1</kbd>) → <b>Harvester</b> (<kbd>H</kbd>). Tap a highlighted spot by the teal groves (left of base): <b>Build here</b>.',
        ui: "#btn-build, #build-tabs [data-g='gather'], .bcard[data-t='harvester'], #banner-ok" },
      { kind: 'linked', type: 'harvester', n: 1, text: 'Join the Harvester to your roads',
        count: (P, S) => S.buildings.filter((b) => !b.dead && b.owner === 0 && b.type === 'harvester' && b.unlinked === false).length,
        hint: 'Haulers only drive on roads. Tap the Harvester → <b>Lay road</b> (<kbd>R</kbd>): Workers pave it for you.',
        ui: '#sh-layroad', at: 'harvester' },
      { kind: 'made', good: 'fiber', n: [6, 8, 10],
        hint: 'A Hauler brings the materials, a Worker builds it, then Fiber comes in: tap the <b>Fiber</b> counter at the top.',
        ui: "#goods .res-chip[data-g='fiber']" },
    ],
  },
  {
    id: 'groundwork', name: 'Groundwork', chapter: 'First Steps',
    brief: 'Draw your first road in Paths, out to the grey boulders past your border. Then quarry their Stone and bake it into Cement.',
    intro: [
      'Nearly every building and every road is made of Cement, baked from Stone.',
      'The boulders lie past your border: this time draw the road out first, in Paths (R), then build at its end.',
      'Plans are paid as goods come in. In Paths, tap a road to take it up again, or drag along a planned one to call it off.',
      'Up to 3 Workers lay a road at once, so the rest stay free to build: <b>Road crew</b>, in Paths, changes that.',
      'Resources where you want to build? <b>Paths → Clear ground</b> (<kbd>Shift</kbd>+<kbd>C</kbd>) has Workers clear them away, but nothing comes back: gather them if you can.',
      'When the boulders run out, a Quarry cuts Stone from crags and cliffs or digs it: it never runs dry.',
      'The 1× chip at the top (or ]) speeds time up; [ slows it. The game saves itself: Continue picks up where you left off.',
      'On a computer each good on the top bar shows its change a minute; an amber ring means its makers are full and waiting for Haulers.',
      'To keep a game aside, pause → <b>Slots</b> saves it in one of five save slots (the main menu’s <b>Saved games</b> lists them).',
    ],
    mode: 'colony', seed: 1202, size: 0, rough: 0, rich: 3, biome: 'savanna', shape: 0, limit: [0, 0, 10],
    layout(m, W) {
      const b = m.bases[0];
      mapTiles(m, W, b.x, b.y, 12, (t) => { if (m.res[t] === R_BOULDER) { m.res[t] = 0; m.amt[t] = 0; } });
      placeField(m, W, b.x + 11, b.y - 8, 2.2, R_BOULDER, 0.75, 11);
    },
    setup(S) { kit(S, ['harvester', 'charger']); },
    goals: [
      // (Road first: with no building out there yet, there's no Lay road to do it for you. A planned tile counts.)
      { kind: 'roadto', text: 'Draw a road to the boulders',
        count: (P, S) => {
          for (let t = 0, N = S.W * S.H; t < N; t++) {
            if (!(S.road[t] ? wayOwner(t) === 0 : S.plan[t] === 1)) continue;
            const i = t % S.W, j = (t / S.W) | 0;
            for (let dj = -2; dj <= 2; dj++) for (let di = -2; di <= 2; di++) if (inMap(i + di, j + dj) && S.res[tIdx(i + di, j + dj)] === R_BOULDER) return 1;
          }
          return 0;
        },
        hint: '<b>Paths</b> (<kbd>R</kbd>): zoom out to see the grey boulders up and right, drag a road out to them, tap <b>Build</b>.',
        ui: "#btn-road, #banner-seg [data-v='road'], #banner-ok" },
      { kind: 'placed', type: 'quarry', n: 1, text: 'Place a Quarry by the boulders',
        count: (P, S) => S.buildings.filter((b) => !b.dead && b.owner === 0 && b.type === 'quarry').length,
        hint: '<b>Build</b> (<kbd>B</kbd>) → <b>Gather</b> (<kbd>1</kbd>) → <b>Quarry</b> (<kbd>Q</kbd>), by the boulders, touching your new road.',
        ui: "#btn-build, #build-tabs [data-g='gather'], .bcard[data-t='quarry'], #banner-ok" },
      { kind: 'built', type: 'kiln', n: 1,
        hint: '<b>Build</b> (<kbd>B</kbd>) → <b>Make</b> (<kbd>2</kbd>) → <b>Cement Works</b> (<kbd>C</kbd>), touching the Quarry and a road: a conveyor feeds it.',
        ui: "#btn-build, #build-tabs [data-g='make'], .bcard[data-t='kiln']" },
      { kind: 'made', good: 'cement', n: [8, 10, 14],
        hint: 'Each Stone bakes into 2 Cement; a road costs 1 Cement for 5 tiles. The <b>1×</b> chip (<kbd>]</kbd>) speeds time up.',
        ui: "#goods .res-chip[data-g='cement'], #btn-speed" },
    ],
  },
  {
    id: 'recharge', name: 'Recharge', chapter: 'First Steps',
    brief: 'Robots run on batteries. Build a Fuel Station to charge them, then dig Ore and tap Crystal.',
    intro: [
      'Robots run on batteries, and the Command Base can\'t charge them.',
      'Low robots look for a Fuel Station; drained ones work at half speed.',
      'Fuel is a liquid: your Tanker carries it to the Fuel Station, not the Haulers.',
      'Then find Ore (dark veins) and Crystal (violet clusters) for the machines to come.',
      'The robot counter (U) shows what every robot is doing; Show workers marks them on the map.',
    ],
    mode: 'colony', seed: 1303, size: 0, rough: 1, rich: 3, biome: 'polar', shape: 0, limit: [0, 0, 12],
    setup(S) { kit(S, ['harvester', 'quarry', 'kiln']); getE(S.players[0].lander).stock.fuel += 20; },
    goals: [
      { kind: 'built', type: 'charger', n: 1,
        hint: '<b>Build</b> (<kbd>B</kbd>) → <b>Move</b> (<kbd>3</kbd>) → <b>Fuel Station</b> (<kbd>F</kbd>), touching a road near the work.',
        ui: "#btn-build, #build-tabs [data-g='move'], .bcard[data-t='charger']" },
      { kind: 'built', type: 'mine', n: 1,
        hint: '<b>Build</b> (<kbd>B</kbd>) → <b>Gather</b> (<kbd>1</kbd>) → <b>Ore Mine</b> (<kbd>R</kbd>) by the dark ore veins above your base, joined to your roads.',
        ui: "#btn-build, #build-tabs [data-g='gather'], .bcard[data-t='mine']" },
      { kind: 'built', type: 'tap', n: 1,
        hint: '<b>Build</b> (<kbd>B</kbd>) → <b>Gather</b> (<kbd>1</kbd>) → <b>Crystal Tap</b> (<kbd>C</kbd>) by the violet crystals above your base, with a road.',
        ui: "#btn-build, #build-tabs [data-g='gather'], .bcard[data-t='tap']" },
      { kind: 'made', good: 'ore', n: [8, 10, 14],
        hint: 'Tap the <b>Ore</b> counter for the <b>Economy</b> panel (<kbd>Y</kbd>): on hand, made, used. Mine idle? Tap it → <b>Call a worker</b>.',
        ui: "#goods .res-chip[data-g='ore'], #sh-callw" },
    ],
  },
  {
    id: 'hotmetal', name: 'Hot Metal', chapter: 'First Steps',
    brief: 'Move a Cement Works that landed in the wrong place, then smelt your first Alloy beside an Ore Mine.',
    intro: [
      'Alloy is the metal for machines: a Smelter melts Ore with Fiber.',
      'Buildings side by side pass goods by conveyor, with no Hauler, and work a tenth faster while fed.',
      'While you place a building, green arrows show the conveyor links it would make.',
      'Most finished buildings can be moved for free: the old one keeps working until the new one stands.',
      'Tap a good up top (Y) for the <b>Economy</b> panel: its chain, who makes and uses it, and what holds it up.',
      'Statistics (I) is its History tab: what you make and how busy your buildings are. Pause (P) on a building\'s panel stops it.',
    ],
    mode: 'colony', seed: 1404, size: 0, rough: 1, rich: 3, biome: 'volcanic', shape: 0, limit: [0, 0, 12],
    // (An ore field on the base's level, so the Ore Mine and a Smelter beside it work at a fair pace.)
    layout(m, W) { const b = m.bases[0]; placeField(m, W, b.x - 5, b.y - 6, 1.7, R_ORE, 0.85, 3); },
    setup(S) {
      const k = kit(S, ['harvester', 'quarry', 'charger', 'mine', 'tap']), L = getE(S.players[0].lander), q = k.quarry;
      // The Cement Works that landed in the wrong place: across the Command Base from the Quarry.
      if (q) preBuild(0, 'kiln', 2 * L.x - q.x, 2 * L.y - q.y, { road: true, reach: 4 });
      L.stock.fuel += 20;
    },
    goals: [
      { kind: 'moved', n: 1, text: 'Move the Cement Works beside the Quarry', at: 'kiln',
        count: (P, S) => ((P.stats.moved || 0) > 0 && S.buildings.some((b) => !b.dead && b.owner === 0 && b.built && b.type === 'kiln' && touching(b).some((c) => c.type === 'quarry')) ? 1 : 0),
        hint: 'Tap the Cement Works → <b>Move</b> (<kbd>M</kbd>), then a free spot touching the Quarry → <b>Build here</b>. It\'s free.',
        ui: '#sh-move' },
      // (Plan while paused: S.mission.planned is counted by act() in js/ui.js, a site or road placed while planning.)
      { kind: 'planned', n: 1, text: 'Place a building while paused',
        count: (P, S) => (S.mission.planned ? 1 : 0),
        hint: 'Pause menu → <b>Plan while paused</b> (<kbd>Shift</kbd>+<kbd>Space</kbd>), place the Smelter, then <b>Resume</b>.',
        ui: '#p-plan' },
      { kind: 'beside', n: 1, text: 'Build a Smelter beside the Ore Mine',
        count: (P, S) => {
          const fed = new Set();
          for (const m of S.buildings) if (!m.dead && m.owner === 0 && m.type === 'mine') for (const l of feedTargets(m)) if (l.c.type === 'smelter') fed.add(l.c.id);
          return fed.size;
        },
        hint: '<b>Build</b> (<kbd>B</kbd>) → <b>Make</b> (<kbd>2</kbd>) → <b>Smelter</b> (<kbd>M</kbd>), touching the Ore Mine and a road.',
        ui: "#btn-build, #build-tabs [data-g='make'], .bcard[data-t='smelter']" },
      // (The Economy panel is display only: S.mission.ecSeen is set when it shows Whole economy or Alloy, js/economy.js.)
      { kind: 'economy', n: 1, text: 'See where Alloy comes from in the Economy panel',
        count: (P, S) => (S.mission.ecSeen ? 1 : 0),
        hint: 'Tap <b>Alloy</b> up top (<kbd>Y</kbd>): its chain shows Ore and Fiber flowing in. <b>Whole economy</b> shows it all.',
        ui: "#goods .res-chip[data-g='alloy'], #ec-tabs [data-t='flow']" },
      { kind: 'made', good: 'alloy', n: [8, 12, 16],
        hint: '2 Ore and 2 Fiber make 3 Alloy. Tap the Smelter: its panel says <b>Fed by conveyor</b>, from the Ore Mine.',
        ui: "#goods .res-chip[data-g='alloy']" },
    ],
  },

  // Chapter 2, Growing the Colony. Bots that build bots, Fuel from farms, groves that regrow, and Outposts that push the border out.
  {
    id: 'assembly', name: 'Assembly Line', chapter: 'Growing the Colony',
    brief: 'Bots make bots. Etch Chips, build a Bot Foundry and order your first new robots.',
    intro: [
      'The <b>Bot Foundry</b> builds robots from Alloy and Chips, one round of parts at a time.',
      'A <b>Chip Fab</b> etches Crystal onto Alloy to make the Chips.',
      'The Foundry builds only what you order. Two Workers are kept free for building while sites wait (one, if your ladder puts Building sites lower).',
      'Workers go first where the colony is short: if the Fab waits for Crystal, the Crystal Tap gets a worker before the Foundry. One stuck in a building that can\'t work goes to help elsewhere.',
      'The <b>Workforce</b> panel (tap Workers up top) shows what each Worker does and what waits for one; its ladder says who gets Workers first.',
      'On a computer, <kbd>Shift</kbd>+<kbd>F</kbd> opens its <b>Order bots</b> list from anywhere.',
      'At most 6 building sites at once; a colony holds up to 150 robots.',
    ],
    mode: 'colony', seed: 2203, size: 0, rough: 2, rich: 3, biome: 'desert', limit: [0, 0, 15],
    setup(S) {
      kit(S, ['harvester', 'quarry', 'kiln', 'charger', 'mine', 'tap', 'smelter'], 3);
      getE(S.players[0].lander).stock.fuel += 20;
    },
    goals: [
      { kind: 'built', type: 'fab', n: 1,
        hint: '<b>Build</b> (<kbd>B</kbd>) → <b>Make</b> (<kbd>2</kbd>) → <b>Chip Fab</b> (<kbd>F</kbd>), touching the Smelter and a road: a conveyor feeds it Alloy.',
        ui: "#btn-build, #build-tabs [data-g='make'], .bcard[data-t='fab']" },
      { kind: 'built', type: 'foundry', n: 1,
        hint: '<b>Build</b> (<kbd>B</kbd>) → <b>Make</b> (<kbd>2</kbd>) → <b>Bot Foundry</b> (<kbd>B</kbd>). In a hurry? Tap its site → Priority: <b>High</b>.',
        wait: 'Your Bot Foundry is going up. In a hurry? Tap its site → Priority: <b>High</b>: it gets its materials and builder first.',
        ui: "#btn-build, #build-tabs [data-g='make'], .bcard[data-t='foundry'], #sh-prio [data-v='high']" },
      { kind: 'bots', n: [3, 4, 6],
        hint: 'Tap the Bot Foundry → <b>Order bots</b>: Workers <b>+1</b>, Haulers <b>+1</b>. The arrows set what it builds first.',
        ui: "#sh-orders .order-row[data-k='worker'] [data-d='1'], #sh-orders .order-row[data-k='hauler'] [data-d='1']" },
      { kind: 'workforce', n: 1, text: 'Put Crystal Taps on top of the Workforce ladder',
        count: (P) => (P.wf && Array.isArray(P.wf.order) && wfNormOrder(P.wf.order)[0] === 'crystal' ? 1 : 0),
        hint: 'Tap <b>Workers</b> up top (<kbd>Shift</kbd>+<kbd>W</kbd>) → ladder: <b>Crystal Taps</b> ▲ to the top, or drag it.',
        ui: "#pop .pn-w, #wf-ladder [data-k='crystal'] [data-mv='-1']" },
      // (A preset of your own is kept on the device, not in the game: S.mission.wfSaved is set by wfMineSave, js/workforce.js.)
      { kind: 'wfsave', n: 1, text: 'Save your ladder as a preset of your own',
        count: (P, S) => (S.mission.wfSaved ? 1 : 0),
        hint: 'Workforce (<kbd>Shift</kbd>+<kbd>W</kbd>) → Your presets → <b>Save</b> under Custom 1. <b>Load</b> brings it back.',
        ui: "#pop .pn-w, #wf-mine [data-slot='0'] [data-mine='save']" },
      { kind: 'stocked', n: [15, 15, 20], text: 'Have {n} Chips in store', count: () => goodTotal(0, 'chip'), at: 'fab',
        hint: 'The Fab rests at 10 Chips: its <b>stock limit</b>. Tap the Chip Fab → Stock limit <b>+</b> to raise it.',
        ui: '#sh-lim-plus' },
    ],
  },
  {
    id: 'greenfuel', name: 'Green Fuel', chapter: 'Growing the Colony',
    brief: 'The landing burned your Fuel and the Fuel Station is running dry. Grow Fuel with Agribots, and plant groves that regrow.',
    intro: [
      'Fuel Stations burn <b>Fuel</b>, and this landing left you almost none.',
      'An <b>Agribot</b> runs a Bio Farm: it grows Fuel crops on dark fertile soil.',
      'A <b>Grove Planter</b>\'s Agribot plants stalk groves that regrow, so Fiber never runs out.',
      'A Bio Farm or a Grove Planter runs only with its own Agribot, and you landed with one.',
    ],
    mode: 'colony', seed: 3307, size: 1, rough: 1, rich: 3, biome: 'jungle', limit: [0, 0, 20],
    layout(m, W) { const b = m.bases[0]; placeFertile(m, W, b.x + 7, b.y - 3, 2.2); placeFertile(m, W, b.x - 8, b.y - 5, 1.8); },
    setup(S, diff) {
      const k = kit(S, KIT6, 4);
      getE(S.players[0].lander).stock.fuel = mPick([6, 3, 0], diff);
      if (k.charger) k.charger.stock.fuel = 0;
    },
    goals: [
      { kind: 'built', type: 'farm', n: 1,
        hint: '<b>Build</b> (<kbd>B</kbd>) → <b>Gather</b> (<kbd>1</kbd>) → <b>Bio Farm</b> (<kbd>F</kbd>), by dark fertile soil. Your Agribot runs it.',
        ui: "#btn-build, #build-tabs [data-g='gather'], .bcard[data-t='farm']" },
      { kind: 'bots', type: 'agribot', n: 1,
        hint: 'Tap the Bot Foundry → <b>Order bots</b>: Agribots <b>+1</b>. The Grove Planter needs an Agribot of its own.',
        ui: "#sh-orders .order-row[data-k='agribot'] [data-d='1']" },
      { kind: 'built', type: 'grower', n: 1,
        hint: '<b>Build</b> (<kbd>B</kbd>) → <b>Gather</b> (<kbd>1</kbd>) → <b>Grove Planter</b> (<kbd>G</kbd>), beside your Harvester: its Agribot plants groves that regrow.',
        ui: "#btn-build, #build-tabs [data-g='gather'], .bcard[data-t='grower']" },
      { kind: 'made', good: 'fuel', n: [15, 20, 30],
        hint: 'Crops ripen in 45 s. More Fuel? A second <b>Bio Farm</b>, with its own Agribot. Only <b>Tankers</b> carry Fuel.',
        ui: "#goods .res-chip[data-g='fuel'], #build-tabs [data-g='gather'], .bcard[data-t='farm']" },
    ],
  },
  {
    id: 'frontier', name: 'Frontier', chapter: 'Growing the Colony',
    brief: 'The ore by your base is worked out. Clear the spent mine, push your border out with Outposts and mine the rich frontier.',
    intro: [
      'Your land is the tinted ground. You can also build up to 10 tiles past your roads and buildings.',
      'An <b>Outpost</b> claims a ring of land 7 tiles round it; other buildings claim a little.',
      'Deposits out past the border are richer. Tap one to see what it holds.',
      'A spent building says so on its panel. <b>Dismantle</b> gives back all its materials in crates.',
      'In Colony free play, claiming more of the land earns milestones. <b>M</b> shows or hides the minimap.',
      'The 1–4 pips under the minimap keep <b>camera spots</b>: tap one to keep this view, tap it later to fly back (keys: <kbd>Shift</kbd>+<kbd>F1</kbd>–<kbd>F4</kbd>, then <kbd>F1</kbd>–<kbd>F4</kbd>).',
    ],
    mode: 'colony', seed: 7101, size: 0, rough: 1, rich: 3, biome: 'savanna', limit: [0, 0, 20],
    // The ore round the landing is gone (and the two last veins behind the base): only the richer veins out past the
    // border are left.
    layout(m, W) {
      const b = m.bases[0];
      mapTiles(m, W, b.x, b.y, 13, (t, i, j) => { if (m.res[t] === R_ORE && (dist2(i, j, b.x, b.y) <= 121 || j > b.y)) { m.res[t] = 0; m.amt[t] = 0; } });
    },
    setup(S) {
      kit(S, ['harvester', 'quarry', 'kiln', 'charger', 'farm']);
      // The spent Ore Mine, where the starter ore was (addBuilding skips canPlace's ore-in-reach rule).
      const L = getE(S.players[0].lander);
      for (let r = 0, done = false; r <= 2 && !done; r++) {
        for (let j = L.y - 5 - r; j <= L.y - 5 + r && !done; j++) for (let i = L.x - 4 - r; i <= L.x - 4 + r && !done; i++) {
          if (Math.max(Math.abs(i - (L.x - 4)), Math.abs(j - (L.y - 5))) !== r || !inMap(i, j)) continue;
          const t = tIdx(i, j);
          if (S.terrain[t] !== T_GROUND || S.res[t] || S.bAt[t] || S.road[t] || S.ramp[t] || S.fert[t]) continue;
          const mine = addBuilding(0, 'mine', i, j, true);
          for (const u of roadRouteTo(0, mine) || []) setRoad(u % S.W, (u / S.W) | 0, true, 0);
          S.mission.spent = mine.id;
          done = true;
        }
      }
      computeTerritory();
    },
    goals: [
      { kind: 'dismantled', n: 1, text: 'Dismantle the spent Ore Mine', at: 'mine',
        // (Gone by Dismantle; or moved out to fresh ore, which clears it too and must not leave the goal stuck.)
        count: (P, S) => { const m = getE(S.mission.spent); return (!m || m.dead) && (P.stats.dismantled || P.stats.moved) ? 1 : 0; },
        hint: 'Tap the idle Ore Mine (nothing left in reach) → <b>Dismantle</b>, twice. Haulers bring the crates home.',
        ui: '#sh-demolish' },
      { kind: 'built', type: 'outpost', n: [1, 2, 3],
        hint: '<b>Build</b> (<kbd>B</kbd>) → <b>Defend</b> (<kbd>4</kbd>) → <b>Outpost</b> (<kbd>O</kbd>), out past your border toward the far ore. <b>Lay road</b> to it.',
        ui: "#btn-build, #build-tabs [data-g='defend'], .bcard[data-t='outpost']" },
      { kind: 'land', n: [20, 32, 38],
        hint: 'Put Outposts out past your border, well apart, for the most land. The <b>% land</b> chip at the top counts it.',
        ui: '#clock' },
      { kind: 'made', good: 'ore', n: [20, 30, 40],
        hint: '<b>Build</b> (<kbd>B</kbd>) → <b>Gather</b> (<kbd>1</kbd>) → <b>Ore Mine</b> (<kbd>R</kbd>), by the rich veins past the old border. <b>Lay road</b>.',
        ui: "#btn-build, #build-tabs [data-g='gather'], .bcard[data-t='mine'], #goods .res-chip[data-g='ore']" },
    ],
  },

  // The Atmosphere Engine's teaching mission (the megastructure sheet's "Rain", Nov 2026): a dry Rust plateau. The Engine
  // on two Generators calms the air, and at stage 2 it rains: the barren ground round it turns fertile for Bio Farms.
  {
    id: 'rain', name: 'Rain', chapter: 'Growing the Colony',
    brief: 'A dry plateau, no farmland for miles. The Pathfinder left plans for an Atmosphere Engine: build it, and bring the rain.',
    intro: [
      'The <b>Atmosphere Engine</b> (Build, Mega, <kbd>N</kbd>) slowly changes the weather and the land round it.',
      'It needs <b>2 Generators</b> with Fuel within 4 tiles: it takes a Fuel a minute from each. A Tanker brings it.',
      'Stage 1, Calm, at once: no dust storm within 8 tiles. After 6 minutes of power, stage 2, Rain: 12 tiles.',
      'In the Rain the barren ground turns fertile: a <b>Bio Farm</b> works anywhere in it. It is everyone\'s, whoever owns the land.',
      'Unpowered, it stops growing; what it changed stays. Green and Garden come later, 10 and 12 minutes on.',
    ],
    mode: 'colony', seed: 5311, size: 1, rough: 1, rich: 3, biome: 'desert', shape: 0, mega: true, limit: [0, 0, 30],
    layout(m, W) { for (let t = 0; t < m.fert.length; t++) m.fert[t] = 0; }, // (no farmland anywhere: only the Engine's)
    setup(S) {
      kit(S, KIT6, 4);
      const L = getE(S.players[0].lander);
      aeKit(L); L.stock.cement += 30; L.stock.alloy += 10; // (and for the Bio Farms)
      enterBuilding(addBot(0, 'tanker', L.x, L.y), L);
    },
    goals: [
      AE_BUILT,
      { kind: 'atmosPower', n: 1, text: 'Power the Engine with 2 Generators', at: 'atmos',
        count: (P, S) => { const e = aeOwn(S); return e && e.built && e.aeSrc ? 1 : 0; },
        hint: '<b>Build</b> → <b>Make</b> (<kbd>2</kbd>) → <b>Generator</b> (<kbd>G</kbd>), two, within 4 tiles of the Engine.',
        ui: "#btn-build, #build-tabs [data-g='make'], .bcard[data-t='generator']" },
      aeStageGoal(2, 'Reach stage 2 of the Engine, Rain', 'Keep its Generators fed (a Tanker brings Fuel): 6 minutes of power. Speed up: <b>1×</b> (<kbd>]</kbd>).'),
      { kind: 'atmosFarms', n: [3, 4, 4], text: 'Plant {n} Bio Farms on the new soil', at: 'atmos', count: (P, S) => aeFarms(S),
        hint: '<b>Build</b> → <b>Gather</b> (<kbd>1</kbd>) → <b>Bio Farm</b> (<kbd>F</kbd>) on the dark wet ground round the Engine.',
        ui: "#btn-build, #build-tabs [data-g='gather'], .bcard[data-t='farm']" },
    ],
  },

  // Chapter 3, Roads and Traffic. Keep the Haulers moving: Depots, Route to, one-way lanes, lights, bridges, tunnels, Ramps and asphalt.
  {
    id: 'rushhour', name: 'Rush Hour', chapter: 'Roads and Traffic',
    brief: 'A Depot full of Stone landed far out and the roads are jamming. Join it up, add Haulers, then sort the traffic.',
    intro: [
      'A <b>Depot</b> is extra storage: Haulers drop goods at the nearest store they can reach.',
      'In Paths, <b>Route to</b> (Z) plans the cheapest road to wherever you tap.',
      'Haulers keep their distance, slow for oncoming traffic and give way at junctions.',
      'The <b>Traffic map</b> (T) colours the roads by how busy they are.',
      'One-way lanes, traffic lights and overpasses keep it all moving. Nobody turns on an overpass: its two roads just cross.',
    ],
    mode: 'colony', seed: 4409, size: 1, rough: 0, rich: 3, biome: 'autumn', shape: 0, limit: [0, 0, 20],
    setup(S) {
      // (The colony so far, with Green Fuel's Bio Farm and Grove Planter: without them a slow player runs out of Fuel
      // (bots at half speed) and Fiber (the kit's Harvester has ~36 in reach) before the mission is done.)
      kit(S, [...KIT6, 'grower'], 4);
      const L = getE(S.players[0].lander), P = S.players[0];
      // A Bio Farm on the fertile flats to the south-west (kit() would put it north, on the way to the far Depot).
      preBuild(0, 'farm', L.x - 14, L.y + 3, { road: true, reach: 4 });
      computeTerritory();
      enterBuilding(addBot(0, 'agribot', L.x, L.y), L); // (its crew: the one you land with runs the Grove Planter)
      P.stats.startBots = P.stats.bots;
      L.stock.cement += 6;
      // The far Depot, with no road: as far out as a Depot may stand (11 tiles), north, east or west.
      for (let r = 11, done = false; r >= 8 && !done; r--) for (const [dx, dy] of [[0, -r], [r, 0], [-r, 0]]) {
        if (!canPlace(0, 'depot', L.x + dx, L.y + dy).ok) continue;
        const d = addBuilding(0, 'depot', L.x + dx, L.y + dy, true);
        d.stock.stone = 30;
        S.mission.depot = d.id;
        done = true;
        break;
      }
      computeTerritory();
    },
    goals: [
      { kind: 'linked', n: 1, text: 'Join the far Depot to your roads',
        count: (P, S) => { const d = getE(S.mission.depot); return d && !d.dead && d.owner === 0 && d.unlinked === false ? 1 : 0; },
        hint: '<b>Paths</b> (<kbd>R</kbd>) → <b>Route to</b> (<kbd>Z</kbd>), tap the Depot: the cheapest road is planned. Tap <b>Build</b>.',
        ui: '#btn-road, #banner-route, #banner-ok' },
      { kind: 'bots', type: 'hauler', n: [2, 3, 4], at: 'foundry',
        hint: 'Tap the Bot Foundry → <b>Order bots</b>: Haulers <b>+1</b>. More Haulers, busier roads.',
        ui: "#sh-orders .order-row[data-k='hauler'] [data-d='1']" },
      { kind: 'oneway', n: [8, 12, 16],
        hint: '<b>Paths</b> → <b>Arrows</b> (<kbd>O</kbd>): drag along a road to point it one way. Lay a second road back. <b>Traffic map</b> (<kbd>T</kbd>) shows jams.',
        ui: "#btn-road, #banner-seg [data-v='arrows'], #banner-traffic" },
      { kind: 'junctions', n: [2, 2, 3], text: 'Put lights on {n} junctions',
        count: (P, S) => Object.values(S.lights).filter((l) => l.owner === 0).length + Object.values(S.over).filter((o) => o.owner === 0).length,
        hint: '<b>Paths</b> → <b>Junctions</b> (<kbd>L</kbd>): tap a junction for a light (1 Alloy). Again on a crossing: an overpass (no turning).',
        ui: "#btn-road, #banner-seg [data-v='lights']" },
    ],
  },
  {
    id: 'crossings', name: 'Crossings', chapter: 'Roads and Traffic',
    brief: 'A pond, a crag and a ledge stand between you and fresh fields. Bridge, tunnel and Ramp your way to them.',
    intro: [
      'Lighter ground is higher. Robots can\'t climb a cliff; where it is one level high, a <b>Ramp</b> cuts a slope.',
      'Drag a road over water (or a chasm) and it is a <b>bridge</b>; into rock, a <b>tunnel</b>. Both cost more.',
      'Route to (Z) plans the cheapest way, Ramps and bridges included, but only to ground your bots can reach.',
      'Other planets: tides on Tidal flats, fords on River delta, a quake on Fault line, lava on Volcano.',
    ],
    mode: 'colony', seed: 5303, size: 1, rough: 2, rich: 3, biome: 'alien', shape: 0, limit: [0, 0, 20],
    layout(m, W) {
      const b = m.bases[0], lv = m.elev[b.y * W + b.x];
      // A pond to the north, its south shore along your border (so a drag north from any of your roads bridges it).
      for (let j = b.y - 11; j <= b.y - 8; j++) for (let i = b.x - 2; i <= b.x + 2; i++) {
        const t = j * W + i;
        m.terrain[t] = T_WATER; m.res[t] = 0; m.amt[t] = 0; m.fert[t] = 0; m.ramp[t] = 0; m.elev[t] = lv;
      }
      placeField(m, W, b.x, b.y - 15, 1.8, R_CRYSTAL, 0.8, 21);
      // A crag to the west, inside the border.
      for (let j = b.y - 4; j <= b.y + 1; j++) for (const i of [b.x - 7, b.x - 6]) {
        const t = j * W + i;
        m.terrain[t] = T_ROCK; m.res[t] = 0; m.amt[t] = 0; m.fert[t] = 0; m.ramp[t] = 0; m.elev[t] = lv;
      }
      // A ledge to the east, one level up, with no way up.
      mapTiles(m, W, b.x + 10, b.y - 4, 4, (t, i, j) => {
        m.terrain[t] = T_GROUND; m.ramp[t] = 0; m.res[t] = 0; m.amt[t] = 0; m.fert[t] = 0;
        m.elev[t] = dist2(i, j, b.x + 10, b.y - 4) <= 6.25 ? lv + 1 : lv;
      });
      placeField(m, W, b.x + 10, b.y - 4, 1.6, R_BOULDER, 0.9, 23);
    },
    setup(S) {
      // (The colony so far, with Green Fuel's Bio Farm and Grove Planter: without them a slow player runs out of Fuel
      // (bots at half speed) and Fiber (the kit's Harvester has ~36 in reach) before the mission is done.)
      kit(S, KIT8, 4);
      const L = getE(S.players[0].lander), P = S.players[0];
      P.stats.startBots = P.stats.bots;
      L.stock.cement += 10; L.stock.alloy += 6;
      S.mission.ledge = { x: L.x + 10, y: L.y - 4 }; // (the layout's ledge: its top is 2.5 tiles across)
    },
    goals: [
      // (The pond is 4 rows deep, so 4 bridge tiles is the whole crossing, at every difficulty. Planned tiles count, as
      // in Groundwork: workers take a minute to build it, and meanwhile the hint mustn't ask for another.)
      { kind: 'bridges', n: 4, text: 'Bridge the pond',
        count: (P, S) => ownTiles((t) => (S.road[t] || S.plan[t] === 1) && (S.terrain[t] === T_WATER || S.terrain[t] === T_CHASM)),
        hint: '<b>Paths</b> → <b>Bridges</b> (<kbd>G</kbd>): drag a road from your base north, right across the pond.',
        ui: "#btn-road, #banner-seg [data-v='bridge']" },
      { kind: 'tunnels', n: 2, text: 'Bore 2 tunnel tiles',
        count: (P, S) => ownTiles((t) => (S.road[t] || S.plan[t] === 1) && S.terrain[t] === T_ROCK),
        hint: '<b>Bridges</b> (<kbd>G</kbd>) tunnels too: drag a road west straight through the dark crag in your land.',
        ui: "#btn-road, #banner-seg [data-v='bridge']" },
      // (A Ramp on or beside the ledge's top: one elsewhere on the map doesn't lead up to the Quarry spot.)
      { kind: 'ramps', n: 1, text: 'Build a Ramp up the ledge',
        count: (P, S) => {
          const L = getE(P.lander), lv = S.elev[tIdx(L.x, L.y)], c = S.mission.ledge;
          const top = (i, j) => inMap(i, j) && S.elev[tIdx(i, j)] === lv + 1 && dist2(i, j, c.x, c.y) <= 6.25;
          return ownTiles((t) => { const i = t % S.W, j = (t / S.W) | 0; return !!S.ramp[t] && (top(i, j) || top(i + 1, j) || top(i - 1, j) || top(i, j + 1) || top(i, j - 1)); });
        },
        hint: '<b>Paths</b> → <b>Ramps</b> (<kbd>V</kbd>): tap a lit spot at the foot or top of the low ledge to the east.',
        ui: "#btn-road, #banner-seg [data-v='ramp']" },
      { kind: 'highQuarry', n: 1, text: 'Build a Quarry up on the ledge',
        count: (P, S) => {
          const L = getE(P.lander), lv = S.elev[tIdx(L.x, L.y)], c = S.mission.ledge;
          return S.buildings.filter((b) => !b.dead && b.owner === 0 && b.built && b.type === 'quarry' && S.elev[tIdx(b.x, b.y)] > lv && dist2(b.x, b.y, c.x, c.y) <= 9).length;
        },
        hint: 'Up the Ramp: <b>Build</b> (<kbd>B</kbd>) → <b>Gather</b> (<kbd>1</kbd>) → <b>Quarry</b> (<kbd>Q</kbd>) by the boulders on top, and <b>Lay road</b>.',
        ui: "#btn-build, #build-tabs [data-g='gather'], .bcard[data-t='quarry']" },
    ],
  },
  {
    id: 'blacktop', name: 'Blacktop', chapter: 'Roads and Traffic',
    brief: 'Pump oil, cook Asphalt and send your Pavers out: new roads laid fast, and the fastest roads on the planet.',
    intro: [
      'Road doubles a robot\'s speed; <b>asphalt</b> is faster still, and trucks love it.',
      'An Oil Pump on a seep pumps Crude, a liquid: Tankers carry it. A road over a seep leaves the oil below.',
      'An Asphalt Plant cooks Crude with Cement; a Roadworks\' two <b>Pavers</b> lay it, 4 tiles per Asphalt.',
      'Pavers lay your planned roads first, twice as fast as Workers, and leave the Workers free to build.',
      'Busy asphalt wears out: the Pavers resurface the roads they look after.',
    ],
    mode: 'colony', seed: 5501, size: 1, rough: 2, rich: 3, biome: 'desert', shape: 0, limit: [0, 0, 20],
    layout(m, W) { const b = m.bases[0]; placeField(m, W, b.x + 5, b.y - 5, 1.2, R_OIL, 0.95, 9); },
    setup(S) {
      // (The colony so far, with Green Fuel's Bio Farm and Grove Planter: without them a slow player runs out of Fuel
      // (bots at half speed) and Fiber (the kit's Harvester has ~36 in reach) before the mission is done.)
      kit(S, KIT8, 4);
      const L = getE(S.players[0].lander), P = S.players[0];
      P.stats.startBots = P.stats.bots;
      L.stock.cement += 10;
    },
    goals: [
      { kind: 'built', type: 'pump', n: 1,
        hint: '<b>Build</b> (<kbd>B</kbd>) → <b>Gather</b> (<kbd>1</kbd>) → <b>Oil Pump</b> (<kbd>P</kbd>), right on the dark oil seep by your base, and <b>Lay road</b>.',
        ui: "#btn-build, #build-tabs [data-g='gather'], .bcard[data-t='pump']" },
      { kind: 'built', type: 'tarworks', n: 1,
        hint: '<b>Build</b> (<kbd>B</kbd>) → <b>Make</b> (<kbd>2</kbd>) → <b>Asphalt Plant</b> (<kbd>T</kbd>), touching the Oil Pump (Crude flows straight in) and a road.',
        ui: "#btn-build, #build-tabs [data-g='make'], .bcard[data-t='tarworks']" },
      // (No #btn-build in ui, so with nothing open the coach lights Build and the Move tab and rings the Bot Foundry: both halves.)
      { kind: 'roadworks', n: 1, text: 'Build a Roadworks and two Pavers', at: 'foundry',
        count: (P, S) => Math.min(S.buildings.filter((b) => !b.dead && b.owner === 0 && b.built && b.type === 'roadworks').length, Math.floor(S.bots.filter((u) => !u.dead && u.owner === 0 && u.type === 'paver').length / 2)),
        hint: '<b>Build</b> → <b>Move</b> (<kbd>3</kbd>) → <b>Roadworks</b> (<kbd>O</kbd>) by a road. Then tap the Bot Foundry → <b>Pavers +1</b>, twice.',
        ui: "#build-tabs [data-g='move'], .bcard[data-t='roadworks'], #sh-orders .order-row[data-k='paver'] [data-d='1']" },
      // (Pavers lay new road too: a road planned now goes to them before the Workers, who are kept to the Road crew.)
      { kind: 'paverRoad', n: [6, 10, 14], text: 'Lay {n} tiles of new road with your Pavers',
        count: (P) => P.paverLaid || 0,
        hint: '<b>Paths</b> (<kbd>R</kbd>): drag a new road, tap <b>Build</b>. Pavers lay it fast; <b>Road crew</b> caps Workers on it.',
        ui: "#btn-road, #banner-seg [data-v='road'], #road-crew, #banner-ok" },
      { kind: 'paths', tier: 2, n: [8, 14, 20],
        hint: '<b>Paths</b> → <b>Pave</b> (<kbd>E</kbd>): drag along busy roads to mark them. Or Roadworks → <b>Every joined road</b>.',
        ui: "#btn-road, #banner-seg [data-v='pave'], #sh-pmode [data-v='all']" },
    ],
  },

  {
    id: 'arterial', name: 'Arterial', chapter: 'Roads and Traffic',
    brief: 'Accord road standard, arterial class. Open the freight corridor to the survey depot.',
    intro: [
      'Zoom out to see both concrete strips and the survey depot. Drag north along the <b>eastern strip</b> with Express to mark both lanes.',
      'Join both ends to the service road on the east. Close the gap beside each short road stub with <b>Roads</b> to make the ramps.',
      'A stocked <b>Roadworks</b> and its Paver are ready at the south end. Keep the ordinary service road for Haulers.',
      'Freight Trucks reach 4½ times off-road speed on Express. Sign gantries rise along the straight pair.',
      'Survey depot reception board lit. Destinations pending.',
    ],
    mode: 'colony', seed: 5521, size: 1, rough: 0, rich: 3, biome: 'desert', shape: 0, limit: [0, 0, 14],
    layout(m, W) {
      const base = m.bases[0], { x, north, south } = arterialRoute(base);
      for (let y = north - 1; y <= south + 2; y++) for (let i = base.x; i <= x + 4; i++) {
        const t = y * W + i;
        m.terrain[t] = T_GROUND; m.elev[t] = 0; m.ramp[t] = 0;
        m.res[t] = 0; m.amt[t] = 0; m.grow[t] = 0; m.fert[t] = 0;
      }
    },
    setup(S) {
      const L = getE(S.players[0].lander), { x, north, south } = arterialRoute(L);
      const road = (i, j) => { if (!S.bAt[tIdx(i, j)]) setRoad(i, j, true, 0); };
      for (let y = north; y <= south + 2; y++) road(x + 3, y);
      road(x + 2, north); road(x + 2, south);
      for (let y = north - 1; y <= south + 1; y++) { road(x, y); road(x - 1, y); }
      for (let i = L.x; i <= x + 3; i++) road(i, south + 2);
      for (let y = south + 3; y < L.y; y++) road(L.x, y);
      const depot = addBuilding(0, 'depot', x + 4, north, true);
      S.mission.arterialDepot = depot.id;
      S.mission.arterialRuns = 0;
      const works = addBuilding(0, 'roadworks', x + 4, south + 2, true);
      works.stock.asphalt = 40; works.stock.alloy = 12;
      addBot(0, 'paver', works.x, works.y);
      addBot(0, 'truck', L.x, L.y);
      L.stock.cement += 60;
      L.stock.fuel += 16;
      computeTerritory();
    },
    goals: [
      { kind: 'arterialPair', n: 16, text: 'Plan the Express pair along both prepared strips',
        count: (P, S) => arterialPairs(P, S, false),
        hint: '<b>Paths</b> → <b>Express</b> (<kbd>Shift</kbd>+<kbd>E</kbd>). Drag north along the east strip, then <b>Build</b>.',
        ui: "#banner-seg [data-v='express'], #banner-ok" },
      { kind: 'arterialRamps', n: 2, text: 'Link both ends to the service road',
        count: (P, S) => {
          const { x, north, south } = arterialRoute(getE(P.lander));
          return [north, south].filter((y) => {
            const t = tIdx(x + 1, y);
            return S.road[t] && S.pave[t] !== 3 && wayOwner(t) === 0 && S.road[t + 1] && S.road[t - 1];
          }).length;
        },
        hint: '<b>Paths</b> → <b>Roads</b> (<kbd>R</kbd>). Fill the gaps by the two side stubs, then <b>Build</b>.',
        ui: "#banner-seg [data-v='road'], #banner-ok" },
      { kind: 'arterialSurface', n: 16, text: 'Surface the full Express pair', at: 'roadworks',
        count: (P, S) => arterialPairs(P, S, true),
        hint: 'Tap the stocked Roadworks → <b>Marked roads</b>. Its Paver lays the Express surface.',
        ui: "#sh-pmode [data-v='marked']" },
      { kind: 'arterialRuns', n: [2, 3, 4], text: 'Complete {n} Express Freight Truck deliveries to the Depot', at: 'depot',
        count: (P, S) => S.mission.arterialRuns || 0,
        hint: 'Tap the far Depot → <b>Supply orders</b>. Press Cement <b>+5</b> until the order reaches 35.',
        ui: "#sh-keep .keep-cell[data-g='cement'] [data-d='5']" },
    ],
  },

  // Chapter 4, Industry and Trade. Pipelines and power, research, far Depots and trucks, railways, Road Trains, trade and planet events.
  {
    id: 'pipeline', name: 'Pipe Dreams', chapter: 'Industry and Trade',
    brief: 'Refine Crude into Fuel, pipe it where it is needed, speed your factories up with a Generator and store Fuel in a Fuel Tank.',
    intro: [
      'A <b>Refinery</b> turns Crude into Fuel, one for one. A full one explodes if it is destroyed.',
      '<b>Pipes</b> carry Crude and Fuel with no Tanker at all, for 0.3 Cement a tile.',
      'A <b>Generator</b> burns Fuel so factories within 4 tiles work a third faster. <b>Turn off</b> (P) saves Fuel.',
      'A <b>Fuel Tank</b> holds 120 Crude and Fuel. Touching a Refinery, it feeds it Crude and takes in its Fuel.',
      'A Refinery stops once you have 30 Fuel, its stock limit: raise it with + on its panel.',
    ],
    mode: 'colony', seed: 6101, size: 1, rough: 1, rich: 3, biome: 'swamp', shape: 0, limit: [0, 0, 20],
    layout(m, W) { const b = m.bases[0]; placeField(m, W, b.x - 7, b.y - 7, 1.4, R_OIL, 0.95, 31); },
    setup(S) {
      kit(S, [...KIT6, 'grower'], 4); // (Green Fuel's Grove Planter: its groves keep the Smelter in Fiber)
      const L = getE(S.players[0].lander);
      preBuild(0, 'pump', L.x - 7, L.y - 7, { road: true, reach: 3 });
      L.stock.cement += 10;
    },
    goals: [
      { kind: 'built', type: 'refinery', n: 1,
        hint: '<b>Build</b> (<kbd>B</kbd>) → <b>Make</b> (<kbd>2</kbd>) → <b>Refinery</b> (<kbd>R</kbd>), by your base but not right beside it.',
        ui: "#btn-build, #build-tabs [data-g='make'], .bcard[data-t='refinery']" },
      { kind: 'crudePipe', n: 1, text: 'Pipe Crude to the Refinery', at: 'pump',
        count: (P, S) => {
          // Oil Pumps on the same pipeline as a finished Refinery.
          const net = pipeNet(), refs = new Set();
          for (const r of S.buildings) if (!r.dead && r.owner === 0 && r.built && r.type === 'refinery') for (const c of buildingPipes(r, net)) refs.add(c);
          return S.buildings.filter((b) => !b.dead && b.owner === 0 && b.type === 'pump' && buildingPipes(b, net).some((c) => refs.has(c))).length;
        },
        hint: 'Tap the Oil Pump → <b>Pipe it in</b>, or lay your own: <b>Paths</b> → <b>Pipes</b> (<kbd>K</kbd>).',
        ui: '#sh-pipe' },
      { kind: 'fuelPipe', n: 1, text: 'Pipe Fuel to a Generator', at: 'generator',
        count: (P, S) => S.buildings.filter((b) => !b.dead && b.owner === 0 && b.type === 'generator' && b.fuelByPipe).length,
        hint: '<b>Build</b> → <b>Make</b> → <b>Generator</b> (<kbd>G</kbd>) among your factories, then tap it → <b>Pipe Fuel to it</b>.',
        // (No #btn-build here: it is always on screen, so it would always be what lights up and the Generator would
        // never get its ring. The coach lights Build by itself while the Make tab and card aren't showing.)
        ui: "#build-tabs [data-g='make'], .bcard[data-t='generator'], #sh-pipefuel" },
      // An oil bloc: a Fuel Tank touching the Refinery (a feed link each way), with Fuel in it.
      { kind: 'oilBloc', n: [10, 15, 20], text: 'Store Fuel in a Fuel Tank', at: 'refinery',
        count: (P, S) => Math.max(0, ...S.buildings.filter((b) => !b.dead && b.owner === 0 && b.built && b.type === 'fueltank' && feedTargets(b).some((l) => l.c.type === 'refinery')).map((b) => b.stock.fuel || 0)),
        hint: '<b>Build</b> → <b>Gather</b> → <b>Fuel Tank</b> (<kbd>T</kbd>) touching the Refinery. Refinery stopped? Stock limit <b>+</b>.',
        ui: "#build-tabs [data-g='gather'], .bcard[data-t='fueltank'], #sh-lim-plus" },
    ],
  },
  {
    id: 'research', name: 'Breakthrough', chapter: 'Industry and Trade',
    brief: 'Build a Research Lab and research upgrades that help the whole colony.',
    intro: [
      'A <b>Research Lab</b> works on one upgrade at a time for the whole colony (Colony games only).',
      'An upgrade\'s cost leaves storage when it starts; Cancel gives it all back.',
      'Upgrades: bigger loads, longer-lasting batteries, faster paving, sharper turrets, faster motors and more.',
    ],
    mode: 'colony', seed: 1515, size: 0, rough: 1, rich: 3, biome: 'alien', shape: 0, lab: true, limit: [0, 0, 20],
    setup(S) {
      kit(S, KIT8, 4);
      const L = getE(S.players[0].lander);
      L.stock.crystal += 10;
      L.stock.chip += 4;
    },
    goals: [
      { kind: 'built', type: 'lab', n: 1,
        hint: '<b>Build</b> (<kbd>B</kbd>) → <b>Make</b> (<kbd>2</kbd>) → <b>Research Lab</b> (<kbd>L</kbd>). A Worker inside does the research.',
        ui: "#btn-build, #build-tabs [data-g='make'], .bcard[data-t='lab']" },
      { kind: 'research', tech: 'cargo', n: 1, text: 'Research Cargo Racks', at: 'lab',
        count: (P) => (P.tech && P.tech.cargo ? 1 : 0),
        hint: 'Tap the Lab → <b>Research</b> beside Cargo Racks: Haulers carry 3, trucks and trains more.',
        ui: "#sh-research button[data-k^='cargo']" },
      { kind: 'research', tech: 'cells', n: 1, text: 'Research Long-life Cells', at: 'lab',
        count: (P) => (P.tech && P.tech.cells ? 1 : 0),
        hint: 'Then <b>Research</b> Long-life Cells: batteries last longer. Short of Chips? Keep the Chip Fab busy.',
        // (Only the Lab's button: the Chips counter is always on screen, so with it here the coach lit that and never
        // rang the Lab.)
        ui: "#sh-research button[data-k^='cells']" },
      { kind: 'upgrades', n: [3, 3, 4], text: 'Finish {n} upgrades', at: 'lab',
        count: (P) => Object.keys(P.tech || {}).length,
        hint: 'Pick any you like at the Lab → <b>Research</b>. Two Labs (<kbd>L</kbd>) research twice as fast.',
        // (The Lab's Research buttons only: with Build in the list the coach always lit Build and never rang the Lab.)
        ui: '#sh-research .tech-foot button' },
    ],
  },
  {
    id: 'longhaul', name: 'Long Haul', chapter: 'Industry and Trade',
    brief: 'Rich ore lies far up a long valley. Set up a forward Depot, keep it stocked and send Freight Trucks.',
    intro: [
      'A long, narrow planet: the rich ore is a long drive up the valley.',
      'Haulers take runs under 12 tiles; <b>Freight Trucks</b> carry 8 goods on the long ones.',
      'Trucks burn Fuel and fill up at any store. A far store sends its spare goods home.',
      '<b>Supply orders</b> keep a Depot stocked from home, for building far out.',
    ],
    mode: 'colony', seed: 9401, size: 1, rough: 1, rich: 3, biome: 'autumn', shape: 1, limit: [0, 0, 30],
    layout(m, W) {
      const b = m.bases[0];
      mapTiles(m, W, b.x, b.y, 18, (t) => { if (m.res[t] === R_ORE) { m.res[t] = 0; m.amt[t] = 0; } });
      placeField(m, W, b.x, b.y - 22, 2.4, R_ORE, 0.75, 41);
    },
    setup(S) {
      kit(S, KIT8.filter((t) => t !== 'mine'), 4); // (no Ore near home: the Mine goes up the valley)
      const L = getE(S.players[0].lander);
      L.stock.cement += 10;
      L.stock.fuel += 10;
    },
    goals: [
      { kind: 'farDepot', n: 1, text: 'Build a Depot 12+ tiles out',
        count: (P, S) => { const L = getE(P.lander); return S.buildings.filter((b) => !b.dead && b.owner === 0 && b.built && b.type === 'depot' && Math.abs(b.x - L.x) + Math.abs(b.y - L.y) >= TRUCK_MIN_DIST).length; },
        hint: '<b>Paths</b> (<kbd>R</kbd>) → <b>Route to</b> (<kbd>Z</kbd>) up the valley, then <b>Build</b> → <b>Move</b> (<kbd>3</kbd>) → <b>Depot</b> (<kbd>E</kbd>) by the ore.',
        ui: "#btn-road, #banner-route, #btn-build, #build-tabs [data-g='move'], .bcard[data-t='depot']" },
      { kind: 'supplyOrder', n: 1, text: 'Set a supply order at a Depot', at: 'depot',
        count: (P, S) => S.buildings.filter((b) => !b.dead && b.owner === 0 && b.keep && !BDEFS[b.type].terminal && Object.values(b.keep).some((v) => v > 0)).length,
        hint: 'Tap the Depot → Supply orders: <b>+5</b> on Cement. Trucks keep it stocked from home.',
        ui: "#sh-keep .keep-cell[data-g='cement'] [data-d='5']" },
      { kind: 'bots', type: 'truck', n: [2, 2, 3], at: 'foundry',
        hint: 'Tap the Bot Foundry → <b>Order bots</b>: Freight Trucks <b>+1</b>. They take the runs of 12+ tiles.',
        ui: "#sh-orders .order-row[data-k='truck'] [data-d='1']" },
      { kind: 'made', good: 'ore', n: [30, 40, 60], at: 'depot',
        hint: '<b>Build</b> → <b>Gather</b> → <b>Ore Mines</b> (<kbd>R</kbd>) by the Depot. Its <b>Storage</b> (Fill first, Empty out) picks where goods go.',
        // (Not the Ore counter: always on screen, it was all that ever lit up. Now: Build → Gather → Ore Mine, and a ring
        // on the Depot for its Storage setting.)
        ui: "#build-tabs [data-g='gather'], .bcard[data-t='mine'], #sh-smode" },
    ],
  },
  {
    id: 'railway', name: 'Iron Road', chapter: 'Industry and Trade',
    brief: 'Lay track north to a far Crystal field and run a Freight Train between two stations.',
    intro: [
      '<b>Freight Trains</b> carry 56 goods a trip on their own track: no traffic jams.',
      'Put a <b>Rail Station</b> at each end and lay track between them.',
      'Buildings touching a station load and unload by conveyor; a far station stocks itself.',
      'Track bridges water, tunnels rock and Ramps low cliffs. In war, a train can be armored.',
    ],
    mode: 'colony', seed: 9601, size: 2, rough: 1, rich: 3, biome: 'lunar', shape: 0, limit: [0, 0, 30],
    layout(m, W) {
      const b = m.bases[0];
      mapTiles(m, W, b.x, b.y, 23, (t) => { if (m.res[t] === R_CRYSTAL) { m.res[t] = 0; m.amt[t] = 0; } });
      placeField(m, W, b.x - 3, b.y - 24, 2.4, R_CRYSTAL, 0.8, 51);
    },
    setup(S) {
      // (No Crystal near home: it comes by train. A Grove Planter keeps the Fiber coming: the groves here are few.)
      kit(S, KIT7.filter((t) => t !== 'tap').concat('grower'), 4);
      const L = getE(S.players[0].lander), P = S.players[0];
      P.stats.startBots = P.stats.bots;
      L.stock.cement += 20;
      L.stock.alloy += 10;
    },
    goals: [
      { kind: 'built', type: 'station', n: 1,
        hint: '<b>Build</b> (<kbd>B</kbd>) → <b>Move</b> (<kbd>3</kbd>) → <b>Rail Station</b> (<kbd>N</kbd>), on the north side of your base: the Crystal lies north.',
        ui: "#btn-build, #build-tabs [data-g='move'], .bcard[data-t='station']" },
      { kind: 'rail', n: [16, 18, 20], text: 'Lay {n} tiles of track',
        count: (P, S) => ownTiles((t) => S.rail[t]),
        hint: '<b>Paths</b> (<kbd>R</kbd>) → <b>Rail</b> (<kbd>N</kbd>) → <b>Route to</b> (<kbd>Z</kbd>): tap by the far Crystal, then <b>Build</b>.',
        ui: "#btn-road, #banner-seg [data-v='rail'], #banner-route, #banner-ok" },
      { kind: 'line', n: 1, text: 'Run a train between 2 stations', at: 'station',
        count: (P, S) => {
          // A Freight Train built, and two finished Rail Stations on the same track at least a truck run (12 tiles across
          // and down) apart: two stations side by side at home with a scrap of track between them don't make a line.
          const sts = S.buildings.filter((b) => !b.dead && b.owner === 0 && b.built && b.type === 'station');
          const far = (a, b) => Math.abs(a.x - b.x) + Math.abs(a.y - b.y) >= TRUCK_MIN_DIST;
          return (P.madeBots && P.madeBots.freight) && sts.some((a) => sts.some((b) => far(a, b) && railLinked(a, b))) ? 1 : 0;
        },
        hint: 'A <b>Rail Station</b> at the far end too (its site: <b>Lay road</b>), then a station\'s Rail yard: Freight Trains <b>+1</b>.',
        // (No #btn-build: always on screen, it would always be what lit up and no station would get its ring. The coach
        // lights Build by itself, and rings the first station, the home one, whose Rail yard builds the train.)
        ui: "#build-tabs [data-g='move'], .bcard[data-t='station'], #sh-layroad, #sh-yard .order-row[data-k='freight'] [data-d='1']" },
      { kind: 'made', good: 'crystal', n: [30, 40, 60],
        hint: 'A <b>Crystal Tap</b> (<kbd>C</kbd>) touching the far station loads the train by conveyor. More Taps, faster.',
        ui: "#btn-build, #build-tabs [data-g='gather'], .bcard[data-t='tap']" },
    ],
  },
  {
    id: 'maglev', name: 'Phase 2', chapter: 'Industry and Trade',
    brief: 'The Crystal lies far to the north, across the river. Build the Accord\'s Phase 2 transit line at last: a Maglev between two Terminals, powered at both ends, and a hub to carry it on.',
    intro: [
      'A <b>Maglev Terminal</b> is storage with a dock on its roof. A line runs straight between two, on pylons, over anything.',
      'Plan it in <b>Paths → Maglev</b>: tap a finished Terminal, then the far end. A Worker builds it out from the near end.',
      '<b>Maglev Pods</b> (ordered at a Terminal) carry 16 goods a trip at three times a Freight Train\'s speed, both ways.',
      'Each Terminal needs a <b>Generator</b> with Fuel within 4 tiles (or a Thermal Plant within 3), or the pods crawl. A pylon shot down cuts the line.',
      'The far Terminal stocks what the buildings round it need, and sends their spare goods home.',
      'A Terminal joins up to three lines: a <b>hub</b>. Pods carry goods on through it without stopping.',
      'A line can bend at a pylon: tap a spot on the way, then <b>Bend here</b>. Pods slow round sharp bends. <b>Edit bends</b> on a Terminal\'s panel moves them later (with a mouse, drag a bend\'s diamond).',
    ],
    mode: 'colony', seed: 7302, size: 2, rough: 1, rich: 3, biome: 'savanna', shape: 0, limit: [0, 0, 30],
    layout(m, W) {
      // (As Iron Road: no Crystal near home; a field of it 22 tiles north, with a river between.)
      const b = m.bases[0];
      mapTiles(m, W, b.x, b.y, 23, (t) => { if (m.res[t] === R_CRYSTAL) { m.res[t] = 0; m.amt[t] = 0; } });
      mapTiles(m, W, b.x, b.y, 40, (t, i, j) => { if (Math.abs(j - (b.y - 12)) <= 1 && Math.abs(i - b.x) <= 14 && m.terrain[t] === T_GROUND && !m.ramp[t]) { m.terrain[t] = T_WATER; m.res[t] = 0; m.amt[t] = 0; m.fert[t] = 0; m.elev[t] = 0; } });
      placeField(m, W, b.x + 2, b.y - 21, 2.6, R_CRYSTAL, 0.8, 53);
    },
    setup(S) {
      kit(S, KIT8.filter((t) => t !== 'tap'), 4);
      const L = getE(S.players[0].lander), P = S.players[0];
      P.stats.startBots = P.stats.bots;
      // (No Crystal near home, so no Chips of its own until the line runs: enough for the Terminals, the line and its pods.)
      L.stock.cement += 66; L.stock.alloy += 54; L.stock.chip += 38; L.stock.fuel += 16; // (and a second line on from a hub)
      for (let k = 0; k < 2; k++) enterBuilding(addBot(0, 'tanker', L.x, L.y), L); // (the Generators' Fuel: the far one's comes by pod)
      P.stats.startBots = P.stats.bots;
    },
    goals: [
      { kind: 'built', type: 'magterm', n: 1,
        hint: '<b>Build</b> (<kbd>B</kbd>) → <b>Move</b> (<kbd>3</kbd>) → <b>Maglev Terminal</b> (<kbd>G</kbd>), on the north side of your base, by a road.',
        ui: "#btn-build, #build-tabs [data-g='move'], .bcard[data-t='magterm']" },
      { kind: 'magLine', n: 1, text: 'Run a Maglev line across the river', at: 'magterm',
        count: () => magLines(0).length,
        hint: '<b>Paths</b> (<kbd>R</kbd>) → <b>Maglev</b> (<kbd>⇧M</kbd>): tap the Terminal, then a clear spot by the Crystal across the river; <b>Build</b>.',
        ui: "#btn-road, #banner-seg [data-v='maglev'], #banner-ok, #sh-magline" },
      { kind: 'magRun', n: 1, text: 'A pod on the line, powered both ends', at: 'magterm',
        count: () => (magLines(0).some(([a, b]) => linePods(a).length > 0 && magPowered(a) && magPowered(b)) ? 1 : 0),
        hint: 'Tap a <b>Terminal</b> → <b>Pod bay</b>: Maglev Pods <b>+1</b>; a <b>Generator</b> (<kbd>B</kbd> <kbd>2</kbd> <kbd>G</kbd>) within 4 tiles of each end.',
        ui: "#sh-yard .order-row[data-k='magpod'] [data-d='1'], #btn-build, #build-tabs [data-g='make'], .bcard[data-t='generator']" },
      { kind: 'magFreight', n: [16, 24, 32], text: 'Move {n} goods by pod', at: 'magterm',
        count: (P, S) => S.buildings.reduce((n, b) => n + (!b.dead && b.owner === 0 && b.type === 'magterm' ? b.magGot || 0 : 0), 0),
        hint: 'A <b>Crystal Tap</b> (<kbd>C</kbd>) touching the far Terminal: its site\'s goods go out by pod, its Crystal comes home.',
        ui: "#btn-build, #build-tabs [data-g='gather'], .bcard[data-t='tap']" },
      { kind: 'magHub', n: 1, text: 'Chain a second line on from a Terminal: a hub', at: 'magterm',
        count: () => (S.buildings.some((b) => !b.dead && b.owner === 0 && b.type === 'magterm' && magPartners(b).length >= 2) ? 1 : 0),
        hint: 'Tap the far Terminal → <b>Add a line from here (hub)</b>, or <b>Paths</b> (<kbd>R</kbd>) → <b>Maglev</b> (<kbd>⇧M</kbd>).',
        ui: "#sh-magline, #btn-road, #banner-seg [data-v='maglev'], #banner-ok" },
    ],
  },
  {
    id: 'driver', name: 'The Schedule', chapter: 'Industry and Trade',
    brief: 'A survey camp waits far to the north, at the end of a long road. Build a Mass Driver at home and another at the camp, pair them, and keep the camp supplied over everything, on the old schedule.',
    intro: [
      'Two <b>Mass Drivers</b> 12 to 50 tiles apart, aimed at each other, are one line: canisters of goods fly both ways, over anything.',
      'On a Driver\'s panel, <b>Aim</b>, then tap the other Driver: the two are paired. A Driver is in one line at most. Supply is automatic: the far end stocks what the buildings round it need, and what it can spare flies home.',
      'Each Driver fires only with a <b>Generator</b> (with Fuel) within 4 tiles, and every shot draws half a Fuel from it (a Thermal Plant within 3 needs none). A canister of 16 goods flies every 10 seconds from each end over land (every 8 across water or a chasm).',
      'A <b>Catcher</b> is the cheaper end: it only catches. Aim a Driver at it for supply one way; it needs no power, and nothing comes back. A <b>Goods list</b> sends just what you pick. Enemy Flak can burst a canister.',
      'No foothold out there? A Driver throws a <b>Catcher kit</b> to open ground: it assembles itself into a Catcher.',
    ],
    mode: 'colony', seed: 7321, size: 2, rough: 1, rich: 3, biome: 'savanna', shape: 0, limit: [0, 0, 30],
    setup(S) {
      kit(S, KIT8, 4);
      const L = getE(S.players[0].lander), P = S.players[0];
      // The survey camp: an Outpost about 24 tiles north, its road home the long way.
      let camp = null;
      for (let r = 0; r <= 6 && !camp; r++) for (let j = L.y - 24 - r; j <= L.y - 24 + r && !camp; j++) for (let i = L.x + 3 - r; i <= L.x + 3 + r && !camp; i++) {
        const t = inMap(i, j) ? tIdx(i, j) : -1;
        if (t >= 0 && S.terrain[t] === T_GROUND && !S.bAt[t] && !S.res[t] && !S.ramp[t] && S.zone[t] === S.zone[tIdx(L.x, L.y)]) camp = addBuilding(0, 'outpost', i, j, true);
      }
      computeTerritory();
      if (camp) { const route = roadRouteTo(0, camp) || []; for (const t of route) setRoad(t % S.W, (t / S.W) | 0, true, 0); computeTerritory(); }
      // The camp's survey samples, crated beside it: Haulers take them to the nearest storage (the camp's Mass Driver, once it stands).
      let crate = null;
      if (camp) for (let r = 2; r <= 4 && !crate; r++) for (let j = camp.y - r; j <= camp.y + r && !crate; j++) for (let i = camp.x - r; i <= camp.x + r && !crate; i++) {
        const t = inMap(i, j) ? tIdx(i, j) : -1;
        if (t >= 0 && S.terrain[t] === T_GROUND && !S.bAt[t] && !S.res[t] && !S.road[t] && !S.ramp[t] && [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([a, b]) => inMap(i + a, j + b) && S.road[tIdx(i + a, j + b)])) crate = [i, j];
      }
      if (crate) addLoot(crate[0], crate[1], { crystal: 24 }, true); // (by the road, where a Hauler can reach them)
      L.stock.cement += 120; L.stock.alloy += 30; L.stock.chip += 16; L.stock.fuel += 40; // (Cement to spare for the camp, and Fuel for both ends' Generators: what goes over the reserve flies)
      enterBuilding(addBot(0, 'tanker', L.x, L.y), L); // (the Generator's Fuel)
      P.stats.startBots = P.stats.bots;
    },
    goals: [
      { kind: 'built', type: 'mdriver', n: 1,
        hint: '<b>Build</b> (<kbd>B</kbd>) → <b>Move</b> (<kbd>3</kbd>) → <b>Mass Driver</b> (<kbd>V</kbd>) by a road at home; <kbd>R</kbd> turns it.',
        ui: "#btn-build, #build-tabs [data-g='move'], .bcard[data-t='mdriver']" },
      { kind: 'built', type: 'mdriver', n: 2, text: 'Build a second Mass Driver at the survey camp',
        hint: '<b>Build</b> → <b>Move</b> → <b>Mass Driver</b> (<kbd>V</kbd>) right by the survey camp\'s crates, far to the north.',
        ui: "#btn-build, #build-tabs [data-g='move'], .bcard[data-t='mdriver']" },
      { kind: 'mdAim', n: 1, text: 'Pair the two Mass Drivers', at: 'mdriver',
        count: (P, S) => (S.buildings.some((b) => !b.dead && b.owner === 0 && BDEFS[b.type].mdriver && mdLinks(b).some((o) => BDEFS[o.type].mdriver)) ? 1 : 0),
        hint: 'Tap the home <b>Mass Driver</b> → <b>Aim</b>, then tap the camp\'s Driver: each is aimed at the other.',
        ui: '#sh-mdaim' },
      { kind: 'mdPower', n: 1, text: 'Power both Drivers: a Generator by each', at: 'mdriver',
        count: (P, S) => (S.buildings.some((b) => !b.dead && b.owner === 0 && BDEFS[b.type].mdriver && magPowered(b) && mdLinks(b).some((o) => BDEFS[o.type].mdriver && magPowered(o))) ? 1 : 0),
        hint: 'A <b>Generator</b> (<kbd>B</kbd> <kbd>2</kbd> <kbd>G</kbd>) within 4 tiles of each Driver: half a Fuel a shot.',
        ui: "#btn-build, #build-tabs [data-g='make'], .bcard[data-t='generator']" },
      { kind: 'mdFreight', n: [16, 24, 32], text: 'Throw {n} goods out to the camp', at: 'mdriver',
        count: (P, S) => S.buildings.reduce((n, b) => n + (!b.dead && b.owner === 0 && BDEFS[b.type].mdriver && b.mdFar ? b.mdGot || 0 : 0), 0),
        hint: 'Auto ships what the camp needs. For more: home Driver → <b>Goods list</b> → <b>Cement</b>.',
        ui: "#sh-mdmode [data-v='list'], #sh-mdadd [data-g='cement']" },
      { kind: 'mdBack', n: [8, 16, 24], text: 'Throw {n} goods back home', at: 'mdriver',
        count: (P, S) => S.buildings.reduce((n, b) => n + (!b.dead && b.owner === 0 && BDEFS[b.type].mdriver && !b.mdFar ? b.mdGot || 0 : 0), 0),
        hint: 'Haulers crate the camp\'s survey Crystal into the camp\'s Driver, and its spare flies home. Keep both powered.',
        ui: '#sh-md' },
      { kind: 'built', type: 'catcher', n: 1, text: 'Build a Catcher: an end that only catches',
        hint: '<b>Build</b> → <b>Move</b> → <b>Catcher</b> (<kbd>C</kbd>): cheaper, no power, but nothing flies back from it.',
        ui: "#btn-build, #build-tabs [data-g='move'], .bcard[data-t='catcher']" },
      { kind: 'mdKit', n: 1, text: 'Throw a Catcher kit to open ground', at: 'mdriver',
        count: (P, S) => (S.buildings.some((b) => !b.dead && b.owner === 0 && BDEFS[b.type].catcher && b.claim > 0) ? 1 : 0),
        hint: 'Mass Driver → <b>Throw a Catcher kit</b>, then open ground 12 to 50 tiles off: it builds itself.',
        ui: '#sh-mdkit' },
    ],
  },
  {
    id: 'trade', name: 'Trade Winds', chapter: 'Industry and Trade',
    brief: 'Dock a Trade Terminal at a neutral Trade Post and run a trade route by Road Train, through the planet\'s storms.',
    intro: [
      'The gold pads on the minimap are neutral <b>Trade Posts</b>. A Trade Terminal there runs a standing trade route.',
      'Pick a good to send and one to bring back: a <b>Road Train</b> convoy runs it every 2 minutes.',
      'Raw goods sell cheap and made goods dearer (the market board). Posts further out pay better.',
      'A route can buy <b>Fuel</b>, at a markup: a <b>Tanker</b> takes it home.',
      '<b>Planet events</b> are on: dust storms, Ringfall, solar flares, and now and then the <i>Wren</i>, a trader ship.',
    ],
    // (Seed 1445: Ringfall (a meteor shower) from 2:30 to 3:20 and a solar flare over by 6:33, missions having the shorter
    // gap between events (MISSION_EVENT_GAP). Events are seeded, and on the designed 1415 the second one, the trader ship,
    // only left at 12:25, so a player who had made the trades by 6 minutes waited 6 more.)
    mode: 'colony', seed: 1445, size: 1, rough: 1, rich: 3, biome: 'savanna', shape: 0, events: true, limit: [0, 0, 30],
    setup(S) {
      kit(S, KIT8, 4); // (with the Grove Planter, as from Pipe Dreams on: without it the Fiber ran out 6 or 7 minutes in)
      const L = getE(S.players[0].lander);
      L.stock.stone += 40;
      L.stock.cement += 20;
      L.stock.alloy += 6;
      S.nextEvent = 150; // (the first planet event two and a half minutes in)
    },
    goals: [
      { kind: 'bots', type: 'roadtrain', n: 1, at: 'foundry',
        hint: 'Tap the Bot Foundry → <b>Order bots</b>: Road Trains <b>+1</b>. It carries 30 goods of mixed kinds.',
        ui: "#sh-orders .order-row[data-k='roadtrain'] [data-d='1']" },
      { kind: 'built', type: 'terminal', n: 1,
        hint: 'Tap a gold Trade Post → <b>Dock a Trade Terminal here</b>. Then tap its site → <b>Lay road</b> (<kbd>R</kbd>).',
        // (No #btn-build: always on screen, it would always be what lit up and the Terminal site would get no ring.)
        ui: "#sh-dock, #sh-layroad, #build-tabs [data-g='move'], .bcard[data-t='terminal']" },
      { kind: 'trades', n: [1, 2, 3], text: ['Make a trade run at the Terminal', 'Make {n} trade runs at the Terminal'], at: 'terminal',
        count: (P) => (P.trade && P.trade.sold) || 0,
        hint: 'Tap the Terminal → a <b>Send</b> good, a <b>Bring back</b> one → <b>Start route</b> (<kbd>G</kbd>). A run every 2 min.',
        ui: '#sh-tgive, #sh-tget, #sh-tgo' },
      { kind: 'events', n: 2, text: 'Ride out 2 planet events',
        count: (P, S) => (S.evN || 0) - (S.event ? 1 : 0),
        hint: 'Ringfall craters roads, flares drain batteries, dust slows robots. Waiting? Speed up: <b>1×</b> (<kbd>]</kbd>).',
        ui: '#event-card, #ev-trade, #btn-speed' },
    ],
  },

  // The Deep Core (the megastructure sheet's mission idea, Nov 2026): an old planet whose veins are nearly dug out. The
  // Core goes deeper while it has power and never runs dry, and every depth is heard below: a bigger raid the night
  // after stage 2 (Quiet, so a first taste of the Murmur, with four warbots for it).
  {
    id: 'dryground', name: 'Dry Ground', chapter: 'Industry and Trade',
    brief: 'An old landing site, its veins nearly dug out. Sink a Deep Core: it brings up Ore and Crystal that never run dry, but the ground hears it.',
    intro: [
      'The <b>Deep Core</b> (Build, Mega, <kbd>E</kbd>) needs a <b>Generator</b> with Fuel within 4 tiles: it takes a Fuel a minute.',
      'It goes deeper while it has power. Stage 1: 6 Ore a minute. After 6 minutes, stage 2: 8 Ore and 3 Crystal.',
      'Its hoppers hold 30 of each; lay a road to it and Haulers carry them off. It never runs dry.',
      'The <b>Murmur</b> live below: at night they come up to raid, and every depth the Core reaches is heard.',
      'The night after stage 2 a bigger raid comes for it. You have 4 <b>warbots</b>: stand them by it at dusk.',
    ],
    mode: 'colony', seed: 4417, size: 1, rough: 1, rich: 3, biome: 'desert', shape: 0, mega: true, war: true, murmur: 'quiet', limit: [0, 0, 40],
    setup(S) {
      kit(S, KIT8, 4);
      const P = S.players[0], L = getE(P.lander);
      // The veins are nearly gone: a dig or two left in each.
      for (let t = 0; t < S.W * S.H; t++) if (S.res[t] === R_ORE && S.amt[t] > 2) S.amt[t] = 2;
      L.stock.cement += 70; L.stock.alloy += 45; L.stock.chip += 22; L.stock.crystal += 12; L.stock.fuel += 20; // (the Core's and its Generator's)
      enterBuilding(addBot(0, 'tanker', L.x, L.y), L); // (the Generator's Fuel)
      for (let k = 0; k < 4; k++) enterBuilding(addBot(0, 'warbot', L.x, L.y), L);
      L.stock.ammo = (L.stock.ammo || 0) + 30;
      P.stats.startBots = P.stats.bots;
    },
    goals: [
      { kind: 'built', type: 'deepcore', n: 1,
        hint: '<b>Generator</b> (<kbd>B</kbd> <kbd>2</kbd> <kbd>G</kbd>), then <b>Mega</b> (<kbd>5</kbd>) → <b>Deep Core</b> (<kbd>E</kbd>) within 4 tiles.',
        ui: "#btn-build, #build-tabs [data-g='mega'], .bcard[data-t='deepcore'], .bcard[data-t='generator']" },
      { kind: 'deepStage', n: 2, text: 'Reach stage 2 of the Deep Core, the buried ringfall', at: 'deepcore',
        count: (P) => P.stats.deepStage || 0,
        hint: 'Keep its Generator fed (a Tanker brings Fuel): 6 minutes of power. Waiting? Speed up: <b>1×</b> (<kbd>]</kbd>).',
        ui: '#btn-speed' },
      { kind: 'deepCrystal', n: [12, 20, 30], text: 'Bring up {n} Crystal from the Deep Core', at: 'deepcore',
        count: (P) => P.stats.deepCrystal || 0,
        hint: 'Tap the Core → <b>Lay road</b> (<kbd>R</kbd>) to storage: Haulers empty its hoppers, so they never fill up.',
        ui: '#sh-layroad, #btn-speed' },
      { kind: 'deepHeld', n: 1, text: 'Keep the Deep Core standing through the night the Murmur come for it', at: 'deepcore',
        count: (P) => P.stats.deepHeld || 0,
        hint: 'At dusk, <b>Army</b> (<kbd>Q</kbd>) → <b>Hold ground</b> (<kbd>G</kbd>) by the Core, and a <b>Pulse Turret</b> (<kbd>B</kbd> <kbd>4</kbd> <kbd>T</kbd>).',
        ui: "#btn-attack, #ar-hold, .bcard[data-t='turret']" },
    ],
  },

  // Chapter 5, Sea and Sky. Ports and ships between islands, Viaducts and Ropeways between mesas, a Crawler and an airlift.
  {
    id: 'harbour', name: 'Harbour', chapter: 'Sea and Sky',
    brief: 'Your island is small and the sea is wide. Build a Port and ships, and found a second Port across the water.',
    intro: [
      'A bridge over the open sea costs more the further it reaches from the shore.',
      'A <b>Port</b> on the shore is storage, and its shipyard builds ships. Ships burn Fuel.',
      'A <b>Ferry</b> carries robots and trucks between your Ports, and can found a Port on an empty shore.',
      '<b>Container Ships</b> keep far Ports stocked; Tanker Ships carry Crude and Fuel.',
      'In Versus, a Ferry also lands warbots on an enemy beach. A rival well ahead lands load after load out of your guns\' reach: drive them off before the band grows.',
    ],
    mode: 'colony', seed: 9101, size: 0, rough: 1, rich: 3, biome: 'jungle', shape: 3, limit: [0, 0, 25],
    setup(S) {
      kit(S, KIT8, 4);
      const L = getE(S.players[0].lander);
      L.stock.alloy += 8; L.stock.chip += 4; L.stock.cement += 10;
    },
    goals: [
      { kind: 'built', type: 'port', n: 1,
        hint: '<b>Build</b> (<kbd>B</kbd>) → <b>Move</b> (<kbd>3</kbd>) → <b>Port</b> (<kbd>P</kbd>) on your shore. Then tap its site → <b>Lay road</b> (<kbd>R</kbd>).',
        ui: "#btn-build, #build-tabs [data-g='move'], .bcard[data-t='port'], #sh-layroad" },
      { kind: 'bots', type: 'ferry', n: 1, at: 'port',
        hint: 'Tap the Port → <b>Shipyard</b>: Ferries <b>+1</b>. Haulers bring it the Alloy and Chips.',
        ui: "#sh-yard .order-row[data-k='ferry'] [data-d='1']" },
      { kind: 'foundedPort', n: 1, text: 'Found a Port on another island', at: 'port',
        count: (P, S) => overseasPorts(P, S).length,
        hint: 'Tap the Port → <b>Found a Port on another shore</b> (<kbd>P</kbd>), then tap a beach across the sea.',
        ui: '#sh-found' },
      // (Goods a Container Ship landed at the new Port. A ship sails with 8 or more, out of what the home Port holds, so
      // that Port wants a supply order first (Alloy: the new Port lands with Cement). Ordered at the new Port first, the
      // Haulers riding the Ferry line take it. The ring goes to each step in turn.)
      { kind: 'shipped', n: 8, text: 'Ship {n} goods to the new Port',
        count: (P, S) => overseasPorts(P, S).reduce((n, b) => n + (b.shipIn || 0), 0),
        at: 'port',
        focus: (S) => {
          const P = S.players[0], far = overseasPorts(P, S)[0], kept = (b) => (b && b.keep && b.keep.alloy) || 0;
          const home = S.buildings.find((b) => !b.dead && b.owner === 0 && b.built && b.type === 'port' && b !== far);
          const more = { ui: "#sh-keep .keep-cell[data-g='alloy'] [data-d='5']" };
          if (!home) return null;
          if (!(P.madeBots && P.madeBots.cargoship) && !S.bots.some((u) => !u.dead && u.owner === 0 && u.type === 'cargoship')) return { e: home, ui: "#sh-yard .order-row[data-k='cargoship'] [data-d='1']" };
          if (kept(home) < 10 || !far || (home.stock.alloy || 0) < 8) return { e: home, ...more };
          return { e: far, ...more };
        },
        hint: 'First Port → <b>Shipyard</b>: Container Ships <b>+1</b>. <b>Supply orders</b>: Alloy <b>+5</b> twice, then at the new Port after 8 Alloy.',
        ui: "#sh-yard .order-row[data-k='cargoship'] [data-d='1'], #sh-keep .keep-cell[data-g='alloy'] [data-d='5']" },
    ],
  },
  {
    id: 'skyline', name: 'Sky Bridges', chapter: 'Sea and Sky',
    brief: 'Your mesa stands high over a canyon. Span it with a Viaduct and a Ropeway to reach the Crystal beyond.',
    intro: [
      'Your mesa has no Crystal: it lies on the mesas to the north and the west.',
      'These mesas stand far above the canyon floor: much too high for a Ramp.',
      'A <b>Viaduct</b> spans clifftop to clifftop, up to 12 tiles, paid as goods come in. Anything can cross it.',
      'A <b>Ropeway</b> crosses anything, up to 14 tiles, even down to the canyon floor. Trucks can\'t ride it.',
      'On a Rift, a road dragged over the chasm becomes a sky bridge.',
    ],
    mode: 'colony', seed: 9501, size: 1, rough: 2, rich: 3, biome: 'desert', shape: 6, limit: [0, 0, 20],
    layout(m, W) {
      // The Crystal has to come from another mesa: none on yours (any level of it).
      const b = m.bases[0];
      mapTiles(m, W, b.x, b.y, 14, (t) => { if (m.res[t] === R_CRYSTAL && m.elev[t] >= 3) { m.res[t] = 0; m.amt[t] = 0; } });
    },
    setup(S) {
      // (Two Harvesters: the desert mesa's Smelter burns more Fiber than one cuts, and the Crystal Taps need some.)
      kit(S, [...KIT8, 'harvester'], 4);
      const L = getE(S.players[0].lander);
      L.stock.cement += 30; L.stock.alloy += 10;
    },
    goals: [
      { kind: 'viaduct', n: 1, text: 'Span the canyon with a Viaduct',
        count: (P, S) => S.buildings.filter((b) => !b.dead && b.owner === 0 && b.built && b.type === 'viaduct' && b.far).length,
        hint: '<b>Paths</b> (<kbd>R</kbd>) → <b>Viaducts</b> (<kbd>Shift</kbd>+<kbd>V</kbd>): tap your mesa\'s north rim, then the clifftop across.',
        ui: "#btn-road, #banner-seg [data-v='viaduct']" },
      { kind: 'ropeway', n: 1, text: 'Run a Ropeway to another mesa',
        count: (P, S) => S.buildings.filter((b) => {
          // (Its far end is up, where bots couldn't walk to from the near end: another mesa, or the canyon floor. Not a
          // hop over a step of your own mesa, which a natural slope already joins.)
          const a = b.far && !b.dead && b.owner === 0 && b.type === 'ropeway' && getE(b.link);
          if (!a) return false;
          const N = S.W * S.H, end = tIdx(b.x, b.y), seen = new Uint8Array(N), q = [tIdx(a.x, a.y)];
          seen[q[0]] = 1;
          while (q.length) {
            const u = q.pop(), i = u % S.W;
            if (u === end) return false;
            for (const v of [i > 0 ? u - 1 : -1, i < S.W - 1 ? u + 1 : -1, u - S.W, u + S.W]) if (v >= 0 && v < N && !seen[v] && canStep(u, v)) { seen[v] = 1; q.push(v); }
          }
          return true;
        }).length,
        hint: '<b>Paths</b> (<kbd>R</kbd>) → <b>Ropeways</b> (<kbd>Shift</kbd>+<kbd>Y</kbd>): a station by your roads, then a far end on another mesa.',
        ui: "#btn-road, #banner-seg [data-v='ropeway'], #sh-layroad" },
      { kind: 'made', good: 'crystal', n: [20, 30, 40],
        hint: '<b>Build</b> (<kbd>B</kbd>) → <b>Gather</b> (<kbd>1</kbd>) → <b>Crystal Tap</b> (<kbd>C</kbd>) by the Crystal across the canyon. Then tap its site → <b>Lay road</b> (<kbd>R</kbd>).',
        ui: "#btn-build, #build-tabs [data-g='gather'], .bcard[data-t='tap'], #sh-layroad" },
    ],
  },
  {
    id: 'airlift', name: 'Airlift', chapter: 'Sea and Sky',
    brief: 'Your colony sits on a plateau ringed by cliffs. Drive a Crawler down off it, then take to the air from an Airfield.',
    intro: [
      'A <b>Crawler</b> is a base on tracks: where it stops it unfolds into a Depot, Fuel Station and Outpost.',
      'An <b>Airfield</b>\'s Cargo Plane flies over anything and drops its load by parachute.',
      'It drops a Drop Outpost on open ground nobody else holds, or two Workers on any open ground.',
      'Places no road reaches, switched to <b>Supply by air</b>, get what they are short of, 8 goods a flight.',
      'In Versus, planes also drop warbots, and Vulcan Bombers fly from the Airfield.',
    ],
    mode: 'colony', seed: 1818, size: 1, rough: 2, rich: 3, biome: 'polar', shape: 5, limit: [0, 0, 20],
    setup(S) {
      kit(S, KIT8, 4);
      const L = getE(S.players[0].lander);
      L.stock.cement += 20; L.stock.alloy += 14; L.stock.chip += 12;
    },
    goals: [
      { kind: 'crawlerOut', n: 1, text: 'Deploy a Crawler off the plateau',
        // (The ring: on the Bot Foundry to order it, then on the Crawler itself once it rolls out.)
        at: 'foundry',
        focus: (S) => {
          const crawler = S.bots.find((u) => !u.dead && u.owner === 0 && BOTS[u.type].crawler);
          return crawler ? { e: crawler, ui: '#sh-crawl, #sh-deploy' } : null;
        },
        count: (P, S) => {
          // (Deployed off the level top the Command Base stands on: down a slope, past the cliffs.)
          const L = getE(P.lander), cs = S.buildings.filter((b) => !b.dead && b.owner === 0 && b.type === 'crawlerbase');
          if (!cs.length || !L) return 0;
          const N = S.W * S.H, lv = S.elev[tIdx(L.x, L.y)], top = new Uint8Array(N), q = [tIdx(L.x, L.y)];
          top[q[0]] = 1;
          while (q.length) {
            const a = q.pop(), i = a % S.W;
            for (const b of [i > 0 ? a - 1 : -1, i < S.W - 1 ? a + 1 : -1, a - S.W, a + S.W]) if (b >= 0 && b < N && !top[b] && S.elev[b] === lv && !S.ramp[b]) { top[b] = 1; q.push(b); }
          }
          return cs.filter((b) => !top[tIdx(b.x, b.y)]).length;
        },
        hint: 'Bot Foundry → <b>Order bots</b>: Crawlers <b>+1</b>. Crawler → <b>Drive somewhere</b> (<kbd>G</kbd>) off the plateau, then <b>Deploy here</b> (<kbd>E</kbd>).',
        ui: "#sh-orders .order-row[data-k='crawler'] [data-d='1'], #sh-crawl, #sh-deploy" },
      { kind: 'built', type: 'airfield', n: 1,
        hint: '<b>Build</b> (<kbd>B</kbd>) → <b>Move</b> (<kbd>3</kbd>) → <b>Airfield</b> (<kbd>I</kbd>), with 5 flat tiles for its runway. Then tap its site → <b>Lay road</b> (<kbd>R</kbd>).',
        ui: "#btn-build, #build-tabs [data-g='move'], .bcard[data-t='airfield'], #sh-layroad" },
      { kind: 'built', type: 'dropost', n: 1, text: 'Drop an Outpost by parachute', at: 'airfield',
        hint: 'Tap the Airfield → <b>Hangar</b>: Cargo Planes <b>+1</b>. Then <b>Drop Outpost</b>, and tap open ground.',
        ui: "#sh-yard .order-row[data-k='cargoplane'] [data-d='1'], #sh-air [data-k='outpost']" },
      { kind: 'airSupplied', n: 1, text: 'Supply a building by air', at: 'crawlerbase',
        // (Once its crates have landed, `airIn`: a plane loads up for it, `airAt`, about a minute before. Only a place
        // switched to Supply by air gets crates, so a road reaching it afterwards, which switches that off, doesn't undo
        // this. A site in the Drop Outpost's land, supplied by air, counts too.)
        count: (P, S) => S.buildings.filter((b) => !b.dead && b.owner === 0 && b.type !== 'dropost' && b.airIn !== undefined).length,
        // (Off the plateau no road reaches the Crawler unless you lay one, so its supply orders come by plane only, once
        // one is based. With a road from home to it On does nothing, as Haulers supply it, and its panel says so: pack it
        // up and drive it on past the roads, hence "out past your roads".)
        hint: 'Tap deployed Crawler beyond roads → <b>Supply by air</b>: <b>On</b>. <b>Supply orders</b>: Cement <b>+5</b> for an air drop.',
        ui: "#sh-airsup [data-v='1'], #sh-keep .keep-cell[data-g='cement'] [data-d='5']" },
    ],
  },

  {
    id: 'mooring', name: 'Mooring Lines', chapter: 'Sea and Sky',
    brief: 'Your mesa has no Crystal, and a Drop Outpost holds the mesa across the canyon. Join them with an Airship line.',
    intro: [
      'A <b>Mooring Mast</b> is a one-tile store with a loading bay. Link two and an Airship line runs between them.',
      'An <b>Airship</b>, built in an Airfield\'s hangar, flies its line over anything, both ways, 24 goods a trip.',
      'The far Mast stocks what the buildings round it need, and sends their spare goods home on the way back.',
      'Workers and Warbots ride it too. It burns Fuel and fills up at either Mast: Tankers or a pipe bring it.',
      'It is unarmed: in Versus, keep its line clear of enemy Flak Guns.',
    ],
    mode: 'colony', seed: 4141, size: 1, rough: 2, rich: 3, biome: 'autumn', shape: 6, limit: [0, 0, 25],
    layout(m, W) {
      // (As Sky Bridges: the Crystal has to come from another mesa.)
      const b = m.bases[0];
      mapTiles(m, W, b.x, b.y, 14, (t) => { if (m.res[t] === R_CRYSTAL && m.elev[t] >= 3) { m.res[t] = 0; m.amt[t] = 0; } });
    },
    setup(S) {
      kit(S, KIT8, 4);
      const L = getE(S.players[0].lander);
      L.stock.cement += 24; L.stock.alloy += 10; L.stock.chip += 4; L.stock.fuel += 10;
      // Airlift's Airfield, built, its hangar stocked for an Airship; a Drop Outpost on the nearest mesa with Crystal (as a
      // Cargo Plane drops one), with two Workers and the goods for a Mast.
      preBuild(0, 'airfield', L.x, L.y, { road: true, stock: { alloy: 9, chip: 9, fuel: 12 } });
      mooringFoothold(S, L);
    },
    goals: [
      { kind: 'built', type: 'mast', n: 2, text: 'Raise two Mooring Masts',
        hint: '<b>Build</b> (<kbd>B</kbd>) → <b>Move</b> (<kbd>3</kbd>) → <b>Mooring Mast</b> (<kbd>T</kbd>): one at home, one by the outpost.',
        ui: "#btn-build, #build-tabs [data-g='move'], .bcard[data-t='mast'], #sh-layroad" },
      { kind: 'mastLine', n: 1, text: 'Link them into an Airship line', at: 'mast',
        count: () => mastLines(0).length,
        hint: 'Tap a Mooring Mast → <b>Link to another Mast</b> (<kbd>L</kbd>), then tap the other Mast.',
        ui: '#sh-mlink' },
      { kind: 'bots', type: 'airship', n: 1, at: 'airfield',
        hint: 'Tap the Airfield → <b>Hangar</b>: Airships <b>+1</b>. With one line, it flies to it by itself.',
        ui: "#sh-yard .order-row[data-k='airship'] [data-d='1']" },
      { kind: 'airFreight', n: [16, 24, 40], text: 'Fly {n} goods along the line', at: 'mast',
        count: (P, S) => S.buildings.reduce((n, b) => n + (!b.dead && b.owner === 0 && b.type === 'mast' ? b.shipGot || 0 : 0), 0),
        hint: 'Build a <b>Crystal Tap</b> by the far Mast: its site\'s goods fly out, its Crystal flies home.',
        ui: "#btn-build, #build-tabs [data-g='gather'], .bcard[data-t='tap']" },
    ],
  },

  {
    id: 'earthworks', name: 'Cut and Fill', chapter: 'Sea and Sky',
    brief: 'The ground the Pathfinder surveyed has moved in thirty-one years. Order a Grader, level the land and fill the shallows out to the island.',
    intro: [
      '<b>Build → Terraform</b> (<kbd>6</kbd>) plans earthworks: Raise, Lower, Flatten, Fill shallows and Dig channel.',
      'A <b>Grader</b>, ordered at the Bot Foundry, does the work, slowly; Workers never touch it.',
      'Dug earth comes out as Stone crates for the Haulers. Raised and filled ground takes Stone.',
      'Fill shallows turns water beside land into land, up to 6 tiles out from the shore: drag out from the shore for a land bridge.',
      'Dig channel does the reverse: a moat before your walls, or a canal so ships sail inland.',
      'Planned tiles show a dashed outline and the job\'s mark; an orange dash and a Stone pip mean it waits for Stone, a grey bar fills as the Grader works.',
    ],
    mode: 'colony', seed: 23, size: 1, rough: 2, rich: 3, biome: 'desert', shape: 11, limit: [0, 0, 25],
    setup(S) {
      kit(S, KIT6, 4);
      const L = getE(S.players[0].lander);
      L.stock.stone += 60; L.stock.alloy += 6; L.stock.chip += 6; L.stock.fuel += 10;
    },
    goals: [
      { kind: 'bots', type: 'grader', n: 1, at: 'foundry',
        hint: 'Tap the Bot Foundry → <b>Order bots</b>: Graders <b>+1</b>. It takes a while: a Grader is heavy.',
        ui: "#sh-orders .order-row[data-k='grader'] [data-d='1']" },
      { kind: 'levelled', n: [3, 4, 6], text: 'Level {n} tiles of ground',
        count: (P) => (P.stats.tfup || 0) + (P.stats.tfdown || 0),
        hint: '<b>Build</b> → <b>Terraform</b> (<kbd>6</kbd>) → <b>Flatten</b> (<kbd>F</kbd>): drag over uneven ground, then <b>Terraform</b>.',
        ui: "#btn-build, #build-tabs [data-g='terra'], .bcard[data-tf='flatten'], #tf-seg [data-tf='flatten'], #banner-ok" },
      { kind: 'filled', n: [3, 4, 6], text: 'Fill {n} tiles of shallows',
        count: (P) => P.stats.tffill || 0,
        hint: '<b>Terraform</b> → <b>Fill shallows</b> (<kbd>H</kbd>): drag out from the shore, then <b>Terraform</b>.',
        ui: "#btn-build, #build-tabs [data-g='terra'], .bcard[data-tf='fill'], #tf-seg [data-tf='fill'], #banner-ok" },
      { kind: 'dug', n: 2, text: 'Dig {n} tiles of channel',
        count: (P) => P.stats.tfdig || 0,
        hint: '<b>Terraform</b> → <b>Dig channel</b> (<kbd>C</kbd>): drag in from the water\'s edge, then <b>Terraform</b>.',
        ui: "#btn-build, #build-tabs [data-g='terra'], .bcard[data-tf='dig'], #tf-seg [data-tf='dig'], #banner-ok" },
    ],
  },

  // Terraforming, stage 2: soil, groves and water (SOIL, GROVE, IRR, SHIFT), after the Grader's earthworks.
  {
    id: 'greening', name: 'Topsoil', chapter: 'Sea and Sky',
    brief: 'The Pathfinder sowed this shore from its seed vaults; the Rust took it back. Make soil, plant a grove and water a field on the dry ground.',
    intro: [
      '<b>Build → Terraform</b> (<kbd>6</kbd>) also holds three buildings that work the land slowly, over the long game.',
      'A <b>Composter</b> (<kbd>M</kbd>) turns a Fiber and a Stone a batch into humus: the ground in its ring goes from barren to improving to rich. Rich soil is farmland, and crops on it grow faster and give twice the Fuel.',
      'A <b>Tree Nursery</b> (<kbd>N</kbd>) has an Agribot plant groves, leaving lanes. They grow from saplings to young trees to a mature grove that bears Fiber, and enemy robots crawl through them.',
      'A <b>Water Pump</b> (<kbd>P</kbd>) goes beside water. Its water runs along the pipe joined to it and along canals a Grader digs; wet ground turns green, and Bio Farms plant on it, desert or not.',
      'Soil, water and groves together slowly shift the land itself: the Rust to the Long Grass, then to Greenreach.',
      'The Grader has two new jobs: <b>Spread soil</b> (<kbd>O</kbd>) and <b>Reclaim</b> (<kbd>E</kbd>), which clears craters and burned ground: rich soil napalm or a Torch burned is farmland again.',
    ],
    mode: 'colony', seed: 31, size: 1, rough: 1, rich: 3, biome: 'desert', shape: 11, limit: [0, 0, 30],
    setup(S) {
      kit(S, KIT7, 4);
      const L = getE(S.players[0].lander);
      L.stock.fiber += 40; L.stock.stone += 40; L.stock.cement += 20; L.stock.alloy += 8; L.stock.chip += 4; L.stock.fuel += 10;
      enterBuilding(addBot(0, 'agribot', L.x, L.y), L); // (one for the Tree Nursery: the colony's own works its Bio Farm)
      S.players[0].stats.startBots = S.players[0].stats.bots;
    },
    goals: [
      { kind: 'built', type: 'composter', n: 1,
        hint: '<b>Build</b> (<kbd>B</kbd>) → <b>Terraform</b> (<kbd>6</kbd>) → <b>Composter</b> (<kbd>M</kbd>), beside open ground.',
        ui: "#btn-build, #build-tabs [data-g='terra'], .bcard[data-t='composter']" },
      { kind: 'richSoil', n: [4, 6, 9], text: 'Enrich {n} tiles to rich soil', at: 'composter',
        count: (P, S) => { let n = 0; if (S.soil) for (let t = 0; t < S.soil.length; t++) if (S.soil[t] >= SOIL.rich && S.owner[t] === 0) n++; return n; },
        hint: 'Haulers feed the Composter a Fiber and a Stone a batch: tap it to watch its ring turn rich.',
        ui: "#btn-build, #build-tabs [data-g='terra'], .bcard[data-t='composter']" },
      { kind: 'groves', n: [2, 3, 4], text: 'Grow {n} groves to young trees', at: 'nursery',
        count: (P, S) => { let n = 0; if (S.grove) for (let t = 0; t < S.grove.length; t++) if (S.grove[t] >= GROVE.young && S.grvO[t] === 1) n++; return n; },
        hint: '<b>Terraform</b> (<kbd>6</kbd>) → <b>Tree Nursery</b> (<kbd>N</kbd>): its Agribot plants groves round it.',
        ui: "#btn-build, #build-tabs [data-g='terra'], .bcard[data-t='nursery']" },
      { kind: 'wetCrops', n: [2, 3, 4], text: 'Grow {n} crops on watered dry ground', at: 'wpump',
        count: (P, S) => { let n = 0; if (S.wet) for (let t = 0; t < S.wet.length; t++) if (S.wet[t] && S.res[t] === R_CROP && !S.fert[t] && S.owner[t] === 0) n++; return n; },
        hint: '<b>Water Pump</b> (<kbd>P</kbd>) by the lake, pipe out from it (Paths → Pipe), a Bio Farm by the wet ground.',
        ui: "#btn-build, #build-tabs [data-g='terra'], .bcard[data-t='wpump'], .bcard[data-t='farm']" },
    ],
  },

  // Terraforming, stage 3: resources from the ground (SEAM, SEED, THERMAL), on the Cinderlands, where the lakes are lava.
  {
    id: 'deepground', name: 'Deep Ground', chapter: 'Sea and Sky',
    brief: 'The survey filed the readings under these lava lakes as instrument error. Drill for the seams below, grow Crystal of your own, and run a turbine on the heat.',
    intro: [
      'The last three buildings on <b>Build → Terraform</b> (<kbd>6</kbd>) take resources from the ground itself. All three are slow: they add to your Mines and Taps, never replace them.',
      'A <b>Seam Drill</b> (<kbd>I</kbd>) surveys for hidden Ore and Crystal seams the moment it stands, further while it has power, and drills the nearest one: glowing cracks inside a dashed outline, its marker\'s pips counting down.',
      'A <b>Seed Mast</b> (<kbd>G</kbd>) prepares a ring of beds, seeds each with a Crystal, and charges them to grow. Ripe Crystal is gathered by a <b>Crystal Tap</b>: build one beside the Mast. Anyone\'s Tap nearby can gather it too, so defend your beds. Without power the beds starve.',
      'Both need power: a <b>Generator</b> with Fuel within 4 tiles, or a <b>Thermal Plant</b> (<kbd>T</kbd>), which burns no Fuel but only stands right beside lava or hot water. It powers a Maglev Terminal or a Mass Driver too, never a megastructure.',
    ],
    mode: 'colony', seed: 71, size: 1, rough: 1, rich: 3, biome: 'volcanic', shape: 11, limit: [0, 0, 30],
    setup(S) {
      kit(S, KIT7, 4);
      const L = getE(S.players[0].lander);
      L.stock.cement += 40; L.stock.alloy += 20; L.stock.chip += 8; L.stock.crystal += 16; L.stock.fuel += 16; L.stock.fiber += 20;
      preBuild(0, 'generator', L.x + 4, L.y + 2, { road: true, stock: { fuel: BDEFS.generator.fuelCap } });
      computeTerritory();
    },
    goals: [
      { kind: 'built', type: 'seamdrill', n: 1,
        hint: '<b>Build</b> (<kbd>B</kbd>) → <b>Terraform</b> (<kbd>6</kbd>) → <b>Seam Drill</b> (<kbd>I</kbd>), near the Generator.',
        ui: "#btn-build, #build-tabs [data-g='terra'], .bcard[data-t='seamdrill']" },
      { kind: 'seams', n: [1, 1, 2], text: 'Find a hidden seam and drill {n} from it', at: 'seamdrill',
        count: (P) => ((P.stats.seams || 0) ? (P.stats.seamOre || 0) + (P.stats.seamCrystal || 0) : 0),
        hint: 'Keep the Generator fuelled: with power the Seam Drill surveys further and drills the seam it finds.',
        ui: "#btn-build, #build-tabs [data-g='terra'], .bcard[data-t='seamdrill']" },
      { kind: 'bedRipe', n: [2, 3, 4], text: 'Grow {n} beds of Crystal', at: 'seedmast',
        count: (P) => P.stats.bedRipe || 0,
        hint: '<b>Terraform</b> → <b>Seed Mast</b> (<kbd>G</kbd>) by the Generator, a <b>Crystal Tap</b> beside it.',
        ui: "#btn-build, #build-tabs [data-g='terra'], .bcard[data-t='seedmast'], #build-tabs [data-g='gather'], .bcard[data-t='tap']" },
      { kind: 'thermal', n: 1, text: 'Power a building with a Thermal Plant', at: 'thermal',
        count: (P, S) => S.buildings.filter((b) => !b.dead && b.owner === 0 && b.type === 'thermal' && b.working).length,
        hint: '<b>Terraform</b> → <b>Thermal Plant</b> (<kbd>T</kbd>) beside a lava lake, a factory within 3 tiles.',
        ui: "#btn-build, #build-tabs [data-g='terra'], .bcard[data-t='thermal']" },
    ],
  },

  // Terraforming, stage 5: the big projects and greening (RSV, LVL, GREEN): a dry basin to fill and a mesa to cut by the base.
  {
    id: 'madeready', name: 'Made Ready', chapter: 'Sea and Sky',
    brief: 'Reservoir, settlement plan phase 3: a town of forty thousand needs water, and a mesa stands where the town was drawn. Fill the basin, cut the mesa, and make the land ready.',
    intro: [
      'The last two projects are megastructures, on <b>Build → Mega</b> (<kbd>5</kbd>): one of each per colony, built slowly, in stages.',
      'A <b>Reservoir</b> (<kbd>V</kbd>) stands on the rim of a dry basin. Its Dew Towers draw water out of the air, and over 8 minutes of power the basin fills: puddling, half, full. Its banks turn wet and grow rich; a Port goes on the new shore.',
      'A <b>Leveller</b> (<kbd>G</kbd>) cuts a hill down to its own level, a level off a tile every 6 seconds, every step one a Ramp can climb, and fills its STONE hopper for the Haulers. Or it raises a <b>ridge</b> along a line you drag, for Stone from storage: a wall of earth your enemies must go round.',
      'Both burn a Generator\'s Fuel: the Reservoir needs two in reach, the Leveller one.',
      'The ring in the top bar is <b>land made ready</b>: soil, groves, water, shifted and graded ground. <kbd>Shift</kbd>+<kbd>G</kbd> opens the Greening panel; in free play, green 60% and you win.',
    ],
    mode: 'colony', seed: 37, size: 1, rough: 0, rich: 3, biome: 'desert', shape: 0, mega: true, limit: [0, 0, 40],
    setup(S) {
      kit(S, KIT7, 4);
      const L = getE(S.players[0].lander);
      L.stock.cement += 140; L.stock.alloy += 90; L.stock.chip += 34; L.stock.crystal += 20; L.stock.fuel += 30; L.stock.fiber += 30; L.stock.stone += 30;
      madeReadyLand(S, L);
      for (const [dx, dy] of [[2, -3], [3, -8], [-1, -4]]) preBuild(0, 'generator', L.x + dx, L.y + dy, { road: true, stock: { fuel: BDEFS.generator.fuelCap } });
      enterBuilding(addBot(0, 'tanker', L.x, L.y), L); // (the Generators' Fuel)
      computeTerritory();
    },
    goals: [
      { kind: 'built', type: 'reservoir', n: 1,
        hint: '<b>Build</b> (<kbd>B</kbd>) → <b>Mega</b> (<kbd>5</kbd>) → <b>Reservoir</b> (<kbd>V</kbd>) on the ridge by the dry basin.',
        ui: "#btn-build, #build-tabs [data-g='mega'], .bcard[data-t='reservoir']" },
      { kind: 'lake', n: 3, text: 'Fill the basin: puddling, half, full', at: 'reservoir',
        count: (P, S) => Math.max(0, ...S.buildings.filter((b) => !b.dead && b.owner === 0 && b.rv).map((b) => b.rv.st)),
        hint: 'Keep 2 Generators with Fuel by the Reservoir: tap it to watch the basin\'s three lamps.',
        ui: "#btn-build, #build-tabs [data-g='mega'], .bcard[data-t='reservoir']" },
      { kind: 'cut', n: [8, 12, 16], text: 'Cut {n} levels off the mesa', at: 'leveller',
        count: (P) => P.stats.levelled || 0,
        hint: '<b>Mega</b> → <b>Leveller</b> (<kbd>G</kbd>) by the mesa; tap it → <b>Level a hill</b> (<kbd>F</kbd>), tap the mesa.',
        ui: "#btn-build, #build-tabs [data-g='mega'], .bcard[data-t='leveller'], #sh-level" },
      { kind: 'ridge', n: [4, 6, 8], text: 'Raise {n} levels of ridge', at: 'leveller',
        count: (P) => P.stats.ridged || 0,
        hint: 'Tap the Leveller → <b>Raise a ridge</b> (<kbd>H</kbd>), drag a line in its reach, <b>Raise it</b>. Stone: from storage.',
        ui: "#sh-ridge, #banner-ok" },
      { kind: 'ready', n: [8, 10, 12], text: 'Make {n}% of the land ready', at: 'composter',
        count: () => Math.floor(greenShare(0) * 100),
        hint: 'Composters, Nurseries (<b>Terraform</b>, <kbd>6</kbd>), the banks, cut ground: the ring, <kbd>Shift</kbd>+<kbd>G</kbd>.',
        ui: "#clock .gm-chip, #btn-build, #build-tabs [data-g='terra'], .bcard[data-t='composter']" },
    ],
  },

  // Chapter 6, Into the Void (space expansion, phase 1): one mission out on the Orbital platforms. The Launch Pad, a Shuttle run to a
  // deck no bridge reaches, a Dropship landing past a raised drawbridge, and a derelict module taken (voidFoothold).
  {
    id: 'spacefall', name: 'Into the Void', chapter: 'Into the Void',
    brief: 'The station\'s west deck is cut off: both its drawbridges stuck up, years ago. Fly to it, and take the derelict Solar Array adrift beside it.',
    intro: [
      'Out in space nothing flies on wings. A <b>Launch Pad</b> (2 by 2) builds spacecraft and is their home: they lift straight off, fly straight over the void and land on any flat, free ground.',
      'A <b>Shuttle</b> is the space Cargo Plane: it keeps the places you switch to <b>Supply by air</b> stocked, landing beside them, and it can tow a drifting asteroid home.',
      'A <b>Dropship</b> lands up to six robots anywhere flat and free: across a raised drawbridge, or onto a rock no bridge reaches. They walk out down its ramp, and Workers landed there can build there.',
      'Derelict Accord modules drift off the decks. Like an Uplink, one is yours while your land reaches out over it: a <b>Solar Array</b> powers what stands near it.',
      'Your craft burn Fuel and fill up on their pad: Tankers bring the pad its Fuel.',
    ],
    mode: 'colony', seed: 7701, size: 1, rough: 1, rich: 3, biome: 'lunar', shape: 30, limit: [0, 0, 30],
    setup(S) {
      kit(S, KIT6, 4);
      const L = getE(S.players[0].lander);
      L.stock.cement += 30; L.stock.alloy += 24; L.stock.chip += 20; L.stock.fuel += 20; L.stock.fiber += 10;
      enterBuilding(addBot(0, 'tanker', L.x, L.y), L); // (the pad's Fuel)
      voidFoothold(S, L);
    },
    goals: [
      { kind: 'built', type: 'launchpad', n: 1,
        hint: '<b>Build</b> (<kbd>B</kbd>) → <b>Move</b> (<kbd>3</kbd>) → <b>Launch Pad</b> (<kbd>L</kbd>) on 2 by 2 flat tiles. Then tap its site → <b>Lay road</b> (<kbd>R</kbd>).',
        ui: "#btn-build, #build-tabs [data-g='move'], .bcard[data-t='launchpad'], #sh-layroad" },
      { kind: 'shuttleRun', n: 1, text: 'Fly supplies to the cut-off Drop Outpost', at: 'launchpad',
        // (A Shuttle's load handed over, as a Cargo Plane's crates landing: airIn. The far Outpost's Supply by air is on.)
        count: (P, S) => S.buildings.filter((b) => !b.dead && b.owner === 0 && b.airIn !== undefined).length,
        hint: '<b>Launch Pad</b> → <b>Yard</b>: Shuttles <b>+1</b>. It flies the Drop Outpost its orders (<b>Supply by air</b>: <b>On</b>).',
        ui: "#sh-yard .order-row[data-k='shuttle'] [data-d='1'], #sh-airsup [data-v='1']" },
      { kind: 'squad', n: [2, 3, 4], text: ['Land a Worker on the cut-off deck', 'Land {n} Workers on the cut-off deck'], at: 'launchpad',
        count: (P, S) => { const z = S.zone[S.mission.farT]; return S.bots.filter((u) => !u.dead && u.owner === 0 && !u.inside && !BOTS[u.type].craft && u.type === 'worker' && S.zone[tIdx(Math.floor(u.x), Math.floor(u.y))] === z).length; },
        focus: (S) => { const d = S.bots.find((u) => !u.dead && u.owner === 0 && u.type === 'dropship'); return d ? { e: d, ui: '#sh-sp-sq-k' } : null; },
        hint: '<b>Launch Pad</b> → <b>Yard</b>: Dropships <b>+1</b>. Dropship → <b>Land 6 Workers</b>, then tap past the raised bridge twice.',
        ui: "#sh-yard .order-row[data-k='dropship'] [data-d='1'], #sh-sp-sq-k, #banner-ok" },
      { kind: 'derelict', n: 1, text: 'Take the derelict Solar Array',
        count: (P, S) => (S.space ? S.space.mods.filter((m) => modHolder(m) === 0).length : 0),
        hint: '<b>Build</b> (<kbd>B</kbd>) → <b>Defend</b> (<kbd>4</kbd>) → <b>Outpost</b> (<kbd>O</kbd>) on the cut-off deck by the Solar Array: its land covers it.',
        ui: "#btn-build, #build-tabs [data-g='defend'], .bcard[data-t='outpost']" },
    ],
  },

  // Chapter 6, Into the Void (space expansion, phase 2): The Graveyard, a wreck field of dead Accord ships. Salvage towed in by
  // Shuttle, a Drop Outpost landed by Shuttle on the Arbiter's hulk, the Arbiter taken and its salvage sent home.
  {
    id: 'graveyard', name: 'The Graveyard', chapter: 'Into the Void',
    brief: 'Your colony landed on the hulk of a dead Accord ship. Past your starter fields there is little Ore or Crystal: live off the salvage, and take the Arbiter.',
    intro: [
      'The Graveyard is a wreck field from the first fights after the Accord fell. Your Launch Pad stands ready.',
      'Wreckage drifts through the void. A <b>Shuttle</b> tows it to its pad, where it is broken down for <b>Alloy and Chips</b>.',
      'A Shuttle can also land a <b>Drop Outpost</b> on a hulk no bridge reaches: it unfolds and claims the land round it.',
      'The <b>Arbiter</b>, the relay ship in the middle, is yours while your land covers its relay. Held, it sends you salvage.',
      'Debris lanes drift through the void too: craft that fly through them are clipped. Fly round, or take the hits.',
    ],
    mode: 'colony', seed: 7711, size: 1, rough: 1, rich: 3, biome: 'lunar', shape: SHAPE_PRESETS.findIndex((s) => s.graveyard), limit: [0, 0, 30],
    setup(S) {
      const out = kit(S, [...KIT6, 'launchpad'], 4);
      const L = getE(S.players[0].lander);
      L.stock.cement += 20; L.stock.alloy += 12; L.stock.chip += 8; L.stock.fuel += 20;
      if (out.launchpad) out.launchpad.stock.fuel = 8;
      enterBuilding(addBot(0, 'tanker', L.x, L.y), L); // (the pad's Fuel)
      spaceSetup(S.seed); // (the salvage, the debris lanes and the derelicts: a Versus game's, laid out here)
    },
    goals: [
      { kind: 'salvage', n: [2, 3, 4], text: ['Tow a salvage wreck home', 'Tow {n} salvage wrecks home'], at: 'launchpad',
        count: (P) => P.stats.towed || 0,
        focus: (S) => { const u = S.bots.find((v) => !v.dead && v.owner === 0 && v.type === 'shuttle'); return u ? { e: u, ui: '#sh-sp-tow' } : null; },
        hint: '<b>Launch Pad</b> → <b>Yard</b>: Shuttles <b>+1</b>. Shuttle → <b>Tow salvage</b>, then tap a drifting wreck.',
        ui: "#sh-yard .order-row[data-k='shuttle'] [data-d='1'], #sh-sp-tow" },
      { kind: 'shuttlePost', n: 1, text: 'Land a Drop Outpost on the Arbiter\'s hulk', at: 'launchpad',
        count: (P, S) => S.buildings.filter((b) => !b.dead && b.owner === 0 && b.type === 'dropost' && S.grave && graveHulkKind(b.x, b.y) === 'arb').length,
        focus: (S) => { const u = S.bots.find((v) => !v.dead && v.owner === 0 && v.type === 'shuttle'); return u ? { e: u, ui: '#sh-sp-post' } : null; },
        hint: 'Shuttle → <b>Land a Drop Outpost</b>, then tap the Arbiter\'s deck by its relay twice (or <b>Land</b>).',
        ui: '#sh-sp-post, #banner-ok' },
      { kind: 'arbiter', n: 1, text: 'Take the Arbiter', hold: true,
        count: () => (arbHolder() === 0 ? 1 : 0),
        hint: 'Your land must cover its relay: an Outpost by it (<b>Build</b> <kbd>B</kbd> → <b>Defend</b> <kbd>4</kbd> → <b>Outpost</b>).',
        ui: "#btn-build, #build-tabs [data-g='defend'], .bcard[data-t='outpost']" },
      { kind: 'arbHauls', n: [1, 2, 3], text: ['Receive the Arbiter\'s salvage', 'Receive the Arbiter\'s salvage {n} times'],
        count: (P) => P.stats.arbHauls || 0,
        hint: 'Hold it: every 30 s it sends Alloy and Chips home. The Arbiter is the diamond on the minimap.',
        ui: '#minimap' },
    ],
  },

  // Chapter 7, First Contact. The Murmur's nests (type 'nest'), a rival to practise on, a border war and a chokepoint to hold.
  {
    id: 'bughunt', name: 'The Murmur', chapter: 'First Contact', // (id kept: saved progress goes by it)
    brief: 'The Murmur breed in nests under the swamp, and by night they come up to raid your colony. Arm up, hold the night and clear the nests.',
    intro: [
      'The <b>Murmur</b> keep to their nests by day. At nightfall, 8 minutes in, their packs come up to raid.',
      'They tunnel toward your power and come up through <b>tunnel exits</b>: collapse those with warbots.',
      'You have 4 <b>warbots</b> and 30 Ammo; an Ammo Plant (Make, <kbd>I</kbd>) makes more. Turrets fire Crystal.',
      'Defend also has Minigun Nests (<kbd>G</kbd>), which spray Ammo. Tap a dented building → <b>Repair</b> (<kbd>E</kbd>).',
      'Workers and Haulers keep clear of danger by themselves. <kbd>J</kbd> jumps to the latest alert (again: the one before).',
      'Where the Murmur haunt a road, Haulers wait longer each time they turn back; the building says <b>Haulers turning back</b>: send warbots to clear it.',
    ],
    // (Quiet: their nights teach the tunnels and exits without swamping a first fight with them. The packs come only at
    // night, as in every game: the day is for a turret, warbots and the exit already open; the first night brings a
    // pack and new exits to collapse, and the nests can be struck by day or night.)
    mode: 'colony', seed: 6107, size: 1, rough: 1, rich: 3, biome: 'swamp', war: true, wildlife: true, murmur: 'quiet', limit: [0, 0, 20],
    setup(S) {
      kit(S, KIT8, 4);
      const P = S.players[0], L = getE(P.lander);
      // Colony games start with no warbots: four, waiting in the Command Base.
      for (let k = 0; k < 4; k++) enterBuilding(addBot(0, 'warbot', L.x, L.y), L);
      P.stats.startBots = P.stats.bots;
      L.stock.ammo = 30; L.stock.crystal += 6; L.stock.alloy += 6; L.stock.chip += 4;
      // The tunnels dug the night before: the nest nearest the colony has dug toward it, and an exit is open out there
      // (night falls at 8 minutes: collapse it before then).
      const near = S.buildings.filter((b) => b.type === 'nest').sort((a, b) => dist2(a.x, a.y, L.x, L.y) - dist2(b.x, b.y, L.x, L.y))[0];
      if (near) murmurPredig(near, 22, true);
    },
    goals: [
      { kind: 'built', type: 'turret', n: [1, 1, 2],
        hint: '<b>Build</b> (<kbd>B</kbd>) → <b>Defend</b> (<kbd>4</kbd>) → <b>Pulse Turret</b> (<kbd>T</kbd>) by the colony, before nightfall. Then <b>Lay road</b> (<kbd>R</kbd>).',
        ui: "#btn-build, #build-tabs [data-g='defend'], .bcard[data-t='turret'], #sh-layroad" },
      { kind: 'bots', type: 'warbot', n: [2, 3, 4], at: 'foundry',
        hint: 'Tap the Bot Foundry → <b>Order bots</b>: Warbots <b>+1</b>. They wait in the Command Base and reload there.',
        ui: "#sh-orders .order-row[data-k='warbot'] [data-d='1']" },
      // The tunnels of the Murmur: an exit (a violet ring on the minimap) opened along them overnight, and more open at
      // nightfall (so the goal sees the player through the first night). Collapsed, one stays shut.
      { kind: 'exits', n: 2, text: 'Collapse {n} tunnel exits', count: (P) => P.stats.collapsed || 0,
        hint: '<b>Army</b> (<kbd>Q</kbd>) → <b>Attack</b>, then tap a tunnel exit (a violet ring on the minimap). More open at nightfall.',
        ui: '#btn-attack, #ar-attack' },
      { kind: 'nests', n: [1, 1, 2], text: ['Clear a Murmur nest', 'Clear {n} Murmur nests'], count: (P) => P.stats.captured || 0,
        hint: '<b>Army</b> (<kbd>Q</kbd>) → <b>Attack</b>, then tap a nest: its hoard spills out, and its tunnels die back.',
        ui: '#btn-attack, #ar-attack' },
    ],
  },
  // Terraforming, stage 4: military earthworks (EW, SLUICE, CAVE, SAP), on the Rust by its lake, the Murmur quiet.
  {
    id: 'groundwar', name: 'Ground War', chapter: 'First Contact',
    brief: 'Earth: the one material the Accord never rationed. Bank it, cut it, flood it and tunnel through it: the Dozer\'s war.',
    intro: [
      'The Grader has four more jobs on <b>Build → Terraform</b> (<kbd>6</kbd>), dragged in a line like Walls and cheaper than them. They stand for everyone, your robots included.',
      'An <b>Earth Bank</b> (<kbd>K</kbd>) stops vehicles and heavy robots (Bulwarks, trucks, Graders); other robots climb over slowly, and yours behind it take less fire. A <b>Fire Trench</b> (<kbd>X</kbd>) slows anyone crossing; yours in it take half the fire. <b>Dragon\'s Teeth</b> (<kbd>Z</kbd>) stop the heavy ones and let small robots through.',
      'Shells and bombs wear them down to a breach, and so do warbots told to: select them and right-click (or tap) the earthwork. To open a gap in your own, hold <kbd>Ctrl</kbd> as you right-click it, or under a finger tap <b>Breach</b> on the selection bar first. Drag the same tool over a worn one to repair it. <b>Cave in</b> (<kbd>V</kbd>) collapses a Murmur tunnel for good, and the exits it cuts off from their nest.',
      'A <b>Sluice</b> (<kbd>U</kbd>) on a lake shore floods the low ground beyond it when you open it. A <b>Sap Head</b> (<kbd>Q</kbd>) digs a tunnel along a route you plan from it, and your robots go through when it breaks out.',
    ],
    mode: 'colony', seed: 31, size: 1, rough: 1, rich: 3, biome: 'desert', shape: 11, war: true, wildlife: true, murmur: 'quiet', limit: [0, 0, 30],
    setup(S) {
      kit(S, KIT8, 4);
      const P = S.players[0], L = getE(P.lander);
      L.stock.stone += 60; L.stock.cement += 40; L.stock.alloy += 20; L.stock.chip += 6;
      for (let k = 0; k < 2; k++) addBot(0, 'grader', L.x + k, L.y + 2);
      P.stats.startBots = P.stats.bots;
      // the nest nearest the colony has dug toward it overnight: a tunnel to cave in
      const near = S.buildings.filter((b) => b.type === 'nest').sort((a, b) => dist2(a.x, a.y, L.x, L.y) - dist2(b.x, b.y, L.x, L.y))[0];
      if (near) murmurPredig(near, 22, false);
      // an old bank from before the Silence, no one's, slumped and worn, a few tiles out from the base: for the warbots
      for (let k = 0; k < 3; k++) enterBuilding(addBot(0, 'warbot', L.x, L.y), L);
      L.stock.ammo = (L.stock.ammo || 0) + 30;
      const open = (t) => S.terrain[t] === T_GROUND && !S.res[t] && !S.road[t] && !S.bAt[t] && !S.plan[t] && tfLevel(t) !== null;
      for (let d = 5; d <= 12; d++) {
        const row = [-1, 0, 1].map((o) => (inMap(L.x + d, L.y + o) ? tIdx(L.x + d, L.y + o) : -1));
        if (!row.every((t) => t >= 0 && open(t) && S.elev[t] === S.elev[row[1]])) continue;
        for (const n of ['ewK', 'ewO', 'ewH']) t4Layer(n);
        for (const t of row) { S.ewK[t] = 1; S.ewO[t] = 0; S.ewH[t] = 12; }
        S.ewVer = (S.ewVer || 0) + 1;
        break;
      }
    },
    goals: [
      { kind: 'ewbank', n: [5, 6, 8], text: 'Heap an Earth Bank {n} tiles long', count: (P) => P.stats.ewbank || 0,
        hint: '<b>Build</b> (<kbd>B</kbd>) → <b>Terraform</b> (<kbd>6</kbd>) → <b>Earth Bank</b> (<kbd>K</kbd>): drag a line, then <b>Terraform</b> in the banner. A Grader heaps it.',
        ui: "#btn-build, #build-tabs [data-g='terra'], .bcard[data-tf='bank'], #banner-ok" },
      { kind: 'ewBreached', n: 1, text: 'Breach an earthwork with your warbots', count: (P) => P.stats.ewBreached || 0,
        hint: '<b>Army</b> (<kbd>Q</kbd>) → <b>Select all warbots</b> (<kbd>F</kbd>), then right-click (or tap) the old Earth Bank east of your base.',
        ui: '#btn-attack, #ar-select' },
      { kind: 'caveIn', n: 1, text: 'Cave in a Murmur tunnel', count: (P) => P.stats.caveIn || 0,
        hint: '<b>Terraform</b> (<kbd>6</kbd>) → <b>Cave in</b> (<kbd>V</kbd>), then tap a Murmur tunnel: the raised ridge with violet veins, toward the nest.',
        ui: "#btn-build, #build-tabs [data-g='terra'], .bcard[data-tf='cave'], #banner-ok" },
      { kind: 'sluiceOpen', n: 1, text: 'Open a Sluice', at: 'sluice', count: (P) => P.stats.sluiceOpen || 0,
        hint: '<b>Terraform</b> → <b>Sluice</b> (<kbd>U</kbd>) on the lake shore (<kbd>R</kbd> turns it), then tap it → <b>Open the Sluice</b> (<kbd>O</kbd>).',
        ui: "#btn-build, #build-tabs [data-g='terra'], .bcard[data-t='sluice'], #sh-sluice" },
      { kind: 'sapOpen', n: 1, text: 'Dig a sap and break out', at: 'saphead', count: (P) => P.stats.sapOpen || 0,
        hint: '<b>Terraform</b> → <b>Sap Head</b> (<kbd>Q</kbd>); tap it → <b>Plan sap</b> (<kbd>T</kbd>), drag a route out from it, then <b>Dig</b>.',
        ui: "#btn-build, #build-tabs [data-g='terra'], .bcard[data-t='saphead'], #sh-sap, #banner-ok" },
    ],
  },
  // The Hollow (the Murmur's cavern lair: its own map). No raids yet: the Murmur's night system will bring them.
  {
    id: 'hollow', name: 'Into the Hollow', chapter: 'First Contact',
    brief: 'Your colony has landed in the Hollow, the Murmur\'s cavern lair, under a breach in its roof. Cut Fiber from the Bloom, reach the floating Crystal and ride out the tremors.',
    intro: [
      'You came down through a <b>breach</b>, the only daylight in the Hollow. Ringfall falls only through the breaches.',
      'Nothing grows down here. A <b>Harvester</b> cuts Fiber from the violet <b>Bloom veins</b>, which grow back.',
      'The richest Crystal hangs over the chasm on floating masses: a <b>Ropeway</b> (Paths) reaches one, or a bridge.',
      'Now and then the roof shakes. Where dust trickles down, rock falls: then tap what it hit → <b>Repair</b>.',
      'No aircraft fly underground, and Fuel comes from oil seeps (an Oil Pump and a Refinery). Cutting veins draws the Murmur.',
    ],
    mode: 'colony', seed: 3307, size: 1, rough: 2, rich: 3, biome: 'hollow', shape: SHAPE_PRESETS.findIndex((p) => p.hollow), limit: [0, 0, 20],
    layout(m, W) {
      // No Crystal in the home cavern (nor its own tap): it has to come from the floating mass over the chasm.
      const b = m.bases[0];
      mapTiles(m, W, b.x, b.y, 20, (t) => { if (m.res[t] === R_CRYSTAL && m.elev[t] < 3) { m.res[t] = 0; m.amt[t] = 0; } });
    },
    setup(S) {
      // The colony so far, but a Harvester: that's the first thing to build here. A Depot by the base, where the roof
      // gives way first: the rock comes down on it a couple of minutes in (S.tremor.aim).
      kit(S, KIT6.filter((t) => t !== 'harvester' && t !== 'tap'), 4);
      const L = getE(S.players[0].lander);
      L.stock.cement += 30; L.stock.alloy += 12; L.stock.fiber += 10;
      const d = preBuild(0, 'depot', L.x + 4, L.y - 2, { road: true, reach: 6 });
      if (d) { S.tremor.next = 150; S.tremor.n = 1; S.tremor.aim = { x: d.x, y: d.y }; }
    },
    goals: [
      { kind: 'made', good: 'fiber', n: [20, 30, 40],
        hint: '<b>Build</b> (<kbd>B</kbd>) → <b>Gather</b> (<kbd>1</kbd>) → <b>Harvester</b> (<kbd>H</kbd>) by the violet Bloom veins. Then <b>Lay road</b> (<kbd>R</kbd>).',
        ui: "#btn-build, #build-tabs [data-g='gather'], .bcard[data-t='harvester'], #sh-layroad" },
      { kind: 'ropeway', n: 1, text: 'Run a Ropeway to the floating Crystal',
        count: (P, S) => S.buildings.filter((b) => !b.dead && b.owner === 0 && b.type === 'ropeway' && b.far && S.elev[tIdx(b.x, b.y)] >= 3).length,
        hint: '<b>Paths</b> (<kbd>R</kbd>) → <b>Ropeways</b> (<kbd>Shift</kbd>+<kbd>Y</kbd>): a station by your roads, then its far end on the mass.',
        ui: "#btn-road, #banner-seg [data-v='ropeway'], #sh-layroad" },
      { kind: 'made', good: 'crystal', n: [15, 25, 35],
        hint: '<b>Build</b> (<kbd>B</kbd>) → <b>Gather</b> (<kbd>1</kbd>) → <b>Crystal Tap</b> (<kbd>C</kbd>) on the floating mass. Then <b>Lay road</b> (<kbd>R</kbd>).',
        ui: "#btn-build, #build-tabs [data-g='gather'], .bcard[data-t='tap'], #sh-layroad" },
      { kind: 'rockfix', n: 1, text: 'Repair what the falling rock hit', at: 'depot',
        count: (P, S) => S.buildings.filter((b) => !b.dead && b.owner === 0 && b.rocked && b.armor >= BDEFS[b.type].armor - 0.01).length,
        hint: 'When rock falls on your Depot (dust trickles down first), tap it → <b>Repair</b> (<kbd>E</kbd>).',
        ui: '#sh-fixbtn' },
    ],
  },
  // What Comes Up: the Murmur on Active, with their craft (the watcher, the power cut first) and their other forms
  // (the Leech, the Spitter and the Sapper all on the first night, as S.mur.formsFrom and formsAll bring them).
  {
    id: 'forms', name: 'What Comes Up', chapter: 'First Contact',
    brief: 'On Active the Murmur hunt with craft, and other forms come up with the packs. Read the signs, guard the power and catch them.',
    intro: [
      'At dusk one of them stands at the edge of your land, watching <b>the approach the main pack plans to take</b>.',
      'The main pack waits while cutters go for the power. A <b>Leech</b> drank from a Fuel Station last night. Tap the station, then <b>Repair</b> (<kbd>E</kbd>).',
      'A <b>Spitter</b> shorts out your guns from a few tiles off. A <b>Sapper</b> digs under and comes up inside.',
      'Nothing reaches a Sapper underground: catch it as it heaves up. And they take their dead with them.',
      'Your warbots wait in the Command Base: <b>Army</b> (<kbd>Q</kbd>) → <b>Hold ground</b> (<kbd>G</kbd>) sends them.',
      'They don\'t walk past armed robots: a big pack turns on them, a small one falls back. And from the second night small teams <b>hunt</b> whatever you leave unguarded, coming up through the <b>tunnel exits near you</b>.',
    ],
    mode: 'colony', seed: 7, size: 0, rough: 1, rich: 3, biome: 'desert', war: true, murmur: 'active', limit: [0, 0, 25], bold: true,
    setup(S) {
      kit(S, KIT8, 4);
      const P = S.players[0], L = getE(P.lander);
      for (let k = 0; k < 6; k++) enterBuilding(addBot(0, 'warbot', L.x, L.y), L);
      P.stats.startBots = P.stats.bots;
      L.stock.ammo = 30; L.stock.crystal += 12; L.stock.alloy += 8; L.stock.chip += 4; L.stock.cement += 20;
      // A second Fuel Station out along the roads, the power they go for: a Leech got to it last night, and it's dark
      // (dented: Repair brings the power back). And all their forms from the first night.
      const fs = preBuild(0, 'charger', L.x + 6, L.y + 4, { road: true, reach: 6, stock: { fuel: 4 } });
      if (fs) murmurCut({ id: 0, p: 0, cut: [], cutMsg: 1 }, [1, fs.id, fs.x, fs.y]);
      S.mur.formsFrom = 1; S.mur.formsAll = 1;
      S.mur.huntFrom = 2; // (the hunt at the weak points from the second night, as on a long game's fourth: murmurHunt)
    },
    goals: [
      { kind: 'powerback', n: 1, text: 'Get the power back', count: (P) => P.stats.powerBack || 0, at: 'charger',
        hint: 'The dark Fuel Station out along your roads: tap it → <b>Repair</b> (<kbd>E</kbd>). Its power comes back.',
        ui: '#sh-fixbtn' },
      { kind: 'guarded', n: [1, 1, 2], text: ['Put a Pulse Turret by a Fuel Station', 'Put Pulse Turrets by {n} Fuel Stations'], at: 'charger',
        count: (P, S) => S.buildings.filter((b) => !b.dead && b.built && b.owner === 0 && BDEFS[b.type].charger && S.buildings.some((g) => !g.dead && g.built && g.owner === 0 && g.type === 'turret' && dist2(g.x, g.y, b.x, b.y) <= 9)).length,
        hint: '<b>Build</b> (<kbd>B</kbd>) → <b>Defend</b> (<kbd>4</kbd>) → <b>Pulse Turret</b> (<kbd>T</kbd>) beside a Fuel Station: they cut the power first.',
        ui: "#btn-build, #build-tabs [data-g='defend'], .bcard[data-t='turret'], #sh-layroad" },
      { kind: 'watched', n: [2, 3, 4], text: 'Warbots where the watcher stood', count: (P) => P.stats.watchMet || 0,
        hint: 'At dusk, tap the watcher\'s alert: <b>Army</b> (<kbd>Q</kbd>) → <b>Hold ground</b> (<kbd>G</kbd>) there before nightfall.',
        ui: '#btn-attack, #ar-hold' },
      { kind: 'forms', n: 3, text: 'Kill a Leech, a Spitter and a Sapper', count: (P, S) => ['leech', 'spitter', 'sapper'].filter((k) => S.mur && S.mur.slain && S.mur.slain[k]).length,
        hint: 'Turrets and warbots kill them: <b>Army</b> (<kbd>Q</kbd>) → <b>Hold ground</b> (<kbd>G</kbd>) where a Sapper heaves up.',
        ui: '#btn-attack, #ar-hold' },
      // The hunt (MURMUR.bold): its teams come up only through the exits near the colony, so shutting them shuts it out.
      { kind: 'exits', n: [1, 1, 2], text: ['Collapse a tunnel exit near your land', 'Collapse {n} tunnel exits near your land'], count: (P) => P.stats.collapsed || 0,
        hint: 'Hunting teams come up through exits near you: <b>Army</b> (<kbd>Q</kbd>) → <b>Attack</b>, then tap one (a violet ring).',
        ui: '#btn-attack, #ar-attack' },
    ],
  },
  // The Atmosphere Engine's campaign sketches (the megastructure sheet, Nov 2026), built as missions. Seed Vault: a desert
  // under a dust storm that never ends, the Pathfinder's hull half-buried in the middle with its seed stock; the Engine's
  // calm is the only place to work. Light Murmur on Quiet.
  {
    id: 'seedvault', name: 'Seed Vault', chapter: 'First Contact',
    brief: '"Pathfinder seed vault, bay 4. Contents viable. Sowing schedule: overdue." Fetch the seed stock and sow it in the calm.',
    intro: [
      'The dust storm here <b>never blows over</b>: bots crawl and Missiles are grounded, everywhere but inside an Atmosphere Engine\'s calm.',
      'The <b>Pathfinder\'s hull</b> lies half-buried out in the dunes. Its seed vault\'s crates hold the Fiber the Engine needs.',
      'Warbots on <b>Hold ground</b> by the hull carry the crates home. The Murmur are about at night (Quiet).',
      'The Engine (Mega, <kbd>N</kbd>) needs 2 Generators. At stage 2, Rain, the ground round it turns fertile.',
      'Sow it: Bio Farms in the calm. Each new stage, the Bloom fights back: Sappers dig in under the Engine the next night.',
    ],
    mode: 'colony', seed: 8821, size: 1, rough: 1, rich: 3, biome: 'desert', shape: 0, mega: true, war: true, events: true, murmur: 'quiet', limit: [0, 0, 40],
    layout(m, W) { for (let t = 0; t < m.fert.length; t++) m.fert[t] = 0; },
    setup(S, diff) {
      kit(S, KIT8, 4);
      const P = S.players[0], L = getE(P.lander);
      aeKit(L, 0); L.stock.fiber = 0; L.stock.cement += 30;
      enterBuilding(addBot(0, 'tanker', L.x, L.y), L);
      for (let k = 0; k < 4; k++) enterBuilding(addBot(0, 'warbot', L.x, L.y), L);
      L.stock.ammo = (L.stock.ammo || 0) + 30;
      P.stats.startBots = P.stats.bots;
      // The storm that never ends (the Endless dust storm), from a minute in.
      S.settings.mods = ['dust']; S.events = true; S.event = null; S.nextEvent = 30;
      // The hull: in the middle of the map (or as near as there is open ground), its crates of seed stock beside it.
      const h = aeOpenNear(S, S.W >> 1, S.H >> 1, L);
      S.mission.hullX = h.x; S.mission.hullY = h.y;
      for (const [dx, dy] of [[1, 0], [-1, 1], [0, -1], [2, 1]]) { const i = h.x + dx, j = h.y + dy; if (inMap(i, j) && walkable(tIdx(i, j))) addLoot(i, j, { fiber: mPick([8, 7, 6], diff) }, true); }
    },
    goals: [
      { kind: 'looted', n: 3, text: 'Bring home {n} crates of seed stock from the hull', count: (P) => P.stats.looted || 0,
        hint: '<b>Army</b> (<kbd>Q</kbd>) → <b>Hold ground</b> (<kbd>G</kbd>) by the hull: warbots carry its crates home.',
        ui: '#btn-attack, #ar-hold' },
      AE_BUILT,
      aeStageGoal(2, 'Reach stage 2 of the Engine, Rain', 'Two <b>Generators</b> (<kbd>B</kbd> <kbd>2</kbd> <kbd>G</kbd>) by it, fed: 6 minutes of power. Speed up: <b>1×</b>.',
        "#btn-build, #build-tabs [data-g='make'], .bcard[data-t='generator'], #btn-speed"),
      { kind: 'atmosFarms', n: [4, 5, 6], text: 'Sow the seed: {n} Bio Farms in the calm', at: 'atmos', count: (P, S) => aeFarms(S),
        hint: '<b>Build</b> → <b>Gather</b> (<kbd>1</kbd>) → <b>Bio Farm</b> (<kbd>F</kbd>) on the wet ground round the Engine.',
        ui: "#btn-build, #build-tabs [data-g='gather'], .bcard[data-t='farm']" },
    ],
  },
  // Under the Bloom: a clearing in the Bloom with the Murmur on Active, every raid aimed at the Engine, Sappers from Rain.
  // Green it, push the Bloom back, and keep it standing to the Garden.
  {
    id: 'underbloom', name: 'Under the Bloom', chapter: 'First Contact',
    brief: '"Survey corridor 2: overgrown. Native growth not in the Catalog." Green the clearing, push the Bloom back and hold.',
    intro: [
      'A clearing in the <b>Bloom</b>, the Murmur\'s own ground. They are on Active, and they hate the Engine: every night they go for it first.',
      'Each new stage, the Bloom fights back: <b>Sappers</b> dig in under the Engine the next night. Catch them as they heave up.',
      'At stage 2, Rain, the Bloom stops spreading in its circle. At stage 3, Green, it withers back a tile a minute.',
      'At stage 4, the <b>Garden</b> (20 tiles), the Bloom is gone, and no tunnel exit can open in it.',
      'Ring the Engine with <b>Pulse Turrets</b> and keep warbots by it at dusk.',
    ],
    mode: 'colony', seed: 3307, size: 1, rough: 1, rich: 3, biome: 'alien', shape: 0, mega: true, war: true, murmur: 'active', limit: [0, 0, 50],
    setup(S) {
      kit(S, [...KIT8, 'armory'], 4);
      const P = S.players[0], L = getE(P.lander);
      aeKit(L); L.stock.cement += 40; L.stock.crystal += 12; L.stock.alloy += 10;
      enterBuilding(addBot(0, 'tanker', L.x, L.y), L);
      for (let k = 0; k < 6; k++) enterBuilding(addBot(0, 'warbot', L.x, L.y), L);
      L.stock.ammo = (L.stock.ammo || 0) + 40;
      P.stats.startBots = P.stats.bots;
    },
    goals: [
      AE_BUILT,
      aeStageGoal(3, 'Reach stage 3 of the Engine, Green', 'Keep both Generators fed: 16 minutes of power. Ring it with <b>Pulse Turrets</b> (<kbd>B</kbd> <kbd>4</kbd> <kbd>T</kbd>).',
        "#btn-build, #build-tabs [data-g='defend'], .bcard[data-t='turret']"),
      { kind: 'bloomBack', n: [4, 6, 8], text: 'Push the Bloom back {n} tiles', at: 'atmos', count: (P) => P.stats.atmosWither || 0,
        hint: 'At Green the Bloom withers back a tile a minute. Keep the power on: tap the Engine to see its stage.',
        ui: '#btn-speed' },
      { kind: 'atmosGarden', n: 1, text: 'Reach the Garden with the Engine standing', at: 'atmos', hold: true,
        count: (P, S) => { const e = aeOwn(S); return e && e.built && e.aeStage >= 4 ? 1 : 0; },
        hint: 'At dusk, <b>Army</b> (<kbd>Q</kbd>) → <b>Hold ground</b> (<kbd>G</kbd>) by the Engine: Sappers come up beside it.',
        ui: '#btn-attack, #ar-hold' },
    ],
  },
  {
    id: 'livefire', name: 'Live Fire', chapter: 'First Contact',
    brief: 'Your first rival: a quiet colony with two empty Outposts. Learn to command warbots, then take its Command Base.',
    intro: [
      '<b>Versus</b>: another colony shares this moon. Capture its Command Base and the planet is yours.',
      'This rival only defends itself. Red is theirs, blue is yours. Each Ammo reloads a warbot\'s 5 shots.',
      'Army (<kbd>Q</kbd>) → Attack, then tap an enemy building or robot. Or tap a building → Send warbots (Q).',
      'With a mouse: drag a box round warbots and right-click; Ctrl+1-9 saves a group. <kbd>C</kbd> calls them home; <b>Idle</b> (<kbd>,</kbd>) finds any left standing.',
      'A colony holds 90 robots, and you landed with Workers to spare: <b>recycle</b> them at the Bot Foundry for Alloy.',
    ],
    mode: 'versus', seed: 20103, size: 0, rough: 1, rich: 3, biome: 'lunar', players: 2, style: 'balanced',
    rival: ['easy', 'easy', 'medium'], passive: [true, true, true], limit: [0, 0, 25],
    setup(S, diff) {
      const W = S.W, H = S.H, L = getE(S.players[0].lander), R = getE(S.players[1].lander);
      // More guards in the rival's Command Base (it starts with 4): taking it needs a real army.
      for (let k = 0; k < mPick([2, 4, 6], diff); k++) enterBuilding(addBot(1, 'warbot', R.x, R.y), R);
      S.players[1].stats.startBots = S.players[1].stats.bots;
      // Two empty rival Outposts toward the middle, to practise on.
      preBuild(1, 'outpost', Math.floor(W / 2) - 5, Math.floor(H / 2) - 4, { reach: 8 });
      preBuild(1, 'outpost', Math.floor(W / 2) + 5, Math.floor(H / 2) - 5, { reach: 8 });
      computeTerritory();
      // The colony so far, and an Ammo Plant; and more Workers than it has work for (spare ones to recycle).
      kit(S, KIT8, 10);
      preBuild(0, 'armory', L.x - 3, L.y - 3, { road: true });
      computeTerritory();
    },
    goals: [
      { kind: 'recycled', n: [3, 4, 5], text: 'Recycle {n} spare Workers',
        count: (P) => (P.recycledBots && P.recycledBots.worker) || 0,
        hint: 'Tap the robot count at the top (<kbd>U</kbd>) → <b>Recycle spare Workers</b>. They walk to the Bot Foundry.',
        ui: '#pop-recycle' },
      { kind: 'bots', type: 'warbot', n: [3, 4, 6], at: 'foundry',
        hint: 'Tap the Bot Foundry → <b>Order bots</b>: Warbots <b>+1</b>. The Ammo Plant keeps them loaded.',
        ui: "#sh-orders .order-row[data-k='warbot'] [data-d='1']" },
      { kind: 'outposts', n: [1, 1, 2],
        hint: '<b>Army</b> (<kbd>Q</kbd>) → group size <b>4</b> → <b>Attack</b> (<kbd>Q</kbd>) → tap a red Outpost. Shot down, it\'s yours.',
        ui: '#btn-attack, #ar-n4, #ar-attack' },
      { kind: 'capture',
        hint: 'Tap their Command Base to count its guards. Bring more: <b>Army</b> (<kbd>Q</kbd>) → <b>All</b> (<kbd>4</kbd>) → <b>Attack</b> (<kbd>Q</kbd>).',
        ui: '#btn-attack, #ar-nall, #ar-attack' },
    ],
  },
  // Passenger Town (the city map, SHAPE_PRESETS city): stripping its buildings for salvage, the ways that opens,
  // cover beside them, and an old Accord sentry cleared with warbots.
  {
    id: 'ruins', name: 'Passenger Town', chapter: 'First Contact',
    brief: 'The Pathfinder\'s town for the first colonists stands empty between you and a rival. Strip it for salvage, and open a way through.',
    intro: [
      'The town was built for colonists who never came. Its buildings block the way: the streets are a maze.',
      'Tap a building → <b>Strip for salvage</b> (<kbd>S</kbd>). Your free Workers take it apart for Cement, Alloy and Chips.',
      'They set the salvage down beside it in crates: Haulers with a road to them, or idle Workers, carry them home.',
      'The town\'s avenue is still an old road: join your roads to it and your Haulers can drive into the town.',
      'A stripped lot is open ground: a new street, for you and the rival alike. Robots beside a building are in cover.',
      'Some buildings still have an old Accord sentry on duty. It shoots anything that comes near: clear it with warbots.',
    ],
    mode: 'versus', seed: 7310, size: 0, rough: 1, rich: 3, biome: 'jungle', players: 2, style: 'balanced', shape: SHAPE_PRESETS.findIndex((p) => p.city),
    rival: ['easy', 'easy', 'medium'], passive: [true, true, true], limit: [0, 0, 25],
    setup(S, diff) {
      kit(S, [...KIT8, 'armory'], 4); // (the colony so far, with an Ammo Plant)
      const L = getE(S.players[0].lander);
      for (let k = 0; k < mPick([4, 3, 2], diff); k++) enterBuilding(addBot(0, 'warbot', L.x, L.y), L);
      S.players[0].stats.startBots = S.players[0].stats.bots;
    },
    goals: [
      { kind: 'ruins', n: [2, 3, 4], text: ['Strip a building of the town', 'Strip {n} buildings of the town'], count: (P) => P.stats.ruins || 0,
        hint: 'Tap a building in the town → <b>Strip for salvage</b> (<kbd>S</kbd>). Your free Workers go and take it apart.',
        ui: '#sh-strip' },
      { kind: 'avenue', text: 'Join a road to the town\'s old avenue',
        count: (P, S) => { // (a road or planned road of yours, not the avenue's own, beside an avenue tile that's still road)
          const av = new Set((S.town && S.town.av) || []);
          for (const t of av) {
            if (!S.road[t]) continue;
            const i = t % S.W;
            for (const u of [i > 0 ? t - 1 : -1, i < S.W - 1 ? t + 1 : -1, t - S.W, t + S.W]) if (u >= 0 && u < S.W * S.H && !av.has(u) && (S.road[u] ? wayOwner(u) === 0 : S.plan[u] === 1)) return 1;
          }
          return 0;
        },
        hint: '<b>Paths</b> (<kbd>R</kbd>): drag a road from yours to the avenue running into the town, tap <b>Build</b>.',
        ui: "#btn-road, #banner-seg [data-v='road'], #banner-ok" },
      { kind: 'salvage', n: [20, 30, 45], text: 'Strip {n} units of salvage', count: (P) => P.stats.stripped || 0,
        hint: 'Order more buildings stripped (<kbd>S</kbd> on a building\'s panel). Bigger ones take longer and give more.',
        ui: '#sh-strip' },
      { kind: 'sentry', n: 1, text: 'Clear an old Accord sentry', count: (P) => P.stats.sentries || 0,
        hint: 'Drag a box round warbots (or <b>Army</b> → <b>Select all</b>), then tap the guarded building.',
        ui: '#btn-attack, #ar-select' },
    ],
  },
  // The Walking Factory (SHAPE_PRESETS walker): boarding the old Accord machine, claiming it, holding it while it walks
  // its loop and builds Warbots, and taking it back from a rival.
  {
    id: 'walker', name: 'The Walking Factory', chapter: 'First Contact',
    brief: 'An old Accord mobile factory lies dormant between you and a rival. Board it, claim it, and hold it while it walks and builds for you.',
    intro: [
      'The machine in the middle of the map is an Accord mobile works, dormant since the truce fell void.',
      'Armed robots on its deck (inside its ring) count as aboard. Alone aboard, they claim it: one in 15 seconds, more faster.',
      'Tap it → <b>Send warbots aboard</b> (<kbd>E</kbd>), or select warbots and tap its deck. Robots sent aboard walk with it.',
      'Claimed, it wakes, walks out to its loop toward you and goes round, and builds you a Warbot every 50 seconds.',
      'Enemy robots aboard stall it, then take your hold down. Keep guards on its deck.',
    ],
    mode: 'versus', seed: 5150, size: 0, rough: 1, rich: 3, biome: 'savanna', players: 2, style: 'balanced', shape: SHAPE_PRESETS.findIndex((p) => p.walker),
    rival: ['easy', 'easy', 'medium'], passive: [true, true, true], limit: [0, 0, 25],
    setup(S, diff) {
      kit(S, [...KIT8, 'armory'], 4); // (the colony so far, with an Ammo Plant)
      const L = getE(S.players[0].lander);
      for (let k = 0; k < mPick([4, 3, 2], diff); k++) enterBuilding(addBot(0, 'warbot', L.x, L.y), L);
      S.players[0].stats.startBots = S.players[0].stats.bots;
    },
    goals: [
      { kind: 'board', text: 'Send warbots aboard the Walking Factory', count: (P, S) => (S.walker && S.bots.some((u) => u.owner === 0 && walkerAboard(u)) ? 1 : 0),
        hint: 'Tap the Walking Factory in the middle of the map → <b>Send warbots aboard</b> (<kbd>E</kbd>).',
        ui: '#sh-board' },
      { kind: 'claim', text: 'Claim the Walking Factory', count: (P) => P.stats.walkerClaims || 0,
        hint: 'Keep armed robots on its deck, with no enemy aboard, until the ring round it fills in your colour.',
        ui: '#sh-board' },
      { kind: 'walkerbots', n: [2, 3, 4], text: ['Let it build you a Warbot', 'Let it build you {n} Warbots'], count: (P) => P.stats.walkerBots || 0,
        hint: 'Hold it: keep guards on its deck (tap it → <b>Send warbots aboard</b>, <kbd>E</kbd>). Its line stops while enemies are aboard.',
        ui: '#sh-board' },
    ],
  },
  // The Dam (SHAPE_PRESETS dam): a dam over your valley to guard and shore up, and the rival's to wreck with warbots.
  {
    id: 'dam', name: 'The Dam', chapter: 'First Contact',
    brief: 'The Pathfinder\'s reservoirs stand on the high ground between you and a rival, one over each valley. Shore yours up, and break theirs.',
    intro: [
      'A high shelf runs down the middle of this planet. On it, in front of each colony, a lake held back by an old dam.',
      'Your dam holds the lake over your valley. Something has hit it already: tap it and <b>Shore it up</b> (<kbd>U</kbd>).',
      'Your free Workers mend it, but only while nothing is shooting at it.',
      'The rival\'s dam stands over their valley, across the high ground. Tap it and <b>Demolish the dam</b> (<kbd>D</kbd>).',
      'Then send warbots to it: every armed one within 3 tiles of its face chips at it. The ramps beside each dam lead up.',
      'Burst, its lake floods the valley below: robots swept, buildings damaged, roads washed out, and a river left behind.',
    ],
    mode: 'versus', seed: 7, size: 0, rough: 1, rich: 3, biome: 'jungle', players: 2, style: 'balanced', shape: SHAPE_PRESETS.findIndex((p) => p.dam),
    rival: ['easy', 'easy', 'medium'], passive: [true, true, true], limit: [0, 0, 25],
    setup(S, diff) {
      kit(S, [...KIT8, 'armory'], 4); // (the colony so far, with an Ammo Plant)
      const L = getE(S.players[0].lander);
      for (let k = 0; k < mPick([8, 7, 6], diff); k++) enterBuilding(addBot(0, 'warbot', L.x, L.y), L);
      S.players[0].stats.startBots = S.players[0].stats.bots;
      S.dam.d[0].hp = Math.round(DAM.hp * 0.6); // (struck already: the first goal is to shore it up)
    },
    goals: [
      { kind: 'dammend', text: 'Shore your dam up to full strength', count: (P, S) => (S.dam && S.dam.d[0].broke < 0 && S.dam.d[0].hp >= DAM.hp ? 1 : 0),
        hint: 'Tap your dam (the concrete wall above your valley) → <b>Shore it up</b> (<kbd>U</kbd>). Free Workers mend it.',
        ui: '#sh-dammend' },
      { kind: 'dams', text: 'Burst the rival\'s dam', count: (P) => P.stats.dams || 0,
        hint: 'Tap their dam → <b>Demolish the dam</b> (<kbd>D</kbd>). Then select warbots and tap the dam to send them.',
        ui: '#sh-damwreck, #btn-attack, #ar-select' },
    ],
  },
  {
    id: 'border', name: 'Border Dispute', chapter: 'First Contact',
    brief: 'A rival shares this plateau, and the rich fields lie between you. Take their Outposts, carry off loot and hold the land.',
    intro: [
      'This rival builds, spreads out and fights back.',
      'Warbots capture forts they shoot down (Outposts, Keeps) and wreck the rest, carrying the goods home.',
      'Buildings their border takes are <b>cut off</b> and slowly crumble unless you win the land back.',
      'Warbots recharge in your forts but run down on enemy land.',
      'In free play, holding most of the land for 3 minutes wins a Domination game.',
    ],
    mode: 'versus', seed: 6603, size: 0, rough: 1, rich: 3, biome: 'autumn', players: 2, style: 'balanced',
    rival: ['easy', 'easy', 'easy', 'normal', 'normal'], passive: [true, false, false], limit: [0, 0, 25],
    // (Five-long since the balance audit of Nov 22 2026, the owner's call: Warlord keeps Commander's Normal rival. With
    // mPick's Hard one the AI on your side, playing the hints' steps, lost at all three work speeds, its Command Base
    // falling at 3½ to 13 minutes; with the Normal rival it won all three, at 7 to 13 minutes.)
    layout(m, W) {
      const H = m.terrain.length / W;
      mirrored(W, H, Math.floor(W / 2) - 5, Math.floor(H / 2) + 2, (x, y) => placeField(m, W, x, y, 1.8, R_ORE, 0.75, 3));
      mirrored(W, H, Math.floor(W / 2) + 6, Math.floor(H / 2) + 3, (x, y) => placeField(m, W, x, y, 1.6, R_CRYSTAL, 0.75, 4));
    },
    setup(S, diff) {
      kit(S, [...KIT8, 'armory'], 4); // (the colony so far, with Live Fire's Ammo Plant)
      const W = S.W, H = S.H, P1 = S.players[1];
      // Two rival Outposts on the rival's side of the contested fields, each with a few warbots on guard.
      for (const [x, y] of [[Math.floor(W / 2) - 5, Math.floor(H / 2) + 2], [Math.floor(W / 2) + 6, Math.floor(H / 2) + 3]]) {
        const o = preBuild(1, 'outpost', W - 1 - x, H - 1 - y, { reach: 4 });
        if (o) for (let k = 0; k < mPick([2, 3, 4], diff); k++) enterBuilding(addBot(1, 'warbot', o.x, o.y), o);
      }
      P1.stats.startBots = P1.stats.bots;
      computeTerritory();
    },
    goals: [
      { kind: 'outposts', n: [1, 2, 2],
        hint: 'Tap a red Outpost to count its guards. Then <b>Army</b> (<kbd>Q</kbd>) → <b>All</b> (<kbd>4</kbd>) → <b>Attack</b> (<kbd>Q</kbd>) → tap it.',
        ui: '#btn-attack, #ar-nall, #ar-attack' },
      { kind: 'looted', n: [3, 5, 6], text: 'Carry home {n} crates of loot', count: (P) => P.stats.looted || 0,
        hint: '<b>Army</b> → <b>Attack</b> a rival Mine or factory with goods inside: your warbots carry them home in crates.',
        ui: '#btn-attack, #ar-attack' },
      { kind: 'land', n: [34, 40, 42],
        hint: 'Build Outposts (<kbd>B</kbd> <kbd>4</kbd> <kbd>O</kbd>) on the rich middle fields. A captured Outpost brings its ring too.',
        ui: "#btn-build, #build-tabs [data-g='defend'], .bcard[data-t='outpost']" },
    ],
  },
  {
    id: 'holdline', name: 'Hold the Line', chapter: 'First Contact',
    brief: 'A Herald (a rusher) will attack early. Wall the channels through the crags, man the guns and hold out.',
    intro: [
      'This rival is a <b>Herald</b> (a rusher): its clock stopped a day before Arrival, so it attacks early. Others are Wardens, Salvagers, Architects and Stewards.',
      'A belt of crags with a few narrow channels: wall them and cover them with guns. Messages from your <b>Scouts</b> say when it masses or marches (Go shows where).',
      '<b>Terrain routes</b> (Shift+R, or <b>ROUTES</b> on the minimap) shows the channels as yellow gates and the Herald\'s way in: a red <b>!</b> is a back door nothing of yours covers yet.',
      'Walls stop everyone, your robots too: where a wall line crosses a road, a Gate goes in.',
      'Stalks or boulders where a wall should go? <b>Paths → Clear ground</b> (<kbd>Shift</kbd>+<kbd>C</kbd>): drag over them and free Workers clear the ground. The resource is lost.',
      'An Outpost can Hold inside or Go out and fight. Tap a turret → <b>Aim</b> to pick its target. Mortar Pits, Disruptors and the Keep are in Defend too.',
      'Its warbots come behind a <b>Bulwark</b>, a shield robot that covers six: gunfire from in front can\'t reach them, so cover the channels from the side.',
    ],
    mode: 'versus', seed: 2121, size: 1, rough: 2, rich: 3, biome: 'polar', shape: 2, players: 2, style: 'rusher',
    rival: ['medium', 'medium', 'normal'], limit: [0, 0, 0],
    setup(S, diff) {
      kit(S, [...KIT8, 'armory'], 4); // (the colony so far, with Live Fire's Ammo Plant)
      const L = getE(S.players[0].lander), P1 = S.players[1], R = getE(P1.lander);
      // An Outpost up by the crags, joined to the roads: its land reaches the east channel, so guns can cover it.
      preBuild(0, 'outpost', 23, 36, { road: true, reach: 2 });
      computeTerritory();
      L.stock.cement += 20; L.stock.alloy += 8; L.stock.crystal += 6;
      // Four more warbots at home (8 in all): enough to man a Bunker and still face the Herald.
      for (let k = 0; k < 4; k++) enterBuilding(addBot(0, 'warbot', L.x, L.y), L);
      S.players[0].stats.startBots = S.players[0].stats.bots;
      // The Herald starts with more warbots, and holds its first assault until you've had time to dig in (not before
      // 7 / 5½ / 4 minutes; played headless against a colony that follows the hints, its first assault hit at about
      // 8½ / 7½ / 4½ minutes, and 1 to 2½ minutes later on Easy and Normal before mission rivals had the rival's opening).
      for (let k = 0; k < mPick([2, 4, 6], diff); k++) enterBuilding(addBot(1, 'warbot', R.x, R.y), R);
      P1.stats.startBots = P1.stats.bots;
      P1.nextAttack = mPick([420, 330, 240], diff);
      // ...with a Bulwark at its head, and its assault comes whatever your guns (P.bold): this mission is about holding it.
      for (let k = 0; k < mPick([1, 1, 2], diff); k++) enterBuilding(addBot(1, 'bulwark', R.x, R.y), R);
      P1.bold = true;
    },
    goals: [
      { kind: 'built', type: 'turret', n: [1, 2, 2],
        hint: '<b>Build</b> (<kbd>B</kbd>) → <b>Defend</b> (<kbd>4</kbd>) → <b>Pulse Turret</b> (<kbd>T</kbd>) where a channel comes out. Then tap its site → <b>Lay road</b> (<kbd>R</kbd>).',
        ui: "#btn-build, #build-tabs [data-g='defend'], .bcard[data-t='turret'], #sh-layroad" },
      // (A Gate counts: it's what a wall line gets where it crosses a road.)
      { kind: 'walls', n: [4, 6, 8], text: 'Build {n} Walls',
        count: (P, S) => S.buildings.filter((b) => !b.dead && b.owner === 0 && b.built && (b.type === 'wall' || b.type === 'gate')).length,
        hint: '<b>Walls</b> (<kbd>X</kbd>): draw two rows across each channel, then <b>Build</b>. <kbd>Shift</kbd>+<kbd>R</kbd> shows the gaps.',
        ui: "#btn-road, #banner-seg [data-v='wall'], #build-walls, #banner-ok, #mm-routes" },
      { kind: 'mannedBunker', n: 1, text: 'Man a Bunker with 2 warbots', at: 'bunker',
        count: (P, S) => S.buildings.filter((b) => !b.dead && b.owner === 0 && b.built && b.type === 'bunker' && b.garrison.length >= 2).length,
        hint: '<b>Build</b> → <b>Defend</b> → <b>Bunker</b> (<kbd>U</kbd>) behind a wall; tap its site → <b>Lay road</b>. Once built, tap it → <b>Station here</b> (<kbd>V</kbd>).',
        ui: "#btn-build, #build-tabs [data-g='defend'], .bcard[data-t='bunker'], #sh-layroad, #sh-st-send" },
      // Focus fire (ORDERS.focus): a defence locked onto the enemy you pick (the warbots behind a Bulwark, say, from the side).
      { kind: 'aimed', n: 1, text: 'Aim a defence at an enemy', at: 'turret', count: (P) => P.stats.aimed || 0,
        hint: 'When they come, tap a Pulse Turret → <b>Aim</b> (<kbd>T</kbd>), then tap an enemy in range. Or right-click it.',
        ui: '#sh-focus' },
      { kind: 'survive', n: [10, 12, 15], text: 'Hold out for {n} minutes', count: (P, S) => (S.winner === 0 ? 99 : Math.floor(S.time / 60)),
        hint: 'Order more Warbots, add <b>Minigun Nests</b> (<kbd>G</kbd>), and tap a dented building → <b>Repair</b> (<kbd>E</kbd>).',
        ui: "#btn-build, #build-tabs [data-g='defend'], .bcard[data-t='minigun']" },
      // War scars: the scrap of the robots that fell at the walls, salvaged by idle Haulers from a road beside it (met at
      // once with War scars Off, where nothing is left to salvage).
      { kind: 'salvaged', n: [1, 2, 2], text: 'Salvage {n} Alloy from the scrap', count: (P) => (scarLevel() ? P.stats.salvaged || 0 : 99),
        hint: 'Idle Haulers salvage scrap near roads: <b>Paths</b> (<kbd>R</kbd>), run a road out to the fallen robots.',
        ui: '#btn-road' },
    ],
  },

  // Something Keeps Time (the design sheet's mission for the Sundering Ray): the Murmur's tunnels already under the
  // base, the Ray built, powered and fired over the nest that dug them, and the night it brings held.
  {
    id: 'keepstime', name: 'Something Keeps Time', chapter: 'First Contact',
    brief: 'Tunnels are spreading under your base; the Bloom ridges already reach the Smelter. Build the Sundering Ray, strike the deep, and hold the night they answer.',
    intro: [
      'The <b>Sundering Ray</b> (Mega tab) is a phased array: rams in a row round a bore tower, steering a shock through the ground.',
      'It needs <b>2 Generators</b> with Fuel within 4 tiles. It winds up for 60 seconds, and everyone hears it.',
      '<b>Strike the Deep</b> caves in every tunnel in a 16-tile circle, seals the exits there for 2 nights and shakes the nests.',
      'A <b>Quake</b> cracks a colony instead: buildings, roads and Walls in a 5-tile circle. A Shield Dome doesn\'t stop it.',
      'The Murmur hear every blow. The next night the nests near it come for the Ray first, in bigger packs.',
    ],
    mode: 'colony', seed: 4417, size: 1, rough: 1, rich: 3, biome: 'swamp', war: true, mega: true, murmur: 'active', limit: [0, 0, 30],
    setup(S) {
      kit(S, [...KIT8, 'armory'], 5);
      const P = S.players[0], L = getE(P.lander);
      for (let k = 0; k < 6; k++) enterBuilding(addBot(0, 'warbot', L.x, L.y), L);
      P.stats.startBots = P.stats.bots;
      L.stock.ammo = 40; L.stock.cement += 70; L.stock.alloy += 46; L.stock.chip += 18; L.stock.crystal += 14; L.stock.fuel += 24;
      enterBuilding(addBot(0, 'tanker', L.x, L.y), L); // (the Generators' Fuel)
      // The nest nearest the colony has dug toward it for nights: its tunnels under the base, an exit open out there.
      const near = S.buildings.filter((b) => b.type === 'nest').sort((a, b) => dist2(a.x, a.y, L.x, L.y) - dist2(b.x, b.y, L.x, L.y))[0];
      if (near) { for (let k = 0; k < 3; k++) murmurPredig(near, 30, k === 2); S.mission.markNest = near.id; }
    },
    goals: [
      { kind: 'built', type: 'sunder', n: 1,
        hint: '<b>Build</b> (<kbd>B</kbd>) → <b>Mega</b> (<kbd>5</kbd>) → <b>Sundering Ray</b> (<kbd>Y</kbd>) near home. Then <b>Lay road</b> (<kbd>R</kbd>).',
        ui: "#btn-build, #build-tabs [data-g='mega'], .bcard[data-t='sunder'], #sh-layroad" },
      { kind: 'rayPower', n: 1, text: 'Power the Ray with 2 Generators', at: 'sunder',
        count: (P, S) => S.buildings.filter((b) => !b.dead && b.built && b.owner === 0 && BDEFS[b.type].sunder && megaGens(b, SUNDER.reach).length >= SUNDER.gens).length,
        hint: '<b>Make</b> (<kbd>B</kbd> <kbd>2</kbd>) → <b>Generator</b> (<kbd>G</kbd>), two within 4 tiles of the Ray. A Tanker brings Fuel.',
        ui: "#btn-build, #build-tabs [data-g='make'], .bcard[data-t='generator']" },
      { kind: 'deepStruck', n: 1, text: 'Strike the Deep over the marked nest', at: 'sunder',
        count: (P, S) => { const N = getE(S.mission && S.mission.markNest); return N && !N.dead && N.sQuiet ? 1 : N && N.dead ? 1 : 0; },
        focus: (S) => getE(S.mission && S.mission.markNest) || null,
        hint: 'Tap the Ray → <b>Strike the Deep</b> (<kbd>F</kbd>), tap the ringed nest, then <b>Strike</b>. Do it by day.',
        ui: '#sh-sdeep' },
      { kind: 'rayDawn', n: 1, text: 'Keep the Ray standing until dawn', at: 'sunder',
        count: (P, S) => S.buildings.some((b) => !b.dead && b.built && b.owner === 0 && BDEFS[b.type].sunder && b.sLure && murmurNights(S.time) >= b.sLure && !murmurNight(S.time)) ? 1 : 0,
        hint: 'They come for the Ray tonight: <b>Army</b> (<kbd>Q</kbd>) → <b>Hold ground</b> (<kbd>G</kbd>) by it, and a <b>Pulse Turret</b>.',
        ui: '#btn-attack, #ar-hold' },
    ],
  },
  // The Harrow: the biggest of the Murmur comes up out of the ground and walks at the colony; an army gathered in its
  // way, spread out, with the heavy weapons that hurt it, brings it down before it reaches the Generators.
  {
    id: 'harrowhunt', name: 'The Harrow', chapter: 'First Contact',
    brief: 'Ground radar: one return, very large, rising. Gather your army in its way, bring it down, and keep the Generators lit.',
    intro: [
      'The <b>Harrow</b> is the biggest of the Murmur, bigger than your Command Base. It walks straight at the colony\'s power.',
      'Small arms (warbots, Bulwarks, turrets) do a quarter of their damage to it. <b>Railgunners</b>, <b>Howitzers</b> and <b>Torches</b> do it all.',
      'Every few seconds it rears and <b>slams</b> the ground: robots within 3 tiles are stunned and Walls and roads there are gone. Spread out.',
      'Scuttlers ride on its back and drop off when it slams, and a pack comes up with it. Meet it in the open, before your walls.',
    ],
    mode: 'colony', seed: 5531, size: 1, rough: 1, rich: 3, biome: 'desert', war: true, murmur: 'active', limit: [0, 0, 25],
    setup(S, diff) {
      kit(S, [...KIT8, 'armory'], 5);
      const P = S.players[0], L = getE(P.lander);
      // (the Generators on the far side of the base from the nest it comes out of)
      const nest = harrowNest(L.x + 0.5, L.y + 0.5), a = nest ? datan2(L.y - nest.y, L.x - nest.x) : 0;
      for (const g of ['generator', 'generator']) preBuild(0, g, Math.round(L.x + dcos(a) * 5), Math.round(L.y + dsin(a) * 5), { road: true, stock: { fuel: 6 } });
      const army = { warbot: mPick([14, 12, 10], diff), bulwark: 3, railgunner: mPick([6, 5, 4], diff), torch: 2, rocket: mPick([3, 3, 2], diff) };
      for (const type in army) for (let k = 0; k < army[type]; k++) { const u = addBot(0, type, L.x, L.y); if (BOTS[type].siege) { u.x = L.x + 1.5 + k; u.y = L.y + 2.5; } else enterBuilding(u, L); }
      P.stats.startBots = P.stats.bots;
      L.stock.ammo = 60; L.stock.crystal += 20; L.stock.fuel += 20;
      // It comes up out of the nest nearest the colony, a few minutes in (sooner the harder).
      S.mission.harrowAt = mPick([240, 180, 150], diff);
    },
    goals: [
      { kind: 'harrowFlag', n: 12, text: 'Gather {n} robots on a Hold ground flag',
        count: (P, S) => Math.max(0, ...S.rallies.filter((r) => r.owner === 0).map((r) => rallyMembers(r.id).length)),
        hint: '<b>Army</b> (<kbd>Q</kbd>) → <b>Hold ground</b> (<kbd>G</kbd>) on open ground out past your base.',
        ui: '#btn-attack, #ar-hold' },
      { kind: 'harrowDown', n: 1, text: 'Bring the Harrow down',
        count: (P, S) => (S.mur && S.mur.slain && S.mur.slain.harrow) || 0,
        focus: (S) => S.bots.find((u) => !u.dead && u.type === 'harrow') || null,
        hint: 'Move the flag into its path. Spread out; <b>Railgunners</b> and <b>Howitzers</b> hit it hardest.',
        ui: '#btn-attack, #ar-hold' },
      { kind: 'gensStand', n: 2, text: 'Keep both Generators standing until it\'s down', hold: true,
        count: (P, S) => (S.mur && S.mur.slain && S.mur.slain.harrow ? S.buildings.filter((b) => !b.dead && b.owner === 0 && b.type === 'generator').length : 0),
        hint: 'It goes for the power. Keep the fight away from the <b>Generators</b>.',
        ui: '#btn-attack' },
    ],
  },
  // Chapter 8, War. Ammo and repairs, siege robots and missiles, the nuclear race and a final assault.
  {
    id: 'supply', name: 'Supply Lines', chapter: 'War',
    brief: 'Warbots win nothing on empty magazines. Keep the Ammo flowing, mend the wounded and take the rival base.',
    intro: [
      'An <b>Ammo Plant</b> packs Alloy and Cement into Ammo (5 shots each; a reload fills a warbot up). Haulers stock your Command Base and Outposts.',
      'A <b>Repair Station</b> mends hurt robots with Alloy, three at a time.',
      'An Outpost near the front can be the <b>rally point</b>, where new warbots gather.',
      '<b>Army</b> → <b>Hold ground</b> plants a flag: by their roads warbots tear them up, beside a building they storm it.',
      'Their base can only be captured once your other goals are met.',
    ],
    mode: 'versus', seed: 7707, size: 1, rough: 2, rich: 3, biome: 'jungle', shape: 0, style: 'balanced',
    rival: ['easy', 'medium', 'normal'], limit: [0, 0, 40],
    setup(S) {
      kit(S, KIT8, 4); // (the colony so far: with the Bio Farm for Fuel, as in First Contact)
      // An Outpost out towards the rival, joined by road (the rally point's first home).
      const L = getE(S.players[0].lander), s = aiFindSpot(0, 'outpost', L);
      if (s) preBuild(0, 'outpost', s.x, s.y, { road: true });
      computeTerritory();
      // The warbots landed with their magazines low.
      for (const u of S.bots) if (u.type === 'warbot' && u.owner === 0) u.ammo = 4;
    },
    goals: [
      { kind: 'made', good: 'ammo', n: [15, 25, 35],
        hint: '<b>Build</b> (<kbd>B</kbd>) → <b>Make</b> (<kbd>2</kbd>) → <b>Ammo Plant</b> (<kbd>I</kbd>). It rests at 24 Ammo: tap it → Stock limit <b>+</b>.',
        ui: "#btn-build, #build-tabs [data-g='make'], .bcard[data-t='armory'], #goods .res-chip[data-g='ammo']" },
      { kind: 'built', type: 'repair', n: 1,
        hint: '<b>Build</b> → <b>Defend</b> (<kbd>4</kbd>) → <b>Repair Station</b> (<kbd>R</kbd>): hurt robots come to it.',
        ui: "#btn-build, #build-tabs [data-g='defend'], .bcard[data-t='repair']" },
      { kind: 'rallyPoint', n: 1, text: 'Set a rally point for new warbots', at: 'outpost',
        count: (P) => (P.rallyPost && rallyPostOf(0) ? 1 : 0),
        hint: 'Tap your Outpost (or build one nearer them) → <b>Make this the rally point for new warbots</b>.',
        ui: '#sh-rallypost' },
      { kind: 'capture',
        hint: '<b>Army</b> (<kbd>Q</kbd>) → <b>Hold ground</b> (<kbd>G</kbd>) by their roads to raid. To take their base: <b>All</b> (<kbd>4</kbd>) → <b>Hold ground</b> right beside it.',
        ui: '#btn-attack, #ar-nall, #ar-hold' },
    ],
  },
  // Army Groups (sim.js): a standing army with its own order, kept up to strength by the Bot Foundry.
  {
    id: 'standing', name: 'Standing Orders', chapter: 'War',
    brief: 'An army that needs you for every step is half an army. Give your warbots standing orders, and let the Foundry keep them whole.',
    intro: [
      'An <b>Army Group</b> is a standing army: a badge, a home, a target size and one order it keeps to.',
      'Select warbots, then <b>Army group</b> on the selection bar → <b>New group from these</b>. Up to 6.',
      'Its card (right side) selects it; tap again to go to it. Right-click or hold the card for its panel.',
      'Orders: <b>Hold</b>, <b>Defend area</b>, <b>Patrol</b>, <b>Attack</b>, <b>Follow</b>, <b>Raid</b>. Your own order pauses it: <b>Back to order</b>.',
      '<b>Raid</b> hits the enemy\'s economy in an area, round their guns, and comes home when it turns costly.',
      '<b>Behaviours</b> in the panel: when they pull out for repairs, how they reload, how far they chase.',
      'New warbots fill groups under their target size, in batches; the rest stay in the <b>Reserve</b>. <kbd>Tab</kbd>: the command view.',
    ],
    mode: 'versus', seed: 7713, size: 1, rough: 1, rich: 3, biome: 'savanna', shape: 0, style: 'balanced',
    rival: ['easy', 'easy', 'medium'], passive: [true, true, true], limit: [0, 0, 0],
    setup(S) {
      kit(S, [...KIT8, 'armory'], 4); // (the colony so far, with Supply Lines' Ammo Plant)
      const L = getE(S.players[0].lander);
      L.stock.alloy += 12; L.stock.chip += 12; // (for a few more warbots)
      computeTerritory();
    },
    goals: [
      { kind: 'agroup', n: 1, text: 'Make an Army Group',
        count: (P, S) => (S.agroups || []).filter((g) => g.owner === 0).length,
        hint: 'Select warbots, then <b>Army group</b> on the selection bar → <b>New group from these</b>.',
        ui: '#sel-agroup, #ag-new-sel, #ar-agnew' },
      { kind: 'agpatrol', n: 1, text: 'Put a group on Patrol',
        count: (P, S) => ((S.agroups || []).some((g) => g.owner === 0 && g.ord.k === 'patrol') ? 1 : 0),
        hint: 'Right-click or hold its card → <b>Patrol</b> (<kbd>P</kbd>), tap 2 or 3 points, then <b>Done</b>.',
        ui: '#agcards .agcard, #ag-order-patrol, #banner-ok' },
      { kind: 'agraid', n: 1, text: 'Send a group on a Raid',
        count: (P, S) => ((S.agroups || []).some((g) => g.owner === 0 && g.ord.k === 'raid') ? 1 : 0),
        hint: 'In its panel <b>Raid</b> (<kbd>R</kbd>), then tap the rival\'s ground: its Haulers, mines, Depots and roads.',
        ui: '#agcards .agcard, #ag-order-raid' },
      { kind: 'agbeh', n: 1, text: 'Set a group\'s behaviour',
        count: (P, S) => ((S.agroups || []).some((g) => g.owner === 0 && g.beh && ['ret', 'rel', 'st'].some((k) => g.beh[k] !== AGROUP.beh[k])) ? 1 : 0),
        hint: 'In its panel set <b>Retreat when weak</b> to <b>50%</b>, or a <b>Stance</b>: Aggressive or Hold fire.',
        ui: '#ag-ret-50, #ag-st-agg, #ag-st-hold' },
      { kind: 'agjoin', n: [2, 2, 3], text: ['A new warbot joins a group', '{n} new warbots join a group'], at: 'foundry',
        count: (P) => P.stats.agJoined || 0,
        hint: 'Raise its <b>Target size</b> (<b>+</b>), then Bot Foundry → <b>Order bots</b>: Warbots <b>+1</b>.',
        ui: "#ag-size-up, #sh-orders .order-row[data-k='warbot'] [data-d='1']" },
    ],
  },
  {
    id: 'convoy', name: 'Convoy', chapter: 'War',
    brief: 'A Salvager raids every road it can reach. Keep your trade route running through it, and raid its convoys in turn.',
    intro: [
      'Your <b>Trade Terminal</b> is docked at a Trade Post. Set its route: a Road Train convoy every 2 minutes.',
      'Nothing shoots on a Trade Post\'s ground, so raids come out on the road. <b>Escort</b> sends two warbots along.',
      'The rival runs convoys too, dashed on the minimap. Warbots on a flag by it, out past its land, go for them.',
      'A wrecked convoy spills its cargo as crates. Your warbots carry them home.',
      'Their Command Base can\'t be taken here: raid the road. Their convoys keep to schedule and never turn back.',
    ],
    mode: 'versus', seed: 7711, size: 1, rough: 1, rich: 3, biome: 'desert', shape: 0, style: 'raider',
    // (Hard's clock: with the old kit (KIT7) the AI on your side, playing the hints' steps, won at 8:53 to 12:24, so 13
    // minutes left little to spare; five runs of a route every 2 minutes can't be done much before 9. With the Grove
    // Planter it's a harder war: see IDEAS, Convoy.)
    rival: ['easy', 'easy', 'medium', 'medium', 'medium'], limit: [0, 0, 0, 13, 16],
    // (Hard, now Commander: a Medium rival against the 13-minute clock; see IDEAS, Convoy. Warlord has its own values
    // since the balance audit of Nov 22 2026: by mPick it had a Normal rival, Commander's 13 minutes and 7 crates, and
    // the AI on your side with the hints' steps won none of three runs, mostly never wrecking a convoy; with the Medium
    // rival and 16 minutes it won 4 of 5, at 10:43 to 13:28. The goals stay half a step past Commander's.)
    // (The Salvager's convoys press on, convoysPress: out of a besieged Command Base, and past warbots in their way even
    // unescorted. Without it, besieging the rival before wrecking a convoy left the goal with nothing to wreck, and the
    // Easy rival's unescorted convoys turned back from every band on their lane.)
    pressOn: true,
    setup(S) {
      kit(S, [...KIT8, 'armory'], 4); // (the colony so far, with Supply Lines' Ammo Plant)
      const L = getE(S.players[0].lander), E = getE(S.players[1].lander);
      L.stock.stone += 60; L.stock.cement += 40; L.stock.alloy += 6;
      // Each side's Terminal docked at the Trade Post nearest it, a road out to it and a Road Train to serve it: the rival's
      // convoys run from the start, so there's something to raid.
      for (const [p, B] of [[0, L], [1, E]]) {
        const post = S.posts.slice().sort((a, c) => dist2(a.x, a.y, B.x, B.y) - dist2(c.x, c.y, B.x, B.y))[0];
        preBuild(p, 'terminal', post.x, post.y, { reach: 2, road: true });
        enterBuilding(addBot(p, 'roadtrain', B.x, B.y), B);
      }
      computeTerritory();
      E.stock.cement += 60;
    },
    goals: [
      { kind: 'convoys', n: 1, text: 'Wreck a rival trade convoy',
        count: (P, S) => S.players.reduce((n, Q) => n + (Q.id !== 0 && Q.stats.convoysLost ? Q.stats.convoysLost : 0), 0),
        // (First, so its hint shows from the start; it says to start the route first, which the runs need.)
        hint: '<b>Start route</b> at your Terminal first, then <b>Army</b> (<kbd>Q</kbd>) → <b>Hold ground</b> (<kbd>G</kbd>) by theirs, past their land.',
        ui: '#btn-attack, #ar-hold' },
      { kind: 'trades', n: [3, 4, 5], text: ['Make a trade run', 'Make {n} trade runs'], at: 'terminal',
        count: (P) => (P.trade && P.trade.sold) || 0,
        hint: 'Tap the Terminal → a <b>Send</b> good, a <b>Bring back</b> one → <b>Start route</b> (<kbd>G</kbd>).',
        ui: '#sh-tgive, #sh-tget, #sh-tgo' },
      { kind: 'escort', n: 1, text: 'Turn on Escort at the Terminal', at: 'terminal',
        count: (P, S) => (S.buildings.some((b) => !b.dead && b.owner === 0 && BDEFS[b.type].terminal && b.escort) ? 1 : 0),
        hint: 'Tap the Terminal → <b>Escort</b> (<kbd>O</kbd>): two warbots from the nearest garrison ride with each convoy.',
        ui: '#sh-escort' },
      { kind: 'looted', n: [3, 5, 6], text: 'Carry home {n} crates of loot',
        count: (P) => P.stats.looted || 0,
        hint: 'Warbots near crates carry them to a garrison. <b>Hold ground</b> (<kbd>G</kbd>) by a wreck to fetch them.',
        ui: '#btn-attack, #ar-hold' },
    ],
  },
  {
    id: 'siege', name: 'Siege Breakers', chapter: 'War',
    brief: 'A Warden (a turtle) hides behind Walls, turrets and a Bulwark picket. Break the shields, burn through with Torches and send in missiles.',
    intro: [
      'This rival is a <b>Warden</b> (a turtle): it has held its position for decades. Walls, turrets and Keeps first, then it grinds forward in big pushes.',
      '<b>Torches</b> burn through Walls and can <b>Scorch the earth</b>. Send them with a <b>Bulwark</b> and they can fire from behind its shield if the Wall is in reach.',
      'A <b>Missile Silo</b> reaches 22 tiles: build it toward them. Missiles wreck most buildings, but a Keep must be captured.',
      'Tap a rival building in range → <b>Fire missile</b> (<kbd>F</kbd>) works too.',
      'Its picket stands behind <b>Bulwark</b> shields: <b>Arc Casters</b> wear them down, <b>Skirmishers</b> run round, <b>Railgunners</b> shoot through. Their base can wait: this is about breaking in.',
    ],
    mode: 'versus', seed: 2323, size: 1, rough: 1, rich: 3, biome: 'volcanic', shape: 0, style: 'turtle',
    rival: ['easy', 'medium', 'normal'], limit: [0, 0, 45],
    setup(S, diff) {
      kit(S, [...KIT8, 'armory'], 4); // (the colony so far, with Supply Lines' Ammo Plant; the Bio Farm grows the Fuel that Torches and Missiles burn)
      const L = getE(S.players[0].lander);
      L.stock.alloy += 10; L.stock.chip += 4; L.stock.fuel += 10;
      siegeWorks(S, diff);
      // A picket out in front of its Wall: Bulwarks with warbots behind them, holding a flag (shields to break).
      const R = getE(S.players[1].lander), dx = L.x - R.x, dy = L.y - R.y, d = Math.hypot(dx, dy) || 1;
      // (14 tiles out, clear of its guns, or nearer if a Trade Post's no-fire ground would cover it)
      const at = (k) => [Math.round(R.x + (dx / d) * k), Math.round(R.y + (dy / d) * k)];
      let k0 = 14;
      while (k0 > 10 && [-3, 0, 3].some((o) => calmAt(at(k0)[0] + o + 0.5, at(k0)[1] + 0.5) || calmAt(at(k0)[0] + 0.5, at(k0)[1] + o + 0.5))) k0--;
      const [fx, fy] = at(k0);
      const flag = { id: S.nextId++, owner: 1, x: fx + 0.5, y: fy + 0.5 };
      S.rallies.push(flag);
      const pick = [...Array(mPick([1, 2, 2], diff)).fill('bulwark'), ...Array(mPick([2, 3, 4], diff)).fill('warbot')];
      pick.forEach((t, k) => { const u = addBot(1, t, fx - 1 + (k % 3), fy - 1 + Math.floor(k / 3)); u.task = { type: 'hold', rally: flag.id, slot: k }; });
      S.players[1].stats.startBots = S.players[1].stats.bots;
      // (No march or push of its own for the first quarter hour on Normal and Hard: since the doctrine retune of Nov 2026 a
      // Warden pushes once its army outgrows yours, and at ten minutes its push broke the siege before a shield went down.)
      if (diff > 0) S.players[1].nextAttack = 900;
    },
    goals: [
      { kind: 'army', n: [2, 3, 3], text: 'Build Torches and a Bulwark', at: 'foundry',
        // (Torches: one on Settler and Pioneer, two from Colonist up; and a Bulwark.)
        count: (P, S) => Math.min((P.madeBots && P.madeBots.torch) || 0, mPick([1, 2, 2], S.mission.diff)) + Math.min((P.madeBots && P.madeBots.bulwark) || 0, 1),
        hint: 'Tap the Bot Foundry → <b>Order bots</b>: Torches <b>+1</b>, Bulwarks <b>+1</b>. Torches burn Fuel: keep some.',
        ui: "#sh-orders .order-row[data-k='torch'] [data-d='1'], #sh-orders .order-row[data-k='bulwark'] [data-d='1']" },
      // The answers to a Bulwark: an Arc Caster's lightning wears its shield down three times as fast, a Skirmisher runs
      // round it, a Railgunner's slug goes through. (Shields its picket loses to anything count: S.players[1].stats.shieldsDown.)
      { kind: 'shields', n: [1, 2, 3], text: 'Break {n} Bulwark shields', at: 'foundry',
        count: (P, S) => (S.players[1].stats.shieldsDown || 0),
        hint: 'Arc Casters and Torches break shields: Foundry <b>+1</b> each, then <b>Army</b> (<kbd>Q</kbd>) → <b>Attack</b> the picket.',
        ui: "#sh-orders .order-row[data-k='arccaster'] [data-d='1'], #sh-orders .order-row[data-k='skirmisher'] [data-d='1'], #btn-attack, #ar-attack" },
      { kind: 'scorch', n: [2, 3, 4], text: 'Scorch {n} patches of their farmland',
        count: (P) => P.stats.scorchedFoe || 0, // (fertile soil a rival farms, or on its land, burned for good: see scorchSoil)
        hint: 'Tap a Torch (or <b>Army</b> → <b>Select all warbots</b>) → <b>Scorch the earth</b> (<kbd>X</kbd>): their farmland.',
        ui: '#sh-scorch, #sel-scorch, #btn-attack, #ar-select' },
      { kind: 'missiles', n: [2, 2, 3], text: 'Fire {n} missiles', at: 'silo',
        count: (P) => (P.used && P.used.warhead) || 0,
        hint: '<b>Make</b> (<kbd>2</kbd>) → <b>Missile Factory</b> (<kbd>N</kbd>), <b>Defend</b> (<kbd>4</kbd>) → <b>Missile Silo</b> (<kbd>I</kbd>) toward them. Silo → <b>Aim missile</b> (<kbd>F</kbd>).',
        ui: ".bcard[data-t='munitions'], .bcard[data-t='silo'], #sh-aim" },
      { kind: 'forts', n: [3, 4, 6], text: 'Take out {n} Walls or turrets',
        // (Their Walls, Gates, guns and Keeps taken out by any means, counted as they fall: `forts`, see fortTaken. Your
        // robots shooting, burning or capturing one count, and so does a missile, bomb, nuke or Howitzer shell that wrecks
        // one: "take out" reads as any means. The goals before this one see that the Torches and Bulwark get built and used.)
        count: (P) => P.stats.forts || 0,
        hint: '<b>Army</b> (<kbd>Q</kbd>) → <b>Attack</b> (<kbd>Q</kbd>): tap a Wall or turret. Lead with Bulwark and Torches. Missiles and bombs count.',
        ui: '#btn-attack, #ar-attack' },
    ],
  },
  // The Void Fleet (space expansion, phase 3: SHAPE_PRESETS vfleet), in War after Siege Breakers: a fleet action and a siege
  // in space. A Flagship (a Carrier's tender) and its deck, Line Ships, Gunships in its wing, shields, the Flagship's main
  // battery, a siege of the rival's Point-Defence from beyond its reach, and the Flagship victory, against a rival that only
  // defends itself.
  {
    id: 'voidfleet', name: 'The Void Fleet', chapter: 'War',
    brief: 'Out past the Ring your Carrier has sent down its tender, your Flagship. Build a fleet, break the rival station\'s guns, and bring its Flagship down.',
    intro: [
      '<b>Versus</b>: a rival colony holds the station at the far end. It only defends itself. Red is theirs, blue is yours.',
      'Your <b>Flagship</b> waits off your station. Tap it: its <b>Deck</b> builds Line Ships and Gunships from your stores. Its main battery fires back at enemy ships.',
      'A <b>Line Ship</b> fires broadsides out to 7 tiles, 8 at a building: further than Point-Defence reaches. Gunships fly as the Flagship\'s <b>wing</b>.',
      'Capital ships carry a blue <b>shield</b>: it takes every hit first, and recharges once nothing has hit it for 6 seconds.',
      'Destroy the rival Flagship and you win. Lose yours and you lose: alone it can\'t outfight a fleet, so keep escorts by it.',
    ],
    mode: 'versus', seed: 5521, size: 0, rough: 1, rich: 3, biome: 'lunar', players: 2, style: 'balanced', shape: SHAPE_PRESETS.findIndex((s) => s.vfleet),
    rival: ['easy', 'easy', 'medium'], passive: [true, true, true], limit: [0, 0, 30],
    setup(S, diff) {
      const out = kit(S, [...KIT6, 'launchpad'], 4);
      const L = getE(S.players[0].lander);
      L.stock.alloy += mPick([40, 32, 26], diff); L.stock.chip += mPick([24, 18, 14], diff); L.stock.fuel += 20; L.stock.cement += 10;
      if (out.launchpad) out.launchpad.stock.fuel = 8;
      spaceSetup(S.seed); vfSetup(); // (the drifting rocks, the derelicts and both Flagships: a Versus game's, laid out here)
      // A Point-Defence Turret on the rival's station, on the side toward you (the siege goal), stocked.
      const st = S.vf.st[1], F1 = flagshipOf(1);
      let best = null, bd = Infinity;
      for (let j = st.y0; j <= st.y1; j++) for (let i = st.x0; i <= st.x1; i++) {
        const t = tIdx(i, j);
        if (S.terrain[t] !== T_GROUND || S.bAt[t] || S.res[t] || S.road[t] || S.owner[t] !== 1) continue;
        const d = Math.abs(i + 0.5 - (F1 ? F1.x : S.W / 2)) + Math.abs(j - (st.y1 - 2));
        if (d < bd) { bd = d; best = [i, j]; }
      }
      if (best) { const pd = addBuilding(1, 'pdturret', best[0], best[1], true); pd.stock.ammo = 4; S.mission.vfPd = pd.id; }
    },
    goals: [
      { kind: 'lineship', text: 'Build a Line Ship on your Flagship\'s deck', count: (P, S) => S.bots.filter((u) => !u.dead && u.owner === 0 && u.type === 'line').length,
        focus: (S) => { const u = flagshipOf(0); return u ? { e: u, ui: "[data-fy='line'][data-d='1']" } : null; },
        hint: 'Tap your Flagship → <b>Deck</b>: Line Ships <b>+1</b>. Each round of parts comes up from your stores.',
        ui: "[data-fy='line'][data-d='1']" },
      { kind: 'wing', n: 2, text: 'Fly {n} Gunships in its wing', count: (P, S) => { const F = flagshipOf(0); return F ? wingCraft(F).length : 0; },
        focus: (S) => { const u = flagshipOf(0); return u ? { e: u, ui: "[data-fy='gunship'][data-d='1']" } : null; },
        hint: '<b>Deck</b>: Gunships <b>+1</b>, or a Launch Pad\'s. One not in it: <b>Join the Flagship\'s wing</b>.',
        ui: "[data-fy='gunship'][data-d='1'], #sh-sp-wing" },
      { kind: 'siege', text: 'Wreck the rival station\'s Point-Defence Turret', count: (P, S) => { const b = S.mission.vfPd ? getE(S.mission.vfPd) : null; return S.mission.vfPd && (!b || b.dead) ? 1 : 0; },
        focus: (S) => { const b = S.mission.vfPd ? getE(S.mission.vfPd) : null; return b && !b.dead ? { e: b, ui: '#cap-atk' } : null; },
        hint: 'Line Ship → <b>Attack: tap a target</b>, the turret: it shells it from beyond its reach.',
        ui: '#cap-atk' },
      { kind: 'flagkill', text: 'Destroy the rival Flagship', count: (P, S) => (S.winner === 0 && S.endHow === 'flagship' ? 1 : 0),
        hint: 'Its shield recharges after 6 s quiet and its battery fires back: send every Line Ship at once.',
        ui: '#cap-atk' },
    ],
  },
  {
    id: 'chain', name: 'Chain Reaction', chapter: 'War',
    brief: 'Green Uranium glows near your base. Enrich it, build a Nuclear Silo and launch.',
    intro: [
      'A <b>Nuclear race</b>: an Ore Mine beside green Uranium digs it first.',
      'A <b>Nuclear Reactor</b> enriches 2 Uranium into 1; a Nuclear Silo needs 6 for a missile.',
      'A nuclear missile wrecks almost everything round where it lands. A direct hit destroys an enemy Command Base.',
      'Its fallout lingers: a green ring of radiation for minutes, where robots sicken, work slows and nothing is built. A Reactor a rival destroys leaks too.',
      'If one ever comes for you, press <b>Evacuate</b> (<kbd>V</kbd>) on the warning card.',
      'This mission ends with your launch. In free play, Custom Game → Rules switches the race on or off.',
    ],
    mode: 'versus', seed: 9101, size: 0, rough: 1, rich: 3, biome: 'lunar', shape: 0, style: 'balanced', nuke: true,
    rival: ['easy', 'easy', 'normal'], passive: [true, true, false], limit: [0, 0, 20],
    layout(m, W) {
      const H = m.terrain.length / W, b = m.bases[0];
      mirrored(W, H, b.x + 6, b.y - 9, (x, y) => placeField(m, W, x, y, 1.6, R_URANIUM, 0.8, 11));
    },
    setup(S) {
      // (The colony's Ore Mine goes on Ore: the one by the Uranium is the player's to build.)
      S.mission.nuke = false;
      kit(S, KIT8, 4); // (with the Bio Farm: Fuel for the Fuel Station and a Generator)
      S.mission.nuke = true;
      const L = getE(S.players[0].lander);
      L.stock.alloy += 10; L.stock.chip += 6;
    },
    goals: [
      { kind: 'built', type: 'reactor', n: 1,
        hint: 'An <b>Ore Mine</b> (<kbd>B</kbd> <kbd>1</kbd> <kbd>R</kbd>) by the green Uranium, then <b>Make</b> (<kbd>2</kbd>) → <b>Nuclear Reactor</b> (<kbd>Y</kbd>).',
        ui: "#btn-build, .bcard[data-t='mine'], .bcard[data-t='reactor']" },
      { kind: 'made', good: 'fissile', n: 6,
        hint: 'The Reactor turns 2 Uranium into 1. A <b>Generator</b> (<b>Make</b> → <kbd>G</kbd>) beside it speeds it up.',
        ui: "#goods .res-chip[data-g='uranium'], #goods .res-chip[data-g='fissile']" },
      { kind: 'built', type: 'nukesilo', n: 1,
        hint: '<b>Build</b> → <b>Defend</b> (<kbd>4</kbd>) → <b>Nuclear Silo</b> (<kbd>N</kbd>). Then it builds the missile.',
        ui: "#btn-build, #build-tabs [data-g='defend'], .bcard[data-t='nukesilo']" },
      { kind: 'nukes', n: 1, text: 'Launch a nuclear missile', at: 'nukesilo',
        count: (P) => P.stats.nukes || 0,
        hint: 'Tap the Silo → <b>Aim nuclear missile</b> (<kbd>F</kbd>), tap a rival target, then <b>Launch</b>.',
        ui: '#sh-aim' },
    ],
  },
  {
    id: 'lance', name: 'Aimed the Other Way', chapter: 'War',
    brief: 'The archive\'s last pages hold an orbital defence, a city, a lift to the Carrier and a dish aimed home. Build them, and fire along their depots.',
    intro: [
      'A <b>Shield Dome</b> stops what falls on your base from outside: Missiles, bombs, shells, a nuke, one Lance shot. Turn it off to save Crystal, but it takes 30 seconds to come back up.',
      'It burns a Crystal every 20 seconds and needs a <b>Generator</b> with Fuel within 4 tiles.',
      'The <b>Lance of Corvane</b> fires a beam across the whole map. It needs 2 Generators with Fuel by its pit.',
      'It charges for 90 seconds, and everyone hears it. Everything on the line goes, yours too.',
      '<b>Arrival City</b>, built for colonists who never came: your work within 8 tiles of it goes 20% faster.',
      'The <b>Orbital Lift</b> calls robots or goods down from your Carrier, and sends your surplus up to restock it.',
      'The <b>Great Uplink</b> transmits home on 3 Generators. In free play, 8 minutes held wins; enemy warbots near it jam it.',
      'Their supply depots stand in a row. In free play, Custom Game switches Megastructures and the Great Uplink win.',
    ],
    mode: 'versus', seed: 6607, size: 1, rough: 0, rich: 3, biome: 'savanna', shape: 0, style: 'tycoon', mega: true, upWin: true,
    rival: ['easy', 'easy', 'normal'], passive: [true, true, false], limit: [0, 0, 35],
    setup(S) {
      kit(S, KIT8, 4);
      const L = getE(S.players[0].lander), E = getE(S.players[1].lander), P = S.players[0];
      L.stock.cement += 300; L.stock.alloy += 160; L.stock.chip += 85; L.stock.crystal += 75; L.stock.fuel += 44; L.stock.fiber = (L.stock.fiber || 0) + 30; // (with Arrival City's, and the Orbital Lift's and a load of Cement to send up)
      L.stock.cement += 60; L.stock.alloy += 48; L.stock.chip += 30; L.stock.crystal += 24; L.stock.fuel += 12; // (the Great Uplink's, and its three Generators')
      enterBuilding(addBot(0, 'tanker', L.x, L.y), L); // (the Generators' Fuel)
      // Their depots, strung out in a row from their base toward ours: one line of fire from by our base takes most of them.
      const dx = L.x - E.x, dy = L.y - E.y, d = Math.hypot(dx, dy) || 1;
      for (let k = 0; k < 7; k++) preBuild(1, 'depot', Math.round(E.x + dx / d * (3 + k * 2.2)), Math.round(E.y + dy / d * (3 + k * 2.2)), { reach: 1 });
      computeTerritory();
      // Room for Arrival City: an Outpost by the nearest open ground big enough for it (4 by 4 with a tile clear round it).
      const open = (i, j) => { for (let b = j - 1; b <= j + 4; b++) for (let a = i - 1; a <= i + 4; a++) { if (!inMap(a, b)) return false; const t = tIdx(a, b); if (S.terrain[t] !== T_GROUND || S.bAt[t] || S.res[t] || S.road[t] || S.ramp[t] || S.elev[t] !== S.elev[tIdx(i, j)]) return false; } return true; };
      let sq = null, sd = Infinity;
      for (let j = L.y - 16; j <= L.y + 16; j++) for (let i = L.x - 16; i <= L.x + 16; i++) { const dd = dist(i + 2, j + 2, L.x + 0.5, L.y + 0.5); if (dd >= 6 && dd < sd && open(i, j)) { sd = dd; sq = [i, j]; } }
      if (sq && !canPlace(0, 'city', sq[0], sq[1]).ok) {
        const ring = [];
        for (let j = sq[1] - 3; j <= sq[1] + 6; j++) for (let i = sq[0] - 3; i <= sq[0] + 6; i++) if (inMap(i, j) && (i < sq[0] - 1 || i > sq[0] + 4 || j < sq[1] - 1 || j > sq[1] + 4)) ring.push([dist(i, j, L.x, L.y), i, j]);
        ring.sort((a, b) => a[0] - b[0] || a[2] - b[2] || a[1] - b[1]);
        for (const [, i, j] of ring) if (canPlace(0, 'outpost', i, j).ok) { const o = addBuilding(0, 'outpost', i, j, true); for (const t of roadRouteTo(0, o) || []) setRoad(t % S.W, (t / S.W) | 0, true, 0); computeTerritory(); break; }
      }
      P.stats.startBots = P.stats.bots;
    },
    goals: [
      { kind: 'built', type: 'dome', n: 1,
        hint: '<b>Generator</b> (<kbd>B</kbd> <kbd>2</kbd> <kbd>G</kbd>) by your base, then <b>Mega</b> (<kbd>5</kbd>) → <b>Shield Dome</b> (<kbd>H</kbd>) beside it.',
        ui: "#btn-build, #build-tabs [data-g='mega'], .bcard[data-t='dome'], .bcard[data-t='generator']" },
      { kind: 'built', type: 'city', n: 1,
        hint: '<b>Mega</b> (<kbd>B</kbd> <kbd>5</kbd>) → <b>Arrival City</b> (<kbd>C</kbd>) by your factories: within 8 tiles they work 20% faster.',
        ui: "#btn-build, #build-tabs [data-g='mega'], .bcard[data-t='city']" },
      { kind: 'cityDrive', n: 3, text: 'Have {n} buildings working faster by Arrival City', at: 'city',
        count: (P, S) => cityDriven(S, 0),
        hint: 'Tap Arrival City to see its reach, then <b>Smelter</b> (<kbd>B</kbd> <kbd>2</kbd> <kbd>M</kbd>) or more inside it.',
        ui: "#btn-build, #build-tabs [data-g='make'], .bcard[data-t='smelter'], .bcard[data-t='fab']" },
      { kind: 'built', type: 'lift', n: 1,
        hint: '<b>Mega</b> (<kbd>B</kbd> <kbd>5</kbd>) → <b>Orbital Lift</b> (<kbd>O</kbd>); <kbd>R</kbd> turns its fall line. A Generator by it.',
        ui: "#btn-build, #build-tabs [data-g='mega'], .bcard[data-t='lift'], .bcard[data-t='generator']" },
      { kind: 'liftDrop', n: 1, text: 'Call a climber down from the Carrier', at: 'lift',
        count: (P) => P.stats.liftDrops || 0,
        hint: 'Tap the Lift → <b>Call down</b> a load (<kbd>Z</kbd> <kbd>X</kbd> <kbd>C</kbd> <kbd>V</kbd>). It lands in 45 seconds.',
        ui: '#sh-lf-security, #sh-lf-crew, #sh-lf-alloy, #sh-lf-chips' },
      { kind: 'liftUp', n: 1, text: 'Send a load of goods up to the Carrier', at: 'lift',
        count: (P) => P.stats.liftUps || 0,
        hint: 'On the Lift\'s panel, <b>Restock the Carrier</b>: tick <b>Cement</b>. At 30 goods the climber goes up.',
        ui: "#sh-lfadd [data-g='cement'], #sh-lflist" },
      { kind: 'built', type: 'gup', n: 1,
        hint: '<b>Mega</b> (<kbd>B</kbd> <kbd>5</kbd>) → <b>Great Uplink</b> (<kbd>U</kbd>), then 3 <b>Generators</b> by it.',
        ui: "#btn-build, #build-tabs [data-g='mega'], .bcard[data-t='gup'], .bcard[data-t='generator']" },
      { kind: 'gupTx', n: 1, text: 'Begin a transmission from the Great Uplink', at: 'gup',
        count: (P) => P.stats.gupTx || 0,
        hint: 'Tap the Great Uplink → <b>Begin transmission</b> (<kbd>T</kbd>). It needs 3 Generators with Fuel.',
        ui: '#sh-gup-begin' },
      { kind: 'built', type: 'lance', n: 1,
        hint: '<b>Mega</b> (<kbd>B</kbd> <kbd>5</kbd>) → <b>Lance of Corvane</b> (<kbd>L</kbd>), with 2 <b>Generators</b> within 4 tiles of its pit.',
        ui: "#btn-build, #build-tabs [data-g='mega'], .bcard[data-t='lance'], .bcard[data-t='generator']" },
      { kind: 'lanceFired', n: 1, text: 'Fire the Lance of Corvane', at: 'lance',
        count: (P) => P.stats.lance || 0,
        hint: 'Tap the Lance → <b>Aim the Lance</b> (<kbd>F</kbd>), tap a spot past their depots, then <b>Charge</b>.',
        ui: '#sh-aim' },
      { kind: 'lanceLine', n: [2, 3, 4], text: ['Destroy {n} rival building with one shot', 'Destroy {n} rival buildings with one shot'], at: 'lance',
        count: (P) => P.stats.lanceBest || 0,
        hint: '<b>Aim the Lance</b> (<kbd>F</kbd>) through their depots: red-ringed ones are wrecked, dashed ones only scorched. 4 min reload.',
        ui: '#sh-aim' },
    ],
  },
  // Landing Zone: a valley where the Pathfinder's garden has gone to dust. The Herald, its clock frozen at T-1 day, sees
  // the greening as overgrowth on its landing zone and sends Torches to burn it; the Murmur come up at night (Quiet).
  {
    id: 'landingzone', name: 'Landing Zone', chapter: 'War',
    brief: '"Arrival in one day. Clearing the landing zone." Bring the valley back to green and hold it, whatever the Herald burns.',
    intro: [
      'The valley was the Pathfinder\'s garden once. Build the <b>Atmosphere Engine</b> and bring it to the <b>Garden</b>, stage 4.',
      'The rival is a <b>Herald</b>: its clock stopped a day before Arrival. It sees your greening as overgrowth on its landing zone.',
      'Its <b>Torches</b> come to burn the green: burned soil never grows again. While the Engine has power its rain puts them out.',
      'So they go for its <b>Generators</b>: guard them. Its circle is yours: enemy robots wade through its mud. The Murmur come at night.',
      'Green enough of the valley\'s land (the goal says how much), then hold it for 5 minutes.',
    ],
    mode: 'versus', seed: 6011, size: 0, rough: 1, rich: 3, biome: 'savanna', shape: 0, players: 2, style: 'rusher', mega: true, murmur: 'quiet',
    rival: ['easy', 'easy', 'medium'], limit: [0, 0, 70],
    setup(S, diff) {
      kit(S, [...KIT8, 'armory'], 4);
      const P = S.players[0], L = getE(P.lander), P1 = S.players[1], E = getE(P1.lander);
      aeKit(L); L.stock.cement += 40; L.stock.alloy += 20; L.stock.chip += 10;
      enterBuilding(addBot(0, 'tanker', L.x, L.y), L);
      for (let k = 0; k < 6; k++) enterBuilding(addBot(0, 'warbot', L.x, L.y), L);
      L.stock.ammo = (L.stock.ammo || 0) + 40;
      P.stats.startBots = P.stats.bots;
      // The Herald's Torches, for the burning.
      for (let k = 0; k < mPick([2, 3, 4], diff); k++) enterBuilding(addBot(1, 'torch', E.x, E.y), E);
      P1.stats.startBots = P1.stats.bots;
      S.mission.greenWant = mPick([25, 32, 40], diff);
      // (room for the Engine on its land: the stone and groves round the Command Base cleared, their worth in the base)
      for (let j = L.y - 10; j <= L.y + 10; j++) for (let i = L.x - 10; i <= L.x + 10; i++) { if (!inMap(i, j)) continue; const t = tIdx(i, j); if ((S.res[t] === R_BOULDER || S.res[t] === R_STALK) && !S.bAt[t]) { S.res[t] = R_NONE; S.amt[t] = 0; markDirty(i, j); } }
      L.stock.stone = (L.stock.stone || 0) + 30; L.stock.fiber += 10;
    },
    goals: [
      AE_BUILT,
      aeStageGoal(4, 'Reach stage 4 of the Engine, the Garden', 'Keep both Generators fed: 28 minutes of power. At night, <b>Army</b> (<kbd>Q</kbd>) → <b>Hold ground</b> (<kbd>G</kbd>) by it.',
        '#btn-attack, #ar-hold'),
      { kind: 'greened', n: [25, 32, 40], text: 'Green {n}% of the valley\'s land', at: 'atmos', count: (P, S) => S.mission.greenPct || 0,
        hint: 'Stage 3 and 4 ground counts. Guard its Generators: <b>Pulse Turrets</b> (<kbd>B</kbd> <kbd>4</kbd> <kbd>T</kbd>) by them.',
        ui: "#btn-build, #build-tabs [data-g='defend'], .bcard[data-t='turret']" },
      { kind: 'greenHeld', n: 5, text: 'Hold it green for {n} minutes', count: (P, S) => Math.floor((S.mission.greenRun || 0) / 60),
        hint: 'Torches cut its power to stop the rain: <b>Army</b> (<kbd>Q</kbd>) → <b>Attack</b> (<kbd>Q</kbd>) any that come.',
        ui: '#btn-attack, #ar-attack' },
    ],
  },
  // Overcast: the Steward next door built its Atmosphere Engine first and has turned the weather on you (the Engine's
  // Storm Front, Nov 2026). Its storm sits over your Command Base from the start: break it (destroy their Engine, or build
  // your own: any Engine's circle is calm sky), hold the sky, and learn the Storm Front by sending one back.
  {
    id: 'overcast', name: 'Overcast', chapter: 'War',
    brief: '"Weather management, sector 4. Proceeding per schedule." The Steward has turned its Engine\'s rain on your colony. Break the storm.',
    intro: [
      'Your neighbour, a <b>Steward</b>, built its Atmosphere Engine first. Its <b>Storm Front</b> sits over your Command Base.',
      'Under it your robots crawl, your sites go up slowly and your guns fall short. From Green, crops wither; at the Garden, lightning.',
      'Break it: knock their Engine out, or build your own (Build, Mega, <kbd>N</kbd>). Any Engine\'s circle is calm sky: no storm gets in.',
      'Knocked out by warbots, it goes dark. Hold it with armed warbots for 40 seconds and it is yours, to bring back online.',
      'Then hold the sky. At stage 2, Rain, your Engine can send a storm back: not into their circle, but over the ground they cross.',
      'It was built to bring the rain to the fields. Nobody wrote down who would aim it.',
    ],
    mode: 'versus', seed: 4419, size: 1, rough: 1, rich: 3, biome: 'desert', shape: 0, players: 2, style: 'balanced', mega: true,
    rival: ['easy', 'medium', 'normal'], limit: [0, 0, 50],
    setup(S, diff) {
      kit(S, [...KIT8, 'armory'], 4);
      const P = S.players[0], L = getE(P.lander), P1 = S.players[1], E = getE(P1.lander);
      aeKit(L); L.stock.cement += 40; L.stock.alloy += 20; L.stock.chip += 10;
      enterBuilding(addBot(0, 'tanker', L.x, L.y), L);
      for (let k = 0; k < 8; k++) enterBuilding(addBot(0, 'warbot', L.x, L.y), L);
      L.stock.ammo = (L.stock.ammo || 0) + 40;
      P.stats.startBots = P.stats.bots;
      // The Steward's Engine on the far side of its Command Base, at Rain (Green from Colonist), its two Generators fed,
      // and its storm over your Command Base.
      const st = mPick([2, 3, 3], diff), eng = ocEngine(S, E, L, st);
      if (eng) { eng.aeStorm = [L.x, L.y]; eng.aeStormT = 0; }
      bump(E.stock, 'fuel', 30); enterBuilding(addBot(1, 'tanker', E.x, E.y), E); // (Fuel for its Generators)
      S.mission.stormCalm = 1;
      P1.stats.startBots = P1.stats.bots;
    },
    goals: [
      { kind: 'stormBroken', n: 1, text: 'Break the storm over your colony', count: (P, S) => (stormBrokenFor(0) ? 1 : 0),
        hint: 'Attack their Engine: <b>Army</b> (<kbd>Q</kbd>). Or build your own, <kbd>B</kbd> <kbd>5</kbd> <kbd>N</kbd>: its circle is calm.',
        ui: "#btn-attack, #btn-build, #build-tabs [data-g='mega'], .bcard[data-t='atmos']" },
      { kind: 'megaSeized', n: 1, text: 'Seize their Atmosphere Engine', count: (P) => P.stats.megaSeized || 0,
        hint: 'Knock it out, then hold it 40 s: <b>Army</b> (<kbd>Q</kbd>) → <b>Hold ground</b> (<kbd>G</kbd>) right beside it.',
        ui: '#btn-attack, #ar-hold' },
      { kind: 'skyHeld', n: [3, 4, 5], text: 'Hold the sky over your Command Base for {n} minutes', count: (P, S) => Math.floor((S.mission.calmRun || 0) / 60),
        hint: 'Keep their Engine down, or yours standing: <b>Army</b> (<kbd>Q</kbd>) → <b>Hold ground</b> (<kbd>G</kbd>) by it.',
        ui: '#btn-attack, #ar-hold' },
      { kind: 'stormSent', n: 1, text: 'Send a Storm Front of your own', at: 'atmos', count: (P) => P.stats.storms || 0,
        hint: 'At stage 2, Rain: tap your Engine → <b>Storm Front</b> (<kbd>F</kbd>), then a spot outside their calm circle.',
        ui: '#sh-storm' },
    ],
  },
  {
    id: 'hill', name: 'King of the Hill', chapter: 'War',
    brief: 'Three vanguards, three Uplinks: whoever holds them speaks for Ithaca I. Hold two of the three for longer than both rivals.',
    intro: [
      'The Pathfinder raised the <b>Uplinks</b> to talk to home. Under the Accord, whoever holds them speaks for Ithaca I.',
      'An Uplink is yours while it stands in your land: put an Outpost or a Keep beside it. Tap the Uplinks card at the top to look at each.',
      'They come online 8 minutes in. Then hold 2 of the 3, more than either rival, and your clock runs: 5 minutes in all wins.',
      'Armed warbots right beside an Uplink jam it: it counts for no one. Theirs can jam yours; yours can jam theirs.',
      'Two rivals, their doctrines dealt at random. Every vanguard wants to be holding the Uplinks if home ever answers.',
    ],
    mode: 'versus', seed: 30117, size: 2, rough: 1, rich: 3, biome: 'desert', shape: 17, players: 3, style: 'random',
    victory: 'uplinks', rival: ['easy', 'medium', 'normal'], limit: [0, 0, 35], // (Hard ones on Hard: a scripted player won none of five; Normal, one in three)
    setup(S) { kit(S, [...KIT8, 'armory'], 4); }, // (the colony so far, with the Ammo Plant)
    goals: [
      { kind: 'uplink', n: 1, text: 'Hold an Uplink', count: (P, S) => uplinksHeld(S),
        hint: '<b>Build</b> (<kbd>B</kbd>) → <b>Defend</b> (<kbd>4</kbd>) → <b>Outpost</b> (<kbd>O</kbd>) toward the nearest Uplink, and <b>Lay road</b>: its land takes it.',
        ui: "#btn-build, #build-tabs [data-g='defend'], .bcard[data-t='outpost'], #sh-layroad, #win-card" },
      { kind: 'uplinks', n: 2, text: 'Hold 2 Uplinks at once', count: (P, S) => uplinksHeld(S),
        hint: '<b>Outpost</b> (<kbd>B</kbd> <kbd>4</kbd> <kbd>O</kbd>) by the second Uplink. <b>Bunker</b> (<kbd>U</kbd>) by each one you hold to stop jamming.',
        ui: "#btn-build, #build-tabs [data-g='defend'], .bcard[data-t='outpost'], .bcard[data-t='bunker']" },
      { kind: 'race', n: 1, text: 'Win the Uplinks race', count: (P, S) => (S.winner === 0 && S.endHow === 'uplinks' ? 1 : 0),
        hint: 'Hold 2 of 3 for 5 min total. Check the card. <b>Army</b> (<kbd>Q</kbd>) → <b>Hold ground</b> (<kbd>G</kbd>) by a rival Uplink to jam it.',
        ui: '#btn-attack, #ar-hold, #win-card' },
    ],
  },
  {
    id: 'descent', name: 'Final Descent', chapter: 'War',
    brief: 'A maze of canyons and a seasoned rival. Use everything you have learned, and take to the air.',
    intro: [
      'The last landing: narrow canyons, long routes and a seasoned rival.',
      'A <b>Keep</b> houses 25 warbots (6 fire from it) and toughens Walls near it. <b>Vulcan Bombers</b> fly from an Airfield.',
      'If their bombers come, a siren sounds: <b>Flak Guns</b> fill the sky round what they guard.',
      'Then free play: Domination, Uplinks, free-for-alls of 3-4 colonies, 2 vs 2 teams and Multiplayer.',
      'Custom Game picks the map type, size, terrain, resources, biome and seed. Beaten rivals may surrender.',
    ],
    mode: 'versus', seed: 8803, size: 1, rough: 2, rich: 3, biome: 'polar', shape: 16, style: 'balanced',
    rival: ['easy', 'normal', 'normal'], rivalBonus: [0, 0, 4], limit: [0, 0, 60],
    setup(S) { kit(S, [...KIT8, 'armory'], 4); }, // (the colony so far, with Supply Lines' Ammo Plant: warbots and bombers run on Ammo)
    goals: [
      { kind: 'built', type: 'keep', n: 1,
        hint: '<b>Build</b> → <b>Defend</b> (<kbd>4</kbd>) → <b>Keep</b> (<kbd>K</kbd>): 6 warbots fire from it, and Walls near it get tougher.',
        ui: "#btn-build, #build-tabs [data-g='defend'], .bcard[data-t='keep']" },
      { kind: 'built', type: 'flak', n: [1, 2, 2],
        hint: '<b>Defend</b> → <b>Flak Gun</b> (<kbd>F</kbd>), by what their bombers would hit. It shoots only aircraft.',
        ui: "#btn-build, #build-tabs [data-g='defend'], .bcard[data-t='flak']" },
      { kind: 'bots', type: 'bomber', n: 1, at: 'airfield',
        hint: '<b>Move</b> (<kbd>3</kbd>) → <b>Airfield</b> (<kbd>I</kbd>). Tap it → <b>Hangar</b>: Vulcan Bombers <b>+1</b>.',
        ui: ".bcard[data-t='airfield'], #sh-yard .order-row[data-k='bomber'] [data-d='1']" },
      { kind: 'capture',
        hint: 'Tap their base → <b>Bomb it</b> (<kbd>Z</kbd>) to soften it. <b>Army</b> (<kbd>Q</kbd>) → <b>All</b> (<kbd>4</kbd>) → <b>Hold ground</b> (<kbd>G</kbd>) right beside it.',
        ui: '#sh-bomb, #btn-attack, #ar-nall, #ar-hold' },
    ],
  },
];

/** For the Uplinks goals: how many Uplinks player 0 holds right now (its land covers them, and none is jammed). */
function uplinksHeld(S) { return (S.uplinks || []).filter((u) => u.owner === 0 && !u.jam).length; }

function goalNeed(g, diff) { return mPick(g.n, diff) || 1; }

/** A building's name for `n` of them: "a Quarry", "2 Quarries", "2 Cement Works". */
function bldCount(type, n) {
  const name = BDEFS[type].name;
  if (n <= 1) return aOrAn(name);
  return `${n} ${/s$/.test(name) ? name : /[^aeiou]y$/.test(name) ? name.slice(0, -1) + 'ies' : name + 's'}`;
}

/**
 * A goal's objective text for `need` (shared by the mission screen and the game). A goal can give its own `text`
 * ("{n}" stands for the number), which every custom goal (one with a `count` function) does; [one, many] picks by
 * the number ("Clear a Murmur nest" / "Clear {n} Murmur nests").
 */
function goalLabel(g, need) {
  if (g.text) return String(Array.isArray(g.text) ? g.text[need > 1 ? 1 : 0] : g.text).replace(/\{n\}/g, need);
  switch (g.kind) {
    case 'built': return `Build ${bldCount(g.type, need)}`;
    case 'made': return `Make ${need} ${GOOD[g.good].name}${need !== 1 && (g.good === 'chip' || g.good === 'warhead') ? 's' : ''}`; // (Chips and Missiles count one by one)
    case 'bots': return g.type && need === 1 ? `Build ${aOrAn(BOTS[g.type].name)}` : `Build ${need} new ${g.type ? BOTS[g.type].plural : 'bots'}`;
    case 'own': return `Have ${need} ${BOTS[g.type].plural}`;
    case 'paths': return `${['', 'Lay', 'Surface'][g.tier]} ${need} ${['', 'road', 'asphalt road'][g.tier]} tiles`;
    case 'oneway': return `Make ${need} road tiles one-way`;
    case 'lights': return need > 1 ? `Put up ${need} traffic lights` : 'Put up a traffic light';
    case 'land': return `Claim ${need}% of the land`;
    case 'outposts': return need > 1 ? `Capture ${need} rival Outposts` : 'Capture a rival Outpost';
    case 'capture': return 'Capture the rival Command Base';
  }
  return '';
}

/** How far player 0 has got with goal g (see goalState); a custom goal counts with its own `count(P, S)`. */
function goalHave(g) {
  const P = S.players[0];
  if (g.count) return g.count(P, S) || 0;
  let have = 0;
  switch (g.kind) {
    case 'built': for (const b of S.buildings) if (!b.dead && b.owner === 0 && b.built && b.type === g.type) have++; break;
    case 'made': have = (P.made && P.made[g.good]) || 0; break;
    case 'bots': for (const k in P.madeBots || {}) if (!g.type || k === g.type) have += P.madeBots[k]; break;
    case 'own': for (const u of S.bots) if (!u.dead && u.owner === 0 && u.type === g.type) have++; break;
    case 'paths': for (let t = 0; t < S.W * S.H; t++) if (S.road[t] && wayOwner(t) === 0 && (S.pave[t] || 1) >= g.tier) have++; break;
    case 'oneway': for (let t = 0; t < S.W * S.H; t++) if (S.road[t] >= 2 && wayOwner(t) === 0) have++; break;
    case 'lights': for (const k in S.lights) if (S.lights[k].owner === 0) have++; break;
    case 'land': have = Math.floor(landShare(0) * 100); break;
    case 'outposts': have = P.stats.outposts || 0; break;
    case 'capture': have = S.winner === 0 ? 1 : 0; break;
  }
  return have;
}

/**
 * For the tutorial pointers: the sites of a `built` goal's type still going up when, once finished, they meet it (else
 * none). Meanwhile the goal waits for them, and the pointers say so instead of asking for another.
 */
function goalSites(g, diff) {
  // (Only for a building from the Build menu, its card in the goal's `ui`: not one that comes some other way, by air say.)
  if (g.kind !== 'built' || g.count || !new RegExp(`\\.bcard\\[data-t=['"]?${g.type}\\b`).test(g.ui || '')) return [];
  const sites = S.buildings.filter((b) => !b.dead && b.owner === 0 && !b.built && b.type === g.type);
  return sites.length && goalHave(g) + sites.length >= goalNeed(g, diff) ? sites : [];
}

/** A site with no road to storage and none being paved to it: its Lay road is still to do (see goalSites). */
function siteNeedsRoad(b) {
  if (b.unlinked !== true) return false;
  const r = roadRouteTo(0, b);
  return !(r && !r.length && r.pending);
}

/** Where a goal stands: { have, need, done, text }. (Counts of what stands now, like buildings, can drop again; the made and captured counts only grow.) */
function goalState(g, diff) {
  const need = goalNeed(g, diff), have = goalHave(g);
  return { have: Math.min(have, need), need, done: have >= need, text: goalLabel(g, need) };
}

/** The mission a game is playing (by its id, so a saved game finds it even if the campaign's order changes). */
function missionDef(M) { return (M && (MISSIONS.find((m) => m.id === M.id) || MISSIONS[M.k])) || null; }

/**
 * Every goal of the running mission, where it stands. A goal once met stays met (M.got), so one that can come
 * undone (a flag recalled, a building lost) still counts, unless the goal says `hold` (it must hold at the end).
 */
function missionStates(M) {
  const def = missionDef(M);
  if (!def) return [];
  M.got = M.got || [];
  return def.goals.map((g, i) => {
    const st = goalState(g, M.diff);
    if (st.done && !g.hold) M.got[i] = 1;
    else if (M.got[i] && !g.hold) { st.done = true; st.have = st.need; }
    return st;
  });
}

/**
 * The capture lock: taking the last rival's Command Base ends the game, which loses the mission if goals are still
 * open. So while any goal other than capturing it is unfinished, that base holds at 1 armor against player 0 (see
 * hitBuilding), and its panel says to finish the other goals first. Does rival base b, hit by player `by`, hold?
 */
function captureLocked(b, by) {
  const M = S.mission, def = missionDef(M);
  if (!def || M.result || by !== 0 || b.owner === 0 || b.type !== 'lander' || !S.players[b.owner] || S.players[b.owner].lander !== b.id) return false;
  // (With another rival still in, taking this one doesn't end the game: no lock.)
  if (S.players.some((P) => P.id !== 0 && P.id !== b.owner && !P.absent && !P.out && foes(P.id, 0))) return false;
  const states = missionStates(M);
  return def.goals.some((g, i) => g.kind !== 'capture' && !states[i].done);
}

/** Runs once a second while a mission is in play: success, or failure when the clock runs out. */
function checkMission() {
  const M = S.mission;
  if (!M || M.result) return;
  const states = missionStates(M);
  if (states.every((s) => s.done)) { M.result = 'won'; S.winner = 0; return; }
  if (M.limit && S.time >= M.limit) { M.result = 'lost'; M.why = 'time'; S.winner = 1; }
}

/** Settle the result when the game ends some other way (a Command Base captured). */
function finishMission() {
  const M = S.mission;
  if (!M || M.result) return;
  if (S.winner === 0 && missionStates(M).every((s) => s.done)) M.result = 'won';
  else { M.result = 'lost'; M.why = S.endHow === 'uplinks' && S.winner > 0 ? 'uplinks' : S.winner === 1 || S.players[0].out ? 'lander' : 'goals'; }
}

/** newGame options for mission k at level diff (an index into DIFF_ORDER: 0 Settler to 4 Warlord). */
function missionOptions(k, diff) {
  const def = MISSIONS[k];
  return {
    seed: def.seed, mode: def.mode, size: def.size, rough: def.rough, rich: def.rich, biome: def.biome,
    difficulty: def.rival ? mPick(def.rival, diff) : 'normal',
    // (A map shape, more players, the rival's doctrine and a Nuclear race, for the missions that teach them.)
    shape: def.shape || 0, players: def.players, style: def.style, nuke: !!def.nuke, events: !!def.events, drizzle: !!def.drizzle, mega: !!def.mega, upWin: !!def.upWin,
    layout: def.layout,
    setup(S) {
      // Settler starts with more in the Command Base, Commander and Warlord with less.
      const L = getE(S.players[0].lander);
      const k2 = [1.5, 1.25, 1, 0.75, 0.6][diff];
      for (const g in L.stock) L.stock[g] = Math.round(L.stock[g] * k2);
      if (def.rivalBonus && !S.players[1].absent) {
        const R2 = getE(S.players[1].lander);
        for (const g in R2.stock) R2.stock[g] += mPick(def.rivalBonus, diff);
      }
      // What this mission switches on that missions otherwise leave out (see nukeOn, warOn, labOn, updateEvents).
      S.mission = { k, id: def.id, diff, lv5: 1, limit: mLimit(def, diff) * 60, nuke: !!def.nuke, war: !!def.war, lab: !!def.lab, events: !!def.events, drizzle: !!def.drizzle, mega: !!def.mega, pressOn: !!def.pressOn, bold: !!def.bold };
      // The Murmur, only where the mission asks (its murmur: 'quiet' or 'active'; the older wildlife flag is Active). None on the moon.
      if (def.murmur || def.wildlife) murmurStart(def.murmur || 'active');
      // (A way to win other than capture: newGame sets one only outside missions. The Uplinks go where free play puts them.)
      if (def.victory && S.mode === 'versus') { S.victory = def.victory; if (def.victory === 'uplinks') placeUplinks(S.seed); }
      // (A rival that never attacks, at the levels the mission says: passive [Settler, Colonist, Commander].)
      if (def.passive && mPick(def.passive, diff)) for (const P of S.players) if (P.id !== 0) P.passive = true;
      if (def.setup) def.setup(S, diff);
    },
  };
}

/* --- campaign progress --- */

/** The campaign: which missions are finished at which difficulty. Every mission is open. */
function loadCampaign() {
  try {
    const c = JSON.parse(localStorage.getItem(CAMPAIGN_KEY) || '{}');
    const done = c.done && typeof c.done === 'object' ? c.done : {};
    // (Progress from the three old levels: Easy, Normal and Hard ticks move to Settler, Colonist and Commander.)
    if (c.lv !== 5) {
      for (const id in done) {
        const old = Array.isArray(done[id]) ? done[id] : [], now = [false, false, false, false, false];
        old.forEach((v, d) => { if (v && MISSION_OLD_DIFF[d] != null) now[MISSION_OLD_DIFF[d]] = true; });
        done[id] = now;
      }
      saveCampaign({ lv: 5, unlocked: MISSIONS.length - 1, done });
    }
    return { lv: 5, unlocked: MISSIONS.length - 1, done };
  } catch (e) { return { lv: 5, unlocked: MISSIONS.length - 1, done: {} }; }
}

function saveCampaign(c) {
  try { localStorage.setItem(CAMPAIGN_KEY, JSON.stringify(c)); } catch (e) { /* storage unavailable */ }
}

/** Record a finished mission; returns the campaign progress. */
function completeMission(k, diff) {
  const c = loadCampaign();
  const id = MISSIONS[k].id;
  c.done[id] = c.done[id] || [false, false, false, false, false];
  c.done[id][diff] = true;
  saveCampaign(c);
  return c;
}


'use strict';
/*
 * Terrafall — rival AI. It plays by the same rules as the player: it places construction sites
 * from a build plan, picks good spots, balances worker/warbot production and attacks once it
 * has gathered enough warbots near a target.
 */

/** [good, pause at, resume below]: producers the AI rests when it has plenty. */
const AI_CAPS = { fab: ['chip', 8, 3], armory: ['ammo', 18, 6], refinery: ['fuel', 30, 10] };
/**
 * [building type, how many the AI wants]. Entries are tried in order. (No Missile Factory or Silo here: those
 * come only through aiMissilePlan, which waits for an economy and an army and saves up for them. As ordinary
 * entries they went up as soon as the goods happened to be there, a Hard rival's four minutes in.)
 */
const AI_PLAN = [
  ['charger', 1], ['harvester', 1], ['quarry', 1], ['kiln', 1], ['harvester', 2], ['mine', 1], ['tap', 1], ['smelter', 1],
  ['fab', 1], ['foundry', 1], ['outpost', 1], ['armory', 1], ['farm', 1], ['quarry', 2], ['grower', 1], ['mine', 2],
  ['smelter', 2], ['kiln', 2],
  ['turret', 1], ['repair', 1], ['outpost', 2], ['tap', 2], ['pump', 1], ['refinery', 1], ['harvester', 3], ['outpost', 3], ['generator', 1],
  ['depot', 1], ['charger', 2], ['farm', 2], ['mine', 3], ['outpost', 4], ['turret', 2], ['bunker', 1],
  ['grower', 2], ['fab', 2], ['outpost', 5], ['mortar', 1], ['disruptor', 1], ['armory', 2], ['quarry', 3], ['outpost', 6], ['bunker', 2], ['charger', 3], ['pump', 2],
  ['tap', 3], ['farm', 3], ['generator', 2], ['outpost', 8], ['turret', 3], ['mortar', 2], ['bunker', 3],
];

/** The build plan's opening, up to the first Bot Foundry: what a colony with one site at a time builds first (see aiThink). */
const AI_OPENING = AI_PLAN.slice(0, AI_PLAN.findIndex(([t]) => t === 'foundry') + 1), AI_EASY_OPENING = 360;

/** The buildings that make new bots between them (and what they run on), and the ones a colony down to a handful of
 * workers keeps running come what may (see the triage in aiThink). */
const AI_CHAIN = ['harvester', 'quarry', 'kiln', 'mine', 'tap', 'smelter', 'fab', 'foundry'];
const AI_CORE = ['mine', 'smelter', 'fab', 'foundry'];
/**
 * Fewer workers than AI_FEW is an emergency (triage); it's over once there are as many as its buildings want and two
 * to spare, AI_ENOUGH at least and AI_PLENTY at most. (The chain alone takes eight and two are kept free to build: out
 * of triage at eight, with thirty buildings, the workers sat in the Smelter, the Chip Fab and the Quarries, two kept
 * free, while no Harvester had one, and the colony stood still for want of Fiber.)
 */
const AI_FEW = 8, AI_ENOUGH = 10, AI_PLENTY = 16;
/** Room kept under the bot limit for the army it wants (a share of the limit at most), and for workers past that. */
const AI_ARMY_ROOM = 0.4, AI_WORKER_ROOM = 6;
/**
 * Scrapping extras (see aiScrap): robots it has more of than it uses go to its Bot Foundry to be recycled, at most
 * `batch` on their way at once, and only ones with nothing to do (none carrying goods, running a building or building).
 * More than it uses: Workers past the ones its buildings call for and `workers` more, Haulers past the ones it wants and
 * `haulers` more (`minHaulers` at least), Tankers past the ones it wants and one more, Freight Trucks and Road Trains
 * past the ones it wants, Agribots and Pavers past the ones its buildings (sites too) take and one more; and of the
 * vehicles and crews only ones idle for a while. It scraps them:
 * - too many: with less room under the bot limit than the army it wants (vehicles and crews idle `idle` seconds);
 * - in a crisis: no Alloy or no Chips for `crisis` seconds (P.dry) with next to none being made, the ones that give back
 *   what it lacks (only vehicles give Chips back; vehicles and crews idle `crisisIdle` seconds);
 * - when it makes economic sense (not Easy): its Bot Foundry waits for parts that a vehicle, crew or Hauler idle for
 *   `eco` seconds gives back, one at a time, at most one every `ecoGap` seconds.
 * A kind scrapped isn't ordered again for `hold` seconds (P.scrapT).
 */
const AI_SCRAP = { workers: 4, haulers: 2, minHaulers: 4, batch: 4, idle: 120, crisis: 90, crisisIdle: 60, eco: 300, ecoGap: 60, hold: 300 };
/** The robots it may scrap, vehicles first (they give Chips back too); never the army, planes, ships, trains or Crawlers. */
const AI_SCRAP_KINDS = ['roadtrain', 'truck', 'tanker', 'agribot', 'paver', 'worker', 'hauler'];
/**
 * Crystal: every robot takes a Chip, and every Chip a Crystal. It counts as running short once what's left (in stock and
 * in the ground on its land) would last under AI_CRYSTAL_MINS minutes at the rate it's used (AI_CRYSTAL_BURN a minute at
 * least, once there's a Foundry); a colony short of it docks a Trade Terminal from AI_CRYSTAL_TRADE_AT seconds, and one
 * whose Crystal runs low puts up Crystal Taps first, up to AI_CRYSTAL_TAPS. Short of it, its Outposts head for Crystal
 * no-one holds within AI_CRYSTAL_REACH tiles of its forts. Its Smelters rest while its Crystal runs low with
 * AI_ALLOY_PILE Alloy in stock (until it's down to half that). A contract that has sold no lot for AI_TRADE_STALL
 * seconds is dropped for another.
 */
const AI_CRYSTAL_MINS = 10, AI_CRYSTAL_BURN = 4, AI_CRYSTAL_TRADE_AT = 600, AI_CRYSTAL_TAPS = 4, AI_CRYSTAL_REACH = 20;
const AI_ALLOY_PILE = 40, AI_TRADE_STALL = 300;
/**
 * Fuel with no source: low (P.fuelLow) for AI_FUEL_DRY s with no Bio Farm that has soil and no Refinery with oil
 * (aiFuelSource), it's dry (P.fuelDry): at its Trade Terminal it takes the steep Fuel contract, and dry for
 * AI_FUEL_TRADE s (from AI_CRYSTAL_TRADE_AT on) it docks one for it.
 */
const AI_FUEL_DRY = 60, AI_FUEL_TRADE = 180;
/**
 * Bio Farms go by the patch: a farm works about AI_FARM_TILES fertile tiles (its Agribot keeps up with no more), so
 * each farm of ours claims its nearest AI_FARM_TILES in reach, and a new one counts only the tiles none has claimed;
 * a site with fewer than AI_FARM_MIN of them isn't worth a farm (see aiFarmClaims).
 */
const AI_FARM_TILES = 5, AI_FARM_MIN = 3;

/** Rival p's doctrine (PERSONALITIES; the code says personality and style). */
function aiStyle(p) { return PERSONALITIES[S.players[p].style] || PERSONALITIES.balanced; }
/** Player q's army: its warbots, Bulwarks and Torches (none for no player). */
function aiArmyOf(q) { let n = 0; if (q >= 0) for (const u of S.bots) if (!u.dead && u.owner === q && isArmy(u)) n++; return n; }

/**
 * Rival p's difficulty settings with its doctrine applied (later or earlier attacks, bigger or smaller). The attack
 * threshold stays between 3 and AI_THRESHOLD_MAX: an Easy Warden's came to 11 (22 warbots to march), more than its army
 * ever grew to.
 */
const AI_THRESHOLD_MAX = 9;
function aiLevel(p) {
  const base = DIFFICULTY[S.difficulty], st = aiStyle(p);
  return { ...base, grace: base.grace * (st.grace || 1), threshold: clamp(Math.round(base.threshold * (st.threshold || 1)), 3, AI_THRESHOLD_MAX) };
}

/**
 * How each doctrine fortifies (in a war): `turrets` Pulse Turrets at most, one more every `every` seconds after
 * the first; `front` Minigun Nests and Bunkers put up at the front (by the fort nearest the rival) without waiting
 * to be attacked there, one every six minutes from about ten minutes in; and the chance (`walls`, decided once a
 * game) that it walls off the side of its base facing the rival (see aiFortWalls; a Turtle rings it all round,
 * see aiTurtleWalls). An easy rival builds half as much, and walls half as often.
 */
const AI_FORT = {
  balanced: { turrets: 3, every: 420, front: 2, walls: 0.5 },
  tycoon: { turrets: 4, every: 360, front: 2, walls: 0.6 },
  raider: { turrets: 2, every: 540, front: 1, walls: 0.2 },
  rusher: { turrets: 2, every: 600, front: 1, walls: 0.15 },
  turtle: { turrets: 6, every: 240, front: 3, walls: 1 },
};
function aiFort(p) {
  const F = AI_FORT[S.players[p].style] || AI_FORT.balanced;
  return S.difficulty === 'easy' ? { turrets: Math.ceil(F.turrets / 2), every: F.every * 1.5, front: Math.ceil(F.front / 2), walls: F.walls / 2 } : F;
}

/**
 * A rival that isn't a Turtle may wall off the side of its base that faces the rival (aiFort's `walls` chance,
 * decided once a game): from nine minutes in, an arc of Wall seven tiles out from its Command Base, about 50°
 * either side of the way to the rival's, with a Gate where a road crosses, two pieces every half minute while
 * Cement allows, up to 16 pieces. Its ends are open, so its own robots go round.
 */
function aiFortWalls(p) {
  if (aiStyle(p).walls || !warOn() || S.mode === 'colony' || S.time < 540) return;
  const P = S.players[p];
  if (P.fortWalls === undefined) P.fortWalls = hash2(S.seed % 100000, p + 1, 77) < aiFort(p).walls;
  if (!P.fortWalls || S.time - (P.fwT || 0) < 30) return;
  P.fwT = S.time;
  const L = getE(P.lander), R0 = S.players[rivalOf(p)], F = R0 && getE(R0.lander);
  if (!L || L.owner !== p || !F || spendable(p).cement < 40) return;
  let have = 0;
  for (const b of S.buildings) if (!b.dead && b.owner === p && BDEFS[b.type].barrier) have++;
  if (have >= 16) return;
  const R = 7, fa = datan2(F.y - L.y, F.x - L.x), ring = [];
  for (let d = -R; d <= R; d++) ring.push([L.x + d, L.y - R], [L.x + d, L.y + R], [L.x - R, L.y + d], [L.x + R, L.y + d]);
  const off = ([i, j]) => Math.abs(wrapAngle(datan2(j - L.y, i - L.x) - fa));
  ring.sort((a, c) => off(a) - off(c));
  let placed = 0;
  for (const [i, j] of ring) {
    if (placed >= 2 || have + placed >= 16 || off([i, j]) > 0.9) break;
    if (!inMap(i, j)) continue;
    const t = tIdx(i, j);
    if (S.bAt[t] || S.owner[t] !== p || S.terrain[t] !== T_GROUND || S.res[t]) continue;
    const kind = S.road[t] || S.plan[t] ? 'gate' : 'wall';
    if (canPlace(p, kind, i, j).ok) { placeSite(p, kind, i, j); placed++; }
  }
}

/**
 * A Turtle walls its base in: a square ring six tiles out from its Command Base, a Wall on each
 * free tile and a Gate where a road crosses, a few pieces at a time while Cement allows.
 */
function aiTurtleWalls(p) {
  if (!aiStyle(p).walls || !warOn() || S.time < 360) return;
  const P = S.players[p];
  if (S.time - (P.wallT || 0) < 20) return;
  P.wallT = S.time;
  const L = getE(P.lander);
  if (!L || L.owner !== p || spendable(p).cement < 30) return;
  const R = 6;
  let placed = 0;
  for (let d = -R; d <= R && placed < 3; d++) {
    for (const [i, j] of [[L.x + d, L.y - R], [L.x + d, L.y + R], [L.x - R, L.y + d], [L.x + R, L.y + d]]) {
      if (placed >= 3 || !inMap(i, j)) continue;
      const t = tIdx(i, j);
      if (S.bAt[t] || S.owner[t] !== p || S.terrain[t] !== T_GROUND) continue;
      const kind = S.road[t] || S.plan[t] ? 'gate' : 'wall';
      if (canPlace(p, kind, i, j).ok) { placeSite(p, kind, i, j); placed++; }
    }
  }
}

/**
 * A factory, gatherer or Fuel Station an enemy gun has covered for over a minute: out of action (no robot goes near
 * it), so the build plan doesn't count it and puts up another out of the gun's reach (aiFindSpot keeps clear of guns).
 * Without this, a turret over the only Chip Fab or Fuel Station left the colony unable to make the warbots to clear it.
 */
function aiShut(b) {
  return b.built && !!b.underFire && S.time - b.underFire > 60 && !BDEFS[b.type].mil && (!!BDEFS[b.type].staff || b.type === 'charger');
}

/**
 * Has gatherer b anything left to gather: a node in its reach, on its ground, with something in it, on no rival's land
 * and out of enemy guns' reach (what its worker can go to: see findNode)? A Tap whose last Crystal lies just across the
 * border still counts it in gatherReach, and its worker stands there saying none is left in reach. With n: at least n
 * such nodes. A stalk grove counts only once it's ripe (findNode skips one still growing).
 */
function aiGathers(b, n = 1) {
  const def = BDEFS[b.type], r = def.radius, r2 = r * r + 0.3, zone = S.zone[tIdx(b.x, b.y)], types = gatherTypes(b.type);
  if (!b.built || aiShut(b)) return false;
  for (let j = Math.max(0, b.y - r); j <= Math.min(S.H - 1, b.y + r); j++) {
    for (let i = Math.max(0, b.x - r); i <= Math.min(S.W - 1, b.x + r); i++) {
      const t = j * S.W + i;
      if (!types.includes(S.res[t]) || !S.amt[t] || S.zone[t] !== zone || dist2(i, j, b.x, b.y) > r2 || (S.res[t] === R_STALK && S.grow[t] < 1)) continue;
      if ((S.owner[t] < 0 || S.owner[t] === b.owner) && !hotFor(b.owner, t) && --n <= 0) return true;
    }
  }
  return false;
}

/**
 * What a gatherer at (i, j) could really work, for picking its spot: nodes of `type` in reach and in the same walkable
 * area, on p's own or no-one's land, out of enemy guns' reach; a stalk grove still growing counts half (it will be
 * ripe soon), and one on a rival's land not at all. (reachableRes counted the other colony's groves across the border,
 * and its new Harvester went up beside them, cutting next to nothing.)
 */
function aiUsableRes(p, i0, j0, radius, type) {
  const r2 = radius * radius + 0.3, zone = S.zone[tIdx(i0, j0)];
  let n = 0;
  for (let j = Math.max(0, j0 - radius); j <= Math.min(S.H - 1, j0 + radius); j++) {
    for (let i = Math.max(0, i0 - radius); i <= Math.min(S.W - 1, i0 + radius); i++) {
      const t = j * S.W + i;
      if (S.res[t] !== type || S.zone[t] !== zone || dist2(i, j, i0, j0) > r2) continue;
      if ((S.owner[t] >= 0 && S.owner[t] !== p) || hotFor(p, t)) continue;
      n += type === R_STALK && S.grow[t] < 1 ? 0.5 : 1;
    }
  }
  return n;
}

/** Did rival P scrap robots of `kind` in the last AI_SCRAP.hold seconds? Then its Foundry doesn't order that kind yet. */
function aiScrapHeld(P, kind) { return !!(P.scrapT && S.time - (P.scrapT[kind] ?? -1e9) < AI_SCRAP.hold); }

/** Has robot u something to do (a job, a load aboard, taking cover)? Going home, charging, filling up or being mended isn't. */
function aiBusy(u) {
  const tt = u.task && u.task.type;
  return !!(tt && tt !== 'home' && tt !== 'charge' && tt !== 'refuel' && tt !== 'repair') || !!u.carry || cargoCount(u) > 0;
}

/**
 * Rival p sends robots it has more of than it uses to its Bot Foundry to be recycled (see AI_SCRAP). c: { me (its
 * buildings), few (triage), smart (not Easy), room (the room under the bot limit it lacks for the army it wants), use
 * (how many of each kind it uses: what its Foundry orders them for) }. It keeps u.idleSince on its robots of the kinds
 * it may scrap: since when each has had nothing to do (gone when it's busy).
 */
function aiScrap(p, c) {
  const P = S.players[p];
  let away = 0;
  for (const u of S.bots) {
    if (u.dead || u.owner !== p) continue;
    if (recycling(u)) { away++; continue; }
    if (!AI_SCRAP_KINDS.includes(u.type)) continue;
    if (aiBusy(u)) delete u.idleSince;
    else if (u.idleSince === undefined) u.idleSince = S.time;
  }
  if (away >= AI_SCRAP.batch) return;
  const foundries = c.me.filter((b) => b.built && BDEFS[b.type].bots);
  if (!foundries.length) return;
  const U = c.use, keep = {
    worker: U.worker + AI_SCRAP.workers, hauler: Math.max(AI_SCRAP.minHaulers, U.hauler + AI_SCRAP.haulers), tanker: U.tanker + 1,
    truck: U.truck, roadtrain: U.roadtrain, agribot: (U.agribot || 0) + 1, paver: (U.paver || 0) + 1,
  };
  let sent = 0;
  // Up to `max` robots past `keep`, idle `idleFor` seconds at least (Workers and Haulers: `plainIdle`), of the kinds that
  // give back `gives` (any: null), each to the nearest Foundry it can get to; the vehicles first, then the longest idle.
  const send = (max, idleFor, plainIdle, gives, kinds) => {
    if (max <= 0) return 0;
    const have = {}, list = [];
    for (const u of S.bots) {
      if (u.dead || u.owner !== p || !(u.type in keep) || recycling(u)) continue;
      have[u.type] = (have[u.type] || 0) + 1;
      if ((kinds && !kinds.includes(u.type)) || (gives && !(recycleYield(u.type)[gives] > 0))) continue;
      if (u.idleSince === undefined || aiBusy(u) || u.shyUntil > S.time || !recyclable(u)) continue;
      if (S.time - u.idleSince < (u.type === 'worker' || u.type === 'hauler' ? plainIdle : idleFor)) continue;
      list.push(u);
    }
    list.sort((a, b) => AI_SCRAP_KINDS.indexOf(a.type) - AI_SCRAP_KINDS.indexOf(b.type) || a.idleSince - b.idleSince || a.id - b.id);
    let n = 0;
    for (const u of list) {
      if (n >= max) break;
      if (have[u.type] <= keep[u.type]) continue;
      const f = recycleFoundry(u);
      if (!f) continue;
      startRecycle(u, f);
      have[u.type]--; n++;
      (P.scrapT = P.scrapT || {})[u.type] = S.time;
    }
    sent += n;
    return n;
  };
  // Crisis: no Alloy or no Chips for a while (P.dry: none on hand while the Foundry or a site waits for it), with next to
  // none being made: the robots that give back what it lacks (only vehicles give Chips back).
  const goods = playerGoods(p), rates = goodRates(p);
  const dryFor = (g) => { const r = P.dry && P.dry[g]; return r && S.time - r[1] <= 4 ? S.time - r[0] : 0; };
  const lacks = (g) => dryFor(g) >= AI_SCRAP.crisis && rates[g].made < 1 && (goods[g] || 0) < 1;
  const lackChip = lacks('chip');
  if (lackChip || lacks('alloy')) send(AI_SCRAP.batch - away, AI_SCRAP.crisisIdle, 0, lackChip ? 'chip' : null, c.few ? AI_SCRAP_KINDS.filter((k) => k !== 'worker') : null);
  // Too many: no room under the bot limit for the army it wants.
  if (!c.few && c.room > 0) send(Math.min(AI_SCRAP.batch - away, c.room - away) - sent, AI_SCRAP.idle, 0, null, null);
  // Economic sense (not Easy): the Foundry waits for parts that a robot idle for minutes would give back. One at a time.
  if (c.smart && !c.few && !away && !sent && S.time - (P.scrapEco ?? -1e9) >= AI_SCRAP.ecoGap) {
    const waits = (g) => foundries.some((f) => f.status && f.status.startsWith('Waiting for ' + GOOD[g].name));
    const gives = waits('chip') ? 'chip' : waits('alloy') ? 'alloy' : null;
    if (gives && send(1, AI_SCRAP.eco, AI_SCRAP.eco, gives, AI_SCRAP_KINDS.filter((k) => k !== 'worker'))) P.scrapEco = S.time;
  }
}

function aiThink(p) {
  const P = S.players[p];
  const lvl = aiLevel(p), st = aiStyle(p);
  // An Easy rival keeps to the plain rules: the ones marked `smart` below are for Medium, Normal and Hard.
  const smart = S.difficulty !== 'easy';
  let me = playerBuildings(p);
  const lander = getE(P.lander);
  if (!lander || lander.owner !== p) return;
  aiArmorTrains(p);
  // Triage: down to a handful of workers (a raid got the rest), the colony does one thing only, make more. Nothing
  // new is started but a missing link of the chain that makes bots (AI_CHAIN), the other open sites are called off
  // (dispatch keeps two workers free for building while any site stands, which left no one to run the Foundry),
  // every building rests but the ones that make bots, and the Foundry builds workers alone, until there are enough.
  let nWorkers = 0;
  for (const u of S.bots) if (!u.dead && u.owner === p && u.type === 'worker') nWorkers++;
  const wantStaff = me.reduce((n, b) => n + (b.built && BDEFS[b.type].staff && !BDEFS[b.type].crew ? 1 : 0), 0);
  const few = S.mode !== 'colony' && S.time > 60 && nWorkers < (P.triage ? clamp(wantStaff + MIN_FREE_WORKERS, AI_ENOUGH, AI_PLENTY) : AI_FEW);
  if (few) for (const b of me) if (!b.built && !BDEFS[b.type].prepaid && !AI_CHAIN.includes(b.type)) demolish(b);
  if (few) me = me.filter((b) => !b.dead);

  // 1) Construction
  const counts = {};
  let sites = 0;
  for (const b of me) {
    if (!aiShut(b)) counts[b.type] = (counts[b.type] || 0) + 1;
    if (!b.built && !BDEFS[b.type].prepaid) sites++;
  }
  const maxSites = p === 0 && P.ai ? 2 : lvl.maxSites;
  if (!few) {
    aiWalls(p);
    aiTurtleWalls(p);
    aiFortWalls(p);
    aiBridge(p, maxSites);
  }
  // Warbots can't fight without Ammo: in a war, once the opening is done, an Ammo Plant comes
  // first, its site is never given up, and the Foundry rests so the Alloy reaches it.
  const needArmory = warOn() && S.time > 150 && !me.some((b) => b.type === 'armory' && b.built);
  let workers = 0, staffed = 0;
  const kinds = {};
  for (const u of S.bots) if (!u.dead && u.owner === p) kinds[u.type] = (kinds[u.type] || 0) + 1;
  workers = kinds.worker || 0;
  for (const b of me) if (BDEFS[b.type].staff && !BDEFS[b.type].crew && !aiShut(b)) staffed++;
  // Keep a few workers free to build: a colony with every worker staffed stalls.
  const canStaffMore = staffed + Math.max(3, Math.round(workers * 0.2)) <= workers;
  // Resources are in separate fields: when one kind runs short inside our land, expanding toward
  // more of it comes before anything else.
  const inLand = {};
  let crGround = 0;
  for (let t = 0; t < S.W * S.H; t++) if (S.owner[t] === p && S.res[t]) {
    inLand[S.res[t]] = (inLand[S.res[t]] || 0) + 1;
    if (S.res[t] === R_CRYSTAL) crGround += S.amt[t];
  }
  // Crystal is judged by how long what's left would last at the rate the Chip Fabs burn it (see AI_CRYSTAL_MINS), not
  // only by the clusters left: counted by tiles, it ran short only once the last three were all that was left, too late
  // to expand or trade for more, and the army stopped for good while Alloy piled up. It runs low (crLow) when it's short,
  // or when the Taps bring in less than the Fabs use with little in stock: then more Taps, and Crystal by trade.
  const crRate = goodRates(p).crystal, crHave = playerGoods(p).crystal || 0;
  const crBurn = Math.max(crRate.used, counts.foundry ? AI_CRYSTAL_BURN : 0);
  const crShort = S.mode !== 'colony' && crBurn > 0 && crGround + crHave < crBurn * AI_CRYSTAL_MINS;
  const crLow = P.crLow = crShort || (S.mode !== 'colony' && crHave < 10 && crRate.made < crBurn);
  // Short of it by what's left, it expands toward Crystal no-one holds, if there's some within AI_CRYSTAL_REACH tiles of
  // a fort of ours, on the same ground (with none, an Outpost every 40 seconds only takes a site the Terminal or a Port
  // could use: the Trade Terminal brings Crystal instead).
  let crNear = false;
  if (crShort) {
    const forts = me.filter((b) => b.built && BDEFS[b.type].mil && BDEFS[b.type].terr), R2 = AI_CRYSTAL_REACH * AI_CRYSTAL_REACH;
    for (let t = 0; t < S.W * S.H && !crNear; t++) {
      if (S.res[t] === R_CRYSTAL && S.owner[t] < 0) crNear = forts.some((b) => S.zone[tIdx(b.x, b.y)] === S.zone[t] && dist2(b.x, b.y, t % S.W, (t / S.W) | 0) <= R2);
    }
  }
  // Stone goes into nearly everything (and Cement for roads), so boulders count as running short sooner.
  P.short = [R_STALK, R_BOULDER, R_ORE, R_CRYSTAL].filter((r) => (inLand[r] || 0) < (r === R_BOULDER ? 6 : 4) || (r === R_CRYSTAL && crShort && crNear));
  const stoneLow = (inLand[R_BOULDER] || 0) < 10;
  const quarrying = me.some((b) => b.type === 'quarry'); // a Quarry always has Stone to cut or dig (see BDEFS.quarry.bedrock)
  // While boulders run low, keep enough Cement for the Outpost that reaches new ones.
  const reserveCement = stoneLow && playerGoods(p).cement < BDEFS.outpost.cost.cement + 2;
  if (stoneLow && !quarrying) aiFreeCement(p, me);
  // Cancel construction sites that have waited a long time for goods we don't have.
  if (sites >= maxSites) {
    const have = playerGoods(p);
    for (const b of me) {
      if (b.built || b.dead || S.time - b.born < 120 || (needArmory && b.type === 'armory')) continue;
      if ((b.type === 'silo' || b.type === 'munitions' || b.type === 'keep' || b.type === 'terminal' || b.type === 'airfield') && S.time - b.born < 420) continue; // saved up for: give it time
      const cost = siteCost(b);
      let stuck = false;
      for (const g in cost) if ((b.stock[g] || 0) + (b.inc[g] || 0) < cost[g] && have[g] <= 0) stuck = true;
      if (stuck) { demolish(b); sites--; break; }
    }
  }
  let plan = S.mode === 'colony' ? AI_PLAN.concat([['outpost', 40]]) : AI_PLAN;
  // A Turtle wants twice the turrets (and its first one early); a Tycoon a bigger industry and a
  // second Silo straight after the first Ammo Plant.
  if (st.turrets) plan = plan.map(([t, n]) => (t === 'turret' ? [t, n * 2] : [t, n]));
  // Keeps: one for every rival, about ten minutes into the war; a Turtle builds its first early and adds one
  // every eight minutes after, up to three. When one is due it goes first and holds its goods (see defence).
  const keepAt = AI_DEFENCE_AT + (st.walls ? 120 : 600);
  let wantKeeps = S.mode === 'colony' || S.time < keepAt ? 0 : st.walls ? Math.min(3, 1 + Math.floor((S.time - keepAt) / 480)) : 1;
  // A Keep site given up (it waited too long for goods, or for a road) isn't tried again for five minutes.
  if (S.time - (S.players[p].keepFail ?? -999) < 300) wantKeeps = Math.min(wantKeeps, counts.keep || 0);
  if ((counts.keep || 0) < wantKeeps) plan = [['keep', wantKeeps]].concat(plan);
  // Bombers, now and then: every rival but a Turtle puts up an Airfield late in a war (from 22 minutes, with its
  // Ammo Plant running) for a single Vulcan Bomber (see aiBomber).
  if (S.mode !== 'colony' && !st.walls && S.time >= 1320 && !counts.airfield && !botBanned(p, 'bomber') && me.some((b) => b.type === 'armory' && b.built)) plan = [['airfield', 1]].concat(plan); // (only for a bomber)
  // Its planes burn Fuel (a bomber sortie BOMBER.fuel on top of its tank): with an Airfield going up, one more Fuel
  // maker, whichever fits its land (decided once, P.airFuel): a Refinery while it pumps more Crude than its Refineries
  // take, or else a Bio Farm where there's soil none of its farms works, or else a Refinery (and Oil Pump) on oil.
  if (counts.airfield && !P.airFuel) {
    const pumps = me.filter((b) => b.built && b.type === 'pump' && !pumpDry(b)).length;
    const type = pumps > (counts.refinery || 0) ? 'refinery' : aiFindSpot(p, 'farm', lander) ? 'farm' : pumps || aiFindSpot(p, 'pump', lander) ? 'refinery' : 'farm';
    P.airFuel = { type, n: (counts[type] || 0) + 1 };
  }
  const airFuel = P.airFuel && counts.airfield && (counts[P.airFuel.type] || 0) < P.airFuel.n ? P.airFuel : null;
  if (airFuel) {
    plan = [[airFuel.type, airFuel.n]].concat(plan);
    if (airFuel.type === 'refinery' && !counts.pump) plan = [['pump', 1]].concat(plan); // (a Refinery waits for a pump)
  }
  // Bulk trade: a Trade Terminal once the colony is running short of Ore, Crystal or Stone (a Tycoon from 14
  // minutes, the rest from 20, any rival from 10 once its Crystal runs short, and then past the usual limit on sites),
  // with a Road Train to serve it (see the Foundry, and aiTrade).
  // (Dry of Fuel with no way to make any, from 10 minutes too: the Terminal's Fuel contract is the way.)
  const fuelTrade = !!P.fuelDry && S.time - P.fuelLow > AI_FUEL_TRADE;
  const tradeAt = st.missiles ? 840 : crShort || fuelTrade ? AI_CRYSTAL_TRADE_AT : 1200;
  let tradeFirst = false;
  if (S.mode !== 'colony' && S.time >= tradeAt && !counts.terminal && counts.foundry && S.time - (P.termFail ?? -999) > 240) {
    const sh = tradeShortest(p), g = sh.find((x) => x !== 'alloy'); // short of something in the ground
    if (sh.left[g] < (TRADE_LEFT[g] || 60) * 1.5 || st.missiles || crShort || fuelTrade) plan = [['terminal', 1]].concat(plan); // only when short: it goes first
    tradeFirst = crShort;
  }
  // (An Architect's second Crystal Tap with them: Chips are what its Missiles and its warbots both wait for.)
  if (st.missiles) { const k = plan.findIndex(([t]) => t === 'armory') + 1; plan = plan.slice(0, k).concat([['smelter', 2], ['tap', 2], ['fab', 2]], plan.slice(k)); } // (its Missile Factory and Silos come through aiMissilePlan)
  // Nuclear race: a Reactor once there's Uranium to enrich (or a mine on a deposit), then a Nuclear Silo.
  if (nukeOn()) {
    const k = plan.findIndex(([t]) => t === 'depot'); // (after the first Generator, where the Missile Factory used to stand in the plan)
    const nuke = [];
    if (goodTotal(p, 'uranium') > 0 || me.some((b) => b.type === 'mine' && reachableRes(b.x, b.y, BDEFS.mine.radius, R_URANIUM) > 0)) nuke.push(['reactor', 1]);
    if (counts.reactor && goodTotal(p, 'fissile') + goodTotal(p, 'uranium') / 2 >= 2) nuke.push(['nukesilo', 1]);
    plan = plan.slice(0, k).concat(nuke, plan.slice(k));
  }
  // Under attack at the front: a Bunker, a Mortar Pit or a Disruptor Tower beside the fort that is being hit
  // (whichever we have fewest of), one every two minutes or so, up to one more every eight minutes of play.
  const hitFort = me.filter((b) => b.built && BDEFS[b.type].mil && !BDEFS[b.type].bunker && S.time - (b.lastHit || -99) < 45)
    .sort((a, c) => (c.lastHit || 0) - (a.lastHit || 0))[0];
  if (hitFort && S.mode !== 'colony' && S.time > AI_DEFENCE_AT && !(P.defWant && S.time < P.defWant.until)) {
    const nDef = (counts.bunker || 0) + (counts.mortar || 0) + (counts.disruptor || 0) + (counts.minigun || 0);
    if (nDef < 1 + Math.floor(S.time / 480) && S.time - (P.defAt || -999) > 120) {
      const type = ['minigun', 'bunker', 'mortar', 'disruptor'].sort((a, c) => (counts[a] || 0) - (counts[c] || 0))[0];
      P.defWant = { type, n: (counts[type] || 0) + 1, until: S.time + 120, x: hitFort.x, y: hitFort.y };
      P.defAt = S.time;
    }
  }
  // An army parked on its land, or within 14 tiles of its Command Base, while none of its forts is being hit (so
  // nothing above asks for a defence): four or more enemy warbots standing there call for a Mortar Pit, the one gun
  // that reaches them from out of their own reach, by the fort nearest them, 7 to 10 tiles from where they stand (see
  // aiSearchSpot; its builder keeps out of their way), up to three, one at most every three minutes (P.parkAt: a raiding
  // besieger wrecked the sites as fast as they went up). Normal and Hard rivals, and a Warden (turtle) on any. (Nothing
  // answered a besieger parked just outside the guns.)
  if ((S.difficulty === 'normal' || S.difficulty === 'hard' || st.walls) && S.mode !== 'colony' && S.time > AI_DEFENCE_AT && !few &&
      !(P.defWant && S.time < P.defWant.until) && S.time - (P.defAt || -999) > 60 && S.time - (P.parkAt ?? -999) > 180 && (counts.mortar || 0) < 3) {
    let n = 0, sx = 0, sy = 0;
    for (const u of S.bots) {
      if (u.dead || u.inside || u.owner < 0 || !foes(u.owner, p) || !isArmy(u)) continue;
      const ti = Math.floor(u.x), tj = Math.floor(u.y);
      if (!inMap(ti, tj) || (S.owner[tIdx(ti, tj)] !== p && dist2(u.x, u.y, lander.x, lander.y) > 196)) continue;
      n++; sx += u.x; sy += u.y;
    }
    if (n >= 4) {
      sx /= n; sy /= n;
      let f = null, fd = Infinity;
      for (const b of me) { if (!b.built || !BDEFS[b.type].mil || BDEFS[b.type].bunker) continue; const d = dist2(b.x, b.y, sx, sy); if (d < fd) { fd = d; f = b; } }
      if (f) { P.defWant = { type: 'mortar', n: (counts.mortar || 0) + 1, until: S.time + 120, x: f.x, y: f.y, ax: Math.round(sx), ay: Math.round(sy) }; P.defAt = P.parkAt = S.time; }
    }
  }
  // Front defences without waiting to be hit there: a Minigun Nest or a Bunker (whichever it has fewer of) by its
  // fort nearest the rival's Command Base, one every six minutes from about ten minutes in, up to aiFort's `front`.
  const FT = aiFort(p);
  if (S.mode !== 'colony' && warOn() && S.time > AI_DEFENCE_AT + 300 && !(P.defWant && S.time < P.defWant.until) && S.time - (P.frontAt ?? -999) > 360) {
    const nFront = (counts.bunker || 0) + (counts.minigun || 0), R0 = S.players[rivalOf(p)], foeL = R0 && getE(R0.lander);
    if (foeL && nFront < Math.min(FT.front, 1 + Math.floor((S.time - AI_DEFENCE_AT - 300) / 360))) {
      const front = me.filter((b) => b.built && BDEFS[b.type].mil && !BDEFS[b.type].bunker).sort((a, c) => dist2(a.x, a.y, foeL.x, foeL.y) - dist2(c.x, c.y, foeL.x, foeL.y))[0];
      if (front) {
        const type = (counts.minigun || 0) <= (counts.bunker || 0) ? 'minigun' : 'bunker';
        P.defWant = { type, n: (counts[type] || 0) + 1, until: S.time + 150, x: front.x, y: front.y };
        P.frontAt = S.time;
      }
    }
  }
  // Uplinks: guards, first call on warbots and a Bunker for the Uplinks it holds (see aiUplinks).
  if (S.victory === 'uplinks') aiUplinks(p, lvl, counts);
  if (P.defWant && S.time < P.defWant.until && (counts[P.defWant.type] || 0) < P.defWant.n) plan = [[P.defWant.type, P.defWant.n]].concat(plan);
  // No Cement Works: Cement builds nearly everything (and every road), so one comes first, even
  // past the usual limit on sites.
  const cementStarved = !me.some((b) => b.type === 'kiln');
  let siteCap = maxSites;
  if (cementStarved) { plan = [['kiln', 1]].concat(plan); siteCap = maxSites + 1; }
  const outSite = me.some((b) => b.type === 'outpost' && !b.built);
  if (P.short.length && !outSite && S.time - (P.lastExpand || -99) > 40) plan = [['outpost', (counts.outpost || 0) + 1]].concat(plan);
  // Domination: land wins the game, so an Outpost every so often (once the colony runs), wherever it claims most.
  else if (S.victory === 'domination' && !outSite && S.time > 240 && S.time - (P.lastExpand || -99) > 50) plan = [['outpost', (counts.outpost || 0) + 1]].concat(plan);
  // Uplinks: an Outpost every 40 seconds or so on the way to the nearest free Uplink, while they bring it nearer
  // (two that don't, and it waits three minutes: one across the sea or past a rival may be out of reach for now).
  else if (S.victory === 'uplinks' && !outSite && S.time > 180 && S.time - (P.lastExpand || -99) > 40 && S.time >= (P.upWait || 0)) {
    const gap = aiUplinkGap(p);
    if (P.upGapT !== undefined && (P.lastExpand || -99) > P.upGapT) P.upMiss = gap < P.upGap - 1 ? 0 : (P.upMiss || 0) + 1;
    P.upGap = gap; P.upGapT = S.time;
    if (P.upMiss >= 2) { P.upMiss = 0; P.upWait = S.time + 180; }
    else if (gap < Infinity) plan = [['outpost', (counts.outpost || 0) + 1]].concat(plan);
  }
  // Missiles are expensive, so the AI saves up for them (see aiMissilePlan): while it is saving,
  // the building it saves for goes first and nothing else that costs Alloy or Chips is started.
  // (A site of that kind already going up is the one being saved for, not a reason for one more: asking for
  // "one more" every time left some rivals with several Missile Factories, or many Silos.)
  const saving = few ? null : aiMissilePlan(p, me, counts, kinds, workers, staffed);
  if (saving) plan = [[saving, (counts[saving] || 0) + (me.some((b) => b.type === saving && !b.built) ? 0 : 1)]].concat(plan);
  // (An Architect's doesn't wait for a free site either: with both sites always taken it stood in the queue for minutes.)
  if (saving && st.missiles && !me.some((b) => b.type === saving && !b.built)) siteCap = Math.max(siteCap, maxSites + 1);
  if (needArmory) plan = [['armory', 1]].concat(plan);
  // Workers no longer haul, so spare ones go to work: another gatherer for the scarcest raw good.
  if (S.time > 150 && workers - staffed >= 4 && canStaffMore) {
    const have = playerGoods(p);
    const g = ['harvester', 'quarry', 'mine', 'tap'].filter((t) => (counts[t] || 0) < 3 && (have[RES[BDEFS[t].gather].good] || 0) < 8)
      .sort((a, c) => (have[RES[BDEFS[a].gather].good] || 0) - (have[RES[BDEFS[c].gather].good] || 0));
    if (g.length) plan = [[g[0], (counts[g[0]] || 0) + 1]].concat(plan);
  }
  // Crystal running low with clusters left on our land: another Crystal Tap first (up to AI_CRYSTAL_TAPS of them), even
  // with every worker busy, and it gets a worker before the rest (see where it's placed). With one Tap at work the Fabs
  // burned Crystal twice as fast as it came in while clusters lay untouched on its land.
  const tapSite = me.some((b) => b.type === 'tap' && !b.built);
  const tapsFirst = crLow && !few && !tapSite && (counts.tap || 0) < AI_CRYSTAL_TAPS && (inLand[R_CRYSTAL] || 0) >= 2;
  if (tapsFirst) plan = [['tap', (counts.tap || 0) + 1]].concat(plan);
  // A Harvester site only counts once its materials are in: one waiting for Fiber never gets any. Nor does a
  // Harvester down to its last couple of stalks (a few regrow round a cut-out grove, enough to look busy but not to
  // keep the Smelters going). Only stalks it can cut now count (aiGathers: ripe, on our side, out of enemy guns):
  // counting the ones still growing, or the rival's across the border, a Harvester said "No stalk groves left in
  // reach" while it counted four to eight, no new one went up, and Fiber sat at 0 for many minutes.
  const cutting = me.some((b) => b.type === 'harvester' &&
    (b.built ? aiGathers(b, 3) : sumValues(b.stock) >= sumValues(BDEFS.harvester.cost)));
  const fiberLow = !cutting || playerGoods(p).fiber < 4;
  // With none cutting, a new Harvester goes first; and with none on the way either, past the usual limit on sites:
  // sites waiting for Alloy could otherwise hold every place while the Smelters wait for the Fiber to make it.
  const fiberStarved = !cutting && !me.some((b) => b.type === 'harvester' && !b.built);
  // The same for Ore and Crystal once the Bot Foundry stands: with no Mine (or no Crystal Tap) at work, none on the way
  // and next to none in store, one goes first, past the usual limit (`starved`). Sites stuck where the colony's robots
  // won't go (a road to pave across ground where they were just shot, see noteDanger) could hold every place for ten
  // minutes and more while the last field ran dry: no Alloy or no Chips, so the Bot Foundry made nothing, and both
  // rivals sat at 0 Chips with a few warbots each until the clock ran out. (On the way: a site placed in the last
  // 150 s, or one a road reaches. The opening, before the Foundry, goes as it always has.)
  const haveG = playerGoods(p);
  const starved = !me.some((b) => b.type === 'foundry' && b.built) ? [] : ['mine', 'tap'].filter((t) => (haveG[RES[BDEFS[t].gather].good] || 0) < 4 &&
    !me.some((b) => b.type === t && (b.built ? aiGathers(b) : S.time - b.born < 150 || !b.unlinked)));
  for (const t of starved) plan = [[t, (counts[t] || 0) + 1]].concat(plan);
  if (starved.length) siteCap = Math.max(siteCap, sites + 1);
  if (!cutting) plan = [['harvester', (counts.harvester || 0) + 1]].concat(plan);
  if (fiberStarved) siteCap = Math.max(siteCap, maxSites + 1) + (cementStarved ? 1 : 0);
  // (Crystal running out: the Terminal that buys more doesn't wait for a free site either. It waited minutes behind
  // Outposts and Mines while the last Crystal went, and with no Chips left there was no Road Train to serve it.)
  if (tradeFirst) siteCap = Math.max(siteCap, maxSites + 1);
  // Fuel first when it runs low: with the Fuel Stations dry every robot slows to a crawl, and everything else with
  // it. A Bio Farm (or an Oil Pump where there's oil on our land), and an Oil Pump with no Refinery gets one.
  // (Low for half a minute, not a dip; never while a Bio Farm still waits for its Agribot; at most a Bio Farm for
  // every 15 robots and two more.)
  const fuelNow = playerGoods(p).fuel || 0;
  const fuelSite = me.some((b) => !b.built && (b.type === 'farm' || b.type === 'pump' || b.type === 'refinery'));
  P.fuelLow = fuelNow < 6 ? (P.fuelLow ?? S.time) : undefined;
  P.fuelDry = P.fuelLow !== undefined && S.time - P.fuelLow > AI_FUEL_DRY && !aiFuelSource(p, me);
  if (P.fuelLow !== undefined && S.time - P.fuelLow > 30 && !fuelSite && S.time > 60) {
    const pumped = me.some((b) => b.built && b.type === 'pump' && !pumpDry(b));
    const farmWaiting = me.some((b) => b.built && b.type === 'farm' && !b.paused && !b.staff);
    const robots = S.bots.reduce((n, u) => n + (!u.dead && u.owner === p && !isArmy(u) ? 1 : 0), 0);
    const foundry = me.some((b) => b.built && b.type === 'foundry'); // (oil costs Alloy: the Foundry's comes first)
    const add = pumped && !counts.refinery && foundry ? [['refinery', 1]] : [];
    if (!add.length && !farmWaiting && (counts.farm || 0) < 2 + Math.ceil(robots / 15)) add.push(['farm', (counts.farm || 0) + 1]);
    if ((!add.length || add[0][0] === 'farm') && !counts.pump && foundry) add.push(['pump', 1]); // (one Oil Pump, where there's oil)
    plan = add.concat(plan);
    if (fuelNow < 3) siteCap = Math.max(siteCap, maxSites + 1);
  }
  // With Fiber nearly gone (no Harvester at work, or construction waiting for it), the Smelters
  // stop burning it until there's some to spare. Construction waits for it at a site that is short of it, and
  // before there is a site at all: none is started without the Fiber in storage (P.fiberWait, set below), and a
  // busy Smelter burned every Fiber the Harvesters cut, so a colony could go many minutes unable to start a
  // Harvester, a Mine or an Outpost.
  const fiberNow = playerGoods(p).fiber;
  // ...and while Crystal runs low with Alloy piling up (no Chips to make robots with, so nothing to spend it on), they
  // rest too, until it's down to half: the Ore and Fiber they'd burn can buy Crystal at the Trade Terminal (Alloy can't
  // be sold), and their workers go to the Taps. Crystal-starved colonies sat on 60 to 90 Alloy with nothing to trade.
  const alloyNow = playerGoods(p).alloy || 0, resting = me.some((b) => b.alloyRest);
  const alloyPile = !few && crLow && alloyNow >= (resting ? AI_ALLOY_PILE / 2 : AI_ALLOY_PILE);
  const sitesWantFiber = S.time - (P.fiberWait ?? -99) < 8 || me.some((b) => !b.built && !b.unlinked && (siteCost(b).fiber || 0) > (b.stock.fiber || 0) + (b.inc.fiber || 0)); // (a site no road reaches yet can't take any)
  for (const b of me) {
    if (b.type !== 'smelter' || !b.built) continue;
    if (alloyPile) { if (!b.paused) { setPaused(b, true); b.alloyRest = true; } continue; }
    if (b.alloyRest) { delete b.alloyRest; if (b.paused) setPaused(b, false); }
    if (!b.paused && fiberNow < 3 && (!cutting || sitesWantFiber)) setPaused(b, true);
    // (Back to work once there's some to spare, Harvester or not: with none cutting it used to stay off while the
    // Fiber a cut-out grove still gave piled up, and the Bot Foundry's site waited minutes for its Alloy.)
    else if (b.paused && (cutting ? fiberNow >= 6 || !sitesWantFiber : fiberNow >= 6 && !sitesWantFiber)) setPaused(b, false);
  }
  // Goods held back for a key building we can't afford yet: nothing that needs them starts first.
  const held = new Set();
  // Defences come first once the colony is running: the first Pulse Turret, then a Repair Station.
  // In a Nuclear race the Reactor and Nuclear Silo get the same treatment: the race is the point.
  // More Pulse Turrets as the game goes on: one more every so often, up to its doctrine's number (aiFort; a
  // Turtle starts early and builds most).
  const turretsWanted = Math.min(FT.turrets, 1 + Math.floor(Math.max(0, S.time - AI_DEFENCE_AT * (st.turrets ? 0.5 : 1)) / FT.every));
  const defence = (type) => S.mode !== 'colony' && (type === 'turret' ? (counts.turret || 0) < turretsWanted : type === 'keep' ? (counts.keep || 0) < wantKeeps : !counts[type]) &&
    ((type === 'turret' && S.time > AI_DEFENCE_AT * (st.turrets ? 0.5 : 1)) || (type === 'repair' && counts.turret && S.time > AI_DEFENCE_AT + 120) ||
     (nukeOn() && (type === 'reactor' || type === 'nukesilo')) || (type === 'flak' && enemyAir && (counts.flak || 0) < 2) ||
     (type === 'keep' && wantKeeps > 0));
  // Only Fuel Stations charge robots: the first one comes before anything else.
  // Flak once a rival has aircraft: two Flak Guns by the Command Base (and Ammo to feed them).
  const enemyAir = S.bots.some((u) => !u.dead && foes(u.owner, p) && BOTS[u.type].air) ||
    S.buildings.some((b) => !b.dead && b.built && b.owner >= 0 && foes(b.owner, p) && BDEFS[b.type].airfield);
  if (enemyAir && S.mode !== 'colony' && (counts.flak || 0) < 2 && !plan.some(([t]) => t === 'flak')) plan = [['flak', 2]].concat(plan); // (a copy: AI_PLAN is shared)
  // The first Flak Gun doesn't wait for a free site (nothing else goes past the usual limit for it).
  const flakFirst = enemyAir && S.mode !== 'colony' && !counts.flak, capBefore = Math.max(siteCap, maxSites + 1);
  if (flakFirst) siteCap = Math.max(capBefore, sites + 1);
  // Uplinks: the Bunker for an Uplink it holds goes first, past the usual limit on sites, once they're nearly online.
  const upFirst = !!(P.defWant && P.defWant.up && S.time < P.defWant.until && S.time >= UPLINK.online - 60 && (counts.bunker || 0) < P.defWant.n);
  if (upFirst) { siteCap = Math.max(siteCap, capBefore, sites + 1); plan = [['bunker', P.defWant.n]].concat(plan); }
  const key = (type) => (type === 'charger' && !counts.charger) || type === 'foundry' || type === 'harvester' || type === 'quarry' || (type === 'kiln' && (playerGoods(p).cement || 0) < 3) || defence(type) ||
    (P.defWant && P.defWant.type === type && S.time < P.defWant.until) ||
    (type === 'outpost' && P.short.length > 0) || (type === 'tap' && tapsFirst);
  // One site at a time (an Easy rival): from AI_EASY_OPENING on, until its Bot Foundry is under way, the plan's opening
  // (AI_OPENING) comes before every other ask. Expansion Outposts, a spare gatherer and the Ammo Plant took the only slot
  // first, the Outposts then waited minutes for their roads, and most Easy rivals never built a Smelter or a robot.
  // (Its first minutes go as they always have: with the opening first from the start it had its Foundry as soon as a
  // Normal rival and beat one in half its games.)
  if (maxSites === 1 && !counts.foundry && S.mode !== 'colony' && S.time >= AI_EASY_OPENING) plan = AI_OPENING.concat(plan);
  if (sites < siteCap) {
    for (const [type, want0] of plan) {
      if (few && (!AI_CHAIN.includes(type) || counts[type])) continue; // triage: only a missing link of the chain
      // (past the usual limit only for what's starving the colony: a Cement Works, a Harvester, a Mine or a Crystal Tap)
      if ((cementStarved || fiberStarved || starved.length) && sites >= maxSites && !(cementStarved && type === 'kiln') && !(fiberStarved && type === 'harvester') && !starved.includes(type)) continue;
      if (tradeFirst && sites >= maxSites && type !== 'terminal') continue;
      if (flakFirst && sites >= capBefore && type !== 'flak') continue;
      if (upFirst && sites >= capBefore && type !== 'bunker') continue;
      if (S.mode === 'colony' && BDEFS[type].war) continue;
      // One more Fuel Station for every four Outposts as the colony spreads out, and a Bio
      // Farm for every two stations to keep them in Fuel.
      const nCh = 1 + Math.floor((counts.outpost || 0) / 4);
      // Only Fuel Stations charge, so Fuel scales with the colony: a Bio Farm for every 18 robots.
      const nBots = S.bots.reduce((n, u) => n + (!u.dead && u.owner === p && !isArmy(u) ? 1 : 0), 0);
      const want = type === 'charger' ? Math.max(want0, nCh) : type === 'farm' && counts.charger ? Math.max(want0, Math.ceil((counts.charger || 0) / 2), Math.ceil(nBots / 18)) : want0;
      if (type === 'refinery' && !counts.pump) continue;
      // A Generator only once there's Fuel to spare for it (and a refinery or farm to keep it coming).
      if (type === 'generator' && ((playerGoods(p).fuel || 0) < 15 || !(counts.refinery || (counts.farm || 0) >= 2))) continue;
      // Plenty of Fuel in stock: no need for more farms or oil yet.
      // (Not the one more that goes with an Airfield: see P.airFuel.)
      if ((type === 'farm' || type === 'pump' || type === 'refinery') && (counts[type] || 0) >= 1 && playerGoods(p).fuel > 10 && !(airFuel && (type === airFuel.type || type === 'pump'))) continue;
      if ((counts[type] || 0) >= want) continue;
      // (An Architect saves from early on: its first Ammo Plant and first turret don't wait for it.)
      if (saving && type !== saving && type !== 'keep' && type !== 'terminal' && type !== 'airfield' && !(type === 'flak' && flakFirst) && !BDEFS[type].nuke &&
          !(st.missiles && !counts[type] && (type === 'turret' || type === 'armory')) && (BDEFS[type].cost.alloy || BDEFS[type].cost.chip)) continue;
      // Keep enough Fiber for a Harvester while none is cutting: without Fiber there's no way back.
      if (type !== 'harvester' && fiberLow && (BDEFS[type].cost.fiber || 0) > 0 && playerGoods(p).fiber - BDEFS[type].cost.fiber < BDEFS.harvester.cost.fiber) continue;
      // The first of each staffed building is always allowed, so the production chain is complete (and a Crystal Tap
      // while Crystal runs low, and a Mine or Tap the colony is starved of).
      if (BDEFS[type].staff && !BDEFS[type].crew && !canStaffMore && counts[type] && !(type === 'tap' && tapsFirst) && !starved.includes(type)) continue;
      if (Object.keys(BDEFS[type].cost).some((g) => held.has(g))) continue;
      if (reserveCement && type !== 'outpost' && type !== 'quarry' && type !== 'kiln' && BDEFS[type].cost.cement) continue;
      if (type === 'kiln' && stoneLow && counts.kiln) continue;
      // A turret or Repair Station is started as soon as the Cement is there: new Alloy goes straight
      // into factories, so it never piles up in storage; the high-priority site gets it delivered.
      // So is an Architect's Missile Factory or Silo: waiting for the whole price to lie in storage while the Foundry and
      // the Chip Fab drew on it, it saved for a Silo for minutes at a time and seldom built one.
      const defenceNow = (defence(type) && counts.smelter && aiAffordable(p, type, ['alloy', 'chip'])) || ((type === 'terminal' || type === 'airfield') && aiAffordable(p, type, ['alloy'])) ||
        (st.missiles && type === saving && counts.smelter && counts.fab && aiAffordable(p, type, ['alloy', 'chip']));
      if (!aiAffordable(p, type) && !defenceNow) {
        if ((BDEFS[type].cost.fiber || 0) > playerGoods(p).fiber) P.fiberWait = S.time; // (the Smelters rest for it: see above)
        if (key(type) && (!counts[type] || type === 'outpost' || type === 'tap')) {
          const have = playerGoods(p), cost = BDEFS[type].cost;
          for (const g in cost) if (have[g] < cost[g]) held.add(g);
        }
        continue;
      }
      const spot = aiFindSpot(p, type, lander);
      const placed = spot ? placeSite(p, type, spot.x, spot.y) : null;
      if (placed && placed.ok) {
        if (type === 'outpost') P.lastExpand = S.time;
        // The chain that makes new bots gets workers first; the Ammo Plant gives its worker up first.
        if (['mine', 'smelter', 'fab', 'foundry'].includes(type) && !counts[type]) placed.building.prio = 'high';
        if (type === 'armory') placed.building.prio = 'low';
        if (defenceNow || defence(type) || (type === 'tap' && tapsFirst)) placed.building.prio = 'high';
        break;
      }
    }
  }

  // 1a) Repairs: damaged buildings get fixed once the fighting there stops (military ones first,
  //     the rest only with Cement to spare).
  //     While it saves for a crossing (a Viaduct to the enemy), repairs never dip into that Cement, or
  //     a long war of patching forts keeps it from ever reaching the enemy again.
  if (S.mode !== 'colony') {
    const keep = P.bridgeNeed && S.time - (P.bridgeWant || -999) < 30 ? (P.bridgeNeed.cement || 0) : 0;
    for (const b of me) {
      if (!b.built || b.fixLeft > 0 || S.time - (b.lastHit || -99) < 6 || b.armor >= BDEFS[b.type].armor * 0.75) continue;
      const left = playerGoods(p).cement - repairCost(b);
      if ((BDEFS[b.type].mil && left >= keep) || left >= 6 + keep) requestRepair(p, b);
    }
  }

  // 1b) Roads: haulers only travel on roads, so every building needs one to storage. The Cement
  //     Works rests while there is plenty of Cement, so it doesn't burn all the Stone.
  aiRoads(p, me);
  // Producers rest once there's plenty of what they make, so they don't eat inputs other
  // buildings need (Chips and Ammo would otherwise swallow all the Alloy the Foundry needs).
  const stockNow = playerGoods(p), missiles = !!(saving || P.feedMissiles);
  // Saving Alloy for a Viaduct (the only way to reach the enemy): Ammo and Chips stop until it's
  // paid for, or they'd eat every bit of Alloy the Smelter makes (Outposts keep asking for Ammo).
  const forBridge = !!(P.bridgeNeed && P.bridgeNeed.alloy && S.time - (P.bridgeWant || -999) < 30);
  // No Bot Foundry yet (or a site still short of its Alloy): it comes first. The Ammo Plant, and the Chip Fab once
  // there are Chips enough for the Foundry, rest until it has its Alloy: put up before it, they'd eat every bit the
  // Smelter makes and the colony would never make another robot.
  const fCost = BDEFS.foundry.cost;
  const forFoundry = !me.some((b) => b.type === 'foundry' && (b.built || (b.stock.alloy || 0) + (b.inc.alloy || 0) >= fCost.alloy));
  for (const b of me) {
    const cap = AI_CAPS[b.type];
    if (!cap || !b.built) continue;
    if (forBridge && (b.type === 'armory' || b.type === 'fab')) { if (!b.paused) setPaused(b, true); continue; }
    if (forFoundry && (b.type === 'armory' || (b.type === 'fab' && (stockNow.chip || 0) >= fCost.chip))) { if (!b.paused) setPaused(b, true); continue; }
    const hi = cap[1] * (missiles && b.type === 'fab' ? 2 : 1), lo = cap[2];
    const have = stockNow[cap[0]] || 0;
    if (!b.paused && have >= hi) setPaused(b, true);
    else if (b.paused && have < lo) setPaused(b, false);
  }

  // Fuel first: a Grove Planter gives up its Agribot while a Bio Farm has none (and takes one back
  // once every farm has its own). But with Fiber running out and no stalks left to cut, groves come first:
  // a Bio Farm gives up its Agribot to a Grove Planter (without Fiber there's no Alloy for another Agribot),
  // and gets it back once a Harvester has stalks to cut again.
  const groveFirst = !cutting && playerGoods(p).fiber < 6 && me.some((b) => b.built && b.type === 'grower');
  const groveStaffed = me.some((b) => b.built && b.type === 'grower' && !b.paused && (b.staff || b.staffInc));
  let freed = false;
  for (const b of me) {
    if (b.type !== 'farm' || !b.built) continue;
    if (groveFirst && !groveStaffed && !freed && !b.paused && (b.staff || b.staffInc)) { setPaused(b, true); b.forGrove = true; freed = true; }
    else if (!groveFirst && b.paused && b.forGrove) { setPaused(b, false); delete b.forGrove; }
  }
  const farmWaits = !groveFirst && me.some((b) => b.built && b.type === 'farm' && !b.paused && !b.staff && !b.staffInc);
  const farms = me.filter((b) => b.built && b.type === 'farm').length;
  for (const b of me) {
    if (b.type !== 'grower' || !b.built) continue;
    if (farmWaits && !b.paused && (b.staff || b.staffInc)) setPaused(b, true);
    else if (b.paused && !farmWaits && (groveFirst || (kinds.agribot || 0) > farms)) setPaused(b, false);
  }

  // 2) Retire gatherers and pumps that have run dry so their worker can be reused.
  for (const b of me) {
    const def = BDEFS[b.type];
    if (b.built && def.gather && S.time - b.born > 30 && gatherReach(b.x, b.y, b.type) === 0 && !(b.stock[RES[def.gather].good] > 1)) {
      // A Quarry out of boulders still cuts or digs Stone: it's only moved if there's a boulder field to go to.
      if (def.bedrock && (rockFacesIn(b.x, b.y, def.radius) > 0 || !aiFindSpot(p, b.type, lander))) continue;
      demolish(b);
    } else if (b.built && def.pump && pumpSeep(b) < 0 && !(b.stock.crude > 0)) {
      demolish(b);
    }
  }

  // 2b) Pipelines: an Oil Pump gets pipe to the nearest Refinery (cheap, and its Crude never waits
  //     for a Tanker), one pump at a time, while there's Cement and Alloy to spare.
  if (S.time - (P.pipeT || -99) > 15) {
    P.pipeT = S.time;
    const have = spendable(p);
    let laid = false;
    for (const b of me) {
      if (!b.built || !BDEFS[b.type].pump || pumpDry(b)) continue;
      const r = pipeToRefinery(p, b);
      if (r.why || r.tiles.length > 40) continue;
      if ((have.cement || 0) < 6 + (r.cost.cement || 0) || (have.alloy || 0) < (r.cost.alloy || 0)) continue;
      pipeUp(p, r.tiles);
      laid = true;
      break;
    }
    // ...and a Fuel Station or Generator near storage or a Refinery gets Fuel by a short pipe: no more Tanker runs to it.
    if (!laid) for (const b of me) {
      if (!b.built || !(BDEFS[b.type].charger || BDEFS[b.type].burner) || BDEFS[b.type].store) continue;
      const r = pipeToFuel(p, b);
      if (r.why || r.tiles.length > 10) continue;
      if ((have.cement || 0) < 10 + (r.cost.cement || 0)) continue;
      pipeUp(p, r.tiles);
      break;
    }
  }

  // 3) Foundry: keep enough workers, then grow the army. Order specialists when a building needs
  //    one, and enough Haulers (a Freight Truck counts as one and a half) to carry every good in the colony.
  let wantWorkers = staffed + 3 + Math.min(3, sites);
  const needWorkers = wantWorkers; // (what its buildings call for, before the bot limit has its say)
  // A Freight Truck takes the long runs off the Haulers, but sits idle much of the time: it counts as one and a half.
  const wantHaulers = clamp(Math.ceil(me.length * 0.35), 4, 16) - Math.floor(1.5 * (kinds.truck || 0));
  // Tankers carry every drop of Crude and Fuel: one, and another for every five buildings that make or burn them.
  const liquidBlds = me.filter((b) => b.built && (BDEFS[b.type].charger || BDEFS[b.type].pump || BDEFS[b.type].burner ||
    ['refinery', 'farm', 'munitions', 'tarworks', 'disruptor'].includes(b.type))).length;
  const wantTankers = Math.min(4, 1 + Math.floor(liquidBlds / 5));
  // A forward Depot with supply orders gets a Freight Truck to keep it stocked (and one more for every 35 buildings).
  const wantTrucks = me.some((d) => d.keep && d.built && !BDEFS[d.type].terminal) ? 1 + Math.floor(me.length / 35) : 0;
  const army = (kinds.warbot || 0) + (kinds.bulwark || 0) + (kinds.torch || 0); // (the whole army, specialists too)
  // (An enemy gun covering our buildings: at least enough warbots to knock it out, see aiClearGuns.)
  const wantArmy = S.mode === 'colony' || botBanned(p, 'warbot') ? 0 : Math.max(aiWantArmy(lvl, p), P.gunWant || 0); // (barred from making warbots: no army to build)
  const armyBehind = army < wantArmy - 2;
  // The bot limit: the room left under it is kept for the army it wants (AI_ARMY_ROOM of the limit at most), so a
  // colony that has taken a lot of buildings can't fill the limit with workers, Haulers and the rest and never field an
  // army again. Workers stop where they would eat into that room, and so do the other non-fighting robots (but the one
  // Tanker it can't do without); warbots past what it wants leave AI_WORKER_ROOM free, for the workers it loses.
  const botCap = S.mode === 'colony' ? MAX_BOTS_COLONY : MAX_BOTS, spare = botCap - sumValues(kinds);
  const armyRoom = S.mode === 'colony' ? 0 : Math.max(0, Math.min(wantArmy, Math.floor(botCap * AI_ARMY_ROOM)) - army);
  const civilOk = spare > armyRoom;
  wantWorkers = Math.min(wantWorkers, workers + Math.max(0, spare - armyRoom));
  let unarmed = 0;
  // (Warbots stranded across the water, say landed on an enemy shore, can't get home to rearm: they don't count.)
  const hzA = homeZone(p);
  for (const u of S.bots) if (!u.dead && u.owner === p && isArmy(u) && !botArmed(u) && (u.inside || S.zone[tIdx(Math.floor(u.x), Math.floor(u.y))] === hzA)) unarmed++;

  const crewNeed = {};
  for (const b of me) {
    const crew = BDEFS[b.type].crew;
    if (crew && b.built) crewNeed[crew] = (crewNeed[crew] || 0) + 1;
  }
  // Triage (see above): every building that takes a worker rests but the links of the chain the next robot waits for
  // (and a gatherer, or the Quarry and Cement Works, while there's next to none of what they're for), so the few
  // workers go down the chain to the link that can work; the ones rested here are switched back on when it's over.
  // Each link of the chain works only while what it makes is short and what it needs is there (counting what lies in
  // the chain's hoppers): the Foundry while it has a part of each kind (always, with more than three workers), the
  // Chip Fab while Chips are short, the Smelter while Alloy is short, a Mine while Alloy and Ore are both short. (Two
  // workers left after a raid ran the Smelter for ten minutes, Alloy piling up to 25 with no Chips, while the Chip
  // Fab and the Foundry stood still.)
  if (few) {
    P.triage = P.triage || [];
    const have = { ...playerGoods(p) }, got = (g) => have[g] || 0;
    for (const b of me) if (b.built && AI_CORE.includes(b.type)) for (const g in BDEFS[b.type].inp || {}) have[g] = got(g) + (b.stock[g] || 0);
    for (const b of me) {
      const def = BDEFS[b.type];
      if (!b.built || !def.staff || def.crew) continue;
      const need = b.type === 'foundry' ? workers > 3 || (got('alloy') >= 1 && got('chip') >= 1)
        : b.type === 'fab' ? got('chip') < 4 && got('crystal') >= 1 && got('alloy') >= 1
        : b.type === 'smelter' ? got('alloy') < 6 && got('ore') >= 2 && got('fiber') >= 2
        : b.type === 'mine' ? got('alloy') < 6 && got('ore') < 4
        : b.type === 'quarry' || b.type === 'kiln' ? got('cement') < 4 : !!def.gather && got(RES[def.gather].good) < 4;
      if (need) { if (b.paused && P.triage.includes(b.id)) setPaused(b, false); }
      else if (!b.paused) { setPaused(b, true); if (!P.triage.includes(b.id)) P.triage.push(b.id); }
    }
  } else if (P.triage) {
    for (const id of P.triage) { const b = getE(id); if (b && !b.dead && b.owner === p && b.paused) setPaused(b, false); }
    delete P.triage;
  }
  for (const b of me) {
    if (b.type !== 'foundry' || !b.built) continue;
    // Triage: workers, and nothing else, until there are enough (but one Hauler first when there is none and a few
    // workers already: until then a worker has to stay free to carry).
    if (few) { b.mode = 'worker'; b.orders = !kinds.hauler && workers >= 3 ? { hauler: 1 } : {}; continue; }
    // Workers first while buildings stand empty; then the army gets its share as the game goes on.
    b.mode = S.mode === 'colony' ? 'worker' : workers < Math.min(staffed + MIN_FREE_WORKERS, wantWorkers) ? 'worker'
      : army < wantArmy ? (workers < wantWorkers ? 'alt' : 'warbot')
        : workers < wantWorkers ? 'worker' : spare <= AI_WORKER_ROOM ? 'off' : workers > wantWorkers + 4 ? 'warbot' : 'alt';
    // (Workers scrapped lately (see aiScrap): no spare ones made in their place, only the ones its buildings call for.)
    if (b.mode === 'alt' && aiScrapHeld(P, 'worker')) b.mode = 'warbot';
    // A third of the army with no Ammo: no more warbots until it's armed (the Alloy goes to Ammo).
    if (unarmed >= Math.max(4, army / 3) && (b.mode === 'warbot' || b.mode === 'alt')) b.mode = workers < wantWorkers ? 'worker' : 'off';
    if (botBanned(p, 'warbot') && (b.mode === 'warbot' || b.mode === 'alt')) b.mode = workers < wantWorkers ? 'worker' : 'off';
    b.orders = b.orders || {};
    for (const crew in crewNeed) if ((kinds[crew] || 0) < crewNeed[crew] && !(b.orders[crew] > 0)) b.orders[crew] = 1;
    // No Tanker left: Fuel only trickles by Hauler, so a new one comes before anything else.
    if (!(kinds.tanker > 0) && !(b.orders.tanker > 0)) b.orders.tanker = 1;
    // Saving up for missiles (or feeding the Missile Factory): the Foundry rests so Alloy and Chips
    // pile up, unless workers are badly short.
    // (Not while the army is well behind: warbots come first.)
    // Saving for a bridge to the enemy's island too: until it's built the army can't reach anyone.
    const bridging = P.bridgeWant > 0 && S.time - P.bridgeWant < 30;
    // A Tycoon rests it for missiles even with a small army (as long as a few warbots stand guard). The others only
    // while the army isn't well behind and the colony has the workers and the Haulers its buildings call for: with the
    // army alone to go by it stood off for missiles up to two fifths of a war while buildings stood empty. (An Easy
    // rival keeps the old rule.)
    // (An Architect rests it while it has three warbots more than its rival, six at least: by its army target, which
    // climbs with the clock, it hardly ever rested once a war was on, and its missile sites waited for goods the Foundry took.)
    const forMissiles = (saving || P.feedMissiles) && (st.missiles ? army >= Math.max(START_WARBOTS + 2, aiArmyOf(rivalOf(p)) + 3)
      : !armyBehind && (!smart || (workers >= wantWorkers && (kinds.hauler || 0) >= wantHaulers)));
    // (Saving for a crossing with a fair army already: the Foundry rests even if workers are short.)
    if (((forMissiles || needArmory || bridging) && workers >= staffed + 3) || (bridging && P.bridgeNeed && army >= Math.min(wantArmy, 8))) { b.mode = 'off'; delete b.orders.hauler; delete b.orders.truck; }
    // Haulers when short; while the army is well behind, only when badly short.
    else if ((kinds.hauler || 0) < (armyBehind ? Math.min(wantHaulers, 6) : wantHaulers) && !(b.orders.hauler > 0)) b.orders.hauler = 1;
    else if ((kinds.tanker || 0) < wantTankers && !(b.orders.tanker > 0)) b.orders.tanker = 1;
    // A forward Depot with supply orders gets a Freight Truck to keep it stocked.
    else if ((kinds.truck || 0) < wantTrucks && !(b.orders.truck > 0)) b.orders.truck = 1;
    // Howitzers for siege once the army is up: one, and one more for every ten warbots (at most three).
    const wantRockets = S.mode === 'colony' ? 0 : Math.max(P.gunTarget ? 1 : 0, S.time < lvl.grace ? 0 : Math.min(3, Math.floor(army / 10) + (army >= lvl.threshold ? 1 : 0)));
    if ((kinds.rocket || 0) < wantRockets && !(b.orders.rocket > 0) && !armyBehind && !botBanned(p, 'rocket') && me.some((a) => a.type === 'armory' && a.built)) b.orders.rocket = 1;
    // The army's specialists, a third of it at most once it's up: a Bulwark to lead its attacks for every five
    // warbots (two at most) and a Torch to burn down defences and Walls for every four (three at most, and only
    // with Fuel to fill them); one more of each against a rival dug in behind guns or Walls.
    if (S.mode !== 'colony' && S.time >= lvl.grace && army >= lvl.threshold && !armyBehind) {
      const foe = rivalOf(p), wb = kinds.warbot || 0;
      const dug = !!P.gunTarget || S.buildings.some((e) => !e.dead && e.built && e.owner === foe && (BDEFS[e.type].barrier || e.type === 'turret' || e.type === 'bunker' || e.type === 'minigun'));
      const wantB = Math.min(dug ? 3 : 2, Math.floor(wb / 5)), wantT = Math.min(dug ? 4 : 3, Math.floor(wb / 4) + (dug && wb >= 3 ? 1 : 0));
      if ((kinds.bulwark || 0) < wantB && !(b.orders.bulwark > 0) && !botBanned(p, 'bulwark')) b.orders.bulwark = 1;
      else if ((kinds.torch || 0) < wantT && !(b.orders.torch > 0) && !botBanned(p, 'torch') && goodTotal(p, 'fuel') >= 3) b.orders.torch = 1;
    }
    // An attack held back by enemy guns (P.shieldWant, in the last minute): a Bulwark to lead the next one, if it has
    // none, whatever the size of its army.
    if (S.mode !== 'colony' && S.time - (P.shieldWant ?? -999) < 60 && !(kinds.bulwark > 0) && !(b.orders.bulwark > 0) && !botBanned(p, 'bulwark')) b.orders.bulwark = 1;
    // A Trade Terminal is served only by Road Trains: one for it. Short of Crystal, one as soon as the Terminal is
    // wanted, before it stands: it takes four Chips, and once the Crystal had run out there were none left to make it.
    if ((tradeFirst || me.some((t) => BDEFS[t.type].terminal)) && !(kinds.roadtrain > 0) && !(b.orders.roadtrain > 0)) b.orders.roadtrain = 1;
    // No room under the bot limit but the army's: only the army's specialists (and a first Tanker) are made.
    if (!civilOk) for (const k in b.orders) if (!(BOTS[k] && BOTS[k].army) && !(k === 'tanker' && !(kinds.tanker > 0))) delete b.orders[k];
    // A kind it scrapped lately isn't ordered again (but a Tanker when it has none: see aiScrap).
    for (const k in b.orders) if (aiScrapHeld(P, k) && !(k === 'tanker' && !(kinds.tanker > 0))) delete b.orders[k];
    break;
  }
  // Scrap the extras: robots it has more of than it uses go to its Foundry to be recycled, a few at a time, when it has
  // no room under the bot limit for the army it wants (a colony that took a lot of buildings and lost them again, say,
  // sits at the limit full of Workers, trucks and crews it has no work for), when it's starved of Alloy or Chips, or
  // when they have stood idle for minutes while the Foundry waits for parts (see AI_SCRAP).
  if (S.mode !== 'colony') {
    const use = { worker: needWorkers, hauler: wantHaulers, tanker: wantTankers, truck: wantTrucks, agribot: 0, paver: 0,
      roadtrain: tradeFirst || wantTrucks || me.some((t) => BDEFS[t.type].terminal) ? 1 : 0 }; // (a Terminal to serve, or a far Depot)
    for (const b of me) { const crew = BDEFS[b.type].crew; if (crew) use[crew] = (use[crew] || 0) + 1; } // (sites too: they will take one)
    aiScrap(p, { me, few, smart, room: armyRoom - spare, use });
  }
  // Depots out towards the front keep Cement for building there (and Ammo), and take in nothing that is dug or cut:
  // a Depot among the far Mines was the nearest storage for their Ore, which then lay there, a long run from the
  // Smelters that stood waiting for it.
  for (const d of me) {
    if (d.type !== 'depot' || !d.built || dist(d.x, d.y, lander.x, lander.y) < 12) continue;
    if (!d.keep) { setKeep(d, 'cement', 12); if (S.mode !== 'colony') setKeep(d, 'ammo', 4); }
    if (smart && !d.reject) d.reject = { ore: true, crystal: true, stone: true, fiber: true };
  }

  // 3b) An enemy gun covering our buildings: our robots keep clear of them, so the work there has stopped.
  //     Knock it out (missile, Howitzer, bomber, warbots) so they can get back to work.
  if (S.mode !== 'colony') aiClearGuns(p, lvl);

  // 3c) Home guard (Medium and up): while four or more enemy warbots stand within 12 tiles of the base, or it has been
  //     hit in the last half minute (P.homeCall), the Command Base keeps about a third of the army (2 to 8), and each
  //     Keep up to three, out of every attack, raid and march (P.homeGuard, see keepAt), and every new and idle
  //     warbot goes there (goGarrison); otherwise 2, and the plain one when no enemy army can walk to the base. (New
  //     warbots used to walk to the Outpost nearest the enemy: at minute 34 a Hard rival had 26 of 28 out there and
  //     one at home. Kept back all the time, a third of the army never fought, and evenly matched wars ran out the
  //     clock.) With twice its rivals' warbots and two more it throws everything in: its Outposts keep no warbot back
  //     (keepW 0, as a player can set), so a march can gather the army; and while it masses for a march (P.massFor,
  //     see aiMarch) so do its Outposts with no enemy near. Each keeps one again afterwards. (`smart`: not Easy.)
  if (S.mode !== 'colony') {
    // (Only against an army that can walk to the base, `reach`: across the sea, where only a landing of six can come,
    // it kept a third of its warbots out of its own landings, and island wars it led ran out the clock.)
    let them = 0, near = 0, reach = 0;
    const hz = S.zone[tIdx(lander.x, lander.y)];
    if (smart) for (const u of S.bots) {
      if (u.dead || u.owner < 0 || !isArmy(u) || !foes(u.owner, p)) continue;
      them++;
      const h = u.inside ? getE(u.inside) : null, zi = h ? h.x : Math.floor(u.x), zj = h ? h.y : Math.floor(u.y);
      if (inMap(zi, zj) && S.zone[tIdx(zi, zj)] === hz) reach++;
      if (!u.inside && dist2(u.x, u.y, lander.x + 0.5, lander.y + 0.5) <= 144) near++;
    }
    if (smart && (near >= 4 || S.time - (lander.lastHit || -99) < 30)) P.homeCall = S.time + 20;
    // Under siege (P.homeCall), each doctrine answers in its own way: a Salvager (raider) raids at once (aiRaid), a
    // Warden (turtle) starts no push (aiPush), an Architect (tycoon) fires its Missiles into the army at its gates (below).
    if (P.homeCall > S.time && st.harass && P.nextRaid > S.time + 15 && !P.raid) P.nextRaid = S.time + 15;
    const pushing = P.pushOn > S.time; // (a Warden's big push: see aiPush)
    // (A Warden keeps a third home until its push, outnumbered or not: it digs in, then comes late in one go. A Salvager
    // keeps only the usual one, threatened or not: its home guard is thin, its bands go out from five minutes in.)
    if (smart) P.homeGuard = st.harass ? 0 : P.homeCall > S.time || (st.walls && !pushing && army < them * 1.5 + 4) ? clamp(Math.ceil(army / 3), 2, 8) : reach ? 2 : 0;
    const allIn = (smart && army >= lvl.threshold * 2 && army >= them * 2 + 2) || pushing, massing = P.massFor && S.time <= P.massFor.until;
    for (const b of me) {
      if (b.type !== 'outpost' || b.dead || !b.built) continue;
      if (allIn || (massing && S.time - (b.lastHit || -99) > 30 && !nearestEnemyBot(p, b.x + 0.5, b.y + 0.5, 10, true, false, true))) b.keepW = 0;
      else if (b.keepW !== undefined) delete b.keepW;
    }
  }

  // A passive rival (an early mission's, on Easy): it builds, grows and defends, but never strikes first.
  if (P.passive) return;
  // 4) Missiles: soften turrets and Outposts first, the Command Base once the army is big. (With
  //    two rivals, the one it's up against is the nearest still in the game.)
  const enemy = rivalOf(p);
  const rival = (o) => o >= 0 && o !== p && !S.players[o].out && !S.players[o].absent;
  if (S.mode !== 'colony' && S.time >= lvl.grace) {
    // Damage already on its way: never two missiles for a target one wrecks, nor a Command Base or Keep a
    // missile can knock no lower (see captureOnly).
    const dmg = BDEFS.silo.missile.damage, coming = new Map(), soft = P.soften && S.time < P.soften.until ? P.soften : null;
    for (const m of S.missiles) if (m.owner === p && m.target && !m.nuke) coming.set(m.target, (coming.get(m.target) || 0) + dmg);
    // An Architect on Normal or Hard rains them on what its rival lives on (aiMissileWorth), and under siege into the
    // army at its gates (aiMissileKnot).
    const rain = !!st.missiles && (S.difficulty === 'normal' || S.difficulty === 'hard');
    if (rain && P.homeCall > S.time) for (const silo of me) { const k = siloReady(silo) && aiMissileKnot(p, lander, silo); if (k) fireMissileAt(silo, k.i, k.j); }
    for (const silo of me) {
      if (!siloReady(silo)) continue;
      let best = null, bs = -Infinity;
      for (const e of S.buildings) {
        if (e.dead || e.owner !== enemy || !e.built) continue;
        const d = dist(silo.x, silo.y, e.x, e.y);
        if (d > BDEFS.silo.missile.range) continue;
        const left = e.armor - (coming.get(e.id) || 0);
        if (captureOnly(e) ? left <= missileFloor(e) + 2 : left <= 0) continue;
        const s = (rain ? aiMissileWorth(p, e, lvl) : e.type === 'turret' ? 10 : e.type === 'nukesilo' ? 12 : e.type === 'silo' || e.type === 'reactor' ? 9 : e.type === 'outpost' ? 8 :
          e.type === 'mortar' || e.type === 'disruptor' || e.type === 'bunker' || e.type === 'keep' ? 7 : e.type === 'lander' ? (S.victory === 'uplinks' ? 1 : 5) : 3) - d * 0.1 +
          (S.victory === 'uplinks' && holdsUplink(e) ? 7 : 0) + // (Uplinks: knock out the forts that hold them)
          (soft && aiDefReach(e) && dist2(e.x, e.y, soft.x, soft.y) <= 64 ? 6 : 0); // (the guns holding back an attack: see step 5)
        if (s > bs && !(rain && s < 1)) { bs = s; best = e; } // (an Architect's: nothing worth less, such as a Wall)
      }
      if (best && fireMissile(p, best)) coming.set(best.id, (coming.get(best.id) || 0) + dmg);
    }
  }

  // 4a) Nuclear race: fire a ready nuclear missile where it destroys the most, and clear out of the
  //     blast ring of any heading this way.
  if (nukeOn()) for (const silo of me) if (silo.type === 'nukesilo' && silo.armed && silo.built) aiFireNuke(p, silo);
  if (S.missiles.some((m) => m.nuke) && nukesThreatening(p).some((m) => !evacuating(p, m))) startEvac(p);

  // 4c) Naval maps: a Port, a Ferry, and beach landings on the enemy's shore.
  if (S.mode !== 'colony' && navalMap()) aiNaval(p, me, kinds, lvl, lander, !few && sites < maxSites);

  // 4e) Howitzers: shell the defences round what we're attacking, and hunt down the enemy's.
  if (S.mode !== 'colony') aiSiege(p);
  // 4f) Bulk trade: pick a contract at the Trade Terminal.
  aiTrade(p, me);
  // 4g) A Vulcan Bomber now and then.
  if (S.mode !== 'colony') aiBomber(p, me);

  // 4b) Raids on the enemy's supply lines, and answering the enemy's raids on ours.
  if (S.mode !== 'colony') aiCounterRaid(p);
  if (S.mode !== 'colony' && S.time >= lvl.grace) { aiRaid(p, lvl); aiRaidScorch(p); }

  // 5) Attack. Domination: a rival about to win on land is attacked at once, at the Outposts and Keeps that hold it.
  // Uplinks: the same for one whose clock is running, at the forts whose land holds its Uplinks (and a band of
  // warbots goes to jam the nearest of them).
  const domFoe = S.victory === 'domination' && S.dom && S.dom.lead >= 0 && S.dom.lead !== p ? S.dom.lead : -1;
  const upFoe = S.victory === 'uplinks' && (S.upLead ?? -1) >= 0 && S.upLead !== p ? S.upLead : -1;
  const upWant = S.victory === 'uplinks' && S.time - (P.lastAttack || -999) > 60 && ((S.upHeld && S.upHeld[p]) || 0) < uplinksNeeded() &&
    (S.uplinks || []).some((u) => u.owner >= 0 && u.owner !== p);
  if ((domFoe >= 0 || upFoe >= 0 || upWant) && S.time >= lvl.grace) P.nextAttack = Math.min(P.nextAttack, S.time);
  if (upFoe >= 0 && S.time >= lvl.grace) aiJamUplink(p, upFoe);
  // Medium, Normal and Hard rivals (`smart`) remember where their attacks were beaten (aiBattles), choose their marches
  // by what it takes to win there, mass before they march and storm the base with a decisive lead (aiMarch, aiStorm).
  if (P.stormOn) aiStorm(p);
  if (S.time < lvl.grace || S.time < P.nextAttack) return;
  aiBattles(P);
  let best = null, bestScore = -Infinity, bestAvail = 0, bestNeed = 0, heldB = null, heldScore = -Infinity;
  for (const b of S.buildings) {
    if (b.dead || !rival(b.owner)) continue; // whichever rival's building is in reach
    const sp = aiSpare(p, b, false), avail = sp.n;
    if (avail < 2) continue;
    // Enough for the garrison, the defences that cover it (aiGuards: Pulse Turrets, Minigun Nests, Bunkers, Mortar
    // Pits, Disruptor Towers, a Keep, garrisons close enough to sortie) and any warbots standing guard nearby, fewer
    // with Bulwarks at the head of the squad (they go first: aiFire); a gun, enough for its own fire too (aiGunNeed).
    // A fort already shot down to a quarter of its armor, or a construction site, needs only the usual band, or one
    // more than the guns over it are worth. Under heavy guns with no Bulwark to lead, a third more (aiBare).
    const weak = b.built && BDEFS[b.type].mil && b.armor <= BDEFS[b.type].armor * SORTIE_ARMOR;
    const gar = b.built && !weak ? Math.ceil(b.garrison.length * 1.3) : 0;
    const base = !b.built ? 2 : weak ? lvl.threshold : Math.max(lvl.threshold, gar + 2);
    if (avail < base || (gar && avail < gar + 2)) continue;
    if (aiBeaten(P, b, avail)) continue; // (not where an attack was just beaten, without half as many again: aiBattles)
    const guard = guardsNear(b, sp.shields), gun = aiDefReach(b) > 0;
    const need = aiBare(Math.max(base, !b.built || weak ? guard + 1 : gar + 2 + guard, gun ? aiGunNeed(b, sp.shields) : 0), gun ? aiGunNeed(b) - 1 : guardsNear(b), sp.shields);
    const def = BDEFS[b.type];
    let score = (def.mil ? 12 : 0) + (b.type === 'lander' ? (S.victory === 'uplinks' ? 5 : 25) : 0) - dist(b.x, b.y, lander.x, lander.y) * 0.4 - b.garrison.length * 2;
    if (b.owner === domFoe && b.built && def.mil && def.terr && b.type !== 'lander') score += 30;
    // Short of Crystal: a fort whose land holds Crystal is worth more (taken, its land and the clusters on it are ours).
    if (crShort && b.built && def.mil && def.terr) score += Math.min(crystalHeld(b, def.terr), 80) * 0.1;
    // A Salvager (raider) goes for what the enemy lives on: a working building, a Fuel Station or a Depot over a fort
    // (where little guards it: it got this far). (It used to attack forts twice as often as anything else.)
    if (st.harass && b.built && !def.mil && !def.barrier && (def.staff || def.charger || def.store)) score += 16;
    if (S.victory === 'uplinks' && holdsUplink(b)) score += b.owner === upFoe ? 40 : 30;
    if (!b.built) score -= 8;
    // Held back by the guns over it (it had the warbots for the rest): noted, for what it does instead (below). A
    // mission's scripted rival (P.bold: Hold the Line's Herald) makes its assault whatever the guns.
    if (avail < need && !P.bold) { if (score > heldScore) { heldScore = score; heldB = b; } continue; }
    score -= guard; // (an unguarded target, if there's one as good)
    if (score > bestScore) { bestScore = score; best = b; bestAvail = avail; bestNeed = need; }
  }
  if (best) {
    // A target under a gun: the gun first. Warbots on an attack shoot back only at robots, so a squad sent at a building
    // a turret or Minigun Nest covers stood there hitting it while the gun shot them down; at the gun they knock it out.
    const gun = aiDefReach(best) ? null : getE(aiFirstGun(best.owner, best.x, best.y, best, (e) => attackAvailable(p, e) >= bestNeed));
    // (Not at walls the band couldn't shoot its way through: see attackBreach. The place is left alone a minute.)
    const tg = gun || best, n = gun ? attackAvailable(p, gun) : bestAvail, br = attackBreach(p, tg, n);
    if (br.need > br.shots) { aiWalled(P, tg); return; }
    const was = new Set();
    if (smart) for (const u of S.bots) if (!u.dead && u.owner === p && u.task && u.task.type === 'attack' && u.task.target === tg.id) was.add(u.id);
    const sent = sendAttack(p, tg, n, false, false, true);
    if (smart && sent && tg.built) (P.fights = P.fights || []).push({ x: tg.x, y: tg.y, n: sent, t: S.time, ids: S.bots.filter((u) => !u.dead && u.owner === p && u.task && u.task.type === 'attack' && u.task.target === tg.id && !was.has(u.id)).map((u) => u.id) });
    P.siegeAt = { x: best.x, y: best.y, until: S.time + 120 };
    P.nextAttack = S.time + 25;
    P.lastAttack = S.time;
    return;
  }
  // Nothing it can take: the best target the guns held back gets softened up while the army gathers (its Howitzers
  // shell the defences round it, its Missiles go for them, see aiSiege and step 4), and the Foundry makes a Bulwark
  // to lead the next attack (P.shieldWant).
  if (heldB) {
    P.shieldWant = S.time;
    if (!(P.siegeAt && S.time < P.siegeAt.until)) P.siegeAt = { x: heldB.x, y: heldB.y, until: S.time + 60 };
    P.soften = { x: heldB.x, y: heldB.y, until: S.time + 60 };
  }
  // A big army with nothing in reach marches on an enemy garrison (a rally flag beside it: the warbots fight what
  // they meet and attack what stands there): Medium and up, the one that takes the fewest to beat, with enough, or it
  // masses first; with a decisive lead, a storm of the enemy Command Base (aiMarch). An Easy rival marches on the
  // nearest, and with twice the enemy's army on the enemy Command Base itself.
  const enemyArmy = S.bots.reduce((n, u) => n + (!u.dead && u.owner === enemy && isArmy(u) ? 1 : 0), 0);
  const crushing = army >= lvl.threshold * 2 && army >= enemyArmy * 2 + 2;
  if (P.massFor && S.time > P.massFor.until) P.massFor = null;
  if (st.push) aiPush(p, lvl, army, enemyArmy);
  const pushing = P.pushOn > S.time; // (a Warden marches only on its push)
  if ((st.push ? pushing : army >= lvl.threshold * 2) && S.time - (P.lastMarch || -999) > 120 && !(P.march && rallyById(P.march)) && !P.stormOn) {
    let tgt = null, bd = Infinity;
    const enemyBase = getE(S.players[enemy].lander);
    // Uplinks: the nearest fort holding one of the enemy's Uplinks comes first, even ahead of a crushed rival's Command Base.
    if (S.victory === 'uplinks') for (const b of S.buildings) {
      if (b.dead || b.owner !== enemy || !holdsUplink(b)) continue;
      const d = dist2(b.x, b.y, lander.x, lander.y);
      if (d < bd) { bd = d; tgt = b; }
    }
    if (tgt) { /* (an Uplink fort) */ }
    else if (smart) { if (aiMarch(p, lvl, enemy, army, enemyArmy, crushing)) return; }
    else if (crushing && enemyBase && !enemyBase.dead && enemyBase.owner === enemy) tgt = enemyBase;
    else for (const b of S.buildings) {
      if (b.dead || b.owner !== enemy || !b.built || !BDEFS[b.type].mil) continue;
      const d = dist2(b.x, b.y, lander.x, lander.y);
      if (d < bd) { bd = d; tgt = b; }
    }
    if (tgt) {
      let spot = null;
      for (const [di, dj] of [[1, 1], [-1, 1], [1, -1], [-1, -1], [2, 0], [-2, 0], [0, 2], [0, -2]]) {
        const i = tgt.x + di, j = tgt.y + dj;
        if (inMap(i, j) && walkable(tIdx(i, j)) && !S.bAt[tIdx(i, j)] && S.zone[tIdx(i, j)] === homeZone(p)) { spot = { i, j }; break; }
      }
      // A march may empty the garrisons far behind the lines (a big empire keeps one warbot in each).
      // Against a rival with next to no army, a small band is enough to finish it; and either way, more for the
      // guns that cover the flag (their worth in warbots: aiGuards, less what its Bulwarks take, which lead it).
      const sp = spot ? aiSpare(p, { x: spot.i, y: spot.j }, 'flag') : null, avail = sp ? sp.n : 0;
      const guns = spot ? Math.ceil(aiFire(aiGuards(tgt.owner, spot.i, spot.j, 2, null).filter((e) => aiDefReach(e.b)), sp.shields) - 1e-9) : 0;
      const need = (crushing ? Math.max(4, enemyArmy * 2 + 2) : pushing ? lvl.threshold : lvl.threshold * 2) + guns;
      if (spot && avail >= need) {
        const { sent, rally } = sendToRally(p, spot.i, spot.j, pushing ? Math.min(30, avail) : Math.min((crushing ? 22 : 14) + guns, crushing ? avail : avail - 2), true, false, true);
        if (sent) { rally.first = aiFirstGun(tgt.owner, spot.i, spot.j); P.march = rally.id; P.lastMarch = S.time; return; }
      } else if (spot && avail >= need - guns) P.shieldWant = S.time; // (held back by the guns there)
    }
  }
  // Recall a march that has nothing left to fight. (Not a storm: see aiStorm.)
  if (P.march && rallyById(P.march) && S.time - (P.lastMarch || 0) > 150 && !(P.stormOn && P.stormOn.id === P.march)) { recallRally(P.march); P.march = 0; }
  // A big army with nothing in reach: push a forward Outpost toward the enemy Command Base.
  const enemyL = getE(S.players[enemy].lander);
  if (enemyL && army >= lvl.threshold * 2 && S.time - (P.lastAttack || 0) > 60 && siteCount(p) < maxSites && aiAffordable(p, 'outpost')) {
    let spot = null, bd = Infinity;
    // (Uplinks: toward the nearest one that isn't ours)
    const goal = S.victory === 'uplinks' ? (S.uplinks || []).filter((u) => u.owner !== p).sort((a, c) => dist2(a.x, a.y, lander.x, lander.y) - dist2(c.x, c.y, lander.x, lander.y))[0] || enemyL : enemyL;
    for (let j = 0; j < S.H; j++) for (let i = 0; i < S.W; i++) {
      const o = S.owner[j * S.W + i];
      if (o !== p && !(o < 0 && inReach(p, j * S.W + i))) continue; // our land, or no-one's within reach
      const d = dist(i, j, goal.x, goal.y);
      if (d < bd && canPlace(p, 'outpost', i, j, true).ok && !wouldBlock(j * S.W + i)) { bd = d; spot = { x: i, y: j }; }
    }
    if (spot) { placeSite(p, 'outpost', spot.x, spot.y); P.lastAttack = S.time - 30; }
  }
}

/**
 * Naval maps: once the colony runs (a Foundry, a few minutes in), a Port on its shore; with a fair army,
 * a Ferry for it; and every few minutes, with warbots to spare, a beach landing of up to six of them on
 * the shore beside the enemy building the Ferry can reach that's least covered by turrets and garrisons.
 */
function aiNaval(p, me, kinds, lvl, lander, canBuild) {
  const P = S.players[p];
  // Warbots it landed march on from the beach once there's nothing left to fight round the flag: the
  // nearest enemy building they can walk to (the enemy Command Base if it's not much further).
  for (const r of S.rallies) {
    if (r.owner !== p || !r.landing || S.time - r.landing < 15) continue;
    if (S.buildings.some((b) => !b.dead && foes(b.owner, p) && b.owner >= 0 && dist2(b.x + 0.5, b.y + 0.5, r.x, r.y) < 16)) continue;
    const z = S.zone[tIdx(Math.floor(r.x), Math.floor(r.y))];
    let tgt = null, bd = Infinity;
    for (const b of S.buildings) {
      if (b.dead || !foes(b.owner, p) || b.owner < 0 || BDEFS[b.type].wild || S.zone[tIdx(b.x, b.y)] !== z) continue;
      const d = dist(b.x, b.y, r.x, r.y) - (b.type === 'lander' ? 8 : 0);
      if (d < bd) { bd = d; tgt = b; }
    }
    if (tgt) for (const u of rallyMembers(r.id)) if (!(u.task && u.task.type === 'attack' && u.task.target === tgt.id)) { u.task = { type: 'attack', target: tgt.id }; u.path = null; }
  }
  // Armed warbots of ours left idle across the water (landed, with no garrison of ours there to go to)
  // go after the nearest enemy building on their island.
  const hz = homeZone(p);
  for (const u of S.bots) {
    if (u.dead || u.owner !== p || !isArmy(u) || u.inside || u.ferryWait || !botArmed(u)) continue;
    if (u.task && u.task.type !== 'garrison') continue;
    const z = S.zone[tIdx(Math.floor(u.x), Math.floor(u.y))], gb = u.task && getE(u.task.bld);
    if (z === hz || (gb && S.zone[tIdx(gb.x, gb.y)] === z)) continue;
    let tgt = null, bd = Infinity;
    for (const b of S.buildings) {
      if (b.dead || !foes(b.owner, p) || b.owner < 0 || BDEFS[b.type].wild || S.zone[tIdx(b.x, b.y)] !== z) continue;
      const d = dist(b.x, b.y, u.x, u.y) - (b.type === 'lander' ? 8 : 0);
      if (d < bd) { bd = d; tgt = b; }
    }
    if (tgt) { cancelTask(u); u.task = { type: 'attack', target: tgt.id }; u.path = null; }
  }
  if (S.time < 240 || !me.some((b) => b.type === 'foundry' && b.built)) return;
  const ports = me.filter((b) => BDEFS[b.type].port);
  if (!ports.length) {
    if (canBuild && aiAffordable(p, 'port')) { const spot = aiFindSpot(p, 'port', lander); if (spot) placeSite(p, 'port', spot.x, spot.y); }
    return;
  }
  const army = (kinds.warbot || 0) + (kinds.bulwark || 0) + (kinds.torch || 0); // (the whole army, specialists too)
  // Ships are built at the Port nearest home (its shipyard).
  const yard = ports.filter((b) => b.built).sort((a, b) => dist2(a.x, a.y, lander.x, lander.y) - dist2(b.x, b.y, lander.x, lander.y))[0];
  const ferry = S.bots.find((u) => !u.dead && u.owner === p && BOTS[u.type].ferry);
  if (!ferry && yard && army >= lvl.threshold && !(yard.yard && yard.yard.ferry > 0) && !botBanned(p, 'ferry')) orderAtYard(yard, 'ferry', 1);
  // Later on, a second Port out toward the enemy, kept stocked from home by a Container Ship (Cement for
  // building at the front, Ammo for the warbots there).
  if (ports.length === 1 && ports[0].built && S.time > 900 && canBuild && aiAffordable(p, 'port')) {
    const spot = aiFindSpot(p, 'port', lander);
    if (spot && dist(spot.x, spot.y, ports[0].x, ports[0].y) >= 15) placeSite(p, 'port', spot.x, spot.y);
  }
  const built = ports.filter((b) => b.built);
  if (built.length >= 2 && yard) {
    const far = built.reduce((a, b) => (dist2(b.x, b.y, lander.x, lander.y) > dist2(a.x, a.y, lander.x, lander.y) ? b : a));
    if (!far.keep) { setKeep(far, 'cement', 12); setKeep(far, 'ammo', 6); }
    if (!S.bots.some((u) => !u.dead && u.owner === p && u.type === 'cargoship') && !(yard.yard && yard.yard.cargoship > 0)) orderAtYard(yard, 'cargoship', 1);
  }
  if (!ferry || ferry.landing || !ferry.inside || S.time < lvl.grace || S.time - (P.lastLanding || -999) < 150) return;
  const port = getE(ferry.inside);
  if (!port || !BDEFS[port.type].port) return;
  const avail = rallyAvailable(p, port.x, port.y, true);
  if (avail < 4 || army < lvl.threshold + 2) return;
  // The beach: a shore tile the Ferry can reach beside an enemy building, scored by how close it is and
  // how little guards it (turrets and garrisons within 6 tiles count against it).
  let targets = S.buildings.filter((b) => !b.dead && b.owner >= 0 && foes(b.owner, p) && !BDEFS[b.type].wild && S.players[b.owner] && !S.players[b.owner].out);
  if (!targets.length) return;
  // A rival with next to no army left (the weakest, in a free-for-all): land right by its Command Base to finish it.
  let weak = -1, wa = 4;
  for (let o = 0; o < S.players.length; o++) {
    const eL = getE(S.players[o].lander);
    if (o === p || S.players[o].out || !eL || eL.dead || eL.owner !== o) continue;
    const n = S.bots.reduce((k, u) => k + (!u.dead && u.owner === o && isArmy(u) ? 1 : 0), 0);
    if (n < wa) { wa = n; weak = o; }
  }
  if (weak >= 0) targets = [getE(S.players[weak].lander)];
  const guard = (i, j) => targets.reduce((n, b) => n + (dist2(b.x, b.y, i, j) <= 36 ? (aiDefReach(b) ? 3 : 0) + (b.garrison ? b.garrison.length : 0) : 0), 0);
  let best = null, bs = Infinity;
  for (let j = 1; j < S.H - 1; j++) for (let i = 1; i < S.W - 1; i++) {
    const t = j * S.W + i, o = S.owner[t];
    if (o === p || S.terrain[t] !== T_GROUND || S.bAt[t]) continue;
    let near = Infinity;
    for (const b of targets) { const d = dist2(b.x, b.y, i, j); if (d < near) near = d; }
    if (near > 49 || landingBlocked(p, ferry, i, j)) continue;
    const sc = Math.sqrt(near) + guard(i, j) * 2;
    if (sc < bs) { bs = sc; best = { i, j }; }
  }
  if (!best) { P.lastLanding = S.time - 100; return; }
  // Not onto a beach under guns the boatload can't beat (two more than what covers it: aiGuards): look again later.
  const near = targets.reduce((a, b) => (!a || dist2(b.x, b.y, best.i, best.j) < dist2(a.x, a.y, best.i, best.j) ? b : a), null);
  if (near && Math.min(FERRY_SEATS, avail) < 2 + Math.ceil(aiFire(aiGuards(near.owner, best.i, best.j, 2, null), 0) - 1e-9)) { P.lastLanding = S.time - 100; return; }
  if (!orderLanding(p, ferry, best.i, best.j, Math.min(FERRY_SEATS, avail))) P.lastLanding = S.time;
  else P.lastLanding = S.time - 100;
}

/**
 * Islands (or any war where the enemy can't be reached on foot): bridge the sea toward it. Plan
 * the bridge from our shore that reaches other land for the least, weighted toward the enemy
 * Command Base; if our border doesn't reach a shore facing it yet, put an Outpost there first.
 * One bridge at a time.
 */
function aiBridge(p, maxSites) {
  if (!warOn()) return;
  const P = S.players[p], L = getE(P.lander), E = getE(S.players[rivalOf(p)].lander);
  if (!L || !E || L.owner !== p) return;
  const home = homeZone(p);
  // What to cross toward: a free Uplink we can't walk to (Uplinks), else the enemy Command Base. Where we can walk to
  // it but its home ground is a fortress (a mesa or plateau with one or two ramps up, which its guns hold), a Viaduct
  // straight onto that ground, from midgame on (see aiFortressSpan).
  const T = aiCrossTarget(p, home) || (S.zone[tIdx(E.x, E.y)] !== home ? E : null);
  if (!T) { if (S.time - (P.lastBridge || -999) >= 12) { P.lastBridge = S.time; aiFortressSpan(p, home, E); } return; }
  if (S.time - (P.lastBridge || -999) < 12) return;
  P.lastBridge = S.time;
  // One of our bridges is going up already (one its workers can't get to for a long while is called off).
  P.bridgeSince = P.bridgeSince || {};
  let pending = false;
  for (const k in P.bridgeSince) {
    if (S.plan[k] !== p + 1) { delete P.bridgeSince[k]; continue; }
    if (S.time - P.bridgeSince[k] > 240) { cancelPlan(+k); delete P.bridgeSince[k]; } else pending = true;
  }
  if (pending) return;
  // Viaducts of ours that have been knocked down: remember where, and try somewhere else for a while.
  P.viaSeen = P.viaSeen || {}; P.viaLost = P.viaLost || {};
  for (const id in P.viaSeen) { const v = getE(+id); if (!v || v.dead) { P.viaLost[P.viaSeen[id]] = S.time; delete P.viaSeen[id]; } }
  for (const v of S.buildings) if (!v.dead && v.owner === p && v.type === 'viaduct' && !v.far) P.viaSeen[v.id] = tIdx(v.x, v.y);
  // A Viaduct of ours is still going up.
  if (S.buildings.some((v) => !v.dead && v.owner === p && v.type === 'viaduct' && !v.built)) return;
  const W = S.W, N = W * S.H;
  const nb = (t, fn) => { const i = t % W; if (i > 0) fn(t - 1); if (i < W - 1) fn(t + 1); if (t >= W) fn(t - W); if (t + W < N) fn(t + W); };
  const sea = (t) => bridgeable(t) && !S.road[t] && !S.plan[t] && !S.bAt[t] && !scorched(t);
  const steps = new Int16Array(N).fill(-1), from = new Int32Array(N).fill(-1), q = [];
  // Start from water at our own shore (our land, inside our border).
  for (let t = 0; t < N; t++) {
    if (!sea(t) || !canRoad(p, t % W, (t / W) | 0)) continue;
    let shore = false;
    nb(t, (u) => { if (S.terrain[u] === T_GROUND && S.zone[u] === home && S.owner[u] === p) shore = true; });
    if (shore) { steps[t] = 1; q.push(t); }
  }
  let best = -1, bestS = Infinity;
  for (let h = 0; h < q.length; h++) {
    const t = q[h];
    nb(t, (u) => {
      if (S.terrain[u] === T_GROUND && S.zone[u] >= 0 && S.zone[u] !== home) {
        const s = steps[t] * 3 + dist(u % W, (u / W) | 0, T.x, T.y);
        if (s < bestS) { bestS = s; best = t; }
      } else if (steps[t] < 9 && sea(u) && steps[u] < 0) { steps[u] = steps[t] + 1; from[u] = t; q.push(u); }
    });
  }
  if (best >= 0) {
    const tiles = [];
    for (let t = best; t >= 0; t = from[t]) tiles.push(t);
    tiles.reverse(); // from the shore out
    const cost = {};
    for (const t of tiles) { const c = crossCost(t); for (const g in c) cost[g] = (cost[g] || 0) + c[g]; }
    // Short of Cement or Alloy: the Foundry rests until the bridge is paid for (see aiThink).
    if (!canAffordRoad(p, cost)) { P.bridgeWant = S.time; return; }
    P.bridgeWant = 0;
    for (const t of tiles) { if (buildRoad(p, t % W, (t / W) | 0)) break; P.bridgeSince[t] = S.time; }
    return;
  }
  // A Viaduct of ours landed on a mesa with no Outpost yet: claim that mesa first, with an Outpost
  // on the ground the Viaduct's end claimed, on the side toward the enemy.
  const landed = S.buildings.find((v) => !v.dead && v.owner === p && v.type === 'viaduct' && v.far && v.built &&
    !S.buildings.some((o) => !o.dead && o.owner === p && BDEFS[o.type].mil && dist2(o.x, o.y, v.x, v.y) <= 49));
  if (landed && siteCount(p) < maxSites) {
    if (!aiAffordable(p, 'outpost') || S.buildings.some((b) => !b.dead && b.owner === p && b.type === 'outpost' && !b.built)) return;
    let best = null, bs = Infinity;
    for (let j = landed.y - VIA_CLAIM; j <= landed.y + VIA_CLAIM; j++) for (let i = landed.x - VIA_CLAIM; i <= landed.x + VIA_CLAIM; i++) {
      if (!inMap(i, j) || S.owner[tIdx(i, j)] !== p || S.zone[tIdx(i, j)] !== home) continue;
      const sc = dist(i, j, T.x, T.y);
      if (sc < bs && canPlace(p, 'outpost', i, j, true).ok && !wouldBlock(tIdx(i, j))) { bs = sc; best = [i, j]; }
    }
    if (best) { placeSite(p, 'outpost', best[0], best[1]); return; }
  }
  // No water to bridge (Sky islands): a Viaduct from our clifftop across the canyon, onto a clifftop
  // our border already reaches if there is one (so we can build there), else onto no-one's land.
  const via = aiViaductSpot(p, home, T);
  if (via) {
    const cost = viaductCost(via.a % W, (via.a / W) | 0, via.b % W, (via.b / W) | 0);
    if (!canPay(p, cost)) { P.bridgeWant = S.time; P.bridgeNeed = cost; return; }
    P.bridgeWant = 0; P.bridgeNeed = null;
    placeViaduct(p, via.a % W, (via.a / W) | 0, via.b % W, (via.b / W) | 0);
    return;
  }
  // No crossing from inside our border yet: an Outpost on the shore facing the nearest land toward the enemy.
  if (siteCount(p) >= maxSites || !aiAffordable(p, 'outpost')) return;
  if (S.buildings.some((b) => !b.dead && b.owner === p && b.type === 'outpost' && !b.built)) return;
  let tx = -1, ty = -1, td = Infinity;
  const lowest = S.elev[tIdx(L.x, L.y)] - VIA_RISE;
  for (let t = 0; t < N; t++) {
    if (S.terrain[t] !== T_GROUND || S.zone[t] < 0 || S.zone[t] === home || S.elev[t] < lowest) continue;
    const i = t % W, j = (t / W) | 0, d = dist(i, j, L.x, L.y) + dist(i, j, T.x, T.y) * 0.6;
    if (d < td) { td = d; tx = i; ty = j; }
  }
  if (tx < 0) return;
  const cands = [];
  for (let t = 0; t < N; t++) if (S.owner[t] === p && S.terrain[t] === T_GROUND && S.zone[t] === home && !S.bAt[t]) cands.push([dist(t % W, (t / W) | 0, tx, ty), t]);
  cands.sort((a, b) => a[0] - b[0]);
  for (let k = 0; k < Math.min(cands.length, 40); k++) {
    const t = cands[k][1], i = t % W, j = (t / W) | 0;
    if (canPlace(p, 'outpost', i, j, true).ok && !wouldBlock(t)) { placeSite(p, 'outpost', i, j); return; }
  }
}

/** Uplinks: the nearest free Uplink player p can't walk to (across water or a canyon), to cross toward; or null. */
function aiCrossTarget(p, home) {
  const L = getE(S.players[p].lander);
  if (S.victory !== 'uplinks' || !S.uplinks || !L) return null;
  let best = null, bd = Infinity;
  for (const u of S.uplinks) {
    const z = S.zone[tIdx(u.x, u.y)];
    if (u.owner >= 0 || z === home || z < 0) continue;
    const d = dist2(u.x, u.y, L.x, L.y);
    if (d < bd) { bd = d; best = u; }
  }
  return best;
}

/**
 * Player q's home ground if it is a fortress (Three Mesas and Plateaus): the area on its Command Base's level round it (open ground, joined
 * without a ramp), when no more than six ramp tiles lead off it (a mesa or plateau: one, two or three ramps two lanes
 * wide) and it is big enough to hold a colony. A mask of its tiles, or null.
 */
function fortressHome(q) {
  const L = getE(S.players[q] && S.players[q].lander), SH = SHAPE_PRESETS[(S.settings && S.settings.shape) || 0] || {};
  if (!L || L.dead || !(SH.mesas || SH.plateau)) return null; // (the maps built round them: elsewhere a few ramps are just the lie of the land)
  const W = S.W, N = W * S.H, t0 = tIdx(L.x, L.y), lv = S.elev[t0], mask = new Uint8Array(N), list = [t0];
  mask[t0] = 1;
  for (let h = 0; h < list.length; h++) {
    const t = list[h], i = t % W;
    for (const u of [i > 0 ? t - 1 : -1, i < W - 1 ? t + 1 : -1, t - W, t + W]) {
      if (u < 0 || u >= N || mask[u] || S.terrain[u] !== T_GROUND || S.elev[u] !== lv) continue;
      mask[u] = 1; list.push(u);
    }
    if (list.length > N / 3) return null; // (half the planet: open country, not a fortress)
  }
  const exits = new Set(); // (the ramp tiles that lead off it: a ramp sits on the lower tile of its step)
  for (const t of list) {
    const i = t % W;
    for (const u of [i > 0 ? t - 1 : -1, i < W - 1 ? t + 1 : -1, t - W, t + W]) {
      if (u < 0 || u >= N || mask[u] || S.terrain[u] !== T_GROUND || Math.abs(S.elev[u] - lv) !== 1) continue;
      if (S.ramp[u] && S.elev[u] < lv) exits.add(u);
      else if (S.ramp[t] && S.elev[u] > lv) exits.add(t);
    }
  }
  return exits.size <= 6 && list.length >= 60 ? mask : null;
}

/**
 * The enemy can be walked to, but its home ground is a fortress (fortressHome): from midgame, with the goods to
 * spare, a Viaduct from a clifftop of ours straight onto that ground, out of its guns' reach, so an attack doesn't
 * have to come up the one ramp they hold. One at a time, and no more than two standing onto the same fortress.
 */
function aiFortressSpan(p, home, E) {
  const P = S.players[p];
  if (S.time < AI_FORTRESS_SPAN_AT || S.buildings.some((v) => !v.dead && v.owner === p && v.type === 'viaduct' && !v.built)) return;
  const mask = fortressHome(E.owner);
  if (!mask) return;
  const L = getE(P.lander);
  if (L && mask[tIdx(L.x, L.y)]) return; // (our own Command Base on it: an ally's, or a shared plateau)
  const onto = S.buildings.filter((v) => !v.dead && v.owner === p && v.type === 'viaduct' && v.far && mask[tIdx(v.x, v.y)]).length;
  if (onto >= 2) return;
  const via = aiViaductSpot(p, home, E, mask);
  if (!via) return;
  const cost = viaductCost(via.a % S.W, (via.a / S.W) | 0, via.b % S.W, (via.b / S.W) | 0);
  // (Only with the goods to spare: the colony and its army come first.)
  const have = spendable(p);
  for (const g in cost) if ((have[g] || 0) < cost[g] * 2 + 10) return;
  placeViaduct(p, via.a % S.W, (via.a / S.W) | 0, via.b % S.W, (via.b / S.W) | 0);
}

/**
 * The best Viaduct for player p to put up toward enemy base E: from a clifftop tile of ours (in
 * our border, where our bots go) straight across lower ground to a clifftop in another area, as
 * close to the enemy as possible, and short. Far ends inside our border come first. {a, b, owned} or null.
 * With `onto` (a mask: a rival's fortress), to a clifftop on it instead, never into its guns' reach.
 */
function aiViaductSpot(p, home, E, onto) {
  const W = S.W, N = W * S.H, lost = S.players[p].viaLost || {};
  let best = null, bs = Infinity;
  for (let a = 0; a < N; a++) {
    if (S.owner[a] !== p || S.zone[a] !== home || S.terrain[a] !== T_GROUND || S.bAt[a] || S.res[a] || S.ramp[a]) continue;
    const ai = a % W, aj = (a / W) | 0;
    for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      // Only from a rim: the next tile drops away.
      if (!inMap(ai + di, aj + dj)) continue;
      const n1 = tIdx(ai + di, aj + dj);
      if (S.terrain[n1] === T_GROUND && S.elev[n1] >= S.elev[a]) continue;
      for (let k = VIA_MIN; k <= VIA_MAX; k++) {
        const bi = ai + di * k, bj = aj + dj * k;
        if (!inMap(bi, bj)) break;
        const b = tIdx(bi, bj);
        if (S.terrain[b] !== T_GROUND || (onto ? !onto[b] : S.zone[b] === home || S.zone[b] < 0) || Math.abs(S.elev[b] - S.elev[a]) > VIA_RISE) continue;
        if (onto && (gunCovers(p, b) || gunCovers(p, a))) break;
        if (viaductBlocked(p, ai, aj, bi, bj)) continue;
        if (dist(bi, bj, E.x, E.y) > dist(ai, aj, E.x, E.y) - 2) break; // only spans that bring us closer
        const owned = S.owner[b] === p;
        // Not into the enemy's guns (they'd shoot it down as soon as it's up), nor where one was just knocked down.
        const shot = (gunCovers(p, b) ? 18 : 0) + (gunCovers(p, a) ? 10 : 0) + (lost[a] && S.time - lost[a] < 240 ? 25 : 0);
        const sc = dist(bi, bj, E.x, E.y) + k * 0.8 - (owned ? 20 : 0) + shot;
        if (sc < bs && canPlace(p, 'viaduct', ai, aj, true).ok) { bs = sc; best = { a, b, owned }; }
        break; // the first clifftop across is the one
      }
    }
  }
  return best;
}

/**
 * Chokepoint maps (Normal and Hard): once the mouth of a channel through the crags on our side is
 * inside our border, wall it off, with a Gate where our own bots still get through it to the middle of the map (see
 * aiWallGate: an existing Gate, our road through it, or the middle tile), and put back any piece the enemy breaks.
 * A mouth no Gate would keep open is left alone: a Wall on the one tile that leads on, and the Gate on a spur beside
 * it, shut the colony's own warbots in.
 * Cement for the colony comes first.
 */
function aiWalls(p) {
  const cp = chokePass();
  if (!cp || !warOn() || (S.difficulty === 'easy' && !aiStyle(p).walls) || S.time < 240) return;
  const P = S.players[p], L = getE(P.lander);
  if (!L) return;
  const bottom = L.y > S.H / 2;
  // Each channel's mouth on our side of the crags, once it's inside our border.
  const mouths = cp.mouths.map((m) => m.filter((t) => (((t / S.W) | 0) > S.H / 2) === bottom && S.terrain[t] === T_GROUND)).filter((m) => m.length);
  // (A mouth with every piece in place is looked at again twice a minute, in case it's one that was walled shut.)
  const recheck = S.time - (P.gateChk || -99) > 30;
  if (recheck) P.gateChk = S.time;
  for (const tiles of mouths) {
    if (tiles.some((t) => S.owner[t] !== p) || (!recheck && tiles.every((t) => S.bAt[t]))) continue;
    if (!recheck && spendable(p).cement < BDEFS.wall.cost.cement + 10) return; // (nothing to place yet: no need to walk the ground)
    const others = mouths.filter((m) => m !== tiles).flat();
    const gate = aiWallGate(p, L, tiles, others, bottom, false);
    if (gate < 0) {
      // Shut by a Wall of our own (a save from before the Gate was checked): the piece that stands in the way comes
      // down, and a Gate goes there next time.
      const w = aiWallGate(p, L, tiles, others, bottom, true);
      if (w >= 0) demolish(getE(S.bAt[w]));
      continue;
    }
    for (const t of tiles) {
      if (S.bAt[t]) continue;
      const kind = t === gate || S.road[t] || S.plan[t] ? 'gate' : 'wall';
      if (spendable(p).cement < BDEFS[kind].cost.cement + 10) return;
      const i = t % S.W, j = (t / S.W) | 0;
      if (canPlace(p, kind, i, j).ok) placeSite(p, kind, i, j);
    }
  }
}

/**
 * The tile of a channel mouth (`tiles`) for player p's Gate: one its bots can walk to from the Command Base (L)
 * without going through any mouth (`others`: the other mouths on its side), and from which, with a Wall on every
 * other free tile of this mouth (road tiles get Gates), they get on across the middle line of the map. A Gate already
 * standing comes first, then our road through the mouth, then the middle tile and outwards. -1 if there is none:
 * then the mouth isn't walled. With `walls`, the Wall of ours that stands on such a tile instead (or -1).
 */
function aiWallGate(p, L, tiles, others, bottom, walls) {
  const W = S.W, at = (t) => getE(S.bAt[t]);
  const isGate = (t) => !!at(t) && at(t).type === 'gate';
  // The ground our bots reach without going through a mouth.
  const home = new Uint8Array(W * S.H);
  for (const t of others) home[t] = 1;
  for (const t of tiles) home[t] = 1;
  aiFlood(p, L.y * W + L.x, home, bottom);
  const mid = (tiles.length - 1) / 2;
  const order = tiles.map((t, k) => ({ t, s: isGate(t) ? -2 : S.road[t] || S.plan[t] ? -1 : Math.abs(k - mid) })).sort((a, b) => a.s - b.s || a.t - b.t);
  for (const { t } of order) {
    if (walls ? !(at(t) && at(t).owner === p && at(t).type === 'wall') : S.bAt[t] && !isGate(t)) continue;
    const i = t % W;
    if (![i > 0 ? t - 1 : -1, i < W - 1 ? t + 1 : -1, t - W, t + W].some((u) => u >= 0 && home[u] === 2 && canStep(u, t))) continue;
    // On from there: not back over the home ground, nor through the tiles that get Walls.
    const seen = home.slice();
    for (const u of tiles) seen[u] = u !== t && !S.bAt[u] && !S.road[u] && !S.plan[u] ? 1 : 0;
    if (aiFlood(p, t, seen, bottom, true)) return t;
  }
  return -1;
}

/**
 * Flood out from tile `from` over the ground player p's bots can walk (stepping as they do, and through the
 * buildings that let them pass: their own Gates and Outposts), marking it 2 in `seen`; tiles already set there are
 * closed. True if the flood gets across the middle line of the map (to the far half from a base in the `bottom` half);
 * with `early`, it stops as soon as it does.
 */
function aiFlood(p, from, seen, bottom, early) {
  const W = S.W, N = W * S.H, mid = Math.floor(S.H / 2) * W, q = [from];
  const step = (a, b) => {
    if (b < 0 || b >= N || seen[b] || !walkable(b) || !canStep(a, b) || (S.bAt[b] && !passTile(b, p))) return;
    seen[b] = 2;
    q.push(b);
  };
  let across = false;
  seen[from] = 2;
  for (let h = 0; h < q.length; h++) {
    const a = q[h], i = a % W;
    if (bottom ? a < mid : a >= mid) { across = true; if (early) return true; }
    if (i > 0) step(a, a - 1);
    if (i < W - 1) step(a, a + 1);
    step(a, a - W);
    step(a, a + W);
  }
  return across;
}

/**
 * Pick the nuclear target: each rival building is a candidate centre; score what the blast would
 * take (military buildings and the Command Base count extra), minus our own buildings caught in it.
 */
function aiFireNuke(p, silo) {
  const R2 = NUKE.radius * NUKE.radius, enemy = rivalOf(p);
  let best = null, bs = 3;
  for (const c of S.buildings) {
    if (c.dead || c.owner !== enemy || dist(silo.x, silo.y, c.x, c.y) > NUKE.range) continue;
    let s = 0;
    for (const b of S.buildings) {
      if (b.dead || dist2(b.x, b.y, c.x, c.y) > R2) continue;
      const w = b.type === 'lander' ? 6 : BDEFS[b.type].mil ? 3 : b.type === 'nukesilo' || b.type === 'reactor' ? 5 : 1;
      s += b.owner === enemy ? w : -w * 2;
    }
    if (c.type === 'lander') s += 40; // (a direct hit on its Command Base ends the enemy colony)
    if (s > bs) { bs = s; best = c; }
  }
  if (best) fireNukeAt(silo, best.x, best.y);
}

/**
 * The army the AI aims for: its starting warbots until AI_ARMY_FROM seconds in, then about one
 * more a minute (scaled by difficulty), up to AI_ARMY_MAX.
 */
const AI_ARMY_FROM = 240, AI_ARMY_MAX = 30, AI_DEFENCE_AT = 300;
function aiWantArmy(lvl, p) {
  // A colony with many garrisons (a free-for-all winner owns two colonies' worth) needs more
  // warbots to man them all and still march. Its doctrine sets how fast the army grows.
  let extra = 0;
  if (p !== undefined) for (const b of S.buildings) if (!b.dead && b.owner === p && b.built && BDEFS[b.type].mil) extra++;
  const st = p !== undefined ? aiStyle(p) : PERSONALITIES.balanced;
  const from = AI_ARMY_FROM * (st.armyFrom || 1), rate = lvl.mult * (st.army || 1);
  // ...and never stops short of the rival's army: it keeps up with it, and a few more.
  let rivalArmy = 0;
  if (p !== undefined) { const e = rivalOf(p); for (const u of S.bots) if (!u.dead && u.owner === e && isArmy(u)) rivalArmy++; }
  const cap = Math.max(AI_ARMY_MAX, rivalArmy + 6) + Math.max(0, extra - 8);
  // Massing for a march (P.massFor, see aiMarch): that many, the home guard and one for each fort besides.
  const P = p !== undefined ? S.players[p] : null, mass = P && P.massFor && S.time <= P.massFor.until ? P.massFor.need + (P.homeGuard || 1) + extra : 0;
  return Math.max(Math.min(cap, START_WARBOTS + 1 + Math.floor((Math.max(0, S.time - from) / 60) * rate)), Math.min(mass, cap + 10));
}

/**
 * How far building b reaches as a defence against an army (tiles; 0: it isn't one): a Pulse Turret, Minigun Nest,
 * Mortar Pit, Disruptor Tower, a Bunker with armed warbots inside, a Keep (its roof cannon and gun slots). Loaded or
 * not (a gun that is out of ammo now may not be by the time the squad gets there); not one that is cut off or paused.
 */
function aiDefReach(b) {
  if (b.dead || !b.built || b.cut || b.paused || b.owner < 0) return 0;
  const def = BDEFS[b.type];
  if (b.type === 'turret') return turretRange(b);
  if (def.keep) return Math.max(turretRange(b), KEEP.fire);
  if (def.bunker) return armedIn(b) ? def.range + auraRange(b) : 0;
  if (def.minigun || def.mortar || def.disrupt) return def.range + auraRange(b);
  return 0;
}

/**
 * The defences of `owner` (and its allies) that would fire on an enemy army round tile (x, y), its target there or its
 * flag: each one whose reach comes within `pad` tiles of the spot (a squad stands round what it attacks, and comes in
 * from one side), as { b, v, shield } with what it's worth in warbots (v): a Pulse Turret 3, a Mortar Pit 3 (its shells
 * burst among a squad bunched on its way in), a Minigun Nest 2, a Disruptor Tower 2, a Bunker 2 for each armed warbot
 * inside, a Keep 3 for its roof cannon, 1.3 for each warbot at its gun slots and 1 for each of the rest (they come out
 * to fight); a quarter more for one in a Keep's aura (it fires a quarter faster); and the armed warbots of any other
 * garrison close enough to come out at them (one each). `shield`: its fire comes straight at the squad, so a Bulwark's
 * shield can take it (a Mortar lobs its shells over, a Disruptor's pulse and a sortie's warbots come from every side).
 * Never the building `except`.
 */
function aiGuards(owner, x, y, pad, except) {
  const out = [], cx = x + 0.5, cy = y + 0.5;
  for (const e of S.buildings) {
    if (e === except || e.dead || !e.built || e.owner < 0 || (e.owner !== owner && !allies(e.owner, owner))) continue;
    const def = BDEFS[e.type], r = aiDefReach(e);
    if (r) {
      if (dist2(e.x + 0.5, e.y + 0.5, cx, cy) > (r + pad) * (r + pad)) continue;
      const n = def.keep || def.bunker ? armedIn(e) : 0;
      const v = e.type === 'turret' || def.mortar ? 3 : def.keep ? 3 + 1.3 * Math.min(n, def.slots) + Math.max(0, n - def.slots) : def.bunker ? 2 * n : 2;
      out.push({ b: e, v: v * (!def.keep && keepOver(e) ? 1 / KEEP.rate : 1), shield: !def.mortar && !def.disrupt });
    } else if (def.mil && !def.bunker && e.garrison && e.garrison.length && dist2(e.x + 0.5, e.y + 0.5, cx, cy) <= (SORTIE_REACH + pad) * (SORTIE_REACH + pad)) {
      const n = armedIn(e);
      if (n) out.push({ b: e, v: n, shield: false });
    }
  }
  return out;
}

/** How much of a gun's fire (in warbots) a Bulwark's shield takes when it faces it: about one Pulse Turret's. */
const AI_SHIELD_TAKES = 2.25;
/**
 * The gun covering tile (x, y) for `owner` that a squad there should knock out first (aiGuards: a Pulse Turret, Minigun
 * Nest, Mortar Pit, Disruptor Tower or Bunker, the strongest, then the nearest, and `ok` of it if given), or 0. Not a
 * Keep or other fort: those are taken, not knocked out first.
 */
function aiFirstGun(owner, x, y, except, ok) {
  let best = null;
  for (const e of aiGuards(owner, x, y, 2, except)) {
    const def = BDEFS[e.b.type];
    if ((def.mil && !def.bunker) || !aiDefReach(e.b) || (ok && !ok(e.b))) continue;
    if (!best || e.v > best.v || (e.v === best.v && (dist2(e.b.x, e.b.y, x, y) - dist2(best.b.x, best.b.y, x, y) || e.b.id - best.b.id) < 0)) best = e;
  }
  return best ? best.b.id : 0;
}

/**
 * What guards g (aiGuards) come to against a squad led by `shields` Bulwarks: each Bulwark faces one gun firing
 * straight at the squad (the strongest left), and its shield takes up to AI_SHIELD_TAKES of that gun's worth (never
 * more than three quarters of it: shots get round it, and it's down a while once worn through). The rest counts in full.
 */
function aiFire(g, shields) {
  let f = 0, k = shields || 0;
  for (const e of g.slice().sort((a, c) => c.v - a.v || a.b.id - c.b.id)) {
    f += e.v;
    if (k > 0 && e.shield) { f -= Math.min(e.v * 0.75, AI_SHIELD_TAKES); k--; }
  }
  return f;
}

/**
 * What stands guard round building b besides its garrison (in warbots, rounded up): its owner's defences that
 * reach within two tiles of it (aiGuards: Pulse Turrets, Minigun Nests, Mortar Pits, Disruptor Towers, Bunkers,
 * Keeps, and the garrisons close enough to sortie), less what `shields` Bulwarks leading the attack take (aiFire),
 * plus its owner's warbots out in the field within 7 (on a rally flag, say).
 */
function guardsNear(b, shields) {
  let n = aiFire(aiGuards(b.owner, b.x, b.y, 2, b), shields);
  for (const u of S.bots) if (!u.dead && !u.inside && u.owner === b.owner && isArmy(u) && dist2(u.x, u.y, b.x + 0.5, b.y + 0.5) <= 49) n++;
  return Math.ceil(n - 1e-9);
}

/**
 * The army units of p's garrisons that an attack on `target` (sendAttack with `all`) or a flag at tile `target`
 * (sendToRally with `rear`, for all = 'flag') could send: { n, shields, by }, how many, how many of them Bulwarks
 * (they go first, sent with `lead`: a spare place in a garrison that has one goes to it), and per garrison, nearest
 * first, as they are drawn on ([spare, Bulwarks]).
 */
function aiSpare(p, target, all) {
  const out = { n: 0, shields: 0, by: [] };
  const flag = all === 'flag', srcs = flag ? rallySources(p, target.x, target.y, true, false) : attackSources(p, target, false, all);
  for (const b of srcs) {
    const n = flag ? spareFrom(b, true, false) : spareArmed(b, false, all);
    let sh = 0;
    for (const id of b.garrison) { const u = getE(id); if (u && botArmed(u) && BOTS[u.type].shield) sh++; }
    sh = Math.min(sh, n);
    out.n += n; out.shields += sh; out.by.push([n, sh]);
  }
  return out;
}
/** How many Bulwarks are among the first k units sent from spare `sp` (aiSpare): garrisons are drawn on nearest first. */
function aiShieldsIn(sp, k) {
  let sh = 0;
  for (const [n, s] of sp.by) { if (k <= 0) break; sh += Math.min(s, k); k -= n; }
  return sh;
}
/**
 * The squad to send from spare `sp` against something that takes need(shields) army units with that many Bulwarks
 * leading (and `help` already at it): { count, need }, count 0 when it can't be done. It sends a couple more than it
 * needs where it can, and works out the need again if the Bulwarks are in garrisons further off than that squad draws on.
 */
function aiSquad(sp, need, help) {
  let n = need(sp.shields), k = Math.min(sp.n, n - help + 2);
  const sh = aiShieldsIn(sp, k);
  if (sh < sp.shields) { n = need(sh); k = Math.min(sp.n, n - help + 2); }
  return sp.n > 0 && sp.n + help >= n ? { count: Math.max(1, k), need: n } : { count: 0, need: n };
}

/**
 * Raids: every few minutes a small band of warbots goes to the enemy's busiest road clear of its
 * turrets and garrisons, shoots up passing haulers, tears up the road (then hits whatever stands
 * near it), and comes home: RAID_TIME after it gets there, or as soon as it is outnumbered.
 */
const RAID_GAP = { easy: 320, medium: 250, normal: 180, hard: 120 };
const RAID_TIME = 60;    // seconds a raid lasts before the raiders head home
const RAID_FIRST = 200;  // the first raid comes this long after the grace period
function aiRaid(p, lvl) {
  const P = S.players[p], enemy = rivalOf(p);
  if (P.raid) {
    const r = rallyById(P.raid.id), band = r ? rallyMembers(P.raid.id) : [];
    // A Salvager's band forms up out of the enemy's land first (P.raid.to: the road tile it is going for, see below): once
    // the first of it gets there, the flag moves on to the road, and it has two seconds a tile and half a minute more.
    if (r && P.raid.to !== undefined && band.some((u) => dist2(u.x, u.y, r.x, r.y) <= 9)) {
      const ti = P.raid.to % S.W, tj = (P.raid.to / S.W) | 0;
      P.raid.until = S.time + 30 + 2 * dist(ti, tj, r.x, r.y);
      r.x = ti + 0.5; r.y = tj + 0.5; r.raid = true; delete P.raid.to;
      return;
    }
    // The raid's clock starts when the first raider reaches the flag (P.raid.at; it used to start as they set off, and
    // bands were called home before they got there), and the band comes home early when the enemy warbots within 5
    // tiles of it outnumber it.
    if (r && P.raid.at === 0 && P.raid.to === undefined && band.some((u) => dist2(u.x, u.y, r.x, r.y) <= 9)) { P.raid.at = S.time; P.raid.until = S.time + RAID_TIME; }
    let them = 0;
    if (band.length) {
      let cx = 0, cy = 0;
      for (const u of band) { cx += u.x / band.length; cy += u.y / band.length; }
      for (const u of S.bots) if (!u.dead && !u.inside && u.owner >= 0 && foes(u.owner, p) && isArmy(u) && dist2(u.x, u.y, cx, cy) <= 25) them++;
    }
    if (!r || S.time > P.raid.until || !band.length || them > band.length) {
      if (r) recallRally(P.raid.id);
      P.raid = null;
      P.nextRaid = S.time + (RAID_GAP[S.difficulty] || 170) / (aiStyle(p).raids || 1);
    }
    return;
  }
  const st = aiStyle(p);
  if (S.time < (P.nextRaid || lvl.grace + RAID_FIRST * (st.raidFirst || 1))) return;
  P.nextRaid = S.time + 30; // nothing worth raiding yet: look again soon
  if (HEAT.of !== S || !HEAT.flow) return;
  // Keep clear of every defence (Pulse Turrets, Minigun Nests, Bunkers, Mortar Pits, Disruptor Towers, Keeps: what they
  // reach, and the three and a half tiles round the flag where the raiders spread out and hit what stands), and of
  // garrisons with warbots in them.
  // (A Salvager keeps 10 tiles clear of any fort with an armed warbot in it, and 8 of enemy warbots out in the field:
  // most of its bands that never got there were met by them on the way.)
  const H = !!st.harass, guards = [];
  for (const b of S.buildings) {
    if (b.dead || b.owner < 0 || !foes(b.owner, p) || !b.built) continue;
    const r = aiDefReach(b);
    if (r) guards.push({ x: b.x, y: b.y, r2: (r + 3.5) * (r + 3.5) });
    else if (BDEFS[b.type].mil && armedIn(b) >= (H ? 1 : 2)) guards.push({ x: b.x, y: b.y, r2: H ? 100 : 56 }); // (beyond where a garrison sorties)
  }
  if (H) for (const u of S.bots) if (!u.dead && !u.inside && u.owner >= 0 && foes(u.owner, p) && isArmy(u)) guards.push({ x: u.x, y: u.y, r2: 64 });
  // (A Salvager counts what its band can wreck once the road is cut, too: half as much again for each of the enemy's
  // working buildings, Fuel Stations and Depots within 3 tiles.)
  const econ = H ? S.buildings.filter((b) => !b.dead && b.owner === enemy && b.built && !BDEFS[b.type].mil && (BDEFS[b.type].staff || BDEFS[b.type].charger || BDEFS[b.type].store)) : null;
  const spots = [];
  for (let t = 0; t < S.W * S.H; t++) {
    if (!S.road[t] || wayOwner(t) !== enemy || HEAT.flow[t] < 1) continue;
    const i = t % S.W, j = (t / S.W) | 0;
    if (guards.some((g) => dist2(g.x, g.y, i, j) < g.r2)) continue;
    let sc = HEAT.flow[t] - dist(i, j, S.W / 2, S.H / 2) * 0.05;
    if (H && sc > 0) { let n = 0; for (const b of econ) if (dist2(b.x, b.y, i, j) <= 9) n++; sc *= 1 + 0.5 * Math.min(n, 4); }
    spots.push({ t, s: sc });
  }
  if (!spots.length) return;
  spots.sort((a, c) => c.s - a.s || a.t - c.t);
  const size = st.raidSize || 3;
  // Every other raid, with a Torch of ours ready to burn (a full tank, in a garrison), on an enemy that farms: the
  // busiest road near its farmland instead, and the Torch goes along to scorch it (aiRaidTorch, aiRaidScorch).
  let pick = spots, farmRaid = false;
  if (!((P.raidN || 0) % 2) && S.bots.some((u) => !u.dead && u.owner === p && BOTS[u.type].flame && u.inside && scorchReady(u))) {
    const farms = aiFoeFarms(p), near = spots.filter(({ t }) => farms.some((f) => dist2(f.x, f.y, t % S.W, (t / S.W) | 0) <= AI_SCORCH_NEAR * AI_SCORCH_NEAR));
    if (near.length) { pick = near; farmRaid = true; }
  }
  // The busiest stretch whose way in doesn't run through the reach of a gun (the army goes round where it can: if the
  // way there still crosses one, there's no way round it); a few tried, from the best down.
  for (const { t } of pick.slice(0, 4)) {
    const i = t % S.W, j = (t / S.W) | 0;
    // (A Salvager's band may take the last warbot of a fort behind the lines: rear, see rallySources.)
    if (rallyAvailable(p, i, j, H) < size + (st.raidKeep ?? 2)) return; // keep enough warbots at home (a Raider sends all it can spare)
    if (aiRouteHot(p, i, j)) continue;
    // (Until they get there the raid has a walking allowance: two seconds a tile from home, and half a minute.) A
    // Salvager plants its flag first on the way there, out of the enemy's land (4 tiles clear of it), so the enemy's
    // warbots aren't waiting at the road when it arrives (they answer a flag in their land: aiCounterRaid).
    const L = getE(P.lander), stage = H && L ? aiRaidStage(p, t, L) : -1;
    const at = stage >= 0 ? stage : t, ai = at % S.W, aj = (at / S.W) | 0;
    const { sent, rally } = sendToRally(p, ai, aj, size, H);
    if (sent) {
      rally.raid = stage < 0;
      P.raid = { id: rally.id, at: 0, until: S.time + RAID_TIME + 30 + 2 * (L ? dist(ai, aj, L.x, L.y) : 30) };
      if (stage >= 0) P.raid.to = t;
      P.raidN = (P.raidN || 0) + 1;
      if (farmRaid) aiRaidTorch(p, rally, ai, aj);
    }
    return;
  }
}

/** Built Bio Farms of p's enemies that still have soil to work. */
function aiFoeFarms(p) { return S.buildings.filter((b) => !b.dead && b.built && b.type === 'farm' && b.owner >= 0 && foes(b.owner, p) && !b.depleted); }

/**
 * Scorched earth on a raid: a Torch with a full tank on our raid's flag (and not in a fight) burns the nearest patch
 * of an enemy Bio Farm's soil within AI_SCORCH_REACH tiles of it that no enemy gun covers, one patch each (its whole
 * tank: doScorch), then refills and comes back to the flag if the raid's still on. A farmland raid (AI_SCORCH_NEAR:
 * a road that near an enemy farm) takes a Torch along (aiRaidTorch).
 */
const AI_SCORCH_NEAR = 6, AI_SCORCH_REACH = 8;
function aiRaidScorch(p) {
  const P = S.players[p];
  if (!P.raid) return;
  const torches = rallyMembers(P.raid.id).filter((u) => BOTS[u.type].flame && u.task && u.task.type === 'hold' && !u.fight && scorchReady(u));
  if (!torches.length) return;
  const farms = aiFoeFarms(p), r2 = BDEFS.farm.radius * BDEFS.farm.radius + 0.3, R = AI_SCORCH_REACH;
  if (!farms.length) return;
  const taken = new Set();
  for (const v of S.bots) if (!v.dead && v.task && v.task.type === 'scorch') taken.add(v.task.tile);
  for (const u of torches) {
    const ui = Math.floor(u.x), uj = Math.floor(u.y), zone = S.zone[tIdx(ui, uj)];
    let best = -1, bd = Infinity;
    for (let j = uj - R; j <= uj + R; j++) for (let i = ui - R; i <= ui + R; i++) {
      if (!inMap(i, j)) continue;
      const t = tIdx(i, j), d = dist2(i, j, ui, uj);
      if (d >= bd || !S.fert[t] || taken.has(t) || S.zone[t] !== zone || scorchTileWhy(t) || gunCovers(p, t)) continue;
      if (!farms.some((f) => dist2(f.x, f.y, i, j) <= r2)) continue;
      bd = d; best = t;
    }
    if (best < 0) continue;
    taken.add(best);
    u.resume = { type: 'hold', rally: u.task.rally, slot: u.task.slot };
    u.task = { type: 'scorch', tile: best };
    u.path = null;
  }
}

/** A farmland raid (rally r, at (i, j)): one Torch with a full tank from our nearest garrison goes too, if none is in the squad. */
function aiRaidTorch(p, r, i, j) {
  if (rallyMembers(r.id).some((u) => BOTS[u.type].flame)) return;
  for (const b of rallySources(p, i, j, false, false)) {
    const k = b.garrison.findIndex((id) => { const u = getE(id); return !!u && BOTS[u.type].flame && scorchReady(u) && freeToGo(u, b); });
    if (k < 0) continue;
    const u = getE(b.garrison[k]), slot = rallyMembers(r.id).length;
    b.garrison.splice(k, 1);
    u.inside = 0; u.path = null;
    u.task = { type: 'hold', rally: r.id, slot };
    return;
  }
}

/**
 * Where a Salvager's band forms up before a raid on road tile t: the first tile on the straight way back from t to its
 * Command Base L that its warbots can walk to and that lies 4 tiles clear of every rival's land, if that is within
 * 24 tiles of t; else -1 (it goes straight there).
 */
function aiRaidStage(p, t, L) {
  const ti = t % S.W, tj = (t / S.W) | 0, D = dist(ti, tj, L.x, L.y), z = S.zone[t];
  for (let k = 1; k <= Math.min(24, D); k++) {
    const i = Math.round(ti + ((L.x - ti) * k) / D), j = Math.round(tj + ((L.y - tj) * k) / D);
    if (!inMap(i, j)) continue;
    const u = tIdx(i, j);
    if (S.zone[u] !== z || !walkable(u) || S.bAt[u]) continue;
    if (!rivalLandNear(p, i, j, 4)) return k < 3 ? -1 : u;
  }
  return -1;
}

/**
 * Does the way p's army would take to tile (i, j), from the nearest of its garrisons that could send warbots there,
 * cross ground an enemy gun reaches (dangerMap)? (Routes on the march go round guns where they can: see routeOpts.)
 * True too if there's no way there.
 */
function aiRouteHot(p, i, j) {
  const src = rallySources(p, i, j, false, false)[0];
  if (!src) return true;
  const u = { owner: p, type: 'warbot', x: src.x + 0.5, y: src.y + 0.5, ammo: WARBOT_AMMO, fight: 0 };
  const path = squadRoute(u, tIdx(src.x, src.y), i, j);
  if (!path) return true;
  const m = dangerMap(p);
  return path.some((t) => (m[t] & 1) === 1);
}

/**
 * Howitzers (Versus). Loaded ones not already busy go after the enemy defences round the building we last
 * attacked (or, with no attack on, the nearest enemy defence or fort within 24 tiles): turrets, Bunkers, the
 * Keep, Mortars and Disruptors first. And an enemy Howitzer shelling our buildings gets warbots sent after
 * it (they fight whatever is at the flag; a truck can't fight back).
 */
/**
 * The Trade Terminal's contract: the one that brings what we're shortest of, paid with a good we have a lot
 * to spare of (a lot and TRADE_KEEP besides). None if nothing's worth it. While its Crystal runs low (P.crLow, see
 * aiThink) one that brings Crystal comes first, then Chips (every robot takes one), and it never gives Crystal away;
 * a contract under way is dropped for one of those, and any contract that has sold no lot for AI_TRADE_STALL seconds
 * (its good spread too thin to make a train load, say) for another. Before, it took Alloy for Stone while its Foundry
 * stood idle for want of Chips, with Alloy piling up.
 */
function aiTrade(p, me) {
  if (!me.some((b) => BDEFS[b.type].terminal && b.built)) return;
  const T = tradeState(p), P = S.players[p];
  if (!T.offers.length) return;
  const cur = T.pick >= 0 && T.offers[T.pick] && T.offers[T.pick].left > 0 ? T.offers[T.pick] : null;
  if (cur && P.tradeSold !== T.sold) { P.tradeSold = T.sold; P.tradeAt = S.time; } // (a lot sold: it's moving)
  // Dry of Fuel with no way to make any (P.fuelDry): the steep Fuel contract, after Crystal (every robot takes one),
  // before Chips. Never otherwise: it pays half the usual rate.
  const want = (g) => (P.crLow ? (g === 'crystal' ? 2 : g === 'chip' ? 1 : 0) : 0) + (P.fuelDry && g === 'fuel' ? 1.5 : 0);
  const stalled = !!cur && S.time - (P.tradeAt ?? S.time) > AI_TRADE_STALL;
  if (cur && !stalled && !((P.crLow || P.fuelDry) && !want(cur.get))) return;
  const have = spendable(p), short = tradeShortest(p);
  let best = -1, bs = -Infinity;
  T.offers.forEach((o, k) => {
    const spare = (have[o.give] || 0) - TRADE_KEEP[o.give] - o.lot;
    if (o.left <= 0 || spare < 0 || (P.crLow && o.give === 'crystal') || (stalled && o === cur) || (o.steep && !P.fuelDry)) return;
    const sc = want(o.get) * 100 + (o.steep ? 0 : (short.length - short.indexOf(o.get)) * 10) + Math.min(spare, 60) * 0.1;
    if (sc > bs) { bs = sc; best = k; }
  });
  // (One under way is only given up for something better: a stalled one for any other, the rest for Crystal or Chips.)
  if (best < 0 || (cur && !stalled && want(T.offers[best].get) <= want(cur.get))) return;
  pickContract(p, best);
  P.tradeAt = S.time; P.tradeSold = T.sold;
}

/** Has rival p a Fuel source at work: a Bio Farm with soil left in reach, or a Refinery with an Oil Pump that isn't dry? */
function aiFuelSource(p, me) {
  const pumped = me.some((b) => b.built && b.type === 'pump' && !pumpDry(b));
  return me.some((b) => b.built && ((b.type === 'farm' && !b.depleted) || (b.type === 'refinery' && pumped)));
}

/** The Crystal in the ground on b's owner's land within r tiles of b (what taking a fort would bring). */
function crystalHeld(b, r) {
  let n = 0;
  for (let j = Math.max(0, b.y - r); j <= Math.min(S.H - 1, b.y + r); j++) for (let i = Math.max(0, b.x - r); i <= Math.min(S.W - 1, b.x + r); i++) {
    const t = j * S.W + i;
    if (S.res[t] === R_CRYSTAL && S.owner[t] === b.owner && dist2(i, j, b.x, b.y) <= r * r) n += S.amt[t];
  }
  return n;
}

/** What a bomb is worth dropping on, for the AI: its most valuable buildings, and a loaded Tanker. */
const AI_BOMB_VALUE = { nukesilo: 14, silo: 12, munitions: 10, reactor: 9, keep: 7, refinery: 7, foundry: 6, armory: 6, airfield: 6, fab: 5, generator: 4, smelter: 4, terminal: 4 };

/**
 * The AI's Vulcan Bomber: one, built at its Airfield's hangar, and a sortie at most every AI_BOMB_GAP s, at the
 * enemy building (or loaded Tanker) worth most that no Flak Gun covers.
 */
const AI_BOMB_GAP = 240;
function aiBomber(p, me) {
  const P = S.players[p];
  const field = me.find((b) => b.type === 'airfield' && b.built);
  if (!field) return;
  const bombers = S.bots.filter((u) => !u.dead && u.owner === p && BOTS[u.type].bomber);
  if (!bombers.length && !(field.yard && field.yard.bomber > 0) && !botBanned(p, 'bomber')) orderAtYard(field, 'bomber', 1);
  const gun = P.gunTarget ? getE(P.gunTarget) : null;
  if (S.time - (P.lastStrike || -999) < (gun && !gun.dead ? AI_BOMB_GAP / 4 : AI_BOMB_GAP)) return;
  const u = bombers.find((v) => !v.mission && !v.flight && !(v.rearmUntil > S.time) && planeBase(v) && v.inside === planeBase(v).id);
  if (!u) return;
  const flak = S.buildings.filter((b) => !b.dead && b.built && foes(b.owner, p) && BDEFS[b.type].flak);
  const covered = (x, y) => flak.some((f) => dist2(f.x + 0.5, f.y + 0.5, x, y) <= 49);
  // An enemy gun keeping our robots off our own buildings: bomb it first.
  if (gun && !gun.dead && foes(gun.owner, p) && !covered(gun.x + 0.5, gun.y + 0.5) && !strikeBlocked(p, u, gun) && !orderStrike(p, u, gun)) { P.lastStrike = S.time; return; }
  // Napalm on the farmland of an enemy that lives on Bio Farm Fuel (aiNapalmSpot), at most every AI_NAPALM_GAP s.
  if (S.time - (P.napalmAt ?? -999) >= AI_NAPALM_GAP) {
    const spot = aiNapalmSpot(p, u, covered);
    if (spot && !orderNapalm(p, u, spot.i, spot.j)) { P.lastStrike = S.time; P.napalmAt = S.time; return; }
  }
  let best = null, bs = 0;
  const soft = P.soften && S.time < P.soften.until ? P.soften : null; // (the guns holding back an attack: see aiThink, step 5)
  for (const b of S.buildings) {
    let v = S.victory === 'uplinks' && holdsUplink(b) ? Math.max(13, AI_BOMB_VALUE[b.type] || 0) : AI_BOMB_VALUE[b.type]; // (Uplinks: the forts that hold them)
    if (soft && aiDefReach(b) && dist2(b.x, b.y, soft.x, soft.y) <= 64) v = Math.max(v || 0, 9);
    if (!v || b.dead || !b.built || !foes(b.owner, p) || b.owner < 0 || covered(b.x + 0.5, b.y + 0.5) || strikeBlocked(p, u, b)) continue;
    const sc = v - dist(b.x, b.y, field.x, field.y) * 0.05;
    if (sc > bs) { bs = sc; best = b; }
  }
  for (const v of S.bots) {
    if (v.dead || !foes(v.owner, p) || v.type !== 'tanker' || !v.carry || v.inside || covered(v.x, v.y) || strikeBlocked(p, u, v)) continue;
    const sc = 8 - dist(v.x, v.y, field.x, field.y) * 0.05;
    if (sc > bs) { bs = sc; best = v; }
  }
  if (best && !orderStrike(p, u, best)) P.lastStrike = S.time;
}

/**
 * Napalm, for the AI: an enemy getting its Fuel mainly from Bio Farms (AI_NAPALM_FARMS or more at work, and no Oil
 * Pump that isn't dry) has its farmland burned, while our own Fuel is fine (AI_NAPALM_FUEL in hand: a napalm sortie
 * takes BOMBER.fuel + NAPALM.fuel and its tank). The spot: where the napalm scorches the most soil round one of its
 * farms (AI_NAPALM_SOIL patches at least), with no Flak Gun covering it and in the bomber's reach; or null.
 */
const AI_NAPALM_FARMS = 2, AI_NAPALM_FUEL = 12, AI_NAPALM_SOIL = 3, AI_NAPALM_GAP = 480;
function aiNapalmSpot(p, u, covered) {
  if (goodTotal(p, 'fuel') < AI_NAPALM_FUEL) return null;
  const R = BDEFS.farm.radius;
  let best = null, bs = -Infinity;
  for (const Q of S.players) {
    const q = Q.id;
    if (q === p || Q.out || !foes(q, p)) continue;
    const farms = S.buildings.filter((b) => !b.dead && b.built && b.owner === q && b.type === 'farm' && !b.depleted);
    if (farms.length < AI_NAPALM_FARMS || S.buildings.some((b) => !b.dead && b.built && b.owner === q && b.type === 'pump' && !pumpDry(b))) continue;
    for (const f of farms) {
      if (covered(f.x + 0.5, f.y + 0.5)) continue;
      for (let j = f.y - R + 1; j <= f.y + R - 1; j++) for (let i = f.x - R + 1; i <= f.x + R - 1; i++) {
        if (!inMap(i, j)) continue;
        const n = napalmSoil(i, j), sc = n - dist(i, j, f.x, f.y) * 0.1;
        if (n >= AI_NAPALM_SOIL && sc > bs && !covered(i + 0.5, j + 0.5) && !napalmBlocked(p, u, i, j)) { bs = sc; best = { i, j }; }
      }
    }
  }
  return best;
}

/**
 * Enemy guns hurting the economy: a rival's Pulse Turret, Mortar Pit, manned Bunker or Keep whose reach covers
 * buildings of ours (our robots keep clear of them, so the work there stops: see dangerSweep). Each:
 * { b: the gun, score, n: how many of our buildings it covers }, worst first.
 */
function aiGunThreats(p) {
  dangerMap(p);
  const out = [];
  for (const g of DANGER.guns[p] || []) {
    const b = g.b;
    if (b.dead || b.owner < 0 || (S.wildlife && b.owner === WILD_OWNER)) continue;
    const r2 = g.r * g.r;
    let score = 0, n = 0;
    for (const e of S.buildings) {
      if (e.dead || e.owner !== p || dist2(e.x + 0.5, e.y + 0.5, b.x + 0.5, b.y + 0.5) > r2) continue;
      const def = BDEFS[e.type];
      n++;
      score += e.type === 'lander' ? 8 : def.store || def.staff || def.out || def.charger ? 3 : def.war ? 1 : 2;
    }
    if (n) out.push({ b, score, n });
  }
  out.sort((a, c) => c.score - a.score);
  return out;
}

/**
 * Army units it takes to knock out gun b: what it fires itself (a Pulse Turret or Keep 3, any other 2, and the
 * warbots shooting from it), its guards (guardsNear), and a margin. With `shields` Bulwarks leading, the first faces
 * b itself and its shield takes some of b's own fire (not a Mortar's or a Disruptor's: then it faces a guard), any
 * more face its guards (aiFire).
 */
function aiGunNeed(b, shields) {
  const def = BDEFS[b.type], shooting = Math.min(b.garrison ? b.garrison.length : 0, def.slots || Infinity); // (only a Keep's gun slots fire)
  let own = Math.ceil(shooting * 1.3) + (b.type === 'turret' || def.keep ? 3 : 2), sh = shields || 0;
  if (sh > 0 && !def.mortar && !def.disrupt) { own = Math.ceil(own - Math.min(own * 0.75, AI_SHIELD_TAKES) - 1e-9); sh--; }
  return own + guardsNear(b, sh) + 1;
}

/**
 * Heavy defences and no Bulwark to lead: a squad attacking where guns worth AI_HEAVY warbots or more (`fire`) cover
 * it takes a third more than `need` when none of its units is a Bulwark (with several guns on it, from more than one
 * side, the losses on the way in add up faster than the count says).
 */
const AI_HEAVY = 5;
function aiBare(need, fire, shields) { return !shields && fire >= AI_HEAVY ? Math.ceil(need * 1.3 - 1e-9) : need; }

/**
 * Army units it takes to take enemy building b with `shields` Bulwarks leading, counted as an attack counts it (aiThink,
 * step 5): its garrison and two more, the defences that cover it (guardsNear: aiGuards, less what the Bulwarks take),
 * a gun's own fire (aiGunNeed), and a third more under heavy guns with no Bulwark (aiBare). (The march and the storm
 * size themselves by it: see aiMarch.)
 */
function aiTakeNeed(b, lvl, shields) {
  const weak = b.built && BDEFS[b.type].mil && b.armor <= BDEFS[b.type].armor * SORTIE_ARMOR;
  const gar = b.built && !weak ? Math.ceil(b.garrison.length * 1.3) : 0, base = !b.built ? 2 : weak ? lvl.threshold : Math.max(lvl.threshold, gar + 2);
  const guard = guardsNear(b, shields), gun = aiDefReach(b) > 0;
  return aiBare(Math.max(base, !b.built || weak ? guard + 1 : gar + 2 + guard, gun ? aiGunNeed(b, shields) : 0), gun ? aiGunNeed(b) - 1 : guardsNear(b), shields);
}

/**
 * What became of rival P's attacks and marches (P.fights: where each went, how many, who; Medium and up): one that
 * lost more than half its warbots within three minutes is remembered (P.beaten), and nothing goes within 8 tiles of
 * that place for five minutes unless half as many again go (aiBeaten). A place it can't get at through the enemy's
 * walls is left alone for a minute the same way (aiWalled, every level).
 */
function aiBattles(P) {
  if (P.fights) P.fights = P.fights.filter((f) => {
    if (f.ids.reduce((n, id) => { const u = getE(id); return n + (u && !u.dead ? 1 : 0); }, 0) * 2 < f.n) { (P.beaten = P.beaten || []).push({ x: f.x, y: f.y, n: f.n, until: S.time + 300 }); return false; }
    return S.time - f.t < 180;
  });
  if (P.beaten) P.beaten = P.beaten.filter((q) => q.until > S.time);
}
function aiBeaten(P, b, n) { return !!P.beaten && P.beaten.some((q) => q.until > S.time && dist2(q.x, q.y, b.x, b.y) <= 64 && n < q.n * 1.5); }
function aiWalled(P, b) { (P.beaten = P.beaten || []).push({ x: b.x, y: b.y, n: 1e6, until: S.time + 60 }); }

/**
 * A Warden's big push (st.push): it marches only on a push. Before AI_PUSH_AT one starts only with twice its attack
 * threshold and half as many again as its rival's army and two more; from then on, with its attack threshold and two
 * more than its rival's (and, after a push, as many as that push took less two). For four minutes (P.pushOn) its home
 * guard is two, its Keeps hold two and its Outposts none, and its march takes all it can gather, its attack threshold
 * at least (aiMarch). Not while its base is threatened. (It used to march in a quarter of its games, half an hour in,
 * with a third of its army kept back.)
 */
const AI_ALL_IN = 1680; // from 28 minutes, when long wars are fought out, an Architect stops its missile programme (see aiMissilePlan)
const AI_PUSH_AT = 1320;
function aiPush(p, lvl, army, enemyArmy) {
  const P = S.players[p];
  if (P.pushOn > S.time || P.homeCall > S.time || S.mode === 'colony') return; // (not while its base is threatened)
  const need = S.time < AI_PUSH_AT ? Math.max(lvl.threshold * 2, Math.ceil(enemyArmy * 1.5) + 2) : Math.max(lvl.threshold, enemyArmy + 2, (P.pushN || 0) - 2);
  if (army >= need) { P.pushOn = S.time + 240; P.pushN = army; }
}

/**
 * A march by a Medium, Normal or Hard rival p (its army `army`, the enemy's `enemyArmy`) on an enemy garrison: the one
 * that takes the fewest to beat (what taking it takes, aiTakeNeed, and never less than the plain march sends: twice
 * its attack threshold, or against a crushed rival twice the enemy's army and two more, and the guns that cover the
 * flag; a little more for every tile it stands from home, the enemy Command Base a little cheaper, much cheaper
 * against a crushed rival). It goes only with that many (14 at least, 22 at most; up to 30 against a crushed rival),
 * Bulwarks and Torches at its head, at the gun covering the flag first (rally.first); with fewer it masses for it
 * (P.massFor: the army target rises, see aiWantArmy, and its Outposts give up their keepers), softens the spot and
 * orders a Bulwark (P.soften, P.shieldWant), and goes once it has them. (It used to send the 10 to 14 it had to stand
 * beside the nearest fort, whatever guarded it, and lose most of them.)
 * With a decisive lead (half as many warbots again as the enemy and four more) the next march is a storm of the
 * enemy Command Base: with every warbot it can gather (up to 30), as soon as that is enough to take the base;
 * until then, while its whole army would be, it masses for the base and marches on nothing else, for up to four
 * minutes (P.stormT; then a cheaper fort first, as above). Against a crushed rival (twice its army and two more) it
 * goes however the base's guns count, once it can gather twice the enemy's whole army and two more, 8 at least, and
 * three in five of its own armed army outside Bunkers (or the full count, if that is less); with three times the
 * enemy's army and four more it masses for that meanwhile and marches on nothing else. The band forms up out of the
 * guns' reach (aiStage) and goes in once it has (aiStorm). Not in an Uplinks game, which is won at the Uplinks.
 * (With the bases defended, a rival far ahead used to march on the cheapest Outpost every few minutes and never on
 * the base, losing band after band, until the game ran out.) Returns true when a march set off.
 */
function aiMarch(p, lvl, enemy, army, enemyArmy, crushing) {
  const P = S.players[p], lander = getE(P.lander), hz = homeZone(p);
  const spotBy = (b) => {
    for (const [di, dj] of [[1, 1], [-1, 1], [1, -1], [-1, -1], [2, 0], [-2, 0], [0, 2], [0, -2]]) {
      const i = b.x + di, j = b.y + dj;
      if (inMap(i, j) && walkable(tIdx(i, j)) && !S.bAt[tIdx(i, j)] && S.zone[tIdx(i, j)] === hz) return { i, j };
    }
    return null;
  };
  const pushing = P.pushOn > S.time, floor = crushing ? Math.max(4, enemyArmy * 2 + 2) : pushing ? lvl.threshold : lvl.threshold * 2;
  // What a march on b from flag spot `at` takes, with the spare army there (aiSpare) and its Bulwarks leading.
  const needAt = (b, at, sp) => Math.max(aiTakeNeed(b, lvl, sp.shields), floor + Math.ceil(aiFire(aiGuards(b.owner, at.i, at.j, 2, null).filter((e) => aiDefReach(e.b)), sp.shields) - 1e-9));
  let tgt = null, spot = null, size = 0, bs = Infinity, hard = null, hs = Infinity, storm = false;
  const strong = S.victory !== 'uplinks' && army >= enemyArmy * 1.5 + 4;
  const eb = getE(S.players[enemy].lander), by = strong && eb && !eb.dead && eb.owner === enemy && !aiBeaten(P, eb, 30) ? aiStage(p, eb) || spotBy(eb) : null;
  if (by) {
    const sp = aiSpare(p, { x: by.i, y: by.j }, 'flag'), n = Math.min(30, sp.n), g = aiTakeNeed(eb, lvl, aiShieldsIn(sp, n));
    let whole = 0; // (its armed army outside Bunkers)
    if (crushing) for (const u of S.bots) if (!u.dead && u.owner === p && isArmy(u) && botArmed(u) && !(u.inside && BDEFS[getE(u.inside).type].bunker)) whole++;
    const go = crushing ? Math.max(8, enemyArmy * 2 + 2, Math.min(g, Math.ceil(whole * 0.6))) : Infinity;
    if (n >= Math.max(4, g) || n >= go) { tgt = eb; spot = by; size = n; storm = true; }
    else if (crushing && army >= enemyArmy * 3 + 4) { storm = true; hard = { b: eb, need: go - 2 }; } // (overwhelming: it masses for that, and marches on nothing else)
    else if (g <= army - 2 && S.time - (P.stormT || (P.stormT = S.time)) < 240) { storm = true; hard = { b: eb, need: g }; }
  }
  if (!storm || tgt) P.stormT = 0;
  if (!storm) for (const b of S.buildings) {
    if (b.dead || b.owner !== enemy || !b.built || !BDEFS[b.type].mil || BDEFS[b.type].bunker) continue;
    const at = !aiBeaten(P, b, 22) && spotBy(b);
    if (!at) continue;
    // (A march may empty the garrisons far behind the lines; against a rival with next to no army, a small band is
    // enough to finish it.)
    const sp = aiSpare(p, { x: at.i, y: at.j }, 'flag'), avail = sp.n, g = needAt(b, at, sp);
    const sc = g + dist(b.x, b.y, lander.x, lander.y) * 0.15 - (b.type === 'lander' ? (crushing ? 12 : 3) : 0);
    if (sc >= bs && sc >= hs) continue;
    const n = pushing ? Math.min(30, avail) : Math.min(crushing ? 30 : 22, crushing ? avail : avail - 2, Math.max(14, g + 2)); // (a Warden's push: all it can gather)
    if (n >= g && !aiBeaten(P, b, n)) { if (sc < bs) { bs = sc; tgt = b; spot = at; size = n; } }
    else if (sc < hs && g <= 28) { hs = sc; hard = { b, need: g }; }
  }
  if (tgt) {
    const { sent, rally, breach } = sendToRally(p, spot.i, spot.j, size, true, false, true);
    if (sent && breach && breach.need > breach.shots) { recallRally(rally.id); aiWalled(P, tgt); } // (walls in the way it can't shoot through)
    else if (sent) {
      P.march = rally.id; P.lastMarch = S.time; P.massFor = null;
      if (storm) P.stormOn = { id: rally.id, base: tgt.id, foe: tgt.owner, n: sent, go: 0 };
      else rally.first = aiFirstGun(tgt.owner, spot.i, spot.j); // (at the gun covering the flag first: see holdRally)
      (P.fights = P.fights || []).push({ x: tgt.x, y: tgt.y, n: sent, t: S.time, ids: rallyMembers(rally.id).map((u) => u.id) });
      P.siegeAt = { x: tgt.x, y: tgt.y, until: S.time + 150 };
      return true;
    }
  } else if (hard) {
    // Held back: it masses for it, its Howitzers, Missiles and bomber soften the spot meanwhile, and a Bulwark comes to lead.
    P.massFor = { need: hard.need + 2, until: S.time + 240 };
    P.siegeAt = { x: hard.b.x, y: hard.b.y, until: S.time + 60 };
    P.soften = { x: hard.b.x, y: hard.b.y, until: S.time + 60 };
    P.shieldWant = S.time;
  }
  return false;
}

/**
 * A storm of the enemy Command Base under way (P.stormOn: the march's flag `id`, the `base` and its owner `foe`, the
 * `n` sent, and `go` once it goes in). The band forms up under its flag, out of the guns' reach (aiStage); once three in
 * five of it stand within 5 tiles of the flag, the flag moves beside the base and the band goes in, at the gun that
 * covers the flag first (rally.first, see holdRally), then the next, then the base. It is called off when fewer than
 * two in five are left armed, or when the band hasn't formed up five minutes after setting off.
 */
function aiStorm(p) {
  const P = S.players[p], T = P.stormOn, eb = getE(T.base), r = rallyById(T.id);
  const band = r ? rallyMembers(r.id).filter((u) => botArmed(u)) : [];
  if (!eb || eb.dead || eb.owner !== T.foe || !r || band.length * 5 < T.n * 2 || (!T.go && S.time - (P.lastMarch || 0) > 300)) {
    if (r) recallRally(r.id);
    if (P.march === T.id) P.march = 0;
    P.stormOn = null;
    return;
  }
  if (!T.go) {
    if (band.filter((u) => dist2(u.x, u.y, r.x, r.y) <= 25).length * 5 < band.length * 3) return; // (forming up)
    const z = S.zone[tIdx(Math.floor(r.x), Math.floor(r.y))];
    for (const [di, dj] of [[1, 1], [-1, 1], [1, -1], [-1, -1], [2, 0], [-2, 0], [0, 2], [0, -2]]) {
      const i = eb.x + di, j = eb.y + dj;
      if (inMap(i, j) && walkable(tIdx(i, j)) && !S.bAt[tIdx(i, j)] && S.zone[tIdx(i, j)] === z) { r.x = i + 0.5; r.y = j + 0.5; break; }
    }
    T.go = 1;
  }
  const g = getE(r.first);
  if (!g || g.dead || !foes(g.owner, p)) r.first = aiFirstGun(eb.owner, Math.floor(r.x), Math.floor(r.y));
  P.siegeAt = { x: eb.x, y: eb.y, until: S.time + 30 };
}

/**
 * Where a storm of enemy building b forms up: a free tile within 16 tiles of it that p's warbots can walk to, that as
 * few enemy guns reach, with three tiles to spare, as can be (none, where there is such a tile: DANGER.guns), more
 * than 7 tiles from the enemy's forts if that can be had, about 9 tiles out, and on the side p comes from (a band
 * staged beyond the base walked past its guns to get there). Null if there is none.
 */
function aiStage(p, b) {
  dangerMap(p);
  const guns = DANGER.guns[p] || [], z = homeZone(p), forts = S.buildings.filter((e) => !e.dead && e.built && e.owner === b.owner && BDEFS[e.type].mil);
  const home = getE(S.players[p].lander), dh = home ? dist(b.x, b.y, home.x, home.y) : 0;
  let best = null, bs = Infinity;
  for (let j = Math.max(0, b.y - 16); j <= Math.min(S.H - 1, b.y + 16); j++) for (let i = Math.max(0, b.x - 16); i <= Math.min(S.W - 1, b.x + 16); i++) {
    const t = tIdx(i, j), d = dist(i, j, b.x, b.y);
    if (d > 16 || d < 4 || !walkable(t) || S.bAt[t] || S.zone[t] !== z) continue;
    // (Three tiles clear of each gun's reach: the band spreads round its flag and goes for what comes near, and one
    // formed up just outside a turret's reach was shot down piecemeal while it waited for the rest.)
    let cover = 0;
    for (const g of guns) if (dist2(g.b.x + 0.5, g.b.y + 0.5, i + 0.5, j + 0.5) <= (g.r + 3) * (g.r + 3)) cover++;
    const sc = cover * 8 + Math.abs(d - 9) * 0.5 + (forts.some((e) => dist2(e.x, e.y, i, j) <= 49) ? 3 : 0) + (home ? (dist(i, j, home.x, home.y) - dh) * 0.4 : 0); // (on the side it comes from: not past the guns)
    if (sc < bs) { bs = sc; best = { i, j }; }
  }
  return best;
}

/**
 * Clear the worst enemy gun covering our buildings: a missile if a Silo can reach it, Howitzers (they
 * outrange a Pulse Turret), a Vulcan Bomber, and a band of warbots big enough to win. Until the army can
 * win, the Foundry makes warbots (P.gunNeed). P.gunTarget names the gun for aiSiege and aiBomber.
 */
function aiClearGuns(p, lvl) {
  const P = S.players[p];
  // A construction site an enemy gun covers would never be built (no robot goes there) and holds up the
  // rest: call it off (its materials go back), and build somewhere else.
  for (const b of S.buildings) if (!b.dead && b.owner === p && !b.built && b.underFire && S.time - b.underFire > 10) demolish(b);
  const threats = aiGunThreats(p);
  // The gun a rally flag was sent against is gone: call the warbots home.
  if (P.gunRally && (!threats.length || threats[0].b.id !== P.gunTarget)) { if (rallyById(P.gunRally)) recallRally(P.gunRally); P.gunRally = 0; }
  if (!threats.length) { P.gunTarget = 0; P.gunNeed = 0; P.gunWant = 0; return; }
  const t = threats[0].b;
  const army = S.bots.filter((u) => !u.dead && u.owner === p && isArmy(u)).length;
  if (P.gunTarget !== t.id) { P.gunTarget = t.id; P.gunSince = S.time; P.gunArmyN = army; P.gunArmyT = S.time; }
  if (army > (P.gunArmyN ?? -1)) { P.gunArmyN = army; P.gunArmyT = S.time; }
  if (army < (P.gunArmyN ?? 0)) P.gunArmyN = army;
  // A missile, if a Silo is in range and none is on its way already.
  if (!S.missiles.some((m) => m.owner === p && m.target === t.id) && silosInRange(p, t).some(siloReady)) fireMissile(p, t);
  // Howitzers free to shell it (aiSiege also puts it first).
  const z = S.zone[tIdx(t.x, t.y)];
  for (const u of S.bots) {
    if (u.dead || u.owner !== p || !BOTS[u.type].siege || u.salvo || (u.task && !u.task.auto) || !(u.rockets ?? ROCKET.mag)) continue;
    if (S.zone[tIdx(Math.floor(u.x), Math.floor(u.y))] !== z || !rocketTarget(u, t)) continue;
    orderBombard(p, [u.id], t);
  }
  // Warbots: a squad that can win, from the garrisons in reach, a Bulwark at its head when there's one (it goes first,
  // and its shield takes the gun's fire: fewer are needed). Already on their way: wait for them. A new squad goes only
  // when it can win with half the ones still at it (those left of one being shot down are no great help), never a
  // few at a time to feed the gun. Too few to spare (each garrison keeps one at home): the Foundry makes up the
  // difference (P.gunWant sets the army it wants) and a Bulwark if it has none (P.shieldWant).
  const going = S.bots.filter((u) => !u.dead && u.owner === p && isArmy(u) && u.task && u.task.type === 'attack' && u.task.target === t.id).length;
  const help = Math.floor(going / 2), needOf = (sh) => aiBare(aiGunNeed(t, sh), aiGunNeed(t) - 1, sh);
  let sp = aiSpare(p, t, false), sq = aiSquad(sp, needOf, help), all = false;
  P.gunWant = Math.max(aiGunNeed(t) + 2, army + Math.max(0, sq.need - help - sp.n));
  P.gunNeed = Math.max(0, sq.need - going);
  if (going >= sq.need || S.time < (P.gunAttackAt || 0)) return;
  // Just short: the forts in reach send their last warbots too (never the Command Base's), the gun is that bad.
  if (!sq.count) { const s = aiSpare(p, t, true), q = aiSquad(s, needOf, help); if (q.count) { sp = s; sq = q; all = true; } }
  // Stuck: the gun has stood for over two and a half minutes and no new warbot has come for two (the gun may be what
  // stops the Foundry: a Chip Fab or Fuel Station under it). Then every warbot goes, the Command Base's last one too:
  // when that gives it a real chance (enough without the margin), or when the colony can make no more army anyway
  // (no Bot Foundry at work: it's that or nothing, as before).
  const stuck = S.time - (P.gunSince ?? S.time) > 150 && S.time - (P.gunArmyT ?? S.time) > 120;
  if (!sq.count && stuck) {
    const stalled = !S.buildings.some((b) => !b.dead && b.owner === p && b.type === 'foundry' && b.built && !aiShut(b));
    const s = aiSpare(p, t, 'every'), q = aiSquad(s, (sh) => needOf(sh) - 1, help);
    if (q.count) { sp = s; sq = q; all = 'every'; }
    else if (stalled && s.n && s.n + going >= needOf(s.shields)) { sp = s; sq = { count: s.n, need: s.n }; all = 'every'; }
  }
  if (!sq.count) P.shieldWant = S.time;
  else {
    const sent = sendAttack(p, t, sq.count, all, false, true);
    if (sent) { P.gunAttackAt = S.time + 20; P.lastAttack = S.time; P.siegeAt = { x: t.x, y: t.y, until: S.time + 90 }; }
    return;
  }
  // No garrison near enough to attack from: a rally flag beside the gun (they fight what they meet there
  // and attack what stands there), called home once the gun is gone. The same rule: a squad that can win.
  if (P.gunRally && rallyById(P.gunRally)) return;
  let spot = null;
  for (const [di, dj] of [[1, 1], [-1, 1], [1, -1], [-1, -1], [2, 0], [-2, 0], [0, 2], [0, -2], [2, 2], [-2, -2]]) {
    const i = t.x + di, j = t.y + dj;
    if (inMap(i, j) && walkable(tIdx(i, j)) && !S.bAt[tIdx(i, j)] && S.zone[tIdx(i, j)] === homeZone(p)) { spot = { i, j }; break; }
  }
  if (!spot) return;
  const fq = aiSquad(aiSpare(p, { x: spot.i, y: spot.j }, 'flag'), needOf, help);
  if (fq.count) {
    const { sent, rally } = sendToRally(p, spot.i, spot.j, fq.count, true, false, true);
    if (sent) { rally.first = t.id; P.gunRally = rally.id; P.gunAttackAt = S.time + 20; P.lastAttack = S.time; }
  }
}

function aiSiege(p) {
  const P = S.players[p]; // (called from aiThink, every couple of seconds: it used to wait for one tick in 30 as well,
  // which the think cycle seldom landed on, so the AI hardly ever sent its Howitzers or hunted the enemy's)
  const trucks = S.bots.filter((u) => !u.dead && u.owner === p && BOTS[u.type].siege);
  const at = P.siegeAt && S.time < P.siegeAt.until ? P.siegeAt : null;
  for (const u of trucks) {
    if (u.salvo || (u.task && !u.task.auto) || !(u.rockets ?? ROCKET.mag)) continue;
    const z = S.zone[tIdx(Math.floor(u.x), Math.floor(u.y))];
    let best = null, bs = -Infinity;
    for (const b of S.buildings) {
      if (!rocketTarget(u, b) || !b.built || S.zone[tIdx(b.x, b.y)] !== z) continue;
      const def = BDEFS[b.type], d = dist(u.x, u.y, b.x, b.y);
      if (d > 24) continue;
      let sc = (def.war && !def.barrier ? 8 : 0) + (def.mil ? 4 : 0) - d * 0.2;
      if (at) sc += dist(b.x, b.y, at.x, at.y) <= 8 ? 10 : -6;
      if (b.id === P.gunTarget) sc += 40; // a gun keeping our robots off our own buildings comes first
      if (sc > bs) { bs = sc; best = b; }
    }
    if (best) orderBombard(p, [u.id], best);
  }
  // Enemy Howitzers shelling us (or digging in to): they wreck defences from out of their reach, so each one is
  // hunted down with enough warbots to beat the escort round it, topped up if the hunters are thinned out, the flag
  // moved with it if it packs up and drives off, until it's dead (or two and a half minutes have passed).
  P.truckHunt = (P.truckHunt || []).filter((h) => { const r = rallyById(h.rally), e = getE(h.truck); if (r && (S.time >= h.until || !e || e.dead)) recallRally(h.rally); return r && S.time < h.until && e && !e.dead; });
  for (const e of S.bots) {
    if (e.dead || !foes(e.owner, p) || e.owner < 0 || !BOTS[e.type].siege || e.inside) continue;
    const tid = e.salvo ? e.salvo.target : e.task && e.task.type === 'bombard' ? e.task.target : 0, tgt = tid ? getE(tid) : null;
    const shelling = P.shelledBy && S.time - (P.shelledBy[e.id] || -999) < 40;
    if (!shelling && !(tgt && tgt.owner === p && (e.deployT > 0 || dist(e.x, e.y, tgt.x, tgt.y) < ROCKET.range + 4))) continue;
    const i = Math.floor(e.x), j = Math.floor(e.y);
    if (!inMap(i, j) || !walkable(tIdx(i, j))) continue;
    const escort = S.bots.filter((v) => !v.dead && !v.inside && v.owner === e.owner && isArmy(v) && dist2(v.x, v.y, e.x, e.y) <= 20).length;
    // (One parked under its owner's guns: more hunters for them, a Bulwark leading; and none at all until there are
    // that many, not a few at a time to be shot down there.)
    const sp = aiSpare(p, { x: i, y: j }, 'flag'), guns = Math.ceil(aiFire(aiGuards(e.owner, i, j, 2, null), sp.shields) - 1e-9);
    const want = Math.min(14 + guns, 4 + Math.ceil(escort * 1.5) + guns);
    const h = P.truckHunt.find((x) => x.truck === e.id);
    if (!h) {
      if (guns && sp.n < want) { P.shieldWant = S.time; continue; }
      const { sent, rally } = sendToRally(p, i, j, want, true, false, guns > 0);
      if (sent) P.truckHunt.push({ truck: e.id, rally: rally.id, until: S.time + 150, at: S.time });
      continue;
    }
    const r = rallyById(h.rally);
    if (!r) continue;
    if (dist2(r.x, r.y, e.x, e.y) > 4) { r.x = i + 0.5; r.y = j + 0.5; } // it moved: so does the flag
    const have = rallyMembers(h.rally).length;
    if (have < want && S.time - (h.at || 0) > 15 && (!guns || want - have >= 3)) { h.at = S.time; sendToRally(p, Math.floor(r.x), Math.floor(r.y), want - have, true); }
  }
}

/**
 * Answer raids: an enemy rally flag inside our land with warbots at it gets twice as many of ours
 * sent to the same spot (they fight whatever is there), called home once the raiders are gone; none
 * when it can't spare a third more than the flag has.
 */
function aiCounterRaid(p) {
  const P = S.players[p];
  P.counters = (P.counters || []).filter((c) => {
    const theirs = rallyById(c.enemy), ours = rallyById(c.mine);
    const over = !theirs || !rallyMembers(c.enemy).length || S.time - c.at > 120;
    if (over && ours) recallRally(c.mine);
    return !over && ours;
  });
  for (const r of S.rallies) {
    if (!foes(r.owner, p) || P.counters.some((c) => c.enemy === r.id)) continue;
    const i = Math.floor(r.x), j = Math.floor(r.y);
    if (!inMap(i, j) || S.owner[tIdx(i, j)] !== p) continue;
    const raiders = rallyMembers(r.id).length;
    // (Only with a third more warbots than the flag has, at least: fewer stay behind their walls. It used to send
    // whatever it had, one warbot as often as not.)
    if (!raiders || rallyAvailable(p, i, j) < Math.ceil(raiders * 1.3)) continue;
    const { sent, rally } = sendToRally(p, i, j, raiders * 2);
    if (sent) P.counters.push({ enemy: r.id, mine: rally.id, at: S.time });
  }
}

/**
 * What a Missile on enemy building e is worth to an Architect p (Normal and Hard): what its rival lives on first, by
 * AI_BOMB_VALUE (Silos and the Missile Factory, the Ammo Plant, the Bot Foundry, Fuel, the Chip Fab and Smelters),
 * then any other building with a worker or that charges robots, and a fort (an Outpost too) only when it has the
 * warbots in reach to follow the Missile in. (Most of its Missiles used to go into Outposts and turrets.)
 */
function aiMissileWorth(p, e, lvl) {
  const def = BDEFS[e.type];
  if (AI_BOMB_VALUE[e.type] && !captureOnly(e)) return AI_BOMB_VALUE[e.type];
  if (def.mil) return attackAvailable(p, e) >= lvl.threshold ? 3 : 0.5;
  return def.barrier ? 0 : def.staff || def.charger || def.pump ? 4 : def.war ? 3 : 2;
}

/**
 * Where an Architect p under siege fires a Missile from `silo` (see aiThink): at the enemy warbot, out in the open
 * within 12 tiles of its Command Base L and in the Silo's reach, with the most others within a blast's reach of it
 * (three or more, counting itself). {i, j} or null.
 */
function aiMissileKnot(p, L, silo) {
  const md = BDEFS.silo.missile, foesNear = S.bots.filter((u) => !u.dead && !u.inside && u.owner >= 0 && foes(u.owner, p) && isArmy(u) && dist2(u.x, u.y, L.x, L.y) <= 144);
  let best = null, bn = 2;
  for (const u of foesNear) {
    if (dist(silo.x, silo.y, u.x, u.y) > md.range) continue;
    let n = 0;
    for (const v of foesNear) if (dist2(u.x, u.y, v.x, v.y) <= md.splash * md.splash) n++;
    if (n > bn) { bn = n; best = { i: Math.floor(u.x), j: Math.floor(u.y) }; }
  }
  return best;
}

/**
 * The AI's missile programme (Versus). Once it has an economy and an army (past most of the grace
 * period, two Outposts, a few warbots and spare workers) it saves up for a Missile Factory, then a
 * Silo (a second one later). It gives up for a while if saving drags on too long. With both built,
 * it keeps the factory fed (P.feedMissiles pauses the Foundry) until its silos are nearly full.
 * Returns the building type it is saving for, or null.
 */
function aiMissilePlan(p, me, counts, kinds, workers, staffed) {
  const P = S.players[p], lvl = aiLevel(p), st = aiStyle(p);
  P.feedMissiles = false;
  if (S.mode === 'colony') return null;
  const site = me.find((b) => !b.built && (b.type === 'munitions' || b.type === 'silo'));
  // A Silo site waiting for Alloy: the Missile Factory stops eating it until the Silo stands. It rests too while
  // no Silo that's built has room for another Missile: with nowhere to load them it only turned Alloy, Chips
  // and Fuel into Missiles lying in storage.
  const room = me.some((b) => b.type === 'silo' && b.built && (b.stock.warhead || 0) + (b.inc.warhead || 0) < BDEFS.silo.ammoCap);
  // (An Architect's doesn't rest for a Silo site, its next one goes down early, but while its army is more than two behind
  // its rival's, until it is level again: the Chips go to warbots first. From AI_ALL_IN, when long wars are fought out,
  // its factory rests and it saves for no more Silos: short of Chips, its factory kept its army just above its rival's
  // and some wars ran to the end undecided.)
  const army = st.missiles ? aiArmyOf(p) : 0, foeArmy = st.missiles ? aiArmyOf(rivalOf(p)) : 0, late = st.missiles && S.time >= AI_ALL_IN;
  for (const b of me) {
    if (b.type !== 'munitions' || !b.built) continue;
    const rest = st.missiles ? late || !room || army < foeArmy - (b.paused ? 0 : 2) : !!(site && site.type === 'silo') || !room;
    if (!!b.paused !== rest) setPaused(b, rest);
  }
  if (late) { P.saveStart = 0; return null; }
  if (site) { site.prio = 'high'; return site.type; } // keep the Foundry resting (and goods coming here first) until the site has its materials
  // A Tycoon goes for missiles sooner, with fewer warbots at home, once its Bot Foundry runs. The
  // others start no sooner than a Balanced rival would (a Rusher spends on warbots instead).
  const base = DIFFICULTY[S.difficulty];
  // An Architect's starts from ten minutes, once its army is two up on its rival's (five at least), with two workers to
  // spare (four was more than its extra Smelter and Chip Fab left it). (From five minutes with an army level with its
  // rival's, it spent the Alloy on Silos early and was stormed; waiting for an army up to its target, it hardly began.)
  const ready = (st.missiles
    ? S.time >= Math.max(base.grace * 0.8, 600) && me.some((b) => b.type === 'foundry' && b.built) && army >= Math.max(5, foeArmy + 2)
    : S.time >= base.grace * 0.7 * Math.max(1, st.grace || 1) && (kinds.warbot || 0) >= Math.max(base.threshold, lvl.threshold)) &&
    (counts.outpost || 0) >= 2 && workers >= staffed + (st.missiles ? 2 : 4);
  if (!ready || S.time < (P.saveCooldown || 0)) { P.saveStart = 0; return null; }
  let want = null;
  if (!counts.munitions) want = 'munitions';
  // (An Architect's next Silo, up to three, once the ones it has hold a Missile each.)
  else if (!counts.silo || (counts.silo < (st.missiles ? 3 : 2) && S.time > lvl.grace * (st.missiles ? 1.2 : 2.5) &&
    (!st.missiles || me.every((b) => b.type !== 'silo' || (b.stock.warhead || 0) >= 1)))) want = 'silo';
  if (want) {
    P.saveStart = P.saveStart || S.time;
    if (S.time - P.saveStart > (st.missiles ? 300 : 180)) { P.saveCooldown = S.time + (st.missiles ? 120 : 240); P.saveStart = 0; return null; }
    return want;
  }
  P.saveStart = 0;
  // Both built: feed the factory until the silos hold nearly two missiles each.
  let stored = 0, silos = 0;
  for (const b of me) {
    if (!b.built) continue;
    if (b.type === 'silo') { silos++; stored += (b.stock.warhead || 0) + (b.inc.warhead || 0); }
    if (b.type === 'munitions') stored += b.stock.warhead || 0;
  }
  P.feedMissiles = silos > 0 && stored < silos * 2;
  return null;
}

/**
 * Lay roads from storage to buildings that have none, construction sites first, as far as the
 * Cement allows. A site that no road can reach is given up after a while.
 */
function aiRoads(p, me) {
  const P = S.players[p];
  let budget = roadTilesAffordable(p), done = 0;
  const todo = me.filter((b) => needsRoad(b) && !onHomeNet(b))
    .sort((a, b) => (a.built - b.built) || a.born - b.born);
  for (const b of todo) {
    if (done >= 3) break;
    // Ramps cut for this one's road still going up: wait for them (aiRampCut), the road then takes the short way.
    const rw = P.rampWait && P.rampWait[b.id];
    if (rw) {
      if (rw.until > S.time && rw.ids.some((id) => { const r = getE(id); return r && !r.dead && !r.built; })) continue;
      delete P.rampWait[b.id];
    }
    const route = roadRouteTo(p, b);
    if (BDEFS[b.type].ramp) {
      // A Ramp cut for another site waits for the Ramp before it on the way (its road follows once that stands).
      if (!route && P.rampWait && Object.keys(P.rampWait).some((k) => P.rampWait[k].until > S.time && P.rampWait[k].ids.includes(b.id))) continue;
    } else if ((!route || route.length >= AI_RAMP_MIN) && aiRampCut(p, b, route)) continue;
    if (!route) {
      if (!b.built && S.time - b.born > 60) {
        P.avoid = (P.avoid || []).concat([{ x: b.x, y: b.y, until: S.time + 240 }]);
        demolish(b);
      }
      continue;
    }
    // Linked by road as far as the planner can tell, yet the Haulers still can't get there after four minutes (the
    // two disagree, whatever the reason): give the site up rather than let it hold a place for good.
    if (!route.length && !route.pending && !b.built && b.unlinked && S.time - b.born > 240) {
      P.avoid = (P.avoid || []).concat([{ x: b.x, y: b.y, until: S.time + 240 }]);
      demolish(b);
      continue;
    }
    if (route.cost > budget || !canAffordRoad(p, route.goods)) {
      P.roadShort = S.time;
      // A site that has waited long for a road we can't pay for is given up (its goods come back).
      if (!b.built && S.time - b.born > 150) demolish(b);
      continue;
    }
    for (const t of route) buildRoad(p, t % S.W, (t / S.W) | 0);
    budget -= route.cost;
    done++;
  }
  if (done < 3) aiJoinBases(p);
}

/**
 * A road that goes the long way round a low cliff, or can't get there at all: cut a Ramp instead, as Route to does in
 * Paths (a Ramp is only 3 Cement and 1 Fiber, and needs no build slot). The cheapest way from the roads that reach
 * storage to b, Ramps allowed (pathRoute: a Ramp costs as much as ROUTE_RAMP tiles), against the road the usual way
 * (roadRouteTo, which only follows the slopes there are): when the Ramp way is at most AI_RAMP_GAIN of it (counting
 * each Ramp as AI_RAMP_TILES tiles) and saves AI_RAMP_SAVE tiles or more, its Ramps go up and b's road waits for them
 * (P.rampWait; a few minutes at most), then takes the short way through. Two Ramps at most, and none for a Ramp. Not
 * off a fortress home (fortressHome: Plateaus and Three Mesas, where its few slopes are what its guns hold). (A rival
 * used to run a road forty tiles round a one-level cliff to a site eight tiles away, and gave up a site no slope led
 * to.) Returns true if it cut any.
 */
const AI_RAMP_MIN = 8, AI_RAMP_TILES = 6, AI_RAMP_GAIN = 0.6, AI_RAMP_SAVE = 6, AI_RAMP_MAX = 2;
function aiRampCut(p, b, route) {
  const g = roadGoals(p, b);
  if (!g.stores.length) return false;
  const net = roadNet(p), seeds = [], N = S.W * S.H;
  for (let t = 0; t < N; t++) if ((net.comp[t] >= 0 && g.nets.has(net.comp[t])) || g.next[t]) seeds.push(t);
  if (!seeds.length) return false;
  const r = pathRoute(p, 'road', seeds, tIdx(b.x, b.y));
  if (!r.tiles) return false;
  const busy = (u) => (S.road[u] || S.plan[u] ? 1 : 0);
  let fresh = 0, fort;
  const cuts = [];
  for (let k = 0; k < r.tiles.length; k++) {
    const t = r.tiles[k];
    if (!roadLike(t) && !S.plan[t] && !S.bAt[t]) fresh++;
    if (!k) continue;
    const a = r.tiles[k - 1], dx = Math.abs((a % S.W) - (t % S.W)), dy = Math.abs(((a / S.W) | 0) - ((t / S.W) | 0));
    if (dx + dy !== 1 || S.terrain[a] !== T_GROUND || S.terrain[t] !== T_GROUND || Math.abs(S.elev[a] - S.elev[t]) !== 1 || canStep(a, t)) continue;
    if (fort === undefined) fort = fortressHome(p);
    if (fort && (fort[a] || fort[t])) return false; // (not a new way up onto its own fortress)
    const ok = [t, a].filter((u) => canPlace(p, 'ramp', u % S.W, (u / S.W) | 0).ok).sort((x, y) => busy(x) - busy(y));
    if (!ok.length) return false;
    cuts.push(ok[0]);
    if (cuts.length > AI_RAMP_MAX) return false;
  }
  if (!cuts.length) return false;
  const before = route ? route.length : Infinity, after = fresh + cuts.length * AI_RAMP_TILES;
  if (after > before * AI_RAMP_GAIN || before - after < AI_RAMP_SAVE) return false;
  const have = playerGoods(p), cost = BDEFS.ramp.cost;
  for (const k in cost) if ((have[k] || 0) < cost[k] * cuts.length) return false;
  const ids = [];
  for (const t of cuts) {
    const res = placeSite(p, 'ramp', t % S.W, (t / S.W) | 0);
    if (!res || !res.ok) break;
    ids.push(res.building.id);
  }
  if (!ids.length) return false;
  (S.players[p].rampWait = S.players[p].rampWait || {})[b.id] = { until: S.time + 180, ids };
  return true;
}

/**
 * A Command Base we captured stands on its own roads, and everything built round it counts as linked home through
 * it: join its roads to ours, or goods never cross between the two (in a 2 v 2 the Chip Fabs on one side waited
 * for Crystal piled up on the other, and the army stopped growing for want of Chips). Every 20 seconds, the
 * captured base on the same land as ours, its road queued and paid for as the goods come in.
 */
function aiJoinBases(p) {
  const P = S.players[p], L = getE(P.lander);
  if (!L || L.dead || L.owner !== p || S.time - (P.joinAt || -999) < 20) return;
  P.joinAt = S.time;
  const z = S.zone[tIdx(L.x, L.y)];
  for (const b of S.buildings) {
    if (b.dead || b.owner !== p || b.type !== 'lander' || b === L || !b.built || S.zone[tIdx(b.x, b.y)] !== z || roadLinked(b, L)) continue;
    const route = roadRouteTo(p, b, true);
    if (!route || !route.length) continue; // (no way, or the road is planned already and being laid)
    // (Queued, as from Paths: paid for tile by tile as the goods come in, so a long road doesn't wait for all of it.)
    for (const t of route) buildRoad(p, t % S.W, (t / S.W) | 0, true);
    return;
  }
}

/**
 * Last resort when the land has no boulders left and there isn't enough Cement for an Outpost to
 * reach new ones: take down a spare building (half its Cement comes back), at most once a minute.
 */
function aiFreeCement(p, me) {
  const P = S.players[p];
  const need = BDEFS.outpost.cost.cement;
  const g = playerGoods(p);
  if (g.cement + g.stone * 2 >= need || S.time - (P.stoneBreak || -999) < 60 || me.some((b) => b.type === 'outpost' && !b.built)) return;
  const spare = ['depot', 'grower', 'charger', 'turret', 'armory', 'refinery', 'farm', 'tarworks', 'roadworks', 'kiln'];
  let best = null, bs = -1;
  for (const b of me) {
    if (!b.built || b.dead) continue;
    const k = spare.indexOf(b.type);
    if (k < 0) continue;
    if (b.type === 'kiln' && me.filter((x) => x.type === 'kiln').length < 2) continue; // never the last one: roads need Cement
    if ((b.type === 'charger' || b.type === 'farm') && me.filter((x) => x.type === b.type).length < 2) continue;
    const back = Math.floor((BDEFS[b.type].cost.cement || 0) / 2);
    const s = back * 10 - k;
    if (back > 0 && s > bs) { bs = s; best = b; }
  }
  if (best) { P.stoneBreak = S.time; demolish(best); }
}

/** Only start a building when the needed materials exist somewhere (stops the AI hoarding sites). */
/** Can player p pay for a `type` site now (ignoring the goods in `except`)? */
function aiAffordable(p, type, except) {
  const have = { ...playerGoods(p) };
  // Saving up for a crossing (a Viaduct it can't pay for yet): that much is spoken for.
  const P = S.players[p];
  if (P.bridgeNeed && S.time - (P.bridgeWant || -999) < 30) for (const g in P.bridgeNeed) have[g] = (have[g] || 0) - P.bridgeNeed[g];
  const cost = BDEFS[type].cost;
  for (const g in cost) if (have[g] < cost[g] && !(except && except.includes(g))) return false;
  return true;
}

/** Square-window resource counts for every tile (summed-area table), for cheap Outpost scoring. */
function resourceSums(type) {
  const W = S.W, H = S.H, sum = new Int32Array((W + 1) * (H + 1));
  for (let j = 0; j < H; j++) {
    let row = 0;
    for (let i = 0; i < W; i++) {
      row += S.res[j * W + i] === type ? 1 : 0;
      sum[(j + 1) * (W + 1) + i + 1] = sum[j * (W + 1) + i + 1] + row;
    }
  }
  return (i, j, r) => {
    const x0 = Math.max(0, i - r), y0 = Math.max(0, j - r), x1 = Math.min(W, i + r + 1), y1 = Math.min(H, j + r + 1);
    return sum[y1 * (W + 1) + x1] - sum[y0 * (W + 1) + x1] - sum[y1 * (W + 1) + x0] + sum[y0 * (W + 1) + x0];
  };
}

/** Buildings the AI likes to put beside their suppliers or customers, for feed links. */
const AI_FEED = new Set(['smelter', 'fab', 'foundry', 'armory', 'munitions', 'tarworks', 'roadworks', 'refinery', 'kiln', 'charger', 'generator', 'repair']);

function aiFindSpot(p, type, lander) {
  // A search that found nothing isn't repeated until the territory changes or 20 s pass.
  const P = S.players[p];
  P.noSpot = P.noSpot || {};
  const miss = P.noSpot[type];
  if (miss && miss.ver === S.territoryVer && S.time < miss.until) return null;
  const spot = aiSearchSpot(p, type, lander);
  if (!spot) P.noSpot[type] = { ver: S.territoryVer, until: S.time + 20 };
  return spot;
}

/** Out on no-one's ground the AI builds at least this far from a rival's land, and pays this much score for leaving its own. */
const AI_CLEAR_OF_RIVAL = 7, AI_OUT_COST = 2;

/** Does any tile within r of (i, j) belong to a rival of p's (not creatures)? */
function rivalLandNear(p, i, j, r) {
  for (let dj = -r; dj <= r; dj++) for (let di = -r; di <= r; di++) {
    if (!inMap(i + di, j + dj) || di * di + dj * dj > r * r) continue;
    const o = S.owner[tIdx(i + di, j + dj)];
    if (o >= 0 && o !== p && !(S.wildlife && o === WILD_OWNER)) return true;
  }
  return false;
}

/** Can a Bio Farm of p's standing at (cx, cy) farm tile t (i, j): fertile, free to plant, in reach, on its ground? */
function aiFarmable(p, t, i, j, cx, cy, zone) {
  if (!S.fert[t] || (S.res[t] && S.res[t] !== R_CROP) || S.bAt[t] || S.road[t] || S.ramp[t] || S.zone[t] !== zone || (i === cx && j === cy)) return false;
  if (S.owner[t] >= 0 && S.owner[t] !== p) return false;
  const r = BDEFS.farm.radius;
  return dist2(i, j, cx, cy) <= r * r + 0.3;
}

/**
 * The fertile tiles p's Bio Farms (sites too) already work: each claims the nearest AI_FARM_TILES it can farm that no
 * farm before it claimed (by id, so it's the same every time). A Uint8Array over the map, 1 where claimed.
 */
function aiFarmClaims(p) {
  const claimed = new Uint8Array(S.W * S.H), r = BDEFS.farm.radius;
  for (const b of S.buildings) {
    if (b.dead || b.owner !== p || b.type !== 'farm') continue;
    const zone = S.zone[tIdx(b.x, b.y)], mine = [];
    for (let j = Math.max(0, b.y - r); j <= Math.min(S.H - 1, b.y + r); j++) for (let i = Math.max(0, b.x - r); i <= Math.min(S.W - 1, b.x + r); i++) {
      const t = j * S.W + i;
      if (!claimed[t] && aiFarmable(p, t, i, j, b.x, b.y, zone)) mine.push(t);
    }
    mine.sort((a, c) => dist2(a % S.W, (a / S.W) | 0, b.x, b.y) - dist2(c % S.W, (c / S.W) | 0, b.x, b.y) || a - c);
    for (const t of mine.slice(0, AI_FARM_TILES)) claimed[t] = 1;
  }
  return claimed;
}

/** The fertile tiles a Bio Farm of p's at (cx, cy) could farm that none of p's farms claims (see aiFarmClaims). */
function aiFarmSoil(p, cx, cy, claimed) {
  const r = BDEFS.farm.radius, zone = S.zone[tIdx(cx, cy)];
  let n = 0;
  for (let j = Math.max(0, cy - r); j <= Math.min(S.H - 1, cy + r); j++) for (let i = Math.max(0, cx - r); i <= Math.min(S.W - 1, cx + r); i++) {
    const t = j * S.W + i;
    if (!claimed[t] && aiFarmable(p, t, i, j, cx, cy, zone)) n++;
  }
  return n;
}

function aiSearchSpot(p, type, lander) {
  const def = BDEFS[type], P = S.players[p];
  const sums = type === 'outpost' ? [R_ORE, R_CRYSTAL, R_STALK, R_BOULDER, R_OIL, R_URANIUM].map(resourceSums) : null;
  // Short of Crystal: the Crystal no-one holds, for an Outpost to head toward (see below).
  const freeCr = type === 'outpost' && (P.short || []).includes(R_CRYSTAL) ? [] : null;
  if (freeCr) for (let t = 0; t < S.W * S.H; t++) if (S.res[t] === R_CRYSTAL && S.owner[t] < 0) freeCr.push(t);
  const enemyL = getE(S.players[rivalOf(p)].lander);
  const ex = enemyL ? enemyL.x : S.W / 2, ey = enemyL ? enemyL.y : S.H / 2;
  const cands = [];
  // Every building needs a road to storage: skip spots no road can reach, and (except for
  // Outposts and Silos, which want to be far out) prefer spots close to the roads we have.
  const reach = roadReach(p), budget = roadTilesAffordable(p) + 10;
  const far = type === 'outpost' || type === 'silo';
  const avoid = (S.players[p].avoid || []).filter((a) => a.until > S.time);
  S.players[p].avoid = avoid;
  const defence = DEFENCE_TYPES.has(type);
  const foeB = type === 'silo' && aiStyle(p).missiles ? S.buildings.filter((b) => !b.dead && b.built && b.owner === rivalOf(p)) : null;
  // An Ore Mine counts only the Ore none of our Mines already works (two side by side on a small patch both ran dry
  // inside a minute). Not the others: Stone and Fiber lie thick, and spreading Quarries out slowed whole colonies.
  let covered = null;
  if (type === 'mine') {
    covered = new Uint8Array(S.W * S.H);
    const r = def.radius, r2 = r * r + 0.3;
    for (const b of S.buildings) {
      if (b.dead || b.owner !== p || b.type !== type) continue;
      for (let j = Math.max(0, b.y - r); j <= Math.min(S.H - 1, b.y + r); j++) for (let i = Math.max(0, b.x - r); i <= Math.min(S.W - 1, b.x + r); i++) {
        if (dist2(i, j, b.x, b.y) <= r2) covered[j * S.W + i] = 1;
      }
    }
  }
  // Bio Farms go by the patch: only the fertile tiles none of our farms works yet count (see AI_FARM_TILES).
  const claimed = def.farm ? aiFarmClaims(p) : null;
  const freeRes = (cx, cy) => {
    const r = def.radius, r2 = r * r + 0.3, zone = S.zone[tIdx(cx, cy)];
    let n = 0;
    for (let j = Math.max(0, cy - r); j <= Math.min(S.H - 1, cy + r); j++) for (let i = Math.max(0, cx - r); i <= Math.min(S.W - 1, cx + r); i++) {
      const t = j * S.W + i;
      if (S.res[t] === def.gather && !covered[t] && S.zone[t] === zone && dist2(i, j, cx, cy) <= r2) n++;
    }
    return n;
  };
  // Our own land first; only when there's no spot there, no-one's ground within reach (in AI-vs-AI games,
  // building out on open ground from the start left the economy short of Fiber and Alloy).
  for (let pass = 0; pass < 2 && !cands.length; pass++)
  for (let j = 0; j < S.H; j++) {
    for (let i = 0; i < S.W; i++) {
      // Out on no-one's ground (never for defences), a building keeps clear of a rival's land (their ring
      // could cut it off), an Outpost a little less so.
      let out = false;
      if (S.owner[j * S.W + i] !== p) {
        const dock = type === 'terminal'; // a Terminal docks at a Trade Post, wherever it stands (a road follows)
        if (!pass || defence || S.owner[j * S.W + i] >= 0 || !(dock || inReach(p, j * S.W + i))) continue;
        if (rivalLandNear(p, i, j, type === 'outpost' || dock ? 3 : AI_CLEAR_OF_RIVAL)) continue;
        out = true;
      }
      if (S.fert[j * S.W + i] && type !== 'farm') continue; // keep fertile soil for farming
      if (gunCovers(p, j * S.W + i) || dangerAt(p, i, j)) continue; // not where an enemy gun reaches: nobody could build it (nor where its robots were just shot down: noteDanger)
      if (avoid.some((a) => dist2(a.x, a.y, i, j) < (a.r2 || 12))) continue;
      if (!canPlace(p, type, i, j, true).ok) continue;
      let rc = Infinity;
      for (const u of roadSides(p, i, j)) rc = Math.min(rc, reach[u]);
      if (rc > budget) continue;
      const dHome = dist(i, j, lander.x, lander.y);
      const jitter = hash2(i, j, S.seed + p) * 0.8;
      let s, gn = -1;
      if (def.gather) {
        const n = type === 'mine' ? freeRes(i, j) : aiUsableRes(p, i, j, def.radius, def.gather); // (only what it could work: see aiUsableRes)
        gn = n;
        const u = type === 'mine' && nukeOn() ? reachableRes(i, j, def.radius, R_URANIUM) : 0;
        if (n < 2 && !u) {
          // No boulders left anywhere near: a Quarry by a cliff or crag cuts Stone from it instead.
          if (!def.bedrock) continue;
          const f = rockFacesIn(i, j, def.radius);
          if (f < 3) continue;
          s = Math.min(f, 10) * 0.6 - dHome * 0.35 - 8;
        } else s = Math.min(n, 10) * 2 - dHome * 0.35 + u * 12; // a mine on uranium beats any ore field
      } else if (def.plant) {
        let dh = 99;
        for (const b of S.buildings) if (!b.dead && b.owner === p && b.type === 'harvester') dh = Math.min(dh, dist(i, j, b.x, b.y));
        s = -(dh < 99 ? dh : dHome) - countResIn(i, j, def.radius, R_STALK) * 0.2; // (by a Harvester, or else near home)
      } else if (type === 'outpost') {
        const ore = Math.min(sums[0](i, j, 5), 8), cry = Math.min(sums[1](i, j, 5), 8);
        const rest = Math.min(sums[2](i, j, 5), 6) + Math.min(sums[3](i, j, 5), 6) + Math.min(sums[4](i, j, 5), 4) * 1.5;
        s = -dist(i, j, ex, ey) * 0.6 + dHome * 0.5 + ore * 1.6 + cry * 1.0 + rest * 0.3;
        if (nukeOn()) s += Math.min(sums[5](i, j, 6), 3) * 6; // the race for uranium
        if (S.victory === 'domination') s += newLandAt(p, i, j, BDEFS.outpost.terr) * 0.1; // Domination: the land it claims
        if (S.victory === 'uplinks' && S.uplinks) { // Uplinks: one its land would cover, not ours yet, and the way to the nearest free one
          let near = Infinity;
          for (const u of S.uplinks) {
            if (u.owner === p) continue;
            const du = dist(i, j, u.x, u.y);
            if (du <= BDEFS.outpost.terr - 1) s += 40 - du * 2;
            if (u.owner < 0) near = Math.min(near, du);
          }
          if (near < Infinity) s += Math.max(0, 44 - near) * 0.9; // (stronger than the pull toward the enemy base)
        }
        // Crossroads for three: the rich quarter no one landed in draws expansion too.
        if (S.spare) s += Math.max(0, 34 - dist(i, j, S.spare.x, S.spare.y)) * 0.3;
        // Head for whatever we're running out of.
        for (const r of P.short || []) s += Math.min(sums[[R_ORE, R_CRYSTAL, R_STALK, R_BOULDER].indexOf(r)](i, j, 5), 6) * 1.5;
        // ...and short of Crystal, the way to the nearest no-one holds on this ground too, when none is in reach yet (a
        // chain of Outposts).
        if (freeCr && freeCr.length) {
          let dc = Infinity;
          for (const t of freeCr) if (S.zone[t] === S.zone[j * S.W + i]) dc = Math.min(dc, dist2(i, j, t % S.W, (t / S.W) | 0));
          s += Math.max(0, AI_CRYSTAL_REACH - Math.sqrt(dc)) * 0.6;
        }
      } else if (def.farm) {
        // The best patch none of our farms works: up to what one farm keeps up with (a little more for a spare tile
        // or two), off the soil itself where it can be.
        const n = aiFarmSoil(p, i, j, claimed);
        if (n < AI_FARM_MIN) continue;
        s = Math.min(n, AI_FARM_TILES) * 3 + Math.min(Math.max(0, n - AI_FARM_TILES), 3) * 0.5 - dHome * 0.3 - (S.fert[j * S.W + i] ? 2 : 0);
      } else if (def.pump) {
        let oil = 0;
        for (let dj = -1; dj <= 1; dj++) for (let di = -1; di <= 1; di++) {
          if (inMap(i + di, j + dj) && S.res[tIdx(i + di, j + dj)] === R_OIL) oil += S.amt[tIdx(i + di, j + dj)];
        }
        s = oil * 0.2 - dHome * 0.3;
      } else if (type === 'generator') {
        // Among the factories: the most buildings it can power, not beside another Generator.
        let n = 0, dg = 99;
        for (const b of S.buildings) {
          if (b.dead || b.owner !== p) continue;
          const d2 = dist2(i, j, b.x, b.y);
          if (BDEFS[b.type].work && d2 <= 16) n++;
          if (b.type === 'generator') dg = Math.min(dg, Math.sqrt(d2));
        }
        if (n < 3 || dg < 5) continue;
        s = n * 3 - dHome * 0.2;
      } else if (type === 'refinery') {
        let dp = dHome;
        for (const b of S.buildings) if (!b.dead && b.owner === p && b.type === 'pump') dp = Math.min(dp, dist(i, j, b.x, b.y));
        s = -dp - dHome * 0.2;
      } else if (type === 'turret') {
        // Round the Command Base, on the side facing the enemy, spread out from the other turrets.
        let dt = 7;
        for (const b of S.buildings) if (!b.dead && b.owner === p && b.type === 'turret') dt = Math.min(dt, dist(i, j, b.x, b.y));
        s = -Math.abs(dHome - 3.5) * 2 - dist(i, j, ex, ey) * 0.15 + dt * 0.9;
      } else if (type === 'bunker' || type === 'disruptor' || type === 'mortar' || type === 'minigun') {
        // Out at the front: beside the fort nearest the enemy (a Mortar a little behind it, to reach
        // over it), and spread out from others of its kind.
        let df = 99, dk = 99;
        const at = P.defWant && P.defWant.type === type && S.time < P.defWant.until ? P.defWant : null; // beside the fort under attack
        for (const b of S.buildings) {
          if (b.dead || b.owner !== p) continue;
          const d = dist(i, j, b.x, b.y);
          if (BDEFS[b.type].mil && !BDEFS[b.type].bunker && (!at || (b.x === at.x && b.y === at.y))) df = Math.min(df, d + (at ? 0 : dist(b.x, b.y, ex, ey) * 0.25));
          if (b.type === type) dk = Math.min(dk, d);
        }
        if (at && at.up) { df = dist(i, j, at.x, at.y); dk = 8; } // (beside an Uplink: its guns reach all round it)
        const want = at && at.up ? 1.5 : type === 'mortar' ? 4 : 2.5;
        s = -Math.abs(df - want - 0) * 1.5 - dist(i, j, ex, ey) * 0.25 + Math.min(dk, 8) * 0.5;
        // (Against a parked army, at.ax: 7 to 10 tiles from it, so that it is in reach and the builder isn't.)
        if (at && at.ax !== undefined) { const da = dist(i, j, at.ax, at.ay); if (da < 7) continue; s = -Math.abs(da - 8.5) * 2 - Math.abs(df - want) * 0.5 + Math.min(dk, 8) * 0.3; }
      } else if (type === 'port') {
        let dp = 99;
        for (const b of S.buildings) if (!b.dead && b.owner === p && BDEFS[b.type].port) dp = Math.min(dp, dist(i, j, b.x, b.y));
        s = dp < 99 ? Math.min(dp, 30) - dist(i, j, ex, ey) * 0.3 : -dHome; // a second Port: away from the first, toward the enemy
      } else if (type === 'keep') {
        // Toward the front but not out on a limb, covering as many of our Walls, Gates and defences as it can.
        let cover = 0;
        for (const b of S.buildings) {
          if (b.dead || b.owner !== p || dist2(b.x, b.y, i, j) > KEEP.aura * KEEP.aura) continue;
          if (BDEFS[b.type].barrier || ['turret', 'minigun', 'bunker', 'mortar', 'flak', 'disruptor'].includes(b.type)) cover++;
          else if (BDEFS[b.type].mil) cover += 0.5;
        }
        s = -Math.abs(dHome - 8) * 0.8 - dist(i, j, ex, ey) * 0.15 + Math.min(cover, 12) * 0.7;
        // Uplinks: beside one of ours (or a free one its ring would take), to hold it.
        if (S.victory === 'uplinks' && (S.uplinks || []).some((u) => u.owner === p || u.owner < 0 ? dist(i, j, u.x, u.y) <= BDEFS.keep.terr - 1 : false)) s += 12;
      } else if (type === 'terminal') {
        // Out far enough to pay well (but not past the bonus), away from the enemy, close to our roads.
        s = Math.min(dHome, TERMINAL.minDist + TERMINAL.maxBonus / TERMINAL.perTile) * 0.5 + dist(i, j, ex, ey) * 0.3 - rc * 0.4;
      } else if (type === 'silo') {
        s = -dist(i, j, ex, ey); // as close to the enemy as our land allows
        // An Architect's stand back: the spot nearest home with six of its rival's buildings in a Missile's reach (fewer
        // count for less), out of reach of an attack from any of them if it can be. (Up at the border its Silos were
        // the first thing the rival's warbots reached.)
        if (foeB) {
          let n = 0, near = Infinity;
          for (const b of foeB) { const d = dist(i, j, b.x, b.y); if (d <= BDEFS.silo.missile.range) n++; if (d < near) near = d; }
          s = n ? Math.min(n, 6) * 4 - Math.max(0, ATTACK_RANGE + 2 - near) * 1.5 - dHome * 0.15 : s - 50;
        }
      } else if (type === 'depot') {
        // A forward base: out towards the Outposts, but on the road network.
        s = Math.min(dHome, 18) * 0.6 - dist(i, j, ex, ey) * 0.1;
      } else if (type === 'charger') {
        // The first Fuel Station by the Command Base (on the home roads, so the Haulers can stock it at once: out by a
        // site no road reaches yet, the robots ran flat waiting for it). The rest spread out, near where bots work: by
        // buildings that stand, not sites (an Outpost site far out can wait for its road for minutes).
        let dc = 99, db = 99;
        for (const b of S.buildings) {
          if (b.dead || b.owner !== p) continue;
          const d = dist(i, j, b.x, b.y);
          if (BDEFS[b.type].charger) dc = Math.min(dc, d); else if (b.built) db = Math.min(db, d);
        }
        s = dc === 99 ? -dHome * 2 - rc * 2 : Math.min(dc, 12) - db * 0.8;
      } else {
        s = -dHome;
      }
      s -= Math.min(rc, 30) * (far ? 0.05 : 0.35);
      // Feed links: a factory beside the building that makes its input (or uses its output) is worth a few tiles.
      if (AI_FEED.has(type)) s += Math.min(2, feedPreview(p, type, i, j).length) * 3;
      s += jitter;
      if (out && type !== 'outpost') s -= AI_OUT_COST; // (our own land first)
      cands.push({ x: i, y: j, s, gn });
    }
  }
  // Only the best few spots get the (costly) checks that a building won't block a pass and that
  // a road can reach it.
  cands.sort((a, b) => b.s - a.s);
  if (def.gather) {
    // A gatherer's best spots are walked (walkRes): groves on a clifftop two tiles off can be fifty tiles away on
    // foot, and a Harvester below them cut one Fiber every other minute. Best first, each scored again with the
    // nodes it can reach on a short walk, until no spot left could beat the best found (a walked score is never higher).
    let best = null;
    for (let k = 0; k < Math.min(cands.length, 120) && !(best && cands[k].s <= best.s); k++) {
      const c = cands[k];
      let s = c.s;
      if (c.gn >= 2) {
        const w = Math.min(c.gn, walkRes(c.x, c.y, def.radius, def.gather)); // (a Mine counts only the Ore no Mine of ours works: never more)
        if (w < 2 && !(type === 'mine' && nukeOn() && reachableRes(c.x, c.y, def.radius, R_URANIUM))) continue;
        s += (Math.min(w, 10) - Math.min(c.gn, 10)) * 2;
      }
      if ((best && s <= best.s) || wouldBlock(tIdx(c.x, c.y))) continue;
      best = { x: c.x, y: c.y, s };
    }
    return best;
  }
  for (let k = 0; k < Math.min(cands.length, 12); k++) {
    if (!wouldBlock(tIdx(cands[k].x, cands[k].y))) return cands[k];
  }
  return null;
}

/**
 * In a war, the rival armors its Freight Trains (see TRAIN_ARMOR), one at a time, once it has the goods to spare
 * (three times the cost and a margin; once its trains have been shot at, just the margin). Checked every half
 * minute or so.
 */
/** Uplinks: whether fort b's ring takes in an Uplink its owner holds. */
function holdsUplink(b) {
  const r = BDEFS[b.type].terr;
  return !!(r && b.built && !b.dead && S.uplinks && S.uplinks.some((u) => u.owner === b.owner && dist(u.x, u.y, b.x, b.y) <= r + 0.5));
}

/** A free tile right beside Uplink u (on the side toward `from`, if given) for a flag, or null. */
function besideUplink(u, from) {
  let best = null, bd = Infinity;
  for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-1, 1], [1, -1], [-1, -1]]) {
    const i = u.x + di, j = u.y + dj;
    if (!inMap(i, j) || !walkable(tIdx(i, j)) || S.bAt[tIdx(i, j)]) continue;
    const d = from ? dist2(i, j, from.x, from.y) : di * di + dj * dj;
    if (d < bd) { bd = d; best = { i, j }; }
  }
  return best;
}

/**
 * Uplinks: the rival plays for the Uplinks rather than the usual siege of the Command Base. It races for the free
 * ones (its Outposts head for them, see aiSearchSpot and the plan in aiThink; aiBridge crosses to one it can't walk
 * to), goes for the forts holding the others (step 5 of aiThink, its missiles and bombers), and holds its own:
 * - its forts there call on new warbots first (garrison priority High);
 * - from a little before the Uplinks come online, a band of guards on a flag beside each one (2 to 4 by difficulty),
 *   topped up, with two more for every enemy warbot jamming it, to drive them off;
 * - a Bunker right beside each one (one at a time, through the defence plan).
 */
function aiUplinks(p, lvl, counts) {
  const P = S.players[p];
  if (!S.uplinks) return;
  P.upGuards = P.upGuards || {}; P.upGuardAt = P.upGuardAt || {};
  const soon = S.time >= UPLINK.online - 90, guards = Math.max(2, Math.min(4, 8 - lvl.threshold));
  for (const u of S.uplinks) {
    const r = P.upGuards[u.id] ? rallyById(P.upGuards[u.id]) : null;
    if (u.owner !== p) { if (r) recallRally(r.id); delete P.upGuards[u.id]; continue; } // lost (or never ours): the guards come home
    for (const b of S.buildings) {
      if (b.dead || b.owner !== p || !b.built || !BDEFS[b.type].terr || b.gprio === 'high' || dist(b.x, b.y, u.x, u.y) > BDEFS[b.type].terr + 0.5) continue;
      b.gprio = 'high'; b.upHold = true;
    }
    if (!soon) continue;
    const jammers = u.jam ? S.bots.filter((w) => !w.dead && !w.inside && isArmy(w) && w.owner >= 0 && foes(w.owner, p) && dist2(w.x, w.y, u.x + 0.5, u.y + 0.5) <= 16).length : 0;
    const want = guards + jammers * 2, have = r ? rallyMembers(r.id).length : 0;
    if (have >= want || S.time - (P.upGuardAt[u.id] || -99) < (jammers ? 5 : 20)) continue;
    P.upGuardAt[u.id] = S.time;
    const E = getE(S.players[rivalOf(p)].lander);
    const spot = r ? { i: Math.floor(r.x), j: Math.floor(r.y) } : besideUplink(u, E);
    if (!spot) continue;
    const n = Math.min(want - have, rallyAvailable(p, spot.i, spot.j) - (jammers ? 0 : 1)); // (jammed: everyone it can spare)
    if (n <= 0) continue;
    const res = sendToRally(p, spot.i, spot.j, n);
    if (res.sent) P.upGuards[u.id] = res.rally.id;
  }
  // Forts that no longer hold one go back to the usual priority.
  for (const b of S.buildings) if (b.upHold && b.owner === p && !holdsUplink(b)) { b.gprio = undefined; b.upHold = false; }
  // A Bunker right beside each Uplink it holds that has no gun of ours beside it, one at a time.
  if (S.time > AI_DEFENCE_AT && !(P.defWant && S.time < P.defWant.until) && S.time - (P.upDefAt || -999) > 90) {
    const bare = S.uplinks.find((u) => u.owner === p && !S.buildings.some((b) => !b.dead && b.owner === p && ['bunker', 'minigun', 'turret', 'keep'].includes(b.type) && dist2(b.x, b.y, u.x, u.y) <= 16));
    if (bare) { P.defWant = { type: 'bunker', n: (counts.bunker || 0) + 1, until: S.time + 150, x: bare.x, y: bare.y, up: true }; P.upDefAt = S.time; }
  }
}

/**
 * Uplinks: a rival is running its clock, so a band of warbots goes to stand beside the nearest Uplink it holds,
 * jamming it (once a minute at most, with warbots to spare, and not while a band is already out there).
 */
function aiJamUplink(p, foe) {
  const P = S.players[p], L = getE(P.lander);
  if (!L || S.time - (P.lastJam || -999) < 60 || (P.jamRally && rallyById(P.jamRally))) return;
  let best = null, bd = Infinity;
  for (const u of S.uplinks || []) {
    if (u.owner !== foe || u.jam) continue;
    const d = dist2(u.x, u.y, L.x, L.y);
    if (d < bd) { bd = d; best = u; }
  }
  if (!best) return;
  const spot = besideUplink(best, L);
  if (!spot) return;
  // (Five at least, and more for the defences round it: they'd stand there under its guns.)
  const sp = aiSpare(p, { x: spot.i, y: spot.j }, 'flag'), avail = sp.n;
  const guns = Math.ceil(aiFire(aiGuards(foe, spot.i, spot.j, 2, null), sp.shields) - 1e-9);
  if (avail < 5 + guns) { if (guns && avail >= 5) P.shieldWant = S.time; return; }
  const { sent, rally } = sendToRally(p, spot.i, spot.j, Math.min(8 + guns, avail - 2), true, false, true);
  if (sent) { rally.first = aiFirstGun(foe, spot.i, spot.j); P.jamRally = rally.id; P.lastJam = S.time; }
}

/** Uplinks: how far the nearest free Uplink lies past the rings of our Outposts, Keeps and Command Base (sites too), or Infinity with none free. */
function aiUplinkGap(p) {
  let gap = Infinity;
  for (const u of S.uplinks || []) {
    if (u.owner >= 0) continue;
    for (const b of S.buildings) {
      if (b.dead || b.owner !== p || !BDEFS[b.type].terr) continue;
      gap = Math.min(gap, Math.max(0, dist(u.x, u.y, b.x, b.y) - BDEFS[b.type].terr));
    }
  }
  return gap;
}

/** Domination: about how much land an Outpost at (i, j) would add (no-one's ground in its ring, a rival's at half). */
function newLandAt(p, i, j, r) {
  let n = 0;
  for (let dj = -r; dj <= r; dj += 2) for (let di = -r; di <= r; di += 2) {
    const x = i + di, y = j + dj;
    if (!inMap(x, y) || di * di + dj * dj > r * r) continue;
    const t = tIdx(x, y);
    if (S.terrain[t] !== T_GROUND || S.owner[t] === p) continue;
    n += S.owner[t] < 0 ? 4 : 2; // (every other tile each way: four tiles' worth)
  }
  return n;
}

function aiArmorTrains(p) {
  const P = S.players[p];
  if (!warOn() || S.time < (P.armorCheckAt || 0)) return;
  P.armorCheckAt = S.time + 25;
  const trains = S.bots.filter((u) => !u.dead && u.owner === p && BOTS[u.type].rail);
  if (!trains.length || trains.some((u) => u.armorOrder)) return;
  const t = trains.find((u) => !u.armored);
  if (!t) return;
  const have = playerGoods(p), spare = trains.some((u) => u.hp < u.maxHp) ? 1 : 3;
  for (const g in TRAIN_ARMOR.cost) if ((have[g] || 0) < TRAIN_ARMOR.cost[g] * spare + (g === 'alloy' ? 10 : 4)) return;
  orderTrainArmor(p, t);
}

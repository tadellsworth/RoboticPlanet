'use strict';
/*
 * Terrafall — rival AI. It plays by the same rules as the player: it places construction sites
 * from a build plan, picks good spots, balances worker/warbot production and attacks once it
 * has gathered enough warbots near a target.
 */

/** [good, pause at, resume below]: producers the AI rests when it has plenty. */
const AI_CAPS = { fab: ['chip', 8, 3], armory: ['ammo', 18, 6], refinery: ['fuel', 30, 10] };
/** [building type, how many the AI wants]. Entries are tried in order. */
const AI_PLAN = [
  ['harvester', 1], ['quarry', 1], ['kiln', 1], ['harvester', 2], ['mine', 1], ['tap', 1], ['smelter', 1],
  ['fab', 1], ['foundry', 1], ['outpost', 1], ['armory', 1], ['charger', 1], ['farm', 1], ['quarry', 2], ['grower', 1], ['mine', 2],
  ['kiln', 2],
  ['turret', 1], ['repair', 1], ['outpost', 2], ['smelter', 2], ['tap', 2], ['pump', 1], ['refinery', 1], ['harvester', 3], ['outpost', 3],
  ['munitions', 1], ['silo', 1], ['depot', 1], ['charger', 2], ['farm', 2], ['mine', 3], ['outpost', 4], ['turret', 2],
  ['grower', 2], ['fab', 2], ['outpost', 5], ['armory', 2], ['quarry', 3], ['silo', 2], ['outpost', 6], ['charger', 3], ['pump', 2],
  ['tap', 3], ['farm', 3], ['outpost', 8], ['turret', 3],
];

function aiThink(p) {
  const P = S.players[p];
  const lvl = DIFFICULTY[S.difficulty];
  const me = playerBuildings(p);
  const lander = getE(P.lander);
  if (!lander || lander.owner !== p) return;

  // 1) Construction
  const counts = {};
  let sites = 0;
  for (const b of me) {
    counts[b.type] = (counts[b.type] || 0) + 1;
    if (!b.built) sites++;
  }
  const maxSites = p === 0 && P.ai ? 2 : lvl.maxSites;
  let workers = 0, staffed = 0;
  const kinds = {};
  for (const u of S.bots) if (!u.dead && u.owner === p) kinds[u.type] = (kinds[u.type] || 0) + 1;
  workers = kinds.worker || 0;
  for (const b of me) if (BDEFS[b.type].staff && !BDEFS[b.type].crew) staffed++;
  // Keep a few workers free to build: a colony with every worker staffed stalls.
  const canStaffMore = staffed + Math.max(3, Math.round(workers * 0.2)) <= workers;
  // Resources are in separate fields: when one kind runs short inside our land, expanding toward
  // more of it comes before anything else.
  const inLand = {};
  for (let t = 0; t < S.W * S.H; t++) if (S.owner[t] === p && S.res[t]) inLand[S.res[t]] = (inLand[S.res[t]] || 0) + 1;
  // Stone goes into nearly everything (and Cement for roads), so boulders count as running short sooner.
  P.short = [R_STALK, R_BOULDER, R_ORE, R_CRYSTAL].filter((r) => (inLand[r] || 0) < (r === R_BOULDER ? 6 : 4));
  const stoneLow = (inLand[R_BOULDER] || 0) < 10;
  const quarrying = me.some((b) => b.type === 'quarry' && (!b.built || reachableRes(b.x, b.y, BDEFS.quarry.radius, R_BOULDER) > 0));
  // While boulders run low, keep enough Cement for the Outpost that reaches new ones.
  const reserveCement = stoneLow && playerGoods(p).cement < BDEFS.outpost.cost.cement + 2;
  if (stoneLow && !quarrying) aiFreeCement(p, me);
  // Cancel construction sites that have waited a long time for goods we don't have.
  if (sites >= maxSites) {
    const have = playerGoods(p);
    for (const b of me) {
      if (b.built || b.dead || S.time - b.born < 120) continue;
      const cost = BDEFS[b.type].cost;
      let stuck = false;
      for (const g in cost) if ((b.stock[g] || 0) + (b.inc[g] || 0) < cost[g] && have[g] <= 0) stuck = true;
      if (stuck) { demolish(b); sites--; break; }
    }
  }
  let plan = S.mode === 'colony' ? AI_PLAN.concat([['outpost', 40]]) : AI_PLAN;
  // No Cement Works: Cement builds nearly everything (and every road), so one comes first, even
  // past the usual limit on sites.
  const cementStarved = !me.some((b) => b.type === 'kiln');
  let siteCap = maxSites;
  if (cementStarved) { plan = [['kiln', 1]].concat(plan); siteCap = maxSites + 1; }
  const outSite = me.some((b) => b.type === 'outpost' && !b.built);
  if (P.short.length && !outSite && S.time - (P.lastExpand || -99) > 40) plan = [['outpost', (counts.outpost || 0) + 1]].concat(plan);
  // Missiles are expensive, so the AI saves up for them (see aiMissilePlan): while it is saving,
  // the building it saves for goes first and nothing else that costs Alloy or Chips is started.
  const saving = aiMissilePlan(p, me, counts, kinds, workers, staffed);
  if (saving) plan = [[saving, (counts[saving] || 0) + 1]].concat(plan);
  // Workers no longer haul, so spare ones go to work: another gatherer for the scarcest raw good.
  if (S.time > 150 && workers - staffed >= 4 && canStaffMore) {
    const have = playerGoods(p);
    const g = ['harvester', 'quarry', 'mine', 'tap'].filter((t) => (counts[t] || 0) < 3 && (have[RES[BDEFS[t].gather].good] || 0) < 8)
      .sort((a, c) => (have[RES[BDEFS[a].gather].good] || 0) - (have[RES[BDEFS[c].gather].good] || 0));
    if (g.length) plan = [[g[0], (counts[g[0]] || 0) + 1]].concat(plan);
  }
  // A Harvester site only counts once its materials are in: one waiting for Fiber never gets any.
  const cutting = me.some((b) => b.type === 'harvester' &&
    (b.built ? reachableRes(b.x, b.y, BDEFS.harvester.radius, R_STALK) > 0 : sumValues(b.stock) >= sumValues(BDEFS.harvester.cost)));
  const fiberLow = !cutting || playerGoods(p).fiber < 4;
  if (!cutting) plan = [['harvester', (counts.harvester || 0) + 1]].concat(plan);
  // With Fiber nearly gone (no Harvester at work, or construction waiting for it), the Smelters
  // stop burning it until there's some to spare.
  const fiberNow = playerGoods(p).fiber;
  const sitesWantFiber = me.some((b) => !b.built && (BDEFS[b.type].cost.fiber || 0) > (b.stock.fiber || 0) + (b.inc.fiber || 0));
  for (const b of me) {
    if (b.type !== 'smelter' || !b.built) continue;
    if (!b.paused && fiberNow < 3 && (!cutting || sitesWantFiber)) setPaused(b, true);
    else if (b.paused && cutting && (fiberNow >= 6 || !sitesWantFiber)) setPaused(b, false);
  }
  // Goods held back for a key building we can't afford yet: nothing that needs them starts first.
  const held = new Set();
  const key = (type) => type === 'foundry' || type === 'harvester' || type === 'quarry' || (type === 'kiln' && (playerGoods(p).cement || 0) < 3) ||
    (type === 'outpost' && P.short.length > 0);
  if (sites < siteCap) {
    for (const [type, want0] of plan) {
      if (cementStarved && sites >= maxSites && type !== 'kiln') continue;
      if (S.mode === 'colony' && BDEFS[type].war) continue;
      // One more Charging Station for every three Outposts as the colony spreads out, and a Bio
      // Farm for every two stations to keep them in Fuel.
      const nCh = Math.max(1 + Math.floor((counts.outpost || 0) / 3), 0);
      const want = type === 'charger' ? Math.max(want0, nCh) : type === 'farm' && counts.charger ? Math.max(want0, Math.ceil((counts.charger || 0) / 2)) : want0;
      if (type === 'refinery' && !counts.pump) continue;
      // Plenty of Fuel in stock: no need for more farms or oil yet.
      if ((type === 'farm' || type === 'pump' || type === 'refinery') && (counts[type] || 0) >= 1 && playerGoods(p).fuel > 10) continue;
      if ((counts[type] || 0) >= want) continue;
      if (saving && type !== saving && (BDEFS[type].cost.alloy || BDEFS[type].cost.chip)) continue;
      // Keep enough Fiber for a Harvester while none is cutting: without Fiber there's no way back.
      if (type !== 'harvester' && fiberLow && (BDEFS[type].cost.fiber || 0) > 0 && playerGoods(p).fiber - BDEFS[type].cost.fiber < BDEFS.harvester.cost.fiber) continue;
      // The first of each staffed building is always allowed, so the production chain is complete.
      if (BDEFS[type].staff && !BDEFS[type].crew && !canStaffMore && counts[type]) continue;
      if (Object.keys(BDEFS[type].cost).some((g) => held.has(g))) continue;
      if (reserveCement && type !== 'outpost' && type !== 'quarry' && type !== 'kiln' && BDEFS[type].cost.cement) continue;
      if (type === 'kiln' && stoneLow && counts.kiln) continue;
      if (!aiAffordable(p, type)) {
        if (key(type) && (!counts[type] || type === 'outpost')) {
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
        break;
      }
    }
  }

  // 1a) Repairs: damaged buildings get fixed once the fighting there stops (military ones first,
  //     the rest only with Cement to spare).
  if (S.mode !== 'colony') {
    for (const b of me) {
      if (!b.built || b.fixLeft > 0 || S.time - (b.lastHit || -99) < 6 || b.armor >= BDEFS[b.type].armor * 0.75) continue;
      if (BDEFS[b.type].mil || playerGoods(p).cement >= repairCost(b) + 6) requestRepair(p, b);
    }
  }

  // 1b) Roads: haulers only travel on roads, so every building needs one to storage. The Cement
  //     Works rests while there is plenty of Cement, so it doesn't burn all the Stone.
  aiRoads(p, me);
  // Producers rest once there's plenty of what they make, so they don't eat inputs other
  // buildings need (Chips and Ammo would otherwise swallow all the Alloy the Foundry needs).
  const stockNow = playerGoods(p), missiles = !!(saving || P.feedMissiles);
  for (const b of me) {
    const cap = AI_CAPS[b.type];
    if (!cap || !b.built) continue;
    const hi = cap[1] * (missiles && b.type === 'fab' ? 2 : 1), lo = cap[2];
    const have = stockNow[cap[0]] || 0;
    if (!b.paused && have >= hi) setPaused(b, true);
    else if (b.paused && have < lo) setPaused(b, false);
  }

  // 2) Retire gatherers and pumps that have run dry so their worker can be reused.
  for (const b of me) {
    const def = BDEFS[b.type];
    if (b.built && def.gather && S.time - b.born > 30 && reachableRes(b.x, b.y, def.radius, def.gather) === 0 && !(b.stock[RES[def.gather].good] > 1)) {
      demolish(b);
    } else if (b.built && def.pump && pumpSeep(b) < 0 && !(b.stock.crude > 0)) {
      demolish(b);
    }
  }

  // 3) Foundry: keep enough workers, then make warbots. Order specialists when a building needs
  //    one, and plenty of Haulers: they carry every good in the colony.
  const wantWorkers = staffed + 3 + Math.min(3, sites);
  const wantHaulers = Math.max(4, Math.ceil(me.length * 0.45));
  const crewNeed = {};
  for (const b of me) {
    const crew = BDEFS[b.type].crew;
    if (crew && b.built) crewNeed[crew] = (crewNeed[crew] || 0) + 1;
  }
  for (const b of me) {
    if (b.type !== 'foundry' || !b.built) continue;
    b.mode = S.mode === 'colony' ? 'worker' : workers < wantWorkers ? 'worker' : workers > wantWorkers + 4 ? 'warbot' : 'alt';
    b.orders = b.orders || {};
    for (const crew in crewNeed) if ((kinds[crew] || 0) < crewNeed[crew] && !(b.orders[crew] > 0)) b.orders[crew] = 1;
    // Saving up for missiles (or feeding the Missile Factory): the Foundry rests so Alloy and Chips
    // pile up, unless workers are badly short.
    if ((saving || P.feedMissiles) && workers >= staffed + 3) { b.mode = 'off'; delete b.orders.hauler; delete b.orders.truck; }
    else if ((kinds.hauler || 0) < wantHaulers && !(b.orders.hauler > 0)) b.orders.hauler = 1;
    // A forward Depot with supply orders gets a Freight Truck to keep it stocked.
    else if (me.some((d) => d.keep && d.built) && (kinds.truck || 0) < 1 + Math.floor(me.length / 35) && !(b.orders.truck > 0)) b.orders.truck = 1;
    break;
  }
  // Depots out towards the front keep Cement for building there.
  for (const d of me) {
    if (d.type !== 'depot' || !d.built || d.keep || dist(d.x, d.y, lander.x, lander.y) < 12) continue;
    setKeep(d, 'cement', 12);
    if (S.mode !== 'colony') setKeep(d, 'ammo', 4);
  }

  // 4) Missiles: soften turrets and Outposts first, the Command Base once the army is big.
  const enemy = 1 - p;
  if (S.mode !== 'colony' && S.time >= lvl.grace) {
    for (const silo of me) {
      if (!siloReady(silo)) continue;
      let best = null, bs = -Infinity;
      for (const e of S.buildings) {
        if (e.dead || e.owner !== enemy || !e.built) continue;
        const d = dist(silo.x, silo.y, e.x, e.y);
        if (d > BDEFS.silo.missile.range) continue;
        const s = (e.type === 'turret' ? 10 : e.type === 'outpost' ? 8 : e.type === 'lander' ? 5 : e.type === 'silo' ? 9 : 3) - d * 0.1;
        if (s > bs) { bs = s; best = e; }
      }
      if (best) fireMissile(p, best);
    }
  }

  // 4b) Raids on the enemy's supply lines.
  if (S.mode !== 'colony' && S.time >= lvl.grace) aiRaid(p, lvl);

  // 5) Attack
  if (S.time < lvl.grace || S.time < P.nextAttack) return;
  let best = null, bestScore = -Infinity, bestAvail = 0;
  for (const b of S.buildings) {
    if (b.dead || b.owner !== enemy) continue;
    const avail = attackAvailable(p, b);
    const need = b.built ? Math.max(lvl.threshold, Math.ceil(b.garrison.length * 1.3) + 2) : 2;
    if (avail < need) continue;
    const def = BDEFS[b.type];
    let score = (def.mil ? 12 : 0) + (b.type === 'lander' ? 25 : 0) - dist(b.x, b.y, lander.x, lander.y) * 0.4 - b.garrison.length * 2;
    if (!b.built) score -= 8;
    if (score > bestScore) { bestScore = score; best = b; bestAvail = avail; }
  }
  if (best) {
    sendAttack(p, best, bestAvail);
    P.nextAttack = S.time + 25;
    P.lastAttack = S.time;
    return;
  }
  // A big army with nothing in reach: push a forward Outpost toward the enemy Command Base.
  let army = 0;
  for (const u of S.bots) if (!u.dead && u.owner === p && u.type === 'warbot') army++;
  const enemyL = getE(S.players[enemy].lander);
  if (enemyL && army >= lvl.threshold * 2 && S.time - (P.lastAttack || 0) > 60 && siteCount(p) < maxSites && aiAffordable(p, 'outpost')) {
    let spot = null, bd = Infinity;
    for (let j = 0; j < S.H; j++) for (let i = 0; i < S.W; i++) {
      if (S.owner[j * S.W + i] !== p) continue;
      const d = dist(i, j, enemyL.x, enemyL.y);
      if (d < bd && canPlace(p, 'outpost', i, j, true).ok && !wouldBlock(j * S.W + i)) { bd = d; spot = { x: i, y: j }; }
    }
    if (spot) { placeSite(p, 'outpost', spot.x, spot.y); P.lastAttack = S.time - 30; }
  }
}

/**
 * Raids: every few minutes a small band of warbots goes to the enemy's busiest road clear of its
 * turrets and garrisons, shoots up passing haulers, tears up the road (then hits whatever stands
 * near it), and comes home.
 */
const RAID_GAP = { easy: 320, normal: 170, hard: 115 };
function aiRaid(p, lvl) {
  const P = S.players[p], enemy = 1 - p;
  if (P.raid) {
    const r = rallyById(P.raid.id);
    if (!r || S.time > P.raid.until || !rallyMembers(P.raid.id).length) {
      if (r) recallRally(P.raid.id);
      P.raid = null;
      P.nextRaid = S.time + (RAID_GAP[S.difficulty] || 170);
    }
    return;
  }
  if (S.time < (P.nextRaid || lvl.grace + 90)) return;
  P.nextRaid = S.time + 30; // nothing worth raiding yet: look again soon
  if (HEAT.of !== S || !HEAT.flow) return;
  // Keep clear of turrets, and of garrisons with warbots in them.
  const guards = S.buildings.filter((b) => !b.dead && b.owner === enemy && b.built && (b.type === 'turret' || (BDEFS[b.type].mil && armedIn(b) >= 2)))
    .map((b) => ({ x: b.x, y: b.y, r2: b.type === 'turret' ? 36 : 20 }));
  let best = -1, bs = 0;
  for (let t = 0; t < S.W * S.H; t++) {
    if (!S.road[t] || S.owner[t] !== enemy || HEAT.flow[t] < 1) continue;
    const i = t % S.W, j = (t / S.W) | 0;
    if (guards.some((g) => dist2(g.x, g.y, i, j) < g.r2)) continue;
    const s = HEAT.flow[t] - dist(i, j, S.W / 2, S.H / 2) * 0.05;
    if (s > bs) { bs = s; best = t; }
  }
  if (best < 0) return;
  const i = best % S.W, j = (best / S.W) | 0;
  if (rallyAvailable(p, i, j) < 5) return; // keep enough warbots at home
  const { sent, rally } = sendToRally(p, i, j, 3);
  if (sent) { rally.raid = true; P.raid = { id: rally.id, until: S.time + 80 }; }
}

/**
 * The AI's missile programme (Versus). Once it has an economy and an army (past most of the grace
 * period, two Outposts, a few warbots and spare workers) it saves up for a Missile Factory, then a
 * Silo (a second one later). It gives up for a while if saving drags on too long. With both built,
 * it keeps the factory fed (P.feedMissiles pauses the Foundry) until its silos are nearly full.
 * Returns the building type it is saving for, or null.
 */
function aiMissilePlan(p, me, counts, kinds, workers, staffed) {
  const P = S.players[p], lvl = DIFFICULTY[S.difficulty];
  P.feedMissiles = false;
  if (S.mode === 'colony') return null;
  const site = me.find((b) => !b.built && (b.type === 'munitions' || b.type === 'silo'));
  if (site) return site.type; // keep the Foundry resting until the site has its materials
  const ready = S.time >= lvl.grace * 0.7 && (counts.outpost || 0) >= 2 && (kinds.warbot || 0) >= lvl.threshold && workers >= staffed + 4;
  if (!ready || S.time < (P.saveCooldown || 0)) { P.saveStart = 0; return null; }
  let want = null;
  if (!counts.munitions) want = 'munitions';
  else if (!counts.silo || (counts.silo < 2 && S.time > lvl.grace * 2.5)) want = 'silo';
  if (want) {
    P.saveStart = P.saveStart || S.time;
    if (S.time - P.saveStart > 180) { P.saveCooldown = S.time + 240; P.saveStart = 0; return null; }
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
    const route = roadRouteTo(p, b);
    if (!route) {
      if (!b.built && S.time - b.born > 60) {
        P.avoid = (P.avoid || []).concat([{ x: b.x, y: b.y, until: S.time + 240 }]);
        demolish(b);
      }
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
function aiAffordable(p, type) {
  const have = playerGoods(p);
  const cost = BDEFS[type].cost;
  for (const g in cost) if (have[g] < cost[g]) return false;
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

function aiSearchSpot(p, type, lander) {
  const def = BDEFS[type], P = S.players[p];
  const sums = type === 'outpost' ? [R_ORE, R_CRYSTAL, R_STALK, R_BOULDER, R_OIL].map(resourceSums) : null;
  const enemyL = getE(S.players[1 - p].lander);
  const ex = enemyL ? enemyL.x : S.W / 2, ey = enemyL ? enemyL.y : S.H / 2;
  const cands = [];
  // Every building needs a road to storage: skip spots no road can reach, and (except for
  // Outposts and Silos, which want to be far out) prefer spots close to the roads we have.
  const reach = roadReach(p), budget = roadTilesAffordable(p) + 10;
  const far = type === 'outpost' || type === 'silo';
  const avoid = (S.players[p].avoid || []).filter((a) => a.until > S.time);
  S.players[p].avoid = avoid;
  for (let j = 0; j < S.H; j++) {
    for (let i = 0; i < S.W; i++) {
      if (S.owner[j * S.W + i] !== p) continue;
      if (S.fert[j * S.W + i] && type !== 'farm') continue; // keep fertile soil for farming
      if (avoid.some((a) => dist2(a.x, a.y, i, j) < 12)) continue;
      if (!canPlace(p, type, i, j, true).ok) continue;
      let rc = Infinity;
      for (const u of roadSides(p, i, j)) rc = Math.min(rc, reach[u]);
      if (rc > budget) continue;
      const dHome = dist(i, j, lander.x, lander.y);
      const jitter = hash2(i, j, S.seed + p) * 0.8;
      let s;
      if (def.gather) {
        const n = reachableRes(i, j, def.radius, def.gather);
        if (n < 2) continue;
        s = Math.min(n, 10) * 2 - dHome * 0.35;
      } else if (def.plant) {
        let dh = 99;
        for (const b of S.buildings) if (!b.dead && b.owner === p && b.type === 'harvester') dh = Math.min(dh, dist(i, j, b.x, b.y));
        s = -dh - countResIn(i, j, def.radius, R_STALK) * 0.2;
      } else if (type === 'outpost') {
        const ore = Math.min(sums[0](i, j, 5), 8), cry = Math.min(sums[1](i, j, 5), 8);
        const rest = Math.min(sums[2](i, j, 5), 6) + Math.min(sums[3](i, j, 5), 6) + Math.min(sums[4](i, j, 5), 4) * 1.5;
        s = -dist(i, j, ex, ey) * 0.6 + dHome * 0.5 + ore * 1.6 + cry * 1.0 + rest * 0.3;
        // Head for whatever we're running out of.
        for (const r of P.short || []) s += Math.min(sums[[R_ORE, R_CRYSTAL, R_STALK, R_BOULDER].indexOf(r)](i, j, 5), 6) * 1.5;
      } else if (def.farm) {
        const n = fertileIn(i, j, def.radius);
        if (n < 3) continue;
        s = Math.min(n, 12) * 1.5 - dHome * 0.3;
      } else if (def.pump) {
        let oil = 0;
        for (let dj = -1; dj <= 1; dj++) for (let di = -1; di <= 1; di++) {
          if (inMap(i + di, j + dj) && S.res[tIdx(i + di, j + dj)] === R_OIL) oil += S.amt[tIdx(i + di, j + dj)];
        }
        s = oil * 0.2 - dHome * 0.3;
      } else if (type === 'refinery') {
        let dp = dHome;
        for (const b of S.buildings) if (!b.dead && b.owner === p && b.type === 'pump') dp = Math.min(dp, dist(i, j, b.x, b.y));
        s = -dp - dHome * 0.2;
      } else if (type === 'turret') {
        s = -Math.abs(dHome - 3.5) * 2 - dist(i, j, ex, ey) * 0.15;
      } else if (type === 'silo') {
        s = -dist(i, j, ex, ey); // as close to the enemy as our land allows
      } else if (type === 'depot') {
        // A forward base: out towards the Outposts, but on the road network.
        s = Math.min(dHome, 18) * 0.6 - dist(i, j, ex, ey) * 0.1;
      } else if (type === 'charger') {
        // Spread chargers out, near where bots work.
        let dc = 99, db = 99;
        for (const b of S.buildings) {
          if (b.dead || b.owner !== p) continue;
          const d = dist(i, j, b.x, b.y);
          if (BDEFS[b.type].charger) dc = Math.min(dc, d); else db = Math.min(db, d);
        }
        s = Math.min(dc, 12) - db * 0.8;
      } else {
        s = -dHome;
      }
      s -= Math.min(rc, 30) * (far ? 0.05 : 0.35);
      s += jitter;
      cands.push({ x: i, y: j, s });
    }
  }
  // Only the best few spots get the (costly) checks that a building won't block a pass and that
  // a road can reach it.
  cands.sort((a, b) => b.s - a.s);
  for (let k = 0; k < Math.min(cands.length, 12); k++) {
    if (!wouldBlock(tIdx(cands[k].x, cands[k].y))) return cands[k];
  }
  return null;
}

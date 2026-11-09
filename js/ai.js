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
  ['charger', 1], ['harvester', 1], ['quarry', 1], ['kiln', 1], ['harvester', 2], ['mine', 1], ['tap', 1], ['smelter', 1],
  ['fab', 1], ['foundry', 1], ['outpost', 1], ['armory', 1], ['farm', 1], ['quarry', 2], ['grower', 1], ['mine', 2],
  ['smelter', 2], ['kiln', 2],
  ['turret', 1], ['repair', 1], ['outpost', 2], ['tap', 2], ['pump', 1], ['refinery', 1], ['harvester', 3], ['outpost', 3],
  ['munitions', 1], ['silo', 1], ['depot', 1], ['charger', 2], ['farm', 2], ['mine', 3], ['outpost', 4], ['turret', 2],
  ['grower', 2], ['fab', 2], ['outpost', 5], ['armory', 2], ['quarry', 3], ['silo', 2], ['outpost', 6], ['charger', 3], ['pump', 2],
  ['tap', 3], ['farm', 3], ['outpost', 8], ['turret', 3],
];

/** Rival p's personality (see PERSONALITIES). */
function aiStyle(p) { return PERSONALITIES[S.players[p].style] || PERSONALITIES.balanced; }

/** Rival p's difficulty settings with its personality applied (later or earlier attacks, bigger or smaller). */
function aiLevel(p) {
  const base = DIFFICULTY[S.difficulty], st = aiStyle(p);
  return { ...base, grace: base.grace * (st.grace || 1), threshold: Math.max(3, Math.round(base.threshold * (st.threshold || 1))) };
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

function aiThink(p) {
  const P = S.players[p];
  const lvl = aiLevel(p), st = aiStyle(p);
  const me = playerBuildings(p);
  const lander = getE(P.lander);
  if (!lander || lander.owner !== p) return;

  // 1) Construction
  const counts = {};
  let sites = 0;
  for (const b of me) {
    counts[b.type] = (counts[b.type] || 0) + 1;
    if (!b.built && !BDEFS[b.type].prepaid) sites++;
  }
  const maxSites = p === 0 && P.ai ? 2 : lvl.maxSites;
  aiWalls(p);
  aiTurtleWalls(p);
  aiBridge(p, maxSites);
  // Warbots can't fight without Ammo: in a war, once the opening is done, an Ammo Plant comes
  // first, its site is never given up, and the Foundry rests so the Alloy reaches it.
  const needArmory = warOn() && S.time > 150 && !me.some((b) => b.type === 'armory' && b.built);
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
      if (b.built || b.dead || S.time - b.born < 120 || (needArmory && b.type === 'armory')) continue;
      if ((b.type === 'silo' || b.type === 'munitions') && S.time - b.born < 420) continue; // saved up for: give it time
      const cost = BDEFS[b.type].cost;
      let stuck = false;
      for (const g in cost) if ((b.stock[g] || 0) + (b.inc[g] || 0) < cost[g] && have[g] <= 0) stuck = true;
      if (stuck) { demolish(b); sites--; break; }
    }
  }
  let plan = S.mode === 'colony' ? AI_PLAN.concat([['outpost', 40]]) : AI_PLAN;
  // A Turtle wants twice the turrets (and its first one early); a Tycoon a bigger industry and a
  // second Silo straight after the first Ammo Plant.
  if (st.turrets) plan = plan.map(([t, n]) => (t === 'turret' ? [t, n * 2] : [t, n]));
  if (st.missiles) { const k = plan.findIndex(([t]) => t === 'armory') + 1; plan = plan.slice(0, k).concat([['smelter', 2], ['fab', 2], ['munitions', 1], ['silo', 2]], plan.slice(k)); }
  // Nuclear race: a Reactor once there's Uranium to enrich (or a mine on a deposit), then a Nuclear Silo.
  if (nukeOn()) {
    const k = plan.findIndex(([t]) => t === 'munitions');
    const nuke = [];
    if (goodTotal(p, 'uranium') > 0 || me.some((b) => b.type === 'mine' && reachableRes(b.x, b.y, BDEFS.mine.radius, R_URANIUM) > 0)) nuke.push(['reactor', 1]);
    if (counts.reactor && goodTotal(p, 'fissile') + goodTotal(p, 'uranium') / 2 >= 2) nuke.push(['nukesilo', 1]);
    plan = plan.slice(0, k).concat(nuke, plan.slice(k));
  }
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
  if (needArmory) plan = [['armory', 1]].concat(plan);
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
  // Defences come first once the colony is running: the first Pulse Turret, then a Repair Station.
  // In a Nuclear race the Reactor and Nuclear Silo get the same treatment: the race is the point.
  // A Turtle keeps adding turrets: one more every four minutes, up to six.
  const turretsWanted = st.turrets ? Math.min(6, 1 + Math.floor(Math.max(0, S.time - AI_DEFENCE_AT * 0.5) / 240)) : 1;
  const defence = (type) => S.mode !== 'colony' && (type === 'turret' ? (counts.turret || 0) < turretsWanted : !counts[type]) &&
    ((type === 'turret' && S.time > AI_DEFENCE_AT * (st.turrets ? 0.5 : 1)) || (type === 'repair' && counts.turret && S.time > AI_DEFENCE_AT + 120) ||
     (nukeOn() && (type === 'reactor' || type === 'nukesilo')));
  // Only Charging Stations charge robots: the first one comes before anything else.
  const key = (type) => (type === 'charger' && !counts.charger) || type === 'foundry' || type === 'harvester' || type === 'quarry' || (type === 'kiln' && (playerGoods(p).cement || 0) < 3) || defence(type) ||
    (type === 'outpost' && P.short.length > 0);
  if (sites < siteCap) {
    for (const [type, want0] of plan) {
      if (cementStarved && sites >= maxSites && type !== 'kiln') continue;
      if (S.mode === 'colony' && BDEFS[type].war) continue;
      // One more Charging Station for every three Outposts as the colony spreads out, and a Bio
      // Farm for every two stations to keep them in Fuel.
      const nCh = Math.max(1 + Math.floor((counts.outpost || 0) / 3), 0);
      // Only Charging Stations charge, so Fuel scales with the colony: a Bio Farm for every 18 robots.
      const nBots = S.bots.reduce((n, u) => n + (!u.dead && u.owner === p && u.type !== 'warbot' ? 1 : 0), 0);
      const want = type === 'charger' ? Math.max(want0, nCh) : type === 'farm' && counts.charger ? Math.max(want0, Math.ceil((counts.charger || 0) / 2), Math.ceil(nBots / 18)) : want0;
      if (type === 'refinery' && !counts.pump) continue;
      // Plenty of Fuel in stock: no need for more farms or oil yet.
      if ((type === 'farm' || type === 'pump' || type === 'refinery') && (counts[type] || 0) >= 1 && playerGoods(p).fuel > 10) continue;
      if ((counts[type] || 0) >= want) continue;
      if (saving && type !== saving && !BDEFS[type].nuke && (BDEFS[type].cost.alloy || BDEFS[type].cost.chip)) continue;
      // Keep enough Fiber for a Harvester while none is cutting: without Fiber there's no way back.
      if (type !== 'harvester' && fiberLow && (BDEFS[type].cost.fiber || 0) > 0 && playerGoods(p).fiber - BDEFS[type].cost.fiber < BDEFS.harvester.cost.fiber) continue;
      // The first of each staffed building is always allowed, so the production chain is complete.
      if (BDEFS[type].staff && !BDEFS[type].crew && !canStaffMore && counts[type]) continue;
      if (Object.keys(BDEFS[type].cost).some((g) => held.has(g))) continue;
      if (reserveCement && type !== 'outpost' && type !== 'quarry' && type !== 'kiln' && BDEFS[type].cost.cement) continue;
      if (type === 'kiln' && stoneLow && counts.kiln) continue;
      // A turret or Repair Station is started as soon as the Cement is there: new Alloy goes straight
      // into factories, so it never piles up in storage; the high-priority site gets it delivered.
      const defenceNow = defence(type) && counts.smelter && aiAffordable(p, type, ['alloy', 'chip']);
      if (!aiAffordable(p, type) && !defenceNow) {
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
        if (defenceNow || defence(type)) placed.building.prio = 'high';
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
    if (b.built && def.gather && S.time - b.born > 30 && gatherReach(b.x, b.y, b.type) === 0 && !(b.stock[RES[def.gather].good] > 1)) {
      demolish(b);
    } else if (b.built && def.pump && pumpSeep(b) < 0 && !(b.stock.crude > 0)) {
      demolish(b);
    }
  }

  // 3) Foundry: keep enough workers, then grow the army. Order specialists when a building needs
  //    one, and enough Haulers (a Freight Truck counts as three) to carry every good in the colony.
  const wantWorkers = staffed + 3 + Math.min(3, sites);
  // A Freight Truck takes the long runs off the Haulers, but sits idle much of the time: it counts as one and a half.
  const wantHaulers = clamp(Math.ceil(me.length * 0.35), 4, 16) - Math.floor(1.5 * (kinds.truck || 0));
  const army = kinds.warbot || 0;
  const wantArmy = S.mode === 'colony' ? 0 : aiWantArmy(lvl, p);
  const armyBehind = army < wantArmy - 2;

  const crewNeed = {};
  for (const b of me) {
    const crew = BDEFS[b.type].crew;
    if (crew && b.built) crewNeed[crew] = (crewNeed[crew] || 0) + 1;
  }
  for (const b of me) {
    if (b.type !== 'foundry' || !b.built) continue;
    // Workers first while buildings stand empty; then the army gets its share as the game goes on.
    b.mode = S.mode === 'colony' ? 'worker' : workers < staffed + MIN_FREE_WORKERS ? 'worker'
      : army < wantArmy ? (workers < wantWorkers ? 'alt' : 'warbot')
        : workers < wantWorkers ? 'worker' : workers > wantWorkers + 4 ? 'warbot' : 'alt';
    b.orders = b.orders || {};
    for (const crew in crewNeed) if ((kinds[crew] || 0) < crewNeed[crew] && !(b.orders[crew] > 0)) b.orders[crew] = 1;
    // Saving up for missiles (or feeding the Missile Factory): the Foundry rests so Alloy and Chips
    // pile up, unless workers are badly short.
    // (Not while the army is well behind: warbots come first.)
    // Saving for a bridge to the enemy's island too: until it's built the army can't reach anyone.
    const bridging = P.bridgeWant > 0 && S.time - P.bridgeWant < 30;
    // A Tycoon rests it for missiles even with a small army (as long as a few warbots stand guard).
    const forMissiles = (saving || P.feedMissiles) && (!armyBehind || (st.missiles && army >= wantArmy * 0.7));
    if ((forMissiles || needArmory || bridging) && workers >= staffed + 3) { b.mode = 'off'; delete b.orders.hauler; delete b.orders.truck; }
    // Haulers when short; while the army is well behind, only when badly short.
    else if ((kinds.hauler || 0) < (armyBehind ? Math.min(wantHaulers, 6) : wantHaulers) && !(b.orders.hauler > 0)) b.orders.hauler = 1;
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

  // 4) Missiles: soften turrets and Outposts first, the Command Base once the army is big. (With
  //    two rivals, the one it's up against is the nearest still in the game.)
  const enemy = rivalOf(p);
  const rival = (o) => o >= 0 && o !== p && !S.players[o].out && !S.players[o].absent;
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

  // 4a) Nuclear race: fire a ready nuclear missile where it destroys the most.
  if (nukeOn()) for (const silo of me) if (silo.type === 'nukesilo' && silo.armed && silo.built) aiFireNuke(p, silo);

  // 4b) Raids on the enemy's supply lines, and answering the enemy's raids on ours.
  if (S.mode !== 'colony') aiCounterRaid(p);
  if (S.mode !== 'colony' && S.time >= lvl.grace) aiRaid(p, lvl);

  // 5) Attack
  if (S.time < lvl.grace || S.time < P.nextAttack) return;
  let best = null, bestScore = -Infinity, bestAvail = 0;
  for (const b of S.buildings) {
    if (b.dead || !rival(b.owner)) continue; // whichever rival's building is in reach
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
  // A big army with nothing in reach marches on the nearest enemy garrison (a rally flag beside it:
  // the warbots fight what they meet and attack what stands there). With twice the enemy's army it
  // goes for the enemy Command Base itself.
  const enemyArmy = S.bots.reduce((n, u) => n + (!u.dead && u.owner === enemy && u.type === 'warbot' ? 1 : 0), 0);
  const crushing = army >= lvl.threshold * 2 && army >= enemyArmy * 2 + 2;
  if (army >= lvl.threshold * 2 && S.time - (P.lastMarch || -999) > 120 && !(P.march && rallyById(P.march))) {
    let tgt = null, bd = Infinity;
    const enemyBase = getE(S.players[enemy].lander);
    if (crushing && enemyBase && !enemyBase.dead && enemyBase.owner === enemy) tgt = enemyBase;
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
      // Against a rival with next to no army, a small band is enough to finish it.
      const avail = spot ? rallyAvailable(p, spot.i, spot.j, true) : 0;
      const need = crushing ? Math.max(4, enemyArmy * 2 + 2) : lvl.threshold * 2;
      if (spot && avail >= need) {
        const { sent, rally } = sendToRally(p, spot.i, spot.j, Math.min(crushing ? 22 : 14, crushing ? avail : avail - 2), true);
        if (sent) { P.march = rally.id; P.lastMarch = S.time; return; }
      }
    }
  }
  // Recall a march that has nothing left to fight.
  if (P.march && rallyById(P.march) && S.time - (P.lastMarch || 0) > 150) { recallRally(P.march); P.march = 0; }
  // A big army with nothing in reach: push a forward Outpost toward the enemy Command Base.
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
  if (S.zone[tIdx(E.x, E.y)] === home || S.time - (P.lastBridge || -999) < 12) return;
  P.lastBridge = S.time;
  // One of our bridges is going up already (one its workers can't get to for a long while is called off).
  P.bridgeSince = P.bridgeSince || {};
  let pending = false;
  for (const k in P.bridgeSince) {
    if (S.plan[k] !== p + 1) { delete P.bridgeSince[k]; continue; }
    if (S.time - P.bridgeSince[k] > 240) { cancelPlan(+k); delete P.bridgeSince[k]; } else pending = true;
  }
  if (pending) return;
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
        const s = steps[t] * 3 + dist(u % W, (u / W) | 0, E.x, E.y);
        if (s < bestS) { bestS = s; best = t; }
      } else if (steps[t] < 9 && sea(u) && steps[u] < 0) { steps[u] = steps[t] + 1; from[u] = t; q.push(u); }
    });
  }
  if (best >= 0) {
    const tiles = [];
    for (let t = best; t >= 0; t = from[t]) tiles.push(t);
    tiles.reverse(); // from the shore out
    const cost = {};
    for (const t of tiles) for (const g in CROSS[S.terrain[t]].cost) cost[g] = (cost[g] || 0) + CROSS[S.terrain[t]].cost[g];
    // Short of Cement or Alloy: the Foundry rests until the bridge is paid for (see aiThink).
    if (!canAffordRoad(p, cost)) { P.bridgeWant = S.time; return; }
    P.bridgeWant = 0;
    for (const t of tiles) { if (buildRoad(p, t % W, (t / W) | 0)) break; P.bridgeSince[t] = S.time; }
    return;
  }
  // No crossing from inside our border yet: an Outpost on the shore facing the nearest land toward the enemy.
  if (siteCount(p) >= maxSites || !aiAffordable(p, 'outpost')) return;
  if (S.buildings.some((b) => !b.dead && b.owner === p && b.type === 'outpost' && !b.built)) return;
  let tx = -1, ty = -1, td = Infinity;
  for (let t = 0; t < N; t++) {
    if (S.terrain[t] !== T_GROUND || S.zone[t] < 0 || S.zone[t] === home) continue;
    const i = t % W, j = (t / W) | 0, d = dist(i, j, L.x, L.y) + dist(i, j, E.x, E.y) * 0.6;
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

/**
 * Chokepoint maps (Normal and Hard): once our end of the pass is inside our border, wall it off,
 * with a Gate on our road through it (or in the middle), and put back any piece the enemy breaks.
 * Cement for the colony comes first.
 */
function aiWalls(p) {
  const cp = chokePass();
  if (!cp || !warOn() || (S.difficulty === 'easy' && !aiStyle(p).walls) || S.time < 240) return;
  const L = getE(S.players[p].lander);
  if (!L) return;
  const row = L.y > S.H / 2 ? cp.bot : cp.top;
  const tiles = [];
  for (let i = cp.p0; i <= cp.p1; i++) if (S.terrain[tIdx(i, row)] === T_GROUND) tiles.push(i);
  if (!tiles.length || tiles.some((i) => S.owner[tIdx(i, row)] !== p)) return;
  const at = (i) => getE(S.bAt[tIdx(i, row)]);
  let gate = tiles.find((i) => at(i) && at(i).type === 'gate');
  if (gate === undefined) gate = tiles.find((i) => S.road[tIdx(i, row)] || S.plan[tIdx(i, row)]);
  if (gate === undefined) gate = tiles[Math.floor(tiles.length / 2)];
  for (const i of tiles) {
    const t = tIdx(i, row);
    if (S.bAt[t]) continue;
    const kind = i === gate || S.road[t] || S.plan[t] ? 'gate' : 'wall';
    if (spendable(p).cement < BDEFS[kind].cost.cement + 10) return;
    if (canPlace(p, kind, i, row).ok) placeSite(p, kind, i, row);
  }
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
  // warbots to man them all and still march. Its personality sets how fast the army grows.
  let extra = 0;
  if (p !== undefined) for (const b of S.buildings) if (!b.dead && b.owner === p && b.built && BDEFS[b.type].mil) extra++;
  const st = p !== undefined ? aiStyle(p) : PERSONALITIES.balanced;
  const from = AI_ARMY_FROM * (st.armyFrom || 1), rate = lvl.mult * (st.army || 1);
  return Math.min(AI_ARMY_MAX + Math.max(0, extra - 8), START_WARBOTS + 1 + Math.floor((Math.max(0, S.time - from) / 60) * rate));
}

/**
 * Raids: every few minutes a small band of warbots goes to the enemy's busiest road clear of its
 * turrets and garrisons, shoots up passing haulers, tears up the road (then hits whatever stands
 * near it), and comes home.
 */
const RAID_GAP = { easy: 320, medium: 250, normal: 180, hard: 120 };
const RAID_TIME = 60;    // seconds a raid lasts before the raiders head home
const RAID_FIRST = 200;  // the first raid comes this long after the grace period
function aiRaid(p, lvl) {
  const P = S.players[p], enemy = rivalOf(p);
  if (P.raid) {
    const r = rallyById(P.raid.id);
    if (!r || S.time > P.raid.until || !rallyMembers(P.raid.id).length) {
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
  // Keep clear of turrets, and of garrisons with warbots in them.
  const guards = S.buildings.filter((b) => !b.dead && b.owner === enemy && b.built && (b.type === 'turret' || (BDEFS[b.type].mil && armedIn(b) >= 2)))
    .map((b) => ({ x: b.x, y: b.y, r2: b.type === 'turret' ? 36 : 56 })); // turret range, and beyond where a garrison sorties
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
  const size = st.raidSize || 3;
  if (rallyAvailable(p, i, j) < size + (st.raidKeep ?? 2)) return; // keep enough warbots at home (a Raider sends all it can spare)
  const { sent, rally } = sendToRally(p, i, j, size);
  if (sent) { rally.raid = true; P.raid = { id: rally.id, until: S.time + RAID_TIME }; }
}

/**
 * Answer raids: an enemy rally flag inside our land with warbots at it gets twice as many of ours
 * sent to the same spot (they fight whatever is there), called home once the raiders are gone.
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
    if (r.owner === p || P.counters.some((c) => c.enemy === r.id)) continue;
    const i = Math.floor(r.x), j = Math.floor(r.y);
    if (!inMap(i, j) || S.owner[tIdx(i, j)] !== p) continue;
    const raiders = rallyMembers(r.id).length;
    if (!raiders) continue;
    const { sent, rally } = sendToRally(p, i, j, raiders * 2);
    if (sent) P.counters.push({ enemy: r.id, mine: rally.id, at: S.time });
  }
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
  // A Silo site waiting for Alloy: the Missile Factory stops eating it until the Silo stands.
  for (const b of me) if (b.type === 'munitions' && b.built && !!b.paused !== (site && site.type === 'silo')) setPaused(b, !!(site && site.type === 'silo'));
  if (site) { site.prio = 'high'; return site.type; } // keep the Foundry resting (and goods coming here first) until the site has its materials
  // A Tycoon goes for missiles sooner, with fewer warbots at home, once its Bot Foundry runs. The
  // others start no sooner than a Balanced rival would (a Rusher spends on warbots instead).
  const base = DIFFICULTY[S.difficulty];
  const ready = (st.missiles
    ? S.time >= base.grace * 0.8 && me.some((b) => b.type === 'foundry' && b.built) && (kinds.warbot || 0) >= 3
    : S.time >= base.grace * 0.7 * Math.max(1, st.grace || 1) && (kinds.warbot || 0) >= Math.max(base.threshold, lvl.threshold)) &&
    (counts.outpost || 0) >= 2 && workers >= staffed + 4;
  if (!ready || S.time < (P.saveCooldown || 0)) { P.saveStart = 0; return null; }
  let want = null;
  if (!counts.munitions) want = 'munitions';
  else if (!counts.silo || (counts.silo < (st.missiles ? 3 : 2) && S.time > lvl.grace * (st.missiles ? 1.2 : 2.5))) want = 'silo';
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
/** Can player p pay for a `type` site now (ignoring the goods in `except`)? */
function aiAffordable(p, type, except) {
  const have = playerGoods(p);
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
  const sums = type === 'outpost' ? [R_ORE, R_CRYSTAL, R_STALK, R_BOULDER, R_OIL, R_URANIUM].map(resourceSums) : null;
  const enemyL = getE(S.players[rivalOf(p)].lander);
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
        const u = type === 'mine' && nukeOn() ? reachableRes(i, j, def.radius, R_URANIUM) : 0;
        if (n < 2 && !u) continue;
        s = Math.min(n, 10) * 2 - dHome * 0.35 + u * 12; // a mine on uranium beats any ore field
      } else if (def.plant) {
        let dh = 99;
        for (const b of S.buildings) if (!b.dead && b.owner === p && b.type === 'harvester') dh = Math.min(dh, dist(i, j, b.x, b.y));
        s = -dh - countResIn(i, j, def.radius, R_STALK) * 0.2;
      } else if (type === 'outpost') {
        const ore = Math.min(sums[0](i, j, 5), 8), cry = Math.min(sums[1](i, j, 5), 8);
        const rest = Math.min(sums[2](i, j, 5), 6) + Math.min(sums[3](i, j, 5), 6) + Math.min(sums[4](i, j, 5), 4) * 1.5;
        s = -dist(i, j, ex, ey) * 0.6 + dHome * 0.5 + ore * 1.6 + cry * 1.0 + rest * 0.3;
        if (nukeOn()) s += Math.min(sums[5](i, j, 6), 3) * 6; // the race for uranium
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

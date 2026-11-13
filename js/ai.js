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
  ['turret', 1], ['repair', 1], ['outpost', 2], ['tap', 2], ['pump', 1], ['refinery', 1], ['harvester', 3], ['outpost', 3], ['generator', 1],
  ['munitions', 1], ['silo', 1], ['depot', 1], ['charger', 2], ['farm', 2], ['mine', 3], ['outpost', 4], ['turret', 2], ['bunker', 1],
  ['grower', 2], ['fab', 2], ['outpost', 5], ['mortar', 1], ['disruptor', 1], ['armory', 2], ['quarry', 3], ['silo', 2], ['outpost', 6], ['bunker', 2], ['charger', 3], ['pump', 2],
  ['tap', 3], ['farm', 3], ['generator', 2], ['outpost', 8], ['turret', 3], ['mortar', 2], ['bunker', 3],
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
  // Ammo Plant running) for a single Strike Bomber (see aiBomber).
  if (S.mode !== 'colony' && !st.walls && S.time >= 1320 && !counts.airfield && !botBanned(p, 'bomber') && me.some((b) => b.type === 'armory' && b.built)) plan = [['airfield', 1]].concat(plan); // (only for a bomber)
  // Bulk trade: a Trade Terminal once the colony is running short of Ore, Crystal or Stone (a Tycoon from 14
  // minutes, the rest from 20), with a Road Train to serve it (see the Foundry, and aiTrade).
  const tradeAt = st.missiles ? 840 : 1200;
  if (S.mode !== 'colony' && S.time >= tradeAt && !counts.terminal && counts.foundry && S.time - (P.termFail ?? -999) > 240) {
    const sh = tradeShortest(p), g = sh.find((x) => x !== 'alloy'); // short of something in the ground
    if (sh.left[g] < (TRADE_LEFT[g] || 60) * 1.5 || st.missiles) plan = [['terminal', 1]].concat(plan); // only when short: it goes first
  }
  if (st.missiles) { const k = plan.findIndex(([t]) => t === 'armory') + 1; plan = plan.slice(0, k).concat([['smelter', 2], ['fab', 2], ['munitions', 1], ['silo', 2]], plan.slice(k)); }
  // Nuclear race: a Reactor once there's Uranium to enrich (or a mine on a deposit), then a Nuclear Silo.
  if (nukeOn()) {
    const k = plan.findIndex(([t]) => t === 'munitions');
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
  if (P.defWant && S.time < P.defWant.until && (counts[P.defWant.type] || 0) < P.defWant.n) plan = [[P.defWant.type, P.defWant.n]].concat(plan);
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
  const sitesWantFiber = me.some((b) => !b.built && (siteCost(b).fiber || 0) > (b.stock.fiber || 0) + (b.inc.fiber || 0));
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
  const defence = (type) => S.mode !== 'colony' && (type === 'turret' ? (counts.turret || 0) < turretsWanted : type === 'keep' ? (counts.keep || 0) < wantKeeps : !counts[type]) &&
    ((type === 'turret' && S.time > AI_DEFENCE_AT * (st.turrets ? 0.5 : 1)) || (type === 'repair' && counts.turret && S.time > AI_DEFENCE_AT + 120) ||
     (nukeOn() && (type === 'reactor' || type === 'nukesilo')) || (type === 'flak' && enemyAir && (counts.flak || 0) < 2) ||
     (type === 'keep' && wantKeeps > 0));
  // Only Fuel Stations charge robots: the first one comes before anything else.
  // Flak once a rival has aircraft: two Flak Guns by the Command Base (and Ammo to feed them).
  const enemyAir = S.bots.some((u) => !u.dead && u.owner !== p && BOTS[u.type].air) ||
    S.buildings.some((b) => !b.dead && b.built && b.owner >= 0 && b.owner !== p && BDEFS[b.type].airfield);
  if (enemyAir && S.mode !== 'colony' && (counts.flak || 0) < 2 && !plan.some(([t]) => t === 'flak')) plan = [['flak', 2]].concat(plan); // (a copy: AI_PLAN is shared)
  // The first Flak Gun doesn't wait for a free site (nothing else goes past the usual limit for it).
  const flakFirst = enemyAir && S.mode !== 'colony' && !counts.flak, capBefore = Math.max(siteCap, maxSites + 1);
  if (flakFirst) siteCap = Math.max(capBefore, sites + 1);
  const key = (type) => (type === 'charger' && !counts.charger) || type === 'foundry' || type === 'harvester' || type === 'quarry' || (type === 'kiln' && (playerGoods(p).cement || 0) < 3) || defence(type) ||
    (P.defWant && P.defWant.type === type && S.time < P.defWant.until) ||
    (type === 'outpost' && P.short.length > 0);
  if (sites < siteCap) {
    for (const [type, want0] of plan) {
      if (cementStarved && sites >= maxSites && type !== 'kiln') continue;
      if (flakFirst && sites >= capBefore && type !== 'flak') continue;
      if (S.mode === 'colony' && BDEFS[type].war) continue;
      // One more Fuel Station for every four Outposts as the colony spreads out, and a Bio
      // Farm for every two stations to keep them in Fuel.
      const nCh = 1 + Math.floor((counts.outpost || 0) / 4);
      // Only Fuel Stations charge, so Fuel scales with the colony: a Bio Farm for every 18 robots.
      const nBots = S.bots.reduce((n, u) => n + (!u.dead && u.owner === p && u.type !== 'warbot' ? 1 : 0), 0);
      const want = type === 'charger' ? Math.max(want0, nCh) : type === 'farm' && counts.charger ? Math.max(want0, Math.ceil((counts.charger || 0) / 2), Math.ceil(nBots / 18)) : want0;
      if (type === 'refinery' && !counts.pump) continue;
      // A Generator only once there's Fuel to spare for it (and a refinery or farm to keep it coming).
      if (type === 'generator' && ((playerGoods(p).fuel || 0) < 15 || !(counts.refinery || (counts.farm || 0) >= 2))) continue;
      // Plenty of Fuel in stock: no need for more farms or oil yet.
      if ((type === 'farm' || type === 'pump' || type === 'refinery') && (counts[type] || 0) >= 1 && playerGoods(p).fuel > 10) continue;
      if ((counts[type] || 0) >= want) continue;
      if (saving && type !== saving && type !== 'keep' && type !== 'terminal' && type !== 'airfield' && !(type === 'flak' && flakFirst) && !BDEFS[type].nuke && (BDEFS[type].cost.alloy || BDEFS[type].cost.chip)) continue;
      // Keep enough Fiber for a Harvester while none is cutting: without Fiber there's no way back.
      if (type !== 'harvester' && fiberLow && (BDEFS[type].cost.fiber || 0) > 0 && playerGoods(p).fiber - BDEFS[type].cost.fiber < BDEFS.harvester.cost.fiber) continue;
      // The first of each staffed building is always allowed, so the production chain is complete.
      if (BDEFS[type].staff && !BDEFS[type].crew && !canStaffMore && counts[type]) continue;
      if (Object.keys(BDEFS[type].cost).some((g) => held.has(g))) continue;
      if (reserveCement && type !== 'outpost' && type !== 'quarry' && type !== 'kiln' && BDEFS[type].cost.cement) continue;
      if (type === 'kiln' && stoneLow && counts.kiln) continue;
      // A turret or Repair Station is started as soon as the Cement is there: new Alloy goes straight
      // into factories, so it never piles up in storage; the high-priority site gets it delivered.
      const defenceNow = (defence(type) && counts.smelter && aiAffordable(p, type, ['alloy', 'chip'])) || ((type === 'terminal' || type === 'airfield') && aiAffordable(p, type, ['alloy']));
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
  for (const b of me) {
    const cap = AI_CAPS[b.type];
    if (!cap || !b.built) continue;
    if (forBridge && (b.type === 'armory' || b.type === 'fab')) { if (!b.paused) setPaused(b, true); continue; }
    const hi = cap[1] * (missiles && b.type === 'fab' ? 2 : 1), lo = cap[2];
    const have = stockNow[cap[0]] || 0;
    if (!b.paused && have >= hi) setPaused(b, true);
    else if (b.paused && have < lo) setPaused(b, false);
  }

  // Fuel first: a Grove Planter gives up its Agribot while a Bio Farm has none (and takes one back
  // once every farm has its own).
  const farmWaits = me.some((b) => b.built && b.type === 'farm' && !b.paused && !b.staff && !b.staffInc);
  const farms = me.filter((b) => b.built && b.type === 'farm').length;
  for (const b of me) {
    if (b.type !== 'grower' || !b.built) continue;
    if (farmWaits && !b.paused && (b.staff || b.staffInc)) setPaused(b, true);
    else if (b.paused && !farmWaits && (kinds.agribot || 0) > farms) setPaused(b, false);
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
    for (const b of me) {
      if (!b.built || !BDEFS[b.type].pump || pumpDry(b)) continue;
      const r = pipeToRefinery(p, b);
      if (r.why || r.tiles.length > 40) continue;
      if ((have.cement || 0) < 6 + (r.cost.cement || 0) || (have.alloy || 0) < (r.cost.alloy || 0)) continue;
      pipeUp(p, r.tiles);
      break;
    }
  }

  // 3) Foundry: keep enough workers, then grow the army. Order specialists when a building needs
  //    one, and enough Haulers (a Freight Truck counts as one and a half) to carry every good in the colony.
  const wantWorkers = staffed + 3 + Math.min(3, sites);
  // A Freight Truck takes the long runs off the Haulers, but sits idle much of the time: it counts as one and a half.
  const wantHaulers = clamp(Math.ceil(me.length * 0.35), 4, 16) - Math.floor(1.5 * (kinds.truck || 0));
  // Tankers carry every drop of Crude and Fuel: one, and another for every five buildings that make or burn them.
  const liquidBlds = me.filter((b) => b.built && (BDEFS[b.type].charger || BDEFS[b.type].pump || BDEFS[b.type].burner ||
    ['refinery', 'farm', 'munitions', 'tarworks', 'disruptor'].includes(b.type))).length;
  const wantTankers = Math.min(4, 1 + Math.floor(liquidBlds / 5));
  const army = kinds.warbot || 0;
  // (An enemy gun covering our buildings: at least enough warbots to knock it out, see aiClearGuns.)
  const wantArmy = S.mode === 'colony' || botBanned(p, 'warbot') ? 0 : Math.max(aiWantArmy(lvl, p), P.gunWant || 0); // (barred from making warbots: no army to build)
  const armyBehind = army < wantArmy - 2;
  let unarmed = 0;
  // (Warbots stranded across the water, say landed on an enemy shore, can't get home to rearm: they don't count.)
  const hzA = homeZone(p);
  for (const u of S.bots) if (!u.dead && u.owner === p && u.type === 'warbot' && (u.ammo ?? WARBOT_AMMO) <= 0 && (u.inside || S.zone[tIdx(Math.floor(u.x), Math.floor(u.y))] === hzA)) unarmed++;

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
    // A Tycoon rests it for missiles even with a small army (as long as a few warbots stand guard).
    const forMissiles = (saving || P.feedMissiles) && (!armyBehind || (st.missiles && army >= wantArmy * 0.7));
    // (Saving for a crossing with a fair army already: the Foundry rests even if workers are short.)
    if (((forMissiles || needArmory || bridging) && workers >= staffed + 3) || (bridging && P.bridgeNeed && army >= Math.min(wantArmy, 8))) { b.mode = 'off'; delete b.orders.hauler; delete b.orders.truck; }
    // Haulers when short; while the army is well behind, only when badly short.
    else if ((kinds.hauler || 0) < (armyBehind ? Math.min(wantHaulers, 6) : wantHaulers) && !(b.orders.hauler > 0)) b.orders.hauler = 1;
    else if ((kinds.tanker || 0) < wantTankers && !(b.orders.tanker > 0)) b.orders.tanker = 1;
    // A forward Depot with supply orders gets a Freight Truck to keep it stocked.
    else if (me.some((d) => d.keep && d.built && !BDEFS[d.type].terminal) && (kinds.truck || 0) < 1 + Math.floor(me.length / 35) && !(b.orders.truck > 0)) b.orders.truck = 1;
    // Howitzers for siege once the army is up: one, and one more for every ten warbots (at most three).
    const wantRockets = S.mode === 'colony' ? 0 : Math.max(P.gunTarget ? 1 : 0, S.time < lvl.grace ? 0 : Math.min(3, Math.floor(army / 10) + (army >= lvl.threshold ? 1 : 0)));
    if ((kinds.rocket || 0) < wantRockets && !(b.orders.rocket > 0) && !armyBehind && !botBanned(p, 'rocket') && me.some((a) => a.type === 'armory' && a.built)) b.orders.rocket = 1;
    // A Trade Terminal is served only by Road Trains: one for it.
    if (me.some((t) => BDEFS[t.type].terminal) && !(kinds.roadtrain > 0) && !(b.orders.roadtrain > 0)) b.orders.roadtrain = 1;
    break;
  }
  // Depots out towards the front keep Cement for building there.
  for (const d of me) {
    if (d.type !== 'depot' || !d.built || d.keep || dist(d.x, d.y, lander.x, lander.y) < 12) continue;
    setKeep(d, 'cement', 12);
    if (S.mode !== 'colony') setKeep(d, 'ammo', 4);
  }

  // 3b) An enemy gun covering our buildings: our robots keep clear of them, so the work there has stopped.
  //     Knock it out (missile, Howitzer, bomber, warbots) so they can get back to work.
  if (S.mode !== 'colony') aiClearGuns(p, lvl);

  // 4) Missiles: soften turrets and Outposts first, the Command Base once the army is big. (With
  //    two rivals, the one it's up against is the nearest still in the game.)
  const enemy = rivalOf(p);
  const rival = (o) => o >= 0 && o !== p && !S.players[o].out && !S.players[o].absent;
  if (S.mode !== 'colony' && S.time >= lvl.grace) {
    // Damage already on its way: never two missiles for a target one wrecks, nor a Command Base or Keep a
    // missile can knock no lower (see captureOnly).
    const dmg = BDEFS.silo.missile.damage, coming = new Map();
    for (const m of S.missiles) if (m.owner === p && m.target && !m.nuke) coming.set(m.target, (coming.get(m.target) || 0) + dmg);
    for (const silo of me) {
      if (!siloReady(silo)) continue;
      let best = null, bs = -Infinity;
      for (const e of S.buildings) {
        if (e.dead || e.owner !== enemy || !e.built) continue;
        const d = dist(silo.x, silo.y, e.x, e.y);
        if (d > BDEFS.silo.missile.range) continue;
        const left = e.armor - (coming.get(e.id) || 0);
        if (captureOnly(e) ? left <= missileFloor(e) + 2 : left <= 0) continue;
        const s = (e.type === 'turret' ? 10 : e.type === 'nukesilo' ? 12 : e.type === 'silo' || e.type === 'reactor' ? 9 : e.type === 'outpost' ? 8 :
          e.type === 'mortar' || e.type === 'disruptor' || e.type === 'bunker' || e.type === 'keep' ? 7 : e.type === 'lander' ? 5 : 3) - d * 0.1;
        if (s > bs) { bs = s; best = e; }
      }
      if (best && fireMissile(p, best)) coming.set(best.id, (coming.get(best.id) || 0) + dmg);
    }
  }

  // 4a) Nuclear race: fire a ready nuclear missile where it destroys the most, and clear out of the
  //     blast ring of any heading this way.
  if (nukeOn()) for (const silo of me) if (silo.type === 'nukesilo' && silo.armed && silo.built) aiFireNuke(p, silo);
  if (S.missiles.some((m) => m.nuke) && nukesThreatening(p).some((m) => !evacuating(p, m))) startEvac(p);

  // 4c) Naval maps: a Port, a Ferry, and beach landings on the enemy's shore.
  if (S.mode !== 'colony' && navalMap()) aiNaval(p, me, kinds, lvl, lander, sites < maxSites);

  // 4e) Howitzers: shell the defences round what we're attacking, and hunt down the enemy's.
  if (S.mode !== 'colony') aiSiege(p);
  // 4f) Bulk trade: pick a contract at the Trade Terminal.
  aiTrade(p, me);
  // 4g) A Strike Bomber now and then.
  if (S.mode !== 'colony') aiBomber(p, me);

  // 4b) Raids on the enemy's supply lines, and answering the enemy's raids on ours.
  if (S.mode !== 'colony') aiCounterRaid(p);
  if (S.mode !== 'colony' && S.time >= lvl.grace) aiRaid(p, lvl);

  // 5) Attack
  if (S.time < lvl.grace || S.time < P.nextAttack) return;
  let best = null, bestScore = -Infinity, bestAvail = 0;
  for (const b of S.buildings) {
    if (b.dead || !rival(b.owner)) continue; // whichever rival's building is in reach
    const avail = attackAvailable(p, b);
    if (avail < 2) continue;
    // Enough for the garrison, the turrets covering it and any warbots standing guard nearby; a fort
    // already shot down to a quarter of its armor needs only the usual band.
    const weak = b.built && BDEFS[b.type].mil && b.armor <= BDEFS[b.type].armor * SORTIE_ARMOR;
    const base = !b.built ? 2 : weak ? lvl.threshold : Math.max(lvl.threshold, Math.ceil(b.garrison.length * 1.3) + 2);
    if (avail < base || (b.built && !weak && avail < Math.ceil(b.garrison.length * 1.3) + 2 + guardsNear(b))) continue;
    const def = BDEFS[b.type];
    let score = (def.mil ? 12 : 0) + (b.type === 'lander' ? 25 : 0) - dist(b.x, b.y, lander.x, lander.y) * 0.4 - b.garrison.length * 2;
    if (!b.built) score -= 8;
    if (score > bestScore) { bestScore = score; best = b; bestAvail = avail; }
  }
  if (best) {
    sendAttack(p, best, bestAvail);
    P.siegeAt = { x: best.x, y: best.y, until: S.time + 120 };
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
      const o = S.owner[j * S.W + i];
      if (o !== p && !(o < 0 && inReach(p, j * S.W + i))) continue; // our land, or no-one's within reach
      const d = dist(i, j, enemyL.x, enemyL.y);
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
    if (S.buildings.some((b) => !b.dead && b.owner !== p && b.owner >= 0 && dist2(b.x + 0.5, b.y + 0.5, r.x, r.y) < 16)) continue;
    const z = S.zone[tIdx(Math.floor(r.x), Math.floor(r.y))];
    let tgt = null, bd = Infinity;
    for (const b of S.buildings) {
      if (b.dead || b.owner === p || b.owner < 0 || BDEFS[b.type].wild || S.zone[tIdx(b.x, b.y)] !== z) continue;
      const d = dist(b.x, b.y, r.x, r.y) - (b.type === 'lander' ? 8 : 0);
      if (d < bd) { bd = d; tgt = b; }
    }
    if (tgt) for (const u of rallyMembers(r.id)) if (!(u.task && u.task.type === 'attack' && u.task.target === tgt.id)) { u.task = { type: 'attack', target: tgt.id }; u.path = null; }
  }
  // Armed warbots of ours left idle across the water (landed, with no garrison of ours there to go to)
  // go after the nearest enemy building on their island.
  const hz = homeZone(p);
  for (const u of S.bots) {
    if (u.dead || u.owner !== p || u.type !== 'warbot' || u.inside || u.ferryWait || (u.ammo ?? WARBOT_AMMO) <= 0) continue;
    if (u.task && u.task.type !== 'garrison') continue;
    const z = S.zone[tIdx(Math.floor(u.x), Math.floor(u.y))], gb = u.task && getE(u.task.bld);
    if (z === hz || (gb && S.zone[tIdx(gb.x, gb.y)] === z)) continue;
    let tgt = null, bd = Infinity;
    for (const b of S.buildings) {
      if (b.dead || b.owner === p || b.owner < 0 || BDEFS[b.type].wild || S.zone[tIdx(b.x, b.y)] !== z) continue;
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
  const army = kinds.warbot || 0;
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
  let foes = S.buildings.filter((b) => !b.dead && b.owner >= 0 && b.owner !== p && !BDEFS[b.type].wild && S.players[b.owner] && !S.players[b.owner].out);
  if (!foes.length) return;
  // A rival with next to no army left (the weakest, in a free-for-all): land right by its Command Base to finish it.
  let weak = -1, wa = 4;
  for (let o = 0; o < S.players.length; o++) {
    const eL = getE(S.players[o].lander);
    if (o === p || S.players[o].out || !eL || eL.dead || eL.owner !== o) continue;
    const n = S.bots.reduce((k, u) => k + (!u.dead && u.owner === o && u.type === 'warbot' ? 1 : 0), 0);
    if (n < wa) { wa = n; weak = o; }
  }
  if (weak >= 0) foes = [getE(S.players[weak].lander)];
  const guard = (i, j) => foes.reduce((n, b) => n + (dist2(b.x, b.y, i, j) <= 36 ? (BDEFS[b.type].range ? 3 : 0) + (b.garrison ? b.garrison.length : 0) : 0), 0);
  let best = null, bs = Infinity;
  for (let j = 1; j < S.H - 1; j++) for (let i = 1; i < S.W - 1; i++) {
    const t = j * S.W + i, o = S.owner[t];
    if (o === p || S.terrain[t] !== T_GROUND || S.bAt[t]) continue;
    let near = Infinity;
    for (const b of foes) { const d = dist2(b.x, b.y, i, j); if (d < near) near = d; }
    if (near > 49 || landingBlocked(p, ferry, i, j)) continue;
    const sc = Math.sqrt(near) + guard(i, j) * 2;
    if (sc < bs) { bs = sc; best = { i, j }; }
  }
  if (!best) { P.lastLanding = S.time - 100; return; }
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
      const sc = dist(i, j, E.x, E.y);
      if (sc < bs && canPlace(p, 'outpost', i, j, true).ok && !wouldBlock(tIdx(i, j))) { bs = sc; best = [i, j]; }
    }
    if (best) { placeSite(p, 'outpost', best[0], best[1]); return; }
  }
  // No water to bridge (Sky islands): a Viaduct from our clifftop across the canyon, onto a clifftop
  // our border already reaches if there is one (so we can build there), else onto no-one's land.
  const via = aiViaductSpot(p, home, E);
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
 * The best Viaduct for player p to put up toward enemy base E: from a clifftop tile of ours (in
 * our border, where our bots go) straight across lower ground to a clifftop in another area, as
 * close to the enemy as possible, and short. Far ends inside our border come first. {a, b, owned} or null.
 */
function aiViaductSpot(p, home, E) {
  const W = S.W, N = W * S.H;
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
        if (S.terrain[b] !== T_GROUND || S.zone[b] === home || S.zone[b] < 0 || Math.abs(S.elev[b] - S.elev[a]) > VIA_RISE) continue;
        if (viaductBlocked(p, ai, aj, bi, bj)) continue;
        if (dist(bi, bj, E.x, E.y) > dist(ai, aj, E.x, E.y) - 2) break; // only spans that bring us closer
        const owned = S.owner[b] === p;
        const sc = dist(bi, bj, E.x, E.y) + k * 0.8 - (owned ? 20 : 0);
        if (sc < bs && canPlace(p, 'viaduct', ai, aj, true).ok) { bs = sc; best = { a, b, owned }; }
        break; // the first clifftop across is the one
      }
    }
  }
  return best;
}

/**
 * Chokepoint maps (Normal and Hard): once the mouth of a channel through the crags on our side is
 * inside our border, wall it off, with a Gate on our road through it (or in the middle), and put back
 * any piece the enemy breaks.
 * Cement for the colony comes first.
 */
function aiWalls(p) {
  const cp = chokePass();
  if (!cp || !warOn() || (S.difficulty === 'easy' && !aiStyle(p).walls) || S.time < 240) return;
  const L = getE(S.players[p].lander);
  if (!L) return;
  const bottom = L.y > S.H / 2;
  // Each channel's mouth on our side of the crags, once it's inside our border.
  for (const mouth of cp.mouths) {
    const tiles = mouth.filter((t) => (((t / S.W) | 0) > S.H / 2) === bottom && S.terrain[t] === T_GROUND);
    if (!tiles.length || tiles.some((t) => S.owner[t] !== p)) continue;
    const at = (t) => getE(S.bAt[t]);
    let gate = tiles.find((t) => at(t) && at(t).type === 'gate');
    if (gate === undefined) gate = tiles.find((t) => S.road[t] || S.plan[t]);
    if (gate === undefined) gate = tiles[Math.floor(tiles.length / 2)];
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
  // ...and never stops short of the rival's army: it keeps up with it, and a few more.
  let rivalArmy = 0;
  if (p !== undefined) { const e = rivalOf(p); for (const u of S.bots) if (!u.dead && u.owner === e && u.type === 'warbot') rivalArmy++; }
  const cap = Math.max(AI_ARMY_MAX, rivalArmy + 6) + Math.max(0, extra - 8);
  return Math.min(cap, START_WARBOTS + 1 + Math.floor((Math.max(0, S.time - from) / 60) * rate));
}

/**
 * What stands guard round building b besides its garrison: 3 for each of its owner's turrets within 6
 * tiles, plus its owner's warbots out in the field within 7 (on a rally flag, say).
 */
function guardsNear(b) {
  let n = 0;
  for (const e of S.buildings) {
    if (e.dead || e.owner !== b.owner || !e.built || e === b) continue;
    const d2 = dist2(e.x, e.y, b.x, b.y);
    if (e.type === 'turret' && d2 <= 36) n += 3;
    else if (e.type === 'bunker' && d2 <= 25) n += e.garrison.length * 2;
    else if (e.type === 'disruptor' && d2 <= 25) n += 2;
    else if (e.type === 'mortar' && d2 <= 100) n += 2;
    else if (e.type === 'keep' && d2 <= 36) n += 3 + e.garrison.length;
  }
  for (const u of S.bots) if (!u.dead && !u.inside && u.owner === b.owner && u.type === 'warbot' && dist2(u.x, u.y, b.x + 0.5, b.y + 0.5) <= 49) n++;
  return n;
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
    if (!S.road[t] || wayOwner(t) !== enemy || HEAT.flow[t] < 1) continue;
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
 * Howitzers (Versus). Loaded ones not already busy go after the enemy defences round the building we last
 * attacked (or, with no attack on, the nearest enemy defence or fort within 24 tiles): turrets, Bunkers, the
 * Keep, Mortars and Disruptors first. And an enemy Howitzer shelling our buildings gets warbots sent after
 * it (they fight whatever is at the flag; a truck can't fight back).
 */
/**
 * The Trade Terminal's contract: the one that brings what we're shortest of, paid with a good we have a lot
 * to spare of (a lot and TRADE_KEEP besides). None if nothing's worth it.
 */
function aiTrade(p, me) {
  if (!me.some((b) => BDEFS[b.type].terminal && b.built)) return;
  const T = tradeState(p);
  if (!T.offers.length || (T.pick >= 0 && T.offers[T.pick] && T.offers[T.pick].left > 0)) return;
  const have = spendable(p), short = tradeShortest(p);
  let best = -1, bs = -Infinity;
  T.offers.forEach((o, k) => {
    const spare = (have[o.give] || 0) - TRADE_KEEP[o.give] - o.lot;
    if (o.left <= 0 || spare < 0) return;
    const sc = (short.length - short.indexOf(o.get)) * 10 + Math.min(spare, 60) * 0.1;
    if (sc > bs) { bs = sc; best = k; }
  });
  if (best >= 0) pickContract(p, best);
}

/** What a bomb is worth dropping on, for the AI: its most valuable buildings, and a loaded Tanker. */
const AI_BOMB_VALUE = { nukesilo: 14, silo: 12, munitions: 10, reactor: 9, keep: 7, refinery: 7, foundry: 6, armory: 6, airfield: 6, fab: 5, generator: 4, smelter: 4, terminal: 4 };

/**
 * The AI's Strike Bomber: one, built at its Airfield's hangar, and a sortie at most every AI_BOMB_GAP s, at the
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
  const flak = S.buildings.filter((b) => !b.dead && b.built && b.owner !== p && BDEFS[b.type].flak);
  const covered = (x, y) => flak.some((f) => dist2(f.x + 0.5, f.y + 0.5, x, y) <= 49);
  // An enemy gun keeping our robots off our own buildings: bomb it first.
  if (gun && !gun.dead && gun.owner !== p && !covered(gun.x + 0.5, gun.y + 0.5) && !strikeBlocked(p, u, gun) && !orderStrike(p, u, gun)) { P.lastStrike = S.time; return; }
  let best = null, bs = 0;
  for (const b of S.buildings) {
    const v = AI_BOMB_VALUE[b.type];
    if (!v || b.dead || !b.built || b.owner === p || b.owner < 0 || covered(b.x + 0.5, b.y + 0.5) || strikeBlocked(p, u, b)) continue;
    const sc = v - dist(b.x, b.y, field.x, field.y) * 0.05;
    if (sc > bs) { bs = sc; best = b; }
  }
  for (const v of S.bots) {
    if (v.dead || v.owner === p || v.type !== 'tanker' || !v.carry || v.inside || covered(v.x, v.y) || strikeBlocked(p, u, v)) continue;
    const sc = 8 - dist(v.x, v.y, field.x, field.y) * 0.05;
    if (sc > bs) { bs = sc; best = v; }
  }
  if (best && !orderStrike(p, u, best)) P.lastStrike = S.time;
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

/** Warbots it takes to knock out gun b: its guards, its garrison, and a margin. */
function aiGunNeed(b) {
  return Math.ceil((b.garrison ? b.garrison.length : 0) * 1.3) + guardsNear(b) + (b.type === 'turret' || BDEFS[b.type].keep ? 3 : 2) + 1;
}

/**
 * Clear the worst enemy gun covering our buildings: a missile if a Silo can reach it, Howitzers (they
 * outrange a Pulse Turret), a Strike Bomber, and a band of warbots big enough to win. Until the army can
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
  if (P.gunTarget !== t.id) { P.gunTarget = t.id; P.gunSince = S.time; }
  // A missile, if a Silo is in range and none is on its way already.
  if (!S.missiles.some((m) => m.owner === p && m.target === t.id) && silosInRange(p, t).some(siloReady)) fireMissile(p, t);
  // Howitzers free to shell it (aiSiege also puts it first).
  const z = S.zone[tIdx(t.x, t.y)];
  for (const u of S.bots) {
    if (u.dead || u.owner !== p || !BOTS[u.type].siege || u.salvo || (u.task && !u.task.auto) || !(u.rockets ?? ROCKET.mag)) continue;
    if (S.zone[tIdx(Math.floor(u.x), Math.floor(u.y))] !== z || !rocketTarget(u, t)) continue;
    orderBombard(p, [u.id], t);
  }
  // Warbots: enough to win, from the garrisons in reach. Already on their way: wait for them.
  const need = aiGunNeed(t);
  P.gunWant = need + 2; // (each garrison keeps one at home)
  const going = S.bots.filter((u) => !u.dead && u.owner === p && u.type === 'warbot' && u.task && u.task.type === 'attack' && u.task.target === t.id).length;
  P.gunNeed = Math.max(0, need - going);
  if (going >= need || S.time < (P.gunAttackAt || 0)) return;
  const avail = attackAvailable(p, t);
  if (avail + going >= need) {
    const sent = sendAttack(p, t, Math.min(avail, need - going + 2));
    if (sent) { P.gunAttackAt = S.time + 20; P.lastAttack = S.time; P.siegeAt = { x: t.x, y: t.y, until: S.time + 90 }; }
    return;
  }
  // No garrison near enough to attack from: a rally flag beside the gun (they fight what they meet there
  // and attack what stands there), called home once the gun is gone.
  if (P.gunRally && rallyById(P.gunRally)) return;
  let spot = null;
  for (const [di, dj] of [[1, 1], [-1, 1], [1, -1], [-1, -1], [2, 0], [-2, 0], [0, 2], [0, -2], [2, 2], [-2, -2]]) {
    const i = t.x + di, j = t.y + dj;
    if (inMap(i, j) && walkable(tIdx(i, j)) && !S.bAt[tIdx(i, j)] && S.zone[tIdx(i, j)] === homeZone(p)) { spot = { i, j }; break; }
  }
  if (spot && rallyAvailable(p, spot.i, spot.j, true) + going >= need) {
    const { sent, rally } = sendToRally(p, spot.i, spot.j, need - going + 2, true);
    if (sent) { P.gunRally = rally.id; P.gunAttackAt = S.time + 20; P.lastAttack = S.time; }
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
    if (e.dead || e.owner === p || e.owner < 0 || !BOTS[e.type].siege || e.inside) continue;
    const tid = e.salvo ? e.salvo.target : e.task && e.task.type === 'bombard' ? e.task.target : 0, tgt = tid ? getE(tid) : null;
    const shelling = P.shelledBy && S.time - (P.shelledBy[e.id] || -999) < 40;
    if (!shelling && !(tgt && tgt.owner === p && (e.deployT > 0 || dist(e.x, e.y, tgt.x, tgt.y) < ROCKET.range + 4))) continue;
    const i = Math.floor(e.x), j = Math.floor(e.y);
    if (!inMap(i, j) || !walkable(tIdx(i, j))) continue;
    const escort = S.bots.filter((v) => !v.dead && !v.inside && v.owner === e.owner && v.type === 'warbot' && dist2(v.x, v.y, e.x, e.y) <= 20).length;
    const want = Math.min(14, 4 + Math.ceil(escort * 1.5));
    const h = P.truckHunt.find((x) => x.truck === e.id);
    if (!h) {
      const { sent, rally } = sendToRally(p, i, j, want, true);
      if (sent) P.truckHunt.push({ truck: e.id, rally: rally.id, until: S.time + 150, at: S.time });
      continue;
    }
    const r = rallyById(h.rally);
    if (!r) continue;
    if (dist2(r.x, r.y, e.x, e.y) > 4) { r.x = i + 0.5; r.y = j + 0.5; } // it moved: so does the flag
    const have = rallyMembers(h.rally).length;
    if (have < want && S.time - (h.at || 0) > 15) { h.at = S.time; sendToRally(p, Math.floor(r.x), Math.floor(r.y), want - have, true); }
  }
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
  const defence = DEFENCE_TYPES.has(type);
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
      if (gunCovers(p, j * S.W + i)) continue; // not where an enemy gun reaches: nobody could build it
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
        s = -dh - countResIn(i, j, def.radius, R_STALK) * 0.2;
      } else if (type === 'outpost') {
        const ore = Math.min(sums[0](i, j, 5), 8), cry = Math.min(sums[1](i, j, 5), 8);
        const rest = Math.min(sums[2](i, j, 5), 6) + Math.min(sums[3](i, j, 5), 6) + Math.min(sums[4](i, j, 5), 4) * 1.5;
        s = -dist(i, j, ex, ey) * 0.6 + dHome * 0.5 + ore * 1.6 + cry * 1.0 + rest * 0.3;
        if (nukeOn()) s += Math.min(sums[5](i, j, 6), 3) * 6; // the race for uranium
        // Crossroads for three: the rich quarter no one landed in draws expansion too.
        if (S.spare) s += Math.max(0, 34 - dist(i, j, S.spare.x, S.spare.y)) * 0.3;
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
        s = -Math.abs(dHome - 3.5) * 2 - dist(i, j, ex, ey) * 0.15;
      } else if (type === 'bunker' || type === 'disruptor' || type === 'mortar') {
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
        const want = type === 'mortar' ? 4 : 2.5;
        s = -Math.abs(df - want - 0) * 1.5 - dist(i, j, ex, ey) * 0.25 + Math.min(dk, 8) * 0.5;
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
      } else if (type === 'terminal') {
        // Out far enough to pay well (but not past the bonus), away from the enemy, close to our roads.
        s = Math.min(dHome, TERMINAL.minDist + TERMINAL.maxBonus / TERMINAL.perTile) * 0.5 + dist(i, j, ex, ey) * 0.3 - rc * 0.4;
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
      // Feed links: a factory beside the building that makes its input (or uses its output) is worth a few tiles.
      if (AI_FEED.has(type)) s += Math.min(2, feedPreview(p, type, i, j).length) * 3;
      s += jitter;
      if (out && type !== 'outpost') s -= AI_OUT_COST; // (our own land first)
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

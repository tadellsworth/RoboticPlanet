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
/** The buildings that make new bots between them (and what they run on): the first of each is always worth a worker. */
const AI_CHAIN = ['harvester', 'quarry', 'kiln', 'mine', 'tap', 'smelter', 'fab', 'foundry'];
/** ...and the ones a colony down to a handful of workers keeps running, come what may (see the triage in aiThink). */
const AI_CORE = ['mine', 'smelter', 'fab', 'foundry'];
/**
 * Fewer workers than this is an emergency (triage); it's over once there are AI_ENOUGH again, or as many as its
 * buildings want and two to spare if that is more, up to AI_PLENTY. (The chain alone takes eight and two are kept
 * free to build: with six to nine and no triage, or ten and twenty buildings, two Smelters and the Chip Fab could
 * hold the workers while no Mine or Crystal Tap had one, and the colony stood still.)
 */
const AI_FEW = 8, AI_ENOUGH = 10, AI_PLENTY = 16;

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
  // An Easy rival keeps to the plain rules: the ones marked `smart` below are for Medium, Normal and Hard.
  const smart = S.difficulty !== 'easy';
  let me = playerBuildings(p);
  const lander = getE(P.lander);
  if (!lander || lander.owner !== p) return;

  // Nobody is sent to work in reach of a rival's guns, or by a spot where its robots were lately killed (unsafeAt:
  // gunCover, and the danger spots noteDanger keeps). A site that has come under guns, or where two have died, is
  // given up, and the roads planned over such ground are called off. (A Hard rival once lost 59 workers and 33
  // Haulers in twenty minutes, building and mending beside one shelled Outpost.)
  for (const b of me) {
    if (b.built || BDEFS[b.type].prepaid || !(underGuns(p, tIdx(b.x, b.y)) || dangerAt(p, b.x, b.y, 2))) continue;
    (P.avoid = P.avoid || []).push({ x: b.x, y: b.y, until: S.time + 240 });
    demolish(b);
  }
  me = me.filter((b) => !b.dead);
  for (const t of planAll(p).slice()) if (unsafeAt(p, t % S.W, (t / S.W) | 0)) cancelPlan(t);
  // Its own road where two have been killed in reach of a rival's guns is taken up (never a bridge or a tunnel), so
  // its Haulers stop driving into them: what lies beyond is cut off until the guns are gone, and aiRoads lays no
  // road over unsafe ground. (A Turtle lost 21 Haulers in nine minutes on one stretch of road past a Bunker.)
  for (const d of P.danger || []) {
    if (d.until <= S.time || d.n < 2) continue;
    for (let j = Math.max(0, d.y - DANGER_R); j <= Math.min(S.H - 1, d.y + DANGER_R); j++) for (let i = Math.max(0, d.x - DANGER_R); i <= Math.min(S.W - 1, d.x + DANGER_R); i++) {
      const t = tIdx(i, j);
      if (S.road[t] && !crossTile(t) && wayOwner(t) === p && underGuns(p, t) && dist2(i, j, d.x, d.y) <= DANGER_R * DANGER_R) removeRoad(p, i, j);
    }
  }

  // 1) Construction
  const counts = {};
  let sites = 0;
  for (const b of me) {
    counts[b.type] = (counts[b.type] || 0) + 1;
    if (!b.built && !BDEFS[b.type].prepaid) sites++;
  }
  const maxSites = p === 0 && P.ai ? 2 : lvl.maxSites;
  let workers = 0, staffed = 0, freeWorkers = 0;
  const kinds = {};
  for (const u of S.bots) {
    if (u.dead || u.owner !== p) continue;
    kinds[u.type] = (kinds[u.type] || 0) + 1;
    if (u.type === 'worker' && !(u.task && u.task.type === 'staff')) freeWorkers++;
  }
  workers = kinds.worker || 0;
  // Triage: down to a handful of workers (a raid got the rest), the colony does one thing only, make more. Nothing
  // new is started and open sites are called off (dispatch keeps two workers free for building while any site
  // stands, which left no one to run the Foundry), every building rests but the ones that make bots, and the
  // Foundry builds workers alone (see below), until there are enough again.
  const wantStaff = me.reduce((n, b) => n + (b.built && BDEFS[b.type].staff && !BDEFS[b.type].crew ? 1 : 0), 0);
  const few = S.time > 60 && workers < (P.triage ? clamp(wantStaff + MIN_FREE_WORKERS, AI_ENOUGH, AI_PLENTY) : AI_FEW);
  // (Only a site for a link of the chain it has none of is kept.)
  const idleSite = (b) => !b.built && !BDEFS[b.type].prepaid && !(AI_CHAIN.includes(b.type) && !me.some((x) => x.built && x.type === b.type));
  if (few && me.some(idleSite)) {
    for (const b of me.filter(idleSite)) { demolish(b); sites--; counts[b.type]--; }
    me = me.filter((b) => !b.dead);
  }
  for (const b of me) if (BDEFS[b.type].staff && !BDEFS[b.type].crew) staffed++;
  if (!few) {
    aiWalls(p);
    aiTurtleWalls(p);
    aiBridge(p, maxSites, kinds.warbot || 0);
  }
  // Warbots can't fight without Ammo: in a war, once the opening is done and the Bot Foundry stands, an Ammo
  // Plant comes first, its site is never given up, and the Foundry rests so the Alloy reaches it. (Not before the
  // Foundry: an Ammo Plant with nothing else to feed turned the Alloy we landed with into Ammo, and the Foundry
  // came five minutes late.)
  const needArmory = warOn() && S.time > 150 && !me.some((b) => b.type === 'armory' && b.built) && me.some((b) => b.type === 'foundry' && b.built);
  const armoryDue = needArmory && S.mode !== 'colony'; // (a Colony builds none, so nothing waits for one there)
  // Keep a few workers free to build: a colony with every worker staffed stalls.
  const canStaffMore = staffed + Math.max(3, Math.round(workers * 0.2)) <= workers;
  // The chain that makes bots (see AI_CHAIN): until it's complete the only second building of a kind is a
  // Harvester, and anything else that needs a worker waits until there's one to spare beyond the two dispatch
  // keeps free for building. With ten workers the chain alone takes eight.
  const chainDone = AI_CHAIN.every((t) => counts[t]);
  const spareWorker = workers - staffed > MIN_FREE_WORKERS;
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
  // A Turtle wants twice the turrets (and its first one early); a Tycoon a bigger industry straight
  // after the first Ammo Plant (its Missile Factory and Silos come through aiMissilePlan, like everyone's).
  if (st.turrets) plan = plan.map(([t, n]) => (t === 'turret' ? [t, n * 2] : [t, n]));
  // Keeps: one for every rival, a quarter of an hour in; a Turtle builds its first early and adds one
  // every eight minutes after, up to three. When one is due it goes first and holds its goods (see defence).
  const keepAt = AI_DEFENCE_AT + (st.walls ? 120 : 600);
  let wantKeeps = S.mode === 'colony' || S.time < keepAt ? 0 : st.walls ? Math.min(3, 1 + Math.floor((S.time - keepAt) / 480)) : 1;
  // A Keep site given up (it waited too long for goods, or for a road) isn't tried again for five minutes.
  if (S.time - (S.players[p].keepFail ?? -999) < 300) wantKeeps = Math.min(wantKeeps, counts.keep || 0);
  if ((counts.keep || 0) < wantKeeps) plan = [['keep', wantKeeps]].concat(plan);
  // Bombers, now and then: every rival but a Turtle puts up an Airfield late in a war (from 22 minutes, with its
  // Ammo Plant running) for a single Strike Bomber (see aiBomber).
  if (S.mode !== 'colony' && !st.walls && S.time >= 1320 && !counts.airfield && me.some((b) => b.type === 'armory' && b.built)) plan = [['airfield', 1]].concat(plan);
  // Bulk trade: a Trade Terminal once the colony is running short of Ore, Crystal or Stone (a Tycoon from 14
  // minutes, the rest from 20), with a Road Train to serve it (see the Foundry, and aiTrade).
  const tradeAt = st.missiles ? 840 : 1200;
  if (S.mode !== 'colony' && S.time >= tradeAt && !counts.terminal && counts.foundry && S.time - (P.termFail ?? -999) > 240) {
    const sh = tradeShortest(p), g = sh.find((x) => x !== 'alloy'); // short of something in the ground
    if (sh.left[g] < (TRADE_LEFT[g] || 60) * 1.5 || st.missiles) plan = [['terminal', 1]].concat(plan); // only when short: it goes first
  }
  if (st.missiles) { const k = plan.findIndex(([t]) => t === 'armory') + 1; plan = plan.slice(0, k).concat([['smelter', 2], ['fab', 2]], plan.slice(k)); }
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
  if (hitFort && S.mode !== 'colony' && S.time > AI_DEFENCE_AT && !(P.defWant && S.time < P.defWant.until) && !unsafeAt(p, hitFort.x, hitFort.y)) {
    const nDef = (counts.bunker || 0) + (counts.mortar || 0) + (counts.disruptor || 0);
    if (nDef < 1 + Math.floor(S.time / 480) && S.time - (P.defAt || -999) > 120) {
      const type = ['bunker', 'mortar', 'disruptor'].sort((a, c) => (counts[a] || 0) - (counts[c] || 0))[0];
      P.defWant = { type, n: (counts[type] || 0) + 1, until: S.time + 120, x: hitFort.x, y: hitFort.y };
      P.defAt = S.time;
    }
  }
  // An army parked on its land or within 14 tiles of its Command Base while no fort is being hit (so nothing above
  // asks for a defence): four or more enemy warbots and Rocket Trucks standing there call for a Mortar Pit, the one
  // gun that reaches them from out of their own reach, by the fort nearest them: up to three, 7 to 10 tiles from
  // where they stand (a builder goes no nearer: see takeShelter). Normal and Hard rivals, and a Turtle on any.
  if ((S.difficulty === 'normal' || S.difficulty === 'hard' || st.walls) && S.mode !== 'colony' && S.time > AI_DEFENCE_AT && !few &&
      !(P.defWant && S.time < P.defWant.until) && S.time - (P.defAt || -999) > 60 && (counts.mortar || 0) < 3) {
    let n = 0, sx = 0, sy = 0;
    for (const u of S.bots) {
      if (u.dead || u.inside || u.owner === p || u.owner < 0 || !(u.type === 'warbot' || BOTS[u.type].siege)) continue;
      const ti = Math.floor(u.x), tj = Math.floor(u.y);
      if (!inMap(ti, tj) || (S.owner[tIdx(ti, tj)] !== p && dist2(u.x, u.y, lander.x, lander.y) > 196)) continue;
      n++; sx += u.x; sy += u.y;
    }
    if (n >= 4) {
      sx /= n; sy /= n;
      let f = null, fd = Infinity;
      for (const b of me) { if (!b.built || !BDEFS[b.type].mil || BDEFS[b.type].bunker) continue; const d = dist2(b.x, b.y, sx, sy); if (d < fd) { fd = d; f = b; } }
      if (f) { P.defWant = { type: 'mortar', n: (counts.mortar || 0) + 1, until: S.time + 120, x: f.x, y: f.y, ax: Math.round(sx), ay: Math.round(sy) }; P.defAt = S.time; }
    }
  }
  if (P.defWant && S.time < P.defWant.until && (counts[P.defWant.type] || 0) < P.defWant.n) plan = [[P.defWant.type, P.defWant.n]].concat(plan);
  // A second Repair Station by a fort that is being fought over with none within REPAIR_WALK of it: a warbot hurt
  // there has nowhere near to go (see findRepair), and fights on until it is wrecked.
  // (Asked for once in five minutes: put up in a fight, it is often lost.)
  if (smart && hitFort && S.mode !== 'colony' && counts.repair === 1 && S.time - (P.repairAt ? P.repairAt.until : -999) > 180 && !unsafeAt(p, hitFort.x, hitFort.y) &&
      !me.some((b) => b.type === 'repair' && dist2(b.x, b.y, hitFort.x, hitFort.y) <= REPAIR_WALK * REPAIR_WALK)) P.repairAt = { x: hitFort.x, y: hitFort.y, until: S.time + 120 };
  if (P.repairAt && S.time < P.repairAt.until && counts.repair === 1) plan = [['repair', 2]].concat(plan);
  // No Cement Works: Cement builds nearly everything (and every road), so one comes first, even
  // past the usual limit on sites.
  const cementStarved = !me.some((b) => b.type === 'kiln');
  let siteCap = maxSites;
  if (cementStarved) { plan = [['kiln', 1]].concat(plan); siteCap = maxSites + 1; }
  const outSite = me.some((b) => b.type === 'outpost' && !b.built);
  if (P.short.length && !outSite && S.time - (P.lastExpand || -99) > 40) plan = [['outpost', (counts.outpost || 0) + 1]].concat(plan);
  // Missiles are expensive, so the AI saves up for them (see aiMissilePlan): while it is saving,
  // the building it saves for goes first and nothing else that costs Alloy or Chips is started.
  // (A site of that kind already going up is the one being saved for, not a reason for one more: asking for
  // "one more" every time left some rivals with four Missile Factories, or sixteen Silos.)
  const saving = few ? null : aiMissilePlan(p, me, counts, kinds, workers, staffed);
  if (saving) plan = [[saving, (counts[saving] || 0) + (me.some((b) => b.type === saving && !b.built) ? 0 : 1)]].concat(plan);
  // (Like the first Cement Works, the first Ammo Plant doesn't wait for a free site, and its Alloy is held for it.)
  if (needArmory) { plan = [['armory', 1]].concat(plan); if (armoryDue && !counts.armory) siteCap = Math.max(siteCap, maxSites + 1); }
  // Workers no longer haul, so spare ones go to work: another gatherer for the scarcest raw good.
  if (S.time > 150 && workers - staffed >= 4 && canStaffMore) {
    const have = playerGoods(p);
    const g = ['harvester', 'quarry', 'mine', 'tap'].filter((t) => (counts[t] || 0) < 3 && (have[RES[BDEFS[t].gather].good] || 0) < 8)
      .sort((a, c) => (have[RES[BDEFS[a].gather].good] || 0) - (have[RES[BDEFS[c].gather].good] || 0));
    if (g.length) plan = [[g[0], (counts[g[0]] || 0) + 1]].concat(plan);
  }
  // No Fuel left and nothing that makes any (only Fuel Stations charge robots, and every truck burns it): a Bio
  // Farm comes before everything but Fiber, past the usual limit on sites and the Fiber kept back for a Harvester;
  // with no fertile soil to build one by, an Oil Pump and a Refinery. (As an ordinary entry the farm could wait a
  // whole game behind Outposts and gatherers taking every free site.)
  const noFuel = (playerGoods(p).fuel || 0) < 4 && !me.some((b) => (b.type === 'farm' && !b.depleted) || (b.type === 'refinery' && counts.pump));
  if (noFuel) { plan = [['farm', 1], ['pump', 1], ['refinery', 1]].concat(plan); siteCap = Math.max(siteCap, maxSites + 1); }
  // A Harvester site only counts once its materials are in: one waiting for Fiber never gets any.
  const cutting = me.some((b) => b.type === 'harvester' &&
    (b.built ? reachableRes(b.x, b.y, BDEFS.harvester.radius, R_STALK) > 0 : sumValues(b.stock) >= sumValues(BDEFS.harvester.cost)));
  const fiberLow = !cutting || playerGoods(p).fiber < 4;
  if (!cutting) plan = [['harvester', (counts.harvester || 0) + 1]].concat(plan);
  // With Fiber nearly gone (no Harvester at work, or construction waiting for it), the Smelters
  // stop burning it until there's some to spare. Construction waits for it at a site that is short of it, and
  // before there is a site at all: none is started without the Fiber in storage (P.fiberWait, set below), and a
  // busy Smelter burned every Fiber two Harvesters cut, so a colony could go a quarter of an hour unable to
  // start a third Harvester, a Mine or an Outpost.
  const fiberNow = playerGoods(p).fiber;
  const sitesWantFiber = S.time - (P.fiberWait ?? -99) < 8 || me.some((b) => !b.built && (siteCost(b).fiber || 0) > (b.stock.fiber || 0) + (b.inc.fiber || 0));
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
  if (enemyAir && S.mode !== 'colony' && !counts.flak) siteCap = Math.max(siteCap, maxSites + 1); // the first Flak Gun doesn't wait for a free site
  const key = (type) => (type === 'charger' && !counts.charger) || type === 'foundry' || type === 'harvester' || type === 'quarry' || (type === 'kiln' && (playerGoods(p).cement || 0) < 3) || defence(type) || (type === 'armory' && needArmory) ||
    (P.defWant && P.defWant.type === type && S.time < P.defWant.until) ||
    (type === 'outpost' && P.short.length > 0);
  // The first turret and the Repair Station go to the head of the queue once they are due. (They have their place
  // in the plan behind the second Smelter; with the Foundry no longer resting, more was wanted ahead of them, and
  // they went up one and five minutes later than they used to.)
  if (smart) for (const d of ['repair', 'turret']) if (!counts[d] && defence(d)) plan = [[d, 1]].concat(plan);
  if (sites < siteCap) {
    for (const [type, want0] of plan) {
      if (few && (!AI_CHAIN.includes(type) || (counts[type] && !(type === 'harvester' && !cutting)))) continue; // triage: only a missing link of the chain
      if (cementStarved && sites >= maxSites && type !== 'kiln' && !(noFuel && type === 'farm')) continue;
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
      // (Only while the Foundry rests for the missiles too: when it doesn't, see forMissiles below, they wait for
      // Alloy to spare and hold nothing else up, or a long wait kept the Repair Station and Fuel Stations back.)
      if (saving && (!smart || st.missiles || P.missileRest) && type !== saving && type !== 'keep' && type !== 'terminal' && type !== 'airfield' && !BDEFS[type].nuke && (BDEFS[type].cost.alloy || BDEFS[type].cost.chip)) continue;
      // Keep enough Fiber for a Harvester while none is cutting: without Fiber there's no way back.
      if (type !== 'harvester' && !(noFuel && type === 'farm') && fiberLow && (BDEFS[type].cost.fiber || 0) > 0 && playerGoods(p).fiber - BDEFS[type].cost.fiber < BDEFS.harvester.cost.fiber) continue;
      // The first of each building in the chain that makes bots is always allowed, so the chain is complete, and
      // so is the Ammo Plant once it's due (it lends its worker to the chain when it must: see below). Until the
      // chain is complete the only second building of a kind is a Harvester, and the first of anything else that
      // takes a worker waits for one to spare; none of them while the Ammo Plant is still to come.
      if (BDEFS[type].staff && !BDEFS[type].crew && !(type === 'armory' && needArmory)) {
        if (counts[type] ? !canStaffMore || (type !== 'harvester' && (!chainDone || (armoryDue && !counts.armory)))
          : !AI_CHAIN.includes(type) && (!spareWorker || (armoryDue && !counts.armory)) && !(noFuel && (type === 'pump' || type === 'refinery'))) continue;
      }
      if (Object.keys(BDEFS[type].cost).some((g) => held.has(g))) continue;
      if (reserveCement && type !== 'outpost' && type !== 'quarry' && type !== 'kiln' && BDEFS[type].cost.cement) continue;
      if (type === 'kiln' && stoneLow && counts.kiln) continue;
      // A turret or Repair Station is started as soon as the Cement is there: new Alloy goes straight
      // into factories, so it never piles up in storage; the high-priority site gets it delivered.
      const defenceNow = (defence(type) && counts.smelter && aiAffordable(p, type, ['alloy', 'chip'])) || ((type === 'terminal' || type === 'airfield') && aiAffordable(p, type, ['alloy']));
      if (!aiAffordable(p, type) && !defenceNow) {
        if ((BDEFS[type].cost.fiber || 0) > playerGoods(p).fiber) P.fiberWait = S.time; // (the Smelters rest for it: see above)
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
        if (type === 'armory' && !needArmory) placed.building.prio = 'low'; // (the first one's site isn't served last; it's set low once it stands)
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
      if (!b.built || b.fixLeft > 0 || S.time - (b.lastHit || -99) < 6 || b.armor >= BDEFS[b.type].armor * 0.75 || unsafeAt(p, b.x, b.y)) continue;
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
  // The chain that makes bots comes first for workers. Dispatch never moves one from a building to another by
  // itself, so a Smelter finished last could stand empty beside a manned Ammo Plant waiting for its Alloy: while a
  // link of it (see AI_CHAIN: every Smelter, say, or the only Crystal Tap) wants a worker, has none and none is free
  // to send, the Ammo Plant rests, and failing that the newest second gatherer of a kind lends its worker.
  const unmanned = (type) => me.some((b) => b.type === type && b.built && !b.paused && !b.cut && !b.depleted && !b.staff && !b.staffInc && !atLimit(b)) &&
    !me.some((b) => b.type === type && b.built && (b.staff || b.staffInc));
  const chainWaits = !few && freeWorkers <= MIN_FREE_WORKERS && AI_CHAIN.some(unmanned);
  let freed = false;
  for (const b of me) {
    const cap = AI_CAPS[b.type];
    if (!cap || !b.built) continue;
    if (forBridge && (b.type === 'armory' || b.type === 'fab')) { if (!b.paused) setPaused(b, true); continue; }
    if (b.type === 'armory' && !b.prio) b.prio = 'low';
    if (chainWaits && b.type === 'armory') { if (!b.paused) { freed = freed || !!(b.staff || b.staffInc); setPaused(b, true); } continue; }
    const hi = cap[1] * (missiles && b.type === 'fab' ? 2 : 1), lo = cap[2];
    const have = stockNow[cap[0]] || 0;
    if (!b.paused && have >= hi) setPaused(b, true);
    else if (b.paused && have < lo) setPaused(b, false);
  }
  if (!chainWaits && P.lent) {
    for (const id of P.lent) { const b = getE(id); if (b && !b.dead && b.owner === p && b.paused) setPaused(b, false); }
    delete P.lent;
  } else if (chainWaits && !freed) {
    const spare = me.filter((b) => b.built && !b.paused && BDEFS[b.type].gather && (b.staff || b.staffInc) && me.some((x) => x !== b && x.type === b.type && x.built && !x.paused))
      .sort((a, c) => c.born - a.born)[0];
    if (spare) { setPaused(spare, true); (P.lent = P.lent || []).push(spare.id); }
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

  // Triage (see above): every building that takes a worker rests but the links of the chain the next robot is
  // waiting for; the ones rested here are switched back on when it's over. With so few hands each link works only
  // while what it makes is short and what it needs is there: the Foundry while there's a part of each kind for it
  // (always, with more than three workers), the Chip Fab while Chips are short and there's Crystal and Alloy, the
  // Smelter while Alloy is short and there's Ore, a Mine while Alloy and Ore are both short, any other gatherer (or
  // the Quarry and Cement Works) while there's next to none of what it's for. (Four workers used to man the
  // Foundry, a Smelter with 25 Alloy in store and a Chip Fab with no Crystal, the fourth kept free, and nobody the
  // Crystal Tap: the colony never made another robot.)
  if (few) {
    P.triage = P.triage || [];
    const have = { ...playerGoods(p) }, got = (g) => have[g] || 0; // (what's in store, and what already lies in the chain's hoppers)
    for (const b of me) if (b.built && AI_CORE.includes(b.type)) for (const g in BDEFS[b.type].inp || {}) have[g] = (have[g] || 0) + (b.stock[g] || 0);
    for (const b of me) {
      const def = BDEFS[b.type];
      if (!b.built || !def.staff || def.crew) continue;
      const need = b.type === 'foundry' ? workers > 3 || (got('alloy') >= 1 && got('chip') >= 1)
        : b.type === 'fab' ? got('chip') < 4 && got('crystal') >= 1 && got('alloy') >= 1
        : b.type === 'smelter' ? got('alloy') < 6 && got('ore') >= 2
        : b.type === 'mine' ? got('alloy') < 6 && got('ore') < 4
        : b.type === 'quarry' || b.type === 'kiln' ? got('cement') < 4 : !!def.gather && got(RES[def.gather].good) < 4;
      if (need) { if (b.paused && P.triage.includes(b.id)) setPaused(b, false); }
      else if (!b.paused) { setPaused(b, true); if (!P.triage.includes(b.id)) P.triage.push(b.id); }
    }
  } else if (P.triage) {
    for (const id of P.triage) { const b = getE(id); if (b && !b.dead && b.owner === p && b.paused) setPaused(b, false); }
    delete P.triage;
  }

  // A building whose workers keep being killed about it (two within its working radius and two tiles more: a Mine
  // whose Ore lies inside an enemy Mortar's ring, say) rests until the danger spot is gone (P.shut; see noteDanger).
  for (const b of me) {
    const def = BDEFS[b.type];
    if (!b.built || !def.staff) continue;
    const r = (def.radius || 1) + 2, hit = (P.danger || []).some((d) => d.until > S.time && d.n >= 2 && dist2(d.x, d.y, b.x, b.y) <= r * r);
    if (hit && !b.paused) { setPaused(b, true); (P.shut = P.shut || {})[b.id] = 1; }
    else if (!hit && P.shut && P.shut[b.id]) { if (b.paused) setPaused(b, false); delete P.shut[b.id]; }
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
  let wantHaulers = clamp(Math.ceil(me.length * 0.35), 4, 16) - Math.floor(1.5 * (kinds.truck || 0));
  const baseHaulers = wantHaulers;
  // ...and one more (up to 24) whenever no Hauler has stood idle for 20 s while goods waited to be moved: a building
  // with its output full, or a factory short of an input that is in storage. (By the count of buildings alone the
  // Haulers were busy 98% of the time from minute 10, the Mines stood full and the Smelters empty.)
  if (smart) {
    const have = playerGoods(p);
    const waits = (b) => {
      const def = BDEFS[b.type];
      if (!b.built || b.paused || b.cut || def.store) return false;
      for (const g in def.out || {}) if ((b.stock[g] || 0) >= def.out[g]) return true;
      if (b.staff) for (const g in def.inp || {}) if ((b.stock[g] || 0) + (b.inc[g] || 0) < def.inp[g] && (have[g] || 0) >= 2) return true;
      return false;
    };
    const idle = S.bots.some((u) => !u.dead && u.owner === p && u.type === 'hauler' && isIdleWorker(u));
    if (idle || !me.some(waits)) P.haulShort = 0;
    else if (!P.haulShort) P.haulShort = S.time;
    else if (S.time - P.haulShort >= 20) { P.haulShort = S.time; P.haulMore = Math.min(24, (kinds.hauler || 0) + 1); }
    if ((P.haulMore || 0) > (kinds.hauler || 0)) wantHaulers = Math.max(wantHaulers, P.haulMore); else P.haulMore = 0;
  }
  // Freight Trucks: one for every two buildings that make goods a long run (TRUCK_MIN_DIST) from the Command Base, up
  // to four. With any truck about, a long run waits for one unless the factory at its end is empty (see dispatch), so
  // a single truck for a forward Depot held up every far Mine and Tap. (Easy keeps that: one for a Depot with supply
  // orders, another for every 35 buildings.)
  const farRuns = me.reduce((n, x) => n + (x.built && BDEFS[x.type].out && !BDEFS[x.type].store && farApart(x, lander) ? 1 : 0), 0);
  const wantTrucks = smart ? Math.min(4, Math.floor((farRuns + 1) / 2))
    : me.some((d) => d.keep && d.built && !BDEFS[d.type].terminal) ? 1 + Math.floor(me.length / 35) : 0;
  // Tankers carry every drop of Crude and Fuel: one, and another for every five buildings that make or burn them.
  const liquidBlds = me.filter((b) => b.built && (BDEFS[b.type].charger || BDEFS[b.type].pump || BDEFS[b.type].burner ||
    ['refinery', 'farm', 'munitions', 'tarworks', 'disruptor'].includes(b.type))).length;
  const wantTankers = Math.min(4, 1 + Math.floor(liquidBlds / 5));
  const army = kinds.warbot || 0;
  const wantArmy = S.mode === 'colony' ? 0 : aiWantArmy(lvl, p);
  const armyBehind = army < wantArmy - 2;
  // Home guard: the Command Base keeps about a third of the army (2 to 8; 2 for an Easy rival, for one with half
  // as many warbots again as all its rivals and four more, which has a war to finish, and for anyone from AI_ALL_IN
  // on, unless its base is threatened: long wars are fought out), and each Keep up to
  // three, out of every attack, raid and march (keepAt); and while four or more enemy warbots stand within 12 tiles of
  // the base, or it is being hit, every new and idle warbot goes there (P.homeCall, goGarrison). (New warbots used
  // to walk to the Outpost nearest the enemy: at minute 34 a Hard rival had 26 of 28 out there and one at home.)
  if (S.mode !== 'colony') {
    const foes = S.bots.reduce((n, u) => n + (!u.dead && u.owner >= 0 && u.owner !== p && u.type === 'warbot' ? 1 : 0), 0);
    let near = 0;
    if (smart) for (const u of S.bots) if (!u.dead && !u.inside && u.owner !== p && u.owner >= 0 && u.type === 'warbot' && dist2(u.x, u.y, lander.x + 0.5, lander.y + 0.5) <= 144) near++;
    if (near >= 4 || (smart && S.time - (lander.lastHit || -99) < 30)) P.homeCall = S.time + 20;
    P.homeGuard = smart && (P.homeCall > S.time || (S.time < AI_ALL_IN && army < foes * 1.5 + 4)) ? clamp(Math.ceil(army / 3), 2, 8) : 2;
    // With twice its rivals' warbots and two more it throws everything in: its Outposts keep none back (keepW 0, as a
    // player can set), so a march can gather the army. (With one kept in each of sixteen Outposts, a rival with 35
    // warbots against 8 had four to send, and the war went on.)
    // And while it masses for a march (P.massFor, below) the Outposts with no enemy near give up theirs the same way.
    const allIn = smart && army >= lvl.threshold * 2 && army >= foes * 2 + 2, massing = smart && P.massFor && S.time <= P.massFor.until;
    // (Otherwise each keeps one again: an Outpost taken from a rival that had thrown everything in, too.)
    for (const b of me) {
      if (!b.built || b.type !== 'outpost') continue;
      if (allIn || (massing && S.time - (b.lastHit || -99) > 30 && !nearestEnemyBot(p, b.x + 0.5, b.y + 0.5, 10, true, false, true))) b.keepW = 0;
      else if (b.keepW !== undefined) delete b.keepW;
    }
  }
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
    // Triage: workers, and nothing else, until there are enough (but one Hauler first when there is none and a few
    // workers already: until then a worker has to stay free to carry).
    if (few) { b.mode = 'worker'; if (!kinds.hauler && workers >= 3) b.orders = { hauler: 1 }; else delete b.orders; break; }
    // Workers first while buildings stand empty; then the army gets its share as the game goes on.
    b.mode = S.mode === 'colony' ? 'worker' : workers < staffed + MIN_FREE_WORKERS ? 'worker'
      : army < wantArmy ? (workers < wantWorkers ? 'alt' : 'warbot')
        : workers < wantWorkers ? 'worker' : workers > wantWorkers + 4 ? 'warbot' : 'alt';
    // A third of the army with no Ammo: no more warbots until it's armed (the Alloy goes to Ammo).
    if (unarmed >= Math.max(4, army / 3) && (b.mode === 'warbot' || b.mode === 'alt')) b.mode = workers < wantWorkers ? 'worker' : 'off';
    b.orders = b.orders || {};
    for (const crew in crewNeed) if ((kinds[crew] || 0) < crewNeed[crew] && !(b.orders[crew] > 0)) b.orders[crew] = 1;
    // No Tanker left: Fuel only trickles by Hauler, so a new one comes before anything else.
    if (!(kinds.tanker > 0) && !(b.orders.tanker > 0)) b.orders.tanker = 1;
    // Saving up for missiles (or feeding the Missile Factory): the Foundry rests so Alloy and Chips
    // pile up, unless workers are badly short.
    // (Not while the army is well behind: warbots come first.)
    // Saving for a bridge to the enemy's island too: until it's built the army can't reach anyone.
    const bridging = P.bridgeWant > 0 && S.time - P.bridgeWant < 30;
    // A Tycoon rests it for missiles even with a small army (as long as a few warbots stand guard). The others
    // only while the army isn't well behind and the colony has the workers and the Haulers its buildings call for.
    // (With the army alone to go by it was off a third of minutes 3 to 15, while buildings stood empty and goods
    // waited. Asking for the army at full strength too left it never resting once a war was on: hardly a Missile
    // Factory or Silo went up, and more games ran past forty minutes undecided. An Easy rival keeps the old rule.)
    const forMissiles = (saving || P.feedMissiles) && (st.missiles ? !armyBehind || army >= wantArmy * 0.7
      : !armyBehind && (!smart || (workers >= wantWorkers && (kinds.hauler || 0) >= baseHaulers)));
    P.missileRest = forMissiles ? 1 : 0;
    // (Saving for a crossing with a fair army already: the Foundry rests even if workers are short.)
    // Fewer than half the Haulers it wants (a raid got them, say): nothing reaches the factories without them, so
    // the Foundry doesn't rest and the next robot it builds is a Hauler, whatever else is on order.
    const fewHaulers = smart && (kinds.hauler || 0) < wantHaulers / 2;
    if (!fewHaulers && (((forMissiles || needArmory || bridging) && workers >= staffed + 3) || (bridging && P.bridgeNeed && army >= Math.min(wantArmy, 8)))) { b.mode = 'off'; delete b.orders.hauler; delete b.orders.truck; }
    // Haulers when short. (An Easy rival, while its army is well behind, only when badly short: it stopped at six
    // for most of a war, with thirty or forty buildings to serve.)
    else if ((kinds.hauler || 0) < (armyBehind && !smart ? Math.min(wantHaulers, 6) : wantHaulers) && !(b.orders.hauler > 0)) b.orders.hauler = 1;
    else if ((kinds.tanker || 0) < wantTankers && !(b.orders.tanker > 0)) b.orders.tanker = 1;
    // Freight Trucks for the long runs (see wantTrucks).
    else if ((kinds.truck || 0) < wantTrucks && !(b.orders.truck > 0)) b.orders.truck = 1;
    // Rocket Trucks for siege once the army is up: one, and one more for every ten warbots (at most three).
    const wantRockets = S.mode === 'colony' || S.time < lvl.grace ? 0 : Math.min(3, Math.floor(army / 10) + (army >= lvl.threshold ? 1 : 0));
    if ((kinds.rocket || 0) < wantRockets && !(b.orders.rocket > 0) && !armyBehind && me.some((a) => a.type === 'armory' && a.built)) b.orders.rocket = 1;
    if (fewHaulers && b.orders.hauler > 0) b.rr = foundryList(b).indexOf('hauler'); // (orders take turns from b.rr: see nextBotKind)
    // A Trade Terminal is served only by Road Trains: one for it.
    if (me.some((t) => BDEFS[t.type].terminal) && !(kinds.roadtrain > 0) && !(b.orders.roadtrain > 0)) b.orders.roadtrain = 1;
    break;
  }
  // Depots out towards the front keep Cement for building there (and Ammo), and take in nothing that is dug or cut:
  // a Depot among the far Mines was the nearest storage for their Ore, which then lay there, a long run from the
  // Smelters that stood waiting for it (every stored Ore in the Depot, none at the Command Base).
  for (const d of me) {
    if (d.type !== 'depot' || !d.built || dist(d.x, d.y, lander.x, lander.y) < 12) continue;
    if (!d.keep) { setKeep(d, 'cement', 12); if (S.mode !== 'colony') setKeep(d, 'ammo', 4); }
    if (smart && !d.reject) d.reject = { ore: true, crystal: true, stone: true, fiber: true };
  }

  // 4) Missiles: soften turrets and Outposts first, the Command Base once the army is big. (With
  //    two rivals, the one it's up against is the nearest still in the game.)
  const enemy = rivalOf(p);
  const rival = (o) => o >= 0 && o !== p && !S.players[o].out && !S.players[o].absent;
  if (S.mode !== 'colony' && S.time >= lvl.grace) {
    // Damage already on its way: never two missiles for a target one wrecks, nor a fort a missile can
    // knock no lower (see missileFloor).
    const dmg = BDEFS.silo.missile.damage, coming = new Map();
    for (const m of S.missiles) if (m.owner === p && m.target && !m.nuke) coming.set(m.target, (coming.get(m.target) || 0) + dmg);
    // A Normal or Hard rival (a Tycoon keeps its own way) holds a ready Missile up to 90 s for its next push and
    // fires it at the defences within 8 tiles of what its warbots are going for (P.siegeAt: an attack, a march, a
    // fort it is massing against); with no push by then it aims at what stalls the enemy: the Bot Foundry, the Ammo
    // Plant, the Missile Factory and Silos, Fuel, then Smelters and Chip Fabs, before guns and forts. (Most Missiles
    // used to go at Outposts, which they can't destroy, the moment a Silo was loaded.)
    const clever = (S.difficulty === 'normal' || S.difficulty === 'hard') && !st.missiles;
    const push = clever && P.siegeAt && P.siegeAt.push && S.time < P.siegeAt.until ? P.siegeAt : null; // (a push: at a fort, not a band sent to wreck a site or a Mine)
    if (!me.some((b) => siloReady(b)) || push) P.missileWait = 0; else if (!P.missileWait) P.missileWait = S.time;
    const hold = clever && !push && S.time - (P.missileWait || S.time) < 90;
    for (const silo of me) {
      if (hold || !siloReady(silo)) continue;
      let best = null, bs = -Infinity;
      for (const e of S.buildings) {
        if (e.dead || e.owner !== enemy || !e.built) continue;
        const d = dist(silo.x, silo.y, e.x, e.y);
        if (d > BDEFS.silo.missile.range) continue;
        const left = e.armor - (coming.get(e.id) || 0);
        if (BDEFS[e.type].mil ? left <= missileFloor(e) + 2 : left <= 0) continue;
        let s = (e.type === 'turret' ? 10 : e.type === 'nukesilo' ? 12 : e.type === 'silo' || e.type === 'reactor' ? 9 : e.type === 'outpost' ? 8 :
          e.type === 'mortar' || e.type === 'disruptor' || e.type === 'bunker' || e.type === 'keep' ? 7 : e.type === 'lander' ? 5 : 3) - d * 0.1;
        if (push) s += dist2(e.x, e.y, push.x, push.y) <= 64 ? 10 : 0;
        else if (clever) s = (AI_HURT[e.type] || (BDEFS[e.type].war && !BDEFS[e.type].mil && !BDEFS[e.type].barrier ? 5 : BDEFS[e.type].mil ? 3 : 2)) - d * 0.1;
        if (s > bs) { bs = s; best = e; }
      }
      if (best && fireMissile(p, best)) { coming.set(best.id, (coming.get(best.id) || 0) + dmg); P.missileWait = 0; }
    }
  }

  // 4a) Nuclear race: fire a ready nuclear missile where it destroys the most, and clear out of the
  //     blast ring of any heading this way.
  if (nukeOn()) for (const silo of me) if (silo.type === 'nukesilo' && silo.armed && silo.built) aiFireNuke(p, silo);
  if (S.missiles.some((m) => m.nuke) && nukesThreatening(p).some((m) => !evacuating(p, m))) startEvac(p);

  // 4c) Naval maps: a Port, a Ferry, and beach landings on the enemy's shore.
  if (S.mode !== 'colony' && navalMap()) aiNaval(p, me, kinds, lvl, lander, !few && sites < maxSites);

  // 4e) Rocket Trucks: shell the defences round what we're attacking, and hunt down the enemy's.
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
  // What became of its attacks and marches: one that loses more than half its warbots within three minutes is
  // remembered (P.beaten) and nothing goes within 8 tiles of that place for five minutes, unless half as many
  // again go. (P.fights: where each went, how many, who.) A place it can't get at through the enemy's walls is
  // left alone for a minute the same way.
  P.fights = (P.fights || []).filter((f) => {
    if (f.ids.reduce((n, id) => n + (getE(id) && !getE(id).dead ? 1 : 0), 0) * 2 < f.n) { (P.beaten = P.beaten || []).push({ x: f.x, y: f.y, n: f.n, until: S.time + 300 }); return false; }
    return S.time - f.t < 180;
  });
  if (P.beaten) P.beaten = P.beaten.filter((q) => q.until > S.time);
  const beaten = (b, n) => (P.beaten || []).some((q) => dist2(q.x, q.y, b.x, b.y) <= 64 && n < q.n * 1.5);
  const walled = (b) => (P.beaten = P.beaten || []).push({ x: b.x, y: b.y, n: 1e6, until: S.time + 60 });
  // What an attack on b has to beat: 1.3 warbots for each of its garrison and 2 more, and one for everything that
  // stands guard round it (guardsNear: its guns, the forts that answer for it, warbots in the field).
  const guardAt = (b) => Math.ceil(b.garrison.length * 1.3) + 2 + guardsNear(b);
  const wily = S.difficulty === 'normal' || S.difficulty === 'hard';
  // Where the enemy's field army stands (three or more warbots out of their forts): the middle of them.
  let field = null;
  if (wily) {
    let n = 0, fx = 0, fy = 0;
    for (const u of S.bots) if (!u.dead && !u.inside && u.owner === enemy && u.type === 'warbot') { n++; fx += u.x; fy += u.y; }
    if (n >= 3) field = { x: fx / n, y: fy / n };
  }
  let best = null, bestScore = -Infinity, bestAvail = 0;
  for (const b of S.buildings) {
    if (b.dead || !rival(b.owner)) continue; // whichever rival's building is in reach
    const avail = attackAvailable(p, b);
    if (avail < 2) continue;
    // Enough for the garrison, the turrets covering it and any warbots standing guard nearby; a fort
    // already shot down to a quarter of its armor needs only the usual band.
    const weak = b.built && BDEFS[b.type].mil && b.armor <= BDEFS[b.type].armor * SORTIE_ARMOR;
    const base = !b.built ? 2 : weak ? lvl.threshold : Math.max(lvl.threshold, Math.ceil(b.garrison.length * 1.3) + 2);
    if (avail < base || (b.built && !weak && avail < guardAt(b)) || beaten(b, avail)) continue;
    const def = BDEFS[b.type];
    let score = (def.mil ? 12 : 0) + (b.type === 'lander' ? 25 : 0) - dist(b.x, b.y, lander.x, lander.y) * 0.4 - b.garrison.length * 2;
    if (!b.built) score -= 8;
    // A Normal or Hard rival also counts what the building does for its owner (AI_HURT: the Foundry, the Ammo Plant,
    // Silos, Fuel ...), and a Hard one how far it stands from the enemy's warbots in the field (up to 6 for 30 tiles).
    else if (wily) score += (AI_HURT[b.type] || 0) + (S.difficulty === 'hard' && field ? Math.min(30, dist(b.x, b.y, field.x, field.y)) * 0.2 : 0);
    if (score > bestScore) { bestScore = score; best = b; bestAvail = avail; }
  }
  if (best) {
    // (Not at walls the band couldn't shoot its way through: see attackBreach.)
    const br = attackBreach(p, best, bestAvail);
    if (br.need > br.shots) { walled(best); return; }
    const was = new Set();
    for (const u of S.bots) if (!u.dead && u.owner === p && u.task && u.task.type === 'attack' && u.task.target === best.id) was.add(u.id);
    const sent = sendAttack(p, best, bestAvail);
    if (sent && best.built) P.fights.push({ x: best.x, y: best.y, n: sent, t: S.time, ids: S.bots.filter((u) => !u.dead && u.owner === p && u.task && u.task.type === 'attack' && u.task.target === best.id && !was.has(u.id)).map((u) => u.id) });
    if (sent && best.built && wily && !P.raid) P.nextRaid = Math.min(P.nextRaid || Infinity, S.time); // a raid goes in as the attack does: two places at once
    P.siegeAt = { x: best.x, y: best.y, until: S.time + 120, push: best.built && BDEFS[best.type].mil ? 1 : 0 };
    P.nextAttack = S.time + 25;
    P.lastAttack = S.time;
    return;
  }
  // A big army with nothing in reach marches on an enemy garrison (a rally flag beside it: the warbots fight what
  // they meet and attack what stands there): the one that takes the fewest to beat, counted as for an attack
  // (guardAt) and a little more for every tile it is further from home. It goes only with that many, up to 22; with
  // fewer it masses (P.massFor: the army target and the Rocket Trucks follow, see aiWantArmy and aiSiege) and goes
  // when it has them. With twice the enemy's army it goes for the enemy Command Base itself. (It used to send the
  // 8 to 14 it had to stand beside the nearest fort, whatever guarded it: of 86 warbots on ten marches 60 died.)
  const enemyArmy = S.bots.reduce((n, u) => n + (!u.dead && u.owner === enemy && u.type === 'warbot' ? 1 : 0), 0);
  const crushing = army >= lvl.threshold * 2 && army >= enemyArmy * 2 + 2;
  if (P.massFor && S.time > P.massFor.until) P.massFor = null;
  if (army >= lvl.threshold * 2 && S.time - (P.lastMarch || -999) > 120 && !(P.march && rallyById(P.march))) {
    const spotBy = (b) => {
      for (const [di, dj] of [[1, 1], [-1, 1], [1, -1], [-1, -1], [2, 0], [-2, 0], [0, 2], [0, -2]]) {
        const i = b.x + di, j = b.y + dj;
        if (inMap(i, j) && walkable(tIdx(i, j)) && !S.bAt[tIdx(i, j)] && S.zone[tIdx(i, j)] === homeZone(p)) return { i, j };
      }
      return null;
    };
    // The fort that takes the fewest to beat among those it has the warbots for (the enemy Command Base counts as a
    // little cheaper than it is, and much cheaper with twice the enemy's army); failing any, the cheapest to mass for.
    let tgt = null, spot = null, size = 0, bs = Infinity, hard = 0, hs = Infinity;
    for (const b of S.buildings) {
      if (b.dead || b.owner !== enemy || !b.built || !BDEFS[b.type].mil || BDEFS[b.type].bunker) continue;
      const g = guardAt(b), sc = g + dist(b.x, b.y, lander.x, lander.y) * 0.15 - (b.type === 'lander' ? (crushing ? 12 : 3) : 0);
      if (sc >= bs && sc >= hs) continue;
      const at = !beaten(b, 22) && spotBy(b);
      if (!at) continue;
      // A march may empty the garrisons far behind the lines (a big empire keeps one warbot in each).
      // Against a rival with next to no army, a small band is enough to finish it.
      const avail = rallyAvailable(p, at.i, at.j, true);
      const n = Math.min(crushing ? 30 : 22, crushing ? avail : avail - 2, Math.max(14, g + 2));
      if (n >= Math.max(crushing ? 4 : lvl.threshold * 2, g) && !beaten(b, n)) { if (sc < bs) { bs = sc; tgt = b; spot = at; size = n; } }
      else if (sc < hs && g <= 28) { hs = sc; hard = g; P.siegeAt = { x: b.x, y: b.y, until: S.time + 60, push: 1 }; } // (the Rocket Trucks and Missiles soften it meanwhile)
    }
    if (tgt) {
      const { sent, rally, breach } = sendToRally(p, spot.i, spot.j, size, true);
      if (sent && breach && breach.need > breach.shots) { recallRally(rally.id); walled(tgt); } // (walls in the way it can't shoot through)
      else if (sent) {
        P.march = rally.id; P.lastMarch = S.time; P.massFor = null;
        if (wily && !P.raid) P.nextRaid = Math.min(P.nextRaid || Infinity, S.time); // (and a raid with it)
        P.fights.push({ x: tgt.x, y: tgt.y, n: sent, t: S.time, ids: rallyMembers(rally.id).map((u) => u.id) });
        P.siegeAt = { x: tgt.x, y: tgt.y, until: S.time + 150, push: 1 };
        return;
      }
    } else if (hard) P.massFor = { need: hard + 2, until: S.time + 240 };
  }
  // Recall a march that has nothing left to fight.
  if (P.march && rallyById(P.march) && S.time - (P.lastMarch || 0) > 150) { recallRally(P.march); P.march = 0; }
  // A big army with nothing in reach: push a forward Outpost toward the enemy Command Base.
  const enemyL = getE(S.players[enemy].lander);
  if (enemyL && !few && army >= lvl.threshold * 2 && S.time - (P.lastAttack || 0) > 60 && siteCount(p) < maxSites && aiAffordable(p, 'outpost')) {
    let spot = null, bd = Infinity;
    for (let j = 0; j < S.H; j++) for (let i = 0; i < S.W; i++) {
      const o = S.owner[j * S.W + i];
      if (o !== p && !(o < 0 && inReach(p, j * S.W + i))) continue; // our land, or no-one's within reach
      const d = dist(i, j, enemyL.x, enemyL.y);
      if (d < bd && !unsafeAt(p, i, j) && !(P.avoid || []).some((a) => a.until > S.time && dist2(a.x, a.y, i, j) < (a.r2 || 12)) && canPlace(p, 'outpost', i, j, true).ok && !wouldBlock(j * S.W + i)) { bd = d; spot = { x: i, y: j }; }
    }
    // (Not where its road would have to cross a rival's guns: that spot is left alone a while, and the next nearest tried.)
    if (spot && !aiRoadSafe(p, spot.x, spot.y)) (P.avoid = P.avoid || []).push({ x: spot.x, y: spot.y, until: S.time + 240 });
    else if (spot) { placeSite(p, 'outpost', spot.x, spot.y); P.lastAttack = S.time - 30; }
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
  if (!ferry && yard && army >= lvl.threshold && !(yard.yard && yard.yard.ferry > 0)) orderAtYard(yard, 'ferry', 1);
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
function aiBridge(p, maxSites, army) {
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
  // (With an army waiting to cross and no span that brings it closer for four minutes, it takes one that runs
  // sideways to another mesa: a way round. Without that a rival whose only free rim faced the wrong way sat on
  // its mesa for the whole game.)
  const via = aiViaductSpot(p, home, E, !navalMap() && S.time - (P.viaAt || 0) > 240 && army >= aiLevel(p).threshold * 2);
  if (via) {
    const cost = viaductCost(via.a % W, (via.a / W) | 0, via.b % W, (via.b / W) | 0);
    if (!canPay(p, cost)) { P.bridgeWant = S.time; P.bridgeNeed = cost; return; }
    P.bridgeWant = 0; P.bridgeNeed = null;
    if (placeViaduct(p, via.a % W, (via.a / W) | 0, via.b % W, (via.b / W) | 0).ok) P.viaAt = S.time;
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
 * close to the enemy as possible, and short. Far ends inside our border come first. Only spans that
 * bring it closer; with `sideways`, failing those, one whose far end is no more than two tiles further
 * from the enemy than its near end (the way round by another mesa). {a, b, owned} or null.
 */
function aiViaductSpot(p, home, E, sideways) {
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
        const gain = dist(ai, aj, E.x, E.y) - dist(bi, bj, E.x, E.y); // how much nearer the enemy the far end is
        if (gain < (sideways ? -2 : 2)) break; // only spans that bring us closer (or, sideways, don't lead away)
        const owned = S.owner[b] === p;
        const sc = dist(bi, bj, E.x, E.y) + k * 0.8 - (owned ? 20 : 0) + (gain < 2 ? 1000 : 0); // (a sideways one only when nothing brings us closer)
        if (sc < bs && canPlace(p, 'viaduct', ai, aj, true).ok) { bs = sc; best = { a, b, owned }; }
        break; // the first clifftop across is the one
      }
    }
  }
  return best;
}

/**
 * Chokepoint maps (not on Easy, unless it's a Turtle): once the mouth of a channel through the crags on our side is
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
    if (aiFlood(p, t, seen, bottom)) return t;
  }
  return -1;
}

/**
 * Flood out from tile `from` over the ground player p's bots can walk (stepping as they do, and through the
 * buildings that let them pass: their own Gates and Outposts), marking it 2 in `seen`; tiles already set there are
 * closed. True if the flood gets across the middle line of the map (to the far half from a base in the `bottom` half).
 */
function aiFlood(p, from, seen, bottom) {
  const W = S.W, N = W * S.H, half = Math.floor(S.H / 2), q = [from];
  let across = false;
  seen[from] = 2;
  for (let h = 0; h < q.length; h++) {
    const a = q[h], i = a % W, j = (a / W) | 0;
    if (bottom ? j < half : j >= half) across = true;
    for (const b of [i > 0 ? a - 1 : -1, i < W - 1 ? a + 1 : -1, a - W, a + W]) {
      if (b < 0 || b >= N || seen[b] || !walkable(b) || !canStep(a, b) || (S.bAt[b] && !passTile(b, p))) continue;
      seen[b] = 2;
      q.push(b);
    }
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
    if (s > bs) { bs = s; best = c; }
  }
  if (best) fireNukeAt(silo, best.x, best.y);
}

/**
 * The army the AI aims for: its starting warbots until AI_ARMY_FROM seconds in, then about one
 * more a minute (scaled by difficulty), up to AI_ARMY_MAX.
 */
const AI_ARMY_FROM = 240, AI_ARMY_MAX = 30, AI_DEFENCE_AT = 300;
const AI_ALL_IN = 1680; // from 28 minutes a rival holds no home guard back from its attacks (unless its base is threatened)
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
  // Massing for a march (P.massFor, see the attack rules): that many, the home guard and one for each fort besides.
  const P = p !== undefined ? S.players[p] : null, mass = P && P.massFor && S.time <= P.massFor.until ? P.massFor.need + (P.homeGuard || 1) + extra : 0;
  return Math.max(Math.min(cap, START_WARBOTS + 1 + Math.floor((Math.max(0, S.time - from) / 60) * rate)), Math.min(mass, cap + 10));
}

/**
 * What stands guard round building b besides its garrison: 3 for each of its owner's turrets within 6
 * tiles (and the like for its other guns), the garrisons of its owner's forts near enough to come to its help,
 * plus its owner's warbots out in the field within 7 (on a rally flag, say).
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
    // The forts round it answer too (garrisonDefense): every armed warbot of one within 7 tiles, whose guards come
    // out at once, and half the warbots a fort within AREA_DEFENCE can spare for a building under attack.
    else if (BDEFS[e.type].mil && !BDEFS[e.type].bunker) n += d2 <= 49 ? armedIn(e) : d2 <= AREA_DEFENCE * AREA_DEFENCE ? Math.max(0, armedIn(e) - 1) / 2 : 0;
  }
  n = Math.ceil(n);
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
    const r = rallyById(P.raid.id), band = r ? rallyMembers(P.raid.id) : [];
    // The raid's clock starts when the first raider reaches the flag (P.raid.at; it used to start as they set off, and
    // most bands were called home before they got there), and the band comes home early when the enemy warbots
    // within 5 tiles of it outnumber it.
    if (r && !P.raid.at && band.some((u) => dist2(u.x, u.y, r.x, r.y) <= 9)) { P.raid.at = S.time; P.raid.until = S.time + RAID_TIME; }
    let foes = 0;
    if (band.length) {
      const cx = band.reduce((a, u) => a + u.x, 0) / band.length, cy = band.reduce((a, u) => a + u.y, 0) / band.length;
      for (const u of S.bots) if (!u.dead && !u.inside && u.owner !== p && u.owner >= 0 && u.type === 'warbot' && dist2(u.x, u.y, cx, cy) <= 25) foes++;
    }
    if (!r || S.time > P.raid.until || !band.length || foes > band.length) {
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
  if (rallyAvailable(p, i, j) < size + (st.raidKeep ?? 2)) return; // keep enough warbots at home (a Raider keeps none back: its band of three goes as soon as it has three)
  const { sent, rally } = sendToRally(p, i, j, size);
  // (Until they arrive the raid has a walking allowance: two seconds a tile from home, and half a minute.)
  const L = getE(P.lander);
  if (sent) { rally.raid = true; P.raid = { id: rally.id, at: 0, until: S.time + RAID_TIME + 30 + 2 * (L ? dist(i, j, L.x, L.y) : 30) }; }
}

/**
 * Rocket Trucks (Versus). Loaded ones not already busy go after the enemy defences round the building we last
 * attacked (or, with no attack on, the nearest enemy defence or fort within 24 tiles): turrets, Bunkers, the
 * Keep, Mortars and Disruptors first. And an enemy Rocket Truck shelling our buildings gets warbots sent after
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

/** What a building is worth to its owner, for a Normal or Hard rival choosing what to attack or fire a Missile at. */
const AI_HURT = { nukesilo: 12, foundry: 10, armory: 9, munitions: 9, silo: 9, reactor: 9, refinery: 7, charger: 6, fab: 6, airfield: 6, smelter: 5, farm: 4, generator: 4 };

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
  if (!bombers.length && !(field.yard && field.yard.bomber > 0)) orderAtYard(field, 'bomber', 1);
  if (S.time - (P.lastStrike || -999) < AI_BOMB_GAP) return;
  const u = bombers.find((v) => !v.mission && !v.flight && !(v.rearmUntil > S.time) && planeBase(v) && v.inside === planeBase(v).id);
  if (!u) return;
  const flak = S.buildings.filter((b) => !b.dead && b.built && b.owner !== p && BDEFS[b.type].flak);
  const covered = (x, y) => flak.some((f) => dist2(f.x + 0.5, f.y + 0.5, x, y) <= 49);
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

function aiSiege(p) {
  const P = S.players[p];
  if (S.tick % 30 !== (p * 7) % 30) return;
  const trucks = S.bots.filter((u) => !u.dead && u.owner === p && BOTS[u.type].siege);
  const at = P.siegeAt && S.time < P.siegeAt.until ? P.siegeAt : null;
  // With no push of its own on, its trucks fire only from beside its forts (within 3 tiles of one, out of every
  // enemy gun's reach, no enemy warbot within 7): at the enemy building in reach of such a spot that is worth most:
  // a Mortar Pit or a Silo, an Outpost pushed up against its land, guns, and anything with enemy warbots or Rocket
  // Trucks standing by it (rockets hurt what stands round what they hit). A truck not at its spot is parked there
  // first. (They used to drive at the best target within 24 tiles, through the besiegers, and were lost in two minutes.)
  const forts = at ? [] : S.buildings.filter((b) => !b.dead && b.built && b.owner === p && BDEFS[b.type].mil && !BDEFS[b.type].bunker);
  const worth = (b) => {
    const def = BDEFS[b.type];
    let v = b.type === 'mortar' || b.type === 'silo' ? 10 : def.mil ? 8 : b.type === 'turret' ? 7 : b.type === 'munitions' ? 6 : def.war && !def.barrier ? 5 : def.barrier ? 0 : 2;
    for (const e of S.bots) if (!e.dead && !e.inside && e.owner === b.owner && (e.type === 'warbot' || BOTS[e.type].siege) && dist2(e.x, e.y, b.x + 0.5, b.y + 0.5) <= 9) v += BOTS[e.type].siege ? 2 : 0.5;
    return v;
  };
  for (const u of trucks) {
    if (u.salvo || (u.task && !u.task.auto && u.task.type !== 'park') || !(u.rockets ?? ROCKET.salvo)) continue;
    const z = S.zone[tIdx(Math.floor(u.x), Math.floor(u.y))];
    if (!at) {
      let best = null, spot = null, bs = 0;
      for (const b of S.buildings) {
        if (!rocketTarget(u, b) || !b.built || S.zone[tIdx(b.x, b.y)] !== z || (BDEFS[b.type].mil && b.armor <= missileFloor(b) + 1)) continue;
        const f = forts.find((q) => dist2(q.x, q.y, b.x, b.y) <= (ROCKET.range + 2) * (ROCKET.range + 2));
        if (!f) continue;
        const v = worth(b) - dist(u.x, u.y, b.x, b.y) * 0.05;
        if (v <= bs) continue;
        // A tile by that fort to fire from: in reach of the target, safe, the nearest to the truck.
        let sp = null, sd = Infinity;
        for (let dj = -3; dj <= 3; dj++) for (let di = -3; di <= 3; di++) {
          const i = f.x + di, j = f.y + dj;
          if (!inMap(i, j) || (!di && !dj) || !walkable(tIdx(i, j)) || S.bAt[tIdx(i, j)] || S.zone[tIdx(i, j)] !== z || underGuns(p, tIdx(i, j))) continue;
          const d = dist(i + 0.5, j + 0.5, b.x + 0.5, b.y + 0.5);
          if (d > ROCKET.range - 0.5 || d < ROCKET.min + 0.5 || intruderNear(p, i + 0.5, j + 0.5, 7)) continue;
          const du = dist2(i + 0.5, j + 0.5, u.x, u.y);
          if (du < sd) { sd = du; sp = { i, j }; }
        }
        if (sp) { bs = v; best = b; spot = sp; }
      }
      if (!best) continue;
      if (dist2(u.x, u.y, spot.i + 0.5, spot.j + 0.5) <= 1.5) orderBombard(p, [u.id], best);
      else if (!(u.task && u.task.type === 'park' && u.task.i === spot.i && u.task.j === spot.j)) orderPark(p, [u.id], spot.i, spot.j);
      continue;
    }
    if (u.task && u.task.type === 'park') continue;
    let best = null, bs = -Infinity;
    for (const b of S.buildings) {
      if (!rocketTarget(u, b) || !b.built || S.zone[tIdx(b.x, b.y)] !== z) continue;
      const def = BDEFS[b.type], d = dist(u.x, u.y, b.x, b.y);
      if (d > 24) continue;
      let sc = (def.war && !def.barrier ? 8 : 0) + (def.mil ? 4 : 0) - d * 0.2;
      sc += dist(b.x, b.y, at.x, at.y) <= 8 ? 10 : -6;
      if (sc > bs) { bs = sc; best = b; }
    }
    if (best) orderBombard(p, [u.id], best);
  }
  // Enemy rocket trucks shelling us: hunt them down.
  P.truckHunt = (P.truckHunt || []).filter((h) => { const r = rallyById(h.rally), e = getE(h.truck); if (r && (S.time >= h.until || !e || e.dead)) recallRally(h.rally); return r && S.time < h.until && e && !e.dead; });
  for (const e of S.bots) {
    if (e.dead || e.owner === p || e.owner < 0 || !BOTS[e.type].siege || !(e.salvo || (e.task && e.task.type === 'bombard'))) continue;
    const tgt = getE(e.salvo ? e.salvo.target : e.task.target);
    if (!tgt || tgt.owner !== p || P.truckHunt.some((h) => h.truck === e.id)) continue;
    const i = Math.floor(e.x), j = Math.floor(e.y);
    if (!inMap(i, j) || !walkable(tIdx(i, j))) continue;
    // Only where it stands off its owner's land, out of every enemy gun's reach and not beside a fort with warbots
    // in it; four go, and two more for every warbot escorting it, all of them or none, without waiting to form up.
    // (Fours, then twos and ones, used to be sent after trucks parked by the enemy Command Base: none came back.)
    if (S.owner[tIdx(i, j)] === e.owner || underGuns(p, tIdx(i, j))) continue;
    if (S.buildings.some((b) => !b.dead && b.built && b.owner === e.owner && BDEFS[b.type].mil && armedIn(b) > 0 && dist2(b.x, b.y, e.x, e.y) <= 49)) continue;
    let escort = 0;
    for (const u of S.bots) if (!u.dead && !u.inside && u.owner === e.owner && u.type === 'warbot' && dist2(u.x, u.y, e.x, e.y) <= 49) escort++;
    if (rallyAvailable(p, i, j, true) < 4 + escort * 2) continue;
    const { sent, rally } = sendToRally(p, i, j, 4 + escort * 2, true, true);
    if (sent) P.truckHunt.push({ truck: e.id, rally: rally.id, until: S.time + 90 });
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
    if (r.owner === p || P.counters.some((c) => c.enemy === r.id)) continue;
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
  // and Fuel into Missiles lying in storage (more than half the rivals that built one never got a Silo up).
  const room = me.some((b) => b.type === 'silo' && b.built && (b.stock.warhead || 0) + (b.inc.warhead || 0) < BDEFS.silo.ammoCap);
  const rest = !!(site && site.type === 'silo') || !room;
  for (const b of me) if (b.type === 'munitions' && b.built && !!b.paused !== rest) setPaused(b, rest);
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
    // (No road through a rival's guns or past a danger spot, where the workers paving it would be shot one after
    // another: the building waits, and a site is given up.)
    if (route && route.some((t) => unsafeAt(p, t % S.W, (t / S.W) | 0))) {
      if (!b.built && S.time - b.born > 30) { P.avoid = (P.avoid || []).concat([{ x: b.x, y: b.y, until: S.time + 240 }]); demolish(b); }
      continue;
    }
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
  const defence = DEFENCE_TYPES.has(type), cover = gunCover(p);
  // What a gatherer at (i, j) is worth: the nodes in reach (a mine on uranium beats any ore field); with none
  // left anywhere near, a Quarry by a cliff or crag cuts Stone from it instead. null: no use there.
  const gatherWorth = (i, j, dHome) => {
    const n = reachableRes(i, j, def.radius, def.gather);
    const u = type === 'mine' && nukeOn() ? reachableRes(i, j, def.radius, R_URANIUM) : 0;
    if (n >= 2 || u) return Math.min(n, 10) * 2 - dHome * 0.35 + u * 12;
    if (!n || !def.bedrock) return null; // (canPlace wants at least one node in reach)
    const f = rockFacesIn(i, j, def.radius);
    return f < 3 ? null : Math.min(f, 10) * 0.6 - dHome * 0.35 - 8;
  };
  // (While every tile is scanned, nodes in reach are counted as the crow flies: see reachableRes. The best spots
  // for a gatherer are checked on foot afterwards.)
  _walk.quick = true;
  try {
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
      if (avoid.some((a) => dist2(a.x, a.y, i, j) < (a.r2 || 12)) || cover[j * S.W + i] || dangerAt(p, i, j)) continue; // (no site where its builders would be shot, or where one was just destroyed)
      if (!canPlace(p, type, i, j, true).ok) continue;
      let rc = Infinity;
      for (const u of roadSides(p, i, j)) rc = Math.min(rc, reach[u]);
      if (rc > budget) continue;
      const dHome = dist(i, j, lander.x, lander.y);
      const jitter = hash2(i, j, S.seed + p) * 0.8;
      let s, gw = 0;
      if (def.gather) {
        s = gw = gatherWorth(i, j, dHome);
        if (s === null) continue;
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
      } else if (type === 'repair' && P.repairAt && S.time < P.repairAt.until) {
        s = -Math.abs(dist(i, j, P.repairAt.x, P.repairAt.y) - 3) * 1.5 + dist(i, j, ex, ey) * 0.1; // three tiles from the fort, on its far side from the enemy
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
        // (Against a parked army: 7 to 10 tiles from it, so that it is in reach and the builder isn't.)
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
          if (BDEFS[b.type].barrier || ['turret', 'bunker', 'mortar', 'flak', 'disruptor'].includes(b.type)) cover++;
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
      cands.push({ x: i, y: j, s, gw, dHome });
    }
  }
  } finally { _walk.quick = false; }
  // Only the best few spots get the (costly) checks that a building won't block a pass and that
  // a road can reach it.
  cands.sort((a, b) => b.s - a.s);
  const risky = cover.some((v) => v > 0) || (P.danger || []).some((d) => d.until > S.time);
  if (def.gather) {
    // A gatherer's best spots are walked: groves on a clifftop two tiles off can be fifty tiles away on foot, and
    // a Harvester below them cut one Fiber every other minute. Best first, each scored again with what it can
    // really reach, until no spot left could beat the best found (a walked score is never higher).
    let best = null;
    for (let k = 0; k < Math.min(cands.length, 120) && !(best && cands[k].s <= best.s); k++) {
      const c = cands[k], w = gatherWorth(c.x, c.y, c.dHome);
      if (w === null || (best && c.s - c.gw + w <= best.s) || wouldBlock(tIdx(c.x, c.y)) || (risky && !aiRoadSafe(p, c.x, c.y))) continue;
      best = { x: c.x, y: c.y, s: c.s - c.gw + w };
    }
    return best;
  }
  for (let k = 0; k < Math.min(cands.length, 12); k++) {
    if (!wouldBlock(tIdx(cands[k].x, cands[k].y)) && !(risky && !aiRoadSafe(p, cands[k].x, cands[k].y))) return cands[k];
  }
  return null;
}

/**
 * Would the road that links a building at (x, y) to storage keep clear of unsafe ground (unsafeAt)? Asked of the
 * few best spots only, and only while there is unsafe ground about: a site whose road had to cross a rival's guns
 * was given up half a minute later, and another put down beside it.
 */
function aiRoadSafe(p, x, y) {
  const g = roadGoals(p, null), comp = ownNet(p);
  const res = roadSearch(p, roadSides(p, x, y), (t) => g.nets.has(comp[t]) || g.next[t]);
  for (let k = res.end; k >= 0; k = res.prev[k]) if (!roadLike(k) && unsafeAt(p, k % S.W, (k / S.W) | 0)) return false;
  return true;
}

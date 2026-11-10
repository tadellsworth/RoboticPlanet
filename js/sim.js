'use strict';
/*
 * Terrafall — simulation: logistics dispatcher, worker and warbot behaviour, production, combat.
 * simStep(dt) advances the world by one fixed step.
 */

function simStep(dt) {
  if (S.unlimited && S.tick % 30 === 0) unlimitedTopUp(0);
  if (S.winner >= 0) return;
  S.time += dt;
  S.tick++;
  if (S.tick % 30 === 0) growStalks(30 * dt);
  if (S.tick % 30 === 7) settlePlans();
  if (S.tick % 30 === 11) updatePipes();
  if (S.tick % 30 === 15) for (let p = 0; p < S.players.length; p++) landerSalvage(p, 30 * dt);
  if (S.tick % 30 === 22) updateEvac();
  if (S.tick % 60 === 33 && S.decals && S.decals.length) S.decals = S.decals.filter((d) => S.time - d.t0 < d.life); // old ground marks fade away
  // Each player's bots are given work every 8 ticks, the players spread over those ticks.
  for (let p = 0, n = S.players.length; p < n; p++) if (S.tick % 8 === Math.floor((p * 8) / n) && !S.players[p].out && !(S.wildlife && p === WILD_OWNER)) dispatch(p);
  for (let k = 0; k < S.buildings.length; k++) {
    const b = S.buildings[k];
    if (!b.dead) updateBuilding(b, dt);
  }
  countCharging();
  updateLights(dt);
  countTraffic();
  for (let k = 0; k < S.bots.length; k++) {
    const u = S.bots[k];
    if (u.dead) continue;
    if (u.type === 'warbot') updateWarbot(u, dt); else if (BOTS[u.type].wild) updateCritter(u, dt); else if (BOTS[u.type].crawler) updateCrawler(u, dt); else updateWorker(u, dt);
  }
  if (S.missiles.length) updateMissiles(dt);
  if (S.blowing > 0) updateBlasts();
  if (S.tick % 30 === 15) cleanRallies();
  if (S.tick % 30 === 20) updateLoot();
  if (S.events) updateEvents();
  if (S.tick % 30 === 25) naniteRepair();
  for (const P of S.players) {
    if (!P.ai || P.out) continue;
    P.aiT -= dt;
    if (P.aiT <= 0) { P.aiT = DIFFICULTY[S.difficulty].think; aiThink(P.id); }
  }
  if (S.tick % 15 === 0) {
    S.buildings = S.buildings.filter((b) => !b.dead);
    S.bots = S.bots.filter((u) => !u.dead);
  }
  if (S.mode === 'colony' && !S.mission && S.tick % 90 === 0) checkMilestones();
  if (S.tick % Math.round(HIST_STEP / SIM_STEP) === 0) recordHistory();
  if (S.mission && S.tick % 30 === 0 && typeof checkMission === 'function') checkMission();
  for (const f of S.fx) f.t += dt;
  if (S.fx.length && S.tick % 6 === 0) S.fx = S.fx.filter((f) => f.t < f.life);
}

function checkMilestones() {
  const next = COLONY_MILESTONES[S.milestone];
  if (next === undefined) return;
  const share = landShare(0);
  if (share >= next) {
    S.milestone++;
    const L = getE(S.players[0].lander);
    postMsg(0, `Milestone: ${Math.round(next * 100)}% of the planet colonized!`, L ? L.x : 0, L ? L.y : 0, 'good');
    sfx('win');
  }
}

/** Planted stalk groves and energy crops grow until they are ripe (grow = 1). */
function growStalks(dt) {
  const N = S.W * S.H;
  for (let t = 0; t < N; t++) {
    const r = S.res[t];
    if ((r !== R_STALK && r !== R_CROP) || S.grow[t] >= 1) continue;
    const before = Math.floor(S.grow[t] * 4);
    S.grow[t] = Math.min(1, S.grow[t] + dt / (r === R_CROP ? CROP_GROW_TIME : STALK_GROW_TIME));
    if (Math.floor(S.grow[t] * 4) !== before) S.dirtyTiles.push(t);
  }
}

/* ------------------------------------------------------------------ queries */

function storeAccepts(b) { return b.built && !b.dead && BDEFS[b.type].store; }

function nearestStoreTo(owner, x, y, except) {
  let best = null, bd = Infinity;
  for (const b of S.buildings) {
    if (b === except || b.dead || b.owner !== owner || !storeAccepts(b) || evacuated(b)) continue;
    const d = dist2(b.x + 0.5, b.y + 0.5, x, y);
    if (d < bd) { bd = d; best = b; }
  }
  return best;
}

/** Building priority set by the player: high-priority buildings get workers and goods first. */
function prioRank(b) { return b.prio === 'high' ? 0 : b.prio === 'low' ? 2 : 1; }

/** Does storage building b take in good g? (Players can switch goods off or set it to empty out.) */
function storeTakes(b, g) {
  return storeAccepts(b) && b.smode !== 'empty' && !(b.reject && b.reject[g]);
}

/**
 * Where should a unit of good g go? Storage set to "fill first" wins, then the nearest storage
 * that takes the good. `except` is skipped (used when emptying a store out); with `from` set, only
 * storage linked to that building by road counts.
 */
function storeFor(owner, g, x, y, except, from) {
  let best = null, bd = Infinity;
  for (const b of S.buildings) {
    if (b.dead || b.owner !== owner || b === except || !storeTakes(b, g)) continue;
    if (from && !roadLinked(b, from)) continue;
    const d = dist2(b.x + 0.5, b.y + 0.5, x, y) - (b.smode === 'fill' ? 1e6 : 0);
    if (d < bd) { bd = d; best = b; }
  }
  return best;
}

/** How much of good g player p has: storage, finished goods waiting in buildings, and goods on the way to storage. */
function goodTotal(p, g) {
  let n = 0;
  for (const b of S.buildings) {
    if (b.dead || b.owner !== p || !b.built) continue;
    const def = BDEFS[b.type];
    if (b.stock[g] && (def.store || (def.out && def.out[g]))) n += b.stock[g];
    else if (b.loot && b.loot[g]) n += Math.min(b.loot[g], b.stock[g] || 0);
  }
  for (const u of S.bots) {
    if (u.dead || u.owner !== p || u.carry !== g || !u.task || u.task.type !== 'haul') continue;
    const dst = getE(u.task.dst);
    if (dst && BDEFS[dst.type].store) n += u.carryN || 1;
  }
  return n;
}

/** The good a production building makes (its stock limit counts this), or null. */
function limitGood(b) {
  const def = BDEFS[b.type];
  return def.make && !def.bots ? Object.keys(def.make)[0] : null;
}

/** When a production building stops: its own setting, else its type's default (Infinity = never). */
function stockLimit(b) {
  if (!limitGood(b)) return Infinity;
  if (b.limit === undefined || b.limit === null) return BDEFS[b.type].limit ?? Infinity;
  return b.limit < 0 ? Infinity : b.limit;
}

/** Has the player as much of this building's product as its stock limit asks for? */
function atLimit(b) {
  const lim = stockLimit(b);
  return lim < Infinity && goodTotal(b.owner, limitGood(b)) >= lim;
}

function needsOf(b) {
  const def = BDEFS[b.type], out = [];
  if (!b.built) {
    if (storeFunded(b)) return out; // paid straight from storage (settlePlans), never hauled
    const cost = siteCost(b);
    for (const g in cost) out.push([g, cost[g] - (b.stock[g] || 0) - (b.inc[g] || 0)]);
  } else if (b.paused) {
    return out;
  } else if (def.bots && b.mode === 'off' && !hasOrders(b)) {
    return out; // a stopped Foundry doesn't stockpile parts
  } else if (def.inp) {
    if (atLimit(b)) return out; // stopped at its stock limit: no more inputs for now
    for (const g in def.inp) out.push([g, INPUT_CAP - (b.stock[g] || 0) - (b.inc[g] || 0)]);
  } else if (def.ammo) {
    out.push([def.ammo, (def.ammoCap || AMMO_CAP) - (b.stock[def.ammo] || 0) - (b.inc[def.ammo] || 0)]);
  } else if (def.fuelCap) {
    out.push(['fuel', def.fuelCap - (b.stock.fuel || 0) - (b.inc.fuel || 0)]);
  } else if (def.repair) {
    out.push(['alloy', def.alloyCap - (b.stock.alloy || 0) - (b.inc.alloy || 0)]);
  } else if (def.nukeSilo) {
    // The parts for one nuclear missile, until it's built.
    if (!b.armed) for (const g in NUKE.parts) out.push([g, NUKE.parts[g] - (b.stock[g] || 0) - (b.inc[g] || 0)]);
  } else if (def.roadworks) {
    out.push(['asphalt', 3 - (b.stock.asphalt || 0) - (b.inc.asphalt || 0)]);
  } else if (def.store && b.keep && b.smode !== 'empty') {
    // A Depot's supply orders: keep this much of each good here (goods already promised to someone don't count).
    for (const g in b.keep) out.push([g, b.keep[g] - ((b.stock[g] || 0) - (b.res[g] || 0)) - (b.inc[g] || 0), true]);
  }
  // Garrisons keep Ammo for their warbots (Versus only): an Outpost a full reload (2) for each warbot
  // stationed there (at least 2), up to its ammoStock, so empty Outposts don't tie up Alloy.
  if (def.ammoStock && b.built && warOn()) {
    const want = def.store ? def.ammoStock : Math.min(def.ammoStock, Math.max(2, 2 * (b.garrison.length + (b.garInc || 0))));
    out.push(['ammo', want - (b.stock.ammo || 0) - (b.inc.ammo || 0)]);
  }
  return out;
}

function supplyOf(b, g) {
  if (!b.built || b.dead) return 0;
  const def = BDEFS[b.type];
  if (def.store || (def.out && def.out[g])) return (b.stock[g] || 0) - (b.res[g] || 0);
  if (b.loot && b.loot[g]) return Math.max(0, Math.min(b.loot[g], b.stock[g] || 0) - (b.res[g] || 0)); // loot warbots left here
  return 0;
}

/** What b can spare of g to fill another Depot's supply order: never dipping into its own order. */
function keepSupply(b, g) {
  return Math.max(0, supplyOf(b, g) - ((b.keep && b.keep[g]) || 0));
}

/** Does building b use good g (as an input, ammo, fuel, repairs or construction)? */
function usesGood(b, g) {
  const def = BDEFS[b.type];
  if (!b.built) return (siteCost(b)[g] || 0) > (b.stock[g] || 0);
  return !!((def.inp && def.inp[g]) || def.ammo === g || (def.fuelCap && g === 'fuel') || (def.repair && g === 'alloy') ||
    (def.roadworks && g === 'asphalt') || (def.ammoStock && g === 'ammo') || (def.nukeSilo && NUKE.parts[g]) || (def.bots && (g === 'alloy' || g === 'chip')));
}

/**
 * Are two buildings a long run apart (TRUCK_MIN_DIST or more)? Measured across plus down, as roads
 * follow the grid: a road between them is never shorter than that.
 */
function farApart(a, b) { return Math.abs(a.x - b.x) + Math.abs(a.y - b.y) >= TRUCK_MIN_DIST; }

/** Does player p have a Road Train that can drive to building b? */
function roadTrainFor(p, b) {
  for (const v of S.bots) if (!v.dead && v.owner === p && BOTS[v.type].train && botLinked(v, b)) return true;
  return false;
}

/**
 * A truck or Road Train that has just delivered to far storage takes home what's waiting to go there
 * (the trunk-run goods: spare, and used by nothing nearer), rather than driving back empty. True if it
 * took a load.
 */
function backhaul(u, R) {
  const hub = getE(S.players[u.owner].lander);
  if (!hub || hub.dead || hub === R || hub.owner !== u.owner || !farApart(R, hub) || !truckLinked(R, hub)) return false;
  let best = null, bs = TRUCK_MIN_LOAD - 1;
  for (const g of GOODS) {
    if (isLiquid(g) !== !!BOTS[u.type].tanker) continue; // a Tanker takes home Crude or Fuel, a truck anything else
    const spare = keepSupply(R, g) - EXPORT_RESERVE;
    if (spare <= bs || !storeTakes(hub, g)) continue;
    if (S.buildings.some((c) => !c.dead && c.owner === u.owner && c !== R && !BDEFS[c.type].store && usesGood(c, g) && dist2(c.x, c.y, R.x, R.y) < dist2(c.x, c.y, hub.x, hub.y))) continue;
    bs = spare; best = g;
  }
  if (!best) return false;
  assignHaul(u, R, hub, best, Math.max(1, Math.min(bs, carryOf(u, best))));
  return !!u.task;
}

/**
 * Trunk runs (see TRUCK_MIN_DIST): every store at least TRUCK_MIN_DIST from the Command Base sends home
 * its spare goods (beyond its own supply orders and EXPORT_RESERVE) that no building nearer to it than
 * to the Command Base uses, a load at a time: TRAIN_MIN_LOAD or more by Road Train, otherwise
 * TRUCK_MIN_LOAD or more by Freight Truck.
 */
function trunkRuns(p, blds, take, canCarry, vans, trains) {
  const hub = getE(S.players[p].lander);
  if (!hub || hub.dead || hub.owner !== p) return;
  const far2 = TRUCK_MIN_DIST * TRUCK_MIN_DIST;
  for (const R of blds) {
    if (R === hub || !storeAccepts(R) || !farApart(R, hub)) continue;
    // A Rail Station sends home by train, to the station on its track nearest the Command Base.
    let home = null;
    if (trains && BDEFS[R.type].station) {
      let hd = dist2(R.x, R.y, hub.x, hub.y) - far2;
      for (const s of blds) if (s !== R && BDEFS[s.type].station && s.built && railLinked(R, s)) { const d = dist2(s.x, s.y, hub.x, hub.y); if (d < hd) { hd = d; home = s; } }
    }
    const byRoad = truckLinked(R, hub);
    if (!home && !byRoad) continue;
    for (const g of GOODS) {
      const spare = keepSupply(R, g) - EXPORT_RESERVE;
      if (spare < TRUCK_MIN_LOAD || !storeTakes(hub, g)) continue;
      if (blds.some((c) => c !== R && !BDEFS[c.type].store && usesGood(c, g) && dist2(c.x, c.y, R.x, R.y) < dist2(c.x, c.y, hub.x, hub.y))) continue;
      const liq = isLiquid(g); // Crude and Fuel go home by Tanker only
      if (home && !liq && spare >= RAIL_MIN_LOAD && storeTakes(home, g)) {
        const tu = take(R.x, R.y, 'rail', R);
        if (tu) { assignHaul(tu, R, home, g, canCarry(tu, spare)); continue; }
      }
      if (!byRoad) continue;
      let u = !liq && spare >= TRAIN_MIN_LOAD ? take(R.x, R.y, 'train', R) : null;
      // A Road Train that can get here takes the trunk runs: Freight Trucks leave the load to build up
      // to a train load (they still help once it has, if the train is busy).
      if (!u && !liq && spare < TRAIN_MIN_LOAD && roadTrainFor(p, R)) continue;
      if (!u) u = take(R.x, R.y, 'truck', R, g);
      if (!u && !vans && !liq) u = take(R.x, R.y, 'train', R); // no trucks: a Road Train takes the smaller loads too
      if (!u) continue;
      assignHaul(u, R, hub, g, canCarry(u, spare, g));
    }
  }
}

function botCount(owner) {
  let n = 0;
  for (const u of S.bots) if (!u.dead && u.owner === owner) n++;
  return n;
}

/** A civilian bot (any type but warbot) with nothing to do and enough charge for a job. */
function isIdleWorker(u) {
  if (u.type === 'warbot' || u.dead || u.carry || (u.task && u.task.type !== 'home')) return false;
  // A worker that is charging finishes first; one that is running low goes to charge before new jobs,
  // unless there's nowhere to charge: then it keeps working (slowly), or no one would bring the Fuel.
  return (u.bat ?? 100) >= (insideCharger(u) ? 90 : BATTERY.low) || !canTopUp(u);
}

/* ------------------------------------------------------------------ batteries */

/** Emergency mode: a flat battery halves speed and work rate. */
/** A flat bot drops its job to recharge, but only if a Charging Station somewhere can charge it. */
function mustRecharge(u) { return (u.bat ?? 100) < BATTERY.critical && canTopUp(u); }

/** Is there anywhere bot u could top up: a Charging Station with Fuel, or (a truck) Fuel in storage? */
function canTopUp(u) { const P = S.players[u.owner]; return BOTS[u.type].truck ? P.canRefuel !== false : !!P.canCharge; }

function batFactor(u) { return (u.bat ?? 100) < BATTERY.critical ? BATTERY.slow : 1; }

function insideCharger(u) {
  if (BOTS[u.type].truck) return false; // trucks fill up with Fuel instead
  const b = u.inside ? getE(u.inside) : null;
  return !!(b && b.built && BDEFS[b.type].charger && !chargerDry(b));
}

/** A Charging Station with no Fuel left can't charge anyone. */
function chargerDry(b) {
  const ch = BDEFS[b.type].charger;
  return !!(ch && ch.fuel && b.built && (b.energy || 0) < 0.5 && !(b.stock.fuel > 0));
}

/** How many bots are charging in each charger this tick (they share its slots). */
function countCharging() {
  for (const b of S.buildings) if (BDEFS[b.type].charger) b.charging = 0;
  for (const u of S.bots) {
    if (u.dead || !u.inside || u.type === 'warbot' || BOTS[u.type].truck || (u.bat ?? 100) >= 100) continue;
    const b = getE(u.inside);
    if (b && BDEFS[b.type].charger) b.charging++;
  }
}

/** Nearest charger the bot can walk to, avoiding ones that are already crowded. */
function findCharger(u) {
  let best = null, bs = Infinity;
  const zone = S.zone[tIdx(Math.floor(u.x), Math.floor(u.y))];
  for (const b of S.buildings) {
    if (b.dead || b.owner !== u.owner || !b.built) continue;
    const ch = BDEFS[b.type].charger;
    if (!ch || S.zone[tIdx(b.x, b.y)] !== zone || chargerDry(b) || evacuated(b)) continue;
    if (roadBound(u) && !botLinked(u, b)) continue;
    const s = dist(b.x + 0.5, b.y + 0.5, u.x, u.y) + Math.max(0, (b.charging || 0) - ch.slots) * 4;
    if (s < bs) { bs = s; best = b; }
  }
  return best;
}

/**
 * A truck low on Fuel (see TRUCK_BURN) fills up: at the nearest storage or Charging Station with Fuel
 * that it can drive to. False if there's none.
 */
function findFuel(u) {
  let best = null, bd = Infinity;
  for (const b of S.buildings) {
    if (b.dead || b.owner !== u.owner || !b.built || evacuated(b)) continue;
    const def = BDEFS[b.type];
    if (!(def.store || def.charger) || ((b.stock.fuel || 0) - (b.res.fuel || 0)) < 1) continue;
    if (!botLinked(u, b)) continue;
    const d = dist2(b.x + 0.5, b.y + 0.5, u.x, u.y);
    if (d < bd) { bd = d; best = b; }
  }
  return best;
}

/** Fill truck u's tank from building b's Fuel (one Fuel, a full tank). */
function refuel(u, b) {
  if (!b || ((b.stock.fuel || 0) - (b.res.fuel || 0)) < 1) return false;
  bump(b.stock, 'fuel', -1);
  usedGood(u.owner, 'fuel', 1);
  u.bat = 100;
  return true;
}

function goRefuel(u) {
  // Parked where there's Fuel: fill up on the spot.
  if (u.inside && refuel(u, getE(u.inside))) return true;
  const c = findFuel(u);
  if (!c || !goTo(u, c.x, c.y)) {
    const P = S.players[u.owner];
    if (S.time - (P.lastTruckFuelMsg || -99) > 90) {
      P.lastTruckFuelMsg = S.time;
      postMsg(u.owner, 'Your trucks are running on empty: there\'s no Fuel in storage they can reach. They crawl at half speed until a Tanker brings some.', Math.floor(u.x), Math.floor(u.y), 'warn');
    }
    return false;
  }
  u.task = { type: 'refuel', bld: c.id };
  return true;
}

function goCharge(u) {
  if (BOTS[u.type].truck) return goRefuel(u);
  const c = findCharger(u);
  if (!c || !goTo(u, c.x, c.y)) {
    const P = S.players[u.owner];
    if (S.time - (P.lastChargeMsg || -99) > 90) {
      P.lastChargeMsg = S.time;
      postMsg(u.owner, 'Bots are running flat with no charger they can reach. Build a Charging Station nearby.', Math.floor(u.x), Math.floor(u.y), 'warn');
    }
    return false;
  }
  u.task = { type: 'charge', bld: c.id };
  return true;
}

function workerBattery(u, dt) {
  if (BOTS[u.type].rail) { u.bat = 100; return; } // trains run off the track's power
  if (u.bat === undefined) u.bat = 100;
  // Trucks burn Fuel as they drive (see TRUCK_BURN); they fill up rather than charge.
  if (BOTS[u.type].truck) { if (u.moved && !u.inside) u.bat = Math.max(0, u.bat - (BOTS[u.type].train ? TRAIN_BURN : TRUCK_BURN) * dt * drainMul(u)); return; }
  if (u.inside) {
    const b = getE(u.inside);
    const ch = b && b.built && BDEFS[b.type].charger;
    if (ch) {
      if (u.bat < 100) {
        let gain = Math.min(100 - u.bat, ch.rate * (tech(b.owner, 'cells') || tech(b.owner, 'charge') ? 1.5 : 1) * Math.min(1, ch.slots / Math.max(1, b.charging)) * dt);
        if (ch.fuel) {
          // Charging Stations burn a Fuel whenever their energy runs low.
          if ((b.energy || 0) < gain && (b.stock.fuel || 0) > 0) { bump(b.stock, 'fuel', -1); usedGood(b.owner, 'fuel', 1); b.energy = (b.energy || 0) + FUEL_ENERGY; }
          gain = Math.min(gain, b.energy || 0);
          b.energy = (b.energy || 0) - gain;
        }
        u.bat += gain;
      }
    } else if (b && b.working && u.task && u.task.type === 'staff') {
      u.bat = Math.max(0, u.bat - BATTERY.workerInside * dt);
    }
    return;
  }
  const d = (u.moved ? BATTERY.workerMove : 0) + (u.busy ? BATTERY.workerWork : 0);
  if (d) u.bat = Math.max(0, u.bat - d * dt * drainMul(u));
}

/** Goods the player can see: everything in storage plus finished goods waiting in buildings. */
function playerGoods(p) {
  const tot = {};
  for (const g of GOODS) tot[g] = 0;
  for (const b of S.buildings) {
    if (b.dead || b.owner !== p || !b.built) continue;
    const def = BDEFS[b.type];
    for (const g in b.stock) if (def.store || (def.out && def.out[g])) tot[g] += b.stock[g];
    if (b.loot) for (const g in b.loot) if (!def.store && !(def.out && def.out[g])) tot[g] += Math.min(b.loot[g], b.stock[g] || 0);
  }
  return tot;
}

/** Nearest enemy bot within range (warbots first with preferWar). With ownLand, civilian bots only count inside owner's land. */
function nearestEnemyBot(owner, x, y, range, preferWar, ownLand) {
  let best = null, bd = range * range, bestWar = null, bwd = range * range;
  for (const u of S.bots) {
    if (u.dead || u.owner === owner || u.inside) continue;
    if (ownLand && u.type !== 'warbot' && S.owner[tIdx(Math.floor(u.x), Math.floor(u.y))] !== owner) continue;
    const d = dist2(u.x, u.y, x, y);
    if (d <= bd) { bd = d; best = u; }
    if (preferWar && (u.type === 'warbot' || BOTS[u.type].wild) && d <= bwd) { bwd = d; bestWar = u; }
  }
  return bestWar || best;
}

/* ------------------------------------------------------------------ movement */

/** Is bot u out on a gathering, farming or paving trip from the building it runs? (no off-road slowdown) */
function harvestTrip(u) { return !!(u.task && u.task.type === 'staff' && u.task.trip); }

/** A hauler that is off the road (and not in a building), e.g. after its road was removed. */
function haulerStranded(u) {
  if (u.inside) return false;
  const t = tIdx(Math.floor(u.x), Math.floor(u.y));
  return !S.road[t] && !S.bAt[t];
}

/**
 * How bot u plans routes: haulers stick to roads; others pay more for off-road tiles. Only its own
 * Gates let a bot through, and an armed warbot will break through enemy Walls and Gates.
 */
function routeOpts(u) {
  const bt = BOTS[u.type];
  const o = { who: u.owner, breach: u.type === 'warbot' && (u.ammo ?? WARBOT_AMMO) > 0, noRope: !!(bt.truck || bt.wild || bt.crawler) };
  if (bt.roadOnly && !haulerStranded(u)) o.roadOnly = true;
  else if ((bt.offroad || bt.roadOnly) && !harvestTrip(u)) o.offMul = 1 / OFFROAD_SLOW;
  return o;
}

/**
 * Is the next tile of u's route blocked by a building (one put up since the route was planned, or
 * an enemy Wall it means to break through)? The route's last tile, where it is going, never is.
 */
function blockedStep(u, t) {
  return S.bAt[t] > 0 && t !== u.path[u.path.length - 1] && !passTile(t, u.owner);
}

/**
 * A warbot at an enemy Wall or Gate in its way shoots it (like any building it attacks, one point
 * of armor a shot); when it falls the warbot walks on through the gap.
 */
function breachHit(u, b) {
  u.breach = b.id;
  u.vel = 0;
  u.face = Math.atan2(b.y + 0.5 - u.y, b.x + 0.5 - u.x);
  if (u.cd > 0 || !useAmmo(u)) return;
  u.cd = 1.0;
  u.fought = 1;
  shotFx(u.x, u.y, b.x + 0.5 + (hash2(u.id, S.tick, 3) - 0.5) * 0.6, b.y + 0.5 + (hash2(u.id, S.tick, 5) - 0.5) * 0.6, { color: PLAYER_COLORS[u.owner], structure: true });
  if (u.owner === 0 || b.owner === 0) sfx('hit');
  hitBuilding(b, (u.bat ?? 100) < BATTERY.critical ? 0.5 : 1, u.owner);
}

function goTo(u, x, y) {
  const goal = y * S.W + x;
  // Don't hammer the pathfinder with a route that just failed.
  if (u.failGoal === goal && S.time < u.failUntil) return false;
  // Freight Trains keep to the track.
  if (BOTS[u.type].rail) {
    const p = railRoute(u, x, y);
    if (!p) { u.failGoal = goal; u.failUntil = S.time + 2; return false; }
    exitBuilding(u);
    u.path = p; u.pi = 0; u.idleT = 0; u.goal = goal;
    return true;
  }
  // Halfway across a Ropeway: finish the ride first, then go on from the far station.
  if (u.ride >= 0 && u.path && u.path[u.pi] === u.ride) {
    const st = u.ride, rest = st === goal ? [] : findPath(st % S.W, (st / S.W) | 0, x, y, u.type !== 'warbot' ? u.owner : undefined, routeOpts(u));
    if (!rest) { u.failGoal = goal; u.failUntil = S.time + 2; return false; }
    u.path = [st].concat(rest); u.pi = 0; u.idleT = 0; u.goal = goal; u.breach = 0;
    return true;
  }
  // Out on a Viaduct's deck: the route starts at its nearer end (the ground below doesn't count).
  const deck = deckEnds(u);
  if (deck) {
    const e = deck[0], rest = e === goal ? [] : findPath(e % S.W, (e / S.W) | 0, x, y, u.type !== 'warbot' && !BOTS[u.type].wild ? u.owner : undefined, routeOpts(u));
    if (!rest) { u.failGoal = goal; u.failUntil = S.time + 2; return false; }
    u.path = [e].concat(rest); u.pi = 0; u.idleT = 0; u.goal = goal; u.breach = 0;
    return true;
  }
  const p = findPath(Math.floor(u.x), Math.floor(u.y), x, y, u.type !== 'warbot' && !BOTS[u.type].wild ? u.owner : undefined, routeOpts(u));
  u.breach = 0;
  if (!p) { u.failGoal = goal; u.failUntil = S.time + 2; return false; }
  // Starting on a Viaduct's abutment straight across it: keep the abutment in the route, so the
  // crossing is seen as one (see moveAlong) from the moment it leaves.
  const st = tIdx(Math.floor(u.x), Math.floor(u.y));
  if (p.length && S.bAt[st] && viaLink(st) === p[0]) p.unshift(st);
  exitBuilding(u);
  u.path = p; u.pi = 0; u.idleT = 0; u.goal = y * S.W + x;
  return true;
}

/*
 * Traffic: every tick, the bots travelling on road tiles are listed per tile (a linked list through
 * TRAFFIC.next) and counted per tile by heading (east, south, west, north). Only the entries
 * touched are cleared each tick, so this stays cheap on big maps.
 */
const TRAFFIC = { occ: null, head: null, n: 0, used: [], cells: [], bots: [], next: [] };

function heading(face) { return ((Math.round(face / (Math.PI / 2)) % 4) + 4) % 4; }

/*
 * The traffic map: for every road tile, how many bot-seconds of traffic passed over it (flow) and
 * how long bots stood still on it waiting (jam), both fading with a time constant of about a minute.
 * Kept outside the save; it rebuilds within a minute of loading.
 */
const HEAT = { n: 0, of: null, flow: null, jam: null };
const HEAT_FADE = Math.exp(-1 / 60);

function countTraffic() {
  const N = S.W * S.H;
  if (TRAFFIC.n !== N) {
    TRAFFIC.occ = new Uint8Array(N * 4); TRAFFIC.head = new Int32Array(N).fill(-1); TRAFFIC.n = N;
    TRAFFIC.used = []; TRAFFIC.cells = [];
  }
  const occ = TRAFFIC.occ, head = TRAFFIC.head;
  for (const k of TRAFFIC.used) occ[k] = 0;
  for (const t of TRAFFIC.cells) head[t] = -1;
  TRAFFIC.used.length = 0; TRAFFIC.cells.length = 0; TRAFFIC.bots.length = 0; TRAFFIC.next.length = 0;
  if (HEAT.of !== S || HEAT.n !== N) { HEAT.flow = new Float32Array(N); HEAT.jam = new Float32Array(N); HEAT.n = N; HEAT.of = S; }
  if (S.tick % 30 === 0) for (let t = 0; t < N; t++) if (HEAT.flow[t]) { HEAT.flow[t] *= HEAT_FADE; HEAT.jam[t] *= HEAT_FADE; if (HEAT.flow[t] < 0.01) HEAT.flow[t] = HEAT.jam[t] = 0; }
  for (const u of S.bots) {
    if (u.dead || u.inside || !u.path) continue;
    const t = Math.floor(u.y) * S.W + Math.floor(u.x);
    if (!S.road[t]) continue;
    if (u.wt !== t) { u.wt = t; if (S.pave[t] === 2) wearRoad(t, u); }
    HEAT.flow[t] += SIM_STEP;
    if (!u.moved) HEAT.jam[t] += SIM_STEP;
    const k = t * 4 + heading(u.face);
    if (!occ[k]) TRAFFIC.used.push(k);
    if (occ[k] < 255) occ[k]++;
    if (head[t] < 0) TRAFFIC.cells.push(t);
    TRAFFIC.next.push(head[t]);
    head[t] = TRAFFIC.bots.length;
    TRAFFIC.bots.push(u);
  }
}

/* ------------------------------------------------------------------ traffic lights */

/*
 * A traffic light on a road junction lets one axis through at a time (ph 0 = east-west green,
 * 1 = north-south green). Bots heading into the junction count as approaching (app) and, when
 * held at red, as waiting (dem); the light switches when traffic waits on the red axis, after at
 * least LIGHT_MIN_GREEN seconds, once the green axis is clear or LIGHT_MAX_GREEN has passed, with
 * LIGHT_CLEAR seconds of all-red in between.
 */
function updateLights(dt) {
  if (S.tick % 15 === 0) for (const k in S.over) if (!S.road[+k] || !isJunction(+k)) removeOverpass(+k);
  for (const k in S.lights) {
    const t = +k, L = S.lights[k];
    if (!S.road[t] || !isJunction(t)) { removeLight(t); continue; }
    const dem = L.dem || [0, 0], app = L.app || [0, 0];
    if (L.clr > 0) {
      L.clr -= dt;
      if (L.clr <= 0) { L.clr = 0; L.ph = 1 - L.ph; L.tm = 0; }
    } else {
      L.tm = (L.tm || 0) + dt;
      // Someone waits on red: switch as soon as nobody is coming on green (or after the longest green);
      // the shortest green only holds while green traffic is still coming through.
      if (dem[1 - L.ph] > 0 && (app[L.ph] === 0 || L.tm >= LIGHT_MAX_GREEN)) L.clr = LIGHT_CLEAR;
    }
    L.dem = [0, 0]; L.app = [0, 0];
  }
}

/** Put a traffic light on the junction at (i, j). Returns '' or the reason it can't. */
function placeLight(owner, i, j) {
  const t = tIdx(i, j);
  if (S.lights[t] || S.over[t] || junPlanAt(t)) return '';
  if (!S.road[t] || !isJunction(t)) return 'Traffic lights go on road junctions: a road tile with roads on three or four sides.';
  if (S.owner[t] !== owner) return 'You can only put traffic lights inside your border.';
  // Yours is planned and goes up once it's paid for (settlePlans); the computer pays up front.
  if (!S.players[owner].ai) { planJunction(owner, t, 'light'); return ''; }
  const have = playerGoods(owner);
  for (const g in LIGHT_COST) if (have[g] < LIGHT_COST[g]) return `A traffic light costs ${LIGHT_COST[g]} ${GOOD[g].name}.`;
  for (const g in LIGHT_COST) takeGood(owner, g, LIGHT_COST[g]);
  S.lights[t] = { owner, ph: 0, tm: 0, clr: 0 };
  return '';
}

/** Build an overpass on the junction at (i, j), replacing any traffic light there. Returns '' or the reason it can't. */
function placeOverpass(owner, i, j) {
  const t = tIdx(i, j);
  if (S.over[t]) return '';
  if (!S.road[t] || !isJunction(t) || crossTile(t)) return 'Overpasses go on road junctions on open ground: a road tile with roads on three or four sides.';
  if (S.owner[t] !== owner) return 'You can only build overpasses inside your border.';
  // Yours is planned (a planned light becomes a planned overpass) and goes up once it's paid for; a
  // light already standing keeps working meanwhile, and its Alloy counts toward the overpass.
  if (!S.players[owner].ai) { const P = junPlanAt(t); if (P) P.kind = 'over'; else planJunction(owner, t, 'over'); settlePlans(); return ''; }
  const have = playerGoods(owner), light = S.lights[t];
  for (const g in OVERPASS_COST) {
    const back = light && LIGHT_COST[g] ? LIGHT_COST[g] : 0;
    if ((have[g] || 0) + back < OVERPASS_COST[g]) return `An overpass costs ${costText(OVERPASS_COST)}.`;
  }
  if (light) removeLight(t);
  for (const g in OVERPASS_COST) takeGood(owner, g, OVERPASS_COST[g]);
  S.over[t] = { owner };
  markDirty(i, j);
  return '';
}

/** The traffic light or overpass planned on junction t, still waiting for its goods ({ owner, kind }), or null. */
function junPlanAt(t) { return (S.junPlan && S.junPlan[t]) || null; }

/** Plan a traffic light or overpass ('light' / 'over') on junction t: it joins the queue of plans waiting for goods. */
function planJunction(owner, t, kind) {
  S.junPlan = S.junPlan || {};
  S.junPlan[t] = { owner, kind };
  queuePlan('j', t, owner);
  settlePlans();
}

/** Call off a planned light or overpass (nothing was paid for it yet). */
function cancelJunPlan(t) { if (S.junPlan) delete S.junPlan[t]; }

/** What finishing the planned light or overpass on junction t still costs (an overpass counts the light standing there). */
function junPlanCost(t, P) {
  const full = P.kind === 'over' ? OVERPASS_COST : LIGHT_COST, out = {};
  for (const g in full) { const n = full[g] - (P.kind === 'over' && S.lights[t] ? LIGHT_COST[g] || 0 : 0); if (n > 0) out[g] = n; }
  return out;
}

/** Take an overpass down and refund it to the nearest storage. */
function removeOverpass(t) {
  const o = S.over[t];
  if (!o) return;
  delete S.over[t];
  const store = nearestStoreTo(o.owner, (t % S.W) + 0.5, ((t / S.W) | 0) + 0.5);
  if (store) for (const g in OVERPASS_COST) bump(store.stock, g, OVERPASS_COST[g]);
}

/** Take a traffic light down and refund it to the nearest storage. */
function removeLight(t) {
  const L = S.lights[t];
  if (!L) return;
  delete S.lights[t];
  const store = nearestStoreTo(L.owner, (t % S.W) + 0.5, ((t / S.W) | 0) + 0.5);
  if (store) for (const g in LIGHT_COST) bump(store.stock, g, LIGHT_COST[g]);
}

/** Is a bot crossing junction t along the other axis (0 = east-west, 1 = north-south) right now? */
function crossTraffic(t, axis) {
  const occ = TRAFFIC.occ;
  if (!occ || occ.length !== S.W * S.H * 4) return false;
  return axis === 0 ? occ[t * 4 + 1] + occ[t * 4 + 3] > 0 : occ[t * 4] + occ[t * 4 + 2] > 0;
}

/** How much oncoming traffic slows bot u on road tile `here`, heading for tile `next` (0 = free flow). */
function trafficJam(u, here, next) {
  const d = heading(u.face), opp = (d + 2) & 3, occ = TRAFFIC.occ;
  if (!occ || occ.length !== S.W * S.H * 4) return 0;
  let oncoming = occ[here * 4 + opp];
  if (next !== here && S.road[next]) oncoming += occ[next * 4 + opp];
  return TRAFFIC_ONCOMING * oncoming;
}

/**
 * How far bot u may move before it closes in on the bot ahead of it in its lane: the nearest bot on
 * the road ahead (within a tile and a bit, roughly in line) that is travelling the same way.
 * Infinity when the road ahead is clear.
 */
function queueRoom(u) {
  const head = TRAFFIC.head;
  if (!head || head.length !== S.W * S.H || u.squeezeUntil > S.time) return Infinity;
  let t0 = u.path[u.pi];
  let dx = (t0 % S.W) + 0.5 - u.x, dy = ((t0 / S.W) | 0) + 0.5 - u.y, d = Math.sqrt(dx * dx + dy * dy);
  if (d < 1e-3) {
    if (u.pi + 1 >= u.path.length) return Infinity;
    t0 = u.path[u.pi + 1];
    dx = (t0 % S.W) + 0.5 - u.x; dy = ((t0 / S.W) | 0) + 0.5 - u.y; d = Math.sqrt(dx * dx + dy * dy);
  }
  dx /= d; dy /= d;
  let room = Infinity;
  const here = Math.floor(u.y) * S.W + Math.floor(u.x);
  for (const t of [here, u.path[u.pi], u.path[u.pi + 1]]) {
    if (t === undefined || !S.road[t]) continue;
    for (let k = head[t]; k >= 0; k = TRAFFIC.next[k]) {
      const v = TRAFFIC.bots[k];
      if (v === u || v.dead || v.inside || !v.path) continue;
      const rx = v.x - u.x, ry = v.y - u.y;
      let along = rx * dx + ry * dy;
      if (along < -0.05 || along > 1.4) continue;                        // behind us, or far ahead
      if (Math.abs(rx * dy - ry * dx) > 0.35) continue;                  // off to the side
      if (Math.cos(v.face) * dx + Math.sin(v.face) * dy < 0.3) continue; // oncoming or crossing: other lane
      // Two bots on the same spot (say, both just out of the Command Base): the older one goes first.
      if (along <= 0.05) { if (v.id > u.id) continue; along = 0; }
      room = Math.min(room, along - QUEUE_GAP - (BOTS[v.type].train ? TRAIN_LEN : BOTS[v.type].truck ? 0.25 : 0));
    }
  }
  return Math.max(0, room);
}

/** Walk along the current path. Returns true once the destination is reached. */
function moveAlong(u, dt) {
  if (!u.path) return true;
  let here = Math.floor(u.y) * S.W + Math.floor(u.x);
  // The next step jumps a gap (a Viaduct or Ropeway) that has come down since the route was
  // planned: back to the end it set out from, and the order is dropped so it plans again.
  {
    const nx = u.path[u.pi], pv = u.path[u.pi - 1], W = S.W;
    if (u.pi > 0 && nx !== undefined && Math.max(Math.abs((nx % W) - (pv % W)), Math.abs(((nx / W) | 0) - ((pv / W) | 0))) > 1 &&
      viaLink(pv) !== nx && ropeLink(pv) !== nx && !(u.ride >= 0)) {
      u.x = (pv % W) + 0.5; u.y = ((pv / W) | 0) + 0.5;
      u.path = null; u.deck = null; u.vel = 0;
      cancelTask(u); u.task = null;
      return false;
    }
  }
  // Out on a Viaduct (between its abutments) a bot drives as if still on the abutment it left: on
  // road, whatever lies down below. It remembers the two ends (u.deck) until it reaches one, so
  // whatever else it's told to do meanwhile starts from the deck, not the ground below.
  if (u.pi > 0 && u.path[u.pi] !== undefined && S.bAt[u.path[u.pi - 1]] && viaLink(u.path[u.pi - 1]) === u.path[u.pi]) { here = u.path[u.pi - 1]; u.deck = [here, u.path[u.pi]]; }
  else deckEnds(u);
  const bt = BOTS[u.type];
  // A Freight Train: down the track at its own speed, braking for curves and the end of its trip; it
  // never waits for road traffic (road traffic waits for it at level crossings).
  if (bt.rail) {
    let step = driveSpeed(u, bt, bt.speed * speedMul(u) * (S.ramp[here] ? RAIL_GRADE : 1), Infinity, dt) * dt;
    u.odo = ((u.odo || 0) + step) % 1000;
    u.moved = step > 0 ? 1 : 0;
    while (step > 0 && u.pi < u.path.length) {
      const t = u.path[u.pi], tx = (t % S.W) + 0.5, ty = ((t / S.W) | 0) + 0.5, dx = tx - u.x, dy = ty - u.y, d = Math.sqrt(dx * dx + dy * dy);
      if (d > 1e-4) u.face = Math.atan2(dy, dx);
      if (d <= step) { u.x = tx; u.y = ty; step -= d; u.pi++; } else { u.x += (dx / d) * step; u.y += (dy / d) * step; step = 0; }
    }
    if (u.pi >= u.path.length) { u.path = null; u.vel = 0; u.drive = 0; return true; }
    return false;
  }
  // Riding a Ropeway: from one station straight to the other at ROPE_SPEED, whatever lies below.
  const nxt = u.path[u.pi];
  if (!(u.ride >= 0) && nxt !== undefined && nxt !== here && (ropeLink(here) === nxt || (u.pi > 0 && ropeLink(u.path[u.pi - 1]) === nxt))) u.ride = nxt;
  if (u.ride >= 0) {
    if (nxt !== u.ride) u.ride = -1;
    else {
      const tx = (nxt % S.W) + 0.5, ty = ((nxt / S.W) | 0) + 0.5, dx = tx - u.x, dy = ty - u.y, d = Math.sqrt(dx * dx + dy * dy);
      const step = ROPE_SPEED * evSpeed() * dt;
      u.moved = 1; u.vel = 0; u.drive = 0;
      if (d > 1e-4) u.face = Math.atan2(dy, dx);
      if (d <= step) { u.x = tx; u.y = ty; u.pi++; u.ride = -1; } else { u.x += (dx / d) * step; u.y += (dy / d) * step; }
      if (u.pi >= u.path.length) { u.path = null; return true; }
      return false;
    }
  }
  let speed = bt.speed;
  const r = S.road[here] || (S.bAt[here] && passTile(here) ? 1 : 0); // driving through an Outpost counts as road
  if (r) {
    const next = u.path[u.pi];
    const dx = (next % S.W) + 0.5 - u.x, dy = ((next / S.W) | 0) + 0.5 - u.y;
    const wrong = r >= 2 && dx * ROAD_DIRS[r][0] + dy * ROAD_DIRS[r][1] < -0.1;
    const deck = !S.road[here] && viaLink(here) >= 0; // a Viaduct's deck is smooth concrete: as good as fresh asphalt
    const through = !deck && !S.road[here]; // an Outpost or Gate: as good as the best road into it (throughPave)
    const pv = deck ? 2 : through ? throughPave(here) : S.pave[here];
    speed *= wrong ? ONEWAY_WRONG : (pv === 2 ? asphaltSpeed(deck || through ? 0 : S.wear[here]) : PAVE[pv || 1].speed) / (1 + trafficJam(u, here, next));
    if (bt.truck && pv !== 2) speed *= bt.train ? TRAIN_ROAD : TRUCK_ROAD; // heavy: only asphalt lets it run flat out
    if (isJunction(here) && !S.lights[here] && !S.over[here]) speed *= JUNCTION_SLOW; // crossing carefully
  } else {
    if (S.ramp[here]) speed *= SLOPE_SPEED; else if (S.res[here]) speed *= 0.75;
    if (!S.bAt[here]) {
      const fleeing = u.task && u.task.type === 'flee'; // running from a nuclear blast: no time to keep to the roads
      if (bt.roadOnly) speed *= fleeing ? OFFROAD_SLOW : HAULER_STRANDED; // a hauler caught off the road crawls back to it
      else if (bt.offroad && !harvestTrip(u)) speed *= OFFROAD_SLOW;
    }
  }
  const vmax = speed * batFactor(u) * speedMul(u);
  const want = vmax * dt;
  let lim = Infinity; // how far the bot can go before it must have stopped
  // Road junctions: stop before a red light, or give way to traffic already crossing the other way.
  const nx = u.path[u.pi];
  if (nx !== undefined && nx !== here && S.road[nx] && isJunction(nx) && !S.over[nx]) {
    const jdx = (nx % S.W) + 0.5 - u.x, jdy = ((nx / S.W) | 0) + 0.5 - u.y;
    const axis = Math.abs(jdx) >= Math.abs(jdy) ? 0 : 1;
    const toEdge = Math.max(0, Math.sqrt(jdx * jdx + jdy * jdy) - 0.55);
    const L = S.lights[nx];
    let stop = false;
    if (L) {
      (L.app || (L.app = [0, 0]))[axis]++;
      if (L.clr > 0 || L.ph !== axis) { stop = true; (L.dem || (L.dem = [0, 0]))[axis]++; }
    } else if (crossTraffic(nx, axis) && !(u.crossUntil > S.time)) {
      stop = true;
      u.crossT = (u.crossT || 0) + dt;
      if (u.crossT > 4) { u.crossUntil = S.time + 1; u.crossT = 0; } // never wait forever
    }
    if (!stop) u.crossT = 0;
    if (stop) lim = Math.min(lim, toEdge);
  }
  // A level crossing: wait short of the track while a train is coming through.
  if (nx !== undefined && nx !== here && S.rail[nx] && trainNear(nx)) {
    const cdx = (nx % S.W) + 0.5 - u.x, cdy = ((nx / S.W) | 0) + 0.5 - u.y;
    lim = Math.min(lim, Math.max(0, Math.sqrt(cdx * cdx + cdy * cdy) - 0.6));
  }
  // On roads, wait behind the bot ahead instead of driving through it.
  if (r || S.road[u.path[u.pi]]) {
    const room = queueRoom(u);
    if (room < want) {
      if (room < want * 0.25) {
        u.queueT = (u.queueT || 0) + dt;
        if (u.queueT > QUEUE_PATIENCE) { u.squeezeUntil = S.time + 1.5; u.queueT = 0; } // jammed solid: squeeze past
      }
    } else u.queueT = 0;
    lim = Math.min(lim, room);
  }
  let step = driveSpeed(u, bt, vmax, lim, dt) * dt;
  if (step > lim) step = lim;
  u.odo = ((u.odo || 0) + step) % 1000; // distance driven: turns the wheels in drive animations
  u.moved = step > 0 ? 1 : 0;
  while (step > 0 && u.pi < u.path.length) {
    const t = u.path[u.pi];
    const tx = (t % S.W) + 0.5, ty = ((t / S.W) | 0) + 0.5;
    if (blockedStep(u, t) && tIdx(Math.floor(u.x), Math.floor(u.y)) !== t) {
      // Something stands in the way. An armed warbot shoots through an enemy Wall, Gate or Outpost; anyone
      // else plans a new route (a Wall went up across this one), waits if there is none, and gives
      // up the job after a while so it can be given another.
      u.vel = 0;
      u.moved = 0;
      if (breachable(t, u.owner) && u.type === 'warbot' && (u.ammo ?? WARBOT_AMMO) > 0) { breachHit(u, getE(S.bAt[t])); return false; }
      const g = u.path[u.path.length - 1], keep = u.path, pi = u.pi;
      if (goTo(u, g % S.W, (g / S.W) | 0)) { u.blockT = 0; return false; }
      u.path = keep; u.pi = pi;
      u.blockT = (u.blockT || 0) + dt;
      if (u.blockT > 10) { u.blockT = 0; cancelTask(u); u.task = null; u.path = null; }
      return false;
    }
    const dx = tx - u.x, dy = ty - u.y, d = Math.sqrt(dx * dx + dy * dy);
    if (d > 1e-4) u.face = Math.atan2(dy, dx);
    if (d <= step) { u.x = tx; u.y = ty; step -= d; u.pi++; }
    else { u.x += (dx / d) * step; u.y += (dy / d) * step; step = 0; }
  }
  if (u.pi >= u.path.length) { u.path = null; u.vel = 0; u.drive = 0; return true; }
  return false;
}

/**
 * Speeding up and slowing down: a bot's speed (u.vel, tiles a second) climbs towards vmax at its
 * acceleration, and it brakes in time to stop at `lim` (a red light, the bot ahead, the end of its
 * trip) and to take the next corner at a safe speed. Sets u.drive: 1 speeding up, -1 braking or
 * held up, 0 cruising (for brake lights and dust). Returns the speed to move at this tick.
 */
function driveSpeed(u, bt, vmax, lim, dt) {
  const acc = bt.accel || BOT_ACCEL, brk = bt.brake || BOT_BRAKE;
  const v0 = u.vel || 0;
  let cap = vmax;
  // The end of the trip: come to a stop there.
  const t0 = u.path[u.pi], last = u.pi >= u.path.length - 2;
  const dx0 = (t0 % S.W) + 0.5 - u.x, dy0 = ((t0 / S.W) | 0) + 0.5 - u.y, d0 = Math.sqrt(dx0 * dx0 + dy0 * dy0);
  if (last) lim = Math.min(lim, d0 + (u.pi === u.path.length - 2 ? 1 : 0));
  // A corner at the next waypoint: slow to corner speed by the time we reach it.
  const t1 = u.path[u.pi + 1];
  if (t1 !== undefined && d0 > 1e-3) {
    const bx = (t1 % S.W) - (t0 % S.W), by = ((t1 / S.W) | 0) - ((t0 / S.W) | 0);
    if ((dx0 * bx + dy0 * by) / (d0 * Math.sqrt(bx * bx + by * by)) < 0.7) {
      const vc = vmax * (bt.rail ? 0.55 : bt.train ? TRAIN_CORNER : bt.truck ? TRUCK_CORNER : BOT_CORNER);
      cap = Math.min(cap, Math.sqrt(vc * vc + 2 * brk * d0));
    }
  }
  // A Freight Train coming up to a Ramp brakes to its grade speed by the time it gets there.
  if (bt.rail && S.ramp[t0] && !S.ramp[Math.floor(u.y) * S.W + Math.floor(u.x)]) {
    const vr = vmax * RAIL_GRADE;
    cap = Math.min(cap, Math.sqrt(vr * vr + 2 * brk * Math.max(0, d0 - 0.5)));
  }
  if (lim < Infinity) cap = Math.min(cap, Math.sqrt(2 * brk * Math.max(0, lim)));
  const v = cap > v0 ? Math.min(cap, v0 + acc * dt) : cap;
  u.drive = v > v0 + 1e-3 ? 1 : v < v0 - 1e-3 || (v < 0.05 && lim < 0.05) ? -1 : 0;
  u.vel = v;
  u.vtop = vmax;
  return v;
}

/** Path to (x, y) if not already heading there, then move. true = arrived, null = unreachable. */
function travel(u, x, y, dt) {
  const goal = y * S.W + x;
  if (!u.path || u.goal !== goal) {
    if (!goTo(u, x, y)) return null;
  }
  return moveAlong(u, dt);
}

/**
 * A bot out on a Viaduct's deck (u.deck, set while crossing): its two ends, the nearer first. Null
 * (and u.deck cleared) once it stands on either end.
 */
function deckEnds(u) {
  if (!u.deck) return null;
  const [a, b] = u.deck;
  const d = (e) => dist2(u.x, u.y, (e % S.W) + 0.5, ((e / S.W) | 0) + 0.5);
  // Off the deck only once it's well onto an end, not just over its edge.
  if (d(a) < 0.1 || d(b) < 0.1) { u.deck = null; return null; }
  return d(a) <= d(b) ? [a, b] : [b, a];
}

/** Straight-line step used while chasing in combat. */
function moveDirect(u, x, y, dt) {
  // On a Viaduct's deck there's nowhere to go but along it: head for its nearer end.
  const deck = deckEnds(u);
  if (deck) { x = (deck[0] % S.W) + 0.5; y = ((deck[0] / S.W) | 0) + 0.5; }
  const dx = x - u.x, dy = y - u.y, d = Math.sqrt(dx * dx + dy * dy);
  if (d < 1e-4) return true;
  u.face = Math.atan2(dy, dx);
  const s = Math.min(WARBOT_SPEED * batFactor(u) * speedMul(u) * dt, d);
  const nx = u.x + (dx / d) * s, ny = u.y + (dy / d) * s;
  const ti = Math.floor(nx), tj = Math.floor(ny), ci = Math.floor(u.x), cj = Math.floor(u.y);
  if (!inMap(ti, tj)) return false;
  const t = tIdx(ti, tj), c = tIdx(ci, cj);
  if (t !== c && deck) {
    if (S.bAt[t] && t !== deck[0]) return false;
  } else if (t !== c) {
    if (S.bAt[t]) return false;
    // Chasing can't jump down or up a cliff: the step must be walkable via an orthogonal neighbour.
    const ok = ti === ci || tj === cj ? canStep(c, t)
      : (canStep(c, tIdx(ti, cj)) && canStep(tIdx(ti, cj), t)) || (canStep(c, tIdx(ci, tj)) && canStep(tIdx(ci, tj), t));
    if (!ok) return false;
  }
  u.moved = 1;
  u.x = nx; u.y = ny;
  return true;
}

/* ------------------------------------------------------------------ logistics */

function dispatch(p) {
  const blds = [];
  for (const b of S.buildings) if (b.owner === p && !b.dead && !evacuated(b)) blds.push(b); // nothing inside a blast ring being evacuated
  blds.sort((a, c) => prioRank(a) - prioRank(c) || a.born - c.born);

  // Keep a worker or two free to build. If raids or new buildings took them all, pull one off the
  // least useful job — this must run even when nobody is idle.
  let free = 0, workers = 0, haulers = 0, trucks = 0, vans = 0, trains = 0, tankers = 0;
  // The road networks (truck networks: no Ropeways) a Tanker of ours is on: liquids there wait for a Tanker.
  const tankNets = new Set();
  for (const u of S.bots) {
    if (u.dead || u.owner !== p) continue;
    if (u.type === 'hauler') haulers++;
    if (BOTS[u.type].rail) trains++;
    if (BOTS[u.type].tanker) { tankers++; for (const n of botNets(u)) tankNets.add(n); }
    else if (BOTS[u.type].truck) { trucks++; if (!BOTS[u.type].train) vans++; }
    if (u.type !== 'worker') continue;
    workers++;
    if (!(u.task && u.task.type === 'staff')) free++;
  }
  // Only haulers carry goods, on roads. If every hauler is lost, workers carry (slowly) until the
  // Foundry can make more.
  const P = S.players[p];
  P.noHaulers = haulers === 0;
  // Planned roads the border no longer covers are called off (and refunded), except a bridge
  // still reaching out over the water from our side.
  for (const t of planAll(p).slice()) {
    if (S.bAt[t] || (S.owner[t] !== p && !(bridgeable(t) && bridgeHead(p, t % S.W, (t / S.W) | 0)))) cancelPlan(t);
  }
  const linked = (a, b) => P.noHaulers || roadLinked(a, b);
  for (const b of blds) b.unlinked = !P.noHaulers && needsRoad(b) && !onHomeNet(b);
  const minFree = siteCount(p) > 0 ? MIN_FREE_WORKERS : 1;
  // Can this colony charge anywhere right now (a Charging Station with Fuel)? Can its trucks fill up?
  P.canCharge = blds.some((b) => b.built && BDEFS[b.type].charger && !chargerDry(b));
  P.canRefuel = blds.some((b) => b.built && (BDEFS[b.type].store || BDEFS[b.type].charger) && (b.stock.fuel || 0) - (b.res.fuel || 0) >= 1);
  if (free < minFree) {
    const cands = blds.filter((b) => b.built && b.staff && b.type !== 'foundry' && !BDEFS[b.type].crew);
    cands.sort((a, c) => releaseScore(c) - releaseScore(a));
    if (cands.length) {
      unstaff(cands[0]);
      free++;
      if (S.time - (S.players[p].lastShortMsg || -99) > 60) {
        S.players[p].lastShortMsg = S.time;
        postMsg(p, `Short on workers — the ${BDEFS[cands[0].type].name} worker was moved to building. Make more workers at a Bot Foundry.`, cands[0].x, cands[0].y, 'warn');
      }
    }
  }

  const idle = [];
  for (const u of S.bots) if (u.owner === p && isIdleWorker(u)) idle.push(u);
  if (!idle.length) return;

  // role: 'build', 'haul', 'staff' (an ordinary building) or a crew name (a specialist's building).
  // For 'haul', `src` is where the goods are: a hauler must be able to reach it by road.
  // With good `g`: Crude and Fuel (liquids) go by Tanker, whatever the role asked for (never by train),
  // or by Hauler, one at a time, when no Tanker can get to `src`. Tankers carry nothing else.
  const take = (x, y, role, src, g) => {
    let best = -1, bd = Infinity;
    const liq = isLiquid(g), tank = liq && src && tankerReach(src);
    for (let k = 0; k < idle.length; k++) {
      const u = idle[k], bt = BOTS[u.type];
      if (role === 'haul' || role === 'truck' || role === 'train' || role === 'rail') {
        if (bt.tanker) { if (!tank || role === 'rail') continue; }
        else if (liq && (tank || role !== 'haul')) continue;
        else if (!(bt.haul || (P.noHaulers && bt.build)) || (bt.rail ? 'rail' : bt.train ? 'train' : bt.truck ? 'truck' : 'haul') !== role) continue;
        if (bt.rail && src && !trainAt(u, src)) continue;
        if (bt.roadOnly && src && !botLinked(u, src)) continue;
      } else if (role === 'build' ? !bt.build : role === 'staff' ? !bt.staff : bt.crew !== role) continue;
      const d = dist2(u.x, u.y, x + 0.5, y + 0.5);
      // Only send a bot with enough charge (a truck, Fuel) for the trip there and back (unless there's nowhere to top up).
      if ((u.bat ?? 100) < BATTERY.low + 0.5 * Math.sqrt(d) && (bt.truck ? P.canRefuel : P.canCharge)) continue;
      if (d < bd) { bd = d; best = k; }
    }
    if (best < 0) return null;
    return idle.splice(best, 1)[0];
  };
  const canCarry = (u, n, g) => (u ? Math.max(1, Math.min(n, carryOf(u, g))) : 1);
  function tankerReach(b) {
    if (!tankNets.size) return false;
    for (const n of buildingNets(b, true)) if (tankNets.has(n)) return true;
    return false;
  }

  // 0) Specialist buildings get a bot of their crew.
  for (const b of blds) {
    const crew = BDEFS[b.type].crew;
    if (!crew || !b.built || b.paused || b.staff || b.staffInc || b.depleted) continue;
    const u = take(b.x, b.y, crew);
    if (u) assignStaff(u, b);
    else if (!S.bots.some((v) => !v.dead && v.owner === p && v.type === crew)) {
      const P = S.players[p];
      P.crewMsg = P.crewMsg || {};
      if (S.time - (P.crewMsg[crew] || -999) > 120) {
        P.crewMsg[crew] = S.time;
        postMsg(p, `Your ${BDEFS[b.type].name} needs ${aOrAn(BOTS[crew].name)}. Order one at the Bot Foundry.`, b.x, b.y, 'warn');
      }
    }
  }
  if (!idle.length) return;

  // 1) A builder for every construction site that has materials waiting to be built with.
  for (const b of blds) {
    if (!idle.length) return;
    if (!b.built && !b.builder && deliveredCount(b) / sumValues(siteCost(b)) > b.progress + 0.01) {
      assignBuild(take(b.x, b.y, 'build'), b);
    }
  }
  // 1b) A worker for every building you've paid to repair.
  for (const b of blds) {
    if (!idle.length) return;
    if (b.built && b.fixLeft > 0 && !b.fixer) {
      const u = take(b.x, b.y, 'build');
      if (u) assignFix(u, b);
    }
  }
  // 2) An operator for every finished building that needs one, while keeping minFree workers free.
  const staffQueue = blds.filter((b) => b.built && !b.paused && BDEFS[b.type].staff && !BDEFS[b.type].crew && !b.staff && !b.staffInc && !atLimit(b) && !pumpDry(b) && !b.depleted && !(BDEFS[b.type].lab && !P.research))
    .sort((a, c) => prioRank(a) - prioRank(c) || staffPriority(a) - staffPriority(c) || a.born - c.born);
  for (const b of staffQueue) {
    if (!idle.length) return;
    if (free <= minFree) {
      if (S.time - (S.players[p].lastShortMsg || -99) > 60) {
        S.players[p].lastShortMsg = S.time;
        postMsg(p, 'Not enough workers to run every building. Build a Bot Foundry to make more.', b.x, b.y, 'warn');
      }
      break;
    }
    const u = take(b.x, b.y, 'staff');
    if (!u) break;
    assignStaff(u, b);
    free--;
  }
  // 3) Deliveries, one unit per request per pass. Player priority comes first; within the same
  //    priority the Foundry goes first (new workers unblock everything), then construction sites
  //    and production inputs share turns, whichever has the fewest goods on the way first.
  const reqs = [];
  for (const b of blds) {
    const pri = prioRank(b) * 3 + (b.built && BDEFS[b.type].bots ? 0 : 1);
    // Fuel for an empty Charging Station comes before anything else: nothing moves without charge.
    // So does one Alloy for an empty Repair Station, so it always has some on hand for the next robot.
    const dry = (BDEFS[b.type].charger && b.built && chargerDry(b)) ||
      (BDEFS[b.type].repair && b.built && !(b.stock.alloy > 0) && !(b.inc.alloy > 0) && (b.repairPts || 0) < REPAIR_HP_PER_ALLOY / 2);
    for (const [g, n, keep] of needsOf(b)) if (n > 0) reqs.push({ b, g, n, pri: dry ? -1 : keep ? prioRank(b) * 3 + 2 : pri, inc: sumValues(b.inc), keep });
  }
  reqs.sort((a, c) => a.pri - c.pri || a.inc - c.inc || a.b.born - c.b.born);
  for (let pass = 0; pass < 4 && idle.length; pass++) {
    let any = false;
    for (const r of reqs) {
      if (!idle.length) break;
      if (r.n <= 0) continue;
      let src = null, bd = Infinity;
      if (!reachable(r.b)) { r.n = 0; continue; }
      const sup = r.keep ? keepSupply : supplyOf;
      // A Rail Station's supply orders come by Freight Train from another station on its track first,
      // a worthwhile load at a time (RAIL_MIN_LOAD or more). A station nearer the Command Base lends
      // the goods it keeps for its own supply orders: that's how the home station feeds the line.
      if (trains && BDEFS[r.b.type].station && r.n >= RAIL_MIN_LOAD && !isLiquid(r.g)) {
        const L = getE(P.lander), dh = (s) => (L ? dist2(s.x, s.y, L.x, L.y) : 0);
        const railHas = (s) => (dh(s) < dh(r.b) ? supplyOf(s, r.g) : keepSupply(s, r.g));
        let rs = null, rd = Infinity;
        for (const s of blds) {
          if (s === r.b || !BDEFS[s.type].station || !s.built || railHas(s) < RAIL_MIN_LOAD || !railLinked(s, r.b)) continue;
          const d = dist2(s.x, s.y, r.b.x, r.b.y);
          if (d < rd) { rd = d; rs = s; }
        }
        const tu = rs && take(rs.x, rs.y, 'rail', rs);
        if (tu) { const n = canCarry(tu, Math.min(r.n, railHas(rs))); assignHaul(tu, rs, r.b, r.g, n); r.n -= n; any = true; continue; }
      }
      for (const s of blds) {
        if (s === r.b || sup(s, r.g) <= 0 || !reachable(s) || !linked(s, r.b)) continue;
        const d = dist2(s.x, s.y, r.b.x, r.b.y);
        if (d < bd) { bd = d; src = s; }
      }
      if (!src) { r.n = 0; continue; }
      // Long runs go by Freight Truck (storage to storage by Road Train when the load is big), with a
      // full load: a far factory or garrison gets up to LONG_BUFFER. Haulers stay on the short local
      // runs; with trucks around they take a long one only when the building there is about to run
      // dry. Supply orders wait for a truck when you have one.
      const have = sup(src, r.g), avail = Math.min(r.n, have);
      const long = farApart(src, r.b);
      const s2s = !!BDEFS[src.type].store && !!BDEFS[r.b.type].store;
      const bulk = Math.min(have, r.b.built && !BDEFS[r.b.type].store ? Math.max(r.n, LONG_BUFFER) : r.n);
      let u = null;
      const byRoad = truckLinked(src, r.b);
      const held = (r.b.built ? (r.b.stock[r.g] || 0) : 0) + (r.b.inc[r.g] || 0), starving = held <= 0;
      const keepAmt = (r.b.keep && r.b.keep[r.g]) || 0;
      // With a Road Train that can make the run, a big supply order (twice a train load or more) waits
      // for a load worth its trip (TRAIN_MIN_LOAD) instead of going by truck a few at a time, until the
      // Depot is down to a third. Smaller orders go by truck as before.
      const trainWait = r.keep && byRoad && s2s && long && keepAmt >= 2 * TRAIN_MIN_LOAD && bulk < TRAIN_MIN_LOAD && have >= TRAIN_MIN_LOAD &&
        held * 3 >= keepAmt && !isLiquid(r.g) && roadTrainFor(p, src);
      // A supply order sends a truck for a worthwhile load (TRUCK_KEEP_LOAD, or half the order if that's
      // less), or when the store has run dry.
      const truckLoad = !trainWait && (!r.keep || starving || bulk >= Math.min(TRUCK_KEEP_LOAD, Math.ceil(keepAmt / 2)));
      if (byRoad && s2s && long && bulk >= TRAIN_MIN_LOAD) u = take(src.x, src.y, 'train', src, r.g);
      if (!u && byRoad && (s2s || long) && truckLoad) u = take(src.x, src.y, 'truck', src, r.g);
      if (!u && byRoad && s2s && long && !vans && bulk >= TRUCK_MIN_LOAD) u = take(src.x, src.y, 'train', src, r.g); // no trucks: a smaller load
      // A long supply run waits for a Freight Truck when one can get there by road (unless the store
      // has run dry); otherwise Haulers take it (a Road Train only takes big loads, and no truck rides
      // a Ropeway).
      if (!u && !trainWait && !(r.keep && long && vans > 0 && byRoad && !starving)) {
        if (!long || !vans || starving || !byRoad || isLiquid(r.g)) u = take(src.x, src.y, 'haul', src, r.g);
      }
      if (!u) { r.n = 0; continue; }
      // (Trucks bring a full load on the long runs. A Tanker brings a factory a full buffer too, near or
      // far, and anything else what it asks for.)
      const tank = BOTS[u.type].tanker, n = canCarry(u, BOTS[u.type].truck && (long || s2s || !tank || (r.b.built && BDEFS[r.b.type].inp)) ? bulk : avail, r.g);
      assignHaul(u, src, r.b, r.g, n);
      r.n -= n;
      any = true;
    }
    if (!any) break;
  }
  // 4) Move finished goods from production buildings into storage.
  for (const b of blds) {
    const def = BDEFS[b.type];
    if (!b.built || def.store || !def.out) continue;
    for (const g in def.out) {
      if (!idle.length) return;
      const avail = supplyOf(b, g);
      if (avail >= 2 || (avail >= 1 && !b.staff)) {
        const store = storeFor(p, g, b.x + 0.5, b.y + 0.5, null, P.noHaulers ? null : b);
        if (!store) continue;
        // Storage far away: a Freight Truck collects a load; Haulers only once the output is nearly
        // full (so production never stalls), or when there are no trucks.
        let u = null;
        if (isLiquid(g)) {
          // Crude and Fuel: a Tanker comes for a load (or a Hauler, a can at a time, if no Tanker can get here).
          if (b.piped && g === 'crude') continue; // a pipeline takes it
          const full = avail >= def.out[g] - 1 || !b.staff;
          if (avail >= TRUCK_MIN_LOAD || full || !tankerReach(b)) u = take(b.x, b.y, 'haul', b, g);
        } else if (vans && farApart(b, store) && truckLinked(b, store)) {
          const full = avail >= def.out[g] - 1 || !b.staff;
          if (avail >= TRUCK_MIN_LOAD || full) u = take(b.x, b.y, 'truck', b);
          if (!u && full) u = take(b.x, b.y, 'haul', b);
        } else u = take(b.x, b.y, 'haul', b);
        if (u) assignHaul(u, b, store, g, canCarry(u, avail, g));
      }
    }
  }
  // 4b) Goods warbots brought back to an Outpost go on to storage.
  for (const b of blds) {
    if (!b.loot || !b.built) continue;
    for (const g in b.loot) {
      if (!idle.length) return;
      const avail = supplyOf(b, g);
      if (avail < 1) continue;
      const store = storeFor(p, g, b.x + 0.5, b.y + 0.5, b, P.noHaulers ? null : b);
      const u = store && take(b.x, b.y, 'haul', b, g);
      if (u) assignHaul(u, b, store, g, canCarry(u, avail, g));
    }
  }
  // 4d) Crates lying on our land (spilled from a wrecked or demolished building, or dropped by a
  //     robot) go to storage, a load at a time, unless enemy robots or guns are about.
  if (S.loot && S.loot.length) {
    for (const l of S.loot) {
      if (!idle.length) return;
      if (S.owner[tIdx(l.x, l.y)] !== p || (l.noReach && l.noReach[p] > S.time)) continue;
      if (lootLeft(l) - (l.claimed || 0) <= 0 || foesNear(p, l.x + 0.5, l.y + 0.5, CRATE_SAFE)) continue;
      const nets = pileNets(l, false), netsT = pileNets(l, true);
      for (let guard = 0; guard < 12 && idle.length; guard++) {
        // The good there's most of, not yet promised to a hauler.
        let g = null, left = 0;
        for (const k in l.goods) { const a = l.goods[k] - ((l.held && l.held[k]) || 0); if (a > left) { left = a; g = k; } }
        if (!g || lootLeft(l) - (l.claimed || 0) <= 0) break;
        // A Freight Truck for a big pile, else a Hauler (or, with no Haulers, a worker), that can get there.
        // Barrels of Crude or Fuel wait for a Tanker, if one can get there.
        let best = -1, bd = Infinity;
        const liq = isLiquid(g), wants = liq ? [netsT.some((n) => tankNets.has(n)) ? 'tanker' : 'haul'] : left >= TRUCK_MIN_LOAD * 2 ? ['truck', 'haul'] : ['haul'];
        for (const want of wants) {
          for (let k = 0; k < idle.length; k++) {
            const u = idle[k], bt = BOTS[u.type];
            if (bt.rail || bt.train || !(bt.haul || (P.noHaulers && bt.build))) continue;
            if (want === 'tanker' ? !bt.tanker : bt.tanker || (want === 'truck') !== !!bt.truck) continue;
            if (bt.roadOnly && !botNets(u).some((n) => (bt.truck ? netsT : nets).indexOf(n) >= 0)) continue;
            const d = dist2(u.x, u.y, l.x + 0.5, l.y + 0.5);
            if ((u.bat ?? 100) < BATTERY.low + 0.5 * Math.sqrt(d) && (bt.truck ? P.canRefuel : P.canCharge)) continue;
            if (d < bd) { bd = d; best = k; }
          }
          if (best >= 0) break;
        }
        if (best < 0) break;
        const u = idle.splice(best, 1)[0];
        if (!assignCrate(u, l, g, Math.max(1, Math.min(left, carryOf(u, g))))) break;
      }
    }
  }
  // 4c) Trunk runs: a store far from the Command Base sends home, in bulk, what nothing near it uses.
  if ((trucks || trains || tankers) && idle.some((u) => BOTS[u.type].truck || BOTS[u.type].rail)) trunkRuns(p, blds, take, canCarry, vans, trains);
  // 5) Empty out storage that no longer takes a good (set to "empty out" or the good switched off).
  for (const b of blds) {
    if (!storeAccepts(b) || (b.smode !== 'empty' && !b.reject)) continue;
    for (const g of GOODS) {
      if (!idle.length) return;
      if (storeTakes(b, g) || supplyOf(b, g) <= 0) continue;
      const store = storeFor(p, g, b.x + 0.5, b.y + 0.5, b, P.noHaulers ? null : b);
      const u = store && ((truckLinked(b, store) && take(b.x, b.y, 'truck', b, g)) || take(b.x, b.y, 'haul', b, g));
      if (u) assignHaul(u, b, store, g, canCarry(u, supplyOf(b, g), g));
    }
  }
  // 6) Free workers pave planned roads.
  if (planList(p).length) {
    for (let k = idle.length - 1; k >= 0; k--) {
      const u = idle[k];
      if (!BOTS[u.type].build) continue;
      const t = nextPaveTile(u, p, -1);
      if (t < 0) break;
      idle.splice(k, 1);
      assignPave(u, t);
    }
  }
}

/* ------------------------------------------------------------------ repairs */

/** Is robot u hurt enough to go for repairs (and is there anywhere to go)? */
function wantsRepair(u) {
  if (u.dead || !warOn() || !u.maxHp) return false; // Colony free play has Repair Stations too (wildlife bites)
  return u.hp < u.maxHp * (u.type === 'warbot' ? REPAIR_BELOW.warbot : REPAIR_BELOW.other);
}

/** A Repair Station with no Alloy left (and none in its hopper) can't fix anyone. */
function repairDry(b) { return (b.repairPts || 0) < 0.5 && !(b.stock.alloy > 0); }

/** Nearest Repair Station robot u can reach that has Alloy, avoiding crowded ones. */
function findRepair(u) {
  let best = null, bs = Infinity;
  const zone = S.zone[tIdx(Math.floor(u.x), Math.floor(u.y))];
  for (const b of S.buildings) {
    if (b.dead || b.owner !== u.owner || !b.built || !BDEFS[b.type].repair || repairDry(b) || evacuated(b)) continue;
    if (S.zone[tIdx(b.x, b.y)] !== zone) continue;
    if (u.type !== 'warbot' && roadBound(u) && !botLinked(u, b)) continue;
    let inside = 0;
    for (const v of S.bots) if (!v.dead && (v.inside === b.id || (v.task && v.task.type === 'repair' && v.task.bld === b.id))) inside++;
    const s = dist(b.x + 0.5, b.y + 0.5, u.x, u.y) + Math.max(0, inside - BDEFS[b.type].repair.slots) * 5;
    if (s < bs) { bs = s; best = b; }
  }
  return best;
}

/** Send robot u to the nearest Repair Station. */
function goRepair(u) {
  const c = findRepair(u);
  if (!c) return false;
  if (u.type === 'warbot') {
    exitBuilding(u);
    u.task = { type: 'repair', bld: c.id };
    u.path = null;
    return true;
  }
  if (!goTo(u, c.x, c.y)) return false;
  u.task = { type: 'repair', bld: c.id };
  return true;
}

/** A Repair Station fixes up to `slots` robots inside it at once, burning Alloy as it goes. */
function updateRepairStation(b, def, dt) {
  const slots = def.repair.slots;
  const hurt = [];
  for (const u of S.bots) if (!u.dead && u.inside === b.id && u.hp < u.maxHp) hurt.push(u);
  if (!hurt.length) {
    b.status = repairDry(b) ? 'Out of Alloy: it can\'t repair robots' : 'Ready: damaged robots come here to be fixed';
    return;
  }
  const share = Math.min(1, slots / hurt.length);
  let fixing = 0;
  for (const u of hurt) {
    let gain = Math.min(u.maxHp - u.hp, def.repair.rate * share * dt * S.players[b.owner].mult);
    if ((b.repairPts || 0) < gain && (b.stock.alloy || 0) > 0) { bump(b.stock, 'alloy', -1); usedGood(b.owner, 'alloy', 1); b.repairPts = (b.repairPts || 0) + REPAIR_HP_PER_ALLOY; }
    gain = Math.min(gain, b.repairPts || 0);
    if (gain <= 0) continue;
    b.repairPts -= gain;
    u.hp += gain;
    fixing++;
  }
  b.working = fixing > 0;
  b.status = fixing
    ? `Repairing ${Math.min(hurt.length, slots)} of ${slots} robots` + (hurt.length > slots ? ` (${hurt.length - slots} waiting)` : '')
    : 'Out of Alloy: it can\'t repair robots';
}

/** Cement a full repair of building b would cost now, beyond any repair already paid for. */
function repairCost(b) {
  const def = BDEFS[b.type], missing = def.armor - b.armor - (b.fixLeft || 0);
  if (missing <= 0.5) return 0;
  // Never dearer than putting up a new one (a battered Wall costs no more than a fresh Wall's 5 Cement).
  const whole = sumValues(def.cost || {}) || Infinity;
  return Math.max(1, Math.ceil(Math.min(missing / ARMOR_PER_CEMENT, (whole * missing) / def.armor - 1e-9)));
}

/** Pay for a building's repair: a free worker comes and restores its armor. '' or why not. */
function requestRepair(owner, b) {
  if (!b || b.dead || !b.built || b.owner !== owner) return 'Only your finished buildings can be repaired.';
  const n = repairCost(b);
  if (!n) return b.fixLeft > 0 ? 'A repair is already on the way.' : 'It isn\'t damaged.';
  if (playerGoods(owner).cement < n) return `Repairing it takes ${n} Cement.`;
  takeGood(owner, 'cement', n);
  b.fixLeft = BDEFS[b.type].armor - b.armor; // paid in full
  return '';
}

function assignFix(u, b) {
  cancelTask(u);
  u.task = { type: 'fix', bld: b.id, phase: 'go' };
  b.fixer = u.id;
  if (!goTo(u, b.x, b.y)) cancelTask(u);
}

/** A worker repairing a building: walk over, then restore armor until the paid repair is done. */
function doFix(u, t, dt) {
  const b = getE(t.bld);
  if (!b || b.dead || !b.built || b.owner !== u.owner || !(b.fixLeft > 0)) { cancelTask(u); return; }
  if (t.phase === 'go') {
    if (moveAlong(u, dt)) t.phase = 'work';
    return;
  }
  if (mustRecharge(u)) { cancelTask(u); return; }
  const def = BDEFS[b.type];
  const gain = Math.min(b.fixLeft, def.armor - b.armor, FIX_RATE * dt * S.players[u.owner].mult * batFactor(u));
  b.armor += gain;
  b.fixLeft -= gain;
  u.busy = 1;
  if (b.fixLeft <= 0.01 || b.armor >= def.armor - 0.01) {
    b.fixLeft = 0;
    if (b.armor >= def.armor - 0.01) b.armor = def.armor;
    cancelTask(u);
    u.idleT = 0;
    if (b.owner === 0) addFx('ring', b.x + 0.5, b.y + 0.5, { color: '#7ee08a' });
  }
}

/** A gentle nudge when one of your buildings is left damaged after a fight. */
function repairHint(b) {
  if (b.owner !== 0 || S.mode === 'colony' || b.fixLeft > 0) return;
  const def = BDEFS[b.type];
  if (b.armor >= def.armor * 0.6 || S.time - (b.lastHit || -99) < 10) return;
  const P = S.players[0];
  if (S.time - (P.lastRepairHint || -999) < 150) return;
  P.lastRepairHint = S.time;
  postMsg(0, `Your ${def.name} is damaged. Tap it and press Repair: a worker fixes it for a little Cement.`, b.x, b.y, 'warn');
}

/* ------------------------------------------------------------------ salvage */

/**
 * A colony that has run out of Stone or Fiber with no Quarry or Harvester that can still work
 * (so it couldn't build one) slowly salvages it from its Command Base, enough to get going again.
 */
function landerSalvage(p, dt) {
  const P = S.players[p];
  const L = getE(P.lander);
  if (P.absent || !L || L.owner !== p || L.dead) return;
  P.salvageT = P.salvageT || {};
  const have = playerGoods(p);
  for (const [g, type, res] of [['stone', 'quarry', R_BOULDER], ['fiber', 'harvester', R_STALK]]) {
    // A site only counts once its materials are in: one waiting for this very good never will be.
    const working = S.buildings.some((b) => !b.dead && b.owner === p && b.type === type &&
      (b.built ? BDEFS[type].bedrock || reachableRes(b.x, b.y, BDEFS[type].radius, res) > 0 : sumValues(b.stock) >= sumValues(BDEFS[type].cost))); // a Quarry can always cut or dig
    // Cement is Stone already baked (2 per Stone), so it counts towards having enough.
    const amount = (have[g] || 0) + (g === 'stone' ? (have.cement || 0) / 2 : 0);
    if (working || amount >= SALVAGE_BELOW) { P.salvageT[g] = 0; continue; }
    P.salvageT[g] = (P.salvageT[g] || 0) + dt;
    if (P.salvageT[g] < SALVAGE_EVERY) continue;
    P.salvageT[g] = 0;
    bump(L.stock, g, 1);
    if (S.time - ((P.salvageMsg || {})[g] || -999) > 180) {
      P.salvageMsg = P.salvageMsg || {};
      P.salvageMsg[g] = S.time;
      postMsg(p, `Out of ${GOOD[g].name}: your Command Base's crew is salvaging a little from its own stores. Build ${aOrAn(BDEFS[type].name)} by ${type === 'quarry' ? 'boulders' : 'stalk groves'}, or expand with an Outpost to reach some.`, L.x, L.y, 'warn');
    }
  }
}

/* ------------------------------------------------------------------ paving */

/**
 * The planned road tile worker u should pave next: the nearest one nobody else is paving,
 * preferring tiles that join the road network (so a road grows out from it, usable as it goes).
 * With maxD >= 0, only tiles that close to the worker count (carrying on along the same road).
 */
function nextPaveTile(u, p, maxD) {
  const W = S.W, ux = u.x, uy = u.y, zone = homeZone(p), skip = S.players[p].paveSkip || {};
  let best = -1, bs = Infinity;
  for (const t of planList(p)) {
    const by = S.paveRes[t];
    if (by && getE(by) && !getE(by).dead) continue;
    if (skip[t] > S.time) continue;
    const cross = crossTile(t);
    // A bridge or tunnel is built from the tile next to it: the shore, the rock face, or the deck so far.
    if (cross ? paveStand(t, zone) < 0 : S.zone[t] !== zone) continue;
    const i = t % W, j = (t / W) | 0;
    const d = Math.abs(i + 0.5 - ux) + Math.abs(j + 0.5 - uy);
    if (maxD >= 0 && d > maxD) continue;
    let joins = cross;
    for (const v of cross ? [] : [i > 0 ? t - 1 : -1, i < W - 1 ? t + 1 : -1, t - W, t + W]) {
      if (v >= 0 && v < W * S.H && (S.road[v] || S.bAt[v]) && canStep(t, v)) { joins = true; break; }
    }
    const s = d + (joins ? 0 : 8);
    if (s < bs) { bs = s; best = t; }
  }
  return best;
}

/** Where a worker stands to build bridge or tunnel tile t: a walkable neighbour in `zone` (road first), or -1. */
function paveStand(t, zone) {
  const W = S.W, i = t % W;
  let best = -1;
  for (const v of [i > 0 ? t - 1 : -1, i < W - 1 ? t + 1 : -1, t - W, t + W]) {
    if (v < 0 || v >= W * S.H || !walkable(v) || S.bAt[v] || S.zone[v] !== zone) continue;
    if (S.road[v]) return v;
    if (best < 0) best = v;
  }
  return best;
}

function assignPave(u, t) {
  cancelTask(u);
  const stand = crossTile(t) ? paveStand(t, homeZone(u.owner)) : t;
  u.task = { type: 'pave', tile: t, phase: 'go', prog: 0 };
  S.paveRes[t] = u.id;
  if (stand < 0 || !goTo(u, stand % S.W, (stand / S.W) | 0)) {
    const P = S.players[u.owner];
    P.paveSkip = P.paveSkip || {};
    P.paveSkip[t] = S.time + 15;
    cancelTask(u);
  }
}

function doPave(u, t, dt) {
  const tile = t.tile;
  if (S.plan[tile] !== u.owner + 1) { cancelTask(u); return; } // called off, or already paved
  if (t.phase === 'go') {
    if (moveAlong(u, dt)) t.phase = 'work';
    return;
  }
  if (mustRecharge(u)) { cancelTask(u); return; }
  t.prog += dt * S.players[u.owner].mult * batFactor(u) * (tech(u.owner, 'paving') ? 1 / 0.6 : 1);
  u.busy = 1;
  const c = CROSS[S.terrain[tile]];
  if (c) u.face = Math.atan2(((tile / S.W) | 0) + 0.5 - u.y, (tile % S.W) + 0.5 - u.x);
  if (t.prog < (c ? c.time : S.res[tile] ? PAVE_CLEAR_TIME : PAVE_TIME)) return;
  layRoad(tile);
  cancelTask(u);
  u.idleT = 0;
  // Carry on with the next planned tile close by, so a crew works its way along the road.
  const next = nextPaveTile(u, u.owner, 4);
  if (next >= 0) assignPave(u, next);
}

/** Finish a road tile: clear any resource on it and make it road (its Cement was paid when planned). */
function layRoad(t) {
  if (S.res[t]) { S.res[t] = 0; S.amt[t] = 0; if (S.grow) S.grow[t] = 1; }
  setPlan(t, -1);
  if (S.paveRes) delete S.paveRes[t];
  setRoad(t % S.W, (t / S.W) | 0, true);
  if (crossTile(t)) computeZones(); // a bridge or tunnel joins new land
  if (S.terrain[t] === T_WATER || S.terrain[t] === T_CHASM) computeTerritory(); // a bridge's landing claims a little ground
}

/** Call off a planned road tile and refund its Cement. */
function cancelPlan(t) {
  const owner = S.plan[t] - 1;
  if (owner < 0) return;
  const cost = roadTileCost(t), owed = S.owe && S.owe[t];
  setPlan(t, -1);
  if (!owed) refundRoad(owner, cost, t % S.W, (t / S.W) | 0); // a tile still waiting for its goods cost nothing yet
}

function aOrAn(word) { return (/^[AEIOU]/i.test(word) ? 'an ' : 'a ') + word; }

/** Which idle buildings get an operator first (lower = sooner). */
function staffPriority(b) {
  return b.type === 'foundry' ? 0 : b.type === 'grower' ? 2 : 1;
}

/** Send bot u to carry n of good g from src to dst (n > 1 only for bots that carry more). */
function assignHaul(u, src, dst, g, n) {
  if (!u) return;
  cancelTask(u);
  n = Math.min(n || 1, carryOf(u, g));
  u.task = { type: 'haul', src: src.id, dst: dst.id, good: g, phase: 'toSrc', n };
  bump(src.res, g, n);
  bump(dst.inc, g, n);
  if (!goTo(u, src.x, src.y)) { cancelTask(u); src.unreachUntil = S.time + 5; }
}

/** The road networks bot u is on (or in the building it is inside); none if it is off the road. */
function botNets(u) {
  const tr = !!BOTS[u.type].truck; // trucks can't ride a Ropeway
  if (u.inside) { const b = getE(u.inside); return b ? buildingNets(b, tr) : []; }
  const t = tIdx(Math.floor(u.x), Math.floor(u.y));
  if (S.road[t]) return [tr ? roadNet().compT[t] : roadNet().comp[t]];
  if (S.bAt[t]) { const b = getE(S.bAt[t]); return b ? buildingNets(b, tr) : []; }
  return [];
}

/** Can bot u reach building b along roads (and, unless it's a truck, Ropeways)? */
function botLinked(u, b) {
  const a = botNets(u), n = buildingNets(b, !!BOTS[u.type].truck);
  for (const c of a) if (n.indexOf(c) >= 0) return true;
  return false;
}

/** Buildings bots recently failed to reach are skipped by the dispatcher for a few seconds. */
function reachable(b) { return !(b.unreachUntil > S.time); }

function assignBuild(u, site) {
  if (!u) return;
  cancelTask(u);
  u.task = { type: 'build', site: site.id, phase: 'go' };
  site.builder = u.id;
  if (!goTo(u, site.x, site.y)) cancelTask(u);
}

function assignStaff(u, b) {
  if (!u) return;
  cancelTask(u);
  u.task = { type: 'staff', bld: b.id, phase: 'go', node: -1, wait: 0, timer: 0 };
  b.staffInc = u.id;
  if (!goTo(u, b.x, b.y)) cancelTask(u);
}

/* ------------------------------------------------------------------ workers */

function updateWorker(u, dt) {
  u.busy = 0;
  u.moved = 0;
  if (u.task && u.task.type === 'flee') { doFlee(u, dt); return; }
  // A new Freight Train rolls out at the nearest Rail Station (and waits at the Foundry until there is one).
  if (BOTS[u.type].rail && !u.task && !onTrack(u) && S.tick % 30 === u.id % 30) { deliverTrain(u); return; }
  const t = u.task;
  if (!t) {
    if (u.carry) stashCarry(u);
    else if (wantsRepair(u) && S.tick % 30 === u.id % 30 && goRepair(u)) { /* off to be fixed */ }
    else if ((u.bat ?? 100) < BATTERY.low && !insideCharger(u)) { if (!goCharge(u) && !u.inside) goHome(u); }
    else if (!insideCharger(u)) {
      // Waiting for work: top up the battery if it's below 70%, otherwise rest in storage.
      u.idleT += dt;
      if (u.idleT > 1.5) {
        u.idleT = 0;
        // (A truck tops up only when it's low: a Fuel fills the tank whatever is left in it.)
        if (!((u.bat ?? 100) < (BOTS[u.type].truck ? 45 : 70) && goCharge(u)) && !u.inside) goHome(u);
      }
      if (u.inside && BOTS[u.type].truck && S.tick % 450 === u.id % 450) spreadTrucks(u);
    }
  } else if (t.type === 'home') {
    const h = getE(t.bld);
    if (!h || h.owner !== u.owner) { u.task = null; u.path = null; }
    else if (moveAlong(u, dt)) { u.task = null; enterBuilding(u, h); }
  } else if (t.type === 'refuel') {
    const c = getE(t.bld);
    if (!c || c.dead || c.owner !== u.owner) { u.task = null; u.path = null; }
    else if (moveAlong(u, dt)) {
      u.task = null;
      if (!refuel(u, c)) goRefuel(u); // someone took the last of it: on to the next
      else if (BDEFS[c.type].store) enterBuilding(u, c);
    }
  } else if (t.type === 'charge') {
    const c = getE(t.bld);
    if (!c || c.owner !== u.owner) { u.task = null; u.path = null; }
    else if (u.inside === c.id) {
      if (u.bat >= 99.5 || chargerDry(c)) { u.task = null; if (!BDEFS[c.type].store) exitBuilding(u); }
    } else if (moveAlong(u, dt)) enterBuilding(u, c);
  } else if (t.type === 'haul') doHaul(u, t, dt);
  else if (t.type === 'crate') doCrate(u, t, dt);
  else if (t.type === 'build') doBuild(u, t, dt);
  else if (t.type === 'pave') doPave(u, t, dt);
  else if (t.type === 'fix') doFix(u, t, dt);
  else if (t.type === 'repair') {
    const c = getE(t.bld);
    if (!c || c.dead || c.owner !== u.owner) { u.task = null; u.path = null; }
    else if (u.inside === c.id) { if (u.hp >= u.maxHp || repairDry(c)) { u.task = null; exitBuilding(u); } }
    else if (moveAlong(u, dt)) enterBuilding(u, c);
  }
  else if (t.type === 'staff') doStaff(u, t, dt);
  workerBattery(u, dt);
}

/**
 * Does building b need a road to the Command Base's network? Construction sites always do (haulers
 * bring their materials), and so do Depots and any building that takes goods in or sends them out.
 */
function needsRoad(b) {
  const def = BDEFS[b.type];
  if (b.type === 'lander' || storeFunded(b)) return false; // Walls, Gates and Viaducts are paid from storage: no Hauler needed
  if (def.store) return true; // a Depot only helps if haulers can reach it from the Command Base
  if (!b.built) return true;
  if (def.mil) return warOn(); // Ammo for the garrison
  return !!(def.inp || def.out || def.ammo || def.charger || def.roadworks || def.bots || def.repair || def.burner);
}

/** Haulers on the road can only use storage they can reach by road. */
function roadBound(u) { return BOTS[u.type].roadOnly && !haulerStranded(u); }

function nearestReachableStore(u) {
  let best = null, bd = Infinity;
  for (const b of S.buildings) {
    if (b.dead || b.owner !== u.owner || !storeAccepts(b) || evacuated(b)) continue;
    if (roadBound(u) && !botLinked(u, b)) continue;
    const d = dist2(b.x + 0.5, b.y + 0.5, u.x, u.y);
    if (d < bd) { bd = d; best = b; }
  }
  return best;
}

function goHome(u) {
  const store = parkingFor(u);
  u.idleT = 0;
  if (store && goTo(u, store.x, store.y)) u.task = { type: 'home', bld: store.id };
}

/**
 * Where an idle bot waits: the nearest storage it can reach. Freight Trucks spread out: a store
 * keeps one idle truck, and an extra one goes to the nearest Command Base or Depot with none, so
 * spare trucks wait out along the network, ready for the long runs from there. With a truck at
 * every store, extras wait at the nearest.
 */
function parkingFor(u) {
  if (BOTS[u.type].rail) return nearestStation(u);
  if (!BOTS[u.type].truck) return nearestReachableStore(u);
  const parked = trucksParked(u.owner, u.id, !!BOTS[u.type].tanker);
  let near = null, nd = Infinity, empty = null, ed = Infinity;
  for (const b of S.buildings) {
    if (b.dead || b.owner !== u.owner || !storeAccepts(b) || !botLinked(u, b) || evacuated(b)) continue;
    const d = dist2(b.x + 0.5, b.y + 0.5, u.x, u.y);
    if (d < nd) { nd = d; near = b; }
    if (!parked.get(b.id) && d < ed) { ed = d; empty = b; }
  }
  return near && parked.get(near.id) && empty ? empty : near;
}

/** Idle Freight Trucks (or, with `tank`, Tankers) at each store (parked inside or on their way to park), other than `except`. */
function trucksParked(owner, except, tank) {
  const m = new Map();
  for (const v of S.bots) {
    if (v.dead || v.owner !== owner || v.id === except || !BOTS[v.type].truck || !!BOTS[v.type].tanker !== !!tank) continue;
    const at = v.task ? (v.task.type === 'home' ? v.task.bld : 0) : v.inside;
    if (at) m.set(at, (m.get(at) || 0) + 1);
  }
  return m;
}

/** Every 15 s, a spare truck waiting where others wait too moves on to a store with none, if there is one. */
function spreadTrucks(u) {
  const here = getE(u.inside);
  if (!here || !BDEFS[here.type].store || (u.bat ?? 100) < 50) return;
  const parked = trucksParked(u.owner, u.id, !!BOTS[u.type].tanker);
  if (!parked.get(here.id)) return;
  const to = parkingFor(u);
  if (to && to !== here && !parked.get(to.id) && goTo(u, to.x, to.y)) u.task = { type: 'home', bld: to.id };
}

function stashCarry(u) {
  let store = BOTS[u.type].rail ? nearestStation(u) : storeFor(u.owner, u.carry, u.x, u.y) || nearestStoreTo(u.owner, u.x, u.y);
  if (store && roadBound(u) && !botLinked(u, store)) store = nearestReachableStore(u);
  if (!store) return; // hold on to it until a road leads somewhere
  const n = u.carryN || 1;
  u.task = { type: 'haul', src: 0, dst: store.id, good: u.carry, phase: 'toDst', n };
  bump(store.inc, u.carry, n);
  if (!goTo(u, store.x, store.y)) { cancelTask(u); u.carry = null; u.carryN = 0; }
}

function doHaul(u, t, dt) {
  if (t.phase === 'toSrc') {
    const src = getE(t.src);
    if (!src || src.owner !== u.owner) { cancelTask(u); return; }
    if (!moveAlong(u, dt)) return;
    const n = t.n || 1;
    bump(src.res, t.good, -n);
    const dst = getE(t.dst);
    const got = Math.min(n, src.stock[t.good] || 0);
    if (got <= 0 || !dst) {
      if (dst) bump(dst.inc, t.good, -n);
      u.task = null;
      return;
    }
    if (got < n) bump(dst.inc, t.good, got - n);
    t.n = got;
    bump(src.stock, t.good, -got);
    if (src.loot && src.loot[t.good]) { src.loot[t.good] = Math.max(0, src.loot[t.good] - got); if (!src.loot[t.good]) delete src.loot[t.good]; }
    u.carry = t.good;
    u.carryN = got;
    t.phase = 'toDst';
    if (!goTo(u, dst.x, dst.y)) { bump(dst.inc, t.good, -got); u.task = null; dst.unreachUntil = S.time + 5; }
    return;
  }
  const dst = getE(t.dst);
  if (!dst || dst.owner !== u.owner) { cancelTask(u); return; }
  if (!moveAlong(u, dt)) return;
  bump(dst.inc, t.good, -(t.n || 1));
  bump(dst.stock, t.good, t.n || 1);
  u.carry = null;
  u.carryN = 0;
  u.task = null;
  u.idleT = 0;
  // A truck at far storage takes home what's waiting there instead of driving back empty.
  if (BOTS[u.type].truck && BDEFS[dst.type].store && backhaul(u, dst)) return;
  if (BDEFS[dst.type].store) enterBuilding(u, dst);
}

function deliveredCount(site) {
  const cost = siteCost(site);
  let n = 0;
  for (const g in cost) n += Math.min(site.stock[g] || 0, cost[g]);
  return n;
}

function doBuild(u, t, dt) {
  const s = getE(t.site);
  if (!s || s.built || s.owner !== u.owner) { cancelTask(u); return; }
  if (t.phase === 'go') {
    if (moveAlong(u, dt)) t.phase = 'work';
    return;
  }
  if (mustRecharge(u)) { cancelTask(u); return; } // go recharge; another builder takes over
  const def = BDEFS[s.type];
  const cap = deliveredCount(s) / sumValues(siteCost(s));
  if (s.progress < cap) {
    s.progress = Math.min(cap, s.progress + (dt * S.players[u.owner].mult * batFactor(u)) / (s.buildTime || def.buildTime));
    u.busy = 1;
  }
  if (s.progress >= 0.9999) {
    completeBuilding(s);
    u.task = null;
    u.idleT = 0;
  } else if (s.progress >= cap) {
    // Out of materials: go help with hauling; a builder is sent back when more arrive.
    cancelTask(u);
  }
}

function completeBuilding(b) {
  const def = BDEFS[b.type];
  if (!storeFunded(b)) { const c = siteCost(b); for (const g in c) usedGood(b.owner, g, c[g]); } // its materials are built in (a Wall's were counted when it was paid for)
  if (def.ramp) { completeRamp(b); return; }
  b.built = true;
  if (def.ropeway && !b.link) ropewayAcross(b);
  if (def.viaduct && !b.link) viaductAcross(b);
  b.progress = 1;
  b.stock = {};
  b.inc = {};
  b.res = {};
  b.builder = 0;
  b.armor = def.armor;
  b.born = S.time;
  // A priority set on the construction site was for building it: the finished building starts at Normal.
  if (b.sitePrio) { delete b.prio; delete b.sitePrio; }
  S.players[b.owner].stats.built++;
  markDirty(b.x, b.y);
  postMsg(b.owner, `${def.name} is complete.` + (def.roadworks && paveMode(b) === 'marked' && !roadsMarked(b.owner) ? ' Mark the roads it should pave in Paths (Pave).' : ''), b.x, b.y, 'good');
  if (b.owner === 0) sfx('complete');
  addFx('ring', b.x + 0.5, b.y + 0.5, { color: PLAYER_COLORS[b.owner] });
  if (def.mil) computeTerritory();
}

/** A finished Ramp turns its tile into a slope and the construction site disappears. */
function completeRamp(b) {
  releaseBotsFrom(b, false);
  b.dead = true;
  S.byId.delete(b.id);
  S.bAt[tIdx(b.x, b.y)] = 0;
  S.ramp[tIdx(b.x, b.y)] = 1;
  // A finished Ramp is a road tile too: haulers drive straight up it.
  S.road[tIdx(b.x, b.y)] = 1;
  S.pave[tIdx(b.x, b.y)] = 1;
  S.roadVer = (S.roadVer || 0) + 1;
  markDirty(b.x, b.y);
  for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) if (inMap(b.x + di, b.y + dj)) markDirty(b.x + di, b.y + dj);
  computeZones();
  S.players[b.owner].stats.built++;
  postMsg(b.owner, 'Ramp is complete: a road now climbs the cliff here.', b.x, b.y, 'good');
  if (b.owner === 0) sfx('complete');
  addFx('ring', b.x + 0.5, b.y + 0.5, { color: PLAYER_COLORS[b.owner] });
}

/** The nearest rock face (see rockFace) a Quarry's worker can cut Stone from, in its owner's or no-one's land. */
function findFace(b, radius) {
  let best = -1, bd = Infinity;
  const r2 = radius * radius + 0.3, zone = S.zone[tIdx(b.x, b.y)];
  for (let j = Math.max(0, b.y - radius); j <= Math.min(S.H - 1, b.y + radius); j++) {
    for (let i = Math.max(0, b.x - radius); i <= Math.min(S.W - 1, b.x + radius); i++) {
      const t = j * S.W + i, d = dist2(i, j, b.x, b.y);
      if (d > r2 || d >= bd || S.zone[t] !== zone || S.resRes[t] || (S.owner[t] >= 0 && S.owner[t] !== b.owner) || !rockFace(t)) continue;
      bd = d; best = t;
    }
  }
  return best;
}

function findNode(b, type, radius) {
  let best = -1, bd = Infinity;
  const r2 = radius * radius + 0.3;
  const zone = S.zone[tIdx(b.x, b.y)];
  for (let j = Math.max(0, b.y - radius); j <= Math.min(S.H - 1, b.y + radius); j++) {
    for (let i = Math.max(0, b.x - radius); i <= Math.min(S.W - 1, b.x + radius); i++) {
      const t = j * S.W + i;
      if (S.res[t] !== type || !S.amt[t] || S.resRes[t] || S.zone[t] !== zone) continue;
      if (S.owner[t] >= 0 && S.owner[t] !== b.owner) continue; // don't harvest on enemy land
      if ((type === R_STALK || type === R_CROP) && S.grow[t] < 1) continue;
      const d = dist2(i, j, b.x, b.y);
      if (d <= r2 && d < bd) { bd = d; best = t; }
    }
  }
  return best;
}

function findPlantSpot(b, radius) {
  let best = -1, bs = -Infinity;
  const r2 = radius * radius + 0.3;
  const zone = S.zone[tIdx(b.x, b.y)];
  for (let j = Math.max(0, b.y - radius); j <= Math.min(S.H - 1, b.y + radius); j++) {
    for (let i = Math.max(0, b.x - radius); i <= Math.min(S.W - 1, b.x + radius); i++) {
      const t = j * S.W + i;
      const d = dist2(i, j, b.x, b.y);
      if (d > r2 || d < 2.5) continue;
      if (S.terrain[t] !== T_GROUND || S.res[t] || S.bAt[t] || S.road[t] || S.plan[t] || S.resRes[t] || S.ramp[t] || S.fert[t] || S.zone[t] !== zone) continue;
      if (S.owner[t] !== b.owner) continue;
      let near = 0, blocked = false;
      for (let dj = -1; dj <= 1; dj++) for (let di = -1; di <= 1; di++) {
        if (!inMap(i + di, j + dj)) continue;
        const v = tIdx(i + di, j + dj);
        if (S.res[v] === R_STALK) near++;
        if (S.bAt[v]) blocked = true;
      }
      if (blocked) continue;
      const s = near * 2 - Math.sqrt(d) * 0.5 + hash2(i, j, S.tick) * 0.5;
      if (s > bs) { bs = s; best = t; }
    }
  }
  return best;
}

/** The nearest empty patch of fertile soil where a Bio Farm can plant a crop. */
function findCropSpot(b, radius) {
  let best = -1, bd = Infinity;
  const r2 = radius * radius + 0.3;
  const zone = S.zone[tIdx(b.x, b.y)];
  for (let j = Math.max(0, b.y - radius); j <= Math.min(S.H - 1, b.y + radius); j++) {
    for (let i = Math.max(0, b.x - radius); i <= Math.min(S.W - 1, b.x + radius); i++) {
      const t = j * S.W + i;
      if (!S.fert[t] || S.res[t] || S.bAt[t] || S.road[t] || S.plan[t] || S.resRes[t] || S.ramp[t] || S.zone[t] !== zone) continue;
      if (S.owner[t] !== b.owner) continue;
      const d = dist2(i, j, b.x, b.y);
      if (d <= r2 && d < bd) { bd = d; best = t; }
    }
  }
  return best;
}

/**
 * The nearest road tile (along the roads, from x, y) that needs asphalt (not surfaced yet, or worn
 * enough to resurface), anywhere on the road network joined to the Roadworks: its Paver follows the
 * roads as far as they go. A Roadworks set to marked roads only looks after the roads marked in Paths.
 */
const _pave = { seen: null, gen: 0, q: null };
function findPaveSpot(b, x, y) {
  const nets = buildingNets(b);
  if (!nets.length) return -1;
  const net = roadNet(), W = S.W, N = W * S.H;
  if (!_pave.seen || _pave.seen.length !== N) { _pave.seen = new Uint32Array(N); _pave.q = new Int32Array(N); _pave.gen = 0; }
  const seen = _pave.seen, q = _pave.q, gen = ++_pave.gen;
  let head = 0, tail = 0;
  const all = paveMode(b) === 'all';
  const push = (t) => { if (t >= 0 && t < N && seen[t] !== gen && roadLike(t) && nets.indexOf(net.comp[t]) >= 0) { seen[t] = gen; q[tail++] = t; } };
  // Start where the Paver is (or at the roads beside the Roadworks).
  push(tIdx(x, y));
  if (!tail) for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) if (inMap(b.x + di, b.y + dj)) push(tIdx(b.x + di, b.y + dj));
  while (head < tail) {
    const t = q[head++];
    if (needsPaving(t) && (all || S.paveMark[t]) && !S.resRes[t] && S.owner[t] === b.owner) return t;
    const i = t % W;
    for (const u of [i > 0 ? t - 1 : -1, i < W - 1 ? t + 1 : -1, t - W, t + W]) if (u >= 0 && u < N && canStep(t, u)) push(u);
  }
  return -1;
}

/** Count goods a player produced (for statistics and mission goals). */
function madeGood(owner, g, n) {
  const P = S.players[owner];
  P.made = P.made || {};
  P.made[g] = (P.made[g] || 0) + n;
}

/** Count goods a player used up: production inputs, construction, roads, Fuel burned, Ammo, Missiles. */
function usedGood(owner, g, n) {
  const P = S.players[owner];
  if (!P) return;
  P.used = P.used || {};
  P.used[g] = (P.used[g] || 0) + n;
}

/**
 * Made and used per minute for each good, over the last couple of minutes (from samples taken every
 * HIST_STEP seconds, plus the totals right now).
 */
function goodRates(p) {
  const P = S.players[p], log = P.rateLog || [], out = {};
  const old = log[0];
  const mins = old ? Math.max(0.25, (S.time - old.t) / 60) : Math.max(0.25, S.time / 60);
  for (const g of GOODS) {
    const made = ((P.made && P.made[g]) || 0) - ((old && old.made[g]) || 0);
    const used = ((P.used && P.used[g]) || 0) - ((old && old.used[g]) || 0);
    out[g] = { made: made / mins, used: used / mins };
  }
  return out;
}

/** A built Oil Pump whose seep has run dry: it can't pump again, so it's flagged for demolition. */
function pumpDry(b) { return !!BDEFS[b.type].pump && b.built && pumpSeep(b) < 0; }

/** The oil seep tile an Oil Pump draws from next (its own tile or a neighbour), or -1 if dry. */
function pumpSeep(b) {
  let best = -1, most = 0;
  for (let dj = -1; dj <= 1; dj++) for (let di = -1; di <= 1; di++) {
    if (!inMap(b.x + di, b.y + dj)) continue;
    const t = tIdx(b.x + di, b.y + dj);
    if (S.res[t] === R_OIL && S.amt[t] > most) { most = S.amt[t]; best = t; }
  }
  return best;
}

function doStaff(u, t, dt) {
  const b = getE(t.bld);
  if (!b || b.owner !== u.owner || !b.built) { cancelTask(u); return; }
  const def = BDEFS[b.type];
  const mult = S.players[u.owner].mult;
  switch (t.phase) {
    case 'go':
      if (moveAlong(u, dt)) {
        enterBuilding(u, b);
        b.staff = u.id;
        b.staffInc = 0;
        t.phase = 'in';
        t.wait = 0;
      }
      return;
    case 'in': {
      t.wait -= dt;
      if (t.wait > 0) return;
      if ((u.bat ?? 100) < BATTERY.low) {
        // Step out to recharge, then come back to this job.
        const c = findCharger(u);
        t.trip = false;
        if (c && goTo(u, c.x, c.y)) { t.phase = 'toCharge'; t.charger = c.id; return; }
        t.wait = 3;
      }
      if (!def.gather && !def.plant && !def.farm && !def.roadworks) return; // production happens in updateBuilding
      let node;
      if (def.gather) {
        // Ore Mines dig any uranium in reach first in a Nuclear race.
        let full = false;
        node = -1;
        for (const ty of gatherTypes(b.type)) {
          const g = RES[ty].good;
          if ((b.stock[g] || 0) >= def.out[g]) { full = true; continue; }
          node = findNode(b, ty, def.radius);
          if (node >= 0) { t.gtype = ty; break; }
        }
        if (node < 0 && full) { b.status = 'Storage full, waiting for pickup'; t.wait = 1; return; }
        t.face = false;
        if (node < 0 && def.bedrock) {
          // A Quarry out of boulders keeps going: Stone cut from a rock face in reach, or dug out of the ground,
          // while the colony is short of it (it rests once there's plenty in storage).
          const have = goodTotal(b.owner, 'stone');
          if (have >= def.bedrock.rest) { b.status = `Resting: you have ${have} Stone (it cuts more below ${def.bedrock.rest})`; t.wait = 3; return; }
          node = findFace(b, def.radius);
          t.gtype = def.gather;
          if (node < 0) { b.status = 'Digging Stone out of the ground (slow; it never runs out)'; t.phase = 'dig'; t.timer = def.bedrock.dig; return; }
          t.face = true;
          b.status = 'Cutting Stone from the rock face (it never runs out)';
        } else if (node < 0) { b.status = `No ${RES[def.gather].name.toLowerCase()}s left in reach`; t.wait = 3; return; }
        else b.status = 'Gathering ' + GOOD[RES[t.gtype].good].name;
      } else if (def.farm) {
        // Harvest ripe crops first, then plant any empty fertile soil.
        if ((b.stock.fuel || 0) >= def.out.fuel) { b.status = 'Storage full, waiting for pickup'; t.wait = 1; return; }
        node = findNode(b, R_CROP, def.radius);
        t.act = node >= 0 ? 'harvest' : 'plant';
        if (node < 0) node = findCropSpot(b, def.radius);
        if (node < 0) {
          b.status = countResIn(b.x, b.y, def.radius, R_CROP) ? 'Crops are ripening' : 'No fertile soil free in reach';
          t.wait = 2;
          return;
        }
        b.status = t.act === 'harvest' ? 'Harvesting energy crops' : 'Planting energy crops';
      } else if (def.roadworks) {
        node = findPaveSpot(b, b.x, b.y);
        if (node < 0) {
          b.status = paveMode(b) === 'all' ? 'Every joined road is asphalt, in good repair'
            : roadsMarked(b.owner) ? 'Every marked road is asphalt, in good repair' : 'No roads marked: mark roads to pave in Paths (Pave)';
          t.wait = 3;
          return;
        }
        if (!(b.charges > 0)) {
          if (!((b.stock.asphalt || 0) > 0)) { b.status = 'Waiting for Asphalt'; t.wait = 1; return; }
          bump(b.stock, 'asphalt', -1);
          b.charges = ASPHALT_TILES;
        }
        b.status = 'Laying asphalt';
      } else {
        if (reachableRes(b.x, b.y, def.radius, def.plant) >= 16) { b.status = 'The grove is full'; t.wait = 4; return; }
        node = findPlantSpot(b, def.radius);
        if (node < 0) { b.status = 'No room left to plant'; t.wait = 4; return; }
        b.status = 'Planting stalk groves';
      }
      t.trip = true; // out gathering: no off-road slowdown
      if (!goTo(u, node % S.W, (node / S.W) | 0)) { t.trip = false; t.wait = 2; return; }
      S.resRes[node] = 1;
      t.node = node;
      t.phase = 'toNode';
      return;
    }
    case 'toCharge': {
      const c = getE(t.charger);
      if (!c || c.owner !== u.owner) { t.phase = 'back'; if (!goTo(u, b.x, b.y)) { u.x = b.x + 0.5; u.y = b.y + 0.5; u.path = null; } return; }
      if (moveAlong(u, dt)) { enterBuilding(u, c); t.phase = 'charging'; }
      return;
    }
    case 'charging': {
      const c = getE(t.charger);
      if ((u.bat ?? 100) >= 99.5 || !c || chargerDry(c)) {
        t.phase = 'back';
        if (!goTo(u, b.x, b.y)) { exitBuilding(u); u.x = b.x + 0.5; u.y = b.y + 0.5; u.path = null; }
      }
      return;
    }
    case 'toNode':
      b.working = true;
      if (moveAlong(u, dt)) {
        t.phase = 'work';
        t.timer = t.face ? def.bedrock.face : def.gather ? RES[t.gtype || def.gather].harvest : def.farm ? (t.act === 'harvest' ? RES[R_CROP].harvest : 2) : def.roadworks ? 2.5 : 3;
      }
      return;
    case 'work': {
      u.busy = 1;
      b.working = true;
      t.timer -= dt * mult * batFactor(u);
      if (t.timer > 0) return;
      const node = t.node, ni = node % S.W, nj = (node / S.W) | 0;
      S.resRes[node] = 0;
      t.node = -1;
      if (def.gather && t.face) {
        // Cut from the rock face: Stone, and the face is still there for next time.
        u.carry = RES[def.gather].good;
        u.carryN = 1;
        madeGood(u.owner, u.carry, 1);
        addFx('smoke', ni + 0.5, nj + 0.5, { r: 0.35, life: 0.8 });
        t.face = false;
      } else if (def.gather) {
        const ty = t.gtype || def.gather;
        if (S.res[node] === ty && S.amt[node] > 0) {
          S.amt[node]--;
          if (S.amt[node] === 0) S.res[node] = R_NONE;
          markDirty(ni, nj);
          u.carry = RES[ty].good;
          u.carryN = 1;
          madeGood(u.owner, u.carry, 1);
        }
      } else if (def.farm) {
        if (t.act === 'harvest' && S.res[node] === R_CROP && S.grow[node] >= 1) {
          S.res[node] = R_NONE;
          S.amt[node] = 0;
          markDirty(ni, nj);
          u.carry = RES[R_CROP].good;
          u.carryN = 1;
          madeGood(u.owner, u.carry, 1);
        } else if (t.act === 'plant' && S.fert[node] && !S.res[node] && !S.bAt[node] && !S.road[node] && !S.plan[node]) {
          S.res[node] = R_CROP;
          S.amt[node] = 1;
          S.grow[node] = 0;
          markDirty(ni, nj);
        }
      } else if (def.roadworks) {
        if (needsPaving(node)) {
          if (S.pave[node] < 2) setPave(ni, nj, 2); else { S.wear[node] = 0; markDirty(ni, nj); }
          b.charges = Math.max(0, (b.charges || 0) - 1);
          S.players[u.owner].paved = (S.players[u.owner].paved || 0) + 1;
        }
        // Keep going along the paths while there's asphalt left in the hopper.
        if (b.charges > 0) {
          const next = findPaveSpot(b, ni, nj);
          if (next >= 0 && goTo(u, next % S.W, (next / S.W) | 0)) { S.resRes[next] = 1; t.node = next; t.phase = 'toNode'; return; }
        }
      } else if (!S.res[node] && !S.bAt[node] && !S.road[node] && !S.plan[node]) {
        S.res[node] = def.plant;
        S.amt[node] = RES[def.plant].amount;
        S.grow[node] = 0;
        markDirty(ni, nj);
      }
      t.phase = 'back';
      if (!goTo(u, b.x, b.y)) { u.x = b.x + 0.5; u.y = b.y + 0.5; u.path = null; }
      return;
    }
    case 'dig': {
      // Digging Stone out of the ground beside the Quarry: slow, but it never runs out.
      u.busy = 1;
      b.working = true;
      if ((b.stock.stone || 0) >= def.out.stone) { b.status = 'Storage full, waiting for pickup'; t.phase = 'in'; t.wait = 1; return; }
      t.timer -= dt * mult * batFactor(u);
      if (t.timer > 0) return;
      bump(b.stock, 'stone', 1);
      madeGood(u.owner, 'stone', 1);
      t.phase = 'in';
      t.wait = 0.3;
      return;
    }
    case 'back':
      if (u.carry) b.working = true;
      if (moveAlong(u, dt)) {
        enterBuilding(u, b);
        if (u.carry) { bump(b.stock, u.carry, 1); u.carry = null; u.carryN = 0; }
        t.phase = 'in';
        t.trip = false;
        t.wait = 0.3;
      }
      return;
  }
}

/* ------------------------------------------------------------------ buildings */

function updateBuilding(b, dt) {
  const def = BDEFS[b.type];
  // How busy is it? (statistics: last tick's working flag counts for this tick)
  if (b.built && tracksUse(def)) {
    b.upI = (b.upI || 0) + dt;
    b.upT = (b.upT || 0) + dt;
    if (b.working) { b.useI = (b.useI || 0) + dt; b.useT = (b.useT || 0) + dt; }
  }
  b.working = false;
  if (def.wild) { updateNest(b); return; }
  if (!b.built) {
    const owed = storeFunded(b) ? stillOwed(b) : null;
    if (owed && Object.keys(owed).length && !(b.builder && deliveredCount(b) / sumValues(siteCost(b)) > b.progress + 0.01)) b.status = `Waiting for ${costText(owed)} from storage`;
    else if (b.unlinked && sumValues(b.stock) < sumValues(siteCost(b))) b.status = 'No road to storage yet';
    else if (sumValues(b.stock) + sumValues(b.inc) === 0) b.status = 'Waiting for materials';
    else if (!b.builder) b.status = 'Waiting for a builder';
    else b.status = 'Under construction';
    return;
  }
  repairHint(b);
  if (b.paused) { b.status = 'Paused — its worker is free for other jobs'; return; }
  if (def.mil) b.status = `Garrison: ${b.garrison.length} of ${def.garrison} warbots`;
  else if (def.store) b.status = 'Storing goods';
  if (def.inp) produce(b, def, dt * S.players[b.owner].mult);
  else if (def.missile) updateSilo(b, def);
  else if (def.nukeSilo) updateNukeSilo(b, dt * S.players[b.owner].mult);
  else if (def.disrupt) updateDisruptor(b, def, dt);
  else if (def.mortar) updateMortar(b, def, dt);
  else if (def.ammo) updateTurret(b, def, dt);
  if (def.missile && b.reload > 0) b.reload = Math.max(0, b.reload - dt);
  if (def.charger && !def.store) {
    if (chargerDry(b)) {
      b.status = 'Out of Fuel: bots can\'t charge here';
      const P = S.players[b.owner];
      if (S.time - (P.lastFuelMsg || -999) > 120 && S.time - b.born > 20) {
        P.lastFuelMsg = S.time;
        postMsg(b.owner, 'A Charging Station is out of Fuel. Grow it at a Bio Farm on fertile soil, or pump oil and refine it.', b.x, b.y, 'warn');
      }
    } else {
      b.status = `Charging ${Math.min(b.charging || 0, def.charger.slots)} of ${def.charger.slots} bots` + ((b.charging || 0) > def.charger.slots ? ` (${b.charging - def.charger.slots} waiting)` : '');
      if (b.charging > 0) b.working = true;
    }
  }
  if (def.burner) updateGenerator(b, def);
  if (def.bunker) bunkerFire(b, def, dt);
  else if (def.mil) garrisonDefense(b, dt);
  if (def.repair) updateRepairStation(b, def, dt);
  if (def.lab) updateLab(b, dt);
  if (def.viaduct) {
    if (!b.link && b.viaTo >= 0 && S.tick % 60 === b.id % 60) viaductAcross(b);
    b.status = b.link ? 'Open: anything can drive across' : 'Waiting for the far end to be clear';
  }
  if (def.ropeway) {
    if (!b.link && b.ropeTo >= 0 && S.tick % 60 === b.id % 60) ropewayAcross(b);
    b.status = b.link ? 'Running: light bots ride across' : 'Waiting for the far end to be clear';
  }
  if ((def.gather || def.farm) && updateDepleted(b, def)) return;
  if (def.staff && !def.inp) {
    const op = getE(b.staff);
    const who = def.crew ? BOTS[def.crew].name : 'Worker';
    if (!op) {
      b.status = b.staffInc ? `${who} on the way` : `Needs ${aOrAn(def.crew ? who : 'worker')}`;
      if (!b.staffInc && def.crew && !S.bots.some((v) => !v.dead && v.owner === b.owner && v.type === def.crew)) b.status += ': order one at the Bot Foundry';
    }
  }
}

/**
 * A gatherer or Bio Farm with nothing left to work in reach (checked every couple of seconds):
 * flagged so the map shows an icon over it, its worker freed, and the player told once. If
 * resources come back in reach (a Grove Planter's new groves), it goes back to work.
 */
function updateDepleted(b, def) {
  if (def.bedrock) { b.depleted = false; return false; } // a Quarry always has Stone to cut or dig
  if (S.tick % 60 === b.id % 60) {
    b.depleted = def.gather ? gatherReach(b.x, b.y, b.type) === 0
      : fertileIn(b.x, b.y, def.radius) === 0 && reachableRes(b.x, b.y, def.radius, R_CROP) === 0;
    if (b.depleted && !b.dryMsg && S.time - b.born > 20) {
      b.dryMsg = 1;
      postMsg(b.owner, def.gather
        ? `Your ${def.name} has no ${RES[def.gather].name.toLowerCase()}s left in reach. Demolish it for half its materials back, and build one by a fresh field.`
        : 'Your Bio Farm has no fertile soil left in reach. Demolish it and build one beside open fertile soil.', b.x, b.y, 'warn');
    }
    if (!b.depleted) b.dryMsg = 0;
  }
  if (!b.depleted) return false;
  b.status = def.gather ? `No ${RES[def.gather].name.toLowerCase()}s left in reach: demolish it` : 'No fertile soil left in reach: demolish it';
  if (b.staff || b.staffInc) unstaff(b);
  return true;
}

/** Buildings whose busy time is tracked for statistics. */
function tracksUse(def) { return !!(def.staff || (def.charger && !def.store) || (def.ammo && !def.missile) || def.repair || def.burner); }

/**
 * A Generator (see BDEFS.generator): once a second, if anything that makes goods within its reach is
 * working, it burns its Fuel (one every perFuel seconds) and powers them all for the next second.
 */
function updateGenerator(b, def) {
  if ((S.tick + b.id) % 30) { if (b.powered > S.time) b.working = true; return; }
  const G = def.burner, step = 30 * SIM_STEP, r2 = G.radius * G.radius, near = [];
  let busy = 0;
  for (const c of S.buildings) {
    if (c === b || c.dead || c.owner !== b.owner || !c.built || !BDEFS[c.type].work) continue;
    if (dist2(c.x, c.y, b.x, b.y) > r2) continue;
    near.push(c);
    if (c.working || /^Working/.test(c.status || '')) busy++;
  }
  if (!near.length) { b.status = 'Nothing in reach to power: build it among your factories'; return; }
  if (!busy) { b.status = `Idle: nothing in reach is working (${near.length} building${near.length === 1 ? '' : 's'} in reach)`; return; }
  if (!((b.energy || 0) > 0)) {
    if (!(b.stock.fuel > 0)) { b.status = 'Out of Fuel: a Tanker brings it'; return; }
    bump(b.stock, 'fuel', -1); usedGood(b.owner, 'fuel', 1);
    b.energy = G.perFuel;
  }
  b.energy -= step;
  b.powered = S.time + step + 0.1;
  b.working = true;
  b.status = `Powering ${busy} working building${busy === 1 ? '' : 's'} (${near.length} in reach)`;
  for (const c of near) c.boostUntil = S.time + step + 0.15;
}

function produce(b, def, dt) {
  if (def.pump && pumpSeep(b) < 0) {
    // Dry for good: free its worker, and tell the player once.
    b.status = 'The oil seep has run dry: demolish this pump';
    if (b.staff || b.staffInc) unstaff(b);
    if (!b.dryMsg) {
      b.dryMsg = 1;
      postMsg(b.owner, 'An Oil Pump has run dry. Demolish it for half its materials back, and pump another seep.', b.x, b.y, 'warn');
    }
    return;
  }
  const op = getE(b.staff);
  if (!op && !b.staffInc && atLimit(b)) {
    const g = limitGood(b);
    b.status = `Stopped: you have ${goodTotal(b.owner, g)} ${GOOD[g].name} (limit ${stockLimit(b)}); its worker is free for other jobs`;
    return;
  }
  if (!op || op.inside !== b.id) {
    const charging = op && op.task && (op.task.phase === 'toCharge' || op.task.phase === 'charging');
    b.status = charging ? 'Worker is recharging' : b.staffInc || op ? 'Worker on the way' : 'Needs a worker';
    return;
  }
  if (def.bots && b.mode === 'off' && !hasOrders(b)) { b.status = 'Idle: tap it to order bots'; return; }
  if (!b.timer && atLimit(b)) {
    const g = limitGood(b);
    b.status = `Stopped: you have ${goodTotal(b.owner, g)} ${GOOD[g].name} (limit ${stockLimit(b)})`;
    // After a little while its worker goes off to other jobs; one comes back when it's needed.
    b.limitT = (b.limitT || 0) + dt;
    if (b.limitT > 10) { unstaff(b); b.limitT = 0; }
    return;
  }
  b.limitT = 0;
  dt *= batFactor(op);
  for (const g in def.inp) {
    if ((b.stock[g] || 0) < def.inp[g]) { b.status = 'Waiting for ' + GOOD[g].name; return; }
  }
  if (def.make) {
    for (const g in def.make) {
      if ((b.stock[g] || 0) + def.make[g] > def.out[g]) { b.status = 'Output full, waiting for pickup'; return; }
    }
  }
  if (def.bots && botCount(b.owner) >= (S.mode === 'colony' ? MAX_BOTS_COLONY : MAX_BOTS)) { b.status = 'Bot limit reached'; return; }
  b.status = b.boostUntil > S.time ? 'Working (powered by a Generator)' : 'Working';
  b.working = true;
  b.timer += dt * (b.boostUntil > S.time ? 1 + BDEFS.generator.burner.boost : 1);
  if (b.timer < def.work) return;
  b.timer = 0;
  for (const g in def.inp) { bump(b.stock, g, -def.inp[g]); usedGood(b.owner, g, def.inp[g]); }
  if (def.pump) {
    const seep = pumpSeep(b);
    if (--S.amt[seep] <= 0) { S.amt[seep] = 0; S.res[seep] = R_NONE; markDirty(seep % S.W, (seep / S.W) | 0); }
  }
  if (def.make) {
    for (const g in def.make) { bump(b.stock, g, def.make[g]); madeGood(b.owner, g, def.make[g]); }
    const g0 = Object.keys(def.make)[0];
    addFx('float', b.x + 0.5, b.y + 0.1, { text: '+' + def.make[g0], color: GOOD[g0].color });
  }
  if (def.bots) {
    // Big bots (Freight Trucks) take several rounds of parts before they roll out. Parts are kept
    // per kind, so changing the orders halfway through a truck doesn't throw its parts away.
    const kind = nextBotKind(b), have = foundryParts(b, kind) + 1;
    if (have >= ((BOTS[kind] && BOTS[kind].parts) || 1)) { delete b.partsBy[kind]; spawnFromFoundry(b); }
    else b.partsBy[kind] = have;
  }
  if (b.owner === 0) sfx('produce');
}

function hasOrders(b) {
  if (!b.orders) return false;
  for (const k in b.orders) if (b.orders[k] > 0) return true;
  return false;
}

/** Rounds of parts the Foundry has already put into its next `kind` of bot. */
function foundryParts(b, kind) {
  if (!b.partsBy) b.partsBy = {};
  if (b.parts) { b.partsBy[nextBotKind(b)] = b.parts; b.parts = 0; } // a save from before parts were kept per kind
  return b.partsBy[kind] || 0;
}

/** What the Foundry builds next: queued orders first (types take turns), then its standing mode. */
function nextBotKind(b) {
  if (hasOrders(b)) {
    const start = b.rr || 0;
    for (let i = 0; i < BOT_ORDER.length; i++) {
      const k = BOT_ORDER[(start + i) % BOT_ORDER.length];
      if (b.orders[k] > 0) return k;
    }
  }
  return b.mode === 'alt' ? b.altNext : b.mode;
}

function spawnFromFoundry(b) {
  const kind = nextBotKind(b);
  const P = S.players[b.owner];
  P.madeBots = P.madeBots || {};
  P.madeBots[kind] = (P.madeBots[kind] || 0) + 1;
  if (hasOrders(b)) {
    b.orders[kind]--;
    b.rr = (BOT_ORDER.indexOf(kind) + 1) % BOT_ORDER.length;
    if (!hasOrders(b)) {
      delete b.orders;
      postMsg(b.owner, 'The Bot Foundry finished its production orders.', b.x, b.y, 'good');
    }
  } else if (b.mode === 'alt') {
    b.altNext = kind === 'worker' ? 'warbot' : 'worker';
  }
  const u = addBot(b.owner, kind, b.x, b.y);
  addFx('ring', b.x + 0.5, b.y + 0.5, { color: PLAYER_COLORS[b.owner] });
  if (kind === 'warbot') goGarrison(u);
}

/** The rivals still in the game (a Versus game's AI colonies), for the hidden boost menu. */
function boostableRivals() {
  if (!S || S.mode === 'colony') return [];
  return S.players.filter((P) => P.id !== 0 && !P.out && !P.absent && getE(P.lander) && !getE(P.lander).dead);
}

/**
 * The hidden rival boost: give rival p a supply drop ('goods'), armed warbots or workers at its
 * Command Base (BOOST). Returns how many goods or robots it got (robots stop at the bot limit).
 */
function boostRival(p, kind) {
  const P = S.players[p], L = P && getE(P.lander);
  if (!L || L.dead || P.out) return 0;
  let n = 0;
  if (kind === 'goods') {
    for (const g in BOOST.goods) { bump(L.stock, g, BOOST.goods[g]); n += BOOST.goods[g]; }
  } else if (kind === 'warbots' || kind === 'workers') {
    const type = kind === 'warbots' ? 'warbot' : 'worker', cap = S.mode === 'colony' ? MAX_BOTS_COLONY : MAX_BOTS;
    for (let k = 0; k < BOOST[kind] && botCount(p) < cap; k++) {
      const u = addBot(p, type, L.x, L.y);
      if (type === 'warbot') { u.ammo = WARBOT_AMMO; goGarrison(u); }
      n++;
    }
  }
  if (n) { P.boosts = (P.boosts || 0) + 1; addFx('ring', L.x + 0.5, L.y + 0.5, { color: PLAYER_COLORS[p] }); }
  return n;
}

/**
 * A Pulse Turret keeps tracking its target, turns its head toward it at TURRET_TURN radians per
 * second and fires only once it is lined up. With nothing in range it sweeps slowly back and forth.
 * It charges for PULSE_CHARGE seconds before each shot (b.chg, drawn as energy gathering at the
 * muzzle); the charge starts while it reloads, so only a first shot at a target already in its
 * sights waits for it.
 */
const PULSE_CHARGE = 0.45;
/** Where a Pulse Turret's beam leaves its barrel, turned to `aim`. */
function pulseMuzzle(b, aim) { return { x: b.x + 0.5 + Math.cos(aim) * 0.36, y: b.y + 0.5 + Math.sin(aim) * 0.36 }; }

function updateTurret(b, def, dt) {
  b.cd -= dt;
  b.scanT = (b.scanT || 0) - dt;
  const cx = b.x + 0.5, cy = b.y + 0.5, range = turretRange(b), r2 = range * range;
  let target = b.tgt ? getE(b.tgt) : null;
  if (target && (target.dead || target.inside || dist2(target.x, target.y, cx, cy) > r2)) target = null;
  if (!target && b.scanT <= 0) { b.scanT = 0.3; target = nearestEnemyBot(b.owner, cx, cy, range, true); }
  b.tgt = target ? target.id : 0;
  const ammo = b.shots + (b.stock.crystal || 0) * shotsPer(b);
  if (!target) {
    b.chg = 0;
    b.sweepT = (b.sweepT || 0) + dt;
    if (b.sweepT > 4) { b.sweepT = 0; b.sweep = -(b.sweep || 1); }
    b.aim = wrapAngle(b.aim + (b.sweep || 1) * TURRET_SWEEP * dt);
    b.status = ammo ? `Watching (${ammo} shots)` : 'Needs Crystal for ammo';
    return;
  }
  const want = Math.atan2(target.y - cy, target.x - cx);
  const diff = wrapAngle(want - b.aim), turn = TURRET_TURN * dt;
  b.aim = wrapAngle(b.aim + Math.max(-turn, Math.min(turn, diff)));
  b.working = true;
  const loaded = b.shots > 0 || (b.stock.crystal || 0) > 0;
  b.chg = loaded && b.cd <= PULSE_CHARGE ? Math.min(PULSE_CHARGE, (b.chg || 0) + dt) : 0;
  if (Math.abs(diff) > 0.15) { b.status = 'Turning to aim'; return; }
  if (b.cd > 0) return;
  if (loaded && b.chg < PULSE_CHARGE - 1e-6) { b.status = 'Charging'; return; }
  if (b.shots <= 0) {
    if ((b.stock.crystal || 0) > 0) { bump(b.stock, 'crystal', -1); usedGood(b.owner, 'crystal', 1); b.shots = shotsPer(b); }
    else { b.status = 'Out of ammo!'; b.cd = 0.5; return; }
  }
  b.shots--;
  b.status = 'Firing';
  // The blast: a thick electric beam from the muzzle, crackling arcs round it, a burst where it hits.
  const m = pulseMuzzle(b, b.aim), color = PLAYER_COLORS[b.owner];
  addFx('pulsebeam', m.x, m.y, { x2: target.x, y2: target.y, color, life: 0.4, seed: S.tick + b.id });
  addFx('pulsehit', target.x, target.y, { color, life: 0.4, seed: S.tick + b.id * 3 });
  shotFx(m.x - Math.cos(b.aim) * 0.32, m.y - Math.sin(b.aim) * 0.32, target.x, target.y, { color, pulse: true });
  sfx('laser');
  damageBot(target, 4);
  b.cd = 1.1;
  b.chg = 0;
}

/**
 * A Bunker: each armed warbot inside shoots the nearest enemy robot within range (warbots first)
 * every BUNKER_FIRE seconds, with its own Ammo, from cover. (They reload from the Bunker's Ammo and
 * recharge inside, like any garrison: see updateWarbot.)
 */
function bunkerFire(b, def, dt) {
  b.cd = (b.cd || 0) - dt;
  if (b.cd > 0) return;
  b.cd = BUNKER_FIRE;
  const cx = b.x + 0.5, cy = b.y + 0.5;
  const target = nearestEnemyBot(b.owner, cx, cy, def.range, true);
  if (!target) return;
  let fired = 0;
  for (const id of b.garrison) {
    const u = getE(id);
    if (!u || u.dead || target.dead || !useAmmo(u)) continue;
    const power = (u.bat ?? 100) < BATTERY.critical ? 0.5 : 1;
    damageBot(target, Math.max(1, Math.round((2 + (hash2(u.id, S.tick, 7) < 0.5 ? 1 : 0)) * power)));
    // One gun each side of the slit (the muzzles in the Bunker's art: 219 and 293, 373.5 px of its 512 canvas at scale 1.2).
    shotFx(cx + (fired ? 0.087 : -0.087), cy + 0.137, target.x, target.y, { color: PLAYER_COLORS[b.owner] });
    fired++;
  }
  if (!fired) { b.status = 'Out of Ammo: haulers bring it from storage'; return; }
  b.aim = Math.atan2(target.y - cy, target.x - cx);
  b.flash = S.time;
  b.working = true;
  b.status = `Firing (${fired} warbot${fired > 1 ? 's' : ''})`;
  if (b.owner === 0 || target.owner === 0) sfx('hit');
}

/** A Disruptor Tower: a pulse that drains enemy robots' batteries in range, burning Fuel (see BDEFS.disruptor). */
function updateDisruptor(b, def, dt) {
  const d = def.disrupt;
  b.cd = (b.cd || 0) - dt;
  if (b.cd > 0) return;
  const cx = b.x + 0.5, cy = b.y + 0.5, r2 = def.range * def.range;
  const hit = S.bots.filter((u) => !u.dead && !u.inside && u.owner !== b.owner && !BOTS[u.type].wild && !BOTS[u.type].rail && dist2(u.x, u.y, cx, cy) <= r2);
  if (!hit.length) { b.status = (b.pulses || 0) + (b.stock.fuel || 0) > 0 ? 'Watching for enemy robots' : 'No Fuel: haulers bring it from storage'; b.cd = 0.5; return; }
  if (!(b.pulses > 0)) {
    if (!((b.stock.fuel || 0) > 0)) { b.status = 'No Fuel to pulse with: haulers bring it from storage'; b.cd = 1; return; }
    bump(b.stock, 'fuel', -1);
    usedGood(b.owner, 'fuel', 1);
    b.pulses = d.perFuel;
  }
  b.pulses--;
  b.cd = d.every;
  b.working = true;
  b.flash = S.time;
  b.status = `Draining ${hit.length} enemy robot${hit.length > 1 ? 's' : ''}`;
  for (const u of hit) {
    u.bat = Math.max(0, (u.bat ?? 100) - d.drain);
    arcFx(cx, cy - 0.62, u.x, u.y); // from the orb (71 px down its 512 canvas, at scale 1.3)
    addFx('spark', u.x, u.y, { color: '#8fd8ff' });
  }
  addFx('ring', cx, cy, { color: '#8fd8ff', r: def.range / 1.3, life: 0.6 }); // grows out to its range
  if (b.owner === 0 || hit.some((u) => u.owner === 0)) sfx('zap');
}

/**
 * A Mortar Pit: every `reload` seconds it lobs a shell at the spot in range (but not too close) where
 * the most enemy robots stand within `splash` of it, warbots counting double. Shells fly `flight`
 * seconds (see shellImpact); one Ammo makes `shells` shells.
 */
function updateMortar(b, def, dt) {
  const m = def.mortar;
  b.cd = (b.cd || 0) - dt;
  if (b.cd > 0) return;
  const cx = b.x + 0.5, cy = b.y + 0.5, r2 = def.range * def.range, min2 = def.minRange * def.minRange, s2 = m.splash * m.splash;
  const foes = S.bots.filter((u) => !u.dead && !u.inside && u.owner !== b.owner && !BOTS[u.type].rail);
  let best = null, bs = 0;
  for (const u of foes) {
    const d = dist2(u.x, u.y, cx, cy);
    if (d > r2 || d < min2) continue;
    let s = 0;
    for (const v of foes) if (dist2(u.x, u.y, v.x, v.y) <= s2) s += v.type === 'warbot' ? 2 : 1;
    if (s > bs) { bs = s; best = u; }
  }
  if (!best) { b.status = (b.shells || 0) + (b.stock.ammo || 0) > 0 ? 'Watching for targets (3 to 10 tiles out)' : 'No Ammo: haulers bring it from storage'; b.cd = 0.5; return; }
  if (!(b.shells > 0)) {
    if (!((b.stock.ammo || 0) > 0)) { b.status = 'No Ammo for shells: haulers bring it from storage'; b.cd = 1; return; }
    bump(b.stock, 'ammo', -1);
    usedGood(b.owner, 'ammo', 1);
    b.shells = m.shells;
  }
  b.shells--;
  b.cd = m.reload;
  b.aim = Math.atan2(best.y - cy, best.x - cx);
  b.flash = S.time;
  b.working = true;
  b.status = 'Firing';
  S.missiles.push({ owner: b.owner, from: b.id, shell: true, t: 0, dur: m.flight, x0: cx, y0: cy, x1: best.x, y1: best.y });
  addFx('muzzle', cx + Math.cos(b.aim) * 0.2, cy + Math.sin(b.aim) * 0.2 - 0.35, { a: -Math.PI / 2, color: '#ffd27a', life: 0.12, big: true });
  addFx('smoke', cx + Math.cos(b.aim) * 0.3, cy + Math.sin(b.aim) * 0.3 - 0.2, { r: 0.4, life: 0.9 });
  sfx('thump');
}

/** A mortar shell lands: it hurts every rival robot in the open within the splash, most at the middle. */
function shellImpact(m) {
  const md = BDEFS.mortar.mortar;
  blastFx(m.x1, m.y1, md.splash * 0.5, { small: true });
  sfx('boom');
  for (const u of S.bots) {
    if (u.dead || u.inside || u.owner === m.owner) continue;
    const d2 = dist2(u.x, u.y, m.x1, m.y1);
    if (d2 > md.splash * md.splash) continue;
    damageBot(u, d2 <= 0.36 ? md.damage : md.splashDamage);
  }
}

/** Military buildings send warbots out when enemy warbots come close. */
function garrisonDefense(b, dt) {
  b.cd -= dt;
  if (b.cd > 0) return;
  b.cd = 0.5;
  if (!b.garrison.length) return;
  const cx = b.x + 0.5, cy = b.y + 0.5;
  let threats = 0, out = 0;
  for (const u of S.bots) {
    if (u.dead || u.inside) continue;
    if (u.owner !== b.owner) {
      if ((u.type === 'warbot' || BOTS[u.type].wild) && dist2(u.x, u.y, cx, cy) < 42) threats++;
    } else if (u.task && u.task.type === 'defend' && u.task.home === b.id) out++;
  }
  // Guards go out against enemy warbots (one more than there are), not to patrol; when the walls are
  // about to fall (under SORTIE_ARMOR of its armor), every armed warbot inside goes out.
  let want = !threats ? 0 : b.armor < BDEFS[b.type].armor * SORTIE_ARMOR ? armedIn(b) : Math.min(armedIn(b), threats + 1 - out);
  while (want-- > 0) {
    const u = takeArmed(b); // only warbots with Ammo go out to fight
    if (!u) break;
    u.inside = 0;
    u.task = { type: 'defend', home: b.id };
    u.path = null;
  }
}

/* ------------------------------------------------------------------ warbots & combat */

/**
 * Send a warbot to the military building that most needs it, favouring the front line and the
 * player's garrison priority (b.gprio 'high' / 'low').
 */
function goGarrison(u) {
  const enemyL = getE(S.players[rivalOf(u.owner)].lander);
  let best = null, bs = Infinity, spare = null, ss = Infinity;
  for (const b of S.buildings) {
    if (b.dead || b.owner !== u.owner || !b.built || !BDEFS[b.type].mil || evacuated(b)) continue;
    if (u.avoidB === b.id && S.time < u.avoidUntil) continue;
    const cap = BDEFS[b.type].garrison;
    const n = b.garrison.length + b.garInc;
    if (n >= cap) continue;
    const front = enemyL ? dist(b.x, b.y, enemyL.x, enemyL.y) : 0;
    const keep = keepAt(b);
    // The player's garrison priority: High ones fill first, Low ones only when the rest are full; and
    // every garrison fills up to its Keep before any goes past it.
    const pr = (b.gprio === 'high' ? -30 : b.gprio === 'low' ? 30 : 0) + (n < keep ? -60 : 0) +
      ((u.ammo ?? WARBOT_AMMO) <= 0 && !(b.stock.ammo > 0) ? 25 : 0); // out of Ammo: go where it can reload
    const s = (n / Math.min(cap, 10)) * 12 + front * 0.25 + dist(b.x, b.y, u.x, u.y) * 0.05 + pr;
    // A garrison set to keep none isn't stocked: only if nowhere else has room.
    if (keep === 0 && b.type !== 'lander') { if (s < ss) { ss = s; spare = b; } continue; }
    if (s < bs) { bs = s; best = b; }
  }
  best = best || spare;
  if (!best) return;
  u.task = { type: 'garrison', bld: best.id };
  best.garInc++;
}

/** An angle folded into -π..π. */
function wrapAngle(a) { return Math.atan2(Math.sin(a), Math.cos(a)); }

function damageBot(u, dmg) {
  u.hp -= dmg;
  u.hurtT = S.time;
  if (u.hp <= 0) killBot(u);
}

function hitBuilding(b, dmg, by) {
  b.armor -= dmg;
  b.lastHit = S.time;
  if (by >= 0 && by !== b.owner) (S.players[b.owner].hitBy = S.players[b.owner].hitBy || {})[by] = S.time; // remembered: see rivalOf
  if (S.time - b.lastAlert > 12) {
    b.lastAlert = S.time;
    postMsg(b.owner, `Enemy warbots are attacking your ${BDEFS[b.type].name}!`, b.x, b.y, 'bad');
    if (b.owner === 0) sfx('alert');
  }
  if (b.armor <= 0) captureBuilding(b, by);
}

function captureBuilding(b, by) {
  const def = BDEFS[b.type], old = b.owner;
  if (def.wild) { clearNest(b, by); return; }
  if (def.bunker && b.built) {
    // There's no land to take: a fallen Bunker is wrecked, and the warbots inside walk out.
    dropLoot(b);
    postMsg(by, 'Your warbots wrecked an enemy Bunker.', b.x, b.y, 'good');
    postMsg(old, 'Enemy warbots wrecked your Bunker!', b.x, b.y, 'bad');
    destroyBuilding(b, false);
    return;
  }
  const name = def.name;
  if (!b.built) {
    (S.players[old].avoid = S.players[old].avoid || []).push({ x: b.x, y: b.y, until: S.time + 150 });
    postMsg(by, `Your warbots wrecked an enemy construction site.`, b.x, b.y, 'good');
    postMsg(old, `Enemy warbots wrecked your ${name} construction site.`, b.x, b.y, 'bad');
    destroyBuilding(b, true);
    return;
  }
  releaseBotsFrom(b, false); // whoever was inside (out of Ammo, or the crew) flees: they aren't killed
  delete b.prio; delete b.smode; delete b.reject; b.paused = false;
  b.fixLeft = 0; b.fixer = 0;
  b.owner = by;
  b.armor = Math.max(4, def.armor * 0.4);
  b.lastHit = S.time;
  b.timer = 0;
  b.mode = S.players[by].ai ? 'alt' : 'off';
  S.players[by].stats.captured++;
  addFx('ring', b.x + 0.5, b.y + 0.5, { color: PLAYER_COLORS[by], r: 2 });
  sfx('capture');
  // Only a colony's own Command Base knocks it out; one it captured earlier just changes hands.
  if (b.type === 'lander' && S.players[old].lander === b.id) {
    eliminate(old, by);
    return;
  }
  if (def.mil) {
    S.players[by].stats.outposts = (S.players[by].stats.outposts || 0) + 1;
    postMsg(by, `Your warbots captured the enemy ${name}!`, b.x, b.y, 'good');
    postMsg(old, `The enemy captured your ${name}!`, b.x, b.y, 'bad');
    computeTerritory();
  } else {
    if (def.explodes) burnLiquids(b); // a Refinery's Crude and Fuel go up with it
    const n = dropLoot(b);
    postMsg(by, `Your warbots wrecked the enemy ${name}.` + (n ? ` ${n} good${n === 1 ? '' : 's'} spilled out in crates: your warbots carry them home, one each.` : ''), b.x, b.y, 'good');
    postMsg(old, `Enemy warbots wrecked your ${name}!` + (n ? ' What was inside spilled out in crates: your haulers collect them once the enemy has gone, unless the raiders carry them off first.' : ''), b.x, b.y, 'bad');
    destroyBuilding(b, true);
  }
}

/* ------------------------------------------------------------------ fuel blasts */

/**
 * A fuel blast at (x, y) (see BLAST): `kind` is 'tanker' or 'refinery', `full` how full it was (0–1).
 * It hurts every robot out in the open and every building in reach, anyone's, less towards the edge;
 * loaded Tankers and Refineries holding Crude or Fuel aren't just hurt, they go up a moment later.
 * Forts (Outposts, Command Bases) are never knocked out by a blast: they keep at least 1 armor.
 */
function fuelBlast(x, y, kind, full, owner) {
  const B = BLAST[kind], r = B.r0 + B.r1 * clamp(full || 0, 0, 1), r2 = r * r, rb = r + 0.5;
  blastFx(x, y, r);
  blastFx(x + 0.2, y - 0.25, r * 0.6, { small: true, delay: 0.18 });
  addFx('smoke', x, y - 0.2, { r: r * 0.9, life: 5, dark: true });
  sfx('boom');
  const later = (k) => S.time + BLAST.chain[0] + (BLAST.chain[1] - BLAST.chain[0]) * hash2(Math.floor(x * 13) + k, Math.floor(y * 7), S.tick);
  for (const u of S.bots) {
    if (u.dead || u.inside || u.blowAt > 0) continue;
    const d2 = dist2(u.x, u.y, x, y);
    if (d2 > r2) continue;
    if (BOTS[u.type].tanker && u.carry && u.carryN > 0) { u.blowAt = later(u.id); S.blowing = (S.blowing || 0) + 1; continue; }
    damageBot(u, B.bot * (1 - (0.5 * Math.sqrt(d2)) / r));
  }
  for (const b of S.buildings.slice()) {
    if (b.dead || b.blowAt > 0) continue;
    const d2 = dist2(b.x + 0.5, b.y + 0.5, x, y);
    if (d2 > rb * rb) continue;
    if (BDEFS[b.type].explodes && b.built && liquidIn(b) > 0) { b.blowAt = later(b.id); S.blowing = (S.blowing || 0) + 1; continue; }
    b.armor -= B.bld * (1 - (0.5 * Math.sqrt(d2)) / rb);
    b.lastHit = S.time;
    if (b.armor > 0) continue;
    if (b.built && BDEFS[b.type].mil) { b.armor = 1; continue; }
    postMsg(b.owner, `An explosion wrecked your ${BDEFS[b.type].name}!`, b.x, b.y, 'bad');
    destroyBuilding(b, true);
  }
  if (typeof blastPipes === 'function') blastPipes(x, y, r);
}

/** Crude and Fuel held in building b (what feeds a Refinery's blast). */
function liquidIn(b) { return (b.stock && ((b.stock.crude || 0) + (b.stock.fuel || 0))) || 0; }

/**
 * A Refinery about to be wrecked: its Crude and Fuel burn (they don't spill as crates), and how full
 * it was sets the size of its blast. Kept on b.boomFull for destroyBuilding.
 */
function burnLiquids(b) {
  if (b.boomFull !== undefined) return b.boomFull;
  const def = BDEFS[b.type], cap = INPUT_CAP + ((def.out && def.out.fuel) || 0) + ((def.out && def.out.crude) || 0);
  b.boomFull = Math.min(1, liquidIn(b) / Math.max(1, cap));
  delete b.stock.crude; delete b.stock.fuel;
  return b.boomFull;
}

/** Chain reactions: Tankers and Refineries caught in a blast go up when their moment comes. */
function updateBlasts() {
  let left = 0;
  for (const u of S.bots) {
    if (!(u.blowAt > 0)) continue;
    if (u.dead) { u.blowAt = 0; continue; }
    if (S.time < u.blowAt) { left++; continue; }
    u.blowAt = 0;
    if (u.carry && u.carryN > 0) killBot(u);
  }
  for (const b of S.buildings) {
    if (!(b.blowAt > 0)) continue;
    if (b.dead) { b.blowAt = 0; continue; }
    if (S.time < b.blowAt) { left++; continue; }
    b.blowAt = 0;
    postMsg(b.owner, `Your ${BDEFS[b.type].name} caught fire in the blast and exploded!`, b.x, b.y, 'bad');
    destroyBuilding(b, true);
  }
  S.blowing = left;
}

/*
 * Loot and crates. Goods inside a building that is wrecked, blown up or demolished spill out as a
 * pile of crates on its tile, and a robot destroyed with a load drops it the same way. On your own
 * land your haulers collect the crates and take them to storage, a load at a time, as long as no
 * enemy robot is near (see dispatch, step 4d). Any warbot near a pile with nothing better to do
 * picks up one crate and carries it to its side's nearest garrison (Outpost or Command Base); a
 * warbot shot down while carrying drops its crate. Crates in an Outpost are taken on to storage by
 * Haulers. A pile on no-one's land rots away after LOOT_TIME; on claimed land it stays.
 */
function dropLoot(b) {
  let n = 0;
  const goods = {};
  for (const g in b.stock) {
    const k = Math.min(Math.floor(b.stock[g] || 0), LOOT_MAX - n);
    if (k > 0 && GOOD[g]) { goods[g] = k; n += k; b.stock[g] -= k; }
  }
  if (b.loot) b.loot = null;
  if (n) addLoot(b.x, b.y, goods);
  return n;
}

/** A robot's load (a hauler's or truck's goods) put down in crates where it stands. */
function dropCarried(u) {
  if (u.carry && u.carryN > 0 && GOOD[u.carry] && inMap(Math.floor(u.x), Math.floor(u.y))) addLoot(Math.floor(u.x), Math.floor(u.y), { [u.carry]: Math.floor(u.carryN) });
  u.carry = null;
  u.carryN = 0;
}

function unclaimCrate(l, g, n) {
  l.claimed = Math.max(0, (l.claimed || 0) - n);
  if (l.held) l.held[g] = Math.max(0, (l.held[g] || 0) - n);
}

/** Is anything hostile to player p about: an enemy robot within r tiles of (x, y), or an enemy gun in range of it? */
function foesNear(p, x, y, r) {
  for (const u of S.bots) if (!u.dead && !u.inside && u.owner !== p && dist2(u.x, u.y, x, y) <= r * r) return true;
  for (const b of S.buildings) {
    if (b.dead || !b.built || b.owner === p || !BDEFS[b.type].range) continue;
    const rr = BDEFS[b.type].range + 1;
    if (dist2(b.x + 0.5, b.y + 0.5, x, y) <= rr * rr) return true;
  }
  return false;
}

/** The road networks a pile of crates can be reached from (its own tile, or a road beside it). */
function pileNets(l, trucks) {
  const net = roadNet(), comp = trucks ? net.compT : net.comp, t = tIdx(l.x, l.y), nets = [];
  if (comp[t] >= 0) nets.push(comp[t]);
  for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
    if (!inMap(l.x + di, l.y + dj)) continue;
    const u = tIdx(l.x + di, l.y + dj);
    if (roadLike(u) && comp[u] >= 0 && nets.indexOf(comp[u]) < 0) nets.push(comp[u]);
  }
  return nets;
}

/** Send bot u for n crates of good g from pile l. */
function assignCrate(u, l, g, n) {
  cancelTask(u);
  u.task = { type: 'crate', pile: l.id, good: g, n, phase: 'toPile' };
  l.claimed = (l.claimed || 0) + n;
  bump(l.held = l.held || {}, g, n);
  if (!goTo(u, l.x, l.y)) { cancelTask(u); (l.noReach = l.noReach || {})[u.owner] = S.time + 20; return false; }
  return true;
}

/** The nearest storage that takes good g and that bot u, standing at pile l, can reach. */
function crateStore(u, g, l) {
  const bt = BOTS[u.type], nets = bt.roadOnly ? pileNets(l, !!bt.truck) : null;
  let best = null, bd = Infinity;
  for (const b of S.buildings) {
    if (b.dead || b.owner !== u.owner || !storeTakes(b, g) || evacuated(b)) continue;
    if (nets && !buildingNets(b, !!bt.truck).some((k) => nets.indexOf(k) >= 0)) continue;
    const d = dist2(b.x + 0.5, b.y + 0.5, l.x + 0.5, l.y + 0.5);
    if (d < bd) { bd = d; best = b; }
  }
  return best;
}

/** The crate run: to the pile, load up, and on to storage. Enemies turning up call it off. */
function doCrate(u, t, dt) {
  if (t.phase === 'toPile') {
    const l = S.loot && S.loot.find((x) => x.id === t.pile);
    if (!l) { u.task = null; return; }
    if (S.tick % 15 === u.id % 15 && foesNear(u.owner, l.x + 0.5, l.y + 0.5, CRATE_SAFE)) { cancelTask(u); return; }
    const r = moveAlong(u, dt);
    if (!r) return;
    unclaimCrate(l, t.good, t.n);
    let g = l.goods[t.good] > 0 ? t.good : null;
    if (!g) for (const k in l.goods) if (l.goods[k] > 0 && isLiquid(k) === isLiquid(t.good) && (!g || l.goods[k] > l.goods[g])) g = k;
    if (!g) { u.task = null; return; }
    const got = Math.min(t.n, l.goods[g], carryOf(u, g));
    l.goods[g] -= got;
    u.carry = g; u.carryN = got; t.good = g; t.n = got;
    const dst = crateStore(u, g, l);
    if (!dst) { dropCarried(u); u.task = null; return; }
    t.dst = dst.id; t.phase = 'toDst';
    bump(dst.inc, g, got);
    if (!goTo(u, dst.x, dst.y)) { bump(dst.inc, g, -got); dropCarried(u); u.task = null; }
    return;
  }
  const dst = getE(t.dst);
  if (!dst || dst.dead || dst.owner !== u.owner) { cancelTask(u); return; }
  if (!moveAlong(u, dt)) return;
  bump(dst.inc, t.good, -t.n);
  bump(dst.stock, t.good, t.n);
  u.carry = null; u.carryN = 0;
  u.task = null;
  u.idleT = 0;
  if (BDEFS[dst.type].store) enterBuilding(u, dst);
}

function addLoot(x, y, goods) {
  S.loot = S.loot || [];
  const pile = S.loot.find((l) => l.x === x && l.y === y);
  if (pile) { for (const g in goods) bump(pile.goods, g, goods[g]); pile.until = S.time + LOOT_TIME; return; }
  S.loot.push({ id: S.nextId++, x, y, goods: { ...goods }, until: S.time + LOOT_TIME });
}

function lootLeft(pile) { let n = 0; for (const g in pile.goods) n += pile.goods[g]; return n; }

function updateLoot() {
  if (!S.loot || !S.loot.length) return;
  // Crates on someone's land wait for their haulers; only those on no-one's land rot away.
  for (const l of S.loot) if (S.owner[tIdx(l.x, l.y)] >= 0) l.until = Math.max(l.until, S.time + 60);
  // Count again who is on the way for crates (a warbot called off to fight could leave its claim behind).
  const byId = new Map();
  for (const l of S.loot) { l.claimed = 0; l.held = {}; byId.set(l.id, l); }
  for (const u of S.bots) {
    const t = u.task, l = !u.dead && t && byId.get(t.pile);
    if (!l) continue;
    if (t.type === 'loot' && t.phase === 'pick') l.claimed++;
    else if (t.type === 'crate' && t.phase === 'toPile') { l.claimed += t.n; bump(l.held, t.good, t.n); }
  }
  S.loot = S.loot.filter((l) => l.until > S.time && lootLeft(l) > 0);
}

/** A loot pile within `range` tiles of warbot u that it could walk to, or null. */
function lootNear(u, range) {
  if (!S.loot || !S.loot.length || u.loot) return null;
  const zone = S.zone[tIdx(Math.floor(u.x), Math.floor(u.y))];
  let best = null, bd = range * range;
  for (const l of S.loot) {
    const d = dist2(l.x + 0.5, l.y + 0.5, u.x, u.y);
    if (d > bd || lootLeft(l) <= (l.claimed || 0) || S.zone[tIdx(l.x, l.y)] !== zone) continue;
    bd = d; best = l;
  }
  return best;
}

/** Send warbot u to pick up a crate from pile l. */
function goLoot(u, l) {
  cancelTask(u);
  u.task = { type: 'loot', pile: l.id, phase: 'pick' };
  l.claimed = (l.claimed || 0) + 1;
  u.path = null;
}

/** Its side's nearest garrison warbot u can walk to (to drop loot at), or null. */
function lootHome(u) {
  const zone = S.zone[tIdx(Math.floor(u.x), Math.floor(u.y))];
  let best = null, bd = Infinity;
  for (const b of S.buildings) {
    if (b.dead || b.owner !== u.owner || !b.built || !BDEFS[b.type].mil || S.zone[tIdx(b.x, b.y)] !== zone) continue;
    const d = dist2(b.x, b.y, u.x, u.y);
    if (d < bd) { bd = d; best = b; }
  }
  return best;
}

/** The loot run: walk to the pile, take a crate, carry it to the nearest garrison and leave it there. */
function doLoot(u, t, dt) {
  if (t.phase === 'pick') {
    const l = S.loot && S.loot.find((x) => x.id === t.pile);
    if (!l || lootLeft(l) <= 0) { if (l) l.claimed = Math.max(0, (l.claimed || 0) - 1); u.task = null; return; }
    const r = travel(u, l.x, l.y, dt);
    if (r === null) { l.claimed = Math.max(0, (l.claimed || 0) - 1); u.task = null; return; }
    if (!r) return;
    l.claimed = Math.max(0, (l.claimed || 0) - 1);
    // The good there is most of.
    let g = null;
    for (const k in l.goods) if (l.goods[k] > 0 && (!g || l.goods[k] > l.goods[g])) g = k;
    if (!g) { u.task = null; return; }
    l.goods[g]--;
    u.loot = g;
    const home = lootHome(u);
    if (!home) { addLoot(l.x, l.y, { [g]: 1 }); u.loot = null; u.task = null; return; }
    t.phase = 'home'; t.home = home.id; u.path = null;
    return;
  }
  const home = getE(t.home);
  if (!home || home.dead || home.owner !== u.owner) {
    const h2 = lootHome(u);
    if (!h2) { addLoot(Math.floor(u.x), Math.floor(u.y), { [u.loot]: 1 }); u.loot = null; u.task = null; return; }
    t.home = h2.id; u.path = null;
    return;
  }
  const r = travel(u, home.x, home.y, dt);
  if (r === null) { addLoot(Math.floor(u.x), Math.floor(u.y), { [u.loot]: 1 }); u.loot = null; u.task = null; return; }
  if (!r) return;
  const g = u.loot;
  u.loot = null;
  bump(home.stock, g, 1);
  // Not storage (an Outpost): mark it as loot for Haulers to take on. Ammo stays for the garrison.
  if (!BDEFS[home.type].store && g !== 'ammo') bump(home.loot = home.loot || {}, g, 1);
  madeGood(u.owner, g, 1);
  S.players[u.owner].stats.looted = (S.players[u.owner].stats.looted || 0) + 1;
  u.task = null;
  // More crates still lying there: back for another (a warbot only carries one at a time).
  const more = (u.ammo ?? WARBOT_AMMO) > 0 && !wantsRepair(u) && lootNear(u, 50);
  if (more) { goLoot(u, more); return; }
  if (home.garrison.length + home.garInc < BDEFS[home.type].garrison && !wantsRepair(u)) enterBuilding(u, home);
}

/**
 * Player `old` has lost its Command Base to `by`: every building it had passes to `by` (empty,
 * lightly armored), its robots shut down for good, and its rally flags come down. The last player
 * left standing wins; if that's not you, losing your own Command Base ends your game.
 */
function eliminate(old, by) {
  const P = S.players[old];
  P.out = true;
  for (const u of S.bots) if (!u.dead && u.owner === old) killBot(u, true);
  sfx('boom');
  S.rallies = S.rallies.filter((r) => r.owner !== old);
  for (const e of S.buildings) {
    if (e.dead || e.owner !== old) continue;
    if (!e.built) { destroyBuilding(e, true); continue; }
    releaseBotsFrom(e, true);
    delete e.prio; delete e.smode; delete e.reject; e.paused = false;
    e.fixLeft = 0; e.fixer = 0; e.timer = 0; e.garrison = []; e.garInc = 0;
    e.owner = by;
    e.armor = Math.max(4, Math.min(e.armor, BDEFS[e.type].armor * 0.4));
    e.mode = S.players[by].ai ? 'alt' : 'off';
    markDirty(e.x, e.y);
  }
  for (const t of planAll(old).slice()) setPlan(t, -1);
  for (let t = 0; t < S.W * S.H; t++) if (S.railPlan[t] === old + 1) setRailPlan(t, 0);
  computeTerritory();
  const L = getE(P.lander);
  const x = L ? L.x : 0, y = L ? L.y : 0;
  postMsg(by, S.players.length > 2 ? `Your warbots captured ${playerName(old, true)}'s Command Base! Everything ${playerName(old, true)} built is yours.` : 'Your warbots captured the enemy Command Base!', x, y, 'good');
  if (old === 0) postMsg(0, 'The enemy captured your Command Base!', x, y, 'bad');
  else if (by !== 0) postMsg(0, `The ${playerName(by)} captured ${playerName(old, true)}'s Command Base and took over everything it had.`, x, y, 'warn');
  const left = S.players.filter((Q) => !Q.absent && !Q.out);
  if (left.length === 1) S.winner = left[0].id;
  else if (old === 0) S.winner = by;
}

/**
 * The rival `p` is up against (the only one, with two players). With three, each AI picks its own
 * and sticks with it for a minute and a half: the nearest one, but whoever attacked it lately
 * comes first, a rival pulling well ahead draws everyone's attention, one left with almost no army
 * gets finished off, and a little whim (changing every five minutes) settles the near ties, so
 * nobody can count on the other two fighting.
 */
function rivalOf(p) {
  if (S.players.length === 2) return 1 - p;
  const P = S.players[p];
  const keep = P.rival >= 0 && S.players[P.rival] && !S.players[P.rival].out && S.time < (P.rivalUntil || 0);
  if (keep) return P.rival;
  const L = getE(P.lander), hit = P.hitBy || {};
  const army = (o) => { let n = 0; for (const u of S.bots) if (!u.dead && u.owner === o && u.type === 'warbot') n++; return n; };
  const mine = army(p);
  let best = -1, bs = Infinity;
  for (const Q of S.players) {
    if (Q.id === p || Q.absent || Q.out) continue;
    const E = getE(Q.lander);
    let s = L && E ? dist(L.x, L.y, E.x, E.y) : 1;
    s *= 0.8 + 0.4 * hash2(p * 7 + Q.id, Math.floor(S.time / 300), S.seed);
    if (S.time - (hit[Q.id] ?? -999) < 120) s *= 0.6;
    const theirs = army(Q.id);
    if (theirs > mine + 6) s *= 0.8;
    if (theirs <= 3 && mine >= 10) s *= 0.45; // all but defenceless: finish it off and take everything it has
    if (s < bs) { bs = s; best = Q.id; }
  }
  if (best < 0) return p === 0 ? 1 : 0;
  P.rival = best;
  P.rivalUntil = S.time + 90;
  return best;
}

function updateWarbot(u, dt) {
  if (u.bat === undefined) u.bat = 100;
  if (u.task && u.task.type === 'flee') { doFlee(u, dt); return; }
  if (u.inside) {
    const home = getE(u.inside);
    if (home && BDEFS[home.type].repair) {
      // In a Repair Station: leave when fixed (or it has run out of Alloy).
      if (u.hp >= u.maxHp || repairDry(home)) { exitBuilding(u); u.task = null; }
      return;
    }
    // Outposts recharge their warbots; the Command Base doesn't charge anyone, so a low warbot in it
    // slips out to the nearest Outpost or Charging Station for a top-up while the Base is quiet.
    if (u.bat < 100 && home && home.type !== 'lander') u.bat = Math.min(100, u.bat + BATTERY.garrisonCharge * dt);
    if (home && home.type === 'lander' && u.bat < BATTERY.low && S.tick % 45 === u.id % 45 && S.time - (home.lastHit || -99) > 8) {
      const c = rechargePoint(u);
      if (c) { exitBuilding(u); u.task = { type: 'topup', bld: c.id }; u.path = null; return; }
    }
    if ((u.ammo ?? WARBOT_AMMO) <= WARBOT_AMMO - AMMO_SHOTS) reloadAmmo(u, home);
    // Damaged and the garrison is quiet: go and get fixed.
    if (home && wantsRepair(u) && S.tick % 45 === u.id % 45 && S.time - (home.lastHit || -99) > 8 && home.garrison.length > 1) goRepair(u);
    return;
  }
  u.moved = 0;
  u.fought = 0;
  warbotAct(u, dt);
  let d = (u.moved ? BATTERY.warbotMove : 0) + (u.fought ? BATTERY.warbotFight : 0);
  // Loitering in enemy land wears the battery down (see BATTERY.warbotWait).
  const o = S.owner[tIdx(Math.floor(u.x), Math.floor(u.y))];
  if (!u.moved && !u.fought && o >= 0 && o !== u.owner) {
    u.waitT = (u.waitT || 0) + dt;
    if (u.waitT > BATTERY.waitGrace) d += BATTERY.warbotWait;
  } else u.waitT = 0;
  if (d) u.bat = Math.max(0, u.bat - d * dt * drainMul(u));
}

function warbotAct(u, dt) {
  u.cd -= dt;
  const t = u.task;
  const defending = t && t.type === 'defend';
  const rally = t && t.type === 'hold' ? rallyById(t.rally) : null;
  const power = (u.bat ?? 100) < BATTERY.critical ? 0.5 : 1; // emergency mode hits half as hard
  // Out of Ammo: it can't fight at all. It drops any fight and an attack or sortie, and goes back
  // to a garrison to reload (one holding a rally flag reloads and comes back, see holdRally).
  const armed = (u.ammo ?? WARBOT_AMMO) > 0;
  if (!armed && t && (t.type === 'attack' || t.type === 'defend')) { cancelTask(u); u.path = null; u.fight = 0; return; }
  // Battery all but flat out in enemy land with nothing to shoot at: give up the attack and go home to recharge.
  if ((u.bat ?? 100) < BATTERY.critical && t && t.type === 'attack' && !u.fight) {
    const o = S.owner[tIdx(Math.floor(u.x), Math.floor(u.y))];
    if (o >= 0 && o !== u.owner) { cancelTask(u); u.path = null; return; }
  }
  let foe = armed && u.fight ? getE(u.fight) : null;
  const leash = defending ? 9 : rally ? 6 : 4;
  if (foe && (foe.dead || foe.inside || dist2(foe.x, foe.y, u.x, u.y) > leash * leash ||
      (rally && dist2(foe.x, foe.y, rally.x, rally.y) > 49))) foe = null;
  if (!foe) {
    u.fight = 0;
    u.scanT -= dt;
    if (armed && u.scanT <= 0) {
      u.scanT = 0.3;
      // Guards (defending their garrison) only chase civilians inside their own land.
      foe = nearestEnemyBot(u.owner, u.x, u.y, rally ? 3.5 : 2.8, true, defending);
      if (!foe && defending) {
        const h = getE(t.home);
        if (h) foe = nearestEnemyBot(u.owner, h.x + 0.5, h.y + 0.5, 6.5, true, true);
      }
      if (foe && foe.id === u.ignoreFoe && S.time < u.ignoreUntil) foe = null;
      if (foe) u.fight = foe.id;
    }
  }
  if (foe) {
    // Warbots shoot from just over a tile away; across an obstacle they can reach a bit further.
    // If something blocks the way and the foe is further off, walk round to it, or give up on it.
    const d = dist(u.x, u.y, foe.x, foe.y);
    let inReach = d <= WARBOT_RANGE, pathing = false;
    if (!inReach && !moveDirect(u, foe.x, foe.y, dt)) {
      if (d <= WARBOT_RANGE_BLOCKED || (d <= WARBOT_RANGE_GAP && overGap(u, foe))) inReach = true;
      else {
        pathing = true;
        if (travel(u, Math.floor(foe.x), Math.floor(foe.y), dt) === null) { u.fight = 0; u.ignoreFoe = foe.id; u.ignoreUntil = S.time + 5; }
      }
    }
    if (inReach && u.cd <= 0) {
      u.cd = 0.9;
      u.face = Math.atan2(foe.y - u.y, foe.x - u.x);
      if (u.owner === 0 || foe.owner === 0) sfx('hit');
      if (useAmmo(u)) {
        damageBot(foe, Math.max(1, Math.round((2 + (hash2(u.id, S.tick, 7) < 0.5 ? 1 : 0)) * power)));
        shotFx(u.x, u.y, foe.x, foe.y, { color: PLAYER_COLORS[u.owner] });
      } else addFx('spark', (u.x + foe.x) / 2, (u.y + foe.y) / 2, { color: PLAYER_COLORS[u.owner] }); // a scuffle, no rounds
      u.fought = 1;
    }
    if (!pathing) u.path = null;
    return;
  }
  if (!t) {
    const l = lootNear(u, 6);
    if (l) { goLoot(u, l); return; }
    if (!(wantsRepair(u) && goRepair(u))) goGarrison(u);
    return;
  }
  if (t.type === 'loot') { doLoot(u, t, dt); return; }
  if (t.type === 'topup') {
    // Out of the Command Base to recharge beside an Outpost or Charging Station, then back on guard.
    const c = getE(t.bld);
    if (!c || c.dead || c.owner !== u.owner || !c.built) { u.task = null; return; }
    if (dist2(u.x, u.y, c.x + 0.5, c.y + 0.5) <= 2.2) {
      u.path = null;
      u.bat = Math.min(100, (u.bat ?? 0) + 8 * dt);
      if (u.bat >= 95) u.task = null;
    } else if (travel(u, c.x, c.y, dt) === null) u.task = null;
    return;
  }
  if (t.type === 'repair') {
    const c = getE(t.bld);
    if (!c || c.dead || c.owner !== u.owner || repairDry(c)) { u.task = null; return; }
    const r = travel(u, c.x, c.y, dt);
    if (r === null) u.task = null;
    else if (r) enterBuilding(u, c);
    return;
  }
  if (t.type === 'garrison') {
    const b = getE(t.bld);
    if (!b || b.owner !== u.owner || !b.built) { cancelTask(u); return; }
    const r = travel(u, b.x, b.y, dt);
    if (r === null) { u.avoidB = b.id; u.avoidUntil = S.time + 15; cancelTask(u); return; }
    if (r) {
      cancelTask(u);
      if (b.garrison.length < BDEFS[b.type].garrison) enterBuilding(u, b);
    }
  } else if (t.type === 'attack') {
    const b = getE(t.target);
    if (!b || b.owner === u.owner) {
      // Target taken. Hold a captured military building, otherwise carry off a crate of what was
      // inside, or press on to the next enemy building close by before heading home.
      u.task = null;
      const l = lootNear(u, 4);
      if (l && !(b && BDEFS[b.type].mil)) { goLoot(u, l); return; }
      if (b) {
        const def = BDEFS[b.type];
        if (def.mil && b.garrison.length + b.garInc < def.garrison) { u.task = { type: 'garrison', bld: b.id }; b.garInc++; return; }
      }
      let next = null, nd = 20;
      for (const e of S.buildings) {
        if (e.dead || e.owner === u.owner) continue;
        const d = dist2(e.x + 0.5, e.y + 0.5, u.x, u.y);
        if (d < nd) { nd = d; next = e; }
      }
      if (next) u.task = { type: 'attack', target: next.id };
      return;
    }
    if (strikeBuilding(u, b, dt, power) === null) u.task = null;
  } else if (t.type === 'hold') {
    holdRally(u, t, rally, dt, power);
  } else if (t.type === 'defend') {
    const h = getE(t.home);
    if (!h || h.owner !== u.owner) { u.task = null; return; }
    const r = travel(u, h.x, h.y, dt);
    if (r) {
      u.task = null;
      if (h.garrison.length < BDEFS[h.type].garrison) enterBuilding(u, h);
    } else if (r === null) u.task = null;
  }
}

/**
 * Do bots a and b face each other across a drop (a canyon or valley lower than both of them), with
 * no rock, water or building in the way? Warbots shoot across one from the edge.
 */
function overGap(a, b) {
  const ta = tIdx(Math.floor(a.x), Math.floor(a.y)), tb = tIdx(Math.floor(b.x), Math.floor(b.y));
  const lo = Math.min(S.elev[ta], S.elev[tb]), n = Math.ceil(dist(a.x, a.y, b.x, b.y) / 0.25);
  let gap = false;
  for (let k = 1; k < n; k++) {
    const t = tIdx(Math.floor(a.x + ((b.x - a.x) * k) / n), Math.floor(a.y + ((b.y - a.y) * k) / n));
    if (t === ta || t === tb) continue;
    if (S.terrain[t] === T_WATER || (S.bAt[t] && !passTile(t))) return false;
    if (S.elev[t] >= lo) { if (S.terrain[t] === T_ROCK) return false; continue; }
    gap = true;
  }
  return gap;
}

/** Walk up to an enemy building and hit it. Returns null if it can't be reached. */
function strikeBuilding(u, b, dt, power) {
  if (dist2(u.x, u.y, b.x + 0.5, b.y + 0.5) <= 1.7) {
    u.path = null;
    u.face = Math.atan2(b.y + 0.5 - u.y, b.x + 0.5 - u.x);
    if (u.cd <= 0 && useAmmo(u)) {
      u.cd = 1.0;
      u.fought = 1;
      shotFx(u.x, u.y, b.x + 0.5 + (hash2(u.id, S.tick, 3) - 0.5) * 0.6, b.y + 0.5 + (hash2(u.id, S.tick, 5) - 0.5) * 0.6, { color: PLAYER_COLORS[u.owner], structure: true });
      hitBuilding(b, power, u.owner);
    }
    return true;
  }
  return travel(u, b.x, b.y, dt);
}

/** Fire one shot: true if the warbot had ammo (one is used), false if it has none left. */
function useAmmo(u) {
  if ((u.ammo ?? WARBOT_AMMO) > 0) {
    u.ammo = (u.ammo ?? WARBOT_AMMO) - 1;
    if (u.ammo === 0) {
      const P = S.players[u.owner];
      if (S.time - (P.lastAmmoMsg || -999) > 90) {
        P.lastAmmoMsg = S.time;
        postMsg(u.owner, 'A warbot ran out of Ammo and can\'t fight until it reloads. Haulers stock your Command Base and Outposts with Ammo from an Ammo Plant.', Math.floor(u.x), Math.floor(u.y), 'warn');
      }
    }
    return true;
  }
  return false;
}

/** Warbots in garrison b that have Ammo. */
function armedIn(b) {
  let n = 0;
  for (const id of b.garrison) { const u = getE(id); if (u && (u.ammo ?? WARBOT_AMMO) > 0) n++; }
  return n;
}

/**
 * How many warbots garrison b keeps at home: attacks and rallies leave them behind, and idle warbots
 * fill a garrison up to its Keep first. Set per garrison (b.keepW), or for all Outposts at once in
 * the Army banner (P.keepW); 1 unless set. At 0 nothing is held back and idle warbots don't go there
 * (they wait at the Command Base, or garrisons that keep some) unless nowhere else has room.
 */
function keepAt(b) {
  if (BDEFS[b.type].bunker) return BDEFS[b.type].garrison; // a Bunker's two stay put
  if (b.keepW !== undefined) return b.keepW;
  if (b.type === 'lander') return 1;
  const P = S.players[b.owner];
  return P && P.keepW !== undefined ? P.keepW : 1;
}

/** How many armed warbots garrison b can send out (all but its Keep). */
function spareArmed(b) { return BDEFS[b.type].bunker ? 0 : Math.max(0, Math.min(armedIn(b), b.garrison.length - keepAt(b))); }

/** A garrison far behind the lines (no rival building within 18 tiles): it can send its last warbot. */
function rearGarrison(b) {
  for (const e of S.buildings) if (!e.dead && e.owner !== b.owner && e.owner >= 0 && dist2(e.x, e.y, b.x, b.y) < 18 * 18) return false;
  return true;
}
/** Warbots garrison b can send out: every armed one from the rear (with `rear`), else all but one. */
function spareFrom(b, rear) { return BDEFS[b.type].bunker ? 0 : rear && rearGarrison(b) ? armedIn(b) : spareArmed(b); }

/** Take one armed warbot out of garrison b (or null). */
function takeArmed(b) {
  for (let k = b.garrison.length - 1; k >= 0; k--) {
    const u = getE(b.garrison[k]);
    if (u && (u.ammo ?? WARBOT_AMMO) > 0) { b.garrison.splice(k, 1); return u; }
  }
  return null;
}

/** Reload a warbot from a garrison's Ammo (one Ammo = AMMO_SHOTS shots). */
function reloadAmmo(u, b) {
  if (!b || b.owner !== u.owner || !BDEFS[b.type].mil || !((b.stock.ammo || 0) - (b.res.ammo || 0) > 0)) return false;
  bump(b.stock, 'ammo', -1);
  usedGood(b.owner, 'ammo', 1);
  u.ammo = Math.min(WARBOT_AMMO, (u.ammo ?? 0) + AMMO_SHOTS);
  return true;
}

/** Is there a garrison with Ammo this warbot can walk to? */
function ammoNear(u) {
  const zone = S.zone[tIdx(Math.floor(u.x), Math.floor(u.y))];
  return S.buildings.some((b) => !b.dead && b.built && b.owner === u.owner && BDEFS[b.type].mil && (b.stock.ammo || 0) > 0 && S.zone[tIdx(b.x, b.y)] === zone);
}

/* ------------------------------------------------------------------ army orders (rally points) */

function rallyById(id) {
  for (const r of S.rallies) if (r.id === id) return r;
  return null;
}

function rallyMembers(id) {
  return S.bots.filter((u) => !u.dead && u.task && u.task.type === 'hold' && u.task.rally === id);
}

/** Rally points with no warbots left are removed. */
function cleanRallies() {
  if (!S.rallies.length) return;
  const used = new Set();
  for (const u of S.bots) if (!u.dead && u.task && u.task.type === 'hold') used.add(u.task.rally);
  S.rallies = S.rallies.filter((r) => used.has(r.id));
}

/** Nearest own building where a warbot can top up its battery (garrisons and chargers), or reload. */
function rechargePoint(u, needAmmo) {
  let best = null, bd = Infinity;
  const zone = S.zone[tIdx(Math.floor(u.x), Math.floor(u.y))];
  for (const b of S.buildings) {
    if (b.dead || b.owner !== u.owner || !b.built) continue;
    const def = BDEFS[b.type];
    if (!def.mil && !def.charger) continue;
    if (needAmmo && !(def.mil && (b.stock.ammo || 0) > 0)) continue;
    if (!needAmmo && b.type === 'lander') continue; // it doesn't charge
    if (S.zone[tIdx(b.x, b.y)] !== zone) continue;
    const d = dist2(b.x + 0.5, b.y + 0.5, u.x, u.y);
    if (d < bd) { bd = d; best = b; }
  }
  return best;
}

const RALLY_SPOTS = [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-1, 1], [1, -1], [-1, -1], [2, 0], [-2, 0], [0, 2], [0, -2]];

/**
 * A warbot holding a rally point: it fights enemy bots nearby, attacks enemy buildings within
 * three tiles of the flag, and otherwise stands guard. With a flat battery it walks back to the
 * nearest garrison or charger to recharge, then returns.
 */
function holdRally(u, t, r, dt, power) {
  if (!r) { u.task = null; return; }
  if (t.phase !== 'recharge') {
    const flat = (u.bat ?? 100) < BATTERY.critical;
    if (flat || (u.ammo === 0 && S.tick % 15 === u.id % 15 && ammoNear(u))) { t.phase = 'recharge'; t.forAmmo = !flat; u.path = null; }
    if (u.ammo === 0 && t.phase !== 'recharge') t.target = 0; // no Ammo: it can only stand by the flag
  }
  if (t.phase === 'recharge') {
    const home = rechargePoint(u, t.forAmmo) || rechargePoint(u);
    if (!home) {
      // Nowhere to recharge: a flat warbot in enemy land gives up the flag and goes back to a garrison.
      const o = S.owner[tIdx(Math.floor(u.x), Math.floor(u.y))];
      if (!t.forAmmo && o >= 0 && o !== u.owner) { cancelTask(u); u.path = null; return; }
      t.phase = null;
      return;
    }
    if (dist2(u.x, u.y, home.x + 0.5, home.y + 0.5) <= 2.2) {
      u.path = null;
      const charges = home.type !== 'lander'; // the Command Base only reloads Ammo
      if (charges) u.bat = Math.min(100, (u.bat ?? 0) + 8 * dt);
      if ((u.ammo ?? WARBOT_AMMO) <= WARBOT_AMMO - AMMO_SHOTS) reloadAmmo(u, home);
      if ((u.bat >= 95 || !charges) && (u.ammo > 0 || !reloadAmmo(u, home))) { t.phase = null; t.forAmmo = false; }
    } else if (travel(u, home.x, home.y, dt) === null) t.phase = null;
    return;
  }
  let tgt = t.target ? getE(t.target) : null;
  if ((u.ammo ?? WARBOT_AMMO) <= 0 || (r.raid && raidRoadsLeft(r, u.owner))) tgt = null; // raiders cut the road first
  else if (!tgt || tgt.owner === u.owner || dist2(tgt.x + 0.5, tgt.y + 0.5, r.x, r.y) > 10) {
    tgt = null;
    t.target = 0;
    u.scanT2 = (u.scanT2 || 0) - dt;
    if (u.scanT2 <= 0) {
      u.scanT2 = 0.5;
      let bd = 10;
      for (const e of S.buildings) {
        if (e.dead || e.owner === u.owner) continue;
        const d = dist2(e.x + 0.5, e.y + 0.5, r.x, r.y);
        if (d < bd) { bd = d; tgt = e; }
      }
      if (tgt) t.target = tgt.id;
    }
  }
  if (tgt) {
    if (strikeBuilding(u, tgt, dt, power) === null) t.target = 0;
    return;
  }
  // Stand guard on a spot around the flag.
  const spot = RALLY_SPOTS[t.slot % RALLY_SPOTS.length];
  let gx = Math.floor(r.x) + spot[0], gy = Math.floor(r.y) + spot[1];
  if (!inMap(gx, gy) || !isWalkable(gx, gy) || S.zone[tIdx(gx, gy)] !== S.zone[tIdx(Math.floor(r.x), Math.floor(r.y))]) {
    gx = Math.floor(r.x); gy = Math.floor(r.y);
  }
  if (Math.floor(u.x) === gx && Math.floor(u.y) === gy && !u.path) {
    if ((u.ammo ?? WARBOT_AMMO) > 0 && !u.fight) sabotageRoads(u, r, dt);
    return;
  }
  if (travel(u, gx, gy, dt) === null) t.slot = 0;
}

/** Is there enemy road left near raid flag r to tear up? (Checked once a second.) */
function raidRoadsLeft(r, owner) {
  if (S.time - (r.roadsT || -9) < 1) return r.roadsLeft;
  r.roadsT = S.time;
  r.roadsLeft = false;
  const ri = Math.floor(r.x), rj = Math.floor(r.y), R0 = Math.ceil(SABOTAGE_RANGE);
  for (let dj = -R0; dj <= R0 && !r.roadsLeft; dj++) for (let di = -R0; di <= R0; di++) {
    const i = ri + di, j = rj + dj;
    if (!inMap(i, j) || di * di + dj * dj > SABOTAGE_RANGE * SABOTAGE_RANGE + 0.01) continue;
    const t = tIdx(i, j);
    if (S.road[t] && !crossTile(t) && S.owner[t] >= 0 && S.owner[t] !== owner) { r.roadsLeft = true; break; }
    if (S.pipe[t] && S.pipe[t] !== owner + 1) { r.roadsLeft = true; break; }
  }
  return r.roadsLeft;
}

/** A raiding warbot at its post in enemy land tears up the enemy road tile nearest the flag. */
function sabotageRoads(u, r, dt) {
  const ri = Math.floor(r.x), rj = Math.floor(r.y);
  if (!inMap(ri, rj)) return;
  const victim = S.owner[tIdx(ri, rj)];
  if (victim < 0 || victim === u.owner) return;
  r.sab = (r.sab || 0) + dt;
  if (r.sab < SABOTAGE_WORK) return;
  let best = -1, bd = SABOTAGE_RANGE * SABOTAGE_RANGE + 0.01;
  const R0 = Math.ceil(SABOTAGE_RANGE);
  for (let dj = -R0; dj <= R0; dj++) for (let di = -R0; di <= R0; di++) {
    const i = ri + di, j = rj + dj;
    if (!inMap(i, j)) continue;
    const t = tIdx(i, j);
    const pipe = S.pipe[t] === victim + 1; // a pipeline is worth cutting too
    if (!pipe && (!S.road[t] || S.owner[t] !== victim || crossTile(t))) continue; // bridges and tunnels are too solid to tear up (a Missile can crater them)
    const d = di * di + dj * dj - (pipe ? 1 : S.road[t] && isJunction(t) ? 1.5 : 0); // junctions first: they cut the most routes
    if (d < bd) { bd = d; best = t; }
  }
  if (best < 0) { r.sab = SABOTAGE_WORK; return; } // nothing left here to wreck
  r.sab = 0;
  u.face = Math.atan2(((best / S.W) | 0) + 0.5 - u.y, (best % S.W) + 0.5 - u.x);
  if (S.pipe[best] === victim + 1) {
    breakPipe(best);
    const P = S.players[victim];
    if (S.time - (P.lastPipeMsg || -99) > 25) {
      P.lastPipeMsg = S.time;
      postMsg(victim, 'Raiders are cutting your pipeline! It\'s relaid once they\'re driven off and it\'s paid for.', best % S.W, (best / S.W) | 0, 'bad');
      if (victim === 0) sfx('alert');
    }
    return;
  }
  wreckRoad(best, victim, 'Raiders are tearing up your roads');
}

/** Destroy a road tile (no refund): raids and missiles. Lights and overpasses on it go too. */
function wreckRoad(t, victim, why) {
  const i = t % S.W, j = (t / S.W) | 0, cross = crossTile(t);
  setRoad(i, j, false);
  if (S.terrain[t] === T_WATER || S.terrain[t] === T_CHASM) computeTerritory();
  delete S.lights[t];
  delete S.over[t];
  if (cross) computeZones();
  addFx('smoke', i + 0.5, j + 0.5, { r: 0.6 });
  if (victim >= 0 && why) {
    const P = S.players[victim];
    if (S.time - (P.lastRaidMsg || -99) > 25) {
      P.lastRaidMsg = S.time;
      postMsg(victim, `${why}! Send warbots to drive them off, then re-lay the road.`, i, j, 'bad');
      if (victim === 0) sfx('alert');
    }
  }
}

/** Garrisons that can send warbots to tile (i, j): same walkable area, each keeps one at home. */
function rallySources(owner, i, j, rear) {
  const zone = S.zone[tIdx(i, j)];
  const out = [];
  for (const b of S.buildings) {
    if (b.dead || b.owner !== owner || !b.built || !BDEFS[b.type].mil || spareFrom(b, rear) < 1) continue;
    if (S.zone[tIdx(b.x, b.y)] !== zone) continue;
    out.push({ b, d: dist(b.x, b.y, i, j) });
  }
  out.sort((a, c) => a.d - c.d);
  return out.map((o) => o.b);
}

function rallyAvailable(owner, i, j, rear) {
  let n = 0;
  for (const b of rallySources(owner, i, j, rear)) n += spareFrom(b, rear);
  return n;
}

/**
 * Send warbots to hold the area around tile (i, j) until they are called back. With `rear` (the
 * AI's marches), garrisons far behind the lines send their last warbot too.
 */
function sendToRally(owner, i, j, count, rear) {
  let r = S.rallies.find((q) => q.owner === owner && Math.abs(q.x - (i + 0.5)) < 1.5 && Math.abs(q.y - (j + 0.5)) < 1.5);
  if (!r) { r = { id: S.nextId++, owner, x: i + 0.5, y: j + 0.5 }; S.rallies.push(r); }
  let slot = rallyMembers(r.id).length, sent = 0;
  for (const b of rallySources(owner, i, j, rear)) {
    while (spareFrom(b, rear) > 0 && sent < count) {
      const u = takeArmed(b);
      if (!u) break;
      u.inside = 0;
      u.task = { type: 'hold', rally: r.id, slot: slot++ };
      u.path = null;
      sent++;
    }
  }
  if (!sent) cleanRallies();
  return { sent, rally: r };
}

/* ------------------------------------------------------------------ direct orders (desktop selection) */

/** The warbots among `ids` that `owner` can give orders to. */
function orderable(owner, ids) {
  return ids.map(getE).filter((u) => u && !u.dead && u.owner === owner && u.type === 'warbot');
}

/** Take a warbot out of its garrison and off its current job, ready for a new order. */
function readyForOrder(u) {
  exitBuilding(u);
  cancelTask(u);
  u.fight = 0;
  u.path = null;
}

/** Send selected warbots to hold the ground at (i, j) under a rally flag. Only armed ones go. */
function orderMove(owner, ids, i, j) {
  if (!inMap(i, j) || !walkable(tIdx(i, j))) return 0;
  const bots = orderable(owner, ids).filter((u) => (u.ammo ?? WARBOT_AMMO) > 0);
  if (!bots.length) return 0;
  let r = S.rallies.find((q) => q.owner === owner && Math.abs(q.x - (i + 0.5)) < 1.5 && Math.abs(q.y - (j + 0.5)) < 1.5);
  if (!r) { r = { id: S.nextId++, owner, x: i + 0.5, y: j + 0.5 }; S.rallies.push(r); }
  let slot = rallyMembers(r.id).length;
  for (const u of bots) { readyForOrder(u); u.task = { type: 'hold', rally: r.id, slot: slot++ }; }
  return bots.length;
}

/** Send selected warbots to attack an enemy building. Only armed ones go. */
function orderAttack(owner, ids, target) {
  if (!target || target.dead || target.owner === owner) return 0;
  const bots = orderable(owner, ids).filter((u) => (u.ammo ?? WARBOT_AMMO) > 0);
  for (const u of bots) { readyForOrder(u); u.task = { type: 'attack', target: target.id }; }
  return bots.length;
}

/** Station selected warbots in one of your garrisons, as many as it has room for. */
function orderStation(owner, ids, to) {
  if (!to || !to.built || to.dead || to.owner !== owner || !BDEFS[to.type].mil) return 0;
  let room = garrisonRoom(to), sent = 0;
  for (const u of orderable(owner, ids)) {
    if (room <= 0) break;
    if (u.inside === to.id || (u.task && u.task.type === 'garrison' && u.task.bld === to.id)) continue;
    readyForOrder(u);
    u.task = { type: 'garrison', bld: to.id };
    to.garInc = (to.garInc || 0) + 1;
    room--; sent++;
  }
  return sent;
}

/** Every warbot `owner` could send out: those in the field, and all but one in each garrison. */
function armyIds(owner) {
  const ids = [];
  for (const u of S.bots) if (!u.dead && u.owner === owner && u.type === 'warbot' && !u.inside) ids.push(u.id);
  for (const b of S.buildings) {
    if (b.dead || b.owner !== owner || !b.garrison || b.garrison.length < 2) continue;
    for (let k = 1; k < b.garrison.length; k++) ids.push(b.garrison[k]);
  }
  return ids;
}

/* ------------------------------------------------------------------ stationing warbots */

/** Room left in a garrison, counting warbots already on their way. */
function garrisonRoom(b) { return Math.max(0, BDEFS[b.type].garrison - b.garrison.length - (b.garInc || 0)); }

/** Other garrisons that can spare warbots for building `to` (each keeps one at home), nearest first. */
function stationSources(owner, to) {
  const zone = S.zone[tIdx(to.x, to.y)], out = [];
  for (const b of S.buildings) {
    if (b === to || b.dead || b.owner !== owner || !b.built || !BDEFS[b.type].mil || b.garrison.length < 2) continue;
    if (S.zone[tIdx(b.x, b.y)] !== zone) continue; // they couldn't walk there
    out.push({ b, d: dist(b.x, b.y, to.x, to.y) });
  }
  out.sort((a, c) => a.d - c.d);
  return out.map((o) => o.b);
}

/** How many warbots could be stationed at `to` right now. */
function stationAvailable(owner, to) {
  let n = 0;
  for (const b of stationSources(owner, to)) n += b.garrison.length - 1;
  return Math.min(n, garrisonRoom(to));
}

/** Move warbots from the nearest other garrisons into `to`, where they stay until moved again. */
function stationWarbots(owner, to, count) {
  if (!to.built || to.dead || to.owner !== owner || !BDEFS[to.type].mil) return 0;
  count = Math.min(count, garrisonRoom(to));
  let sent = 0;
  for (const b of stationSources(owner, to)) {
    while (b.garrison.length > 1 && sent < count) {
      const u = getE(b.garrison.pop());
      if (!u) continue;
      u.inside = 0;
      u.task = { type: 'garrison', bld: to.id };
      u.path = null;
      to.garInc = (to.garInc || 0) + 1;
      sent++;
    }
  }
  return sent;
}

/** Call a rally point's warbots back to their garrisons. */
/** Warbots out in the field (attacking, holding a rally flag, or out defending). */
function warbotsOut(owner) {
  let n = 0;
  for (const u of S.bots) if (!u.dead && u.owner === owner && u.type === 'warbot' && !u.inside && u.task && ['attack', 'defend', 'hold'].includes(u.task.type)) n++;
  return n;
}

/** Recall every warbot in the field: every rally flag comes down and they go back to their garrisons. */
function recallAll(owner) {
  let n = 0;
  for (const r of S.rallies.slice()) if (r.owner === owner) n += recallRally(r.id);
  for (const u of S.bots) {
    if (u.dead || u.owner !== owner || u.type !== 'warbot' || u.inside || !u.task) continue;
    if (!['attack', 'defend', 'hold'].includes(u.task.type)) continue;
    cancelTask(u); u.task = null; u.path = null; u.fight = 0; n++;
  }
  return n;
}

function recallRally(id) {
  let n = 0;
  for (const u of rallyMembers(id)) { u.task = null; u.path = null; u.fight = 0; n++; }
  S.rallies = S.rallies.filter((r) => r.id !== id);
  return n;
}

/* ------------------------------------------------------------------ missiles */

function updateSilo(b, def) {
  const w = b.stock.warhead || 0;
  b.status = !w ? 'Needs Missiles from a Missile Factory' : b.reload > 0 ? `Reloading (${Math.ceil(b.reload)}s)` : `Ready to fire (${w} Missile${w > 1 ? 's' : ''})`;
}

function siloReady(b) { return !!(b.built && !b.dead && b.stock && (b.stock.warhead || 0) > 0 && !(b.reload > 0)); } // (a preview has no stock: see drawBuilding)

/** The player's silos that can reach `target`, ready ones first, then nearest. */
function silosInRange(owner, target) {
  const out = [];
  for (const b of S.buildings) {
    if (b.dead || b.owner !== owner || !b.built || !BDEFS[b.type].missile) continue;
    const d = dist(b.x, b.y, target.x, target.y);
    if (d <= BDEFS[b.type].missile.range) out.push({ b, d });
  }
  out.sort((a, c) => (siloReady(c.b) ? 1 : 0) - (siloReady(a.b) ? 1 : 0) || a.d - c.d);
  return out.map((o) => o.b);
}

function fireMissile(owner, target) {
  const silo = silosInRange(owner, target).find(siloReady);
  if (!silo) return false;
  return fireMissileAt(silo, target.x, target.y);
}

/** The rival building a missile aimed at tile (i, j) would hit directly, if any. */
function missileTargetAt(owner, i, j) {
  if (!inMap(i, j)) return null;
  const b = getE(S.bAt[tIdx(i, j)]);
  if (b && !b.dead && b.owner !== owner) return b;
  for (const e of S.buildings) {
    if (!e.dead && e.owner !== owner && e.type === 'lander' && Math.abs(e.x - i) <= 1 && Math.abs(e.y - j) <= 1) return e;
  }
  return null;
}

/** Can this silo fire at tile (i, j) now? '' if so, otherwise why not. */
function missileBlocked(silo, i, j) {
  if (!silo || silo.dead || !silo.built) return 'That Silo is gone.';
  if (!(silo.stock.warhead > 0)) return 'This Silo has no Missiles: haulers bring them from a Missile Factory.';
  if (silo.reload > 0) return `Reloading: ready in ${Math.ceil(silo.reload)}s.`;
  if (eventNow('dust')) return `A dust storm grounds every Missile: ${Math.ceil(S.event.t1 - S.time)}s until it blows over.`;
  if (dist(silo.x, silo.y, i, j) > BDEFS[silo.type].missile.range) return `Out of range: Missiles reach ${BDEFS[silo.type].missile.range} tiles.`;
  return '';
}

/**
 * Launch a Missile from `silo` at tile (i, j): any spot in range, not just a building. A rival
 * building there takes the full hit; the blast hurts rival buildings and bots around it.
 */
function fireMissileAt(silo, i, j) {
  if (missileBlocked(silo, i, j)) return false;
  const owner = silo.owner, md = BDEFS[silo.type].missile;
  const target = missileTargetAt(owner, i, j);
  const tx = target ? target.x : i, ty = target ? target.y : j;
  bump(silo.stock, 'warhead', -1);
  usedGood(silo.owner, 'warhead', 1);
  silo.reload = md.reload;
  const d = dist(silo.x, silo.y, tx, ty);
  S.missiles.push({
    owner, from: silo.id, target: target ? target.id : 0, t: 0, dur: Math.max(1.6, d / 8),
    x0: silo.x + 0.5, y0: silo.y + 0.5, x1: tx + 0.5, y1: ty + 0.5,
  });
  addFx('ring', silo.x + 0.5, silo.y + 0.5, { color: '#ffcf4a', r: 1.2 });
  sfx('launch');
  if (target) postMsg(target.owner, `Incoming missile! It is heading for your ${BDEFS[target.type].name}.`, target.x, target.y, 'bad');
  else if (S.owner[tIdx(tx, ty)] >= 0 && S.owner[tIdx(tx, ty)] !== owner) postMsg(S.owner[tIdx(tx, ty)], 'Incoming missile!', tx, ty, 'bad');
  return true;
}

function updateMissiles(dt) {
  for (const m of S.missiles) {
    m.t += dt;
    if (m.shell) {
      if (S.tick % 4 === 0 && m.t < m.dur) { const k = m.t / m.dur; addFx('puff', lerp(m.x0, m.x1, k), lerp(m.y0, m.y1, k) - Math.sin(k * Math.PI) * 2.2, { r: 0.1, life: 0.6 }); }
      if (m.t >= m.dur) shellImpact(m);
      continue;
    }
    if (m.nuke) {
      if (S.tick % 3 === 0) {
        const k = Math.min(1, m.t / m.dur);
        addFx('smoke', lerp(m.x0, m.x1, k), lerp(m.y0, m.y1, k) - Math.sin(k * Math.PI) * 7 + 0.2, { r: 0.35, life: 1.4 });
      }
      if (m.t >= m.dur) nukeImpact(m);
      continue;
    }
    if (S.tick % 3 === 0) {
      const k = Math.min(1, m.t / m.dur);
      addFx('smoke', lerp(m.x0, m.x1, k), lerp(m.y0, m.y1, k) - Math.sin(k * Math.PI) * 2.5, { r: 0.3, life: 0.9 });
    }
    if (m.t >= m.dur) missileImpact(m);
  }
  S.missiles = S.missiles.filter((m) => m.t < m.dur);
}

/**
 * A missile hits its target hard (most buildings are wrecked outright; Outposts and Command Bases drop to
 * no less than MISSILE_FLOOR of their armor, so warbots still have to fight their way in), and the blast damages nearby rival buildings
 * and bots.
 */
/**
 * Missiles can't take a fort (Outpost, Command Base) below MISSILE_FLOOR of its armor: they soften
 * it up, and warbots still have to shoot their way in past the garrison that comes out to meet them.
 */
function missileFloor(b) { return Math.max(1, Math.round(BDEFS[b.type].armor * MISSILE_FLOOR)); }

function missileImpact(m) {
  const md = BDEFS.silo.missile;
  blastFx(m.x1, m.y1, 2.2);
  sfx('boom');
  const b = getE(m.target);
  if (b && !b.dead && b.owner !== m.owner) {
    const name = BDEFS[b.type].name;
    b.armor -= md.damage;
    b.lastHit = S.time;
    if (b.armor <= 0 && (!b.built || !BDEFS[b.type].mil)) {
      postMsg(m.owner, `Your missile wrecked the enemy ${name}.`, b.x, b.y, 'good');
      postMsg(b.owner, `A missile wrecked your ${name}!`, b.x, b.y, 'bad');
      destroyBuilding(b, true);
    } else {
      const floor = missileFloor(b);
      if (b.armor <= floor) b.armor = Math.min(floor, b.armor + md.damage);
      postMsg(m.owner, `Missile hit the enemy ${name}${b.armor <= floor ? ': its armor is down, send warbots to capture it!' : '.'}`, b.x, b.y, 'good');
      postMsg(b.owner, `A missile hit your ${name}!`, b.x, b.y, 'bad');
    }
  }
  for (const e of S.buildings.slice()) {
    if (e === b || e.dead || e.owner === m.owner || dist2(e.x + 0.5, e.y + 0.5, m.x1, m.y1) > md.splash * md.splash) continue;
    e.armor -= md.splashDamage;
    e.lastHit = S.time;
    if (e.armor <= 0 && (!e.built || !BDEFS[e.type].mil)) {
      postMsg(e.owner, `The blast wrecked your ${BDEFS[e.type].name}!`, e.x, e.y, 'bad');
      destroyBuilding(e, true);
    } else if (e.built && BDEFS[e.type].mil && e.armor < missileFloor(e)) e.armor = Math.min(missileFloor(e), e.armor + md.splashDamage);
  }
  for (const u of S.bots) {
    if (!u.dead && !u.inside && u.owner !== m.owner && dist2(u.x, u.y, m.x1, m.y1) <= md.splash * md.splash) damageBot(u, md.botDamage);
  }
  // The blast craters the roads around it.
  const ci = Math.floor(m.x1), cj = Math.floor(m.y1), R0 = Math.ceil(MISSILE_ROAD);
  for (let dj = -R0; dj <= R0; dj++) for (let di = -R0; di <= R0; di++) {
    const i = ci + di, j = cj + dj;
    if (!inMap(i, j) || di * di + dj * dj > MISSILE_ROAD * MISSILE_ROAD) continue;
    const t = tIdx(i, j);
    if (S.plan[t]) cancelPlan(t);
    if (S.road[t] && S.owner[t] !== m.owner) wreckRoad(t, S.owner[t], '');
    if (S.pipe[t] && S.pipe[t] !== m.owner + 1) breakPipe(t);
  }
}

/* ------------------------------------------------------------------ nuclear race */

/** A Nuclear Silo assembles its missile once all the parts are in, then waits to be fired. */
function updateNukeSilo(b, dt) {
  if (b.armed) { b.status = 'Nuclear missile ready to fire'; return; }
  const missing = Object.keys(NUKE.parts).filter((g) => (b.stock[g] || 0) < NUKE.parts[g]);
  if (missing.length) {
    b.status = 'Waiting for ' + missing.map((g) => `${NUKE.parts[g] - (b.stock[g] || 0)} ${GOOD[g].name}`).join(', ');
    b.timer = 0;
    return;
  }
  b.working = true;
  b.timer = (b.timer || 0) + dt;
  b.status = `Assembling the nuclear missile (${Math.max(0, Math.ceil(NUKE.assemble - b.timer))}s)`;
  if (b.timer < NUKE.assemble) return;
  for (const g in NUKE.parts) { bump(b.stock, g, -NUKE.parts[g]); usedGood(b.owner, g, NUKE.parts[g]); }
  b.timer = 0;
  b.armed = 1;
  postMsg(b.owner, 'Your nuclear missile is ready. Tap the Nuclear Silo to aim it.', b.x, b.y, 'good');
  for (const P of S.players) if (P.id !== b.owner && !P.absent && !P.out) postMsg(P.id, `Intelligence: ${playerName(b.owner, true)} has finished a nuclear missile!`, b.x, b.y, 'bad');
}

/** Can this Nuclear Silo fire at tile (i, j)? '' if so, otherwise why not. */
function nukeBlocked(silo, i, j) {
  if (!silo || silo.dead || !silo.built) return 'That Silo is gone.';
  if (!silo.armed) return 'No nuclear missile yet: it needs 6 Enriched Uranium, 4 Alloy and 2 Chips, then a minute to assemble.';
  if (!inMap(i, j)) return 'Off the map.';
  if (dist(silo.x, silo.y, i, j) > NUKE.range) return `Out of range: nuclear missiles reach ${NUKE.range} tiles.`;
  if (eventNow('dust')) return `A dust storm grounds every missile: ${Math.ceil(S.event.t1 - S.time)}s until it blows over.`;
  return '';
}

/** Launch the nuclear missile at tile (i, j). It flies for NUKE.flight seconds: the target sees it coming. */
function fireNukeAt(silo, i, j) {
  if (nukeBlocked(silo, i, j)) return false;
  silo.armed = 0;
  S.missiles.push({
    owner: silo.owner, from: silo.id, nuke: true, t: 0, dur: NUKE.flight,
    x0: silo.x + 0.5, y0: silo.y + 0.5, x1: i + 0.5, y1: j + 0.5,
  });
  addFx('ring', silo.x + 0.5, silo.y + 0.5, { color: '#9dff3a', r: 2, life: 1.2 });
  sfx('launch');
  if (silo.owner !== 0 && !S.players[0].absent) sfx('siren');
  postMsg(silo.owner, `Nuclear missile launched: impact in ${NUKE.flight} seconds.`, i, j, 'good');
  // Every launch by a rival is detected (in a free-for-all too), wherever it's aimed.
  if (silo.owner !== 0) {
    const atUs = nukesThreatening(0).includes(S.missiles[S.missiles.length - 1]);
    postMsg(0, `NUCLEAR LAUNCH DETECTED! Impact in ${NUKE.flight} seconds` + (atUs ? ': press Evacuate to get your robots out of the red ring!' : ', aimed at a rival.'), i, j, 'bad');
  }
  return true;
}

/*
 * Evacuation: while a nuclear missile is in flight, a player can clear its blast ring (the AI does so
 * by itself). S.evac[p] lists that player's rings ({x, y, r, until}); every robot of theirs inside one,
 * in the open or inside a building there, runs to the nearest safe ground outside it and waits until
 * the blast, and no job is handed out at a building inside it meanwhile.
 */
function evacZones(p) {
  const z = S.evac && S.evac[p];
  if (!z || !z.length) return null;
  const live = z.filter((e) => e.until > S.time);
  if (live.length !== z.length) S.evac[p] = live;
  return live.length ? live : null;
}

/** Is (x, y) inside one of player p's rings being evacuated? */
function inEvac(p, x, y) {
  const z = evacZones(p);
  return !!z && z.some((e) => dist2(x, y, e.x, e.y) <= e.r * e.r);
}

/** Is building b inside a blast ring its owner is evacuating? */
function evacuated(b) { return !!(S.evac && S.evac[b.owner] && S.evac[b.owner].length) && inEvac(b.owner, b.x + 0.5, b.y + 0.5); }

/** Nuclear missiles in flight whose blast would catch something of player p's. */
function nukesThreatening(p) {
  const out = [];
  const R = NUKE.radius + EVAC_MARGIN, R2 = R * R;
  for (const m of S.missiles) {
    if (!m.nuke || m.t >= m.dur) continue;
    const hit = S.buildings.some((b) => !b.dead && b.owner === p && dist2(b.x + 0.5, b.y + 0.5, m.x1, m.y1) <= R2) ||
      S.bots.some((u) => !u.dead && u.owner === p && dist2(u.x, u.y, m.x1, m.y1) <= R2);
    if (hit) out.push(m);
  }
  return out;
}

/** Is player p already clearing the ring of missile m? */
function evacuating(p, m) { const z = evacZones(p); return !!z && z.some((e) => e.x === m.x1 && e.y === m.y1); }

/** Player p clears the blast rings of every nuclear missile heading for its things. Returns how many robots left. */
function startEvac(p) {
  S.evac = S.evac || {};
  for (const m of nukesThreatening(p)) {
    if (evacuating(p, m)) continue;
    (S.evac[p] = S.evac[p] || []).push({ x: m.x1, y: m.y1, r: NUKE.radius + EVAC_MARGIN, until: S.time + (m.dur - m.t) + 1 });
  }
  return evacSweep(p);
}

/**
 * Send every robot of player p inside a ring out of it, and call off jobs at buildings inside one.
 * Run when the evacuation starts and then every second, for bots that wander in.
 */
function evacSweep(p) {
  if (!evacZones(p)) return 0;
  let n = 0;
  for (const u of S.bots) {
    if (u.dead || u.owner !== p || BOTS[u.type].rail || BOTS[u.type].crawler || (u.task && u.task.type === 'flee')) continue;
    const home = u.inside ? getE(u.inside) : null;
    const x = home ? home.x + 0.5 : u.x, y = home ? home.y + 0.5 : u.y;
    if (inEvac(p, x, y)) { fleeFrom(u); n++; continue; }
    // Outside, but on its way to a job in there: drop the job.
    const t = u.task;
    if (t && t.type !== 'attack' && t.type !== 'hold') {
      for (const id of [t.src, t.dst, t.site, t.bld, t.home]) {
        const b = id ? getE(id) : null;
        if (b && b.owner === p && evacuated(b)) { cancelTask(u); u.task = null; u.path = null; break; }
      }
    }
  }
  return n;
}

/** Robot u runs for the nearest safe ground outside the rings (out of whatever building it's in). */
function fleeFrom(u) {
  const home = u.inside ? getE(u.inside) : null;
  if (home) { exitBuilding(u); u.x = home.x + 0.5; u.y = home.y + 0.5; }
  cancelTask(u);
  u.fight = 0; u.ride = -1; u.deck = null;
  const spot = safeSpot(u);
  u.task = { type: 'flee' };
  u.path = spot >= 0 ? findPath(Math.floor(u.x), Math.floor(u.y), spot % S.W, (spot / S.W) | 0, undefined, { who: u.owner }) : null;
  u.pi = 0; u.goal = spot;
}

/** The nearest tile u can walk to that lies outside its owner's evacuation rings, or -1. */
function safeSpot(u) {
  const W = S.W, N = W * S.H, start = tIdx(Math.floor(u.x), Math.floor(u.y));
  const seen = new Uint8Array(N), q = [start];
  seen[start] = 1;
  for (let h = 0; h < q.length && h < 6000; h++) {
    const t = q[h], i = t % W, j = (t / W) | 0;
    if (t !== start && !inEvac(u.owner, i + 0.5, j + 0.5) && !S.bAt[t] && !scorched(t)) return t;
    for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      if (!inMap(i + di, j + dj)) continue;
      const v = tIdx(i + di, j + dj);
      if (seen[v] || !walkable(v) || !canStep(t, v) || (S.bAt[v] && !passTile(v, u.owner))) continue;
      seen[v] = 1; q.push(v);
    }
  }
  return -1;
}

/** A robot evacuating: out to its safe spot, then it waits there until the blast. */
function doFlee(u, dt) {
  u.busy = 0;
  if (!evacZones(u.owner)) { u.task = null; u.path = null; return; } // all clear: back to work
  if (u.path) { if (moveAlong(u, dt)) { u.path = null; u.vel = 0; } }
  else { u.vel = 0; u.moved = 0; }
}

/**
 * The blast: every building within NUKE.radius tiles is destroyed (a Command Base is left with 1
 * armor and an empty garrison, ready to capture), every robot dies, roads are wrecked, groves and
 * crops burn, and the ground stays scorched for NUKE.scorch seconds.
 */
function updateEvac() {
  if (!S.evac) return;
  for (const p in S.evac) if (evacZones(+p)) evacSweep(+p);
}

function nukeImpact(m) {
  const cx = m.x1, cy = m.y1, R2 = NUKE.radius * NUKE.radius;
  addFx('nuke', cx, cy, { life: 2, r: NUKE.radius });
  sfx('nuke');
  const lost = S.players.map(() => 0);
  for (const b of S.buildings.slice()) {
    if (b.dead || dist2(b.x + 0.5, b.y + 0.5, cx, cy) > R2) continue;
    if (b.type === 'lander') {
      for (const id of b.garrison.slice()) { const u = getE(id); if (u) killBot(u); }
      b.garrison.length = 0;
      for (const u of S.bots) if (!u.dead && u.inside === b.id) killBot(u);
      b.armor = 1;
      b.lastHit = S.time;
    } else {
      lost[b.owner]++;
      destroyBuilding(b, true);
    }
  }
  for (const u of S.bots) if (!u.dead && !u.inside && dist2(u.x, u.y, cx, cy) <= R2) killBot(u);
  const ci = Math.floor(cx), cj = Math.floor(cy), R0 = NUKE.radius;
  for (let dj = -R0; dj <= R0; dj++) for (let di = -R0; di <= R0; di++) {
    const i = ci + di, j = cj + dj;
    if (!inMap(i, j) || di * di + dj * dj > R2) continue;
    const t = tIdx(i, j);
    if (S.plan[t]) cancelPlan(t);
    if (S.road[t]) wreckRoad(t, -1, '');
    if (S.pipe[t] || S.pipePlan[t]) { setPipe(t, 0); S.pipePlan[t] = 0; } // gone for good: the ground is scorched
    if (S.res[t] === R_STALK || S.res[t] === R_CROP) { S.res[t] = R_NONE; S.amt[t] = 0; markDirty(i, j); }
    S.scorch[t] = S.time + NUKE.scorch;
  }
  S.blasts = (S.blasts || []).filter((b) => b.until > S.time).concat([{ x: cx, y: cy, until: S.time + NUKE.scorch }]);
  computeTerritory();
  const theirs = lost.reduce((a, n, p) => a + (p === m.owner ? 0 : n), 0);
  for (const P of S.players) {
    const p = P.id;
    if (P.absent || P.out) continue;
    const mine = p === m.owner;
    postMsg(p, mine ? `Nuclear strike! ${theirs} rival building${theirs === 1 ? '' : 's'} destroyed.` + (lost[p] ? ` You lost ${lost[p]} of your own.` : '')
      : `A nuclear strike destroyed ${lost[p]} of your buildings!`, ci, cj, mine ? 'good' : 'bad');
  }
}

/* ------------------------------------------------------------------ player commands */

function attackSources(owner, target) {
  const out = [];
  const zone = S.zone[tIdx(target.x, target.y)];
  for (const b of S.buildings) {
    if (b.dead || b.owner !== owner || !b.built || !BDEFS[b.type].mil) continue;
    if (S.zone[tIdx(b.x, b.y)] !== zone) continue; // warbots there can't walk to the target
    const d = dist(b.x, b.y, target.x, target.y);
    if (d <= ATTACK_RANGE && spareArmed(b) > 0) out.push({ b, d });
  }
  out.sort((a, c) => a.d - c.d);
  return out.map((o) => o.b);
}

/** Armed warbots that could join an attack on `target` (each garrison keeps one at home). */
function attackAvailable(owner, target) {
  let n = 0;
  for (const b of attackSources(owner, target)) n += spareArmed(b);
  return n;
}

function sendAttack(owner, target, count) {
  let sent = 0;
  for (const b of attackSources(owner, target)) {
    while (spareArmed(b) > 0 && sent < count) {
      const u = takeArmed(b);
      if (!u) break;
      u.inside = 0;
      u.task = { type: 'attack', target: target.id };
      u.path = null;
      sent++;
    }
  }
  return sent;
}

/* ------------------------------------------------------------------ paths */

/*
 * Path costs can be fractions of a good (a quarter Stone or a tenth of a Cement per tile). Each
 * player keeps a small credit per good: paying for a tile draws on the credit first and only takes
 * a whole good from storage when the credit runs out; removing a tile adds to the credit and
 * refunds whole goods.
 */
function roadCredit(owner, g) {
  const P = S.players[owner];
  P.roadCredit = P.roadCredit || {};
  return P.roadCredit[g] || 0;
}

/** What laying one road tile costs. */
function roadCost() { return PAVE[1].cost; }

/** Can `owner` afford road costs `cost` (one tile's, or a whole route's), counting the credit left from earlier tiles? */
function canAffordRoad(owner, cost) {
  const have = playerGoods(owner);
  for (const g in cost) if (roadCredit(owner, g) + (have[g] || 0) < cost[g] - 1e-9) return false;
  return true;
}

/** How many more road tiles the player could lay right now. */
function roadTilesAffordable(owner) {
  const have = playerGoods(owner), cost = roadCost();
  let n = Infinity;
  for (const g in cost) n = Math.min(n, Math.floor((roadCredit(owner, g) + have[g]) / cost[g] + 1e-9));
  return n;
}

/** Take a good from wherever the player has spare of it (storage or finished goods in buildings). */
function takeGood(owner, g, n) {
  while (n > 0) {
    let best = null, most = 0;
    for (const b of S.buildings) {
      if (b.dead || b.owner !== owner) continue;
      const a = supplyOf(b, g);
      if (a > most) { most = a; best = b; }
    }
    if (!best) return false;
    bump(best.stock, g, -1);
    usedGood(owner, g, 1);
    n--;
  }
  return true;
}

/* ------------------------------------------------------------------ plans paid as goods come in */

/*
 * Things planned before the goods are there: road, bridge and tunnel tiles and track planned in
 * Paths, and Walls, Gates, Viaducts (and Ramps a rail line needs) paid straight from storage. They
 * queue in S.planQ, oldest first; settlePlans() pays for them as goods come into storage, and
 * workers only build what's paid for (a site builds as far as its goods go). A good an older plan
 * is still waiting for isn't spent on a newer one.
 */
function queuePlan(kind, ref, owner) {
  // Planned again (say, called off and planned anew): it goes to the back of the queue, once.
  S.planQ = (S.planQ || []).filter((it) => !(it[0] === kind && it[1] === ref));
  S.planQ.push([kind, ref, owner]);
}

/** Is site b paid for straight from storage (no Hauler, no road), a unit at a time? */
function storeFunded(b) { return !!(BDEFS[b.type].prepaid || b.fromStore); }

/** What site b still needs from storage, e.g. { alloy: 2 } ({} once it's paid for). */
function stillOwed(b) {
  const c = siteCost(b), out = {};
  for (const g in c) { const n = Math.ceil(c[g] - (b.stock[g] || 0) - 1e-9); if (n > 0) out[g] = n; }
  return out;
}

/** Pay site b what storage can give, a unit at a time, skipping goods in `short` (and adding the ones that run out). True once it's paid for. */
function payInto(b, short) {
  const owed = stillOwed(b);
  let done = true;
  for (const g in owed) {
    let n = owed[g];
    if (short && short.has(g)) { done = false; continue; }
    while (n > 0 && takeGood(b.owner, g, 1)) { bump(b.stock, g, 1); n--; }
    if (n > 0) { done = false; if (short) short.add(g); }
  }
  return done;
}

/** Pay for queued plans, oldest first, from what's in storage now. */
function settlePlans() {
  const Q = S.planQ;
  if (!Q || !Q.length) return;
  const short = S.players.map(() => new Set()), keep = [];
  for (const it of Q) {
    const [kind, ref, o] = it, sh = short[o];
    if (kind === 'b') {
      const b = getE(ref);
      if (b && !b.dead && !b.built && !payInto(b, sh)) keep.push(it);
      continue;
    }
    const t = ref;
    if (kind === 'j') {
      // A planned light or overpass: paid all at once, then it goes up. Dropped if the junction is gone.
      const P = junPlanAt(t);
      if (!P || P.owner !== o) continue;
      if (!S.road[t] || !isJunction(t) || S.owner[t] !== o || S.over[t] || (P.kind === 'light' && S.lights[t]) || (P.kind === 'over' && crossTile(t))) { cancelJunPlan(t); continue; }
      const cost = junPlanCost(t, P), have = spendable(o);
      if (Object.keys(cost).some((g) => sh.has(g))) { keep.push(it); continue; }
      const lack = Object.keys(cost).filter((g) => (have[g] || 0) < cost[g]);
      if (lack.length) { for (const g of lack) sh.add(g); keep.push(it); continue; }
      for (const g in cost) takeGood(o, g, cost[g]);
      if (P.kind === 'over') { delete S.lights[t]; S.over[t] = { owner: o }; markDirty(t % S.W, (t / S.W) | 0); }
      else S.lights[t] = { owner: o, ph: 0, tm: 0, clr: 0 };
      cancelJunPlan(t);
      continue;
    }
    let cost;
    if (kind === 'p') {
      if (S.pipePlan[t] !== o + 1) continue;
      if (S.pipe[t] || pipeBlocked(o, t)) { S.pipePlan[t] = 0; continue; } // laid already, or can't go there any more: dropped
      cost = PIPE_COST;
    } else if (kind === 'r') {
      if (S.plan[t] !== o + 1 || !S.owe[t]) continue;
      cost = roadTileCost(t);
    } else {
      if (S.railPlan[t] !== o + 1) continue;
      if (S.rail[t]) { setRailPlan(t, 0); continue; }
      const s = S.bAt[t] && getE(S.bAt[t]);
      if (railBlocked(o, t)) {
        if (s && s.type === 'ramp' && !s.built && s.owner === o) keep.push(it); // waits for its Ramp
        else setRailPlan(t, 0); // can't go here any more (outside the border, say): dropped, nothing was paid
        continue;
      }
      cost = railCost(t);
    }
    if (Object.keys(cost).some((g) => sh.has(g))) { keep.push(it); continue; }
    if (!canAffordRoad(o, cost)) {
      for (const g in cost) if (!canAffordRoad(o, { [g]: cost[g] })) sh.add(g);
      keep.push(it);
      continue;
    }
    payRoad(o, cost);
    if (kind === 'p') { S.pipePlan[t] = 0; setPipe(t, o + 1); }
    else if (kind === 'r') setOwe(t, 0);
    else { setRailPlan(t, 0); setRail(t, true); }
  }
  S.planQ = keep;
}

/** How many of `owner`'s plans are waiting for goods: { tiles, track, sites, owed: {good: n} }. */
function plansWaiting(owner) {
  const out = { tiles: 0, track: 0, pipes: 0, sites: 0, junctions: 0, owed: {} };
  for (const [kind, ref, o] of S.planQ || []) {
    if (o !== owner) continue;
    let c = null;
    if (kind === 'r' && S.plan[ref] === o + 1 && S.owe[ref]) { out.tiles++; c = roadTileCost(ref); }
    else if (kind === 't' && S.railPlan[ref] === o + 1) { out.track++; c = railCost(ref); }
    else if (kind === 'p' && S.pipePlan[ref] === o + 1 && !S.pipe[ref]) { out.pipes++; c = PIPE_COST; }
    else if (kind === 'b') { const b = getE(ref); if (b && !b.dead && !b.built && Object.keys(stillOwed(b)).length) { out.sites++; c = stillOwed(b); } }
    else if (kind === 'j') { const P = junPlanAt(ref); if (P && P.owner === o) { out.junctions++; c = junPlanCost(ref, P); } }
    if (c) for (const g in c) out.owed[g] = (out.owed[g] || 0) + c[g];
  }
  return out;
}

function payRoad(owner, cost, mul) {
  const P = S.players[owner];
  for (const g in cost) {
    let c = roadCredit(owner, g) - cost[g] * (mul || 1);
    while (c < -1e-9 && takeGood(owner, g, 1)) c += 1;
    P.roadCredit[g] = Math.round(c * 1000) / 1000;
  }
}

function refundRoad(owner, cost, i, j, mul) {
  const P = S.players[owner];
  const store = nearestStoreTo(owner, i + 0.5, j + 0.5);
  for (const g in cost) {
    let c = roadCredit(owner, g) + cost[g] * (mul || 1);
    while (c >= 1 - 1e-9 && store) { bump(store.stock, g, 1); c -= 1; }
    P.roadCredit[g] = Math.round(c * 1000) / 1000;
  }
}

/**
 * Plan a road tile, paying its Cement (ROAD_CLEAR times as much through resources, which paving
 * clears). Free workers then pave it. Returns '' on success or a reason it couldn't be done.
 */
function buildRoad(owner, i, j, queue) {
  const t = tIdx(i, j);
  if (S.road[t] || S.plan[t]) return '';
  if (!canRoad(owner, i, j)) return 'You can only lay roads inside your border.';
  // Planned from Paths: it joins the queue and is paid for as the goods come in (settlePlans).
  if (queue) { setPlan(t, owner); setOwe(t, 1); queuePlan('r', t, owner); return ''; }
  const cost = roadTileCost(t), c = CROSS[S.terrain[t]];
  if (!canAffordRoad(owner, cost)) {
    return c ? `A ${c.name.toLowerCase()} tile costs ${costText(cost)}.` : `Out of ${Object.keys(roadCost()).map((g) => GOOD[g].name).join(' and ')} for roads. Make more at a Cement Works.`;
  }
  payRoad(owner, cost);
  setPlan(t, owner); // free workers come and pave it
  return '';
}

/** "2 Cement, 1 Alloy" */
function costText(cost) {
  return Object.keys(cost).map((g) => `${Math.round(cost[g] * 100) / 100} ${GOOD[g].name}`).join(', ');
}

/** Remove a road tile, or call off a planned one, and refund its Cement (Asphalt on top isn't returned). */
function removeRoad(owner, i, j) {
  const t = tIdx(i, j);
  if (S.plan[t] === owner + 1) { cancelPlan(t); return; }
  if (!S.road[t] || !roadOwnedBy(owner, t)) return; // only your own roads (a rival's are wrecked by raids or Missiles)
  const cross = crossTile(t);
  setRoad(i, j, false);
  if (S.terrain[t] === T_WATER || S.terrain[t] === T_CHASM) computeTerritory();
  if (S.over && S.over[t]) removeOverpass(t);
  refundRoad(owner, cross ? CROSS[S.terrain[t]].cost : roadCost(), i, j);
  if (cross) computeZones();
}

/** Set a Depot's supply order for good g (0 clears it). Ordering a good also switches it back on there. */
function setKeep(b, g, n) {
  n = clamp(Math.round(n), 0, KEEP_MAX);
  b.keep = b.keep || {};
  if (n > 0) { b.keep[g] = n; if (b.reject) { delete b.reject[g]; if (!Object.keys(b.reject).length) delete b.reject; } }
  else delete b.keep[g];
  if (!Object.keys(b.keep).length) delete b.keep;
}

/** Pausing a building sends its worker off to do other jobs until it is resumed. */
function setPaused(b, paused) {
  if (b.dead || !BDEFS[b.type].staff) return;
  b.paused = !!paused;
  if (b.paused) unstaff(b);
}

/** Send a building's operator off to other work. */
function unstaff(b) {
  for (const u of S.bots) {
    if (!u.dead && u.task && u.task.type === 'staff' && u.task.bld === b.id) {
      if (u.carry) { bump(b.stock, u.carry, 1); u.carry = null; u.carryN = 0; }
      if (u.inside === b.id) exitBuilding(u);
      cancelTask(u);
    }
  }
  b.staff = 0;
  b.staffInc = 0;
}

/** Higher = released first when workers run short. */
function releaseScore(b) {
  const def = BDEFS[b.type];
  let s = b.born / 10000 + (prioRank(b) - 1) * 20;
  if (def.plant) s += 10;
  if (def.gather) s += (b.stock[RES[def.gather].good] || 0) >= def.out[RES[def.gather].good] ? 6 : 3;
  return s;
}

/**
 * Take building b down. Half its materials go straight to your nearest other storage (a cancelled
 * site's delivered materials all go back). Everything inside a finished building (a Silo's
 * Missiles, a pump's last Crude, a Depot's whole stock, a Nuclear Silo's missile as its parts)
 * spills out in crates on its tile, and your haulers carry them to storage.
 * Returns { goods: what went to storage, to: that storage's id (0 if you have none), crates }.
 */
function demolish(b) {
  if (b.dead || b.type === 'lander') return null;
  const def = BDEFS[b.type];
  // Never into itself: a Depot used to be its own nearest storage, and lost everything.
  const store = nearestStoreTo(b.owner, b.x + 0.5, b.y + 0.5, b);
  const out = { goods: {}, to: store ? store.id : 0, crates: 0 };
  const give = (g, n) => { if (store && n > 0 && GOOD[g]) { bump(store.stock, g, n); bump(out.goods, g, n); } };
  const cost = siteCost(b);
  if (b.built) {
    for (const g in cost) give(g, Math.floor(cost[g] / 2));
    if (def.nukeSilo && b.armed) { for (const g in NUKE.parts) bump(b.stock, g, NUKE.parts[g]); b.armed = 0; }
    out.crates = dropLoot(b);
  } else if (store) {
    for (const g in b.stock) give(g, Math.min(b.stock[g], cost[g] || 0));
    b.stock = {};
  } else out.crates = dropLoot(b);
  destroyBuilding(b, false);
  return out;
}

/* ------------------------------------------------------------------ statistics */

/*
 * Every HIST_STEP seconds each player's colony is sampled for the statistics screen: bots, buildings,
 * land, goods on hand, and how busy each kind of building was during that stretch. Long games are
 * thinned out (every other sample dropped) so the history stays small in the save.
 */
const HIST_MAX = 240;

function newHistory(n) { return { t: [], p: Array.from({ length: n || 2 }, () => ({})) }; }

function recordHistory() {
  const H = S.hist || (S.hist = newHistory());
  H.t.push(Math.round(S.time));
  for (const P of S.players) {
    if (P.absent) continue;
    const h = H.p[P.id] || (H.p[P.id] = {});
    const push = (k, v) => (h[k] = h[k] || []).push(v);
    let civ = 0, war = 0, blds = 0;
    for (const u of S.bots) if (!u.dead && u.owner === P.id) { if (u.type === 'warbot') war++; else civ++; }
    const use = {};
    for (const b of S.buildings) {
      if (b.dead || b.owner !== P.id || !b.built) continue;
      blds++;
      if (!(b.upI > 0)) continue;
      const pct = Math.round(Math.min(1, (b.useI || 0) / b.upI) * 100);
      (b.useHist = b.useHist || []).push(pct);
      if (b.useHist.length > 40) b.useHist.shift();
      (use[b.type] = use[b.type] || []).push(pct);
      b.useI = 0; b.upI = 0;
    }
    push('civ', civ); push('war', war); push('blds', blds);
    // Totals made and used, kept for the last two minutes, for the goods panel's rates.
    P.rateLog = (P.rateLog || []).concat([{ t: S.time, made: { ...(P.made || {}) }, used: { ...(P.used || {}) } }]);
    while (P.rateLog.length > 9) P.rateLog.shift();
    push('land', Math.round(landShare(P.id) * 1000) / 10);
    const goods = playerGoods(P.id);
    h.goods = h.goods || {};
    h.use = h.use || {};
    const n = H.t.length;
    for (const g of GOODS) {
      const arr = h.goods[g] = h.goods[g] || [];
      while (arr.length < n - 1) arr.push(0);
      arr.push(goods[g]);
    }
    for (const type in use) {
      const arr = h.use[type] = h.use[type] || [];
      while (arr.length < n - 1) arr.push(null);
      arr.push(Math.round(use[type].reduce((a, v) => a + v, 0) / use[type].length));
    }
    for (const type in h.use) if (h.use[type].length < n) h.use[type].push(null);
  }
  if (H.t.length > HIST_MAX) {
    const thin = (a) => a.filter((_, k) => k % 2 === 1);
    H.t = thin(H.t);
    for (const h of H.p) {
      for (const k in h) {
        if (Array.isArray(h[k])) h[k] = thin(h[k]);
        else for (const g in h[k]) h[k][g] = thin(h[k][g]);
      }
    }
  }
}

/** Share of the time (0..1) a player's buildings of each type were busy over the whole game. */
function usageByType(p) {
  const out = {};
  for (const b of S.buildings) {
    if (b.dead || b.owner !== p || !b.built || !(b.upT > 0)) continue;
    const o = out[b.type] = out[b.type] || { up: 0, use: 0, n: 0 };
    o.up += b.upT; o.use += b.useT || 0; o.n++;
  }
  return out;
}

/* ------------------------------------------------------------------ planet events */

/** The planet event under way (past its warning), of `type` if given, or null. */
function eventNow(type) {
  const E = S.event;
  return E && S.time >= E.t0 && (!type || E.type === type) ? E : null;
}
/** Bot speed in a dust storm. */
function evSpeed() { return S.event && S.event.type === 'dust' && S.time >= S.event.t0 ? DUST_SPEED : 1; }
/** Battery drain in a solar flare. */
function evDrain() { return S.event && S.event.type === 'flare' && S.time >= S.event.t0 ? FLARE_DRAIN : 1; }

/** Start, run and end planet events (see EVENTS). */
function updateEvents() {
  if (!S.events || S.mission) return;
  const E = S.event;
  if (E) {
    if (!E.started && S.time >= E.t0) startEvent(E);
    if (E.type === 'meteor' && E.started) for (const h of E.hits) if (!h.done && S.time >= h.at) { h.done = 1; meteorImpact(E, h); }
    if (S.time >= E.t1) endEvent(E);
    return;
  }
  if (S.time < (S.nextEvent ?? EVENT_FIRST)) return;
  S.evN = (S.evN || 0) + 1;
  const rng = makeRng(((S.seed ^ 0x51ed27) + S.evN * 7919) >>> 0);
  const recent = S.recentEvents || [];
  const pool = EVENT_ORDER.filter((k) => !recent.includes(k)); // never one of the last two again
  const type = pool[Math.floor(rng() * pool.length)], def = EVENTS[type];
  const t0 = S.time + (def.warn ? EVENT_WARN : 0), dur = def.dur[0] + rng() * (def.dur[1] - def.dur[0]);
  S.event = { type, t0, t1: t0 + dur, n: S.evN };
  if (type === 'meteor') { S.event.hits = meteorPlan(rng, t0, dur); S.event.dir = rng() < 0.5 ? -1 : 1; S.event.cratered = {}; S.event.relaid = {}; }
  if (def.warn) {
    postMsg(0, type === 'dust' ? `A dust storm is blowing in (${EVENT_WARN}s): bots will slow down and Missiles will be grounded.`
      : type === 'meteor' ? `Meteor shower in ${EVENT_WARN}s! Meteors will crater roads, but leave rich Ore and Crystal where they land.`
        : `Solar flare in ${EVENT_WARN}s: bot batteries will drain twice as fast. Keep your Charging Stations fuelled.`, undefined, undefined, 'warn');
    sfx('alert');
  }
}

function startEvent(E) {
  E.started = true;
  if (E.type === 'trader') {
    E.offers = {};
    for (const P of S.players) {
      if (P.absent || P.out) continue;
      const o = traderOffer(P.id);
      if (!o) continue;
      E.offers[P.id] = o;
      // A rival takes the deal when its land is running short of what's on offer.
      if (P.ai && P.id !== 0 && o.short) acceptTrade(P.id);
    }
    const o = E.offers[0];
    postMsg(0, o ? `A trader ship is in orbit for ${Math.round(E.t1 - E.t0)}s: it offers ${o.m} ${GOOD[o.get].name} (your land is running lowest on it) for ${o.n} of your ${GOOD[o.give].name}. Tap Trade to take it.`
      : 'A trader ship is in orbit, but it wants nothing you have spare.', undefined, undefined, 'info');
    sfx('order');
  } else if (E.type === 'dust') postMsg(0, 'The dust storm is here: bots crawl and Missiles are grounded until it blows over.', undefined, undefined, 'warn');
  else if (E.type === 'flare') postMsg(0, 'Solar flare! Bot batteries are draining twice as fast.', undefined, undefined, 'warn');
}

function endEvent(E) {
  S.recentEvents = (S.recentEvents || []).concat(E.type).slice(-2);
  S.event = null;
  const rng = makeRng(((S.seed ^ 0x3c1f) + E.n * 104729) >>> 0);
  S.nextEvent = S.time + EVENT_GAP[0] + rng() * (EVENT_GAP[1] - EVENT_GAP[0]);
  if (E.type === 'dust') postMsg(0, 'The dust storm has blown over.', undefined, undefined, 'info');
  else if (E.type === 'flare') postMsg(0, 'The solar flare has passed.', undefined, undefined, 'info');
  else if (E.type === 'trader') postMsg(0, 'The trader ship has left orbit.', undefined, undefined, 'info');
  else if (E.type === 'meteor') {
    const n = E.cratered[0] || 0, k = E.relaid[0] || 0;
    postMsg(0, 'The meteor shower is over. Rich Ore and Crystal lie where the meteors fell' +
      (n ? `; ${n} road tile${n > 1 ? 's were' : ' was'} cratered${k === n ? ' and your workers will re-lay them.' : k ? `: ${k} planned again, the rest need Cement.` : ': re-lay them when you have the Cement.'}` : '.'), undefined, undefined, 'info');
  }
}

/**
 * Where a meteor shower's meteors fall: METEOR_HITS spots on player 0's share of the planet (half
 * of them near its landing site), each copied to the same spot on every other colony's share
 * (mirrored with two players, turned with three), so the shower is fair.
 */
function meteorPlan(rng, t0, dur) {
  const W = S.W, H = S.H, np = S.players.length, alone = S.mode === 'colony';
  const ccx = (W - 1) / 2, ccy = (H - 1) / 2, SEC = (2 * Math.PI) / 3;
  const sector = (x, y) => { let a = Math.atan2(y - ccy, x - ccx) - Math.PI / 6; a = ((a % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI); return Math.floor(a / SEC) % 3; };
  const mine = (i, j) => alone || (np === 2 ? j >= H / 2 : sector(i, j) === 0);
  const L = getE(S.players[0].lander), hits = [], n = METEOR_HITS * (alone ? 2 : 1);
  for (let k = 0; k < n; k++) {
    let x = -1, y = -1;
    for (let tries = 0; tries < 40 && x < 0; tries++) {
      let i, j;
      if (L && k % 2 === 0) { const a = rng() * Math.PI * 2, r = 4 + rng() * 14; i = Math.round(L.x + Math.cos(a) * r); j = Math.round(L.y + Math.sin(a) * r); } else { i = Math.floor(rng() * W); j = Math.floor(rng() * H); }
      if (inMap(i, j) && mine(i, j) && S.terrain[tIdx(i, j)] === T_GROUND) { x = i; y = j; }
    }
    if (x < 0) continue;
    const at = t0 + 1.5 + ((k + rng() * 0.8) * (dur - 4)) / n, roll = rng();
    const spots = [[x, y]];
    if (!alone && np === 2) spots.push([W - 1 - x, H - 1 - y]);
    if (!alone && np === 3) for (let r = 1; r < 3; r++) {
      const a = r * SEC, c = Math.cos(a), s = Math.sin(a), dx = x - ccx, dy = y - ccy;
      spots.push([Math.round(ccx + dx * c - dy * s), Math.round(ccy + dx * s + dy * c)]);
    }
    for (const [i, j] of spots) if (inMap(i, j)) hits.push({ x: i, y: j, at, roll, done: 0 });
  }
  return hits;
}

/** A meteor lands on tile (h.x, h.y). */
function meteorImpact(E, h) {
  const cx = h.x + 0.5, cy = h.y + 0.5, owner = S.owner[tIdx(h.x, h.y)];
  addFx('boom', cx, cy, { r: 1.7 });
  addFx('smoke', cx, cy, { r: 1 });
  addFx('crater', cx, cy, { life: 6 });
  if (owner === 0) {
    sfx('boom');
    if (S.time - (E.msgT || -99) > 12) { E.msgT = S.time; postMsg(0, 'A meteor struck your land!', h.x, h.y, 'bad'); }
  }
  // Roads on the spot and next to it are cratered (bridges and tunnels are too solid).
  const wrecked = [];
  for (let dj = -1; dj <= 1; dj++) for (let di = -1; di <= 1; di++) {
    const i = h.x + di, j = h.y + dj;
    if (Math.abs(di) + Math.abs(dj) > 1 || !inMap(i, j)) continue;
    const t = tIdx(i, j);
    if (!S.road[t] || S.bAt[t] || crossTile(t)) continue;
    const o = S.owner[t];
    wreckRoad(t, o, '');
    if (o >= 0) { wrecked.push([o, i, j]); E.cratered[o] = (E.cratered[o] || 0) + 1; }
  }
  // Buildings and bots close by are dented (never wrecked).
  for (const b of S.buildings) {
    if (b.dead || dist2(b.x + 0.5, b.y + 0.5, cx, cy) > 2.6) continue;
    b.armor = Math.max(1, b.armor - METEOR_DAMAGE);
  }
  for (const u of S.bots) if (!u.dead && !u.inside && dist2(u.x, u.y, cx, cy) <= 2.6) damageBot(u, METEOR_BOT_DAMAGE);
  // A rich deposit where it fell: Ore or Crystal (sometimes Uranium, in a Nuclear race).
  const r = nukeOn() && h.roll < 0.2 ? R_URANIUM : h.roll < 0.6 ? R_ORE : R_CRYSTAL;
  const pr = RESOURCE_PRESETS[(S.settings && S.settings.rich) ?? DEFAULT_RICH] || RESOURCE_PRESETS[DEFAULT_RICH];
  const amt = Math.min(255, Math.round(RES[r].amount * (r === R_URANIUM ? 1 : pr.amount * METEOR_RICH)));
  const spots = [];
  for (let dj = -1; dj <= 1; dj++) for (let di = -1; di <= 1; di++) spots.push([di * di + dj * dj, h.x + di, h.y + dj]);
  spots.sort((a, b) => a[0] - b[0]);
  let placed = 0;
  for (const [, i, j] of spots) {
    if (placed >= (r === R_URANIUM ? 1 : 3) || !inMap(i, j)) continue;
    const t = tIdx(i, j);
    if (S.terrain[t] !== T_GROUND || S.res[t] || S.bAt[t] || S.road[t] || S.plan[t] || S.ramp[t] || S.fert[t]) continue;
    if (wrecked.some(([, wi, wj]) => wi === i && wj === j)) continue;
    S.res[t] = r; S.amt[t] = amt;
    if (S.grow) S.grow[t] = 1;
    clearDecor(t);
    markDirty(i, j);
    placed++;
  }
  // Cratered roads are planned again straight away, as far as the Cement goes.
  for (const [o, i, j] of wrecked) {
    const P = S.players[o];
    if (!P || P.absent || P.out) continue;
    if (!buildRoad(o, i, j)) E.relaid[o] = (E.relaid[o] || 0) + 1;
  }
}

/**
 * The trader's offer to player p (see TRADE_GET): the raw good p is closest to running out of, for
 * some of a good p has plenty of. null if p has nothing much to spare.
 */
function traderOffer(p) {
  const have = spendable(p);
  // What's left of each raw good: in stock, and in the ground on p's land.
  const left = {};
  for (const g in TRADE_GET) left[g] = have[g] || 0;
  for (let t = 0; t < S.W * S.H; t++) {
    if (S.owner[t] !== p || !S.res[t]) continue;
    for (const g in TRADE_GET) if (S.res[t] === TRADE_GET[g]) left[g] += S.amt[t];
  }
  let get = null, lv = Infinity;
  for (const g in TRADE_GET) {
    if (g === 'crude' && !S.buildings.some((b) => !b.dead && b.owner === p && b.type === 'pump')) continue; // no use for it yet
    const v = left[g] / TRADE_LEFT[g];
    if (v < lv) { lv = v; get = g; }
  }
  // What it asks for: the good furthest over what the colony likes to keep (at least half again).
  let give = null, gv = 1.5;
  for (const g of TRADE_GIVE) {
    if (g === get) continue;
    const v = (have[g] || 0) / TRADE_KEEP[g];
    if ((have[g] || 0) >= 8 && v > gv) { gv = v; give = g; }
  }
  if (!give || !get) return null;
  const n = clamp(Math.round((have[give] - TRADE_KEEP[give]) * 0.6), 6, 40);
  const m = Math.max(3, Math.round((n * TRADE_VALUE[give] * TRADE_BONUS) / TRADE_VALUE[get]));
  return { give, n, get, m, short: lv < 1, done: false };
}

/** Take the trader's offer: '' if done, or why not. */
function acceptTrade(p) {
  const E = eventNow('trader'), o = E && E.offers && E.offers[p];
  if (!o || o.done) return 'The trader has gone.';
  if ((spendable(p)[o.give] || 0) < o.n) return `You need ${o.n} ${GOOD[o.give].name} in storage.`;
  const L = getE(S.players[p].lander);
  const store = L && !L.dead && L.owner === p ? L : nearestStoreTo(p, S.W / 2, S.H / 2);
  if (!store) return 'You have nowhere to store the goods.';
  takeGood(p, o.give, o.n);
  bump(store.stock, o.get, o.m);
  madeGood(p, o.get, o.m);
  o.done = true;
  if (p === 0) postMsg(0, `Deal done: ${o.m} ${GOOD[o.get].name} are in your Command Base.`, store.x, store.y, 'good');
  return '';
}

/* ------------------------------------------------------------------ research (Colony) */

/** Has player p researched upgrade k (see TECHS)? */
function tech(p, k) { const P = S.players[p]; return !!(P && P.tech && P.tech[k]); }
/** Speed, battery drain and carrying for bot u, with planet events and research applied. */
function speedMul(u) { return evSpeed() * (tech(u.owner, 'motors') ? 1.15 : 1); }
function drainMul(u) { return evDrain() * (tech(u.owner, 'cells') ? 0.7 : 1); }
function botCarry(u) { const bt = BOTS[u.type], c = bt.carry || 1; return tech(u.owner, 'cargo') && bt.haul ? c + (bt.rail ? 8 : bt.train ? 6 : bt.truck ? 2 : 1) : c; }
/** How many of good g bot u can carry at once: anything but a Tanker carries Crude and Fuel one at a time. */
function carryOf(u, g) { return isLiquid(g) && !BOTS[u.type].tanker ? 1 : botCarry(u); }
/** A Pulse Turret's reach and shots per Crystal. */
function turretRange(b) { return BDEFS[b.type].range + (b.type === 'turret' && tech(b.owner, 'sentry') ? 1.5 : 0); }
function shotsPer(b) { return tech(b.owner, 'sentry') ? 6 : SHOTS_PER_AMMO; }

/** Start researching upgrade k: '' if started, or why not. */
function startResearch(p, k) {
  const P = S.players[p], def = TECHS[k];
  if (!def) return 'Unknown upgrade.';
  if (tech(p, k)) return 'Already researched.';
  if (P.research) return `Already researching ${TECHS[P.research.key].name}.`;
  if (!S.buildings.some((b) => !b.dead && b.owner === p && b.type === 'lab' && b.built)) return 'Build a Research Lab first.';
  if (!canPay(p, def.cost)) return `Not enough ${missingGoods(p, def.cost)} in storage.`;
  for (const g in def.cost) takeGood(p, g, def.cost[g]);
  P.research = { key: k, t: 0 };
  return '';
}

/** Call off the research under way; its cost comes back to storage. */
function cancelResearch(p) {
  const P = S.players[p], r = P.research;
  if (!r) return;
  const L = getE(P.lander), store = L && L.owner === p && !L.dead ? L : nearestStoreTo(p, S.W / 2, S.H / 2);
  if (store) for (const g in TECHS[r.key].cost) bump(store.stock, g, TECHS[r.key].cost[g]);
  P.research = null;
}

function finishResearch(p, lab) {
  const P = S.players[p], k = P.research.key, def = TECHS[k];
  (P.tech = P.tech || {})[k] = true;
  P.research = null;
  if (k === 'tools') P.mult *= 1.15;
  postMsg(p, `Research complete: ${def.name}. ${def.desc}`, lab.x, lab.y, 'good');
  if (p === 0) sfx('complete');
}

/** A Research Lab: a worker inside works on the colony's research. */
function updateLab(b, dt) {
  const P = S.players[b.owner], r = P.research;
  if (!r) {
    b.status = 'Idle: pick an upgrade to research';
    if (b.staff || b.staffInc) unstaff(b);
    return;
  }
  const op = getE(b.staff);
  if (!op || op.inside !== b.id) return; // the worker is on the way (status set by updateBuilding)
  b.working = true;
  r.t += dt * P.mult;
  const def = TECHS[r.key];
  b.status = `Researching ${def.name}: ${Math.min(99, Math.floor((100 * r.t) / def.time))}%`;
  if (r.t >= def.time) finishResearch(b.owner, b);
}

/** Nanite Repair: once a second, bots and buildings nothing has hit for a while mend a little. */
function naniteRepair() {
  for (const P of S.players) {
    if (!P.tech || !P.tech.nanites) continue;
    for (const u of S.bots) if (!u.dead && u.owner === P.id && u.hp < u.maxHp && S.time - (u.hurtT ?? -99) > 12) u.hp = Math.min(u.maxHp, u.hp + 0.3);
    for (const b of S.buildings) {
      if (b.dead || b.owner !== P.id || !b.built || b.fixLeft > 0) continue;
      const max = BDEFS[b.type].armor;
      if (b.armor < max && S.time - (b.lastHit ?? -99) > 15) b.armor = Math.min(max, b.armor + 0.25);
    }
  }
}

/* ------------------------------------------------------------------ wildlife (Colony) */

function wildOn() { return !!(S && S.wildlife); }
function isWildBot(u) { return !!BOTS[u.type].wild; }

/**
 * Scatter creature nests over the wilds at the start of a Colony game: one for every WILD.perTiles
 * tiles (3 to 8), on open ground the colony can reach on foot, at least 16 tiles from the landing
 * site and 9 from each other.
 */
function placeNests(seed) {
  const L = getE(S.players[0].lander);
  if (!L) return;
  const rng = makeRng((seed ^ 0x6e357) >>> 0), zone = S.zone[tIdx(L.x, L.y)];
  const want = clamp(Math.round((S.W * S.H) / WILD.perTiles), 3, 8), nests = [];
  for (let tries = 0; tries < 4000 && nests.length < want; tries++) {
    const i = 1 + Math.floor(rng() * (S.W - 2)), j = 1 + Math.floor(rng() * (S.H - 2)), t = tIdx(i, j);
    if (S.terrain[t] !== T_GROUND || S.res[t] || S.fert[t] || S.ramp[t] || S.road[t] || S.bAt[t] || S.owner[t] >= 0 || S.zone[t] !== zone) continue;
    if (dist(i, j, L.x, L.y) < 16 || nests.some((n) => dist(i, j, n.x, n.y) < 9)) continue;
    let open = 0;
    for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) if (walkable(tIdx(i + di, j + dj)) && !S.bAt[tIdx(i + di, j + dj)]) open++;
    if (open < 3) continue;
    const b = addBuilding(WILD_OWNER, 'nest', i, j, true);
    b.level = 1;
    b.raidAt = WILD.first + rng() * 120;
    for (const g in WILD.loot) b.stock[g] = WILD.loot[g];
    nests.push(b);
    for (let k = 0; k < WILD.guards + 1; k++) spawnCritter(b, 'scuttler');
  }
}

/** A new creature beside nest b. */
function spawnCritter(b, type, task) {
  let x = b.x, y = b.y;
  for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-1, -1], [1, -1], [-1, 1]]) {
    const i = b.x + di, j = b.y + dj;
    if (inMap(i, j) && walkable(tIdx(i, j)) && !S.bAt[tIdx(i, j)]) { x = i; y = j; break; }
  }
  const u = addBot(WILD_OWNER, type, x, y);
  u.x += (hash2(u.id, 3, 5) - 0.5) * 0.5; u.y += (hash2(u.id, 4, 5) - 0.5) * 0.5;
  u.nest = b.id;
  u.task = task || { type: 'guard' };
  return u;
}

/** Remove a creature without a fight (back in its nest, or its nest gone). */
function despawnCritter(u) {
  u.dead = true;
  S.byId.delete(u.id);
}

/** What a nest's next pack goes for: the nearest building, road or bot the colony has within reach. */
function wildTarget(b) {
  let best = null, bd = WILD.reach * WILD.reach;
  for (const e of S.buildings) {
    if (e.dead || e.owner === WILD_OWNER) continue;
    const d = dist2(e.x, e.y, b.x, b.y);
    if (d < bd) { bd = d; best = { x: e.x, y: e.y }; }
  }
  const R0 = WILD.reach;
  for (let j = Math.max(0, b.y - R0); j <= Math.min(S.H - 1, b.y + R0); j++) {
    for (let i = Math.max(0, b.x - R0); i <= Math.min(S.W - 1, b.x + R0); i++) {
      const t = j * S.W + i;
      if (!S.road[t] || S.owner[t] < 0 || S.owner[t] === WILD_OWNER || crossTile(t)) continue;
      const d = dist2(i, j, b.x, b.y);
      if (d < bd) { bd = d; best = { x: i, y: j }; }
    }
  }
  return best;
}

/** A nest: keeps its guards up, grows, and sends packs out at the colony. Runs once a second. */
function updateNest(b) {
  if (S.tick % 30 !== b.id % 30) return;
  if (b.level < 3 && S.time - b.born >= b.level * WILD.grow) {
    b.level++;
    for (const g in WILD.loot) bump(b.stock, g, Math.round(WILD.loot[g] / 2));
  }
  let guards = 0;
  for (const u of S.bots) if (!u.dead && u.nest === b.id && u.task && u.task.type === 'guard') guards++;
  if (guards < WILD.guards + b.level && S.time >= (b.guardT || 0)) {
    spawnCritter(b, 'scuttler');
    b.guardT = S.time + WILD.guardEvery;
  }
  b.status = `Level ${b.level} nest · ${guards} on guard` + (b.raidAt > S.time ? '' : ' · ready to raid');
  if (S.time < b.raidAt) return;
  b.raidAt = S.time + 30; // nothing in reach: look again soon
  const tgt = wildTarget(b);
  if (!tgt) return;
  let built = 0;
  for (const e of S.buildings) if (!e.dead && e.owner === 0 && e.built) built++;
  const size = Math.min(WILD.maxPack, 1 + b.level + Math.floor(built / WILD.perBuildings) + Math.floor(S.time / 1200));
  const brutes = b.level >= 2 ? Math.max(1, Math.floor(size / 4)) : 0;
  const until = S.time + dist(b.x, b.y, tgt.x, tgt.y) / 1.1 + WILD.raidTime;
  for (let k = 0; k < size; k++) spawnCritter(b, k < brutes ? 'brute' : 'scuttler', { type: 'raid', x: tgt.x, y: tgt.y, until });
  const gap = WILD.gap[0] + hash2(b.id, Math.floor(S.time), 41) * (WILD.gap[1] - WILD.gap[0]);
  b.raidAt = S.time + gap;
  postMsg(0, `A pack of ${size} creature${size === 1 ? '' : 's'}${brutes ? ` (${brutes} Brute${brutes === 1 ? '' : 's'})` : ''} is coming out of a nest!`, b.x, b.y, 'warn');
  if (!S.wildWarned) { S.wildWarned = true; sfx('alert'); }
}

/** The nearest colony bot out in the open within r tiles of (x, y). */
function wildPrey(x, y, r) {
  let best = null, bd = r * r;
  for (const v of S.bots) {
    if (v.dead || v.inside || v.owner === WILD_OWNER) continue;
    const d = dist2(v.x, v.y, x, y);
    if (d < bd) { bd = d; best = v; }
  }
  return best;
}

/** A creature bites (a bot) or batters (a building) whatever it's next to. */
function critterBite(u, foe) {
  const bt = BOTS[u.type];
  u.cd = WILD.bite;
  u.face = Math.atan2(foe.y + (foe.ent === 'b' ? 0.5 : 0) - u.y, foe.x + (foe.ent === 'b' ? 0.5 : 0) - u.x);
  u.fought = 1;
  addFx('spark', (u.x + foe.x + (foe.ent === 'b' ? 0.5 : 0)) / 2, (u.y + foe.y + (foe.ent === 'b' ? 0.5 : 0)) / 2, { color: '#c77dff' });
  if (foe.ent === 'b') {
    foe.lastHit = S.time;
    if (!foe.built) {
      foe.armor -= bt.bite;
      if (foe.armor <= 0) { postMsg(foe.owner, `Creatures wrecked your ${BDEFS[foe.type].name} construction site!`, foe.x, foe.y, 'bad'); destroyBuilding(foe, true); }
    } else foe.armor = Math.max(1, foe.armor - bt.bite);
    if (S.time - foe.lastAlert > 12) {
      foe.lastAlert = S.time;
      postMsg(foe.owner, `Creatures are attacking your ${BDEFS[foe.type].name}!`, foe.x, foe.y, 'bad');
      if (foe.owner === 0) sfx('alert');
    }
    return;
  }
  if (foe.owner === 0) {
    sfx('hit');
    const P = S.players[0];
    if (S.time - (P.lastWildMsg || -99) > 20) { P.lastWildMsg = S.time; postMsg(0, 'Creatures are attacking your bots!', Math.floor(foe.x), Math.floor(foe.y), 'bad'); }
  }
  damageBot(foe, bt.bite);
}

/** A colony building or road tile a Brute can get at within r tiles of (x, y). */
function bruteTarget(u, r) {
  let best = null, bd = r * r;
  const ci = Math.floor(u.x), cj = Math.floor(u.y), R0 = Math.ceil(r);
  for (let j = cj - R0; j <= cj + R0; j++) for (let i = ci - R0; i <= ci + R0; i++) {
    if (!inMap(i, j)) continue;
    const t = tIdx(i, j);
    if (!S.road[t] || S.bAt[t] || crossTile(t) || S.owner[t] < 0 || S.owner[t] === WILD_OWNER) continue;
    const d = dist2(i + 0.5, j + 0.5, u.x, u.y);
    if (d < bd) { bd = d; best = { road: t, x: i, y: j }; }
  }
  for (const e of S.buildings) {
    if (e.dead || e.owner === WILD_OWNER || BDEFS[e.type].barrier) continue;
    const d = dist2(e.x + 0.5, e.y + 0.5, u.x, u.y);
    if (d < bd * 0.6) { bd = d / 0.6; best = { bld: e, x: e.x, y: e.y }; }
  }
  return best;
}

/** One creature's turn: guard its nest, or run its raid, fighting whatever it catches. */
function updateCritter(u, dt) {
  const bt = BOTS[u.type], nest = getE(u.nest);
  u.cd -= dt;
  u.moved = 0; u.fought = 0;
  if (!nest || nest.dead) { u.lostT = (u.lostT || 0) + dt; if (u.lostT > 6) despawnCritter(u); return; } // the nest is gone: it scatters
  const t = u.task || (u.task = { type: 'guard' });
  // Something to bite: guards only near the nest, raiders anywhere near them.
  let foe = u.fight ? getE(u.fight) : null;
  if (foe && (foe.dead || foe.inside || dist2(foe.x, foe.y, u.x, u.y) > 36 || (t.type === 'guard' && dist2(foe.x, foe.y, nest.x, nest.y) > 64))) foe = null;
  if (!foe) {
    u.fight = 0;
    u.scanT -= dt;
    if (u.scanT <= 0 && t.type !== 'home') {
      u.scanT = 0.4;
      foe = wildPrey(u.x, u.y, t.type === 'guard' ? 4 : 4.5);
      if (foe && t.type === 'guard' && dist2(foe.x, foe.y, nest.x, nest.y) > 49) foe = null;
      if (foe && foe.id === u.ignoreFoe && S.time < u.ignoreUntil) foe = null;
      if (foe) u.fight = foe.id;
    }
  }
  if (foe) {
    if (dist(u.x, u.y, foe.x, foe.y) > 0.75) {
      if (!moveDirect(u, foe.x, foe.y, dt) && travel(u, Math.floor(foe.x), Math.floor(foe.y), dt) === null) {
        u.fight = 0; u.ignoreFoe = foe.id; u.ignoreUntil = S.time + 5;
      }
    } else if (u.cd <= 0) critterBite(u, foe);
    return;
  }
  if (t.type === 'raid') {
    if (S.time > t.until) { u.task = { type: 'home' }; u.path = null; return; }
    if (!t.arrived) {
      const r = travel(u, t.x, t.y, dt);
      if (r === null || dist2(u.x, u.y, t.x + 0.5, t.y + 0.5) < 2.5) { t.arrived = true; u.path = null; }
      return;
    }
    if (bt.smash) {
      // A Brute: tear up the nearest road, or batter the nearest building.
      let g = t.smash ? (t.smash.bld ? (t.smash.bld.dead ? null : t.smash) : (S.road[t.smash.road] ? t.smash : null)) : null;
      if (!g) { g = bruteTarget(u, 6); t.smash = g; t.work = 0; }
      if (!g) { t.until = Math.min(t.until, S.time + 8); return; }
      const gx = g.x + 0.5, gy = g.y + 0.5;
      if (dist2(u.x, u.y, gx, gy) > (g.bld ? 1.7 : 1.1)) {
        if (!moveDirect(u, gx, gy, dt) && travel(u, g.x, g.y, dt) === null) t.smash = null;
        return;
      }
      u.path = null;
      u.face = Math.atan2(gy - u.y, gx - u.x);
      if (g.bld) { if (u.cd <= 0) critterBite(u, g.bld); return; }
      t.work += dt; u.fought = 1;
      if (t.work >= WILD.roadEvery) { wreckRoad(g.road, S.owner[g.road], 'Creatures are tearing up your roads'); t.smash = null; }
      return;
    }
    // A Scuttler: hunt for bots further out, or move on to the colony's next spot.
    const prey = wildPrey(u.x, u.y, 12);
    if (prey) { u.fight = prey.id; return; }
    t.until = Math.min(t.until, S.time + 10);
    return;
  }
  if (t.type === 'home') {
    const r = travel(u, nest.x, nest.y, dt);
    if (r || r === null || dist2(u.x, u.y, nest.x + 0.5, nest.y + 0.5) < 2.2) {
      let guards = 0;
      for (const v of S.bots) if (!v.dead && v.nest === nest.id && v.task && v.task.type === 'guard') guards++;
      if (guards < WILD.guards + nest.level && u.type === 'scuttler') { u.task = { type: 'guard' }; u.path = null; } else despawnCritter(u);
    }
    return;
  }
  // On guard: stay close to the nest, shuffling about now and then.
  if (dist2(u.x, u.y, nest.x + 0.5, nest.y + 0.5) > 9) { if (travel(u, nest.x, nest.y, dt) === null) u.path = null; return; }
  u.path = null;
  u.wanderT = (u.wanderT || 0) - dt;
  if (u.wanderT <= 0) { u.wanderT = 2 + hash2(u.id, Math.floor(S.time), 3) * 4; u.wx = nest.x + 0.5 + (hash2(u.id, Math.floor(S.time), 5) - 0.5) * 4; u.wy = nest.y + 0.5 + (hash2(u.id, Math.floor(S.time), 6) - 0.5) * 4; }
  if (u.wx !== undefined && dist2(u.x, u.y, u.wx, u.wy) > 0.04) { if (!moveDirect(u, u.wx, u.wy, dt * 0.5)) u.wx = undefined; }
}

/** A nest cleared by `by`'s warbots: its goods spill out and its creatures scatter. */
function clearNest(b, by) {
  const n = dropLoot(b);
  postMsg(by, `Nest cleared!${n ? ` ${n} goods spilled out: your warbots carry them home, one each.` : ''} The land around it is free to build on.`, b.x, b.y, 'good');
  addFx('ring', b.x + 0.5, b.y + 0.5, { color: '#c77dff', r: 2.4 });
  if (by === 0) sfx('capture');
  S.players[by].stats.captured++;
  destroyBuilding(b, true);
}

/* ------------------------------------------------------------------ ropeways */

/** Is tile (i, j) a good far end for a Ropeway from (ai, aj)? '' if so, otherwise why not. */
function ropeEndBlocked(owner, ai, aj, i, j) {
  if (!inMap(i, j)) return 'Outside the map.';
  const t = tIdx(i, j), d = dist(ai, aj, i, j);
  if (d < ROPE_MIN) return `Too close: the far end has to be at least ${ROPE_MIN} tiles away.`;
  if (d > ROPE_MAX) return `Too far: a Ropeway reaches ${ROPE_MAX} tiles.`;
  if (S.owner[t] !== owner) return 'The far end has to be inside your territory.';
  if (S.terrain[t] !== T_GROUND || S.res[t] || S.ramp[t]) return 'The far end needs clear, open ground.';
  if (S.bAt[t]) return 'There is a building at the far end.';
  return '';
}

/**
 * Plan a Ropeway from (ai, aj) to (bi, bj): a construction site at the near end (it takes the whole
 * cost); when it's built the cable goes across and the far station goes up.
 */
function placeRopeway(owner, ai, aj, bi, bj) {
  const why = ropeEndBlocked(owner, ai, aj, bi, bj);
  if (why) return { ok: false, reason: why };
  const r = placeSite(owner, 'ropeway', ai, aj);
  if (r.ok) r.building.ropeTo = tIdx(bi, bj);
  return r;
}

/** The near station is built: put up the far one and join them (or wait while the far end is blocked). */
function ropewayAcross(b) {
  if (!(b.ropeTo >= 0)) return;
  const i = b.ropeTo % S.W, j = (b.ropeTo / S.W) | 0, t = b.ropeTo;
  if (S.bAt[t] || S.terrain[t] !== T_GROUND) {
    if (S.time - (b.ropeMsg || -99) > 30) { b.ropeMsg = S.time; postMsg(b.owner, 'The Ropeway\'s far end is blocked: clear it and the cable goes across.', i, j, 'warn'); }
    return;
  }
  if (S.road[t]) setRoad(i, j, false);
  if (S.plan[t]) cancelPlan(t);
  const f = addBuilding(b.owner, 'ropeway', i, j, true);
  f.link = b.id; b.link = f.id; f.far = true;
  computeZones();
  postMsg(b.owner, 'The Ropeway is running: Haulers and Workers ride it across.', b.x, b.y, 'good');
}

/* ------------------------------------------------------------------ unlimited resources */

/**
 * Unlimited resources, a testing option: once a second, player p's Command Base is stocked with
 * UNLIMITED_STOCK of every good, and each of p's buildings gets whatever it is waiting for (a
 * construction site its materials, a factory its inputs, a charger its Fuel, a garrison its Ammo),
 * so nothing waits on hauling. Rivals play as usual.
 */
const UNLIMITED_STOCK = 500;
function unlimitedTopUp(p) {
  const L = getE(S.players[p].lander);
  if (L && !L.dead && L.owner === p) for (const g of GOODS) if ((L.stock[g] || 0) < UNLIMITED_STOCK) L.stock[g] = UNLIMITED_STOCK;
  for (const b of S.buildings) {
    if (b.dead || b.owner !== p || b === L) continue;
    for (const [g, n] of needsOf(b)) if (n > 0) b.stock[g] = (b.stock[g] || 0) + Math.ceil(n);
  }
}

/* ------------------------------------------------------------------ viaducts */

/**
 * Could a Viaduct run from (ai, aj) to (bi, bj)? '' if so, otherwise why not. Straight along a row
 * or column, VIA_MIN to VIA_MAX tiles, both ends open ground no more than VIA_RISE levels apart,
 * and every tile between lower than both ends (or water or canyon). The far end can be beyond your
 * border, on no-one's land or in a rival's (a bridgehead: see computeTerritory).
 */
function viaductBlocked(owner, ai, aj, bi, bj) {
  if (!inMap(bi, bj)) return 'Outside the map.';
  if (ai !== bi && aj !== bj) return 'A Viaduct runs straight: pick a far end in the same row or column.';
  const n = Math.abs(bi - ai) + Math.abs(bj - aj);
  if (n < VIA_MIN) return 'Too close: there has to be a valley between the ends.';
  if (n > VIA_MAX) return `Too far: a Viaduct spans up to ${VIA_MAX} tiles.`;
  const a = tIdx(ai, aj), t = tIdx(bi, bj);
  if (S.terrain[t] !== T_GROUND || S.res[t] || S.ramp[t]) return 'The far end needs clear, open ground on a clifftop.';
  if (S.bAt[t]) return 'There is a building at the far end.';
  if (Math.abs(S.elev[t] - S.elev[a]) > VIA_RISE) return `The two ends are more than ${VIA_RISE} levels apart.`;
  // Sky islands: the canyon floor (and its low rises) is only reached by Ropeway.
  if (S.settings && SHAPE_PRESETS[S.settings.shape || 0].sky && Math.min(S.elev[a], S.elev[t]) < 3) return 'On Sky islands a Viaduct runs from mesa top to mesa top: only a Ropeway reaches the canyon floor.';
  const low = Math.min(S.elev[a], S.elev[t]), di = Math.sign(bi - ai), dj = Math.sign(bj - aj);
  let dip = false;
  for (let k = 1; k < n; k++) {
    const u = tIdx(ai + di * k, aj + dj * k);
    if (S.terrain[u] === T_GROUND || S.terrain[u] === T_ROCK) { if (S.elev[u] >= low) return 'The ground between has to be lower than both ends: a Viaduct spans a valley.'; dip = true; }
    else if (bridgeable(u)) dip = true;
  }
  if (!dip) return 'There is no valley here to span.';
  return '';
}

/** What a Viaduct from (ai, aj) to (bi, bj) costs: VIA_COST for every tile it spans. */
function viaductCost(ai, aj, bi, bj) {
  const n = Math.abs(bi - ai) + Math.abs(bj - aj) - 1, out = {};
  for (const g in VIA_COST) out[g] = Math.ceil(VIA_COST[g] * n);
  return out;
}

/**
 * Plan a Viaduct from (ai, aj) to (bi, bj): paid now, a construction site at the near end that a
 * worker builds out across the gap; when it's done the far abutment goes up and it opens.
 */
function placeViaduct(owner, ai, aj, bi, bj) {
  const chk = canPlace(owner, 'viaduct', ai, aj);
  if (!chk.ok) return chk;
  const why = viaductBlocked(owner, ai, aj, bi, bj);
  if (why) return { ok: false, reason: why };
  const cost = viaductCost(ai, aj, bi, bj);
  // (The computer pays up front; yours waits for the goods and is paid for as they come in.)
  if (S.players[owner].ai && !canPay(owner, cost)) return { ok: false, reason: `Not enough ${missingGoods(owner, cost)}: this Viaduct costs ${costText(cost)}.` };
  const r = placeSite(owner, 'viaduct', ai, aj, cost);
  if (r.ok) { r.building.viaTo = tIdx(bi, bj); r.building.buildTime = VIA_TIME * (Math.abs(bi - ai) + Math.abs(bj - aj) - 1); }
  return r;
}

/** The near abutment is built: put up the far one and open the Viaduct (or wait while the far end is blocked). */
function viaductAcross(b) {
  if (!(b.viaTo >= 0)) return;
  const i = b.viaTo % S.W, j = (b.viaTo / S.W) | 0, t = b.viaTo;
  // (The far end may be in a rival's land: a bridgehead. It only needs to be clear.)
  if (S.bAt[t] || S.terrain[t] !== T_GROUND) {
    if (S.time - (b.viaMsg || -99) > 30) { b.viaMsg = S.time; postMsg(b.owner, 'The Viaduct\'s far end is blocked: clear it and the deck goes across.', i, j, 'warn'); }
    return;
  }
  if (S.plan[t]) cancelPlan(t);
  const f = addBuilding(b.owner, 'viaduct', i, j, true);
  f.link = b.id; b.link = f.id; f.far = true; f.cost = b.cost;
  S.roadVer = (S.roadVer || 0) + 1; S.railVer = (S.railVer || 0) + 1;
  computeZones();
  computeTerritory(); // the far end claims a little no-one's ground round it
  postMsg(b.owner, 'The Viaduct is open: anything can drive across.', b.x, b.y, 'good');
}

/* ------------------------------------------------------------------ crawlers */

/** Where a Crawler at (i, j) can deploy: the nearest clear, open tile within 2, not in another player's land. -1 if none. */
function deploySpot(owner, i, j) {
  let best = -1, bd = Infinity;
  for (let dj = -2; dj <= 2; dj++) for (let di = -2; di <= 2; di++) {
    const x = i + di, y = j + dj;
    if (!inMap(x, y)) continue;
    const t = tIdx(x, y);
    if (S.terrain[t] !== T_GROUND || S.bAt[t] || S.road[t] || S.plan[t] || S.res[t] || S.ramp[t] || scorched(t)) continue;
    if (S.owner[t] >= 0 && S.owner[t] !== owner) continue;
    if (S.wildlife && S.buildings.some((e) => !e.dead && BDEFS[e.type].wild && Math.max(Math.abs(e.x - x), Math.abs(e.y - y)) <= WILD.clear)) continue;
    const d = di * di + dj * dj;
    if (d < bd) { bd = d; best = t; }
  }
  return best;
}

/** Take a bot off the map without a fight (a Crawler turning into its base). */
function removeBot(u) {
  cancelTask(u);
  exitBuilding(u);
  u.dead = true;
  S.byId.delete(u.id);
}

/** Drive Crawler u to (i, j); it deploys when it gets there. '' if under way, otherwise why not. */
function driveCrawler(u, i, j) {
  if (!inMap(i, j)) return 'Outside the map.';
  if (S.zone[tIdx(i, j)] !== S.zone[tIdx(Math.floor(u.x), Math.floor(u.y))]) return 'The Crawler can\'t roll there: it can\'t climb cliffs or cross water (it needs a slope, a Ramp or a bridge).';
  if (deploySpot(u.owner, i, j) < 0) return 'No clear, open ground to deploy on there.';
  u.task = { type: 'drive', x: i, y: j };
  u.path = null;
  return '';
}

/** A Crawler on the move. It doesn't need charging. */
function updateCrawler(u, dt) {
  u.bat = 100;
  u.moved = 0;
  const t = u.task;
  if (!t || t.type !== 'drive') return;
  const r = travel(u, t.x, t.y, dt);
  if (r === null) { u.task = null; postMsg(u.owner, 'The Crawler can\'t find a way there.', t.x, t.y, 'warn'); return; }
  if (!r && dist2(u.x, u.y, t.x + 0.5, t.y + 0.5) > 2) return;
  u.task = null; u.path = null;
  const why = deployCrawler(u);
  if (why) postMsg(u.owner, why, Math.floor(u.x), Math.floor(u.y), 'warn');
}

/** The Crawler unfolds into its base where it stands (or on the nearest clear tile). '' if done. */
function deployCrawler(u) {
  const t = deploySpot(u.owner, Math.floor(u.x), Math.floor(u.y));
  if (t < 0) return 'The Crawler needs clear, open ground to deploy: drive it somewhere level and empty.';
  const b = addBuilding(u.owner, 'crawlerbase', t % S.W, (t / S.W) | 0, true);
  b.face = u.face || 0; b.deployedAt = S.time; // for the drawing: which way it's parked, and the unfolding
  b.stock = u.cargo || {};
  b.armor = Math.max(4, BDEFS.crawlerbase.armor * (u.hp / u.maxHp));
  if (u.cargoKeep) b.keep = u.cargoKeep;
  removeBot(u);
  computeTerritory();
  addFx('ring', b.x + 0.5, b.y + 0.5, { color: PLAYER_COLORS[b.owner], r: 2.5 });
  postMsg(b.owner, 'The Crawler is deployed: storage, charging and an Outpost\'s land, right here.', b.x, b.y, 'good');
  if (b.owner === 0) sfx('complete');
  return '';
}

/** Pack a deployed Crawler up to move: its goods (and supply orders) go along; its land goes. */
function packCrawler(b) {
  if (b.dead || !BDEFS[b.type].mobile) return null;
  releaseBotsFrom(b, false);
  const u = addBot(b.owner, 'crawler', b.x, b.y);
  u.face = b.face || 0; u.packedAt = S.time; // folding back up (drawn)
  S.players[b.owner].stats.bots--; // the same machine, not a new bot
  u.cargo = {};
  for (const g in b.stock) if (b.stock[g] > 0) u.cargo[g] = b.stock[g];
  if (b.keep) u.cargoKeep = b.keep;
  u.hp = Math.max(1, Math.round(u.maxHp * clamp(b.armor / BDEFS[b.type].armor, 0.1, 1)));
  b.dead = true;
  S.byId.delete(b.id);
  S.bAt[tIdx(b.x, b.y)] = 0;
  markDirty(b.x, b.y);
  computeTerritory();
  return u;
}

/* ------------------------------------------------------------------ pipelines */

/** Pipe networks (see PIPE_COST): comp[t] is the network of pipe tile t (-1 for none), rebuilt when pipe changes. */
const PIPE_NET = { ver: -1, of: null, comp: null, n: 0, flow: [] };
function pipeNet() {
  if (PIPE_NET.of === S && PIPE_NET.ver === S.pipeVer) return PIPE_NET;
  const N = S.W * S.H, comp = new Int32Array(N).fill(-1), q = [];
  let n = 0;
  for (let s = 0; s < N; s++) {
    if (!S.pipe[s] || comp[s] >= 0) continue;
    comp[s] = n; q.length = 0; q.push(s);
    while (q.length) {
      const t = q.pop(), i = t % S.W;
      for (const u of [t - 1, t + 1, t - S.W, t + S.W]) {
        if (u < 0 || u >= N || (u === t - 1 && i === 0) || (u === t + 1 && i === S.W - 1)) continue;
        if (S.pipe[u] === S.pipe[s] && comp[u] < 0) { comp[u] = n; q.push(u); }
      }
    }
    n++;
  }
  PIPE_NET.ver = S.pipeVer; PIPE_NET.of = S; PIPE_NET.comp = comp; PIPE_NET.n = n; PIPE_NET.flow = [];
  return PIPE_NET;
}

/** The pipe networks building b is joined to: its owner's pipe under it or beside it. */
function buildingPipes(b, net) {
  const out = [], own = b.owner + 1, comp = (net || pipeNet()).comp;
  for (const [di, dj] of [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1]]) {
    if (!inMap(b.x + di, b.y + dj)) continue;
    const t = tIdx(b.x + di, b.y + dj);
    if (S.pipe[t] === own && out.indexOf(comp[t]) < 0) out.push(comp[t]);
  }
  return out;
}

/** Can pipe carry Crude to or from b? Oil Pumps, buildings that use Crude, and storage. */
function pipeEnd(b) { const d = BDEFS[b.type]; return !!(d.pump || (d.inp && d.inp.crude) || d.store); }

/** How much more Crude pipe can bring building b (a Refinery stocks PIPE_FILL, an Asphalt Plant its usual inputs). */
function pipeRoom(b) { return (BDEFS[b.type].explodes ? PIPE_FILL : INPUT_CAP) - (b.stock.crude || 0) - (b.inc.crude || 0); }

/** Every second: each pipeline moves Crude from its pumps (and storage) to where it's used (see PIPE_COST). */
function updatePipes() {
  const net = pipeNet();
  const nets = new Map();
  for (const b of S.buildings) {
    if (b.piped) b.piped = false;
    if (b.dead || !b.built || !net.n || !pipeEnd(b)) continue;
    const def = BDEFS[b.type], kind = def.pump ? 'pumps' : def.store ? 'stores' : 'users';
    for (const c of buildingPipes(b, net)) {
      let N = nets.get(c);
      if (!N) nets.set(c, (N = { pumps: [], users: [], stores: [] }));
      if (N[kind].indexOf(b) < 0) N[kind].push(b);
    }
  }
  for (const [c, N] of nets) {
    let left = PIPE_RATE, moved = 0;
    const give = (from, to, n) => { bump(from.stock, 'crude', -n); bump(to.stock, 'crude', n); left -= n; moved += n; };
    const stores = N.stores.filter((s) => storeTakes(s, 'crude'));
    for (const p of N.pumps) {
      if (N.users.length || stores.length) p.piped = true; // its Crude goes by pipe: no Tanker needed
      for (const u of N.users) { const n = Math.min(Math.floor(supplyOf(p, 'crude')), Math.floor(pipeRoom(u)), left); if (n > 0) give(p, u, n); }
      for (const s of stores) { const n = Math.min(Math.floor(supplyOf(p, 'crude')), left); if (n > 0) give(p, s, n); }
    }
    for (const u of N.users) for (const s of N.stores) { const n = Math.min(Math.floor(supplyOf(s, 'crude')), Math.floor(pipeRoom(u)), left); if (n > 0) give(s, u, n); }
    if (moved) net.flow[c] = S.time; // (drawn: Crude pulsing along the pipe)
  }
}

/** Plan pipe on tile t (paid from storage as the goods come in, laid when paid): '' if planned, otherwise why not. */
function queuePipe(owner, t) {
  if (S.pipe[t] === owner + 1 || S.pipePlan[t] === owner + 1) return '';
  const why = pipeBlocked(owner, t);
  if (why) return why;
  S.pipePlan[t] = owner + 1;
  queuePlan('p', t, owner);
  return '';
}

/** Take up the pipe on tile t (its Cement and Alloy come back; planned pipe not yet laid is just dropped). */
function takeUpPipe(owner, t) {
  if (S.pipePlan[t] === owner + 1 && !S.pipe[t]) { S.pipePlan[t] = 0; return; }
  if (S.pipe[t] !== owner + 1) return;
  setPipe(t, 0);
  refundRoad(owner, PIPE_COST, t % S.W, (t / S.W) | 0);
}

/** Pipe broken by a raid, a missile or a blast (no refund): it's planned again at once, to be relaid when paid for. */
function breakPipe(t) {
  const o = S.pipe[t] - 1;
  if (o < 0) return;
  setPipe(t, 0);
  addFx('smoke', (t % S.W) + 0.5, ((t / S.W) | 0) + 0.5, { r: 0.4, dark: true });
  addDecal('scorch', (t % S.W) + 0.5, ((t / S.W) | 0) + 0.5, 0.3, 40);
  if (!pipeBlocked(o, t)) { S.pipePlan[t] = o + 1; queuePlan('p', t, o); }
}

/** A fuel blast breaks the pipe close to it (within half its reach). */
function blastPipes(x, y, r) {
  const h = r * 0.5, R0 = Math.ceil(h);
  for (let dj = -R0; dj <= R0; dj++) for (let di = -R0; di <= R0; di++) {
    const i = Math.floor(x) + di, j = Math.floor(y) + dj;
    if (inMap(i, j) && S.pipe[tIdx(i, j)] && dist2(i + 0.5, j + 0.5, x, y) <= h * h) breakPipe(tIdx(i, j));
  }
}

/**
 * The cheapest way to run pipe for `owner` from tile `from` to the first tile `goal(t)` accepts: over
 * ground it can pipe (see pipeBlocked), along its own pipe where that helps, round buildings where it
 * can (pipe can run under them, but each one it passes under joins the line), and with few bends.
 * Returns the tiles from start to goal, or null if there's no way.
 */
function pipeRoute(owner, from, goal, maxLen) {
  const N = S.W * S.H, W = S.W;
  if (pipeBlocked(owner, from)) return null;
  const best = new Float64Array(N * 4).fill(Infinity), prev = new Int32Array(N * 4).fill(-1);
  const heap = [];
  const push = (c, s) => { heap.push([c, s]); let k = heap.length - 1; while (k > 0) { const p = (k - 1) >> 1; if (heap[p][0] <= heap[k][0]) break; [heap[p], heap[k]] = [heap[k], heap[p]]; k = p; } };
  const pop = () => { const top = heap[0], last = heap.pop(); if (heap.length) { heap[0] = last; let k = 0; for (;;) { const l = 2 * k + 1, r = l + 1; let m = k; if (l < heap.length && heap[l][0] < heap[m][0]) m = l; if (r < heap.length && heap[r][0] < heap[m][0]) m = r; if (m === k) break; [heap[m], heap[k]] = [heap[k], heap[m]]; k = m; } } return top; };
  const DIRS = [1, W, -1, -W];
  for (let d = 0; d < 4; d++) { best[from * 4 + d] = 0; push(0, from * 4 + d); }
  let end = -1, steps = 0;
  const cap = maxLen || Infinity;
  while (heap.length) {
    const [c, s] = pop();
    if (c > best[s]) continue;
    const t = s >> 2, d = s & 3;
    if (t !== from && goal(t)) { end = s; break; }
    if (++steps > 200000 || c > cap) break;
    const i = t % W;
    for (let nd = 0; nd < 4; nd++) {
      const u = t + DIRS[nd];
      if (u < 0 || u >= N || (nd === 0 && i === W - 1) || (nd === 2 && i === 0)) continue;
      if (pipeBlocked(owner, u)) continue;
      const step = (S.pipe[u] === owner + 1 ? 0.15 : 1) + (nd !== d && t !== from ? 0.35 : 0) + (S.bAt[u] && !goal(u) ? 5 : 0);
      const ns = u * 4 + nd, nc = c + step;
      if (nc < best[ns]) { best[ns] = nc; prev[ns] = s; push(nc, ns); }
    }
  }
  if (end < 0) return null;
  const out = [];
  for (let s = end; s >= 0; s = prev[s]) { out.push(s >> 2); if ((s >> 2) === from) break; }
  return out.reverse();
}

/** The pipe networks (of `owner`) joined to a Refinery, built or still going up. */
function refineryPipes(owner) {
  const net = pipeNet(), out = new Set();
  for (const b of S.buildings) if (!b.dead && b.owner === owner && BDEFS[b.type].explodes) for (const c of buildingPipes(b, net)) out.add(c);
  return out;
}

/**
 * Pipe for building b (an Oil Pump) to the nearest Refinery: to a tile beside one, or to pipe already
 * joined to one. Returns { tiles (the new pipe to lay), cost, to (the Refinery, if it goes straight to
 * one) } or { why } when there's no way (or no Refinery).
 */
function pipeToRefinery(owner, b) {
  const refs = S.buildings.filter((r) => !r.dead && r.owner === owner && BDEFS[r.type].explodes);
  if (!refs.length) return { why: 'Build a Refinery first: the pipe runs from the pump to it.' };
  const net = pipeNet(), joined = refineryPipes(owner), mine = buildingPipes(b, net);
  if (mine.some((c) => joined.has(c))) return { why: 'This pump is already piped to a Refinery.' };
  const beside = new Set();
  for (const r of refs) for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1], [0, 0]]) if (inMap(r.x + di, r.y + dj)) beside.add(tIdx(r.x + di, r.y + dj));
  const start = tIdx(b.x, b.y);
  const route = pipeRoute(owner, start, (t) => beside.has(t) || (S.pipe[t] === owner + 1 && joined.has(net.comp[t])), 80);
  if (!route) return { why: 'No way to run pipe from here to a Refinery inside your border (water or rock in the way?).' };
  // No pipe under the pump itself unless it stands right beside the line's end.
  const tiles = route.filter((t, k) => !S.pipe[t] && !(k === 0 && route.length > 1) && !(S.bAt[t] && k === route.length - 1 && route.length > 1 && BDEFS[getE(S.bAt[t]).type].explodes));
  // A pump right beside its Refinery: one tile of pipe under the pump joins them.
  if (!tiles.length && !route.some((t) => S.pipe[t])) tiles.push(start);
  const cost = {};
  for (const g in PIPE_COST) cost[g] = Math.round(PIPE_COST[g] * tiles.length * 100) / 100;
  return { tiles, cost };
}

/** Lay (plan) the pipe pipeToRefinery found: what's paid for goes down at once, the rest as goods come in. Returns tiles planned. */
function pipeUp(owner, tiles) {
  let n = 0;
  for (const t of tiles) if (!queuePipe(owner, t)) n++;
  settlePlans();
  return n;
}

/* ------------------------------------------------------------------ freight trains */

/** Is train u on the track (or parked in a station beside it)? */
function onTrack(u) {
  if (u.inside) { const b = getE(u.inside); return !!(b && BDEFS[b.type].station && railPlatforms(b.x, b.y).length); }
  return !!S.rail[tIdx(Math.floor(u.x), Math.floor(u.y))];
}

/** Can train u get to building b along the track? */
function trainAt(u, b) {
  if (!BDEFS[b.type].station) return false;
  const c = railNet().comp, mine = [];
  if (u.inside) { const h = getE(u.inside); if (h) for (const k of railComps(h)) mine.push(k); }
  else { const t = tIdx(Math.floor(u.x), Math.floor(u.y)); if (S.rail[t]) mine.push(c[t]); }
  const theirs = railComps(b);
  return mine.some((k) => theirs.indexOf(k) >= 0);
}

/** The nearest Rail Station train u can reach (or, off the track, the nearest one with track at all). */
function nearestStation(u) {
  let best = null, bd = Infinity;
  for (const b of S.buildings) {
    if (b.dead || b.owner !== u.owner || !b.built || !BDEFS[b.type].station) continue;
    if (onTrack(u) ? !trainAt(u, b) : !railPlatforms(b.x, b.y).length) continue;
    const d = dist2(b.x + 0.5, b.y + 0.5, u.x, u.y);
    if (d < bd) { bd = d; best = b; }
  }
  return best;
}

/** Put a train that isn't on the track (just built) into the nearest Rail Station. */
function deliverTrain(u) {
  const st = nearestStation(u);
  if (!st) {
    const P = S.players[u.owner];
    if (S.time - (P.trainMsg || -999) > 90) { P.trainMsg = S.time; postMsg(u.owner, 'A Freight Train is waiting at the Foundry: build a Rail Station beside some track and it rolls out there.', Math.floor(u.x), Math.floor(u.y), 'warn'); }
    return;
  }
  exitBuilding(u);
  enterBuilding(u, st);
  addFx('ring', st.x + 0.5, st.y + 0.5, { color: PLAYER_COLORS[u.owner] });
  postMsg(u.owner, 'A Freight Train is ready at a Rail Station.', st.x, st.y, 'good');
}

/** Is a train on or coming up to track tile t (a level crossing)? */
function trainNear(t) {
  const x = (t % S.W) + 0.5, y = ((t / S.W) | 0) + 0.5, r2 = RAIL_CROSS_HOLD * RAIL_CROSS_HOLD;
  for (const v of S.bots) if (!v.dead && !v.inside && BOTS[v.type].rail && dist2(v.x, v.y, x, y) <= r2) return true;
  return false;
}

/** Lay track on tile t, paying RAIL_COST from storage: '' if done, otherwise why not. */
/** What a tile of track costs: a rail bridge over water or a chasm costs more. */
function railCost(t) { return S.terrain[t] === T_GROUND ? RAIL_COST : RAIL_BRIDGE_COST; }

function layRail(owner, t) {
  if (S.rail[t]) return '';
  const why = railBlocked(owner, t);
  if (why) return why;
  const cost = railCost(t);
  if (!canAffordRoad(owner, cost)) return `Out of ${missingGoods(owner, cost)}: track costs ${costText(cost)} a tile here.`;
  payRoad(owner, cost); // fractions of a good are kept as credit, like a road's Cement
  setRail(t, true);
  return '';
}

/**
 * Plan track on tile t from Paths: it joins the queue and goes down as soon as it's paid for (and,
 * on a Ramp still being built, once the Ramp is done). '' if planned, otherwise why not.
 */
function queueRail(owner, t) {
  if (S.rail[t] || S.railPlan[t] === owner + 1) return '';
  const why = railBlocked(owner, t), s = S.bAt[t] && getE(S.bAt[t]);
  if (why && !(s && s.type === 'ramp' && !s.built && s.owner === owner)) return why;
  setRailPlan(t, owner + 1);
  queuePlan('t', t, owner);
  return '';
}

/** Take up the track on tile t: its Cement and Alloy go back to storage (planned track not yet down is just dropped). */
function takeUpRail(owner, t) {
  if (!S.rail[t] && S.railPlan[t] === owner + 1) { setRailPlan(t, 0); return; }
  if (!S.rail[t] || !roadOwnedBy(owner, t)) return;
  setRail(t, false);
  refundRoad(owner, railCost(t), t % S.W, (t / S.W) | 0);
}

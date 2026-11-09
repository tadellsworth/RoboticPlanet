'use strict';
/*
 * Botfall — simulation: logistics dispatcher, worker and warbot behaviour, production, combat.
 * simStep(dt) advances the world by one fixed step.
 */

function simStep(dt) {
  if (S.winner >= 0) return;
  S.time += dt;
  S.tick++;
  if (S.tick % 30 === 0) growStalks(30 * dt);
  if (S.tick % 30 === 15) for (let p = 0; p < 2; p++) landerSalvage(p, 30 * dt);
  if (S.tick % 8 === 0) dispatch(0);
  if (S.tick % 8 === 4) dispatch(1);
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
    if (u.type === 'warbot') updateWarbot(u, dt); else updateWorker(u, dt);
  }
  if (S.missiles.length) updateMissiles(dt);
  if (S.tick % 30 === 15) cleanRallies();
  for (const P of S.players) {
    if (!P.ai) continue;
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

function nearestStoreTo(owner, x, y) {
  let best = null, bd = Infinity;
  for (const b of S.buildings) {
    if (b.dead || b.owner !== owner || !storeAccepts(b)) continue;
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
    for (const g in def.cost) out.push([g, def.cost[g] - (b.stock[g] || 0) - (b.inc[g] || 0)]);
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
  } else if (def.roadworks) {
    out.push(['asphalt', 3 - (b.stock.asphalt || 0) - (b.inc.asphalt || 0)]);
  }
  // Garrisons keep Ammo for their warbots (Versus only).
  if (def.ammoStock && b.built && S.mode !== 'colony') {
    out.push(['ammo', def.ammoStock - (b.stock.ammo || 0) - (b.inc.ammo || 0)]);
  }
  return out;
}

function supplyOf(b, g) {
  if (!b.built || b.dead) return 0;
  const def = BDEFS[b.type];
  if (def.store || (def.out && def.out[g])) return (b.stock[g] || 0) - (b.res[g] || 0);
  return 0;
}

function botCount(owner) {
  let n = 0;
  for (const u of S.bots) if (!u.dead && u.owner === owner) n++;
  return n;
}

/** A civilian bot (any type but warbot) with nothing to do and enough charge for a job. */
function isIdleWorker(u) {
  if (u.type === 'warbot' || u.dead || u.carry || (u.task && u.task.type !== 'home')) return false;
  // A worker that is charging finishes first; one that is running low goes to charge before new jobs.
  return (u.bat ?? 100) >= (insideCharger(u) ? 90 : BATTERY.low);
}

/* ------------------------------------------------------------------ batteries */

/** Emergency mode: a flat battery halves speed and work rate. */
function batFactor(u) { return (u.bat ?? 100) < BATTERY.critical ? BATTERY.slow : 1; }

function insideCharger(u) {
  const b = u.inside ? getE(u.inside) : null;
  return !!(b && b.built && BDEFS[b.type].charger && !chargerDry(b));
}

/** A Charging Station with no Fuel left can't charge anyone (the Lander's charger is free). */
function chargerDry(b) {
  const ch = BDEFS[b.type].charger;
  return !!(ch && ch.fuel && b.built && (b.energy || 0) < 0.5 && !(b.stock.fuel > 0));
}

/** How many bots are charging in each charger this tick (they share its slots). */
function countCharging() {
  for (const b of S.buildings) if (BDEFS[b.type].charger) b.charging = 0;
  for (const u of S.bots) {
    if (u.dead || !u.inside || u.type === 'warbot' || (u.bat ?? 100) >= 100) continue;
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
    if (!ch || S.zone[tIdx(b.x, b.y)] !== zone || chargerDry(b)) continue;
    if (roadBound(u) && !botLinked(u, b)) continue;
    const s = dist(b.x + 0.5, b.y + 0.5, u.x, u.y) + Math.max(0, (b.charging || 0) - ch.slots) * 4;
    if (s < bs) { bs = s; best = b; }
  }
  return best;
}

function goCharge(u) {
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
  if (u.bat === undefined) u.bat = 100;
  if (u.inside) {
    const b = getE(u.inside);
    const ch = b && b.built && BDEFS[b.type].charger;
    if (ch) {
      if (u.bat < 100) {
        let gain = Math.min(100 - u.bat, ch.rate * Math.min(1, ch.slots / Math.max(1, b.charging)) * dt);
        if (ch.fuel) {
          // Charging Stations burn a Fuel whenever their energy runs low.
          if ((b.energy || 0) < gain && (b.stock.fuel || 0) > 0) { bump(b.stock, 'fuel', -1); b.energy = (b.energy || 0) + FUEL_ENERGY; }
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
  if (d) u.bat = Math.max(0, u.bat - d * dt);
}

/** Goods the player can see: everything in storage plus finished goods waiting in buildings. */
function playerGoods(p) {
  const tot = {};
  for (const g of GOODS) tot[g] = 0;
  for (const b of S.buildings) {
    if (b.dead || b.owner !== p || !b.built) continue;
    const def = BDEFS[b.type];
    for (const g in b.stock) if (def.store || (def.out && def.out[g])) tot[g] += b.stock[g];
  }
  return tot;
}

function nearestEnemyBot(owner, x, y, range, preferWar) {
  let best = null, bd = range * range, bestWar = null, bwd = range * range;
  for (const u of S.bots) {
    if (u.dead || u.owner === owner || u.inside) continue;
    const d = dist2(u.x, u.y, x, y);
    if (d <= bd) { bd = d; best = u; }
    if (preferWar && u.type === 'warbot' && d <= bwd) { bwd = d; bestWar = u; }
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

/** How bot u plans routes: haulers stick to roads; others pay more for off-road tiles. */
function routeOpts(u) {
  const bt = BOTS[u.type];
  if (bt.roadOnly && !haulerStranded(u)) return { roadOnly: true };
  if ((bt.offroad || bt.roadOnly) && !harvestTrip(u)) return { offMul: 1 / OFFROAD_SLOW };
  return null;
}

function goTo(u, x, y) {
  const goal = y * S.W + x;
  // Don't hammer the pathfinder with a route that just failed.
  if (u.failGoal === goal && S.time < u.failUntil) return false;
  const p = findPath(Math.floor(u.x), Math.floor(u.y), x, y, u.type !== 'warbot' ? u.owner : undefined, routeOpts(u));
  if (!p) { u.failGoal = goal; u.failUntil = S.time + 2; return false; }
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
  for (const u of S.bots) {
    if (u.dead || u.inside || !u.path) continue;
    const t = Math.floor(u.y) * S.W + Math.floor(u.x);
    if (!S.road[t]) continue;
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
  for (const k in S.lights) {
    const t = +k, L = S.lights[k];
    if (!S.road[t] || !isJunction(t)) { removeLight(t); continue; }
    const dem = L.dem || [0, 0], app = L.app || [0, 0];
    if (L.clr > 0) {
      L.clr -= dt;
      if (L.clr <= 0) { L.clr = 0; L.ph = 1 - L.ph; L.tm = 0; }
    } else {
      L.tm = (L.tm || 0) + dt;
      if (dem[1 - L.ph] > 0 && L.tm >= LIGHT_MIN_GREEN && (app[L.ph] === 0 || L.tm >= LIGHT_MAX_GREEN)) L.clr = LIGHT_CLEAR;
    }
    L.dem = [0, 0]; L.app = [0, 0];
  }
}

/** Put a traffic light on the junction at (i, j). Returns '' or the reason it can't. */
function placeLight(owner, i, j) {
  const t = tIdx(i, j);
  if (S.lights[t]) return '';
  if (!S.road[t] || !isJunction(t)) return 'Traffic lights go on road junctions: a road tile with roads on three or four sides.';
  if (S.owner[t] !== owner) return 'You can only put traffic lights inside your border.';
  const have = playerGoods(owner);
  for (const g in LIGHT_COST) if (have[g] < LIGHT_COST[g]) return `A traffic light costs ${LIGHT_COST[g]} ${GOOD[g].name}.`;
  for (const g in LIGHT_COST) takeGood(owner, g, LIGHT_COST[g]);
  S.lights[t] = { owner, ph: 0, tm: 0, clr: 0 };
  return '';
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
      // Two bots on the same spot (say, both just out of the Lander): the older one goes first.
      if (along <= 0.05) { if (v.id > u.id) continue; along = 0; }
      room = Math.min(room, along - QUEUE_GAP);
    }
  }
  return Math.max(0, room);
}

/** Walk along the current path. Returns true once the destination is reached. */
function moveAlong(u, dt) {
  if (!u.path) return true;
  const here = Math.floor(u.y) * S.W + Math.floor(u.x);
  const bt = BOTS[u.type];
  let speed = bt.speed;
  const r = S.road[here];
  if (r) {
    const next = u.path[u.pi];
    const dx = (next % S.W) + 0.5 - u.x, dy = ((next / S.W) | 0) + 0.5 - u.y;
    const wrong = r >= 2 && dx * ROAD_DIRS[r][0] + dy * ROAD_DIRS[r][1] < -0.1;
    speed *= wrong ? ONEWAY_WRONG : PAVE[S.pave[here] || 1].speed / (1 + trafficJam(u, here, next));
    if (isJunction(here) && !S.lights[here]) speed *= JUNCTION_SLOW; // crossing carefully
  } else {
    if (S.ramp[here]) speed *= SLOPE_SPEED; else if (S.res[here]) speed *= 0.75;
    if (!S.bAt[here]) {
      if (bt.roadOnly) speed *= HAULER_STRANDED; // a hauler caught off the road crawls back to it
      else if (bt.offroad && !harvestTrip(u)) speed *= OFFROAD_SLOW;
    }
  }
  let step = speed * batFactor(u) * dt;
  // Road junctions: stop before a red light, or give way to traffic already crossing the other way.
  const nx = u.path[u.pi];
  if (nx !== undefined && nx !== here && S.road[nx] && isJunction(nx)) {
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
    if (stop && toEdge < step) step = toEdge;
  }
  // On roads, wait behind the bot ahead instead of driving through it.
  if (r || S.road[u.path[u.pi]]) {
    const room = queueRoom(u);
    if (room < step) {
      if (room < step * 0.25) {
        u.queueT = (u.queueT || 0) + dt;
        if (u.queueT > QUEUE_PATIENCE) { u.squeezeUntil = S.time + 1.5; u.queueT = 0; } // jammed solid: squeeze past
      }
      step = room;
    } else u.queueT = 0;
  }
  u.moved = step > 0 ? 1 : 0;
  while (step > 0 && u.pi < u.path.length) {
    const t = u.path[u.pi];
    const tx = (t % S.W) + 0.5, ty = ((t / S.W) | 0) + 0.5;
    const dx = tx - u.x, dy = ty - u.y, d = Math.sqrt(dx * dx + dy * dy);
    if (d > 1e-4) u.face = Math.atan2(dy, dx);
    if (d <= step) { u.x = tx; u.y = ty; step -= d; u.pi++; }
    else { u.x += (dx / d) * step; u.y += (dy / d) * step; step = 0; }
  }
  if (u.pi >= u.path.length) { u.path = null; return true; }
  return false;
}

/** Path to (x, y) if not already heading there, then move. true = arrived, null = unreachable. */
function travel(u, x, y, dt) {
  const goal = y * S.W + x;
  if (!u.path || u.goal !== goal) {
    if (!goTo(u, x, y)) return null;
  }
  return moveAlong(u, dt);
}

/** Straight-line step used while chasing in combat. */
function moveDirect(u, x, y, dt) {
  const dx = x - u.x, dy = y - u.y, d = Math.sqrt(dx * dx + dy * dy);
  if (d < 1e-4) return true;
  u.face = Math.atan2(dy, dx);
  const s = Math.min(WARBOT_SPEED * batFactor(u) * dt, d);
  const nx = u.x + (dx / d) * s, ny = u.y + (dy / d) * s;
  const ti = Math.floor(nx), tj = Math.floor(ny), ci = Math.floor(u.x), cj = Math.floor(u.y);
  if (!inMap(ti, tj)) return false;
  const t = tIdx(ti, tj), c = tIdx(ci, cj);
  if (t !== c) {
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
  for (const b of S.buildings) if (b.owner === p && !b.dead) blds.push(b);
  blds.sort((a, c) => prioRank(a) - prioRank(c) || a.born - c.born);

  // Keep a worker or two free to build. If raids or new buildings took them all, pull one off the
  // least useful job — this must run even when nobody is idle.
  let free = 0, workers = 0, haulers = 0;
  for (const u of S.bots) {
    if (u.dead || u.owner !== p) continue;
    if (u.type === 'hauler') haulers++;
    if (u.type !== 'worker') continue;
    workers++;
    if (!(u.task && u.task.type === 'staff')) free++;
  }
  // Only haulers carry goods, on roads. If every hauler is lost, workers carry (slowly) until the
  // Foundry can make more.
  const P = S.players[p];
  P.noHaulers = haulers === 0;
  // Planned roads the border no longer covers are called off (and refunded).
  for (const t of planList(p).slice()) if (S.owner[t] !== p || S.bAt[t]) cancelPlan(t);
  const linked = (a, b) => P.noHaulers || roadLinked(a, b);
  for (const b of blds) b.unlinked = !P.noHaulers && needsRoad(b) && !onHomeNet(b);
  const minFree = siteCount(p) > 0 ? MIN_FREE_WORKERS : 1;
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
  const take = (x, y, role, src) => {
    let best = -1, bd = Infinity;
    for (let k = 0; k < idle.length; k++) {
      const u = idle[k], bt = BOTS[u.type];
      if (role === 'haul') {
        if (!(bt.haul || (P.noHaulers && bt.build))) continue;
        if (bt.roadOnly && src && !botLinked(u, src)) continue;
      } else if (role === 'build' ? !bt.build : role === 'staff' ? !bt.staff : bt.crew !== role) continue;
      const d = dist2(u.x, u.y, x + 0.5, y + 0.5);
      // Only send a bot with enough charge for the trip there and back.
      if ((u.bat ?? 100) < BATTERY.low + 0.5 * Math.sqrt(d)) continue;
      if (d < bd) { bd = d; best = k; }
    }
    if (best < 0) return null;
    return idle.splice(best, 1)[0];
  };
  const canCarry = (u, n) => (u ? Math.max(1, Math.min(n, BOTS[u.type].carry || 1)) : 1);

  // 0) Specialist buildings get a bot of their crew.
  for (const b of blds) {
    const crew = BDEFS[b.type].crew;
    if (!crew || !b.built || b.paused || b.staff || b.staffInc) continue;
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
    if (!b.built && !b.builder && deliveredCount(b) / sumValues(BDEFS[b.type].cost) > b.progress + 0.01) {
      assignBuild(take(b.x, b.y, 'build'), b);
    }
  }
  // 2) An operator for every finished building that needs one, while keeping minFree workers free.
  const staffQueue = blds.filter((b) => b.built && !b.paused && BDEFS[b.type].staff && !BDEFS[b.type].crew && !b.staff && !b.staffInc && !atLimit(b))
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
    for (const [g, n] of needsOf(b)) if (n > 0) reqs.push({ b, g, n, pri, inc: sumValues(b.inc) });
  }
  reqs.sort((a, c) => a.pri - c.pri || a.inc - c.inc || a.b.born - c.b.born);
  for (let pass = 0; pass < 4 && idle.length; pass++) {
    let any = false;
    for (const r of reqs) {
      if (!idle.length) break;
      if (r.n <= 0) continue;
      let src = null, bd = Infinity;
      if (!reachable(r.b)) { r.n = 0; continue; }
      for (const s of blds) {
        if (s === r.b || supplyOf(s, r.g) <= 0 || !reachable(s) || !linked(s, r.b)) continue;
        const d = dist2(s.x, s.y, r.b.x, r.b.y);
        if (d < bd) { bd = d; src = s; }
      }
      if (!src) { r.n = 0; continue; }
      const u = take(src.x, src.y, 'haul', src);
      if (!u) { r.n = 0; continue; }
      const n = canCarry(u, Math.min(r.n, supplyOf(src, r.g)));
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
        const u = store && take(b.x, b.y, 'haul', b);
        if (u) assignHaul(u, b, store, g, canCarry(u, avail));
      }
    }
  }
  // 5) Empty out storage that no longer takes a good (set to "empty out" or the good switched off).
  for (const b of blds) {
    if (!storeAccepts(b) || (b.smode !== 'empty' && !b.reject)) continue;
    for (const g of GOODS) {
      if (!idle.length) return;
      if (storeTakes(b, g) || supplyOf(b, g) <= 0) continue;
      const store = storeFor(p, g, b.x + 0.5, b.y + 0.5, b, P.noHaulers ? null : b);
      const u = store && take(b.x, b.y, 'haul', b);
      if (u) assignHaul(u, b, store, g, canCarry(u, supplyOf(b, g)));
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

/* ------------------------------------------------------------------ salvage */

/**
 * A colony that has run out of Stone or Fiber with no Quarry or Harvester that can still work
 * (so it couldn't build one) slowly salvages it from its Lander, enough to get going again.
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
      (b.built ? reachableRes(b.x, b.y, BDEFS[type].radius, res) > 0 : sumValues(b.stock) >= sumValues(BDEFS[type].cost)));
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
      postMsg(p, `Out of ${GOOD[g].name}: your Lander's crew is salvaging a little from the landing craft. Build ${aOrAn(BDEFS[type].name)} by ${type === 'quarry' ? 'boulders' : 'stalk groves'}, or expand with an Outpost to reach some.`, L.x, L.y, 'warn');
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
    if (S.zone[t] !== zone || skip[t] > S.time) continue;
    const i = t % W, j = (t / W) | 0;
    const d = Math.abs(i + 0.5 - ux) + Math.abs(j + 0.5 - uy);
    if (maxD >= 0 && d > maxD) continue;
    let joins = false;
    for (const v of [i > 0 ? t - 1 : -1, i < W - 1 ? t + 1 : -1, t - W, t + W]) {
      if (v >= 0 && v < W * S.H && (S.road[v] || S.bAt[v]) && canStep(t, v)) { joins = true; break; }
    }
    const s = d + (joins ? 0 : 8);
    if (s < bs) { bs = s; best = t; }
  }
  return best;
}

function assignPave(u, t) {
  cancelTask(u);
  u.task = { type: 'pave', tile: t, phase: 'go', prog: 0 };
  S.paveRes[t] = u.id;
  if (!goTo(u, t % S.W, (t / S.W) | 0)) {
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
  if ((u.bat ?? 100) < BATTERY.critical) { cancelTask(u); return; }
  t.prog += dt * S.players[u.owner].mult * batFactor(u);
  u.busy = 1;
  if (t.prog < (S.res[tile] ? PAVE_CLEAR_TIME : PAVE_TIME)) return;
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
}

/** Call off a planned road tile and refund its Cement. */
function cancelPlan(t) {
  const owner = S.plan[t] - 1;
  if (owner < 0) return;
  const mul = S.res[t] ? ROAD_CLEAR : 1;
  setPlan(t, -1);
  refundRoad(owner, roadCost(), t % S.W, (t / S.W) | 0, mul);
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
  n = n || 1;
  u.task = { type: 'haul', src: src.id, dst: dst.id, good: g, phase: 'toSrc', n };
  bump(src.res, g, n);
  bump(dst.inc, g, n);
  if (!goTo(u, src.x, src.y)) { cancelTask(u); src.unreachUntil = S.time + 5; }
}

/** The road networks bot u is on (or in the building it is inside); none if it is off the road. */
function botNets(u) {
  if (u.inside) { const b = getE(u.inside); return b ? buildingNets(b) : []; }
  const t = tIdx(Math.floor(u.x), Math.floor(u.y));
  if (S.road[t]) return [roadNet().comp[t]];
  if (S.bAt[t]) { const b = getE(S.bAt[t]); return b ? buildingNets(b) : []; }
  return [];
}

/** Can bot u reach building b along roads? */
function botLinked(u, b) {
  const a = botNets(u), n = buildingNets(b);
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
  const t = u.task;
  if (!t) {
    if (u.carry) stashCarry(u);
    else if ((u.bat ?? 100) < BATTERY.low && !insideCharger(u)) { if (!goCharge(u) && !u.inside) goHome(u); }
    else if (!insideCharger(u)) {
      // Waiting for work: top up the battery if it's below 70%, otherwise rest in storage.
      u.idleT += dt;
      if (u.idleT > 1.5) {
        u.idleT = 0;
        if (!((u.bat ?? 100) < 70 && goCharge(u)) && !u.inside) goHome(u);
      }
    }
  } else if (t.type === 'home') {
    const h = getE(t.bld);
    if (!h || h.owner !== u.owner) { u.task = null; u.path = null; }
    else if (moveAlong(u, dt)) { u.task = null; enterBuilding(u, h); }
  } else if (t.type === 'charge') {
    const c = getE(t.bld);
    if (!c || c.owner !== u.owner) { u.task = null; u.path = null; }
    else if (u.inside === c.id) {
      if (u.bat >= 99.5 || chargerDry(c)) { u.task = null; if (!BDEFS[c.type].store) exitBuilding(u); }
    } else if (moveAlong(u, dt)) enterBuilding(u, c);
  } else if (t.type === 'haul') doHaul(u, t, dt);
  else if (t.type === 'build') doBuild(u, t, dt);
  else if (t.type === 'pave') doPave(u, t, dt);
  else if (t.type === 'staff') doStaff(u, t, dt);
  workerBattery(u, dt);
}

/**
 * Does building b need a road to the Lander's network? Construction sites always do (haulers
 * bring their materials), and so do Depots and any building that takes goods in or sends them out.
 */
function needsRoad(b) {
  const def = BDEFS[b.type];
  if (b.type === 'lander') return false;
  if (def.store) return true; // a Depot only helps if haulers can reach it from the Lander
  if (!b.built) return true;
  if (def.mil) return S.mode !== 'colony'; // Ammo for the garrison
  return !!(def.inp || def.out || def.ammo || def.charger || def.roadworks || def.bots);
}

/** Haulers on the road can only use storage they can reach by road. */
function roadBound(u) { return BOTS[u.type].roadOnly && !haulerStranded(u); }

function nearestReachableStore(u) {
  let best = null, bd = Infinity;
  for (const b of S.buildings) {
    if (b.dead || b.owner !== u.owner || !storeAccepts(b)) continue;
    if (roadBound(u) && !botLinked(u, b)) continue;
    const d = dist2(b.x + 0.5, b.y + 0.5, u.x, u.y);
    if (d < bd) { bd = d; best = b; }
  }
  return best;
}

function goHome(u) {
  const store = nearestReachableStore(u);
  u.idleT = 0;
  if (store && goTo(u, store.x, store.y)) u.task = { type: 'home', bld: store.id };
}

function stashCarry(u) {
  let store = storeFor(u.owner, u.carry, u.x, u.y) || nearestStoreTo(u.owner, u.x, u.y);
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
  if (BDEFS[dst.type].store) enterBuilding(u, dst);
}

function deliveredCount(site) {
  const cost = BDEFS[site.type].cost;
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
  if ((u.bat ?? 100) < BATTERY.critical) { cancelTask(u); return; } // go recharge; another builder takes over
  const def = BDEFS[s.type];
  const cap = deliveredCount(s) / sumValues(def.cost);
  if (s.progress < cap) {
    s.progress = Math.min(cap, s.progress + (dt * S.players[u.owner].mult * batFactor(u)) / def.buildTime);
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
  if (def.ramp) { completeRamp(b); return; }
  b.built = true;
  b.progress = 1;
  b.stock = {};
  b.inc = {};
  b.res = {};
  b.builder = 0;
  b.armor = def.armor;
  b.born = S.time;
  S.players[b.owner].stats.built++;
  markDirty(b.x, b.y);
  postMsg(b.owner, `${def.name} is complete.`, b.x, b.y, 'good');
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
  S.roadVer = (S.roadVer || 0) + 1;
  markDirty(b.x, b.y);
  for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) if (inMap(b.x + di, b.y + dj)) markDirty(b.x + di, b.y + dj);
  computeZones();
  S.players[b.owner].stats.built++;
  postMsg(b.owner, 'Ramp is complete. Bots can now climb the cliff here.', b.x, b.y, 'good');
  if (b.owner === 0) sfx('complete');
  addFx('ring', b.x + 0.5, b.y + 0.5, { color: PLAYER_COLORS[b.owner] });
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

/** The nearest road tile (to x, y) within a Roadworks' reach that isn't asphalt yet. */
function findPaveSpot(b, x, y) {
  const radius = BDEFS[b.type].radius, r2 = radius * radius + 0.3;
  const zone = S.zone[tIdx(b.x, b.y)];
  let best = -1, bd = Infinity;
  for (let j = Math.max(0, b.y - radius); j <= Math.min(S.H - 1, b.y + radius); j++) {
    for (let i = Math.max(0, b.x - radius); i <= Math.min(S.W - 1, b.x + radius); i++) {
      const t = j * S.W + i;
      if (!S.road[t] || S.pave[t] >= 2 || S.resRes[t] || S.owner[t] !== b.owner || S.zone[t] !== zone) continue;
      if (dist2(i, j, b.x, b.y) > r2) continue;
      const d = dist2(i, j, x, y);
      if (d < bd) { bd = d; best = t; }
    }
  }
  return best;
}

/** Count goods a player produced (for statistics and mission goals). */
function madeGood(owner, g, n) {
  const P = S.players[owner];
  P.made = P.made || {};
  P.made[g] = (P.made[g] || 0) + n;
}

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
        const g = RES[def.gather].good;
        if ((b.stock[g] || 0) >= def.out[g]) { b.status = 'Storage full, waiting for pickup'; t.wait = 1; return; }
        node = findNode(b, def.gather, def.radius);
        if (node < 0) { b.status = `No ${RES[def.gather].name.toLowerCase()}s left in reach`; t.wait = 3; return; }
        b.status = 'Gathering ' + GOOD[g].name;
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
        if (node < 0) { b.status = 'Every path in reach is asphalt'; t.wait = 3; return; }
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
        t.timer = def.gather ? RES[def.gather].harvest : def.farm ? (t.act === 'harvest' ? RES[R_CROP].harvest : 2) : def.roadworks ? 2.5 : 3;
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
      if (def.gather) {
        if (S.res[node] === def.gather && S.amt[node] > 0) {
          S.amt[node]--;
          if (S.amt[node] === 0) S.res[node] = R_NONE;
          markDirty(ni, nj);
          u.carry = RES[def.gather].good;
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
        if (S.road[node] && S.pave[node] < 2) {
          setPave(ni, nj, 2);
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
  if (!b.built) {
    if (b.unlinked && sumValues(b.stock) < sumValues(def.cost)) b.status = 'No road to storage yet';
    else if (sumValues(b.stock) + sumValues(b.inc) === 0) b.status = 'Waiting for materials';
    else if (!b.builder) b.status = 'Waiting for a builder';
    else b.status = 'Under construction';
    return;
  }
  if (b.armor < def.armor && S.time - b.lastHit > 8) b.armor = Math.min(def.armor, b.armor + dt * 0.8);
  if (b.paused) { b.status = 'Paused — its worker is free for other jobs'; return; }
  if (def.mil) b.status = `Garrison: ${b.garrison.length} of ${def.garrison} warbots`;
  else if (def.store) b.status = 'Storing goods';
  if (def.inp) produce(b, def, dt * S.players[b.owner].mult);
  else if (def.missile) updateSilo(b, def);
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
  if (def.mil) garrisonDefense(b, dt);
  if (def.staff && !def.inp) {
    const op = getE(b.staff);
    const who = def.crew ? BOTS[def.crew].name : 'Worker';
    if (!op) {
      b.status = b.staffInc ? `${who} on the way` : `Needs ${aOrAn(def.crew ? who : 'worker')}`;
      if (!b.staffInc && def.crew && !S.bots.some((v) => !v.dead && v.owner === b.owner && v.type === def.crew)) b.status += ': order one at the Bot Foundry';
    }
  }
}

/** Buildings whose busy time is tracked for statistics. */
function tracksUse(def) { return !!(def.staff || (def.charger && !def.store) || (def.ammo && !def.missile)); }

function produce(b, def, dt) {
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
  if (def.pump && pumpSeep(b) < 0) { b.status = 'The oil seep has run dry'; return; }
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
  b.status = 'Working';
  b.working = true;
  b.timer += dt;
  if (b.timer < def.work) return;
  b.timer = 0;
  for (const g in def.inp) bump(b.stock, g, -def.inp[g]);
  if (def.pump) {
    const seep = pumpSeep(b);
    if (--S.amt[seep] <= 0) { S.amt[seep] = 0; S.res[seep] = R_NONE; markDirty(seep % S.W, (seep / S.W) | 0); }
  }
  if (def.make) {
    for (const g in def.make) { bump(b.stock, g, def.make[g]); madeGood(b.owner, g, def.make[g]); }
    const g0 = Object.keys(def.make)[0];
    addFx('float', b.x + 0.5, b.y + 0.1, { text: '+' + def.make[g0], color: GOOD[g0].color });
  }
  if (def.bots) spawnFromFoundry(b);
  if (b.owner === 0) sfx('produce');
}

function hasOrders(b) {
  if (!b.orders) return false;
  for (const k in b.orders) if (b.orders[k] > 0) return true;
  return false;
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

/**
 * A Pulse Turret keeps tracking its target, turns its head toward it at TURRET_TURN radians per
 * second and fires only once it is lined up. With nothing in range it sweeps slowly back and forth.
 */
function updateTurret(b, def, dt) {
  b.cd -= dt;
  b.scanT = (b.scanT || 0) - dt;
  const cx = b.x + 0.5, cy = b.y + 0.5, r2 = def.range * def.range;
  let target = b.tgt ? getE(b.tgt) : null;
  if (target && (target.dead || target.inside || dist2(target.x, target.y, cx, cy) > r2)) target = null;
  if (!target && b.scanT <= 0) { b.scanT = 0.3; target = nearestEnemyBot(b.owner, cx, cy, def.range, true); }
  b.tgt = target ? target.id : 0;
  const ammo = b.shots + (b.stock.crystal || 0) * SHOTS_PER_AMMO;
  if (!target) {
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
  if (Math.abs(diff) > 0.15) { b.status = 'Turning to aim'; return; }
  if (b.cd > 0) return;
  if (b.shots <= 0) {
    if ((b.stock.crystal || 0) > 0) { bump(b.stock, 'crystal', -1); b.shots = SHOTS_PER_AMMO; }
    else { b.status = 'Out of ammo!'; b.cd = 0.5; return; }
  }
  b.shots--;
  b.status = 'Firing';
  addFx('laser', cx, cy, { x2: target.x, y2: target.y, color: PLAYER_COLORS[b.owner] });
  sfx('laser');
  damageBot(target, 4);
  b.cd = 1.1;
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
      if (u.type === 'warbot' && dist2(u.x, u.y, cx, cy) < 42) threats++;
    } else if (u.task && u.task.type === 'defend' && u.task.home === b.id) out++;
  }
  let want = Math.min(b.garrison.length, threats + 1 - out);
  while (want-- > 0) {
    const u = getE(b.garrison.pop());
    if (!u) continue;
    u.inside = 0;
    u.task = { type: 'defend', home: b.id };
    u.path = null;
  }
}

/* ------------------------------------------------------------------ warbots & combat */

/** Send a warbot to the military building that most needs it, favouring the front line. */
function goGarrison(u) {
  const enemyL = getE(S.players[1 - u.owner].lander);
  let best = null, bs = Infinity;
  for (const b of S.buildings) {
    if (b.dead || b.owner !== u.owner || !b.built || !BDEFS[b.type].mil) continue;
    if (u.avoidB === b.id && S.time < u.avoidUntil) continue;
    const cap = BDEFS[b.type].garrison;
    const n = b.garrison.length + b.garInc;
    if (n >= cap) continue;
    const front = enemyL ? dist(b.x, b.y, enemyL.x, enemyL.y) : 0;
    const s = (n / Math.min(cap, 10)) * 12 + front * 0.25 + dist(b.x, b.y, u.x, u.y) * 0.05;
    if (s < bs) { bs = s; best = b; }
  }
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
  if (S.time - b.lastAlert > 12) {
    b.lastAlert = S.time;
    postMsg(b.owner, `Enemy warbots are attacking your ${BDEFS[b.type].name}!`, b.x, b.y, 'bad');
    if (b.owner === 0) sfx('alert');
  }
  if (b.armor <= 0) captureBuilding(b, by);
}

function captureBuilding(b, by) {
  const def = BDEFS[b.type], old = b.owner;
  const name = def.name;
  if (!b.built) {
    (S.players[old].avoid = S.players[old].avoid || []).push({ x: b.x, y: b.y, until: S.time + 150 });
    postMsg(by, `Your warbots wrecked an enemy construction site.`, b.x, b.y, 'good');
    postMsg(old, `Enemy warbots wrecked your ${name} construction site.`, b.x, b.y, 'bad');
    destroyBuilding(b, true);
    return;
  }
  releaseBotsFrom(b, true);
  delete b.prio; delete b.smode; delete b.reject; b.paused = false;
  b.owner = by;
  b.armor = Math.max(4, def.armor * 0.4);
  b.lastHit = S.time;
  b.timer = 0;
  b.mode = S.players[by].ai ? 'alt' : 'off';
  S.players[by].stats.captured++;
  addFx('ring', b.x + 0.5, b.y + 0.5, { color: PLAYER_COLORS[by], r: 2 });
  sfx('capture');
  if (b.type === 'lander') {
    postMsg(by, 'Your warbots captured the enemy Lander!', b.x, b.y, 'good');
    postMsg(old, 'The enemy captured your Lander!', b.x, b.y, 'bad');
    S.winner = by;
    return;
  }
  if (def.mil) {
    S.players[by].stats.outposts = (S.players[by].stats.outposts || 0) + 1;
    postMsg(by, `Your warbots captured the enemy ${name}!`, b.x, b.y, 'good');
    postMsg(old, `The enemy captured your ${name}!`, b.x, b.y, 'bad');
    computeTerritory();
  } else {
    postMsg(by, `Your warbots wrecked the enemy ${name}.`, b.x, b.y, 'good');
    postMsg(old, `Enemy warbots wrecked your ${name}!`, b.x, b.y, 'bad');
    destroyBuilding(b, true);
  }
}

function updateWarbot(u, dt) {
  if (u.bat === undefined) u.bat = 100;
  if (u.inside) {
    if (u.bat < 100) u.bat = Math.min(100, u.bat + BATTERY.garrisonCharge * dt); // garrisons recharge their warbots
    if ((u.ammo ?? WARBOT_AMMO) <= WARBOT_AMMO - AMMO_SHOTS) reloadAmmo(u, getE(u.inside));
    return;
  }
  u.moved = 0;
  u.fought = 0;
  warbotAct(u, dt);
  const d = (u.moved ? BATTERY.warbotMove : 0) + (u.fought ? BATTERY.warbotFight : 0);
  if (d) u.bat = Math.max(0, u.bat - d * dt);
}

function warbotAct(u, dt) {
  u.cd -= dt;
  const t = u.task;
  const defending = t && t.type === 'defend';
  const rally = t && t.type === 'hold' ? rallyById(t.rally) : null;
  const power = (u.bat ?? 100) < BATTERY.critical ? 0.5 : 1; // emergency mode hits half as hard
  let foe = u.fight ? getE(u.fight) : null;
  const leash = defending ? 9 : rally ? 6 : 4;
  if (foe && (foe.dead || foe.inside || dist2(foe.x, foe.y, u.x, u.y) > leash * leash ||
      (rally && dist2(foe.x, foe.y, rally.x, rally.y) > 49))) foe = null;
  if (!foe) {
    u.fight = 0;
    u.scanT -= dt;
    if (u.scanT <= 0) {
      u.scanT = 0.3;
      foe = nearestEnemyBot(u.owner, u.x, u.y, rally ? 3.5 : 2.8, true);
      if (!foe && defending) {
        const h = getE(t.home);
        if (h) foe = nearestEnemyBot(u.owner, h.x + 0.5, h.y + 0.5, 6.5, true);
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
      if (d <= WARBOT_RANGE_BLOCKED) inReach = true;
      else {
        pathing = true;
        if (travel(u, Math.floor(foe.x), Math.floor(foe.y), dt) === null) { u.fight = 0; u.ignoreFoe = foe.id; u.ignoreUntil = S.time + 5; }
      }
    }
    if (inReach && u.cd <= 0) {
      u.cd = 0.9;
      u.face = Math.atan2(foe.y - u.y, foe.x - u.x);
      addFx('spark', (u.x + foe.x) / 2, (u.y + foe.y) / 2, { color: PLAYER_COLORS[u.owner] });
      if (u.owner === 0 || foe.owner === 0) sfx('hit');
      const armed = useAmmo(u);
      damageBot(foe, Math.max(1, Math.round((2 + (hash2(u.id, S.tick, 7) < 0.5 ? 1 : 0)) * power * (armed ? 1 : NO_AMMO_POWER))));
      u.fought = 1;
    }
    if (!pathing) u.path = null;
    return;
  }
  if (!t) { goGarrison(u); return; }
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
      // Target taken. Hold a captured military building, otherwise press on to the next
      // enemy building close by before heading home.
      u.task = null;
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

/** Walk up to an enemy building and hit it. Returns null if it can't be reached. */
function strikeBuilding(u, b, dt, power) {
  if (dist2(u.x, u.y, b.x + 0.5, b.y + 0.5) <= 1.7) {
    u.path = null;
    u.face = Math.atan2(b.y + 0.5 - u.y, b.x + 0.5 - u.x);
    if (u.cd <= 0) {
      u.cd = 1.0;
      u.fought = 1;
      addFx('spark', b.x + 0.5 + (hash2(u.id, S.tick, 3) - 0.5) * 0.6, b.y + 0.5 + (hash2(u.id, S.tick, 5) - 0.5) * 0.6, { color: PLAYER_COLORS[u.owner] });
      hitBuilding(b, power * (useAmmo(u) ? 1 : NO_AMMO_POWER), u.owner);
    }
    return true;
  }
  return travel(u, b.x, b.y, dt);
}

/** Fire one shot: true if the warbot had ammo, false if it's down to scuffling. */
function useAmmo(u) {
  if ((u.ammo ?? WARBOT_AMMO) > 0) { u.ammo = (u.ammo ?? WARBOT_AMMO) - 1; return true; }
  const P = S.players[u.owner];
  if (S.time - (P.lastAmmoMsg || -999) > 90) {
    P.lastAmmoMsg = S.time;
    postMsg(u.owner, 'Your warbots are out of Ammo and can barely fight. Build an Ammo Plant: haulers stock your Lander and Outposts, where warbots reload.', Math.floor(u.x), Math.floor(u.y), 'warn');
  }
  return false;
}

/** Reload a warbot from a garrison's Ammo (one Ammo = AMMO_SHOTS shots). */
function reloadAmmo(u, b) {
  if (!b || b.owner !== u.owner || !BDEFS[b.type].mil || !((b.stock.ammo || 0) - (b.res.ammo || 0) > 0)) return false;
  bump(b.stock, 'ammo', -1);
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
  }
  if (t.phase === 'recharge') {
    const home = rechargePoint(u, t.forAmmo) || rechargePoint(u);
    if (!home) { t.phase = null; return; }
    if (dist2(u.x, u.y, home.x + 0.5, home.y + 0.5) <= 2.2) {
      u.path = null;
      u.bat = Math.min(100, (u.bat ?? 0) + 8 * dt);
      if ((u.ammo ?? WARBOT_AMMO) <= WARBOT_AMMO - AMMO_SHOTS) reloadAmmo(u, home);
      if (u.bat >= 95 && (u.ammo > 0 || !reloadAmmo(u, home))) { t.phase = null; t.forAmmo = false; }
    } else if (travel(u, home.x, home.y, dt) === null) t.phase = null;
    return;
  }
  let tgt = t.target ? getE(t.target) : null;
  if (!tgt || tgt.owner === u.owner || dist2(tgt.x + 0.5, tgt.y + 0.5, r.x, r.y) > 10) {
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
  if (Math.floor(u.x) === gx && Math.floor(u.y) === gy && !u.path) return;
  if (travel(u, gx, gy, dt) === null) t.slot = 0;
}

/** Garrisons that can send warbots to tile (i, j): same walkable area, each keeps one at home. */
function rallySources(owner, i, j) {
  const zone = S.zone[tIdx(i, j)];
  const out = [];
  for (const b of S.buildings) {
    if (b.dead || b.owner !== owner || !b.built || !BDEFS[b.type].mil || b.garrison.length < 2) continue;
    if (S.zone[tIdx(b.x, b.y)] !== zone) continue;
    out.push({ b, d: dist(b.x, b.y, i, j) });
  }
  out.sort((a, c) => a.d - c.d);
  return out.map((o) => o.b);
}

function rallyAvailable(owner, i, j) {
  let n = 0;
  for (const b of rallySources(owner, i, j)) n += b.garrison.length - 1;
  return n;
}

/** Send warbots to hold the area around tile (i, j) until they are called back. */
function sendToRally(owner, i, j, count) {
  let r = S.rallies.find((q) => q.owner === owner && Math.abs(q.x - (i + 0.5)) < 1.5 && Math.abs(q.y - (j + 0.5)) < 1.5);
  if (!r) { r = { id: S.nextId++, owner, x: i + 0.5, y: j + 0.5 }; S.rallies.push(r); }
  let slot = rallyMembers(r.id).length, sent = 0;
  for (const b of rallySources(owner, i, j)) {
    while (b.garrison.length > 1 && sent < count) {
      const u = getE(b.garrison.pop());
      if (!u) continue;
      u.inside = 0;
      u.task = { type: 'hold', rally: r.id, slot: slot++ };
      u.path = null;
      sent++;
    }
  }
  if (!sent) cleanRallies();
  return { sent, rally: r };
}

/** Call a rally point's warbots back to their garrisons. */
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

function siloReady(b) { return b.built && !b.dead && (b.stock.warhead || 0) > 0 && !(b.reload > 0); }

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
  const md = BDEFS[silo.type].missile;
  bump(silo.stock, 'warhead', -1);
  silo.reload = md.reload;
  const d = dist(silo.x, silo.y, target.x, target.y);
  S.missiles.push({
    owner, from: silo.id, target: target.id, t: 0, dur: Math.max(1.6, d / 8),
    x0: silo.x + 0.5, y0: silo.y + 0.5, x1: target.x + 0.5, y1: target.y + 0.5,
  });
  addFx('ring', silo.x + 0.5, silo.y + 0.5, { color: '#ffcf4a', r: 1.2 });
  sfx('launch');
  postMsg(target.owner, `Incoming missile! It is heading for your ${BDEFS[target.type].name}.`, target.x, target.y, 'bad');
  return true;
}

function updateMissiles(dt) {
  for (const m of S.missiles) {
    m.t += dt;
    if (S.tick % 3 === 0) {
      const k = Math.min(1, m.t / m.dur);
      addFx('smoke', lerp(m.x0, m.x1, k), lerp(m.y0, m.y1, k) - Math.sin(k * Math.PI) * 2.5, { r: 0.3, life: 0.9 });
    }
    if (m.t >= m.dur) missileImpact(m);
  }
  S.missiles = S.missiles.filter((m) => m.t < m.dur);
}

/**
 * A missile hits its target hard (most buildings are wrecked outright; Outposts and Landers drop to
 * no less than 1 armor so warbots can take them), and the blast damages nearby rival buildings
 * and bots.
 */
function missileImpact(m) {
  const md = BDEFS.silo.missile;
  addFx('boom', m.x1, m.y1, { r: 2.2 });
  addFx('smoke', m.x1, m.y1, { r: 1.2 });
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
      if (b.armor <= 0) b.armor = 1;
      postMsg(m.owner, `Missile hit the enemy ${name}${b.armor <= 1 ? ': its armor is down, send warbots to capture it!' : '.'}`, b.x, b.y, 'good');
      postMsg(b.owner, `A missile hit your ${name}!`, b.x, b.y, 'bad');
    }
  }
  for (const e of S.buildings.slice()) {
    if (e === b || e.dead || e.owner === m.owner || dist2(e.x + 0.5, e.y + 0.5, m.x1, m.y1) > md.splash * md.splash) continue;
    e.armor -= md.splashDamage;
    e.lastHit = S.time;
    if (e.armor <= 0) {
      if (!e.built || !BDEFS[e.type].mil) {
        postMsg(e.owner, `The blast wrecked your ${BDEFS[e.type].name}!`, e.x, e.y, 'bad');
        destroyBuilding(e, true);
      } else e.armor = 1;
    }
  }
  for (const u of S.bots) {
    if (!u.dead && !u.inside && u.owner !== m.owner && dist2(u.x, u.y, m.x1, m.y1) <= md.splash * md.splash) damageBot(u, md.botDamage);
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
    if (d <= ATTACK_RANGE && b.garrison.length > 1) out.push({ b, d });
  }
  out.sort((a, c) => a.d - c.d);
  return out.map((o) => o.b);
}

/** Warbots that could join an attack on `target` (each garrison keeps one at home). */
function attackAvailable(owner, target) {
  let n = 0;
  for (const b of attackSources(owner, target)) n += b.garrison.length - 1;
  return n;
}

function sendAttack(owner, target, count) {
  let sent = 0;
  for (const b of attackSources(owner, target)) {
    while (b.garrison.length > 1 && sent < count) {
      const u = getE(b.garrison.pop());
      if (!u) continue;
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

/** Can `owner` afford one more road tile (`mul` of them, for a tile through resources)? */
function canAffordRoad(owner, mul) {
  const have = playerGoods(owner), cost = roadCost();
  for (const g in cost) if (roadCredit(owner, g) + have[g] < cost[g] * (mul || 1) - 1e-9) return false;
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
    n--;
  }
  return true;
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
function buildRoad(owner, i, j) {
  const t = tIdx(i, j);
  if (S.road[t] || S.plan[t]) return '';
  if (!canRoad(owner, i, j)) return S.res[t] === R_OIL ? 'Roads can\'t go over an oil seep.' : 'You can only lay roads on open ground inside your border.';
  const mul = roadTileMul(t);
  if (!canAffordRoad(owner, mul)) return `Out of ${Object.keys(roadCost()).map((g) => GOOD[g].name).join(' and ')} for roads. Make more at a Cement Works.`;
  payRoad(owner, roadCost(), mul);
  setPlan(t, owner); // free workers come and pave it
  return '';
}

/** Remove a road tile, or call off a planned one, and refund its Cement (Asphalt on top isn't returned). */
function removeRoad(owner, i, j) {
  if (S.plan[tIdx(i, j)] === owner + 1) { cancelPlan(tIdx(i, j)); return; }
  if (!S.road[tIdx(i, j)]) return;
  setRoad(i, j, false);
  refundRoad(owner, roadCost(), i, j);
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

function demolish(b) {
  if (b.dead || b.type === 'lander') return;
  const def = BDEFS[b.type];
  const store = nearestStoreTo(b.owner, b.x + 0.5, b.y + 0.5);
  if (store) {
    const back = b.built ? def.cost : b.stock;
    for (const g in back) {
      const n = b.built ? Math.floor(back[g] / 2) : Math.min(back[g], def.cost[g] || 0);
      if (n > 0) bump(store.stock, g, n);
    }
  }
  destroyBuilding(b, false);
}

/* ------------------------------------------------------------------ statistics */

/*
 * Every HIST_STEP seconds each player's colony is sampled for the statistics screen: bots, buildings,
 * land, goods on hand, and how busy each kind of building was during that stretch. Long games are
 * thinned out (every other sample dropped) so the history stays small in the save.
 */
const HIST_MAX = 240;

function newHistory() { return { t: [], p: [{}, {}] }; }

function recordHistory() {
  const H = S.hist || (S.hist = newHistory());
  H.t.push(Math.round(S.time));
  for (const P of S.players) {
    if (P.absent) continue;
    const h = H.p[P.id];
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

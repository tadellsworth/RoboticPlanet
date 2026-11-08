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
  if (S.tick % 8 === 0) dispatch(0);
  if (S.tick % 8 === 4) dispatch(1);
  for (let k = 0; k < S.buildings.length; k++) {
    const b = S.buildings[k];
    if (!b.dead) updateBuilding(b, dt);
  }
  for (let k = 0; k < S.bots.length; k++) {
    const u = S.bots[k];
    if (u.dead) continue;
    if (u.type === 'worker') updateWorker(u, dt); else updateWarbot(u, dt);
  }
  for (const P of S.players) {
    if (!P.ai) continue;
    P.aiT -= dt;
    if (P.aiT <= 0) { P.aiT = DIFFICULTY[S.difficulty].think; aiThink(P.id); }
  }
  if (S.tick % 15 === 0) {
    S.buildings = S.buildings.filter((b) => !b.dead);
    S.bots = S.bots.filter((u) => !u.dead);
  }
  if (S.mode === 'colony' && S.tick % 90 === 0) checkMilestones();
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

function growStalks(dt) {
  const N = S.W * S.H;
  for (let t = 0; t < N; t++) {
    if (S.res[t] !== R_STALK || S.grow[t] >= 1) continue;
    const before = Math.floor(S.grow[t] * 4);
    S.grow[t] = Math.min(1, S.grow[t] + dt / STALK_GROW_TIME);
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
 * that takes the good. `except` is skipped (used when emptying a store out).
 */
function storeFor(owner, g, x, y, except) {
  let best = null, bd = Infinity;
  for (const b of S.buildings) {
    if (b.dead || b.owner !== owner || b === except || !storeTakes(b, g)) continue;
    const d = dist2(b.x + 0.5, b.y + 0.5, x, y) - (b.smode === 'fill' ? 1e6 : 0);
    if (d < bd) { bd = d; best = b; }
  }
  return best;
}

function needsOf(b) {
  const def = BDEFS[b.type], out = [];
  if (!b.built) {
    for (const g in def.cost) out.push([g, def.cost[g] - (b.stock[g] || 0) - (b.inc[g] || 0)]);
  } else if (b.paused) {
    return out;
  } else if (def.inp) {
    for (const g in def.inp) out.push([g, INPUT_CAP - (b.stock[g] || 0) - (b.inc[g] || 0)]);
  } else if (def.ammo) {
    out.push([def.ammo, AMMO_CAP - (b.stock[def.ammo] || 0) - (b.inc[def.ammo] || 0)]);
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

function isIdleWorker(u) {
  return u.type === 'worker' && !u.dead && !u.carry && (!u.task || u.task.type === 'home');
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

function goTo(u, x, y) {
  const p = findPath(Math.floor(u.x), Math.floor(u.y), x, y);
  if (!p) return false;
  exitBuilding(u);
  u.path = p; u.pi = 0; u.idleT = 0; u.goal = y * S.W + x;
  return true;
}

/** Walk along the current path. Returns true once the destination is reached. */
function moveAlong(u, dt) {
  if (!u.path) return true;
  const here = Math.floor(u.y) * S.W + Math.floor(u.x);
  let speed = u.type === 'warbot' ? WARBOT_SPEED : WORKER_SPEED;
  if (S.road[here]) speed *= ROAD_SPEED; else if (S.res[here]) speed *= 0.75;
  let step = speed * dt;
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
  if (d < 1e-4) return;
  u.face = Math.atan2(dy, dx);
  const s = Math.min(WARBOT_SPEED * dt, d);
  const nx = u.x + (dx / d) * s, ny = u.y + (dy / d) * s;
  const ti = Math.floor(nx), tj = Math.floor(ny);
  if (!inMap(ti, tj)) return;
  const t = tIdx(ti, tj);
  const sameTile = ti === Math.floor(u.x) && tj === Math.floor(u.y);
  if (S.terrain[t] === T_GROUND && (!S.bAt[t] || sameTile)) { u.x = nx; u.y = ny; }
}

/* ------------------------------------------------------------------ logistics */

function dispatch(p) {
  const idle = [];
  for (const u of S.bots) if (u.owner === p && isIdleWorker(u)) idle.push(u);
  if (!idle.length) return;
  const blds = [];
  for (const b of S.buildings) if (b.owner === p && !b.dead) blds.push(b);

  const take = (x, y) => {
    let best = -1, bd = Infinity;
    for (let k = 0; k < idle.length; k++) {
      const d = dist2(idle[k].x, idle[k].y, x + 0.5, y + 0.5);
      if (d < bd) { bd = d; best = k; }
    }
    if (best < 0) return null;
    return idle.splice(best, 1)[0];
  };

  blds.sort((a, c) => prioRank(a) - prioRank(c) || a.born - c.born);

  // 1) A builder for every construction site that has materials waiting to be built with.
  for (const b of blds) {
    if (!idle.length) return;
    if (!b.built && !b.builder && deliveredCount(b) / sumValues(BDEFS[b.type].cost) > b.progress + 0.01) {
      assignBuild(take(b.x, b.y), b);
    }
  }
  // 2) An operator for every finished building that needs one — but always keep a few
  //    workers free for hauling, otherwise the whole economy can lock up.
  let free = 0, workers = 0;
  for (const u of S.bots) {
    if (u.dead || u.owner !== p || u.type !== 'worker') continue;
    workers++;
    if (!(u.task && u.task.type === 'staff')) free++;
  }
  const minFree = Math.max(MIN_FREE_WORKERS, Math.round(workers * 0.2));
  const staffQueue = blds.filter((b) => b.built && !b.paused && BDEFS[b.type].staff && !b.staff && !b.staffInc)
    .sort((a, c) => prioRank(a) - prioRank(c) || staffPriority(a) - staffPriority(c) || a.born - c.born);
  if (free < minFree) {
    // Raids or new buildings left nobody to haul: take a worker off the least useful job.
    const cands = blds.filter((b) => b.built && b.staff && b.type !== 'foundry');
    cands.sort((a, c) => releaseScore(c) - releaseScore(a));
    if (cands.length) {
      unstaff(cands[0]);
      if (S.time - (S.players[p].lastShortMsg || -99) > 60) {
        S.players[p].lastShortMsg = S.time;
        postMsg(p, `Short on workers — the ${BDEFS[cands[0].type].name} worker was moved to hauling. Make more workers at a Bot Foundry.`, cands[0].x, cands[0].y, 'warn');
      }
    }
  }
  for (const b of staffQueue) {
    if (!idle.length) return;
    if (free <= minFree) {
      if (S.time - (S.players[p].lastShortMsg || -99) > 60) {
        S.players[p].lastShortMsg = S.time;
        postMsg(p, 'Not enough workers to run every building. Build a Bot Foundry to make more.', b.x, b.y, 'warn');
      }
      break;
    }
    assignStaff(take(b.x, b.y), b);
    free--;
  }
  // 3) Deliveries, one unit per request per pass. Player priority comes first; within the same
  //    priority the Foundry goes first (new workers unblock everything), then construction.
  const reqs = [];
  for (const b of blds) {
    const pri = prioRank(b) * 3 + (b.built && BDEFS[b.type].bots ? 0 : b.built ? 2 : 1);
    for (const [g, n] of needsOf(b)) if (n > 0) reqs.push({ b, g, n, pri, inc: sumValues(b.inc) });
  }
  reqs.sort((a, c) => a.pri - c.pri || a.inc - c.inc || a.b.born - c.b.born);
  for (let pass = 0; pass < 4 && idle.length; pass++) {
    let any = false;
    for (const r of reqs) {
      if (!idle.length) break;
      if (r.n <= 0) continue;
      let src = null, bd = Infinity;
      for (const s of blds) {
        if (s === r.b || supplyOf(s, r.g) <= 0) continue;
        const d = dist2(s.x, s.y, r.b.x, r.b.y);
        if (d < bd) { bd = d; src = s; }
      }
      if (!src) { r.n = 0; continue; }
      assignHaul(take(src.x, src.y), src, r.b, r.g);
      r.n--;
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
        const store = storeFor(p, g, b.x + 0.5, b.y + 0.5);
        if (store) assignHaul(take(b.x, b.y), b, store, g);
      }
    }
  }
  // 5) Empty out storage that no longer takes a good (set to "empty out" or the good switched off).
  for (const b of blds) {
    if (!storeAccepts(b) || (b.smode !== 'empty' && !b.reject)) continue;
    for (const g of GOODS) {
      if (!idle.length) return;
      if (storeTakes(b, g) || supplyOf(b, g) <= 0) continue;
      const store = storeFor(p, g, b.x + 0.5, b.y + 0.5, b);
      if (store) assignHaul(take(b.x, b.y), b, store, g);
    }
  }
}

/** Which idle buildings get an operator first (lower = sooner). */
function staffPriority(b) {
  return b.type === 'foundry' ? 0 : b.type === 'grower' ? 2 : 1;
}

function assignHaul(u, src, dst, g) {
  if (!u) return;
  cancelTask(u);
  u.task = { type: 'haul', src: src.id, dst: dst.id, good: g, phase: 'toSrc' };
  bump(src.res, g, 1);
  bump(dst.inc, g, 1);
  if (!goTo(u, src.x, src.y)) cancelTask(u);
}

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
  const t = u.task;
  if (!t) {
    if (u.carry) { stashCarry(u); return; }
    if (!u.inside) {
      u.idleT += dt;
      if (u.idleT > 1.5) goHome(u);
    }
    return;
  }
  if (t.type === 'home') {
    const h = getE(t.bld);
    if (!h || h.owner !== u.owner) { u.task = null; u.path = null; return; }
    if (moveAlong(u, dt)) { u.task = null; enterBuilding(u, h); }
  } else if (t.type === 'haul') doHaul(u, t, dt);
  else if (t.type === 'build') doBuild(u, t, dt);
  else if (t.type === 'staff') doStaff(u, t, dt);
}

function goHome(u) {
  const store = nearestStoreTo(u.owner, u.x, u.y);
  u.idleT = 0;
  if (store && goTo(u, store.x, store.y)) u.task = { type: 'home', bld: store.id };
}

function stashCarry(u) {
  const store = storeFor(u.owner, u.carry, u.x, u.y) || nearestStoreTo(u.owner, u.x, u.y);
  if (!store) { u.carry = null; return; }
  u.task = { type: 'haul', src: 0, dst: store.id, good: u.carry, phase: 'toDst' };
  bump(store.inc, u.carry, 1);
  if (!goTo(u, store.x, store.y)) { cancelTask(u); u.carry = null; }
}

function doHaul(u, t, dt) {
  if (t.phase === 'toSrc') {
    const src = getE(t.src);
    if (!src || src.owner !== u.owner) { cancelTask(u); return; }
    if (!moveAlong(u, dt)) return;
    bump(src.res, t.good, -1);
    const dst = getE(t.dst);
    if ((src.stock[t.good] || 0) <= 0 || !dst) {
      if (dst) bump(dst.inc, t.good, -1);
      u.task = null;
      return;
    }
    bump(src.stock, t.good, -1);
    u.carry = t.good;
    t.phase = 'toDst';
    if (!goTo(u, dst.x, dst.y)) { bump(dst.inc, t.good, -1); u.task = null; }
    return;
  }
  const dst = getE(t.dst);
  if (!dst || dst.owner !== u.owner) { cancelTask(u); return; }
  if (!moveAlong(u, dt)) return;
  bump(dst.inc, t.good, -1);
  bump(dst.stock, t.good, 1);
  u.carry = null;
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
  const def = BDEFS[s.type];
  const cap = deliveredCount(s) / sumValues(def.cost);
  if (s.progress < cap) {
    s.progress = Math.min(cap, s.progress + (dt * S.players[u.owner].mult) / def.buildTime);
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

function findNode(b, type, radius) {
  let best = -1, bd = Infinity;
  const r2 = radius * radius + 0.3;
  for (let j = Math.max(0, b.y - radius); j <= Math.min(S.H - 1, b.y + radius); j++) {
    for (let i = Math.max(0, b.x - radius); i <= Math.min(S.W - 1, b.x + radius); i++) {
      const t = j * S.W + i;
      if (S.res[t] !== type || !S.amt[t] || S.resRes[t]) continue;
      if (type === R_STALK && S.grow[t] < 1) continue;
      const d = dist2(i, j, b.x, b.y);
      if (d <= r2 && d < bd) { bd = d; best = t; }
    }
  }
  return best;
}

function findPlantSpot(b, radius) {
  let best = -1, bs = -Infinity;
  const r2 = radius * radius + 0.3;
  for (let j = Math.max(0, b.y - radius); j <= Math.min(S.H - 1, b.y + radius); j++) {
    for (let i = Math.max(0, b.x - radius); i <= Math.min(S.W - 1, b.x + radius); i++) {
      const t = j * S.W + i;
      const d = dist2(i, j, b.x, b.y);
      if (d > r2 || d < 2.5) continue;
      if (S.terrain[t] !== T_GROUND || S.res[t] || S.bAt[t] || S.road[t] || S.resRes[t]) continue;
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
      if (!def.gather && !def.plant) return; // production happens in updateBuilding
      t.wait -= dt;
      if (t.wait > 0) return;
      let node;
      if (def.gather) {
        const g = RES[def.gather].good;
        if ((b.stock[g] || 0) >= def.out[g]) { b.status = 'Storage full, waiting for pickup'; t.wait = 1; return; }
        node = findNode(b, def.gather, def.radius);
        if (node < 0) { b.status = `No ${RES[def.gather].name.toLowerCase()}s left in reach`; t.wait = 3; return; }
        b.status = 'Gathering ' + GOOD[g].name;
      } else {
        if (countResIn(b.x, b.y, def.radius, def.plant) >= 16) { b.status = 'The grove is full'; t.wait = 4; return; }
        node = findPlantSpot(b, def.radius);
        if (node < 0) { b.status = 'No room left to plant'; t.wait = 4; return; }
        b.status = 'Planting stalk groves';
      }
      if (!goTo(u, node % S.W, (node / S.W) | 0)) { t.wait = 2; return; }
      S.resRes[node] = 1;
      t.node = node;
      t.phase = 'toNode';
      return;
    }
    case 'toNode':
      if (moveAlong(u, dt)) { t.phase = 'work'; t.timer = def.gather ? RES[def.gather].harvest : 3; }
      return;
    case 'work': {
      u.busy = 1;
      t.timer -= dt * mult;
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
        }
      } else if (!S.res[node] && !S.bAt[node] && !S.road[node]) {
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
      if (moveAlong(u, dt)) {
        enterBuilding(u, b);
        if (u.carry) { bump(b.stock, u.carry, 1); u.carry = null; }
        t.phase = 'in';
        t.wait = 0.3;
      }
      return;
  }
}

/* ------------------------------------------------------------------ buildings */

function updateBuilding(b, dt) {
  const def = BDEFS[b.type];
  b.working = false;
  if (!b.built) {
    if (sumValues(b.stock) + sumValues(b.inc) === 0) b.status = 'Waiting for materials';
    else if (!b.builder) b.status = 'Waiting for a builder';
    else b.status = 'Under construction';
    return;
  }
  if (b.armor < def.armor && S.time - b.lastHit > 8) b.armor = Math.min(def.armor, b.armor + dt * 0.8);
  if (b.paused) { b.status = 'Paused — its worker is free for other jobs'; return; }
  if (def.mil) b.status = `Garrison: ${b.garrison.length} of ${def.garrison} warbots`;
  else if (def.store) b.status = 'Storing goods';
  if (def.inp) produce(b, def, dt * S.players[b.owner].mult);
  else if (def.ammo) updateTurret(b, def, dt);
  if (def.mil) garrisonDefense(b, dt);
  if (def.staff && !def.inp) {
    const op = getE(b.staff);
    if (!op) b.status = b.staffInc ? 'Worker on the way' : 'Needs a worker';
  }
}

function produce(b, def, dt) {
  const op = getE(b.staff);
  if (!op || op.inside !== b.id) { b.status = b.staffInc || op ? 'Worker on the way' : 'Needs a worker'; return; }
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
  if (def.make) {
    for (const g in def.make) bump(b.stock, g, def.make[g]);
    addFx('float', b.x + 0.5, b.y + 0.1, { text: '+1', color: GOOD[Object.keys(def.make)[0]].color });
  }
  if (def.bots) spawnFromFoundry(b);
  if (b.owner === 0) sfx('produce');
}

function spawnFromFoundry(b) {
  let kind = b.mode;
  if (kind === 'alt') {
    kind = b.altNext;
    b.altNext = kind === 'worker' ? 'warbot' : 'worker';
  }
  const u = addBot(b.owner, kind, b.x, b.y);
  addFx('ring', b.x + 0.5, b.y + 0.5, { color: PLAYER_COLORS[b.owner] });
  if (kind === 'warbot') goGarrison(u);
}

function updateTurret(b, def, dt) {
  b.cd -= dt;
  if (b.cd > 0) return;
  const cx = b.x + 0.5, cy = b.y + 0.5;
  const target = nearestEnemyBot(b.owner, cx, cy, def.range, true);
  const ammo = b.shots + (b.stock.crystal || 0) * SHOTS_PER_AMMO;
  if (!target) { b.cd = 0.3; b.status = ammo ? `Watching (${ammo} shots)` : 'Needs Crystal for ammo'; return; }
  if (b.shots <= 0) {
    if ((b.stock.crystal || 0) > 0) { bump(b.stock, 'crystal', -1); b.shots = SHOTS_PER_AMMO; }
    else { b.status = 'Out of ammo!'; b.cd = 0.5; return; }
  }
  b.shots--;
  b.aim = Math.atan2(target.y - cy, target.x - cx);
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
  b.mode = 'alt';
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
  if (u.inside) return;
  u.cd -= dt;
  const t = u.task;
  const defending = t && t.type === 'defend';
  let foe = u.fight ? getE(u.fight) : null;
  const leash = defending ? 9 : 4;
  if (foe && (foe.dead || foe.inside || dist2(foe.x, foe.y, u.x, u.y) > leash * leash)) foe = null;
  if (!foe) {
    u.fight = 0;
    u.scanT -= dt;
    if (u.scanT <= 0) {
      u.scanT = 0.3;
      foe = nearestEnemyBot(u.owner, u.x, u.y, 2.8, true);
      if (!foe && defending) {
        const h = getE(t.home);
        if (h) foe = nearestEnemyBot(u.owner, h.x + 0.5, h.y + 0.5, 6.5, true);
      }
      if (foe) u.fight = foe.id;
    }
  }
  if (foe) {
    const d = dist(u.x, u.y, foe.x, foe.y);
    if (d > 0.7) moveDirect(u, foe.x, foe.y, dt);
    else if (u.cd <= 0) {
      u.cd = 0.9;
      u.face = Math.atan2(foe.y - u.y, foe.x - u.x);
      addFx('spark', (u.x + foe.x) / 2, (u.y + foe.y) / 2, { color: PLAYER_COLORS[u.owner] });
      if (u.owner === 0 || foe.owner === 0) sfx('hit');
      damageBot(foe, 2 + (hash2(u.id, S.tick, 7) < 0.5 ? 1 : 0));
    }
    u.path = null;
    return;
  }
  if (!t) { goGarrison(u); return; }
  if (t.type === 'garrison') {
    const b = getE(t.bld);
    if (!b || b.owner !== u.owner || !b.built) { cancelTask(u); return; }
    const r = travel(u, b.x, b.y, dt);
    if (r === null) { cancelTask(u); return; }
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
    if (dist2(u.x, u.y, b.x + 0.5, b.y + 0.5) <= 1.7) {
      u.path = null;
      u.face = Math.atan2(b.y + 0.5 - u.y, b.x + 0.5 - u.x);
      if (u.cd <= 0) {
        u.cd = 1.0;
        addFx('spark', b.x + 0.5 + (hash2(u.id, S.tick, 3) - 0.5) * 0.6, b.y + 0.5 + (hash2(u.id, S.tick, 5) - 0.5) * 0.6, { color: PLAYER_COLORS[u.owner] });
        hitBuilding(b, 1, u.owner);
      }
      return;
    }
    if (travel(u, b.x, b.y, dt) === null) u.task = null;
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

/* ------------------------------------------------------------------ player commands */

function attackSources(owner, target) {
  const out = [];
  for (const b of S.buildings) {
    if (b.dead || b.owner !== owner || !b.built || !BDEFS[b.type].mil) continue;
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
      if (u.carry) { bump(b.stock, u.carry, 1); u.carry = null; }
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

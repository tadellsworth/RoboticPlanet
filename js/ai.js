'use strict';
/*
 * Botfall — rival AI. It plays by the same rules as the player: it places construction sites
 * from a build plan, picks good spots, balances worker/warbot production and attacks once it
 * has gathered enough warbots near a target.
 */

/** [building type, how many the AI wants]. Entries are tried in order. */
const AI_PLAN = [
  ['harvester', 1], ['quarry', 1], ['harvester', 2], ['mine', 1], ['tap', 1], ['smelter', 1],
  ['fab', 1], ['foundry', 1], ['outpost', 1], ['armory', 1], ['charger', 1], ['farm', 1], ['quarry', 2], ['grower', 1], ['mine', 2],
  ['turret', 1], ['outpost', 2], ['smelter', 2], ['tap', 2], ['pump', 1], ['refinery', 1], ['harvester', 3], ['outpost', 3],
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
  // Keep about a third of the workers free for hauling: a colony with every worker staffed stalls.
  const canStaffMore = staffed + Math.max(5, Math.round(workers * 0.35)) <= workers;
  // Resources are in separate fields: when one kind runs short inside our land, expanding toward
  // more of it comes before anything else.
  const inLand = {};
  for (let t = 0; t < S.W * S.H; t++) if (S.owner[t] === p && S.res[t]) inLand[S.res[t]] = (inLand[S.res[t]] || 0) + 1;
  P.short = [R_STALK, R_BOULDER, R_ORE, R_CRYSTAL].filter((r) => (inLand[r] || 0) < 4);
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
  const outSite = me.some((b) => b.type === 'outpost' && !b.built);
  if (P.short.length && !outSite && S.time - (P.lastExpand || -99) > 40) plan = [['outpost', (counts.outpost || 0) + 1]].concat(plan);
  if (sites < maxSites) {
    for (const [type, want0] of plan) {
      if (S.mode === 'colony' && BDEFS[type].war) continue;
      // One more Charging Station for every three Outposts as the colony spreads out, and a Bio
      // Farm for every two stations to keep them in Fuel.
      const nCh = Math.max(1 + Math.floor((counts.outpost || 0) / 3), 0);
      const want = type === 'charger' ? Math.max(want0, nCh) : type === 'farm' && counts.charger ? Math.max(want0, Math.ceil((counts.charger || 0) / 2)) : want0;
      if (type === 'refinery' && !counts.pump) continue;
      // Plenty of Fuel in stock: no need for more farms or oil yet.
      if ((type === 'farm' || type === 'pump' || type === 'refinery') && (counts[type] || 0) >= 1 && playerGoods(p).fuel > 10) continue;
      if ((counts[type] || 0) >= want) continue;
      // The first of each staffed building is always allowed, so the production chain is complete.
      if (BDEFS[type].staff && !BDEFS[type].crew && !canStaffMore && counts[type]) continue;
      if (!aiAffordable(p, type)) continue;
      const spot = aiFindSpot(p, type, lander);
      if (spot && placeSite(p, type, spot.x, spot.y).ok) {
        if (type === 'outpost') P.lastExpand = S.time;
        break;
      }
    }
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
  //    one, and a Hauler for every four workers.
  const wantWorkers = staffed + 5 + Math.min(3, sites);
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
    if ((kinds.hauler || 0) < Math.floor(workers / 4) && !(b.orders.hauler > 0)) b.orders.hauler = 1;
    break;
  }

  // 4) Missiles: soften turrets and Outposts first, the Lander once the army is big.
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
  // A big army with nothing in reach: push a forward Outpost toward the enemy Lander.
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
  const avoid = (S.players[p].avoid || []).filter((a) => a.until > S.time);
  S.players[p].avoid = avoid;
  for (let j = 0; j < S.H; j++) {
    for (let i = 0; i < S.W; i++) {
      if (S.owner[j * S.W + i] !== p) continue;
      if (S.fert[j * S.W + i] && type !== 'farm') continue; // keep fertile soil for farming
      if (avoid.some((a) => dist2(a.x, a.y, i, j) < 12)) continue;
      if (!canPlace(p, type, i, j, true).ok) continue;
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
      s += jitter;
      cands.push({ x: i, y: j, s });
    }
  }
  // Only the best few spots get the (costly) check that a building won't block a pass.
  cands.sort((a, b) => b.s - a.s);
  for (let k = 0; k < Math.min(cands.length, 12); k++) {
    if (!wouldBlock(tIdx(cands[k].x, cands[k].y))) return cands[k];
  }
  return null;
}

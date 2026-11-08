'use strict';
/*
 * Botfall — rival AI. It plays by the same rules as the player: it places construction sites
 * from a build plan, picks good spots, balances worker/warbot production and attacks once it
 * has gathered enough warbots near a target.
 */

/** [building type, how many the AI wants]. Entries are tried in order. */
const AI_PLAN = [
  ['harvester', 1], ['quarry', 1], ['harvester', 2], ['mine', 1], ['tap', 1], ['smelter', 1],
  ['fab', 1], ['foundry', 1], ['outpost', 1], ['quarry', 2], ['grower', 1], ['mine', 2],
  ['turret', 1], ['outpost', 2], ['smelter', 2], ['tap', 2], ['harvester', 3], ['outpost', 3],
  ['depot', 1], ['mine', 3], ['outpost', 4], ['turret', 2], ['grower', 2], ['fab', 2],
  ['outpost', 5], ['quarry', 3], ['outpost', 6], ['tap', 3], ['outpost', 8], ['turret', 3],
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
  for (const u of S.bots) if (!u.dead && u.owner === p && u.type === 'worker') workers++;
  for (const b of me) if (BDEFS[b.type].staff) staffed++;
  const canStaffMore = staffed + Math.max(MIN_FREE_WORKERS, Math.round(workers * 0.2)) + 1 <= workers;
  const plan = S.mode === 'colony' ? AI_PLAN.concat([['outpost', 40]]) : AI_PLAN;
  if (sites < maxSites) {
    for (const [type, want] of plan) {
      if (S.mode === 'colony' && type === 'turret') continue;
      if ((counts[type] || 0) >= want) continue;
      if (BDEFS[type].staff && !canStaffMore && type !== 'foundry') continue;
      if (!aiAffordable(p, type)) continue;
      const spot = aiFindSpot(p, type, lander);
      if (spot && placeSite(p, type, spot.x, spot.y).ok) break;
    }
  }

  // 2) Retire gatherers that have run dry so their worker can be reused.
  for (const b of me) {
    const def = BDEFS[b.type];
    if (b.built && def.gather && S.time - b.born > 30 && countResIn(b.x, b.y, def.radius, def.gather) === 0 && !(b.stock[RES[def.gather].good] > 0)) {
      demolish(b);
    }
  }

  // 3) Foundry: keep enough workers, then make warbots.
  const wantWorkers = staffed + 5 + Math.min(3, sites);
  for (const b of me) {
    if (b.type === 'foundry') b.mode = S.mode === 'colony' ? 'worker' : workers < wantWorkers ? 'worker' : workers > wantWorkers + 4 ? 'warbot' : 'alt';
  }

  // 4) Attack
  if (S.time < lvl.grace || S.time < P.nextAttack) return;
  const enemy = 1 - p;
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
  }
}

/** Only start a building when the needed materials exist somewhere (stops the AI hoarding sites). */
function aiAffordable(p, type) {
  const have = playerGoods(p);
  const cost = BDEFS[type].cost;
  for (const g in cost) if (have[g] < cost[g]) return false;
  return true;
}

function aiFindSpot(p, type, lander) {
  const def = BDEFS[type];
  const enemyL = getE(S.players[1 - p].lander);
  const ex = enemyL ? enemyL.x : S.W / 2, ey = enemyL ? enemyL.y : S.H / 2;
  let best = null, bs = -Infinity;
  const avoid = (S.players[p].avoid || []).filter((a) => a.until > S.time);
  S.players[p].avoid = avoid;
  for (let j = 0; j < S.H; j++) {
    for (let i = 0; i < S.W; i++) {
      if (S.owner[j * S.W + i] !== p) continue;
      if (avoid.some((a) => dist2(a.x, a.y, i, j) < 12)) continue;
      if (!canPlace(p, type, i, j).ok) continue;
      const dHome = dist(i, j, lander.x, lander.y);
      const jitter = hash2(i, j, S.seed + p) * 0.8;
      let s;
      if (def.gather) {
        const n = countResIn(i, j, def.radius, def.gather);
        if (n < 2) continue;
        s = Math.min(n, 10) * 2 - dHome * 0.35;
      } else if (def.plant) {
        let dh = 99;
        for (const b of S.buildings) if (!b.dead && b.owner === p && b.type === 'harvester') dh = Math.min(dh, dist(i, j, b.x, b.y));
        s = -dh - countResIn(i, j, def.radius, R_STALK) * 0.2;
      } else if (type === 'outpost') {
        const ore = Math.min(countResIn(i, j, 6, R_ORE), 8), cry = Math.min(countResIn(i, j, 6, R_CRYSTAL), 8);
        const rest = Math.min(countResIn(i, j, 6, R_STALK), 6) + Math.min(countResIn(i, j, 6, R_BOULDER), 6);
        s = -dist(i, j, ex, ey) * 0.6 + dHome * 0.5 + ore * 1.6 + cry * 1.0 + rest * 0.3;
      } else if (type === 'turret') {
        s = -Math.abs(dHome - 3.5) * 2 - dist(i, j, ex, ey) * 0.15;
      } else {
        s = -dHome;
      }
      s += jitter;
      if (s > bs) { bs = s; best = { x: i, y: j }; }
    }
  }
  return best;
}

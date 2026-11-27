'use strict';
/*
 * Terrafall — A* pathfinding on the tile grid (8 directions, no corner cutting).
 * Buildings block movement except for the start and goal tiles, so bots can walk out of
 * and into buildings. Paths make travel cheaper (unless taken the wrong way up a one-way path);
 * resource tiles are slower to cross.
 */

const _pf = { n: 0, g: null, from: null, stamp: null, closed: null, pkS: null, pkD: null, gen: 0, heap: new MinHeap() };

function _pfEnsure(N) {
  if (_pf.n === N) return;
  _pf.n = N;
  _pf.g = new Float32Array(N);
  _pf.from = new Int32Array(N);
  _pf.stamp = new Uint32Array(N);
  _pf.closed = new Uint32Array(N);
  _pf.pkS = new Uint32Array(N); // (opts.safe: the tiles of the gun cover a route starts in that it may cross to get out)
  _pf.pkD = new Uint8Array(N);
  _pf.gen = 0;
}

/**
 * Cost of crossing tile t while moving in direction (dx, dy); off-road tiles cost `offMul` times more. `lane` is the
 * bot's speed factor on an Express lane (laneSpeed; 0 for one that may only cross a lane, at Asphalt speed).
 */
function tileCost(t, dx, dy, offMul, lane) {
  if (S.tidal && S.tidal[t] && flatsClosing()) return 40; // the tide is about to cover the flats: keep off them
  const r = S.road[t];
  if (r) {
    // The wrong way up a one-way road: slow, plus a penalty so bots only do it when there's no other way.
    if (r >= 2 && dx * ROAD_DIRS[r][0] + dy * ROAD_DIRS[r][1] < 0) return 1 / ONEWAY_WRONG + 2;
    if (S.pave[t] === 3) return ROAD_PREFERENCE / (lane || PAVE[2].speed);
    return ROAD_PREFERENCE / PAVE[S.pave[t] || 1].speed;
  }
  if (S.bAt[t]) return passTile(t) ? ROAD_PREFERENCE / PAVE[throughPave(t)].speed : 1; // an Outpost a road runs through (as fast as the road into it), or the building a trip starts or ends at
  if (S.ramp[t]) return offMul / SLOPE_SPEED;
  if (S.ford && S.ford[t] && S.terrain[t] === T_WATER) return FORD_COST * offMul; // wading a ford: slow
  return (S.res[t] ? 1.5 : 1) * offMul;
}

/** What stepping into tile t's grove costs player p's robot on top of the going: GROVE.path by its stage if a foe planted it, else 0. */
function groveCost(t, p) {
  const o = S.grvO ? S.grvO[t] - 1 : -1;
  if (o < 0 || o === p || !foes(o, p)) return 0;
  const g = S.grove[t];
  return GROVE.path[g < GROVE.young ? 0 : g < GROVE.mature ? 1 : 2];
}

const _DIRS = [[1, 0, 1], [-1, 0, 1], [0, 1, 1], [0, -1, 1], [1, 1, 1.4142], [1, -1, 1.4142], [-1, 1, 1.4142], [-1, -1, 1.4142]];

/**
 * Returns an array of tile indices from the tile after (sx, sy) up to and including (gx, gy),
 * an empty array if already there, or null if the goal cannot be reached. With `avoidFor` set to
 * a player id, tiles in that player's enemies' territory cost much more.
 * opts.roadOnly: only road tiles (plus the start and goal), straight moves only (haulers).
 * opts.offMul: how many times more an off-road tile costs (bots that are slow off roads).
 * opts.who: the player whose bot this is (only its own Gates let it through).
 * opts.breach: an armed warbot: enemy Walls and Gates count as passable but dear (BREACH_COST plus
 *   their armor), so it goes round a short way and plans to shoot through a long one.
 * opts.cover: a player id (the army on the march): tiles its enemies' guns reach cost COVER_COST more (dangerMap).
 * opts.coverMap: the same from a map of its own (1 where a gun reaches): the Murmur's on Active (murmurGunMap).
 * opts.rad: tiles in a radiation zone cost RAD.path more (a rival's army on the march); with `avoidFor` set they always do.
 * opts.grove: a player id (a rival's robot): tiles of a foe's grove cost GROVE.path more by its stage (groveCost), so it
 *   goes round where the way round is short and through where there is none. Unset (and nothing) with no groves.
 * opts.ew: stage 4's earthworks (S.ewK): 1 a light robot (an Earth Bank, a Fire Trench or Dragon's Teeth cost EW.path more
 *   to cross), 2 a heavy one (banks and teeth are closed to it), 3 a heavy army's (a foe's are open but dear, BREACH_COST
 *   and their strength: it plans to shoot through, ewBreachHit). Unset with no earthworks. Water standing from a Sluice
 *   (S.fld 3) is closed to everyone, the goal aside.
 * opts.safe: a danger map (dangerMap): a goods carrier's way round enemy guns, or none. Tiles a gun covers (bit 1) are
 *   closed, but for the first SAFE_POCKET tiles out of the cover it starts in (see safeRoute).
 * opts.maxExpanded: bound a speculative route search. Actual movement uses the full search.
 * opts.lane: the bot's speed factor along an Express lane (laneSpeed), 0 or unset for a bot barred from them: it may
 *   only step onto a lane across its direction (crossing it, at an overpass or a ramp), never along it.
 *
 * An overpass (S.over) carries two roads that cross without meeting: nobody turns on one. A route only goes onto
 * an overpass straight on and out the far side: one move from the tile before it to the tile after it (across any
 * overpasses in a row), costing every step, with the overpass tiles kept in the path so bots drive over them. A
 * route may still start on one (any way off it) or end on one (from any side).
 */
function findPath(sx, sy, gx, gy, avoidFor, opts) {
  const roadOnly = !!(opts && opts.roadOnly), offMul = (opts && opts.offMul) || 1, lane = (opts && opts.lane) || 0;
  const who = opts ? opts.who : undefined, breach = !!(opts && opts.breach);
  const ferryOk = who !== undefined && !(opts && opts.noFerry) && navalOk();
  const airOk = who !== undefined && !(opts && opts.noAir) && airLines().size > 0; // (Workers and Warbots ride Airship lines)
  const lineTile = (t) => (ferryOk && ferryLink(t) >= 0) || (airOk && airLink(t) >= 0); // a Port or Mast where a ride starts
  const guns = avoidFor !== undefined && avoidFor >= 0 && typeof dangerMap === 'function' && S.players[avoidFor] ? dangerMap(avoidFor) : null;
  const rad = (opts && opts.rad) || (avoidFor !== undefined && avoidFor >= 0) ? (S.rads && S.rads.length && typeof radMap === 'function' ? radMap() : null) : null; // (radiation: robots that don't fight, and a rival's army, go round)
  const safe = (opts && opts.safe) || null, pkS = _pf.pkS, pkD = _pf.pkD;
  const cover = opts && opts.coverMap ? opts.coverMap : opts && opts.cover !== undefined && S.players[opts.cover] ? dangerMap(opts.cover) : null;
  const grv = opts && opts.grove !== undefined && S.grove ? opts.grove : -1;
  const ewo = opts && opts.ew && S.ewK ? opts.ew : 0, fld = S.fld || null; // (stage 4: earthworks and floods)
  const W = S.W, H = S.H, N = W * H, ov = anyOverpass();
  if (!inMap(gx, gy)) return null;
  const start = sy * W + sx, goal = gy * W + gx;
  if (start === goal) return [];
  if (!walkable(goal)) return null;
  _pfEnsure(N);
  const gen = ++_pf.gen;
  const g = _pf.g, from = _pf.from, stamp = _pf.stamp, closed = _pf.closed, heap = _pf.heap;
  heap.clear();
  const top = topPave(), minStep = ROAD_PREFERENCE / Math.max(PAVE[top].speed, top === 3 ? lane : 0);
  const h = (i, j) => {
    const dx = Math.abs(i - gx), dy = Math.abs(j - gy);
    return (Math.max(dx, dy) + 0.4142 * Math.min(dx, dy)) * minStep;
  };
  g[start] = 0; stamp[start] = gen; from[start] = -1;
  if (safe && (safe[start] & 1)) { pkS[start] = gen; pkD[start] = 0; }
  // (opts.safe: may the route step from cur onto tile t? Not into a gun's cover, unless still getting out of the one it started in.)
  const shut = (cur, t) => (safe[t] & 1) !== 0 && (pkS[cur] !== gen || pkD[cur] >= SAFE_POCKET);
  const pocket = (cur, t) => { if (safe[t] & 1) { pkS[t] = gen; pkD[t] = pkD[cur] + 1; } };
  heap.push(start, h(sx, sy));
  // Straight on from cur onto overpass tile a (direction dir) and out the far side: the tile after it (and after any
  // more overpasses in a row), or the goal if it lies on one of them. The way there is kept as from = -2 - cur.
  const overpass = (cur, a, dir, wall) => {
    const dx = dir[0], dy = dir[1];
    if (safe && (safe[a] & 1)) return;
    let ng = g[cur] + (tileCost(cur, dx, dy, offMul, lane) + tileCost(a, dx, dy, offMul, lane)) * 0.5 + wall + extra(a);
    let ai = a % W, aj = (a / W) | 0, b = a;
    while (b !== goal && S.over[b]) {
      const bi = ai + dx, bj = aj + dy;
      if (bi < 0 || bj < 0 || bi >= W || bj >= H) return;
      const nb = bj * W + bi;
      if (!walkable(nb) || !canStep(b, nb) || (safe && (safe[nb] & 1))) return;
      let w = 0;
      if (S.bAt[nb] && nb !== goal && !passTile(nb, who) && !(lineTile(nb) && getE(S.bAt[nb]).owner === who)) {
        if (!breach || !breachable(nb, who)) return;
        w = BREACH_COST + Math.max(0, getE(S.bAt[nb]).armor) * BREACH_PER_ARMOR;
      }
      if (roadOnly && !roadLike(nb) && nb !== goal && !(ferryOk && ferryLink(nb) >= 0)) return;
      ng += (tileCost(b, dx, dy, offMul, lane) + tileCost(nb, dx, dy, offMul, lane)) * 0.5 + w + extra(nb);
      b = nb; ai = bi; aj = bj;
    }
    if (closed[b] === gen) return;
    if (stamp[b] !== gen || ng < g[b]) {
      stamp[b] = gen; g[b] = ng; from[b] = -2 - cur;
      heap.push(b, ng + h(ai, aj));
    }
  };
  // What entering tile t costs on top of the going (as below): enemy land and guns, and the army's cover.
  const extra = (t) => {
    let e = 0;
    if (avoidFor !== undefined) { const o = S.owner[t]; if (o >= 0 && o !== avoidFor) e += 6; if (guns && guns[t]) e += DANGER_COST; }
    if (cover && (cover[t] & 1)) e += COVER_COST;
    if (rad && rad[t]) e += RAD.path;
    if (grv >= 0 && S.grove[t]) e += groveCost(t, grv);
    return e;
  };
  let expanded = 0;
  while (heap.size) {
    const cur = heap.pop();
    if (closed[cur] === gen) continue;
    closed[cur] = gen;
    if (cur === goal) break;
    if (++expanded > (opts?.maxExpanded || N)) break;
    const ci = cur % W, cj = (cur / W) | 0;
    for (let d = 0; d < 8; d++) {
      const dir = _DIRS[d];
      const ni = ci + dir[0], nj = cj + dir[1];
      if (ni < 0 || nj < 0 || ni >= W || nj >= H) continue;
      const nt = nj * W + ni;
      if (closed[nt] === gen) continue;
      if (!walkable(nt)) continue; // open ground, bridges and tunnels
      let wall = 0;
      if (fld && fld[nt] === 3 && nt !== goal) continue; // (under a Sluice's flood: nobody walks there)
      if (ewo && S.ewK[nt] && S.ewH[nt]) { // (an earthwork: EW)
        const k = S.ewK[nt];
        if (ewo >= 2 && k !== 2) { if (ewo < 3 || dir[2] > 1 || !foes(S.ewO[nt] - 1, who)) continue; wall = BREACH_COST + (S.ewH[nt] / EW.breach) * BREACH_PER_ARMOR; }
        else wall = EW.path[EW_KINDS[k]];
      }
      if (S.bAt[nt] && nt !== goal && !passTile(nt, who) && !(lineTile(nt) && getE(S.bAt[nt]).owner === who)) {
        if (!breach || dir[2] > 1 || !breachable(nt, who)) continue;
        wall = BREACH_COST + Math.max(0, getE(S.bAt[nt]).armor) * BREACH_PER_ARMOR;
      }
      if (roadOnly && (dir[2] > 1 || (!roadLike(nt) && nt !== goal && !(ferryOk && ferryLink(nt) >= 0)))) continue;
      // An Express lane: a bot barred from it may only step onto it across its direction (crossing it), never along.
      if (!lane && nt !== goal && S.road[nt] >= 2 && S.pave[nt] === 3 && dir[0] * ROAD_DIRS[S.road[nt]][0] + dir[1] * ROAD_DIRS[S.road[nt]][1] !== 0) continue;
      if (dir[2] > 1) {
        // Bots follow roads round their corners: no cutting diagonally on or off a road.
        if (S.road[cur] || S.road[nt]) continue;
        // Diagonal: only across flat ground, and no cutting corners past blocked tiles.
        const a = cj * W + ni, b = nj * W + ci;
        if (S.terrain[a] !== T_GROUND || S.terrain[b] !== T_GROUND || S.terrain[nt] !== T_GROUND || S.terrain[cur] !== T_GROUND) continue;
        if ((S.bAt[a] && a !== goal) || (S.bAt[b] && b !== goal)) continue;
        if (ewo >= 2 && (t4Shut(a, true) || t4Shut(b, true))) continue; // (no slipping a heavy robot diagonally through a line of earthworks)
        const e = S.elev[cur];
        if (S.elev[nt] !== e || S.elev[a] !== e || S.elev[b] !== e) continue;
      } else if (!canStep(cur, nt)) continue; // cliffs block; ramps connect levels
      else if (ov && S.road[nt] && S.over[nt] && nt !== goal) { overpass(cur, nt, dir, wall); continue; }
      if (safe && shut(cur, nt)) continue;
      let ng = g[cur] + dir[2] * (tileCost(cur, dir[0], dir[1], offMul, lane) + tileCost(nt, dir[0], dir[1], offMul, lane)) * 0.5 + wall;
      // Workers steer clear of enemy territory unless there is no other way, and well clear of enemy guns.
      if (avoidFor !== undefined) { const o = S.owner[nt]; if (o >= 0 && o !== avoidFor) ng += 6; if (guns && guns[nt]) ng += DANGER_COST; }
      // The army keeps out of the enemy's guns where the way round is short.
      if (cover && (cover[nt] & 1)) ng += COVER_COST * dir[2];
      // Radiation: robots that don't fight (and a rival's army) go round a zone where the way round is short, in if sent there.
      if (rad && rad[nt]) ng += RAD.path * dir[2];
      // A foe's grove: a rival's robots go round it where the way round is short (GROVE.path), through it where not.
      if (grv >= 0 && S.grove[nt]) ng += groveCost(nt, grv) * dir[2];
      if (stamp[nt] !== gen || ng < g[nt]) {
        stamp[nt] = gen; g[nt] = ng; from[nt] = cur;
        if (safe) pocket(cur, nt);
        heap.push(nt, ng + h(ni, nj));
      }
    }
    // A Viaduct: drive straight across to the far abutment (anyone), at plain road cost.
    if (S.bAt[cur]) {
      const nt = viaLink(cur);
      if (nt >= 0 && closed[nt] !== gen && !(safe && (safe[nt] & 1))) {
        const ni = nt % W, nj = (nt / W) | 0;
        const ng = g[cur] + (Math.abs(ni - ci) + Math.abs(nj - cj)) * ROAD_PREFERENCE / PAVE[1].speed;
        if (stamp[nt] !== gen || ng < g[nt]) {
          stamp[nt] = gen; g[nt] = ng; from[nt] = cur;
          heap.push(nt, ng + h(ni, nj));
        }
      }
    }
    // A Sap Head's sap (stage 4): down at one end, up at the other (its owner's ground robots), as long as its route.
    if (S.bAt[cur] && who !== undefined) {
      const nt = sapLink(cur, who);
      if (nt >= 0 && closed[nt] !== gen && !(safe && (safe[nt] & 1))) {
        const ni = nt % W, nj = (nt / W) | 0;
        const ng = g[cur] + sapLen(cur) * SAP.cost * minStep;
        if (stamp[nt] !== gen || ng < g[nt]) {
          stamp[nt] = gen; g[nt] = ng; from[nt] = cur;
          heap.push(nt, ng + h(ni, nj));
        }
      }
    }
    // A Port with a ferry line: take the ferry to the far Port (its owner's bots, Crawlers and creatures excepted).
    if (S.bAt[cur] && ferryOk) {
      const nt = ferryLink(cur);
      if (nt >= 0 && closed[nt] !== gen && getE(S.bAt[cur]).owner === who && !(safe && (safe[nt] & 1))) {
        const ni = nt % W, nj = (nt / W) | 0;
        const ng = g[cur] + (Math.sqrt((ni - ci) * (ni - ci) + (nj - cj) * (nj - cj)) * FERRY_COST + FERRY_BOARD) * minStep;
        if (stamp[nt] !== gen || ng < g[nt]) {
          stamp[nt] = gen; g[nt] = ng; from[nt] = cur;
          heap.push(nt, ng + h(ni, nj));
        }
      }
    }
    // A Mooring Mast on an Airship line: fly to the far Mast (its owner's Workers and Warbots).
    if (S.bAt[cur] && airOk) {
      const nt = airLink(cur);
      if (nt >= 0 && closed[nt] !== gen && getE(S.bAt[cur]).owner === who && !(safe && (safe[nt] & 1))) {
        const ni = nt % W, nj = (nt / W) | 0;
        const ng = g[cur] + (Math.sqrt((ni - ci) * (ni - ci) + (nj - cj) * (nj - cj)) * AIRSHIP.routeCost + AIRSHIP.routeBoard) * minStep;
        if (stamp[nt] !== gen || ng < g[nt]) {
          stamp[nt] = gen; g[nt] = ng; from[nt] = cur;
          heap.push(nt, ng + h(ni, nj));
        }
      }
    }
    // A Ropeway station: ride the cable to the far station (light bots of its owner only).
    if (S.bAt[cur] && !(opts && opts.noRope)) {
      const nt = ropeLink(cur);
      if (nt >= 0 && closed[nt] !== gen && passTile(nt, who) && !(safe && (safe[nt] & 1))) {
        const ni = nt % W, nj = (nt / W) | 0;
        const ng = g[cur] + Math.sqrt((ni - ci) * (ni - ci) + (nj - cj) * (nj - cj)) * minStep * ROPE_COST;
        if (stamp[nt] !== gen || ng < g[nt]) {
          stamp[nt] = gen; g[nt] = ng; from[nt] = cur;
          heap.push(nt, ng + h(ni, nj));
        }
      }
    }
  }
  if (closed[goal] !== gen) return null;
  const path = [];
  for (let t = goal; t !== start;) {
    path.push(t);
    let f = from[t];
    if (f <= -2) {
      // Straight over an overpass (or a few) from f: they go in the path too.
      f = -2 - f;
      const d = Math.abs(t - f) < W ? Math.sign(t - f) : Math.sign(t - f) * W;
      for (let k = t - d; k !== f; k -= d) path.push(k);
    }
    t = f;
  }
  path.reverse();
  return path;
}

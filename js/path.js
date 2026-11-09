'use strict';
/*
 * Terrafall — A* pathfinding on the tile grid (8 directions, no corner cutting).
 * Buildings block movement except for the start and goal tiles, so bots can walk out of
 * and into buildings. Paths make travel cheaper (unless taken the wrong way up a one-way path);
 * resource tiles are slower to cross.
 */

const _pf = { n: 0, g: null, from: null, stamp: null, closed: null, gen: 0, heap: new MinHeap() };

function _pfEnsure(N) {
  if (_pf.n === N) return;
  _pf.n = N;
  _pf.g = new Float32Array(N);
  _pf.from = new Int32Array(N);
  _pf.stamp = new Uint32Array(N);
  _pf.closed = new Uint32Array(N);
  _pf.gen = 0;
}

/** Cost of crossing tile t while moving in direction (dx, dy); off-road tiles cost `offMul` times more. */
function tileCost(t, dx, dy, offMul) {
  const r = S.road[t];
  if (r) {
    // The wrong way up a one-way road: slow, plus a penalty so bots only do it when there's no other way.
    if (r >= 2 && dx * ROAD_DIRS[r][0] + dy * ROAD_DIRS[r][1] < 0) return 1 / ONEWAY_WRONG + 2;
    return ROAD_PREFERENCE / PAVE[S.pave[t] || 1].speed;
  }
  if (S.bAt[t]) return passTile(t) ? ROAD_PREFERENCE / PAVE[1].speed : 1; // an Outpost a road runs through, or the building a trip starts or ends at
  if (S.ramp[t]) return offMul / SLOPE_SPEED;
  return (S.res[t] ? 1.5 : 1) * offMul;
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
 */
function findPath(sx, sy, gx, gy, avoidFor, opts) {
  const roadOnly = !!(opts && opts.roadOnly), offMul = (opts && opts.offMul) || 1;
  const who = opts ? opts.who : undefined, breach = !!(opts && opts.breach);
  const W = S.W, H = S.H, N = W * H;
  if (!inMap(gx, gy)) return null;
  const start = sy * W + sx, goal = gy * W + gx;
  if (start === goal) return [];
  if (!walkable(goal)) return null;
  _pfEnsure(N);
  const gen = ++_pf.gen;
  const g = _pf.g, from = _pf.from, stamp = _pf.stamp, closed = _pf.closed, heap = _pf.heap;
  heap.clear();
  const minStep = ROAD_PREFERENCE / PAVE[topPave()].speed;
  const h = (i, j) => {
    const dx = Math.abs(i - gx), dy = Math.abs(j - gy);
    return (Math.max(dx, dy) + 0.4142 * Math.min(dx, dy)) * minStep;
  };
  g[start] = 0; stamp[start] = gen; from[start] = -1;
  heap.push(start, h(sx, sy));
  let expanded = 0;
  while (heap.size) {
    const cur = heap.pop();
    if (closed[cur] === gen) continue;
    closed[cur] = gen;
    if (cur === goal) break;
    if (++expanded > N) break;
    const ci = cur % W, cj = (cur / W) | 0;
    for (let d = 0; d < 8; d++) {
      const dir = _DIRS[d];
      const ni = ci + dir[0], nj = cj + dir[1];
      if (ni < 0 || nj < 0 || ni >= W || nj >= H) continue;
      const nt = nj * W + ni;
      if (closed[nt] === gen) continue;
      if (!walkable(nt)) continue; // open ground, bridges and tunnels
      let wall = 0;
      if (S.bAt[nt] && nt !== goal && !passTile(nt, who)) {
        if (!breach || dir[2] > 1 || !breachable(nt, who)) continue;
        wall = BREACH_COST + Math.max(0, getE(S.bAt[nt]).armor) * BREACH_PER_ARMOR;
      }
      if (roadOnly && (dir[2] > 1 || (!roadLike(nt) && nt !== goal))) continue;
      if (dir[2] > 1) {
        // Bots follow roads round their corners: no cutting diagonally on or off a road.
        if (S.road[cur] || S.road[nt]) continue;
        // Diagonal: only across flat ground, and no cutting corners past blocked tiles.
        const a = cj * W + ni, b = nj * W + ci;
        if (S.terrain[a] !== T_GROUND || S.terrain[b] !== T_GROUND || S.terrain[nt] !== T_GROUND || S.terrain[cur] !== T_GROUND) continue;
        if ((S.bAt[a] && a !== goal) || (S.bAt[b] && b !== goal)) continue;
        const e = S.elev[cur];
        if (S.elev[nt] !== e || S.elev[a] !== e || S.elev[b] !== e) continue;
      } else if (!canStep(cur, nt)) continue; // cliffs block; ramps connect levels
      let ng = g[cur] + dir[2] * (tileCost(cur, dir[0], dir[1], offMul) + tileCost(nt, dir[0], dir[1], offMul)) * 0.5 + wall;
      // Workers steer clear of enemy territory unless there is no other way.
      if (avoidFor !== undefined) { const o = S.owner[nt]; if (o >= 0 && o !== avoidFor) ng += 6; }
      if (stamp[nt] !== gen || ng < g[nt]) {
        stamp[nt] = gen; g[nt] = ng; from[nt] = cur;
        heap.push(nt, ng + h(ni, nj));
      }
    }
    // A Ropeway station: ride the cable to the far station (light bots of its owner only).
    if (S.bAt[cur] && !(opts && opts.noRope)) {
      const nt = ropeLink(cur);
      if (nt >= 0 && closed[nt] !== gen && passTile(nt, who)) {
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
  for (let t = goal; t !== start; t = from[t]) path.push(t);
  path.reverse();
  return path;
}

'use strict';
/*
 * Botfall — A* pathfinding on the tile grid (8 directions, no corner cutting).
 * Buildings block movement except for the start and goal tiles, so bots can walk out of
 * and into buildings. Paths make travel cheaper; resource tiles are slower to cross.
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

function tileCost(t) {
  if (S.road[t]) return 1 / ROAD_SPEED;
  return S.res[t] ? 1.5 : 1;
}

const _DIRS = [[1, 0, 1], [-1, 0, 1], [0, 1, 1], [0, -1, 1], [1, 1, 1.4142], [1, -1, 1.4142], [-1, 1, 1.4142], [-1, -1, 1.4142]];

/**
 * Returns an array of tile indices from the tile after (sx, sy) up to and including (gx, gy),
 * an empty array if already there, or null if the goal cannot be reached.
 */
function findPath(sx, sy, gx, gy) {
  const W = S.W, H = S.H, N = W * H;
  if (!inMap(gx, gy)) return null;
  const start = sy * W + sx, goal = gy * W + gx;
  if (start === goal) return [];
  if (S.terrain[goal] !== T_GROUND) return null;
  _pfEnsure(N);
  const gen = ++_pf.gen;
  const g = _pf.g, from = _pf.from, stamp = _pf.stamp, closed = _pf.closed, heap = _pf.heap;
  heap.clear();
  const minStep = 1 / ROAD_SPEED;
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
      if (S.terrain[nt] !== T_GROUND) continue;
      if (S.bAt[nt] && nt !== goal) continue;
      if (dir[2] > 1) {
        // No cutting corners past blocked tiles.
        const a = cj * W + ni, b = nj * W + ci;
        if (S.terrain[a] !== T_GROUND || S.terrain[b] !== T_GROUND) continue;
        if ((S.bAt[a] && a !== goal) || (S.bAt[b] && b !== goal)) continue;
      }
      const ng = g[cur] + dir[2] * (tileCost(cur) + tileCost(nt)) * 0.5;
      if (stamp[nt] !== gen || ng < g[nt]) {
        stamp[nt] = gen; g[nt] = ng; from[nt] = cur;
        heap.push(nt, ng + h(ni, nj));
      }
    }
  }
  if (closed[goal] !== gen) return null;
  const path = [];
  for (let t = goal; t !== start; t = from[t]) path.push(t);
  path.reverse();
  return path;
}

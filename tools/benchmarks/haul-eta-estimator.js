// Loaded into the simulation only by the benchmark. Measurements use the real dispatcher and movement.
let etaMode = 'distance';
let etaProfile;
function rankExperiment(sources, dst, good, take, idle) {
  sources.sort((a, b) => a.d - b.d);
  if (etaMode === 'distance' || sources.length < 2 || isLiquid(good) || !idle.some((u) => u.type === 'hauler') || idle.some((u) => BOTS[u.type].truck && !BOTS[u.type].tanker)) return;
  etaProfile.rankings++;
  const near = sources.slice(0, 4);
  const guarded = etaMode === 'eta-guarded' || etaMode === 'eta-guarded-budget';
  const traffic = etaMode === 'eta' || guarded;
  const waits = traffic || etaMode === 'eta-ferry';
  if (etaMode === 'eta-guarded-budget' && etaProfile.paths + 2 * near.length > etaProfile.pathCeiling) return;
  for (const entry of near) {
    const s = entry.src;
    const u = take(s.x, s.y, 'haul', s, good, dst, true);
    entry.eta = Infinity;
    if (u?.type !== 'hauler') continue;
    const empty = estimateLeg(u, u.x, u.y, s, traffic, waits);
    if (!Number.isFinite(empty)) continue;
    entry.eta = empty + estimateLeg(u, s.x + 0.5, s.y + 0.5, dst, traffic, waits);
  }
  near.sort((a, b) => a.eta - b.eta || a.d - b.d);
  sources.splice(0, near.length, ...near);
}

function estimateLeg(u, x, y, dest, traffic, waits) {
  const i = Math.floor(x), j = Math.floor(y);
  const opt = routeOpts({ ...u, x, y });
  opt.maxExpanded = 1500;
  etaProfile.paths++;
  const path = findPath(i, j, dest.x, dest.y, u.owner, opt);
  if (!path) return Infinity;
  let prev = tIdx(i, j), seconds = 0;
  const speed = BOTS[u.type].speed * batFactor(u) * speedMul(u);
  for (const next of path) {
    const ax = prev % S.W, ay = (prev / S.W) | 0, bx = next % S.W, by = (next / S.W) | 0;
    const dx = bx - ax, dy = by - ay, d = Math.hypot(dx, dy);
    if (navalMap() && ferryLink(prev) === next) {
      seconds += crossingEstimate(prev, next, d, waits);
    } else if (ropeLink(prev) === next) {
      seconds += d / ROPE_SPEED;
    } else {
      const pave = S.pave[prev] || 1;
      const road = S.road[prev];
      let mul = road ? (pave === 2 ? asphaltSpeed(S.wear[prev]) : PAVE[pave].speed)
        : S.bAt[prev] ? 1 : HAULER_STRANDED;
      if (road >= 2 && dx * ROAD_DIRS[road][0] + dy * ROAD_DIRS[road][1] < 0) mul = ONEWAY_WRONG;
      if (S.ramp[prev]) mul *= SLOPE_SPEED;
      if (S.lights[prev] && traffic) seconds += Math.min(2, (S.heat?.[prev] || 0) * 0.18);
      if (traffic && road) {
        // Guarded variant checks for live traffic near a historically busy segment.
        const guarded = etaMode === 'eta-guarded' || etaMode === 'eta-guarded-budget';
        const seen = !guarded || liveTrafficNear(prev, dx, dy);
        if (seen) mul /= 1 + Math.min(1.8, (S.heat?.[prev] || 0) * 0.10);
      }
      seconds += d / (speed * mul);
    }
    prev = next;
  }
  return seconds;
}

function liveTrafficNear(tile, dx, dy) {
  const a = tile % S.W, b = (tile / S.W) | 0;
  // Adjacent tile counts are a snapshot of actual moving or blocked vehicles in the game.
  const counts = TRAFFIC.occ;
  if (!counts) return false;
  let seen = 0;
  for (let k = -3; k <= 3; k++) {
    const x = a + Math.sign(dx) * k, y = b + Math.sign(dy) * k;
    if (!inMap(x, y)) continue;
    const i = tIdx(x, y) * 4;
    seen += counts[i] + counts[i + 1] + counts[i + 2] + counts[i + 3];
  }
  return seen >= 2;
}

function crossingEstimate(a, b, distance, waits) {
  const origin = getE(S.bAt[a]), other = getE(S.bAt[b]), vessel = lineFerry(origin, other);
  if (!vessel) return Infinity;
  const speed = BOTS.ferry.speed * batFactor(vessel) * evSpeed();
  const crossing = distance / speed + 1.2;
  if (!waits) return crossing;
  let wait = FERRY_WAIT;
  if (vessel.inside !== origin.id) {
    const dock = vessel.sailTo === other.id ? other : origin;
    wait += dist(vessel.x, vessel.y, dock.x + 0.5, dock.y + 0.5) / speed;
    if (dock === other) wait += crossing;
  }
  const queued = S.bots.filter((v) => !v.dead && v.ferryWait?.at === origin.id && v.ferryWait.to === other.id && !v.ferryWait.ferry);
  const seats = queued.reduce((n, v) => n + seatsFor(v), 0);
  return crossing + wait + Math.floor(seats / FERRY_SEATS) * (2 * crossing + FERRY_WAIT);
}

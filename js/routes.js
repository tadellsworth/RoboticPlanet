'use strict';
/*
 * Terrafall — the Terrain routes view (Shift+R, or the ROUTES tag on the minimap): the ways through the terrain into
 * your base, so a back door round a cliff shows before a rival's army walks through it.
 *
 *  - Ground robots (the default): the ground a ground robot can walk, shaded; cliff edges (orange where one level
 *    could take a Ramp, red where the drop is two levels or more); Ramps, fords, bridges and tunnels marked; and the
 *    narrow gaps (RT_GATE_W tiles or less, with open ground either side) as bright gates. Viaducts, Ropeways, saps and
 *    Mass Driver lines are drawn as links between their two ends.
 *  - Approach routes: from each rival's Command Base, its nearest armed robot and its Mass Driver landings (the
 *    Murmur's nests in a colony), the route its army would march to your Command Base and key buildings, found with
 *    the game's own route search (findPath, with the options a rival's army marches with: earthworks, groves, the
 *    cover of your guns, breaking through walls). Where a route comes into your land with nothing of yours covering
 *    its first RT_DEPTH tiles (a defence in reach, a Wall or Gate it must break, an earthwork, a manned garrison) it is
 *    a back door: a red warning there. Covered only by guns with no ammo: an amber one.
 *  - Aircraft (Spacecraft on a space map): everything open; straight lines from rival Airfields and bases; covered
 *    where a Flak Gun of yours reaches. Ships: open water only; from rival Ports to your shore; covered by a defence
 *    that reaches the landing.
 *
 * Display only: worked out from S and never written to it (hashState is untouched), when the view opens, when the
 * mover changes, and then at most every RT_EVERY seconds while it stays open; the shading and edges are drawn once
 * into a canvas layer (RT.layer) and made again only when the terrain changes. rtAnalyse is plain data, so the
 * headless test (tools/routes-test.js) runs it without a page.
 */

const RT_GATE_W = 3; // a gap this many tiles wide or narrower, open ground either side, is a gate
const RT_DEPTH = 6; // how many tiles into your land a route must meet something of yours, or it is a back door
const RT_GARRISON_R = 5; // a manned garrison covers a route this near it
const RT_EVERY = 3; // seconds between workings-out while the view is open
const RT_MOVERS = ['ground', 'air', 'sea'];

const RT = { on: false, mover: 'ground', data: null, at: -99, calc: -99, sig: '', layer: null, layerKey: '', ms: 0, pick: -1 };

/* ------------------------------------------------------------------ the analysis (plain data, no page) */

/** Is this a space map (The Ring, Orbital platforms, The Graveyard), where the air movers are spacecraft? */
function rtSpace() {
  const sh = S && S.settings && typeof SHAPE_PRESETS !== 'undefined' ? SHAPE_PRESETS[S.settings.shape || 0] : null;
  return !!(sh && (sh.asteroids || sh.orbital || sh.graveyard || sh.vfleet || sh.space));
}

/** Can a ground robot step from tile a to its orthogonal neighbour b (terrain only: buildings aside)? */
function rtStep(a, b) { return b >= 0 && b < S.W * S.H && walkable(b) && canStep(a, b); }

/** How far a defence of yours reaches ground robots (and ships), ammo or not; 0 if it doesn't. dry: it has no ammo now. */
function rtGroundReach(b) {
  if (b.dead || !b.built || b.paused || b.cut) return 0;
  const def = BDEFS[b.type], aura = typeof auraRange === 'function' ? auraRange(b) : 0;
  if (b.type === 'turret' || def.keep) return typeof turretRange === 'function' ? turretRange(b) : def.range;
  if (def.mortar || def.minigun || b.type === 'disruptor') return (def.range || 0) + aura;
  if (def.bunker) return b.garrison && b.garrison.length ? (def.range || 0) + aura : 0;
  return 0;
}
/** How far a defence of yours reaches aircraft: a Flak Gun's range, else 0. */
function rtAirReach(b) { return !b.dead && b.built && !b.paused && !b.cut && b.type === 'flak' ? BDEFS.flak.range : 0; }

/**
 * What covers the ground for player `me`: per tile, 2 a defence with ammo reaches it, 1 only a defence with none,
 * plus 4 where a manned garrison stands near. `air`: Flak Guns only.
 */
function rtCoverMap(me, air) {
  const W = S.W, H = S.H, m = new Uint8Array(W * H);
  const disc = (cx, cy, R, v) => {
    const R2 = R * R;
    for (let j = Math.max(0, Math.floor(cy - R)); j <= Math.min(H - 1, Math.floor(cy + R)); j++)
      for (let i = Math.max(0, Math.floor(cx - R)); i <= Math.min(W - 1, Math.floor(cx + R)); i++)
        if (dist2(i + 0.5, j + 0.5, cx, cy) <= R2) { const t = j * W + i; if ((m[t] & 3) < v) m[t] = (m[t] & 4) | v; }
  };
  for (const b of S.buildings) {
    if (b.dead || b.owner !== me) continue;
    const r = air ? rtAirReach(b) : rtGroundReach(b);
    if (r > 0) {
      const live = air ? (b.shells || 0) + ((b.stock && b.stock.ammo) || 0) > 0 : typeof gunReach === 'function' ? gunReach(b) > 0 : true;
      disc(b.x + 0.5, b.y + 0.5, r, live ? 2 : 1);
    }
    // (a manned garrison out at the edge: not the Command Base's own, the last line rather than the door)
    if (!air && b.built && b.type !== 'lander' && BDEFS[b.type].mil && !BDEFS[b.type].bunker && b.garrison && b.garrison.length) {
      const R2 = RT_GARRISON_R * RT_GARRISON_R;
      for (let j = Math.max(0, b.y - RT_GARRISON_R); j <= Math.min(H - 1, b.y + RT_GARRISON_R); j++)
        for (let i = Math.max(0, b.x - RT_GARRISON_R); i <= Math.min(W - 1, b.x + RT_GARRISON_R); i++)
          if (dist2(i, j, b.x, b.y) <= R2) m[j * W + i] |= 4;
    }
  }
  return m;
}

/** The players whose robots come for player me's base: its rivals still in, or the Murmur when there are none. */
function rtFoes(me) {
  const out = [];
  for (const P of S.players) if (P.id !== me && foes(P.id, me) && !P.out && !P.absent && !isWild(P.id)) out.push(P.id);
  return out;
}

/**
 * Where the routes start, for the mover: [{ x, y, p, kind, label }]. Ground: each rival's Command Base, its armed
 * robot nearest your base (when well clear of the base) and its Mass Driver landings (Catchers, far Drivers); the Murmur's nests if there's
 * no rival. Air: rival Airfields and bases. Sea: rival Ports.
 */
function rtOrigins(me, mover, home) {
  const out = [], fs = rtFoes(me);
  const add = (x, y, p, kind, label) => { if (!out.some((o) => dist2(o.x, o.y, x, y) < 64)) out.push({ x, y, p, kind, label }); };
  for (const p of fs) {
    const L = getE(S.players[p].lander);
    if (mover === 'sea') { for (const b of S.buildings) if (!b.dead && b.built && b.owner === p && BDEFS[b.type].port) add(b.x, b.y, p, 'port', 'Port'); continue; }
    if (mover === 'air') { for (const b of S.buildings) if (!b.dead && b.built && b.owner === p && BDEFS[b.type].airfield) add(b.x, b.y, p, 'airfield', 'Airfield'); }
    if (L && !L.dead && L.owner === p) add(L.x, L.y, p, 'base', 'Command Base');
    if (mover !== 'ground') continue;
    for (const b of S.buildings) if (!b.dead && b.built && b.owner === p && (BDEFS[b.type].catcher || (BDEFS[b.type].mdriver && b.mdFar))) add(b.x, b.y, p, 'catcher', 'Mass Driver landing'); // (its Catchers and far Drivers)
    let best = null, bd = Infinity;
    for (const u of S.bots) {
      if (u.dead || u.owner !== p || u.inside || !isArmy(u) || BOTS[u.type].air || BOTS[u.type].sea || !botArmed(u)) continue;
      const d = dist2(u.x, u.y, home.x, home.y);
      if (d < bd) { bd = d; best = u; }
    }
    if (best) add(Math.floor(best.x), Math.floor(best.y), p, 'army', 'Nearest warbot');
  }
  if (!fs.length && mover === 'ground' && S.wildlife) {
    const wo = wildOwner(), nests = S.buildings.filter((b) => !b.dead && b.owner === wo && BDEFS[b.type].wild)
      .sort((a, b) => dist2(a.x, a.y, home.x, home.y) - dist2(b.x, b.y, home.x, home.y));
    for (const b of nests.slice(0, 3)) add(b.x, b.y, wo, 'nest', 'Murmur nest');
  }
  return out;
}

/** Your Command Base and key buildings (a Bot Foundry, a Keep, megastructures): the routes' ends, at most 3. */
function rtTargets(me) {
  const L = getE(S.players[me] && S.players[me].lander), out = [];
  if (L && !L.dead && L.owner === me) out.push({ x: L.x, y: L.y, b: L, label: 'Command Base' });
  const rank = (b) => (BDEFS[b.type].mega ? 3 : b.type === 'keep' ? 2 : b.type === 'foundry' ? 1 : 0);
  const keys = S.buildings.filter((b) => !b.dead && b.built && b.owner === me && rank(b) > 0 && (!L || dist2(b.x, b.y, L.x, L.y) > 16))
    .sort((a, b) => rank(b) - rank(a) || a.id - b.id);
  for (const b of keys) { if (out.length >= 3) break; if (!out.some((o) => dist2(o.x, o.y, b.x, b.y) < 36)) out.push({ x: b.x, y: b.y, b, label: BDEFS[b.type].name }); }
  return out;
}

/** The options a rival's army marches with (as routeOpts does for an armed warbot on the march). */
function rtOpts(p) {
  const P = S.players[p], o = { who: p, breach: true, offMul: typeof WARBOT_OFFROAD !== 'undefined' ? WARBOT_OFFROAD : 1 };
  // (your guns' cover as the march sees it: the danger map as the game last worked it out; never worked out from here)
  if (typeof DANGER !== 'undefined' && DANGER.s === S && DANGER.maps && DANGER.maps[p]) o.coverMap = DANGER.maps[p];
  if (P && P.ai && S.rads && S.rads.length) o.rad = true;
  if (S.ewK) o.ew = 3;
  if (S.grove && P && P.ai) o.grove = p;
  if (isWild(p)) { o.breach = false; delete o.grove; }
  return o;
}

/** A water route for ships from Port tile (x, y) to the nearest water beside player me's land, or null. */
function rtSeaRoute(x, y, me) {
  const W = S.W, H = S.H, N = W * H, net = seaNet();
  const starts = portDocks(x, y).filter((t) => net.size[net.comp[t]] >= SEA_MIN);
  if (!starts.length) return null;
  const comp = net.comp[starts[0]];
  const goal = new Uint8Array(N);
  let any = false;
  for (let t = 0; t < N; t++) {
    if (net.comp[t] !== comp) continue;
    const i = t % W;
    for (const u of [i > 0 ? t - 1 : -1, i < W - 1 ? t + 1 : -1, t - W, t + W]) if (u >= 0 && u < N && S.terrain[u] !== T_WATER && S.owner[u] === me) { goal[t] = 1; any = true; break; }
  }
  if (!any) return null;
  const cost = new Float64Array(N).fill(Infinity), from = new Int32Array(N).fill(-1), done = new Uint8Array(N), heap = new MinHeap();
  for (const s of starts) { cost[s] = 0; heap.push(s, 0); }
  let hit = -1;
  while (heap.size) {
    const a = heap.pop();
    if (done[a]) continue;
    done[a] = 1;
    if (goal[a]) { hit = a; break; }
    const ai = a % W, aj = (a / W) | 0;
    for (let dj = -1; dj <= 1; dj++) for (let di = -1; di <= 1; di++) {
      if (!di && !dj) continue;
      const i = ai + di, j = aj + dj;
      if (i < 0 || j < 0 || i >= W || j >= H) continue;
      const b = j * W + i;
      if (S.terrain[b] !== T_WATER || done[b]) continue;
      if (di && dj && (S.terrain[aj * W + i] !== T_WATER || S.terrain[j * W + ai] !== T_WATER)) continue;
      const c = cost[a] + (di && dj ? 1.414 : 1);
      if (c < cost[b]) { cost[b] = c; from[b] = a; heap.push(b, c); }
    }
  }
  if (hit < 0) return null;
  const path = [];
  for (let t = hit; t >= 0; t = from[t]) path.push(t);
  return path.reverse();
}

/** The tiles a straight flight from (x0, y0) to (x1, y1) passes over, in order. */
function rtLine(x0, y0, x1, y1) {
  const out = [], n = Math.max(1, Math.ceil(Math.hypot(x1 - x0, y1 - y0) * 2));
  for (let k = 0; k <= n; k++) {
    const t = tIdx(Math.floor(x0 + 0.5 + ((x1 - x0) * k) / n), Math.floor(y0 + 0.5 + ((y1 - y0) * k) / n));
    if (out[out.length - 1] !== t) out.push(t);
  }
  return out;
}

/**
 * Where route `path` comes into player me's land, and what holds it there: { entry (a tile, or -1 if it never
 * does), state: 'open' (a back door), 'dry' (only guns with no ammo), 'held', why }.
 */
function rtEntry(path, me, cover, mover) {
  let k0 = -1;
  for (let k = 0; k < path.length; k++) if (S.owner[path[k]] === me) { k0 = k; break; }
  if (k0 < 0) return { entry: -1, state: 'held', why: 'never comes into your land' };
  let dry = false;
  for (let k = Math.max(0, k0 - 2); k < Math.min(path.length, k0 + RT_DEPTH); k++) {
    const t = path[k], c = cover[t];
    if ((c & 3) === 2) return { entry: path[k0], state: 'held', why: mover === 'air' ? 'a Flak Gun covers it' : 'a defence covers it' };
    if (c & 4) return { entry: path[k0], state: 'held', why: 'a manned garrison covers it' };
    if ((c & 3) === 1) dry = true;
    if (mover !== 'ground') continue;
    const b = S.bAt[t] ? getE(S.bAt[t]) : null;
    if (b && b.owner === me && BDEFS[b.type].barrier) return { entry: path[k0], state: 'held', why: `your ${BDEFS[b.type].name} stands across it` };
    if (S.ewK && S.ewK[t] && S.ewH[t] && S.ewO[t] - 1 === me) return { entry: path[k0], state: 'held', why: 'your earthwork stands across it' };
  }
  return dry ? { entry: path[k0], state: 'dry', why: 'only guns with no ammo cover it' } : { entry: path[k0], state: 'open', why: 'nothing of yours covers it' };
}

/**
 * The narrow gaps in the ground: runs of RT_GATE_W tiles or fewer between cliffs (or water, rock, the map's edge),
 * with the way on through them and open ground beyond on both sides. [{ t, o: 'h' (the gap runs east-west, the way
 * through north-south) or 'v', a, b (its two ends, tile edges), w }], one a gap (its narrowest tile).
 */
function rtGates() {
  const W = S.W, H = S.H, N = W * H, LIM = 6;
  // Which ways a ground robot can step from each tile (bits: 1 east, 2 west, 4 south, 8 north), asked once.
  const go = new Uint8Array(N);
  for (let t = 0; t < N; t++) {
    if (!walkable(t)) continue;
    const i = t % W;
    if (i < W - 1 && rtStep(t, t + 1)) { go[t] |= 1; go[t + 1] |= 2; }
    if (t + W < N && rtStep(t, t + W)) { go[t] |= 4; go[t + W] |= 8; }
  }
  const DIR = { 1: 1, '-1': 2, [W]: 4, [-W]: 8 };
  // (how far from t ground runs in direction d before it stops: LIM if it runs on further)
  const run = (t, d) => { const bit = DIR[d]; let n = 0; for (let u = t; n < LIM && (go[u] & bit); n++) u += d; return n; };
  const span = (t, o) => (o === 'h' ? [run(t, -1), run(t, 1)] : [run(t, -W), run(t, W)]);
  const mark = new Int8Array(N), wid = new Uint8Array(N);
  for (let t = 0; t < N; t++) {
    if (!go[t] || S.terrain[t] === T_CHASM) continue;
    for (const o of ['h', 'v']) {
      const [l, r] = span(t, o), w = l + r + 1;
      if (w > RT_GATE_W || l >= LIM || r >= LIM) continue;
      // the way through: on along the other axis, both sides, opening out to ground at least two tiles wider
      const along = o === 'h' ? W : 1;
      let ok = true;
      for (const s of [-1, 1]) {
        const d = s * along, bit = DIR[d];
        let u = t, n = 0;
        while (n < 4 && (go[u] & bit)) { u += d; n++; }
        if (n < 2) { ok = false; break; }
        const [l2, r2] = span(u, o);
        if (l2 + r2 + 1 < w + 2) { ok = false; break; }
      }
      if (!ok) continue;
      mark[t] = o === 'h' ? 1 : 2; wid[t] = w;
      break;
    }
  }
  // One gate a gap: the gate tiles joined (8 ways) with the same way through, its narrowest tile (the middle one of a tie).
  const seen = new Uint8Array(N), out = [];
  for (let t = 0; t < N; t++) {
    if (!mark[t] || seen[t]) continue;
    const q = [t], o = mark[t];
    seen[t] = 1;
    for (let h = 0; h < q.length; h++) {
      const a = q[h], ai = a % W, aj = (a / W) | 0;
      for (let dj = -1; dj <= 1; dj++) for (let di = -1; di <= 1; di++) {
        const i = ai + di, j = aj + dj;
        if ((!di && !dj) || i < 0 || j < 0 || i >= W || j >= H) continue;
        const b = j * W + i;
        if (mark[b] === o && !seen[b]) { seen[b] = 1; q.push(b); }
      }
    }
    let best = q[0];
    for (const a of q) if (wid[a] < wid[best]) best = a;
    const ties = q.filter((a) => wid[a] === wid[best]).sort((a, b) => a - b);
    best = ties[(ties.length - 1) >> 1];
    const i = best % W, j = (best / W) | 0, [l, r] = span(best, o === 1 ? 'h' : 'v');
    out.push(o === 1 ? { t: best, o: 'h', a: [i - l, j + 0.5], b: [i + r + 1, j + 0.5], w: wid[best], n: q.length }
      : { t: best, o: 'v', a: [i + 0.5, j - l], b: [i + 0.5, j + r + 1], w: wid[best], n: q.length });
  }
  // A pass up a cliff line: a Ramp (its tiles joined) no more than RT_GATE_W + 1 wide, a gate along it.
  const rs = new Uint8Array(N);
  for (let t = 0; t < N; t++) {
    if (S.ramp[t] !== 1 || rs[t]) continue;
    const q = [t];
    rs[t] = 1;
    for (let h = 0; h < q.length; h++) {
      const a = q[h], ai = a % W;
      for (const b of [ai > 0 ? a - 1 : -1, ai < W - 1 ? a + 1 : -1, a - W, a + W]) if (b >= 0 && b < N && S.ramp[b] === 1 && !rs[b]) { rs[b] = 1; q.push(b); }
    }
    let i0 = W, i1 = -1, j0 = H, j1 = -1;
    for (const a of q) { const i = a % W, j = (a / W) | 0; i0 = Math.min(i0, i); i1 = Math.max(i1, i); j0 = Math.min(j0, j); j1 = Math.max(j1, j); }
    const wide = i1 - i0 + 1, tall = j1 - j0 + 1, w = Math.max(wide, tall);
    if (w > RT_GATE_W + 1) continue;
    const mid = q.slice().sort((a, b) => a - b)[(q.length - 1) >> 1];
    out.push(wide >= tall ? { t: mid, o: 'h', a: [i0, (j0 + j1 + 1) / 2], b: [i1 + 1, (j0 + j1 + 1) / 2], w, n: q.length, ramp: true }
      : { t: mid, o: 'v', a: [(i0 + i1 + 1) / 2, j0], b: [(i0 + i1 + 1) / 2, j1 + 1], w, n: q.length, ramp: true });
  }
  return out;
}

/** rtGates, kept while the terrain stays as it was (rtTerrainKey). */
let _rtGates = { of: null, key: '', list: [] };
function rtGatesKept() {
  const key = rtTerrainKey();
  if (_rtGates.of !== S || _rtGates.key !== key) _rtGates = { of: S, key, list: rtGates() };
  return _rtGates.list;
}

/** The links that carry robots over what the ground can't: Viaducts, Ropeways, saps and Mass Driver lines. [{ a, b, kind, p }] */
function rtLinks() {
  const out = [], seen = new Set();
  for (const b of S.buildings) {
    if (b.dead || !b.built) continue;
    const def = BDEFS[b.type], t = tIdx(b.x, b.y);
    let u = -1, kind = '';
    if (b.type === 'viaduct') { u = viaLink(t); kind = 'viaduct'; }
    else if (b.type === 'ropeway') { u = ropeLink(t); kind = 'ropeway'; }
    else if (def.saphead && typeof sapLink === 'function') { u = sapLink(t, b.owner); kind = 'sap'; }
    else if (def.mdriver && typeof mdTarget === 'function') { const c = mdTarget(b); if (c) u = tIdx(c.x, c.y); kind = 'driver'; }
    if (u < 0) continue;
    const key = Math.min(t, u) + ':' + Math.max(t, u);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ a: [b.x + 0.5, b.y + 0.5], b: [(u % S.W) + 0.5, ((u / S.W) | 0) + 0.5], kind, p: b.owner });
  }
  return out;
}

/**
 * The whole view for player me and a mover ('ground', 'air' or 'sea'): { me, mover, routes, gates, links, home,
 * note }. Each route: { from (an origin), to (a target), path (tiles), entry, state, why }.
 */
function rtAnalyse(me, mover) {
  const L = getE(S.players[me] && S.players[me].lander);
  const home = L && !L.dead ? { x: L.x, y: L.y } : { x: S.W / 2, y: S.H / 2 };
  const origins = rtOrigins(me, mover, home), targets = rtTargets(me), routes = [];
  const cover = rtCoverMap(me, mover === 'air');
  const pairs = [];
  // Every origin to your Command Base; each other key building from the origin nearest it.
  for (const o of origins) if (targets[0]) pairs.push([o, targets[0]]);
  for (const tg of targets.slice(1)) {
    let best = null;
    for (const o of origins) if (!best || dist2(o.x, o.y, tg.x, tg.y) < dist2(best.x, best.y, tg.x, tg.y)) best = o;
    if (best) pairs.push([best, tg]);
  }
  for (const [o, tg] of pairs) {
    let path = null;
    if (mover === 'ground') { const p = findPath(o.x, o.y, tg.x, tg.y, undefined, rtOpts(o.p)); if (p) path = [tIdx(o.x, o.y), ...p]; }
    else if (mover === 'air') path = rtLine(o.x, o.y, tg.x, tg.y);
    else { if (tg !== targets[0]) continue; path = rtSeaRoute(o.x, o.y, me); }
    if (!path || path.length < 2) continue;
    const e = rtEntry(path, me, cover, mover);
    routes.push({ from: o, to: tg, path, entry: e.entry, state: e.state, why: e.why });
  }
  const gates = mover === 'ground' ? rtGatesKept() : [];
  // Gates on a route: the ones that matter most.
  if (gates.length) {
    const onRoute = new Set();
    for (const r of routes) for (const t of r.path) onRoute.add(t);
    for (const g of gates) {
      const [x0, y0] = g.a, [x1, y1] = g.b;
      g.route = false;
      for (let s = 0; s <= 8 && !g.route; s++) { const x = Math.floor(x0 + ((x1 - x0) * s) / 8 - (g.o === 'h' && s === 8 ? 0.01 : 0)), y = Math.floor(y0 + ((y1 - y0) * s) / 8 - (g.o === 'v' && s === 8 ? 0.01 : 0)); if (inMap(x, y) && onRoute.has(tIdx(x, y))) g.route = true; }
    }
  }
  let note = '';
  if (!origins.length) note = mover === 'sea' ? 'No rival Port: nothing reaches you by sea yet.' : mover === 'air' ? 'No rival Airfield or base to fly from.' : 'No rival or nest to march from.';
  else if (!routes.length) note = mover === 'sea' ? 'No sea route reaches your shore.' : 'No route reaches your base: the ground keeps them out.';
  return { of: S, me, mover, routes, gates, links: mover === 'ground' ? rtLinks() : [], home, note };
}

/** The back doors: routes with nothing of yours where they come in (one each entry tile), 'open' then 'dry'. */
function rtBackDoors(data) {
  const seen = new Set(), out = [];
  for (const st of ['open', 'dry']) for (const r of data.routes) if (r.state === st && r.entry >= 0 && !seen.has(r.entry)) { seen.add(r.entry); out.push(r); }
  return out;
}

/* ------------------------------------------------------------------ keeping it up to date (the page) */

/** What the terrain looks like to the shading: changes when the ground, a road, a Ramp or a ford does. */
function rtTerrainKey() {
  const N = S.W * S.H;
  let h = 2166136261 >>> 0;
  for (let t = 0; t < N; t++) {
    const v = S.terrain[t] | (S.elev[t] << 2) | ((S.ramp[t] ? 1 : 0) << 6) | ((S.road[t] ? 1 : 0) << 7) | ((S.ford && S.ford[t] ? 1 : 0) << 8);
    h = Math.imul(h ^ v, 16777619) >>> 0;
  }
  return `${S.W}x${S.H}:${h}`;
}

/**
 * What the routes are worked out from, cheaply: the terrain, the roads, the land, the buildings standing (and which
 * are finished), and roughly where the foes' armed robots are. The same: no need to work them out again.
 */
function rtSig() {
  let b = 0, n = 0;
  for (const e of S.buildings) if (!e.dead) { n++; b = (Math.imul(b, 31) + e.id * (e.built ? 3 : 1) + (e.garrison ? e.garrison.length : 0)) | 0; }
  let u = 0;
  for (const v of S.bots) if (!v.dead && v.owner !== ME && !v.inside && isArmy(v)) u = (Math.imul(u, 31) + ((v.x / 4) | 0) * 977 + ((v.y / 4) | 0)) | 0;
  return [rtTerrainKey(), S.roadVer || 0, S.territoryVer || 0, n, b, u, RT.mover, ME].join(':');
}

/**
 * Work the view out again if it's due: at once when it's new (another game, another mover); else, at most every
 * RT_EVERY seconds, when what it's worked out from has changed (rtSig), and every 5 × RT_EVERY s regardless (your guns'
 * ammo, the cover the march keeps out of).
 */
function rtRefresh(force) {
  if (!S || !S.players || !S.players[ME]) return;
  const d = RT.data, now = R.time;
  const fresh = d && d.of === S && d.mover === RT.mover && d.me === ME;
  if (!force && fresh && now - RT.at < RT_EVERY) return;
  const sig = rtSig();
  RT.at = now;
  if (!force && fresh && sig === RT.sig && now - RT.calc < RT_EVERY * 5) return;
  const t0 = performance.now();
  RT.data = rtAnalyse(ME, RT.mover);
  RT.calc = now; RT.sig = sig;
  const key = rtTerrainKey() + ':' + RT.mover + ':' + [...new Set(RT.data.routes.map((r) => S.zone[r.path[0]]))].sort().join(',');
  if (key !== RT.layerKey || !RT.layer) { rtBakeLayer(); RT.layerKey = key; }
  RT.ms = performance.now() - t0;
  rtCard();
}

/** Turn the view on or off (Shift+R, the ROUTES tag); `mover` picks ground, air or sea while it's on. */
function rtToggle(on, mover) {
  RT.on = on === undefined ? !RT.on : !!on;
  if (mover && RT_MOVERS.includes(mover)) RT.mover = mover;
  RT.pick = -1;
  if (RT.on) rtRefresh(true);
  rtCard();
  rtTag();
  if (typeof sfx === 'function') sfx('click');
}

/* ------------------------------------------------------------------ drawing */

/** The shading, cliff edges, Ramps, fords and crossings, drawn once into a canvas a few pixels a tile. */
function rtBakeLayer() {
  const W = S.W, H = S.H, N = W * H, px = Math.max(4, Math.min(12, Math.floor(2048 / Math.max(W, H))));
  let c = RT.layer;
  if (!c) c = RT.layer = document.createElement('canvas');
  c.width = W * px; c.height = H * px;
  const g = c.getContext('2d'), mv = RT.mover, net = mv === 'sea' ? seaNet() : null;
  g.clearRect(0, 0, c.width, c.height);
  // (which ground the foes can walk to: the areas their routes start in)
  const zs = new Set();
  if (RT.data) for (const r of RT.data.routes) zs.add(S.zone[r.path[0]]);
  for (let t = 0; t < N; t++) {
    const i = t % W, j = (t / W) | 0;
    let col;
    if (mv === 'air') col = S.terrain[t] === T_CHASM ? 'rgba(150,200,255,0.10)' : 'rgba(150,200,255,0.16)';
    else if (mv === 'sea') col = S.terrain[t] === T_WATER && net.size[net.comp[t]] >= SEA_MIN ? 'rgba(80,180,255,0.42)' : 'rgba(8,10,16,0.55)';
    else if (walkable(t) && S.terrain[t] !== T_CHASM) col = zs.size && !zs.has(S.zone[t]) ? 'rgba(160,200,170,0.16)' : 'rgba(110,240,150,0.26)';
    else col = 'rgba(8,10,16,0.55)';
    g.fillStyle = col;
    g.fillRect(i * px, j * px, px, px);
  }
  if (mv !== 'ground') return;
  // Cliff edges: orange one level (a Ramp could join it), red two or more; along the side of the tile.
  const seg = [[], []];
  for (let t = 0; t < N; t++) {
    if (!walkable(t)) continue;
    const i = t % W, j = (t / W) | 0;
    for (const [di, dj] of [[1, 0], [0, 1]]) {
      if (i + di >= W || j + dj >= H) continue;
      const u = t + di + dj * W;
      if (!walkable(u) || canStep(t, u)) continue;
      const k = Math.abs(S.elev[t] - S.elev[u]) >= 2 ? 1 : 0;
      if (di) seg[k].push(i + 1, j, i + 1, j + 1); else seg[k].push(i, j + 1, i + 1, j + 1);
    }
  }
  g.lineCap = 'round';
  for (const [k, col, lw] of [[0, '#ffa04a', 0.16], [1, '#ff4040', 0.26]]) {
    if (!seg[k].length) continue;
    g.strokeStyle = 'rgba(0,0,0,0.6)'; g.lineWidth = px * lw + 2;
    g.beginPath();
    for (let n = 0; n < seg[k].length; n += 4) { g.moveTo(seg[k][n] * px, seg[k][n + 1] * px); g.lineTo(seg[k][n + 2] * px, seg[k][n + 3] * px); }
    g.stroke();
    g.strokeStyle = col; g.lineWidth = px * lw;
    g.stroke();
  }
  // Ramps (stripes), fords (wavy blue), bridges and tunnels (a pale outline).
  for (let t = 0; t < N; t++) {
    const x = (t % W) * px, y = ((t / W) | 0) * px;
    if (S.ramp[t] === 1) {
      g.strokeStyle = 'rgba(120,235,255,0.95)'; g.lineWidth = Math.max(1, px * 0.12);
      g.beginPath();
      for (let s = 1; s <= 3; s++) { g.moveTo(x + px * 0.2, y + (px * s) / 4); g.lineTo(x + px * 0.8, y + (px * s) / 4); }
      g.stroke();
    } else if (S.ford && S.ford[t] === 1 && S.terrain[t] === T_WATER) {
      g.strokeStyle = 'rgba(120,200,255,0.95)'; g.lineWidth = Math.max(1, px * 0.1);
      g.setLineDash([px * 0.15, px * 0.12]);
      g.strokeRect(x + px * 0.18, y + px * 0.18, px * 0.64, px * 0.64);
      g.setLineDash([]);
    } else if (S.road[t] && S.terrain[t] !== T_GROUND) {
      g.strokeStyle = 'rgba(235,240,255,0.85)'; g.lineWidth = Math.max(1, px * 0.1);
      g.strokeRect(x + px * 0.12, y + px * 0.12, px * 0.76, px * 0.76);
    }
  }
}

/** Under the buildings: the shaded ground and its edges, the gates and the links. */
function routesGround(ctx, ox, oy, z) {
  if (!RT.on || typeof UI === 'undefined' || !UI.inGame) return;
  rtRefresh(false);
  const d = RT.data;
  if (!d || d.of !== S) return;
  if (RT.layer) {
    const sm = ctx.imageSmoothingEnabled;
    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(RT.layer, ox, oy, S.W * z, S.H * z);
    ctx.imageSmoothingEnabled = sm;
  }
  const pulse = LESS_MOTION && LESS_MOTION.matches ? 0.75 : 0.6 + 0.4 * Math.sin(R.time * 4);
  // Gates: a bright bar across the gap with a post at each end; brighter on a route.
  for (const g of d.gates) {
    const x0 = ox + g.a[0] * z, y0 = oy + g.a[1] * z, x1 = ox + g.b[0] * z, y1 = oy + g.b[1] * z;
    ctx.lineCap = 'round';
    ctx.strokeStyle = 'rgba(0,0,0,0.55)'; ctx.lineWidth = Math.max(4, z * (g.route ? 0.3 : 0.2));
    ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.stroke();
    ctx.strokeStyle = g.route ? `rgba(255,230,80,${0.7 + 0.3 * pulse})` : 'rgba(255,225,110,0.6)';
    ctx.lineWidth = Math.max(2, z * (g.route ? 0.18 : 0.1));
    ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.stroke();
    ctx.fillStyle = g.route ? '#fff3a0' : 'rgba(255,240,170,0.8)';
    for (const [x, y] of [[x0, y0], [x1, y1]]) { ctx.beginPath(); ctx.arc(x, y, Math.max(2.5, z * 0.13), 0, Math.PI * 2); ctx.fill(); }
    if (g.route && z >= 16) rtTag2(ctx, (x0 + x1) / 2, (y0 + y1) / 2 - z * 0.45, `${g.ramp ? 'Ramp' : 'Gap'} ${g.w} wide`, '#ffe14d');
  }
  // Links over what the ground can't cross: dashed, in the owner's colour.
  for (const l of d.links) {
    const ax = ox + l.a[0] * z, ay = oy + l.a[1] * z, bx = ox + l.b[0] * z, by = oy + l.b[1] * z, lift = l.kind === 'driver' ? Math.hypot(bx - ax, by - ay) * 0.3 : l.kind === 'ropeway' ? z * 0.8 : 0;
    ctx.strokeStyle = PLAYER_COLORS[l.p] || '#dfe6f0'; ctx.lineWidth = Math.max(1.5, z * 0.06);
    ctx.setLineDash(l.kind === 'sap' ? [z * 0.08, z * 0.16] : [z * 0.25, z * 0.15]);
    ctx.beginPath(); ctx.moveTo(ax, ay); ctx.quadraticCurveTo((ax + bx) / 2, (ay + by) / 2 - lift, bx, by); ctx.stroke();
    ctx.setLineDash(NO_DASH);
  }
}

/** A small dark label with coloured text. */
function rtTag2(ctx, x, y, text, col) {
  ctx.font = '600 11px system-ui, sans-serif';
  const w = ctx.measureText(text).width + 8;
  ctx.fillStyle = 'rgba(10,12,18,0.82)';
  ctx.fillRect(x - w / 2, y - 8, w, 16);
  ctx.fillStyle = col; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText(text, x, y + 0.5);
  ctx.textAlign = 'start'; ctx.textBaseline = 'alphabetic';
}

/** Over the buildings: the approach routes, flowing toward your base, and their warnings where they come in. */
function routesOver(ctx, ox, oy, z) {
  if (!RT.on || typeof UI === 'undefined' || !UI.inGame) return;
  const d = RT.data;
  if (!d || d.of !== S) return;
  const W = S.W, flow = LESS_MOTION && LESS_MOTION.matches ? 0 : R.time;
  const pt = (t) => [ox + ((t % W) + 0.5) * z, oy + (((t / W) | 0) + 0.5) * z];
  ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  for (const r of d.routes) {
    const col = PLAYER_COLORS[r.from.p] || '#c69cff', lw = Math.max(2, z * 0.09);
    ctx.beginPath();
    r.path.forEach((t, k) => { const [x, y] = pt(t); if (k) ctx.lineTo(x, y); else ctx.moveTo(x, y); });
    ctx.strokeStyle = 'rgba(0,0,0,0.6)'; ctx.lineWidth = lw + 3; ctx.setLineDash(NO_DASH); ctx.stroke();
    ctx.strokeStyle = col; ctx.lineWidth = lw; ctx.setLineDash([z * 0.35, z * 0.2]); ctx.lineDashOffset = -flow * z * 1.2; ctx.stroke();
    ctx.setLineDash(NO_DASH); ctx.lineDashOffset = 0;
    // its start: a ring in the foe's colour
    const [sx, sy] = pt(r.path[0]);
    ctx.strokeStyle = col; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(sx, sy, Math.max(5, z * 0.4), 0, Math.PI * 2); ctx.stroke();
    if (z >= 16) rtTag2(ctx, sx, sy - z * 0.75, r.from.label, col);
  }
  // The entries: red (a back door), amber (guns with no ammo), a small green check (held).
  const done = new Set(), pulse = LESS_MOTION && LESS_MOTION.matches ? 1 : 0.5 + 0.5 * Math.sin(R.time * 5);
  const order = { open: 0, dry: 1, held: 2 };
  for (const r of [...d.routes].sort((a, b) => order[a.state] - order[b.state])) {
    if (r.entry < 0 || done.has(r.entry)) continue;
    done.add(r.entry);
    const [x, y] = pt(r.entry), s = Math.max(9, z * 0.55);
    if (r.state === 'held') {
      ctx.fillStyle = 'rgba(10,30,18,0.85)'; ctx.strokeStyle = '#7ee08a'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(x, y, s * 0.55, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(x - s * 0.25, y); ctx.lineTo(x - s * 0.05, y + s * 0.2); ctx.lineTo(x + s * 0.28, y - s * 0.22); ctx.stroke();
      continue;
    }
    const col = r.state === 'open' ? '#ff4b4b' : '#ffb13d';
    ctx.strokeStyle = col; ctx.globalAlpha = 0.35 + 0.4 * pulse; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.arc(x, y, s * (1.1 + 0.25 * pulse), 0, Math.PI * 2); ctx.stroke();
    ctx.globalAlpha = 1;
    ctx.fillStyle = col; ctx.strokeStyle = '#1a0b0b'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(x, y - s); ctx.lineTo(x + s * 0.9, y + s * 0.65); ctx.lineTo(x - s * 0.9, y + s * 0.65); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#1a0b0b'; ctx.font = `800 ${Math.round(s * 1.05)}px system-ui, sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText('!', x, y + s * 0.12);
    ctx.textAlign = 'start'; ctx.textBaseline = 'alphabetic';
    if (z >= 12) rtTag2(ctx, x, y + s * 1.35, r.state === 'open' ? 'Back door: unguarded' : 'Guns out of ammo', col);
  }
}

/* ------------------------------------------------------------------ the card and the minimap tag (the page) */

/** The ROUTES tag at the minimap's foot: lit while the view is on; a tap toggles it. */
function rtTag() {
  const el = typeof document !== 'undefined' && document.getElementById('mm-routes');
  if (!el) return;
  el.classList.toggle('on', RT.on);
  el.setAttribute('aria-pressed', RT.on ? 'true' : 'false');
  if (!el.onclick) el.onclick = (e) => { e.stopPropagation(); rtToggle(); };
}

/**
 * The card while the view is on: the mover switch (Ground, Aircraft or Spacecraft, Ships), the key, and how many
 * routes come in and how many by a back door, with Show (the next back door, again for the one after).
 */
function rtCard() {
  if (typeof document === 'undefined') return;
  let el = document.getElementById('rt-card');
  const show = RT.on && typeof UI !== 'undefined' && UI.inGame;
  if (!el) {
    if (!show) return;
    el = document.createElement('div');
    el.id = 'rt-card'; el.className = 'rt-card'; el.setAttribute('role', 'region'); el.setAttribute('aria-label', 'Terrain routes');
    document.body.appendChild(el);
    el.addEventListener('click', (e) => {
      const b = e.target.closest('button');
      if (!b) return;
      e.stopPropagation();
      if (b.dataset.mv) { RT.mover = b.dataset.mv; RT.pick = -1; rtRefresh(true); if (typeof sfx === 'function') sfx('click'); }
      else if (b.dataset.act === 'close') rtToggle(false);
      else if (b.dataset.act === 'show') rtShowNext();
    });
  }
  el.hidden = !show;
  if (!show) return;
  const d = RT.data, air = rtSpace() ? 'Spacecraft' : 'Aircraft';
  const seg = RT_MOVERS.map((m) => `<button type="button" data-mv="${m}" class="${RT.mover === m ? 'on' : ''}" aria-pressed="${RT.mover === m}">${{ ground: 'Ground', air, sea: 'Ships' }[m]}</button>`).join('');
  const key = RT.mover === 'ground'
    ? '<i class="rk walk"></i>walkable <i class="rk cliff"></i>cliff <i class="rk drop"></i>drop <i class="rk ramp"></i>ramp <i class="rk gate"></i>narrow gap'
    : RT.mover === 'air' ? `<i class="rk air"></i>all open: ${air.toLowerCase()} fly over everything; only a Flak Gun covers the way in`
      : '<i class="rk sea"></i>open water: ships sail it, and land where it meets your shore';
  let line = '';
  if (d && d.of === S && d.mover === RT.mover) {
    const doors = rtBackDoors(d), open = doors.filter((r) => r.state === 'open').length, dry = doors.length - open;
    line = d.note ? esc(d.note) : `${d.routes.length} approach route${d.routes.length === 1 ? '' : 's'}: ` +
      (doors.length ? `<b class="rt-bad">${open ? `${open} back door${open === 1 ? '' : 's'} unguarded` : ''}${open && dry ? ', ' : ''}${dry ? `${dry} covered by guns with no ammo` : ''}</b>` : '<b class="rt-ok">every way in is covered</b>') + '.';
    if (RT.mover === 'ground' && d.gates.length) line += ` ${d.gates.filter((g) => g.route).length} of ${d.gates.length} narrow gaps lie on a route.`;
    if (doors.length) line += ' <button type="button" class="btn small" data-act="show">Show</button>';
  }
  const html = `<div class="rt-head"><b>Terrain routes</b><span class="seg rt-seg">${seg}</span><button type="button" class="rt-x" data-act="close" aria-label="Close Terrain routes" title="Close (Shift+R)">×</button></div>` +
    `<div class="rt-key">${key}; <i class="rk route"></i>approach route <i class="rk door"></i>back door</div><div class="rt-line">${line}</div>`;
  if (el.dataset.html !== html) { el.dataset.html = html; el.innerHTML = html; }
}

/** Show: the camera to the next back door (and says why it is one). */
function rtShowNext() {
  const d = RT.data;
  if (!d) return;
  const doors = rtBackDoors(d);
  if (!doors.length) return;
  RT.pick = (RT.pick + 1) % doors.length;
  const r = doors[RT.pick];
  centerOn((r.entry % S.W) + 0.5, ((r.entry / S.W) | 0) + 0.5);
  if (typeof sfx === 'function') sfx('click');
  if (typeof toast === 'function') toast(`Back door ${RT.pick + 1} of ${doors.length}: the way in from the ${r.from.label.toLowerCase()} to your ${r.to.label}. ${r.why[0].toUpperCase() + r.why.slice(1)}: a Pulse Turret, a Wall across it or a manned Outpost here closes it.`, 'warn');
}

/** Once a second: the tag and the card follow the game (hidden off the map, in Observer mode, at the end). */
function rtWatch() {
  const el = document.getElementById('mm-routes');
  const can = typeof UI !== 'undefined' && UI.inGame && !UI.watch && S && S.players && !!S.players[ME];
  if (el) el.hidden = !can;
  if (!can && RT.on) { RT.on = false; RT.data = null; }
  rtTag();
  rtCard();
}

if (typeof document !== 'undefined' && typeof setInterval === 'function') setInterval(rtWatch, 1000);

#!/usr/bin/env node
// The Terrain routes view (js/routes.js, Shift+R), headless: on seeded maps the approach routes are found with the
// game's own route search, a known chokepoint shows as a gate, an entry into your land with nothing covering it is a
// back door, and a Pulse Turret, a Wall or a Flak Gun covering it clears the warning. Nothing in the game changes
// (hashState), and it is timed on a Huge map. Run: node tools/routes-test.js
'use strict';
const fs = require('fs'), path = require('path'), vm = require('vm');
const root = path.join(__dirname, '..');
const files = ['util.js', 'defs.js', 'world.js', 'path.js', 'sim.js', 'ai.js', 'missions.js', 'orders.js', 'routes.js'];
const ctx = { console, Math, JSON, Map, Set, Array, Object, Number, String, Infinity, Uint8Array, Int8Array, Int32Array, Uint32Array, Float32Array, Float64Array };
ctx.sfx = () => {};
vm.createContext(ctx);
vm.runInContext(files.map((f) => fs.readFileSync(path.join(root, 'js', f), 'utf8')).join('\n') +
  '\n;globalThis.__ = { newGame, getS: () => S, rtAnalyse, rtGates, rtEntry, rtCoverMap, rtBackDoors, addBuilding, computeTerritory, computeZones, hashState, walkable, canStep, tIdx, getE, SHAPE_PRESETS, T_GROUND, T_ROCK };', ctx);
const A = ctx.__;
let fails = 0;
const check = (name, ok, info) => { if (!ok) fails++; console.log((ok ? 'PASS ' : 'FAIL ') + name + (ok || info === undefined ? '' : '  ' + JSON.stringify(info))); };
const shape = (name) => A.SHAPE_PRESETS.findIndex((p) => p.name === name);
const xy = (S, t) => [t % S.W, (t / S.W) | 0];
// A free tile of player 0's within r tiles of tile t, for a building.
const freeNear = (S, t, r, ok = () => true) => {
  const [x, y] = xy(S, t);
  let best = -1, bd = Infinity;
  for (let j = y - r; j <= y + r; j++) for (let i = x - r; i <= x + r; i++) {
    if (i < 0 || j < 0 || i >= S.W || j >= S.H) continue;
    const u = j * S.W + i, d = (i - x) * (i - x) + (j - y) * (j - y);
    if (S.terrain[u] !== A.T_GROUND || S.bAt[u] || S.road[u] || S.res[u] || S.owner[u] !== 0 || !ok(u) || d >= bd) continue;
    best = u; bd = d;
  }
  return best;
};

// 1. Approach routes on a cliffy map (Plateaus, Huge): found, from the rival's base to your Command Base, step by step.
A.newGame({ seed: 5, difficulty: 'normal', mode: 'versus', size: 3, shape: shape('Plateaus') });
let S = A.getS();
const h0 = A.hashState();
let t0 = Date.now();
let d;
for (let k = 0; k < 5; k++) d = A.rtAnalyse(0, 'ground');
const ms = (Date.now() - t0) / 5;
const L = A.getE(S.players[0].lander), E = A.getE(S.players[1].lander);
check('Plateaus (Huge): an approach route is found', d.routes.length >= 1, d.note);
const r0 = d.routes[0];
check('it runs from the rival\'s Command Base to yours', r0 && r0.from.kind === 'base' && r0.path[0] === A.tIdx(E.x, E.y) && r0.path[r0.path.length - 1] === A.tIdx(L.x, L.y));
const stepsOk = r0 && r0.path.every((t, k) => {
  if (!k) return true;
  const [a, b] = xy(S, r0.path[k - 1]), [c, e] = xy(S, t);
  return Math.max(Math.abs(a - c), Math.abs(b - e)) <= 1 && A.walkable(t);
});
check('the route is a walk, tile by tile, on walkable ground', stepsOk);
check('it climbs the plateaus by a Ramp (no step up a cliff)', r0 && r0.path.every((t, k) => !k || Math.abs(S.elev[t] - S.elev[r0.path[k - 1]]) <= 1) && r0.path.some((t) => S.ramp[t] === 1));
check('the Ramps it takes show as gates on the route', d.gates.some((g) => g.route && g.ramp), d.gates.filter((g) => g.route).length);
check('nothing in the game changed (hashState)', A.hashState() === h0);
console.log(`     (Huge ${S.W}x${S.H}: ${ms.toFixed(1)} ms a working-out here, headless)`);

// 2. An uncovered entry is a back door; a Pulse Turret in reach of it clears the warning.
const door = r0 && A.rtBackDoors(d)[0];
check('the way into your land, with nothing covering it, is flagged a back door', !!door && door.state === 'open' && S.owner[door.entry] === 0, door && door.why);
if (door) {
  const spot = freeNear(S, door.entry, 3);
  const tur = A.addBuilding(0, 'turret', ...xy(S, spot), true);
  tur.shots = 4;
  const d2 = A.rtAnalyse(0, 'ground');
  const same = d2.routes.find((r) => r.entry === door.entry);
  check('a Pulse Turret covering it clears the warning', A.rtBackDoors(d2).length === 0 && (!same || same.state === 'held'), A.rtBackDoors(d2).map((r) => r.why));
  tur.shots = 0; tur.stock.crystal = 0;
  const d3 = A.rtAnalyse(0, 'ground');
  check('...and with no ammo it is an amber warning (guns with no ammo)', d3.routes.some((r) => r.state === 'dry'), d3.routes.map((r) => r.state));
  tur.dead = true; S.bAt[spot] = 0;
}

// 3. A Wall across the way in holds it too.
A.newGame({ seed: 5, difficulty: 'normal', mode: 'versus', size: 3, shape: shape('Plateaus') });
S = A.getS();
{
  const d4 = A.rtAnalyse(0, 'ground'), r = d4.routes[0];
  const k0 = r.path.indexOf(r.entry), t = r.path.slice(k0, k0 + 4).find((u) => !S.bAt[u] && !S.road[u] && S.terrain[u] === A.T_GROUND);
  A.addBuilding(0, 'wall', ...xy(S, t), true);
  const cover = A.rtCoverMap(0, false), e = A.rtEntry(r.path, 0, cover, 'ground');
  check('a route through your Wall where it comes in is held', e.state === 'held' && /Wall/.test(e.why), e);
  const d5 = A.rtAnalyse(0, 'ground');
  check('the march, worked out again, breaks through the Wall or finds another way (still found)', d5.routes.length >= 1);
}

// 4. A known chokepoint: flat ground with a rock wall across it and a gap two tiles wide: a gate there, 2 wide.
A.newGame({ seed: 9, difficulty: 'normal', mode: 'versus', size: 1, rough: 0, shape: 0 });
S = A.getS();
{
  const cx = S.W >> 1, cy = S.H >> 1;
  for (let j = cy - 7; j <= cy + 7; j++) for (let i = cx - 9; i <= cx + 9; i++) { const t = A.tIdx(i, j); S.terrain[t] = A.T_GROUND; S.elev[t] = 1; S.ramp[t] = 0; S.road[t] = 0; S.bAt[t] = 0; S.res[t] = 0; if (S.ford) S.ford[t] = 0; }
  for (let i = cx - 9; i <= cx + 9; i++) if (i !== cx && i !== cx + 1) S.terrain[A.tIdx(i, cy)] = A.T_ROCK;
  A.computeZones();
  const gates = A.rtGates(), g = gates.find((q) => q.o === 'h' && Math.abs(q.a[1] - (cy + 0.5)) < 0.01 && q.a[0] === cx && q.b[0] === cx + 2);
  check('a gap two tiles wide in a wall of rock is found as a gate across it', !!g && g.w === 2, gates.filter((q) => Math.abs(q.a[1] - cy - 0.5) < 2));
  check('open ground is no gate', !gates.some((q) => Math.abs(q.a[1] - (cy - 4.5)) < 0.01 && q.a[0] >= cx - 6 && q.b[0] <= cx + 6));
}
// ...and the pass on a Chokepoint map is found on the route.
A.newGame({ seed: 3, difficulty: 'normal', mode: 'versus', size: 1, shape: shape('Chokepoint') });
S = A.getS();
{
  const d6 = A.rtAnalyse(0, 'ground');
  check('Chokepoint: the route through the crags meets a narrow gap', d6.routes.length >= 1 && d6.gates.some((g) => g.route), d6.gates.length);
}

// 5. Aircraft: everything open, a straight line; a Flak Gun in reach of the way in covers it.
A.newGame({ seed: 5, difficulty: 'normal', mode: 'versus', size: 3, shape: shape('Plateaus') });
S = A.getS();
{
  const da = A.rtAnalyse(0, 'air'), ra = da.routes[0];
  check('Aircraft: a straight route from the rival\'s base, flagged where it comes in', !!ra && ra.state === 'open' && S.owner[ra.entry] === 0);
  if (ra) {
    const f = A.addBuilding(0, 'flak', ...xy(S, freeNear(S, ra.entry, 3)), true);
    f.stock.ammo = 4;
    const db = A.rtAnalyse(0, 'air');
    check('a Flak Gun covering it clears the warning', db.routes.every((r) => r.state === 'held'), db.routes.map((r) => r.why));
  }
  const ds = A.rtAnalyse(0, 'sea');
  check('Ships: no rival Port, no sea route (and it says so)', ds.routes.length === 0 && /Port/.test(ds.note));
}

console.log(fails ? fails + ' FAILED' : 'ALL PASSED');
process.exit(fails ? 1 : 0);

// The long-haul freight comparison (docs/economy-audit-nov26.md): one far store D tiles from home over open land, kept
// asking for Cement (a deep supply order, emptied every second so it never fills), served five ways in turn:
// a Mass Driver line, a Maglev line with 4 pods, rail with Rail Stations and Freight Trains, a road with Freight Trucks,
// and a road with Road Trains. Prints, for each, what it cost, how long it took to stand up (its sites built by a
// Worker, track and pylons laid), and the goods a minute delivered over 10 minutes once it runs.
// node tools/freight-compare.js [distance=40] [vehicles=4] [minutes=10]
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const D = +(process.argv[2] || 40), NV = +(process.argv[3] || 4), MIN = +(process.argv[4] || 10);
const files = ['util', 'defs', 'world', 'path', 'sim', 'ai', 'missions', 'orders'];
const source = files.map((f) => fs.readFileSync(path.join(__dirname, '..', 'js', f + '.js'), 'utf8')).join('\n');
const mk = () => {
  const c = { console, Math, JSON, Map, Set, Array, Object, Number, String, Infinity, Uint8Array, Int8Array, Int32Array, Uint32Array, Float32Array, Uint16Array, sfx: () => {} };
  vm.createContext(c);
  vm.runInContext(source, c);
  return c;
};
const run = (c, code) => vm.runInContext(`(() => { ${code} })()`, c);

const SETUP = `
  newGame({ seed: 5, mode: 'colony', size: 3, rough: 0, shape: SHAPE_PRESETS.findIndex((s) => s.name === 'Long haul') });
  const L = getE(S.players[0].lander), hz = S.zone[tIdx(L.x, L.y)];
  for (const g of ['cement', 'alloy', 'chip', 'fuel', 'stone', 'fiber', 'asphalt']) bump(L.stock, g, 3000);
  const free = (t) => S.terrain[t] === T_GROUND && !S.bAt[t] && !S.res[t] && !S.road[t] && !S.ramp[t] && !S.rail[t] && S.zone[t] === hz && !(S.owner[t] >= 0 && S.owner[t] !== 0);
  const spot = (cx, cy, rmin, rmax, ok) => { let best = null, bd = 1e9; for (let j = 2; j < S.H - 2; j++) for (let i = 2; i < S.W - 2; i++) { const d = dist(i, j, cx, cy); if (d < rmin || d > rmax || !free(tIdx(i, j)) || (ok && !ok(i, j))) continue; if (d < bd) { bd = d; best = [i, j]; } } return best; };
  const gen = (x, y) => { const g = spot(x, y, 1.5, 3.5); const G = addBuilding(0, 'generator', g[0], g[1], true); bump(G.stock, 'fuel', 400); return G; };
  const step = (secs, each) => { for (let k = 0; k < Math.round(secs / SIM_STEP); k++) { simStep(SIM_STEP); if (each && k % 30 === 0) each(); } };
  const roadTo = (b) => { for (const t of roadRouteTo(0, b) || []) setRoad(t % S.W, (t / S.W) | 0, true, 0); };
  // The far spot: ${D} tiles from home, out along the planet's long axis.
  const far = spot(L.x, L.y + ${D} * (L.y < S.H / 2 ? 1 : -1), 0, 6, (i, j) => free(tIdx(i + 1, j)) && free(tIdx(i, j + 1)));
  const cost = (o) => Object.fromEntries(Object.entries(o).filter(([, v]) => v > 0).map(([k, v]) => [k, Math.round(v)]));
  const add = (a, b, n = 1) => { for (const g in b) a[g] = (a[g] || 0) + b[g] * n; return a; };
  // Empty the far store of Cement every second, counting it.
  let got = 0;
  // The home end is kept stocked (64 Cement) so the line, not the Haulers feeding it, sets the pace (a road's vehicles load at the Command Base).
  const drain = (B, H) => () => { const n = Math.floor(B.stock.cement || 0); if (n > 0) { got += n; bump(B.stock, 'cement', -n); } if (H && (H.stock.cement || 0) < 64) bump(H.stock, 'cement', 64 - (H.stock.cement || 0)); };
  const fuelUsed = () => S.buildings.reduce((n, b) => n + (b.type === 'generator' && !b.dead ? 400 - (b.stock.fuel || 0) : 0), 0);
  let fuel = 0, vfuel = 0;
  // (the vehicles' own Fuel: what their tanks took, counted where refuel and the trains' tanks spend it)
  const vehFuel = () => S.vehFuel || 0;
  const refuel0 = refuel; globalThis.refuel = function (u, b) { const r = refuel0(u, b); if (r && BOTS[u.type].haul) S.vehFuel = (S.vehFuel || 0) + 1; return r; };
  const measure = (B, H) => { got = 0; const t0 = S.time, f0 = fuelUsed(); for (const b of S.buildings) if (b.type === 'generator') { const n = 400 - (b.stock.fuel || 0); if (n > 0) bump(b.stock, 'fuel', n); } const g0 = fuelUsed(), u0 = vehFuel(); step(${MIN} * 60, drain(B, H)); const m = (S.time - t0) / 60; fuel = +((fuelUsed() - g0) / m).toFixed(1); vfuel = +((vehFuel() - u0) / m).toFixed(1); void f0; return Math.round(got / m); };
  // Warm up: until the first delivery, at most 5 minutes.
  const warm = (B, H) => { const t0 = S.time; got = 0; for (let k = 0; k < 300 && !got; k++) step(1, drain(B, H)); return Math.round(S.time - t0); };
  Object.assign(globalThis, { L, hz, free, spot, gen, step, roadTo, far, cost, add, measure, warm });
`;

const out = {};
// ---- Mass Driver line: a Driver by home, its Catcher at the far spot, a Generator at each end
{
  const c = mk();
  out.massdriver = JSON.parse(run(c, SETUP + `
    const d = spot(L.x, L.y, 3, 7, (i, j) => free(tIdx(i + 1, j)));
    const Dv = addBuilding(0, 'mdriver', d[0], d[1], true); roadTo(Dv); gen(Dv.x, Dv.y);
    const C = addBuilding(0, 'catcher', far[0], far[1], true); gen(C.x, C.y);
    computeTerritory(); computeZones();
    applyOrder(0, 'mdAim', [Dv.id, C.id]);
    C.keep = { cement: 2000 };
    const lineCost = add(add({}, BDEFS.mdriver.cost), BDEFS.catcher.cost);
    const first = warm(C, Dv), rate = measure(C, Dv);
    return JSON.stringify({ d: Math.round(dist(Dv.x, Dv.y, C.x, C.y)), cost: cost(lineCost), build: BDEFS.mdriver.buildTime + BDEFS.catcher.buildTime, first, rate, fuel, vfuel, every: mdReload(Dv, C) });
  `));
}
// ---- the same Mass Driver line across the sea (Islands: the Catcher on another island ${D} or so tiles off, nothing
// but water between), where no road, rail or Maglev line reaches
{
  const c = mk();
  out.massdriverSea = JSON.parse(run(c, SETUP.replace("rough: 0, shape: SHAPE_PRESETS.findIndex((s) => s.name === 'Long haul')", "shape: SHAPE_PRESETS.findIndex((s) => s.name === 'Islands')").replace('const far = spot(', 'const far0 = spot(').replace('Object.assign(globalThis, { L, hz, free, spot, gen, step, roadTo, far,', 'Object.assign(globalThis, { L, hz, free, spot, gen, step, roadTo,') + `
    const d = spot(L.x, L.y, 3, 7, (i, j) => free(tIdx(i + 1, j)));
    const Dv = addBuilding(0, 'mdriver', d[0], d[1], true); roadTo(Dv); gen(Dv.x, Dv.y);
    const isl = (i, j) => S.terrain[tIdx(i, j)] === T_GROUND && !S.bAt[tIdx(i, j)] && !S.res[tIdx(i, j)] && S.zone[tIdx(i, j)] > 0 && S.zone[tIdx(i, j)] !== hz && S.terrain[tIdx(i + 1, j)] === T_GROUND;
    let far = null, bd = 1e9;
    for (let j = 2; j < S.H - 2; j++) for (let i = 2; i < S.W - 2; i++) { const k = Math.abs(dist(i, j, Dv.x, Dv.y) - ${D}); if (k < bd && dist(i, j, Dv.x, Dv.y) <= MASSDRIVER.max - 1 && isl(i, j)) { bd = k; far = [i, j]; } }
    if (!far) return JSON.stringify({ err: 'no island in reach' });
    const C = addBuilding(0, 'catcher', far[0], far[1], true);
    const gs = []; for (let j = C.y - 3; j <= C.y + 3 && !gs.length; j++) for (let i = C.x - 3; i <= C.x + 3; i++) if (dist(i, j, C.x, C.y) >= 1.5 && isl(i, j) && S.zone[tIdx(i, j)] === S.zone[tIdx(C.x, C.y)]) { gs.push([i, j]); break; }
    const G = addBuilding(0, 'generator', gs[0][0], gs[0][1], true); bump(G.stock, 'fuel', 400);
    computeTerritory(); computeZones();
    applyOrder(0, 'mdAim', [Dv.id, C.id]);
    C.keep = { cement: 2000 };
    const first = warm(C, Dv), rate = measure(C, Dv);
    return JSON.stringify({ d: Math.round(dist(Dv.x, Dv.y, C.x, C.y)), cost: cost(add(add({}, BDEFS.mdriver.cost), BDEFS.catcher.cost)), build: BDEFS.mdriver.buildTime + BDEFS.catcher.buildTime, first, rate, fuel, vfuel, every: mdReload(Dv, C) });
  `));
}
// ---- Maglev: Terminal by home, a line to the far spot (pylons every 3 tiles, built by Workers), 4 pods
{
  const c = mk();
  out.maglev = JSON.parse(run(c, SETUP + `
    const a = spot(L.x, L.y, 4, 6), A = addBuilding(0, 'magterm', a[0], a[1], true); gen(a[0], a[1]); roadTo(A);
    const b = spot(far[0], far[1], 0, 6, (i, j) => !magLineCheck(0, A, i, j).why);
    if (!b) return JSON.stringify({ err: 'no straight Maglev line' });
    for (let k = 0; k < 8; k++) addBot(0, 'worker', L.x + 0.5, L.y + 0.5);
    const t0 = S.time;
    const r = applyOrder(0, 'magLine', [A.id, b[0], b[1]]);
    const B = r && getE(r.id);
    if (!B) return JSON.stringify({ err: 'line refused', r });
    for (let k = 0; k < 1200 && !(B.built && magPartner(A)); k++) step(1);
    const up = Math.round(S.time - t0);
    gen(B.x, B.y);
    const pylons = S.buildings.filter((p) => !p.dead && p.type === 'magpylon').length;
    const span = Math.round(dist(A.x, A.y, B.x, B.y));
    bump(A.stock, 'alloy', 40); bump(A.stock, 'chip', 20);
    applyOrder(0, 'yard', [A.id, 'magpod', ${NV}]);
    for (let k = 0; k < 600 && linePods(A).length < ${NV}; k++) step(1);
    const pods = linePods(A).length;
    B.keep = { cement: 2000 };
    const lineCost = add(add(add({}, BDEFS.magterm.cost, 2), BDEFS.magpylon.cost, pylons), BOTS.magpod.round, BOTS.magpod.parts * pods);
    const first = warm(B, A), rate = measure(B, A);
    return JSON.stringify({ d: span, pylons, pods, cost: cost(lineCost), build: up, first, rate, fuel, vfuel });
  `));
}
// ---- Rail: a station by home and one at the far spot, track between (laid at once, paid per tile), Freight Trains
{
  const c = mk();
  out.rail = JSON.parse(run(c, SETUP + `
    const a = spot(L.x, L.y, 3, 6, (i, j) => free(tIdx(i + 1, j)));
    const A = addBuilding(0, 'station', a[0], a[1], true); roadTo(A);
    const B = addBuilding(0, 'station', far[0], far[1], true);
    computeTerritory(); computeZones();
    // track: the shortest open way from beside A to beside B (4-way steps over open ground)
    const s0 = tIdx(A.x + 1, A.y), s1 = tIdx(B.x + 1, B.y), prev = new Map([[s0, -1]]), q = [s0];
    for (let k = 0; k < q.length && !prev.has(s1); k++) { const t = q[k], i = t % S.W, j = (t / S.W) | 0;
      for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const u = tIdx(i + di, j + dj); if (!inMap(i + di, j + dj) || prev.has(u) || !(free(u) || S.road[u]) || railBlocked(0, u)) continue; prev.set(u, t); q.push(u); } }
    if (!prev.has(s1)) return JSON.stringify({ err: 'no track route' });
    const way = []; for (let t = s1; t >= 0; t = prev.get(t)) way.push(t);
    let tiles = 0; const paid = {};
    for (const t of way) { const why = layRail(0, t); if (!why) { tiles++; add(paid, railCost(t)); } }
    bump(A.stock, 'alloy', 60); bump(A.stock, 'chip', 60);
    applyOrder(0, 'yard', [A.id, 'freight', ${NV}]);
    for (let k = 0; k < 900 && S.bots.filter((u) => !u.dead && u.type === 'freight').length < ${NV}; k++) step(1);
    const trains = S.bots.filter((u) => !u.dead && u.type === 'freight').length;
    setKeep(B, 'cement', 2000);
    const lineCost = add(add(add({}, BDEFS.station.cost, 2), paid), { alloy: 1, chip: 1 }, BOTS.freight.parts * trains);
    const first = warm(B, A), rate = measure(B, A);
    return JSON.stringify({ d: Math.round(dist(A.x, A.y, B.x, B.y)), track: tiles, trains, cost: cost(lineCost), build: 2 * BDEFS.station.buildTime, first, rate, fuel, vfuel });
  `));
}
// ---- Road: a Depot at the far spot with a supply order, the road home, Freight Trucks then Road Trains
for (const kind of ['truck', 'roadtrain']) {
  const c = mk();
  out[kind] = JSON.parse(run(c, SETUP + `
    const B = addBuilding(0, 'depot', far[0], far[1], true);
    const wasRoad = S.road.slice(), before = S.road.reduce((n, v) => n + (v ? 1 : 0), 0);
    roadTo(B); computeTerritory(); computeZones();
    const road = S.road.reduce((n, v) => n + (v ? 1 : 0), 0) - before;
    for (let k = 0; k < ${NV}; k++) addBot(0, '${kind}', L.x + 0.5, L.y + 0.5);
    setKeep(B, 'cement', 2000);
    const lineCost = add(add({}, BDEFS.depot.cost), { alloy: 1, chip: 1 }, BOTS['${kind}'].parts * ${NV});
    for (let t = 0; t < S.W * S.H; t++) if (S.road[t] && !wasRoad[t]) add(lineCost, roadTileCost(t));
    const first = warm(B), rate = measure(B);
    return JSON.stringify({ d: Math.round(dist(L.x, L.y, B.x, B.y)), road, vehicles: ${NV}, cost: cost(lineCost), build: BDEFS.depot.buildTime, first, rate, fuel, vfuel });
  `));
}
console.log(JSON.stringify({ distance: D, vehicles: NV, minutes: MIN, ...out }, null, 1));

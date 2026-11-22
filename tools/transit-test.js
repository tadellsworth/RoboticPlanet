// Headless checks for the high-speed transit: Maglev lines chained through a hub, a Terminal lost (the line kept, the
// pylons standing) and rebuilt at half price on its old tile, a pylon over an Express pair (the lane stays a lane, a
// truck drives under), Express lanes never crossing (built or only planned), and the same run twice ending alike.
// Run: node tools/transit-test.js
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const files = ['util', 'defs', 'world', 'path', 'sim', 'ai', 'missions', 'orders'];
const source = files.map((f) => fs.readFileSync(path.join(__dirname, '..', 'js', f + '.js'), 'utf8')).join('\n');
const mk = () => {
  const c = { console, Math, JSON, Map, Set, Array, Object, Number, String, Infinity, Uint8Array, Int8Array, Int32Array, Uint32Array, Float32Array, Uint16Array, sfx: () => {} };
  vm.createContext(c);
  vm.runInContext(source, c);
  return c;
};
const run = (c, code) => vm.runInContext(`(() => { ${code} })()`, c);
let fails = 0;
const check = (name, ok, x) => { console.log((ok ? 'PASS ' : 'FAIL ') + name + (ok ? '' : '  ' + JSON.stringify(x))); if (!ok) fails++; };

// A colony with a powered Terminal A by the base, a hub spot ~15 tiles out and a far spot ~14 beyond it.
const SETUP = `
  newGame({ seed: 4, mode: 'colony', size: 2, rough: 0 });
  const L = getE(S.players[0].lander);
  for (const g of ['cement', 'alloy', 'chip', 'fuel', 'stone', 'fiber', 'asphalt']) bump(L.stock, g, 400);
  const free = (t) => S.terrain[t] === T_GROUND && !S.bAt[t] && !S.res[t] && !S.road[t] && !S.ramp[t] && !(S.owner[t] >= 0 && S.owner[t] !== 0) && S.zone[t] === S.zone[tIdx(L.x, L.y)];
  const spot = (cx, cy, rmin, rmax, extra) => { let best = null, bd = 1e9; for (let j = 2; j < S.H - 2; j++) for (let i = 2; i < S.W - 2; i++) { const d = dist(i, j, cx, cy); if (d < rmin || d > rmax || !free(tIdx(i, j)) || (extra && !extra(i, j))) continue; if (d < bd) { bd = d; best = [i, j]; } } return best; };
  const gen = (T) => { const g = spot(T[0], T[1], 1.5, 3.5); const G = addBuilding(0, 'generator', g[0], g[1], true); bump(G.stock, 'fuel', 40); };
  const until = (fn, secs) => { for (let k = 0; k < 30 * secs && !fn(); k++) simStep(SIM_STEP); return fn(); };
  const a = spot(L.x, L.y, 4, 6), A = addBuilding(0, 'magterm', a[0], a[1], true);
  gen(a);
  const h = spot(A.x, A.y, 14, 16, (i, j) => !magLineCheck(0, A, i, j).why && dist(i, j, L.x, L.y) > dist(A.x, A.y, L.x, L.y) + 8);
  const b = spot(h[0], h[1], 13, 15, (i, j) => !magLineCheck(0, magGhost(0, h[0], h[1]), i, j).why && dist(i, j, A.x, A.y) > 22);
  computeTerritory(); computeZones();
  Object.assign(globalThis, { L, free, spot, gen, until, T: { A: A.id, h, b } });
`;

const c = mk();
run(c, SETUP);

// ---- a chain A -> H -> B: the second line from H makes it a hub
const chain = JSON.parse(run(c, `
  const A = getE(T.A), [hx, hy] = T.h, [bx, by] = T.b;
  const H = getE(applyOrder(0, 'magLine', [A.id, hx, hy]).id);
  until(() => !!magPartner(A), 600); gen([hx, hy]);
  const B = getE(applyOrder(0, 'magLine', [H.id, bx, by]).id);
  until(() => B.built && magPartners(H).length === 2, 600); gen([bx, by]);
  T.H = H.id; T.B = B.id;
  return JSON.stringify({ hub: magPartners(H).length, net: magNet(A).length, cap: magPodCap(A) });
`));
check('a second line from a Terminal on a line makes it a hub: three Terminals in one network, four pods a line', chain.hub === 2 && chain.net === 3 && chain.cap === 2 * MAGLEV_PER_LINE(c), chain);

// ---- goods cross the hub by pod
const flow = JSON.parse(run(c, `
  const A = getE(T.A), B = getE(T.B);
  bump(A.stock, 'alloy', 16); bump(A.stock, 'chip', 8);
  applyOrder(0, 'yard', [A.id, 'magpod', 2]);
  until(() => linePods(A).length >= 2, 300);
  S.players[0].railT = undefined; railPlan(0);
  B.keep = { cement: 24 }; bump(A.stock, 'cement', 60);
  until(() => (B.stock.cement || 0) >= 16, 300);
  return JSON.stringify({ got: B.stock.cement || 0 });
`));
check('goods ordered at the far Terminal come from A through the hub', flow.got >= 16, flow);

// ---- the hub lost: its lines stand broken, then a Terminal rebuilt on its tile (half price) joins them again
const lost = JSON.parse(run(c, `
  const A = getE(T.A), H = getE(T.H), B = getE(T.B);
  const pyl = () => S.buildings.filter((p) => !p.dead && p.type === 'magpylon' && p.owner === 0).length;
  const had = pyl(), hx = H.x, hy = H.y;
  destroyBuilding(H, true);
  const out = { had, pylons: pyl(), lines: magPartners(A).length + magPartners(B).length, missA: magMiss(A).length, missB: magMiss(B).length };
  const R = getE(applyOrder(0, 'magLine', [A.id, hx, hy]).id);
  out.cost = R ? { ...siteCost(R) } : null;
  until(() => R && R.built, 600);
  for (let k = 0; k < 60; k++) simStep(SIM_STEP);
  out.half = !!out.cost && Object.keys(BDEFS.magterm.cost).every((g) => out.cost[g] === Math.ceil(BDEFS.magterm.cost[g] / 2));
  out.joined = R ? magPartners(R).length : 0; out.pylonsAfter = pyl(); out.missing = !!(A.magMissing || B.magMissing);
  return JSON.stringify(out);
`));
check('a Terminal destroyed keeps its lines: every pylon stands, both lines suspended at their other end', lost.pylons === lost.had && lost.lines === 0 && lost.missA === 1 && lost.missB === 1, lost);
check('a Terminal rebuilt on its tile costs half and joins both lines again, the same pylons', lost.half && lost.joined === 2 && lost.pylonsAfter === lost.had && !lost.missing, lost);

// ---- a Maglev line over an Express pair: the pylon stands over the lane, which stays a lane, and a truck drives under
const over = JSON.parse(run(c, `
  const A = getE(T.A);
  const a = spot(L.x, L.y, 6, 14, (i, j) => dist(i, j, A.x, A.y) > 4);
  const D = addBuilding(0, 'magterm', a[0], a[1], true);
  const far = spot(D.x, D.y, 12, 14, (i, j) => !magLineCheck(0, D, i, j).why);
  const sp = magLineCheck(0, D, far[0], far[1]).spots[1];
  const horiz = Math.abs(far[1] - D.y) > Math.abs(far[0] - D.x);
  const P1 = [], P2 = [];
  for (let k = -3; k <= 3; k++) {
    const i = horiz ? sp.i + k : sp.i, j = horiz ? sp.j : sp.j + k, t = tIdx(i, j), t2 = horiz ? tIdx(i, j + 1) : tIdx(i + 1, j);
    if (free(t) && free(t2)) { setRoad(i, j, true, 0); setRoad(t2 % S.W, (t2 / S.W) | 0, true, 0); P1.push(t); P2.push(t2); }
  }
  applyOrder(0, 'paths', [{ express: P1.map((t) => [t, horiz ? 2 : 3]).concat(P2.map((t) => [t, horiz ? 4 : 5])) }]);
  for (const t of P1.concat(P2)) setPave(t % S.W, (t / S.W) | 0, 3);
  computeZones();
  const chk = magLineCheck(0, D, far[0], far[1]);
  const E = getE(applyOrder(0, 'magLine', [D.id, far[0], far[1]]).id);
  until(() => E.built && magPartner(D) === E, 600);
  const p = getE(S.bAt[sp.t]), t0 = P1[0], t1 = P1[P1.length - 1];
  const u = addBot(0, 'truck', (t0 % S.W) + 0.5, ((t0 / S.W) | 0) + 0.5);
  let under = false; const went = goTo(u, t1 % S.W, (t1 / S.W) | 0);
  for (let k = 0; k < 30 * 30 && u.path; k++) { moveAlong(u, SIM_STEP); if (tIdx(Math.floor(u.x), Math.floor(u.y)) === sp.t) under = true; }
  return JSON.stringify({ why: chk.why, onLane: P1.includes(sp.t), pylon: !!p && p.type === 'magpylon' && p.built, lane: isExpress(sp.t), went, under, arrived: !u.path && dist(u.x, u.y, (t1 % S.W) + 0.5, ((t1 / S.W) | 0) + 0.5) < 1 });
`));
check('a Maglev line crosses an Express pair: the pylon stands over the lane, still a lane, and a truck drives under it', over.why === '' && over.onLane && over.pylon && over.lane && over.went && over.under && over.arrived, over);

// ---- Express lanes never cross: a lane across a lane only planned is refused, as across a built one
const cross = JSON.parse(run(c, `
  const q = spot(L.x, L.y, 8, 24, (i, j) => [-3, -2, -1, 0, 1, 2, 3].every((k) => free(tIdx(i + k, j)) && free(tIdx(i, j + k))));
  const H = [], V = []; for (let k = -3; k <= 3; k++) { H.push(tIdx(q[0] + k, q[1])); V.push(tIdx(q[0], q[1] + k)); }
  const mid = tIdx(q[0], q[1]);
  applyOrder(0, 'paths', [{ add: H, express: H.map((t) => [t, 2]) }]);
  const o = applyOrder(0, 'paths', [{ add: V.filter((t) => t !== mid), express: V.map((t) => [t, 3]) }]);
  return JSON.stringify({ mid: S.xdir[mid], lanes: o.lanes, n: V.length });
`));
check('a lane across a lane only planned is refused there (the planned lane keeps its way)', cross.mid === 2 && cross.lanes === cross.n - 1, cross);

// ---- the same, run twice from scratch, ends alike
const fp = () => { const k = mk(); run(k, SETUP); return run(k, `
  const A = getE(T.A), [hx, hy] = T.h;
  const H = getE(applyOrder(0, 'magLine', [A.id, hx, hy]).id);
  until(() => !!magPartner(A), 600);
  bump(A.stock, 'alloy', 8); bump(A.stock, 'chip', 4); applyOrder(0, 'yard', [A.id, 'magpod', 1]);
  H.keep = { cement: 16 }; bump(A.stock, 'cement', 30);
  for (let k = 0; k < 30 * 40; k++) simStep(SIM_STEP);
  destroyBuilding(H, true);
  for (let k = 0; k < 30 * 10; k++) simStep(SIM_STEP);
  return hashState();
`); };
const f1 = fp(), f2 = fp();
check('a line built, run, and its far Terminal lost, twice from scratch, ends with the same fingerprint', f1 === f2, { f1, f2 });

function MAGLEV_PER_LINE(k) { return vm.runInContext('MAGLEV.perLine', k); }
console.log(fails ? fails + ' FAILED' : 'ALL PASSED');
process.exitCode = fails ? 1 : 0;

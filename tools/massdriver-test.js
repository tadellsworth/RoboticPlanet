// Headless checks for the Mass Driver line (MASSDRIVER, mdPlan): goods flying both ways between a Driver and its
// Catcher, automatic supply filling the far end's needs with no goods list, a 50-tile line across the sea on Islands
// (and allowed on Sky islands and Four Isles, none in the Hollow), a Driver keeping an Outpost's Ammo up, a rival's Flak
// bursting a canister, and a save from before (a one-way pair with a goods list) loading and running.
// Run: node tools/massdriver-test.js
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

// Helpers in the game's context: free ground near a point (same zone as `zt`, or another one), a powered spot.
const HELP = `
  const free = (t) => S.terrain[t] === T_GROUND && !S.bAt[t] && !S.res[t] && !S.road[t] && !S.ramp[t] && !(S.owner[t] >= 0 && S.owner[t] !== 0);
  const spot = (cx, cy, rmin, rmax, ok) => { let best = null, bd = 1e9; for (let j = 2; j < S.H - 2; j++) for (let i = 2; i < S.W - 2; i++) { const d = dist(i, j, cx, cy); if (d < rmin || d > rmax || !free(tIdx(i, j)) || (ok && !ok(i, j))) continue; if (d < bd) { bd = d; best = [i, j]; } } return best; };
  const gen = (x, y) => { const g = spot(x, y, 1.5, 3.5, (i, j) => S.zone[tIdx(i, j)] === S.zone[tIdx(x, y)]); const G = addBuilding(0, 'generator', g[0], g[1], true); bump(G.stock, 'fuel', 40); return G; };
  const until = (fn, secs) => { for (let k = 0; k < 30 * secs && !fn(); k++) simStep(SIM_STEP); return fn(); };
  const driver = (i, j) => { const D = addBuilding(0, 'mdriver', i, j, true); for (const t of roadRouteTo(0, D) || []) setRoad(t % S.W, (t / S.W) | 0, true, 0); computeTerritory(); return D; };
  Object.assign(globalThis, { free, spot, gen, until, driver });
`;

// ---- Islands: a Driver on the home island, a Catcher out on another island 35 to 50 tiles off, nothing between but sea
const c = mk();
const isl = JSON.parse(run(c, `
  newGame({ seed: 11, mode: 'colony', size: 3, shape: SHAPE_PRESETS.findIndex((s) => s.name === 'Islands') });
  ${HELP}
  const L = getE(S.players[0].lander), hz = S.zone[tIdx(L.x, L.y)];
  for (const g of ['cement', 'alloy', 'chip', 'fuel', 'stone', 'fiber']) bump(L.stock, g, 300);
  const d = spot(L.x, L.y, 3, 7, (i, j) => S.zone[tIdx(i, j)] === hz && free(tIdx(i + 1, j)));
  const D = driver(d[0], d[1]);
  const far = spot(D.x, D.y, 35, MASSDRIVER.max - 1, (i, j) => S.zone[tIdx(i, j)] !== hz && S.zone[tIdx(i, j)] > 0 && dist(i, j, L.x, L.y) > dist(D.x, D.y, L.x, L.y) + 20);
  if (!far) return JSON.stringify({ err: 'no far island in range' });
  const C = addBuilding(0, 'catcher', far[0], far[1], true);
  // on the far island: a Generator (it wants Fuel) and a site going up beside the Catcher (its materials)
  // (touching it: no Worker has crossed to the island, so its conveyor feeds them)
  const gs = spot(C.x, C.y, 1, 1.5, (i, j) => S.zone[tIdx(i, j)] === S.zone[tIdx(C.x, C.y)]), GC = addBuilding(0, 'generator', gs[0], gs[1], true);
  const s = spot(C.x, C.y, 1, 1.5, (i, j) => S.zone[tIdx(i, j)] === S.zone[tIdx(C.x, C.y)]);
  const site = addBuilding(0, 'kiln', s[0], s[1], false);
  gen(D.x, D.y);
  computeTerritory(); computeZones();
  let water = 0; const n = Math.ceil(dist(D.x, D.y, C.x, C.y)); for (let k = 0; k <= n; k++) { const t = tIdx(Math.round(D.x + (C.x - D.x) * k / n), Math.round(D.y + (C.y - D.y) * k / n)); if (S.terrain[t] === T_WATER) water++; }
  const aim = applyOrder(0, 'mdAim', [D.id, C.id]);
  bump(C.stock, 'stone', 40); // (the island's spare: it goes home)
  Object.assign(globalThis, { T: { D: D.id, C: C.id, G: GC.id, site: site.id } });
  return JSON.stringify({ aim, d: Math.round(dist(D.x, D.y, C.x, C.y)), water, zones: S.zone[tIdx(D.x, D.y)] !== S.zone[tIdx(C.x, C.y)] });
`));
check('Islands: a Driver aims at a Catcher on another island across the sea, 35 to 50 tiles off', !isl.err && isl.aim === '' && isl.d >= 35 && isl.d <= 50 && isl.water > 5 && isl.zones, isl);

const flow = JSON.parse(run(c, `
  const D = getE(T.D), C = getE(T.C), G = getE(T.G), site = getE(T.site);
  const out = { list: !!D.mdSend || !!C.mdSend };
  until(() => C.mdFar === 1 && C.auto, 10);
  out.far = C.mdFar; out.keep = C.auto;
  const t0 = S.time;
  until(() => (D.mdGot || 0) > 0 && Object.keys(siteCost(site)).every((g) => (site.stock[g] || 0) >= siteCost(site)[g]), 400);
  out.siteStock = site.stock; out.genFuel = G.stock.fuel || 0; out.caught = C.mdGot || 0; out.home = D.mdGot || 0; out.homeStone = D.stock.stone || 0;
  out.thrownD = D.mdSent || 0; out.thrownC = C.mdSent || 0;
  return JSON.stringify(out);
`));
check('automatic supply: no goods list, the far Catcher stocks what the buildings round it need (Fuel, a site\'s materials)', !flow.list && flow.far === 1 && flow.keep && flow.keep.fuel > 0 && Object.keys(flow.keep).length >= 2, flow);
check('goods fly out to the island: the Catcher catches, the Generator gets its Fuel and the site its materials', flow.caught > 0 && flow.genFuel > 0 && flow.thrownD > 0 && Object.keys(flow.siteStock).length >= 2, flow);
check('two-way: the island\'s spare Stone flies home to the Driver', flow.home > 0 && flow.thrownC > 0, flow);

// ---- both ways at once, measured over 30 tiles: goods a minute out and home
const rate = (c2, distT, shape) => JSON.parse(run(c2, `
  newGame({ seed: 5, mode: 'colony', size: 3, rough: 0 ${shape ? `, shape: SHAPE_PRESETS.findIndex((s) => s.name === '${shape}')` : ''} });
  ${HELP}
  const L = getE(S.players[0].lander), hz = S.zone[tIdx(L.x, L.y)];
  for (const g of ['cement', 'alloy', 'chip', 'fuel', 'stone', 'fiber']) bump(L.stock, g, 2000);
  const d = spot(L.x, L.y, 3, 6, (i, j) => S.zone[tIdx(i, j)] === hz && free(tIdx(i + 1, j)));
  const D = driver(d[0], d[1]); gen(D.x, D.y);
  const far = spot(D.x, D.y, ${distT}, ${distT + 1}, (i, j) => dist(i, j, L.x, L.y) > dist(D.x, D.y, L.x, L.y) + ${distT - 4});
  const C = addBuilding(0, 'catcher', far[0], far[1], true); gen(C.x, C.y);
  computeTerritory(); computeZones();
  applyOrder(0, 'mdAim', [D.id, C.id]);
  C.keep = { cement: 2000 }; // (a deep order at the far end: what it lacks flies out as fast as it can)
  bump(C.stock, 'stone', 4000); // (and a deep pile there to send home)
  until(() => { if ((D.stock.cement || 0) < 16) bump(D.stock, 'cement', 16); return (D.mdSent || 0) > 0; }, 120);
  const t0 = S.time, out0 = C.mdGot || 0, in0 = D.mdGot || 0;
  until(() => { if ((D.stock.cement || 0) < 16) bump(D.stock, 'cement', 16); return S.time - t0 >= 300; }, 310); // (the line's own pace: kept loaded)
  const m = (S.time - t0) / 60;
  return JSON.stringify({ d: Math.round(dist(D.x, D.y, C.x, C.y)), out: Math.round(((C.mdGot || 0) - out0) / m), home: Math.round(((D.mdGot || 0) - in0) / m) });
`));
const r30 = rate(mk(), 30);
console.log(`  measured over ${r30.d} tiles: ${r30.out} goods/min out, ${r30.home} goods/min home`);
check('both ways at once over 30 tiles: goods move out and home, a canister of 16 every 8 s each way (about 120 a minute)', r30.out >= 100 && r30.home >= 100 && r30.out <= 130 && r30.home <= 130, r30);

// ---- the far end's goods list overrides: it sends only what's on it
const ov = JSON.parse(run(c, `
  const D = getE(T.D), C = getE(T.C);
  const r1 = applyOrder(0, 'mdSend', [C.id, 'alloy', true]);
  bump(C.stock, 'alloy', 30); bump(C.stock, 'stone', 40);
  S.players[0].mdT = undefined;
  const a0 = D.stock.alloy || 0, s0 = D.mdGot || 0, st0 = D.stock.stone || 0;
  until(() => (D.mdGot || 0) - s0 >= 16, 60);
  const out = { r1, list: Object.keys(C.mdSend || {}), alloy: (D.stock.alloy || 0) - a0, stone: (D.stock.stone || 0) - st0 };
  applyOrder(0, 'mdAuto', [C.id]);
  out.back = !C.mdSend;
  return JSON.stringify(out);
`));
check('a goods list overrides automatic supply (the far end throws just Alloy), and Auto clears it', ov.r1 === '' && ov.list.join() === 'alloy' && ov.alloy >= 8 && ov.stone <= 0 && ov.back, ov);

// ---- where it may be built: Sky islands and Four Isles yes, the Hollow no
const maps = JSON.parse(run(mk(), `
  const out = {};
  for (const [name, opts] of [['Sky islands', { size: 3 }], ['Four Isles', { size: 3, players: 4 }], ['Islands', { size: 3 }]]) {
    newGame(Object.assign({ seed: 9, mode: 'colony', shape: SHAPE_PRESETS.findIndex((s) => s.name === name) }, opts));
    out[name] = !worldBan('mdriver') && !worldBan('catcher');
  }
  newGame({ seed: 9, mode: 'colony', size: 3, shape: SHAPE_PRESETS.findIndex((s) => s.name === 'The Hollow') });
  out.hollow = hollowOn() && !!worldBan('mdriver') && !!worldBan('catcher');
  return JSON.stringify(out);
`));
check('allowed on Islands, Sky islands and Four Isles; none in the Hollow', maps['Sky islands'] && maps['Four Isles'] && maps.Islands && maps.hollow, maps);

// ---- a Driver keeps an Outpost's Ammo topped up (Versus: warbots stationed there)
const fort = JSON.parse(run(mk(), `
  newGame({ seed: 21, mode: 'versus', size: 3, rough: 0 });
  ${HELP}
  const L = getE(S.players[0].lander), hz = S.zone[tIdx(L.x, L.y)];
  for (const g of ['cement', 'alloy', 'chip', 'fuel', 'ammo']) bump(L.stock, g, 200);
  const d = spot(L.x, L.y, 3, 6, (i, j) => S.zone[tIdx(i, j)] === hz && free(tIdx(i + 1, j)));
  const D = driver(d[0], d[1]); gen(D.x, D.y);
  const o = spot(D.x, D.y, 20, 24, (i, j) => S.zone[tIdx(i, j)] === hz && dist(i, j, L.x, L.y) > 16);
  const O = addBuilding(0, 'outpost', o[0], o[1], true);
  computeTerritory(); computeZones();
  for (let k = 0; k < 3; k++) enterBuilding(addBot(0, 'warbot', O.x, O.y), O);
  O.stock.ammo = 0;
  const aim = applyOrder(0, 'mdAim', [D.id, O.id]);
  until(() => (O.mdGot || 0) > 0, 120);
  const got = O.mdGot || 0;
  // it fires again as the Ammo is used
  O.stock.ammo = 0;
  until(() => (O.mdGot || 0) > got, 120);
  return JSON.stringify({ aim, got, again: (O.mdGot || 0) > got, ammo: O.stock.ammo || 0, want: BDEFS.outpost.ammoStock });
`));
check('front-line resupply: a Driver aimed at an Outpost keeps its Ammo topped up, one way', fort.aim === '' && fort.got > 0 && fort.again && fort.ammo > 0, fort);

// ---- a rival's Flak Gun under the line bursts a canister (and none low over either end)
const flak = JSON.parse(run(mk(), `
  newGame({ seed: 21, mode: 'versus', size: 3, rough: 0 });
  ${HELP}
  const L = getE(S.players[0].lander), hz = S.zone[tIdx(L.x, L.y)];
  for (const g of ['cement', 'alloy', 'chip', 'fuel']) bump(L.stock, g, 400);
  const d = spot(L.x, L.y, 3, 6, (i, j) => S.zone[tIdx(i, j)] === hz && free(tIdx(i + 1, j)));
  const D = driver(d[0], d[1]); gen(D.x, D.y);
  const far = spot(D.x, D.y, 30, 32, (i, j) => dist(i, j, L.x, L.y) > dist(D.x, D.y, L.x, L.y) + 20);
  const C = addBuilding(0, 'catcher', far[0], far[1], true); gen(C.x, C.y);
  const mid = spot((D.x + C.x) / 2, (D.y + C.y) / 2, 0, 4);
  const F = addBuilding(1, 'flak', mid[0], mid[1], true); bump(F.stock, 'ammo', 50);
  computeTerritory(); computeZones();
  applyOrder(0, 'mdAim', [D.id, C.id]);
  applyOrder(0, 'mdSend', [D.id, 'cement', true]);
  const loot0 = (S.loot || []).length;
  until(() => (S.loot || []).some((l) => l.goods.cement), 240);
  return JSON.stringify({ burst: (S.loot || []).some((l) => l.goods.cement), sent: D.mdSent || 0, low: MASSDRIVER.low });
`));
check('a rival Flak Gun under the line still bursts canisters: their goods fall as crates', flak.burst && flak.sent > 0, flak);

// ---- a save from before: a one-way Driver with a goods list and its Catcher, no plan fields
const old = JSON.parse(run(mk(), `
  newGame({ seed: 5, mode: 'colony', size: 3, rough: 0 });
  ${HELP}
  const L = getE(S.players[0].lander), hz = S.zone[tIdx(L.x, L.y)];
  for (const g of ['cement', 'alloy', 'chip', 'fuel']) bump(L.stock, g, 300);
  const d = spot(L.x, L.y, 3, 6, (i, j) => S.zone[tIdx(i, j)] === hz && free(tIdx(i + 1, j)));
  const D = driver(d[0], d[1]); gen(D.x, D.y);
  const far = spot(D.x, D.y, 20, 24, (i, j) => dist(i, j, L.x, L.y) > dist(D.x, D.y, L.x, L.y) + 12);
  const C = addBuilding(0, 'catcher', far[0], far[1], true);
  computeTerritory(); computeZones();
  // as an old save had them: the Driver's aim and goods list, its numbers; the Catcher plain storage
  D.mdTo = C.id; D.mdSend = { cement: 20 }; D.mdLast = 0; D.mdCd = 0; D.mdFire = 0; D.mdSent = 24; C.mdGot = 24;
  const j = serializeGame(), o = JSON.parse(j);
  for (const b of o.buildings) for (const k of ['mdAuto', 'mdFar', 'mdAt', 'mdNext', 'auto']) delete b[k];
  for (const P of o.players) delete P.mdT;
  let err = '';
  try { deserializeGame(JSON.stringify(o)); } catch (e) { err = String(e && e.message || e); }
  if (err) return JSON.stringify({ err });
  const D2 = S.buildings.find((b) => b.type === 'mdriver'), C2 = S.buildings.find((b) => b.type === 'catcher');
  until(() => (C2.mdGot || 0) >= 24 + 32, 240);
  return JSON.stringify({ got: C2.mdGot, list: Object.keys(D2.mdSend || {}), far: C2.mdFar, catcherAuto: !C2.mdSend });
`));
check('a save from before (a Driver with a goods list, its Catcher) loads and runs: the pair is two-way, the list kept', !old.err && old.got >= 56 && old.list.join() === 'cement' && old.far === 1 && old.catcherAuto, old);

// ---- the same run twice ends alike (deterministic)
const h = () => run(mk(), `
  newGame({ seed: 5, mode: 'colony', size: 3, rough: 0 });
  ${HELP}
  const L = getE(S.players[0].lander), hz = S.zone[tIdx(L.x, L.y)];
  for (const g of ['cement', 'alloy', 'chip', 'fuel', 'stone']) bump(L.stock, g, 300);
  const d = spot(L.x, L.y, 3, 6, (i, j) => S.zone[tIdx(i, j)] === hz && free(tIdx(i + 1, j)));
  const D = driver(d[0], d[1]); gen(D.x, D.y);
  const far = spot(D.x, D.y, 26, 28, (i, j) => dist(i, j, L.x, L.y) > dist(D.x, D.y, L.x, L.y) + 18);
  const C = addBuilding(0, 'catcher', far[0], far[1], true); gen(C.x, C.y);
  computeTerritory(); computeZones();
  applyOrder(0, 'mdAim', [D.id, C.id]); C.keep = { cement: 40, alloy: 20 }; bump(C.stock, 'stone', 60);
  until(() => false, 150);
  return hashState() + ':' + (C.mdGot || 0) + ':' + (D.mdGot || 0);
`);
const h1 = h(), h2 = h();
check('the same run twice ends alike', h1 === h2 && !/:0:|:0$/.test(h1), [h1, h2]);

console.log(fails ? `${fails} FAILED` : 'all passed');
process.exit(fails ? 1 : 0);

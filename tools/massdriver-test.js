// Headless checks for the Mass Driver line (MASSDRIVER, mdPlan), as the owner set it on Nov 28 2026: two Drivers aimed at
// each other are a line both ways (every 10 s over land, every 8 s across the sea), a Driver and a Catcher a line one way
// (the Catcher only catches, it never fires), a Driver in one line at most (a third refused, stand down breaks both),
// two Drivers at most on a Catcher, aiming at an Outpost or Keep refused, automatic supply filling the far end's needs
// with no goods list, a 50-tile line across the sea on Islands (and allowed on Sky islands and Four Isles, none in the
// Hollow), a rival's Flak bursting a canister, and saves from before (a goods list; a Driver aimed at an Outpost; a
// Catcher that fired) loading and running.
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
  bump(C.stock, 'stone', 40); // (spare on the island: a Catcher sends nothing home)
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
  let fired = false;
  until(() => { if (C.mdFire || C.mdShot || (S.cans || []).some((m) => m.from === C.id)) fired = true; return Object.keys(siteCost(site)).every((g) => (site.stock[g] || 0) >= siteCost(site)[g]); }, 400);
  until(() => { if (C.mdFire || C.mdShot || (S.cans || []).some((m) => m.from === C.id)) fired = true; return false; }, 60); // (and a minute more, its Generator fed and Stone to spare)
  out.siteStock = site.stock; out.genFuel = G.stock.fuel || 0; out.caught = C.mdGot || 0; out.home = D.mdGot || 0; out.homeStone = D.stock.stone || 0;
  out.thrownD = D.mdSent || 0; out.thrownC = C.mdSent || 0; out.fired = fired; out.cStatus = C.status; out.cAuto = !!C.mdAuto;
  return JSON.stringify(out);
`));
check('automatic supply: no goods list, the far Catcher stocks what the buildings round it need (Fuel, a site\'s materials)', !flow.list && flow.far === 1 && flow.keep && flow.keep.fuel > 0 && Object.keys(flow.keep).length >= 2, flow);
check('goods fly out to the island: the Catcher catches, the Generator gets its Fuel and the site its materials', flow.caught > 0 && flow.genFuel > 0 && flow.thrownD > 0 && Object.keys(flow.siteStock).length >= 2, flow);
check('one way: the Catcher only catches (it never charges or fires, its spare Stone stays), even with a Generator by it', flow.home === 0 && flow.thrownC === 0 && !flow.fired && !flow.cAuto && /Catching canisters/.test(flow.cStatus) && flow.caught > 0, flow);

// ---- both ways at once between two Drivers, measured over 30 tiles: goods a minute out and home
// (over land: the far Driver on ground a robot can walk to; across the sea on Islands: on another island). And the same
// with a Catcher at the far end: goods go out at the same pace, none come home.
const rate = (c2, distT, sea, catcher) => JSON.parse(run(c2, `
  newGame({ seed: ${sea ? 11 : 5}, mode: 'colony', size: 3 ${sea ? `, shape: SHAPE_PRESETS.findIndex((s) => s.name === 'Islands')` : ', rough: 0'} });
  ${HELP}
  const L = getE(S.players[0].lander), hz = S.zone[tIdx(L.x, L.y)];
  for (const g of ['cement', 'alloy', 'chip', 'fuel', 'stone', 'fiber']) bump(L.stock, g, 2000);
  const d = spot(L.x, L.y, 3, 7, (i, j) => S.zone[tIdx(i, j)] === hz && free(tIdx(i + 1, j)));
  const D = driver(d[0], d[1]); gen(D.x, D.y);
  const far = spot(D.x, D.y, ${distT}, ${sea ? 'MASSDRIVER.max - 1' : distT + 1}, (i, j) => free(tIdx(i + 1, j)) && ${sea ? 'S.zone[tIdx(i, j)] !== hz && S.zone[tIdx(i, j)] > 0 && ' : 'S.zone[tIdx(i, j)] === hz && '}dist(i, j, L.x, L.y) > dist(D.x, D.y, L.x, L.y) + ${distT - 4});
  const C = addBuilding(0, '${catcher ? 'catcher' : 'mdriver'}', far[0], far[1], true); gen(C.x, C.y);
  computeTerritory(); computeZones();
  const aim = applyOrder(0, 'mdAim', [D.id, C.id]);
  C.keep = { cement: 2000 }; // (a deep order at the far end: what it lacks flies out as fast as it can)
  bump(C.stock, 'stone', 4000); // (and a deep pile there to send home)
  until(() => { if ((D.stock.cement || 0) < 16) bump(D.stock, 'cement', 16); return (D.mdSent || 0) > 0; }, 120);
  const t0 = S.time, out0 = C.mdGot || 0, in0 = D.mdGot || 0;
  until(() => { if ((D.stock.cement || 0) < 16) bump(D.stock, 'cement', 16); return S.time - t0 >= 300; }, 310); // (the line's own pace: kept loaded)
  const m = (S.time - t0) / 60;
  return JSON.stringify({ aim, d: Math.round(dist(D.x, D.y, C.x, C.y)), paired: C.mdTo === D.id, land: mdOverland(D, C), every: mdReload(D, C), out: Math.round(((C.mdGot || 0) - out0) / m), home: Math.round(((D.mdGot || 0) - in0) / m), thrownC: C.mdSent || 0, farEnd: C.mdFar });
`));
const r30 = rate(mk(), 30);
console.log(`  two Drivers over land, ${r30.d} tiles: ${r30.out} goods/min out, ${r30.home} goods/min home`);
check('Driver to Driver: aimed at another Driver, the two are paired (it is aimed back), and goods fly both ways over 30 tiles of land, a canister of 16 every 10 s each way (about 96 a minute)', r30.aim === '' && r30.paired && r30.land && r30.every === 10 && r30.out >= 85 && r30.home >= 85 && r30.out <= 100 && r30.home <= 100, r30);
const rSea = rate(mk(), 30, true);
console.log(`  two Drivers across the sea, ${rSea.d} tiles: ${rSea.out} goods/min out, ${rSea.home} goods/min home`);
check('Driver to Driver across the sea on Islands: a crossing, so a canister of 16 every 8 s each way (about 120 a minute)', rSea.aim === '' && rSea.paired && !rSea.land && rSea.every === 8 && rSea.out >= 100 && rSea.home >= 100 && rSea.out <= 130 && rSea.home <= 130, rSea);
const rCat = rate(mk(), 30, false, true);
console.log(`  Driver to Catcher over land, ${rCat.d} tiles: ${rCat.out} goods/min out, ${rCat.home} goods/min home`);
check('Driver to Catcher: one way, goods out at the line\'s pace (about 96 a minute over land) and none home: the Catcher never fires', rCat.aim === '' && rCat.out >= 85 && rCat.out <= 100 && rCat.home === 0 && rCat.thrownC === 0, rCat);

// ---- a Catcher takes two Drivers at most: a third is refused, with why
const cap = JSON.parse(run(mk(), `
  newGame({ seed: 5, mode: 'colony', size: 3, rough: 0 });
  ${HELP}
  const L = getE(S.players[0].lander), hz = S.zone[tIdx(L.x, L.y)];
  const far = spot(L.x, L.y, 30, 32, (i, j) => S.zone[tIdx(i, j)] === hz);
  const C = addBuilding(0, 'catcher', far[0], far[1], true);
  const ds = [];
  for (let k = 0; k < 3; k++) { const d = spot(L.x, L.y, 3, 10, (i, j) => S.zone[tIdx(i, j)] === hz && free(tIdx(i + 1, j)) && dist(i, j, C.x, C.y) >= MASSDRIVER.min); ds.push(driver(d[0], d[1])); }
  computeTerritory(); computeZones();
  const r = ds.map((D) => applyOrder(0, 'mdAim', [D.id, C.id]));
  return JSON.stringify({ r, partners: mdLinks(C).length, fires: mdPartners(C).length, third: ds[2].mdTo || 0 });
`));
check('a Catcher takes two Drivers (both deliver to it, it fires to neither): aiming a third at it is refused with a clear message', cap.r[0] === '' && cap.r[1] === '' && /already takes 2 Mass Drivers/.test(cap.r[2]) && cap.partners === 2 && cap.fires === 0 && !cap.third, cap);

// ---- a Driver is in one line at most: a third Driver can't pair into a pair; stand down on either end breaks it for
// both; aiming one elsewhere breaks its old pair; an unbuilt Driver, a Catcher's Driver and itself are refused
const pr = JSON.parse(run(mk(), `
  newGame({ seed: 5, mode: 'colony', size: 3, rough: 0 });
  ${HELP}
  const L = getE(S.players[0].lander), hz = S.zone[tIdx(L.x, L.y)];
  const ok = (i, j) => S.zone[tIdx(i, j)] === hz && free(tIdx(i + 1, j));
  const a = spot(L.x, L.y, 3, 8, ok), A = driver(a[0], a[1]);
  const b = spot(L.x, L.y, 26, 28, ok), B = driver(b[0], b[1]);
  const c = spot(L.x, L.y, 14, 40, (i, j) => ok(i, j) && dist(i, j, A.x, A.y) >= MASSDRIVER.min + 2 && dist(i, j, B.x, B.y) >= MASSDRIVER.min + 2 && dist(i, j, B.x, B.y) <= MASSDRIVER.max - 2), Cd = driver(c[0], c[1]);
  const e = spot(L.x, L.y, 20, 24, (i, j) => ok(i, j) && dist(i, j, A.x, A.y) >= MASSDRIVER.min + 2 && dist(i, j, B.x, B.y) >= MASSDRIVER.min + 2 && dist(i, j, Cd.x, Cd.y) >= MASSDRIVER.min + 2), E = addBuilding(0, 'catcher', e[0], e[1], true);
  const u = spot(L.x, L.y, 18, 30, (i, j) => ok(i, j) && dist(i, j, A.x, A.y) >= MASSDRIVER.min + 2 && dist(i, j, Cd.x, Cd.y) >= MASSDRIVER.min + 2 && dist(i, j, B.x, B.y) >= 3), U = addBuilding(0, 'mdriver', u[0], u[1], false);
  computeTerritory(); computeZones();
  const out = {};
  out.self = applyOrder(0, 'mdAim', [A.id, A.id]);
  out.site = applyOrder(0, 'mdAim', [A.id, U.id]);
  out.pair = applyOrder(0, 'mdAim', [A.id, B.id]);
  out.both = A.mdTo === B.id && B.mdTo === A.id && mdLinks(A)[0] === B && mdLinks(B)[0] === A;
  out.third = applyOrder(0, 'mdAim', [Cd.id, B.id]); out.thirdTo = Cd.mdTo || 0;
  out.third2 = applyOrder(0, 'mdAim', [Cd.id, A.id]);
  // stand down on B: both ends stand down
  out.off = applyOrder(0, 'mdAim', [B.id, 0]); out.offA = A.mdTo || 0; out.offB = B.mdTo || 0;
  // pair again, then aim A at the Catcher: its old pair breaks, B stands down
  applyOrder(0, 'mdAim', [A.id, B.id]);
  out.re = applyOrder(0, 'mdAim', [A.id, E.id]); out.reA = A.mdTo === E.id; out.reB = B.mdTo || 0;
  // a Driver aimed at a Catcher is in a line: another Driver can't pair with it
  out.busy = applyOrder(0, 'mdAim', [Cd.id, A.id]);
  // B is free again: Cd pairs with it
  out.free = applyOrder(0, 'mdAim', [Cd.id, B.id]); out.freeBoth = Cd.mdTo === B.id && B.mdTo === Cd.id;
  // a hash and a save carry the pair
  const h0 = hashState(); deserializeGame(serializeGame());
  out.save = hashState() === h0 && getE(Cd.id).mdTo === B.id && getE(B.id).mdTo === Cd.id;
  return JSON.stringify(out);
`));
check('pairing: a Driver can\'t aim at itself or a Driver still going up; aimed at a free Driver, both are aimed at each other', /another of your Mass Drivers/.test(pr.self) && /still going up/.test(pr.site) && pr.pair === '' && pr.both, pr);
check('pairing: a third Driver into an existing pair is refused with a clear reason, from either end', /already in a line/.test(pr.third) && /already in a line/.test(pr.third2) && !pr.thirdTo, pr);
check('pairing: Stand down on either end breaks the pair for both; aiming one elsewhere breaks its old pair too', pr.off === '' && !pr.offA && !pr.offB && pr.re === '' && pr.reA && !pr.reB && /already in a line/.test(pr.busy) && pr.free === '' && pr.freeBoth && pr.save, pr);

// ---- a goods list overrides: it sends only what's on it (the far Driver of a pair); a Catcher has no goods list
const ov = JSON.parse(run(mk(), `
  newGame({ seed: 5, mode: 'colony', size: 3, rough: 0 });
  ${HELP}
  const L = getE(S.players[0].lander), hz = S.zone[tIdx(L.x, L.y)];
  for (const g of ['cement', 'alloy', 'chip', 'fuel']) bump(L.stock, g, 300);
  const ok = (i, j) => S.zone[tIdx(i, j)] === hz && free(tIdx(i + 1, j));
  const a = spot(L.x, L.y, 3, 6, ok), D = driver(a[0], a[1]); gen(D.x, D.y);
  const b = spot(D.x, D.y, 24, 26, (i, j) => ok(i, j) && dist(i, j, L.x, L.y) > dist(D.x, D.y, L.x, L.y) + 16), F = driver(b[0], b[1]); gen(F.x, F.y);
  const c = spot(D.x, D.y, 20, 30, (i, j) => free(tIdx(i, j)) && dist(i, j, F.x, F.y) > 6), C = addBuilding(0, 'catcher', c[0], c[1], true);
  computeTerritory(); computeZones();
  applyOrder(0, 'mdAim', [D.id, F.id]);
  const r1 = applyOrder(0, 'mdSend', [F.id, 'alloy', true]);
  const rc = applyOrder(0, 'mdSend', [C.id, 'alloy', true]);
  bump(F.stock, 'alloy', 30); bump(F.stock, 'stone', 40);
  S.players[0].mdT = undefined;
  const a0 = D.stock.alloy || 0, s0 = D.mdGot || 0, st0 = D.stock.stone || 0;
  until(() => (D.mdGot || 0) - s0 >= 16, 60);
  const out = { r1, rc, far: F.mdFar, list: Object.keys(F.mdSend || {}), alloy: (D.stock.alloy || 0) - a0, stone: (D.stock.stone || 0) - st0 };
  applyOrder(0, 'mdAuto', [F.id]);
  out.back = !F.mdSend;
  return JSON.stringify(out);
`));
check('a goods list overrides automatic supply (the far Driver throws just Alloy home), Auto clears it; a Catcher has none', ov.r1 === '' && ov.far === 1 && ov.list.join() === 'alloy' && ov.alloy >= 8 && ov.stone <= 0 && ov.back && /gone/.test(ov.rc), ov);

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

// ---- a Driver aims at Drivers and Catchers only: an Outpost or a Keep (once kept supplied, one way) is refused
const fort = JSON.parse(run(mk(), `
  newGame({ seed: 21, mode: 'versus', size: 3, rough: 0 });
  ${HELP}
  const L = getE(S.players[0].lander), hz = S.zone[tIdx(L.x, L.y)];
  const d = spot(L.x, L.y, 3, 6, (i, j) => S.zone[tIdx(i, j)] === hz && free(tIdx(i + 1, j)));
  const D = driver(d[0], d[1]); gen(D.x, D.y);
  const o = spot(D.x, D.y, 20, 24, (i, j) => S.zone[tIdx(i, j)] === hz && dist(i, j, L.x, L.y) > 16);
  const O = addBuilding(0, 'outpost', o[0], o[1], true);
  const k = spot(D.x, D.y, 20, 30, (i, j) => S.zone[tIdx(i, j)] === hz && dist(i, j, O.x, O.y) > 4);
  const K = addBuilding(0, 'keep', k[0], k[1], true);
  computeTerritory(); computeZones();
  const out = { outpost: applyOrder(0, 'mdAim', [D.id, O.id]), keep: applyOrder(0, 'mdAim', [D.id, K.id]), to: D.mdTo || 0, forts: MASSDRIVER.forts === undefined };
  // a save from before, with a Driver aimed at the Outpost: it loads stood down
  D.mdTo = O.id;
  const j = serializeGame();
  let err = '';
  try { deserializeGame(j); } catch (e) { err = String(e && e.message || e); }
  out.err = err;
  const D2 = S.buildings.find((b) => b.type === 'mdriver');
  out.loaded = D2 ? D2.mdTo : -1;
  until(() => false, 10);
  out.status = D2.status;
  return JSON.stringify(out);
`));
check('aiming at an Outpost or a Keep is refused (a Driver aims at Drivers and Catchers only)', /another of your Mass Drivers/.test(fort.outpost) && /another of your Mass Drivers/.test(fort.keep) && !fort.to && fort.forts, fort);
check('a save with a Driver aimed at an Outpost loads, the Driver stood down', !fort.err && fort.loaded === 0 && /Not aimed/.test(fort.status), fort);

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
  C.mdSend = { stone: 20 }; C.mdFire = S.time + 1; C.mdAt = D.id; C.mdAuto = { [D.id]: { stone: 8 } }; bump(C.stock, 'stone', 30); // (and a Catcher that fired, as one did before Nov 28 2026)
  const j = serializeGame(), o = JSON.parse(j);
  for (const b of o.buildings) for (const k of ['mdAuto', 'mdFar', 'mdAt', 'mdNext', 'auto']) delete b[k];
  for (const P of o.players) delete P.mdT;
  let err = '';
  try { deserializeGame(JSON.stringify(o)); } catch (e) { err = String(e && e.message || e); }
  if (err) return JSON.stringify({ err });
  const D2 = S.buildings.find((b) => b.type === 'mdriver'), C2 = S.buildings.find((b) => b.type === 'catcher');
  until(() => (C2.mdGot || 0) >= 24 + 32, 240);
  return JSON.stringify({ got: C2.mdGot, list: Object.keys(D2.mdSend || {}), far: C2.mdFar, catcherAuto: !C2.mdSend, cFire: C2.mdFire || 0, cSent: C2.mdSent || 0, home: D2.mdGot || 0 });
`));
check('a save from before (a Driver with a goods list, its Catcher that fired back) loads and runs one way: the list kept, the Catcher only catches', !old.err && old.got >= 56 && old.list.join() === 'cement' && old.far === 1 && old.catcherAuto && !old.cFire && !old.cSent && !old.home, old);

// ---- a Catcher kit: thrown to an island with no foothold, it assembles itself into a Catcher, claims land, the Driver aims at it
const kitSetup = `{
  newGame({ seed: 11, mode: 'colony', size: 3, shape: SHAPE_PRESETS.findIndex((s) => s.name === 'Islands') });
  ${HELP}
  const L = getE(S.players[0].lander), hz = S.zone[tIdx(L.x, L.y)];
  for (const g of ['cement', 'alloy', 'chip', 'fuel', 'stone']) bump(L.stock, g, 300);
  const d = spot(L.x, L.y, 3, 7, (i, j) => S.zone[tIdx(i, j)] === hz && free(tIdx(i + 1, j)));
  const D = driver(d[0], d[1]); gen(D.x, D.y);
  const far = spot(D.x, D.y, 30, MASSDRIVER.max - 1, (i, j) => S.zone[tIdx(i, j)] !== hz && S.zone[tIdx(i, j)] > 0 && S.owner[tIdx(i, j)] < 0 && dist(i, j, L.x, L.y) > dist(D.x, D.y, L.x, L.y) + 20);
  computeTerritory(); computeZones();
  Object.assign(globalThis, { K: { D: D.id, far } });
}`;
const kc = mk();
const kit = JSON.parse(run(kc, `
  ${kitSetup}
  const D = getE(K.D), far = K.far, out = { far };
  // refused: water, too close, a rival's land, not affordable
  let wet = null; for (let j = 0; j < S.H && !wet; j++) for (let i = 0; i < S.W && !wet; i++) { const dd = dist(i, j, D.x, D.y); if (dd >= 20 && dd <= 40 && S.terrain[tIdx(i, j)] === T_WATER) wet = [i, j]; }
  out.wet = applyOrder(0, 'mdKit', [D.id, wet[0], wet[1]]);
  out.close = applyOrder(0, 'mdKit', [D.id, D.x + 4, D.y + 3]);
  out.ok = applyOrder(0, 'mdKit', [D.id, far[0], far[1]]);
  out.asks = Object.fromEntries(needsOf(D).filter((n) => n[1] > 0)); // (the Catcher's cost, loaded into the kit at the Driver)
  out.status0 = (simStep(SIM_STEP), D.status);
  out.twice = applyOrder(0, 'mdKit', [D.id, far[0], far[1]]);
  until(() => (S.cans || []).some((m) => m.kit), 120);
  out.loadT = Math.round(S.time);
  out.flying = (S.cans || []).some((m) => m.kit && m.from === D.id);
  // a save while it flies: it lands after the load the same way
  const j1 = serializeGame(); deserializeGame(j1);
  until(() => S.buildings.some((b) => !b.dead && b.type === 'catcher'), 20);
  const C = S.buildings.find((b) => !b.dead && b.type === 'catcher');
  out.site = !!C && !C.built && C.kitT === 1;
  out.at = C ? Math.round(dist(C.x, C.y, far[0], far[1])) : -1;
  out.aimed = getE(K.D).mdTo === (C && C.id);
  const t0 = S.time;
  until(() => C.built, 40);
  out.took = Math.round(S.time - t0);
  out.built = C.built;
  out.claim = S.owner[tIdx(C.x, C.y)] === 0 && S.owner[tIdx(C.x + 2, C.y)] === 0;
  out.zone = S.zone[tIdx(C.x, C.y)] !== S.zone[tIdx(getE(K.D).x, getE(K.D).y)];
  // goods fly to it: a deep order there
  C.keep = { cement: 30 };
  until(() => (C.mdGot || 0) > 0, 60);
  out.got = C.mdGot || 0;
  return JSON.stringify(out);
`));
console.log(`  kit landed ${kit.at} tiles from its spot, assembled in ${kit.took} s`);
check('Catcher kit: refused on water, too close, and twice at once; the Driver asks for the Catcher\'s cost, loaded into the kit', /open, empty ground/.test(kit.wet) && /Too close/.test(kit.close) && kit.ok === '' && kit.asks.cement === 8 && kit.asks.alloy === 5 && kit.asks.chip === 3 && /Loading a Catcher kit/.test(kit.status0) && /already has a Catcher kit/.test(kit.twice), kit);
check('Catcher kit: Haulers load it, it flies (and survives a save in flight), lands on its spot as a Catcher site that assembles itself, no Worker, in about 20 s', kit.flying && kit.site && kit.at === 0 && kit.built && kit.took >= 18 && kit.took <= 22, kit);
check('Catcher kit: the new Catcher claims the land round it on the other island, its Driver is aimed at it, and goods fly to it', kit.claim && kit.zone && kit.aimed && kit.got > 0, kit);

// ---- refused on a rival's land and on a Trade Post's ground; Flak bursts a kit (its goods fall as crates)
const kr = JSON.parse(run(mk(), `
  newGame({ seed: 21, mode: 'versus', size: 3, rough: 0 });
  ${HELP}
  const L = getE(S.players[0].lander), hz = S.zone[tIdx(L.x, L.y)], E = getE(S.players[1].lander);
  for (const g of ['cement', 'alloy', 'chip', 'fuel']) bump(L.stock, g, 300);
  const d = spot(L.x, L.y, 3, 6, (i, j) => S.zone[tIdx(i, j)] === hz && free(tIdx(i + 1, j)));
  const D = driver(d[0], d[1]); gen(D.x, D.y);
  computeTerritory(); computeZones();
  const out = {};
  const o = spot(D.x, D.y, 26, 28, (i, j) => dist(i, j, L.x, L.y) > 20); addBuilding(1, 'outpost', o[0], o[1], true); computeTerritory();
  let theirs = null; for (let j = 0; j < S.H && !theirs; j++) for (let i = 0; i < S.W && !theirs; i++) { const t = tIdx(i, j), dd = dist(i, j, D.x, D.y); if (dd >= 14 && dd <= 48 && S.owner[t] === 1 && S.terrain[t] === T_GROUND && !S.bAt[t] && !S.res[t] && !S.road[t]) theirs = [i, j]; }
  out.rival = theirs ? applyOrder(0, 'mdKit', [D.id, theirs[0], theirs[1]]) : 'none';
  const post = (S.posts || []).find((q) => { const dd = dist(q.x, q.y, D.x, D.y); return dd >= 14 && dd <= 48; });
  let pt = null; if (post) for (let dj = -2; dj <= 2 && !pt; dj++) for (let di = -2; di <= 2 && !pt; di++) { const t = tIdx(post.x + di, post.y + dj); if (S.terrain[t] === T_GROUND && !S.bAt[t] && !S.res[t] && !S.road[t] && !S.ramp[t]) pt = [post.x + di, post.y + dj]; }
  out.post = pt ? applyOrder(0, 'mdKit', [D.id, pt[0], pt[1]]) : 'none';
  // Flak under the line
  const far = spot(D.x, D.y, 30, 32, (i, j) => S.owner[tIdx(i, j)] < 0 && !ringOverRival(0, i, j, MASSDRIVER.kitClaim) && dist(i, j, L.x, L.y) > dist(D.x, D.y, L.x, L.y) + 20);
  const mid = spot((D.x + far[0]) / 2, (D.y + far[1]) / 2, 0, 3);
  const F = addBuilding(1, 'flak', mid[0], mid[1], true); bump(F.stock, 'ammo', 50);
  computeTerritory(); computeZones();
  out.ok = applyOrder(0, 'mdKit', [D.id, far[0], far[1]]);
  // (its flak fires as a Flak Gun does; a burst in its splash is what brings a canister down)
  until(() => { const m = (S.cans || []).find((q) => q.kit && canAirborne(q)); if (m) { const p = canPos(m); canFlak(p.x, p.y, 1, BDEFS.flak.flak); } return (S.loot || []).some((l) => l.goods.alloy >= 5) || S.buildings.some((b) => !b.dead && b.type === 'catcher'); }, 60);
  out.burst = (S.loot || []).some((l) => l.goods.alloy >= 5 && l.goods.chip >= 3);
  out.catcher = S.buildings.some((b) => !b.dead && b.type === 'catcher');
  return JSON.stringify(out);
`));
console.log('  refused: ' + kr.rival + ' / ' + kr.post);
check('Catcher kit: refused on a rival\'s land and on a Trade Post\'s ground', /someone else holds/.test(kr.rival) && (kr.post === 'none' || /Trade Post/.test(kr.post)), kr);
check('Catcher kit: an enemy Flak burst brings it down, its goods fall as crates, no Catcher', kr.ok === '' && kr.burst && !kr.catcher, kr);

// ---- a far end nothing collects from fills up to MASSDRIVER.full of a good, then no more goes: "Far end full"
const full = JSON.parse(run(mk(), `
  newGame({ seed: 5, mode: 'colony', size: 3, rough: 0 });
  ${HELP}
  const L = getE(S.players[0].lander), hz = S.zone[tIdx(L.x, L.y)];
  for (const g of ['cement', 'alloy', 'chip', 'fuel']) bump(L.stock, g, 300);
  const d = spot(L.x, L.y, 3, 6, (i, j) => S.zone[tIdx(i, j)] === hz && free(tIdx(i + 1, j)));
  const D = driver(d[0], d[1]); gen(D.x, D.y);
  const far = spot(D.x, D.y, 24, 26, (i, j) => dist(i, j, L.x, L.y) > dist(D.x, D.y, L.x, L.y) + 16);
  const C = addBuilding(0, 'catcher', far[0], far[1], true);
  computeTerritory(); computeZones();
  applyOrder(0, 'mdAim', [D.id, C.id]);
  applyOrder(0, 'mdSend', [D.id, 'cement', true]);
  until(() => { if ((D.stock.cement || 0) < 16) bump(D.stock, 'cement', 16); return false; }, 200);
  const out = { far: C.mdFar, held: C.stock.cement || 0, sent: D.mdSent || 0, status: D.status, max: MASSDRIVER.full };
  // something there takes it: it flows again
  C.stock.cement = 10; const s0 = D.mdSent || 0;
  until(() => { if ((D.stock.cement || 0) < 16) bump(D.stock, 'cement', 16); return (D.mdSent || 0) > s0; }, 30);
  out.again = (D.mdSent || 0) > s0;
  return JSON.stringify(out);
`));
check('a far end nothing collects from stops at ' + 64 + ' of a good, the Driver says "Far end full", and ships again once some is used', full.far === 1 && full.held <= full.max && full.held >= full.max - 16 && full.sent <= full.max + 16 && /Far end full/.test(full.status) && full.again, full);

// ---- the cap is a good at a time (the owner's question, decided Nov 26 2026): 64 Cement nobody collects at the far
// end doesn't stop the Fuel its Generator burns from coming; and every shot burns half a Fuel at its Generator
const cap2 = JSON.parse(run(mk(), `
  newGame({ seed: 5, mode: 'colony', size: 3, rough: 0 });
  ${HELP}
  const L = getE(S.players[0].lander), hz = S.zone[tIdx(L.x, L.y)];
  for (const g of ['cement', 'alloy', 'chip', 'fuel']) bump(L.stock, g, 300);
  const d = spot(L.x, L.y, 3, 6, (i, j) => S.zone[tIdx(i, j)] === hz && free(tIdx(i + 1, j)));
  const D = driver(d[0], d[1]); const GD = gen(D.x, D.y);
  const far = spot(D.x, D.y, 24, 26, (i, j) => dist(i, j, L.x, L.y) > dist(D.x, D.y, L.x, L.y) + 16);
  const C = addBuilding(0, 'catcher', far[0], far[1], true); const GC = gen(C.x, C.y); GC.stock.fuel = 0;
  computeTerritory(); computeZones();
  applyOrder(0, 'mdAim', [D.id, C.id]);
  applyOrder(0, 'mdSend', [D.id, 'cement', true]); applyOrder(0, 'mdSend', [D.id, 'fuel', true]);
  bump(C.stock, 'cement', MASSDRIVER.full); // (full of Cement already, nothing there uses it)
  const f0 = (GD.stock.fuel || 0) + (GD.energy || 0) / BDEFS.generator.burner.perFuel, s0 = D.mdSent || 0;
  until(() => { if ((D.stock.fuel || 0) < 16) bump(D.stock, 'fuel', 16); if ((D.stock.cement || 0) < 16) bump(D.stock, 'cement', 16); return false; }, 120);
  const shots = Math.round(((D.mdSent || 0) - s0) / MASSDRIVER.load), burned = f0 - ((GD.stock.fuel || 0) + (GD.energy || 0) / BDEFS.generator.burner.perFuel);
  return JSON.stringify({ cement: C.stock.cement || 0, fuelThere: (C.stock.fuel || 0) + (GC.stock.fuel || 0), shots, burned: +burned.toFixed(2), perShot: MASSDRIVER.shot / BDEFS.generator.burner.perFuel });
`));
check('the far end\'s cap counts each good on its own: full of Cement, it still takes Fuel', cap2.cement <= 64 && cap2.fuelThere >= 16, cap2);
check('each shot burns about half a Fuel at the Generator in reach', cap2.shots >= 3 && Math.abs(cap2.burned - cap2.shots * cap2.perShot) <= 1.2, cap2);

// ---- the rival builds a pair: a Driver at home and a Catcher kit to an island it holds that no road reaches
const ai = JSON.parse(run(mk(), `
  newGame({ seed: 11, mode: 'versus', size: 3, murmur: 'off', shape: SHAPE_PRESETS.findIndex((s) => s.name === 'Islands') });
  ${HELP}
  const P = S.players[0], L = getE(P.lander), hz = S.zone[tIdx(L.x, L.y)];
  P.style = 'tycoon';
  for (const g of ['cement', 'alloy', 'chip', 'fuel', 'ammo']) bump(L.stock, g, 200);
  // an Outpost of its own on another island (a landing's), 25 to 40 tiles off
  const o = spot(L.x, L.y, 25, 40, (i, j) => S.zone[tIdx(i, j)] !== hz && S.zone[tIdx(i, j)] >= 0 && S.owner[tIdx(i, j)] < 0);
  const O = addBuilding(0, 'outpost', o[0], o[1], true);
  computeTerritory(); computeZones();
  for (let k = 0; k < 2; k++) enterBuilding(addBot(0, 'warbot', O.x, O.y), O);
  O.stock.ammo = 0;
  for (const t of ['foundry', 'fab', 'refinery']) { const q = spot(L.x, L.y, 4, 9, (i, j) => S.zone[tIdx(i, j)] === hz); addBuilding(0, t, q[0], q[1], true); } // (it builds a pair once it makes robots, Chips and Fuel)
  computeTerritory();
  S.time = AI_MDRIVER.from; // (an Architect's from this time)
  const out = { early: 0 };
  P.lastMd = -999; S.difficulty = 'easy'; aiMassDriver(0, playerBuildings(0), L); out.easy = !P.mdPair; S.difficulty = 'normal';
  P.lastMd = -999;
  // (the rival's road planner joins its sites as usual: aiRoads; here, laid at once)
  const roads = () => { for (const b of S.buildings) if (!b.dead && b.owner === 0 && !b.built && !b.roaded && S.zone[tIdx(b.x, b.y)] === hz) { b.roaded = 1; for (const t of roadRouteTo(0, b) || []) setRoad(t % S.W, (t / S.W) | 0, true, 0); } };
  until(() => { aiMassDriver(0, playerBuildings(0), L); roads(); const D = S.buildings.find((b) => !b.dead && b.type === 'mdriver'); return D && D.mdTo && getE(D.mdTo).built; }, 400);
  const D = S.buildings.find((b) => !b.dead && b.type === 'mdriver'), C = D && getE(D.mdTo);
  out.driver = !!D && D.built; out.home = D ? S.zone[tIdx(D.x, D.y)] === hz : false;
  out.gen = S.buildings.some((g) => !g.dead && g.type === 'generator' && D && dist(g.x, g.y, D.x, D.y) <= 4);
  out.catcher = !!C && C.type === 'catcher' && C.built; out.byO = C ? Math.round(dist(C.x, C.y, O.x, O.y)) : -1;
  out.t = Math.round(S.time - AI_MDRIVER.from);
  until(() => { aiMassDriver(0, playerBuildings(0), L); return (O.stock.ammo || 0) > 0 || (C && (C.mdGot || 0) > 0); }, 200);
  out.got = C ? C.mdGot || 0 : 0; out.ammo = O.stock.ammo || 0;
  out.pairs = S.buildings.filter((b) => !b.dead && b.type === 'mdriver').length;
  return JSON.stringify(out);
`));
console.log(`  the rival's pair stood and was aimed ${ai.t} s after it started, its Catcher ${ai.byO} tiles from the Outpost`);
check('a rival (an Architect, not on Easy) builds a Driver at home with a Generator, throws a Catcher kit to its Outpost\'s island, aims it, and goods fly', ai.easy && ai.driver && ai.home && ai.gen && ai.catcher && ai.byO <= 5 && ai.got > 0 && ai.pairs === 1, ai);

// ---- the rival's line to a Catcher its Workers reach, once mines stand round it, gets a Driver beside the Catcher: the
// two Drivers are paired and the far end's Stone flies home (aiMassDriver, aiMdTwoWay)
const aiUp = JSON.parse(run(mk(), `
  newGame({ seed: 5, mode: 'versus', size: 3, rough: 0, murmur: 'off' });
  ${HELP}
  const P = S.players[0], L = getE(P.lander), hz = S.zone[tIdx(L.x, L.y)];
  P.style = 'tycoon';
  for (const g of ['cement', 'alloy', 'chip', 'fuel', 'stone']) bump(L.stock, g, 300);
  const d = spot(L.x, L.y, 3, 6, (i, j) => S.zone[tIdx(i, j)] === hz && free(tIdx(i + 1, j)));
  const D = driver(d[0], d[1]); gen(D.x, D.y);
  const far = spot(D.x, D.y, 28, 30, (i, j) => S.zone[tIdx(i, j)] === hz && dist(i, j, L.x, L.y) > dist(D.x, D.y, L.x, L.y) + 20);
  const C = addBuilding(0, 'catcher', far[0], far[1], true);
  const o = spot(C.x, C.y, 2, 3, (i, j) => S.zone[tIdx(i, j)] === hz), O = addBuilding(0, 'outpost', o[0], o[1], true);
  computeTerritory(); computeZones();
  applyOrder(0, 'mdAim', [D.id, C.id]);
  P.mdPair = { d: D.id, to: O.id, c: C.id, up: 0 };
  S.time = AI_MDRIVER.from + 10; P.lastMd = -999;
  const out = {};
  aiMassDriver(0, playerBuildings(0), L);
  out.noMines = !P.mdPair.up && D.mdTo === C.id;
  // a Quarry by the Catcher: goods to send home
  const q = spot(C.x, C.y, 3, 6, (i, j) => S.zone[tIdx(i, j)] === hz && free(tIdx(i, j))), Q = addBuilding(0, 'quarry', q[0], q[1], true);
  P.lastMd = -999;
  aiMassDriver(0, playerBuildings(0), L);
  const U = getE(P.mdPair.up);
  out.up = !!U && U.type === 'mdriver' && !U.built; out.byC = U ? Math.round(dist(U.x, U.y, C.x, C.y)) : -1;
  if (!U) return JSON.stringify(out);
  U.built = true; U.progress = 1; // (its Workers build it: here, at once)
  const G = gen(U.x, U.y);
  P.lastMd = -999;
  aiMassDriver(0, playerBuildings(0), L);
  out.paired = D.mdTo === U.id && U.mdTo === D.id && P.mdPair.c === U.id;
  bump(U.stock, 'stone', 60);
  const h0 = D.mdGot || 0;
  until(() => { aiMassDriver(0, playerBuildings(0), L); return (D.mdGot || 0) > h0; }, 120);
  out.home = (D.mdGot || 0) - h0;
  return JSON.stringify(out);
`));
check('a rival upgrades a Catcher its Workers reach once mines stand round it: a Driver beside it, paired with the home Driver, and goods fly home', aiUp.noMines && aiUp.up && aiUp.byC <= 5 && aiUp.paired && aiUp.home > 0, aiUp);

// ---- the same run twice ends alike (deterministic)
const h = () => run(mk(), `
  newGame({ seed: 5, mode: 'colony', size: 3, rough: 0 });
  ${HELP}
  const L = getE(S.players[0].lander), hz = S.zone[tIdx(L.x, L.y)];
  for (const g of ['cement', 'alloy', 'chip', 'fuel', 'stone']) bump(L.stock, g, 300);
  const d = spot(L.x, L.y, 3, 6, (i, j) => S.zone[tIdx(i, j)] === hz && free(tIdx(i + 1, j)));
  const D = driver(d[0], d[1]); gen(D.x, D.y);
  const far = spot(D.x, D.y, 26, 28, (i, j) => free(tIdx(i + 1, j)) && dist(i, j, L.x, L.y) > dist(D.x, D.y, L.x, L.y) + 18);
  const C = addBuilding(0, 'mdriver', far[0], far[1], true); gen(C.x, C.y);
  computeTerritory(); computeZones();
  applyOrder(0, 'mdAim', [D.id, C.id]); C.keep = { cement: 40, alloy: 20 }; bump(C.stock, 'stone', 60);
  until(() => false, 150);
  return hashState() + ':' + (C.mdGot || 0) + ':' + (D.mdGot || 0);
`);
const h1 = h(), h2 = h();
check('the same run twice ends alike (a pair, goods both ways)', h1 === h2 && !/:0:|:0$/.test(h1), [h1, h2]);

console.log(fails ? `${fails} FAILED` : 'all passed');
process.exit(fails ? 1 : 0);

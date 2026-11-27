// Headless checks for Terraforming, stage 5: the big projects and greening (RSV, LVL, GREEN in js/defs.js; the stage 5
// block in js/sim.js). Nothing of it exists until it's used. A Reservoir goes only on the rim of a dry, closed basin
// (found as it's placed), fills it with power in three stages (puddling, half, full: the deepest ground first, a stage at
// once) into the game's water: robots in it step ashore, a road across it is worked out again round the lake, its banks
// grow wet and rich, a Port goes on the new shore and a ship sails the lake. A Leveller aimed at a mesa cuts it down to
// its own level, the highest first, every step left one a Ramp can climb (no ramp left leading nowhere), putting 2 Stone
// a level into its hopper for the Haulers. The greening meter counts the open land made green, the same as a count by
// hand, and only from what the layers hold; a Colony game with the Made ready goal is won at GREEN.goal. Saves made
// mid-fill and mid-cut pass checkSave and play on exactly as the game they came from; the same game twice comes out the
// same. Its second mode, Raise a ridge: raised to its planned levels with no step steeper than a level, 2 Stone a level
// from storage (waiting, burning no Fuel, while there is none), left out where it can't go, a robot on it stepping
// aside and a route going round it; a save mid-raise and the same ridge twice. Run: node tools/terraform5-test.js
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const files = ['util', 'defs', 'world', 'path', 'sim', 'ai', 'missions', 'orders'];
const source = files.map((f) => fs.readFileSync(path.join(__dirname, '..', 'js', f + '.js'), 'utf8')).join('\n');
const mk = () => {
  const c = { console, Math, JSON, Map, Set, Array, Object, Number, String, Infinity, Uint8Array, Int8Array, Int16Array, Int32Array, Uint32Array, Float32Array, Uint16Array, sfx: () => {}, performance };
  vm.createContext(c);
  vm.runInContext(source, c);
  return c;
};
const run = (c, code) => JSON.parse(vm.runInContext(`JSON.stringify((() => { ${code} })())`, c));
let fails = 0;
const check = (name, ok, x) => { console.log((ok ? 'PASS ' : 'FAIL ') + name + (ok ? '' : '  ' + JSON.stringify(x))); if (!ok) fails++; };
const { RSV, LVL, GREEN } = run(mk(), 'return { RSV, LVL, GREEN };');

// A Colony game on a plateau (level 1) round the Command Base, with a dry basin (level 0) to its east, ramps down into
// the basin from its west and east rims (so a road can cross it while it's dry), and a two-level mesa to its north.
const HELP = `
  const charged = () => { for (const u of S.bots) u.bat = 100; };
  const until = (fn, secs) => { for (let k = 0; k < 30 * secs && !fn(); k++) { if (k % 30 === 0) charged(); simStep(SIM_STEP); } return fn(); };
  const L = getE(S.players[0].lander);
  const BX = L.x + 11.5, BY = L.y - 3.5, MX = L.x - 2, MY = L.y - 12;
  for (let j = Math.max(0, L.y - 20); j <= S.H - 1; j++) for (let i = Math.max(0, L.x - 8); i <= Math.min(S.W - 1, L.x + 18); i++) {
    const t = tIdx(i, j); S.elev[t] = 1; if (S.bAt[t]) continue;
    S.terrain[t] = T_GROUND; S.res[t] = R_NONE; S.amt[t] = 0; S.road[t] = 0; S.ramp[t] = 0; S.fert[t] = 0; if (S.decor) S.decor[t] = 0; if (S.ford) S.ford[t] = 0;
    if (Math.hypot(i + 0.5 - BX, j + 0.5 - BY) < 4.2) S.elev[t] = 0;
    const m = Math.max(Math.abs(i + 0.5 - MX) / 3.5, Math.abs(j + 0.5 - MY) / 2.5);
    if (m < 1) S.elev[t] = m < 0.55 ? 3 : 2;
  }
  // ramps down into the basin from its north and south rims
  const rampN = tIdx(Math.floor(BX), Math.floor(BY) - 5), rampS = tIdx(Math.floor(BX), Math.floor(BY) + 5);
  S.ramp[rampN] = 1; S.ramp[rampS] = 1;
  terrainChanged();
  S.time = Math.max(RSV.at, LVL.at) + 10;
  const stock = () => { L.stock.cement = 300; L.stock.alloy = 300; L.stock.chip = 100; L.stock.crystal = 100; L.stock.fuel = 100; L.stock.stone = 100; };
  stock();
  const gens = (x, y, n) => { const out = []; for (let k = 0; k < n; k++) { const g = addBuilding(0, 'generator', x + 2 * k, y, true); g.stock.fuel = 30; out.push(g); } return out; };
  Object.assign(globalThis, { until, charged, L, BX, BY, MX, MY, rampN, rampS, gens, stock });
`;
const colony = (seed, extra) => `newGame({ seed: ${seed}, mode: 'colony', size: 1, rough: 0${extra || ''} });
  ${HELP}`;

// ---- nothing of stage 5 until it's used
const none = run(mk(), `newGame({ seed: 5, size: 1 }); for (let k = 0; k < 30 * 30; k++) simStep(SIM_STEP); const s = serializeGame(); return { bank: !!S.rsvBank, lake: !!S.rsvLake, gm: !!S.gm, save: !/"rsvBank"|"rsvLake"|"gm"/.test(s) };`);
check('a Versus game without stage 5 has no banks, no lake and no meter, and none in its save', !none.bank && !none.lake && !none.gm && none.save, none);

// ---- the Reservoir: where it goes
const place = run(mk(), `
  ${colony(5)}
  const at = (i, j) => canPlace(0, 'reservoir', i, j);
  const rim = at(L.x + 4, L.y - 5), basin = rsvBasin(0, L.x + 4, L.y - 5);
  const flat = at(L.x - 5, L.y - 3);          // on level ground with nothing lower beside it
  S.time = 10; const early = at(L.x + 4, L.y - 5); S.time = RSV.at + 10;
  // a road across the basin: it must be clear
  S.road[tIdx(Math.floor(BX), Math.floor(BY))] = 1; const roaded = at(L.x + 4, L.y - 5); S.road[tIdx(Math.floor(BX), Math.floor(BY))] = 0;
  // a basin that runs out: a gap in its rim down to lower ground
  const gap = tIdx(Math.floor(BX) + 5, Math.floor(BY)); const e0 = S.elev[gap]; S.elev[gap] = 0; const t2 = tIdx(Math.floor(BX) + 6, Math.floor(BY)); const e1 = S.elev[t2];
  S.elev[t2] = 0; const t3 = tIdx(Math.floor(BX) + 7, Math.floor(BY)); S.elev[t3] = 0;
  const big = rsvBasin(0, L.x + 4, L.y - 5); S.elev[gap] = e0; S.elev[t2] = e1; S.elev[t3] = 1;
  const r2 = addBuilding(0, 'reservoir', L.x + 4, L.y - 5, false); const again = canPlace(0, 'reservoir', L.x - 5, L.y - 3);
  return { rim, n: basin.ts.length, lv: basin.lv, first: Math.hypot((basin.ts[0] % S.W) + 0.5 - BX, ((basin.ts[0] / S.W) | 0) + 0.5 - BY), last: Math.hypot((basin.ts[basin.ts.length - 1] % S.W) + 0.5 - BX, ((basin.ts[basin.ts.length - 1] / S.W) | 0) + 0.5 - BY), flat: flat.reason, early: early.reason, roaded: roaded.reason, big: big.why || big.ts.length, again: again.reason };
`);
check('Reservoir: goes on the rim of the dry basin (57 tiles of low ground, deepest first), not on flat ground', place.rim.ok && place.n >= RSV.min && place.n <= RSV.max && place.lv === 0 && place.first < place.last && /rim of a dry basin|lower ground/.test(place.flat || ''), place);
check('Reservoir: opens 20 minutes in; the basin must be clear (a road in it) and closed (no way out lower down); one per colony', /opens 20 minutes/.test(place.early) && /must be clear/.test(place.roaded) && /run out|runs on/.test(place.big) && /One Reservoir per colony/.test(place.again), place);

// ---- the Reservoir: filling, robots ashore, the road round, banks, Port and ship
const cF = mk();
const fill = run(cF, `
  ${colony(5)}
  const r = addBuilding(0, 'reservoir', L.x + 4, L.y - 5, true);
  const [g1, g2] = gens(L.x + 4, L.y - 2, 2);
  const X = Math.floor(BX), Y = Math.floor(BY);
  const dry = findPath(X, Y - 6, X, Y + 6, 0);
  // a robot standing in the middle of the basin, and a warbot walking across it
  const w = addBot(0, 'worker', BX, BY); w.task = null;
  const wb = addBot(0, 'warbot', X + 0.5, Y - 5.5);
  applyOrder(0, 'command', [[wb.id], { i: X, j: Y + 6 }]);
  const stages = [], t0 = S.time;
  until(() => { if (r.rv && r.rv.st > (stages.length ? stages[stages.length - 1][0] : 0)) stages.push([r.rv.st, Math.round(S.time - t0), r.rv.ts.filter((t) => S.terrain[t] === T_WATER).length]); return r.rv && r.rv.st >= 3; }, 600);
  const wet = (u) => S.terrain[tIdx(Math.floor(u.x), Math.floor(u.y))] === T_WATER;
  const after = findPath(X, Y - 6, X, Y + 6, 0);
  until(() => false, 60);
  let bank = 0, rich = 0, wetB = 0;
  for (let t = 0; t < S.W * S.H; t++) if (S.rsvBank && S.rsvBank[t]) { bank++; if (S.soil[t] >= SOIL.improving) rich++; if (wetAt(t)) wetB++; }
  // a Port on the new shore, and a ship on the lake
  let port = null;
  for (let j = L.y - 12; j <= L.y + 4 && !port; j++) for (let i = L.x; i <= L.x + 18 && !port; i++) if (canPlace(0, 'port', i, j).ok) port = addBuilding(0, 'port', i, j, true);
  const ship = port ? addBot(0, 'cargoship', BX, BY) : null;
  let sailed = false;
  if (ship) { const c = seaNet().comp; sailed = S.terrain[tIdx(Math.floor(ship.x), Math.floor(ship.y))] === T_WATER && portComps(port).includes(c[tIdx(Math.floor(ship.x), Math.floor(ship.y))]); }
  globalThis.R0 = r;
  return { stages, n: r.rv.ts.length, water: r.rv.ts.filter((t) => S.terrain[t] === T_WATER).length, wIn: wet(w), wbIn: wet(wb), dryLen: dry ? dry.length : -1, across: dry ? dry.some((t) => r.rv.ts.includes(t)) : false,
    afterLen: after ? after.length : -1, afterWet: after ? after.some((t) => S.terrain[t] === T_WATER) : true, bank, rich, wetB, port: !!port, sailed, naval: navalOk(), fuel: [g1.stock.fuel, g2.stock.fuel], status: r.status,
    marked: r.rv.ts.every((t) => S.tfTiles[t] === 1) };
`);
check('Reservoir: fills in three stages at 2, 5 and 8 minutes of power, the deepest quarter, then 60%, then all of it', fill.stages.length === 3 && fill.stages.map((s) => s[0]).join() === '1,2,3' &&
  Math.abs(fill.stages[0][1] - RSV.fill[0]) <= 2 && Math.abs(fill.stages[2][1] - RSV.fill[2]) <= 2 && fill.stages[0][2] === Math.ceil(fill.n * RSV.frac[0]) && fill.water === fill.n && fill.marked, fill);
check('Reservoir: burns a Fuel a minute from each of its 2 Generators; robots in the basin step ashore', fill.fuel[0] >= 30 - 12 && fill.fuel[0] <= 30 - 8 && !fill.wIn && !fill.wbIn, fill);
check('Reservoir: a route across the dry basin goes round the lake once it is full', fill.across && fill.afterLen > 0 && !fill.afterWet && fill.afterLen > fill.dryLen, fill);
check('Reservoir: its banks are wet and grow rich; a Port goes on the new shore and a ship sails the lake', fill.bank >= 20 && fill.wetB === fill.bank && fill.rich > 0 && fill.port && fill.sailed && fill.naval, fill);

// ---- the Leveller: a two-level mesa cut down to its own level, Stone into its hopper, valid cliffs and ramps
const cL = mk();
const lev = run(cL, `
  ${colony(5)}
  const lv = addBuilding(0, 'leveller', MX + 2, MY + 4, true);
  gens(MX + 6, MY + 4, 1);
  const hill = [];
  for (let t = 0; t < S.W * S.H; t++) if (S.elev[t] > 1 && footDist(lv, (t % S.W) + 0.5, ((t / S.W) | 0) + 0.5) <= LVL.reach) hill.push(t);
  const levels = hill.reduce((n, t) => n + S.elev[t] - 1, 0);
  const far = applyOrder(0, 'levelAim', [lv.id, tIdx(L.x + 17, L.y + 4)]), low = applyOrder(0, 'levelAim', [lv.id, tIdx(MX + 6, MY + 6)]);
  const why = applyOrder(0, 'levelAim', [lv.id, tIdx(Math.floor(MX), Math.floor(MY))]);
  // a ramp up the mesa's side, which must not be left leading nowhere
  const rampT = hill.find((t) => S.elev[t] === 2 && tfSides(t).some((u) => S.elev[u] === 1)); const rampU = tfSides(rampT).find((u) => S.elev[u] === 1); S.ramp[rampU] = 1;
  let steep = 0, ramps = 0, maxStone = 0, haul = 0, t0 = S.time, peak = 0;
  const ok = () => { for (let t = 0; t < S.W * S.H; t++) { if (S.terrain[t] !== T_GROUND) continue; for (const u of tfSides(t)) if (S.terrain[u] === T_GROUND && Math.abs(S.elev[t] - S.elev[u]) > 1 && (S.tfTiles[t] || S.tfTiles[u])) return false; } return true; };
  until(() => { maxStone = Math.max(maxStone, lv.stock.stone || 0); if ((lv.stock.stone || 0) >= 40) { haul += lv.stock.stone; lv.stock.stone = 0; } if (S.tick % 300 === 0 && !ok()) steep++; return lv.lvAim === undefined && lv.lvDone; }, 1800);
  haul += lv.stock.stone || 0;
  const left = hill.filter((t) => S.elev[t] > 1).length;
  return { why, far, low, levels, hill: hill.length, mins: Math.round((S.time - t0) / 6) / 10, haul, maxStone, steep, left, rampGone: S.ramp[rampU] === 0, stats: S.players[0].stats.levelled, done: lv.lvDone, status: lv.status };
`);
check('Leveller: aimed at a mesa within reach (not at far or low ground)', lev.why === '' && /Out of reach/.test(lev.far) && /higher than/.test(lev.low), lev);
check('Leveller: cuts the whole mesa down to its own level, a level every 6 s, never a step of more than a level', lev.left === 0 && lev.done === 1 && lev.steep === 0 && lev.stats === lev.levels && Math.abs(lev.mins - (lev.levels * LVL.every) / 60) < 1.5, lev);
check('Leveller: 2 Stone a level into its hopper (60 at most) for the Haulers; a ramp left leading nowhere goes', lev.haul === lev.levels * LVL.stone && lev.maxStone <= LVL.cap && lev.rampGone, lev);

// ---- the hopper full: it waits; Haulers carry Stone off it
const hop = run(mk(), `
  ${colony(5)}
  const lv = addBuilding(0, 'leveller', MX + 2, MY + 4, true); gens(MX + 6, MY + 4, 1);
  applyOrder(0, 'levelAim', [lv.id, tIdx(Math.floor(MX), Math.floor(MY))]);
  lv.stock.stone = LVL.cap; until(() => false, 30); const waited = !lv.lvN && /hopper is full/.test(lv.status);
  for (let j = lv.y; j <= L.y; j++) { const t = tIdx(lv.x - 1, j); if (!S.bAt[t]) { S.road[t] = 1; S.pave[t] = 1; S.wown[t] = 0; } } S.roadVer++; computeZones();
  for (let k = 0; k < 3; k++) addBot(0, 'hauler', L.x + 1.5, L.y + 2.5);
  const s0 = lv.stock.stone; until(() => (lv.stock.stone || 0) < s0 - 10, 300);
  return { waited, s0, s1: lv.stock.stone, status: lv.status, unl: lv.unlinked, hs: S.bots.filter((u) => u.type === 'hauler').map((u) => [u.x.toFixed(1), u.y.toFixed(1), u.task && u.task.type, u.bat]), lv: [lv.x, lv.y], L: [L.x, L.y] };
`);
check('Leveller: with its hopper full it waits; Haulers carry the Stone off', hop.waited && hop.s1 < hop.s0, hop);

// ---- the Leveller's second mode: a ridge raised along a line on the plateau west of the base (its west end on the
// plateau's edge, a level above the low ground beyond: no room there for a crest)
const RIDGE = `
  const lv = addBuilding(0, 'leveller', L.x - 5, L.y - 7, true);
  gens(L.x - 1, L.y - 8, 1);
  const Y = L.y - 2, line = []; for (let i = L.x - 8; i <= L.x + 3; i++) line.push(tIdx(i, Y));
  const stoneHave = () => { let n = 0; for (const b of S.buildings) if (!b.dead && b.owner === 0) n += supplyOf(b, 'stone'); return n; };
  const steepNow = () => { for (let t = 0; t < S.W * S.H; t++) { if (S.terrain[t] !== T_GROUND || !S.tfTiles || !S.tfTiles[t]) continue; for (const u of tfSides(t)) if (S.terrain[u] === T_GROUND && Math.abs(S.elev[t] - S.elev[u]) > 1) return true; } return false; };
  Object.assign(globalThis, { lv, Y, line, stoneHave, steepNow });
`;
const cR = mk();
const ridge = run(cR, `
  ${colony(5)}
  ${RIDGE}
  const P = ridgePlan(lv, line), e0 = P.ts.map((t) => S.elev[t]);
  const X = L.x - 2, before = findPath(X, Y - 3, X, Y + 2, 0);
  // a Worker standing on the line, where the crest goes
  const w = addBot(0, 'worker', X + 0.5, Y + 0.5); w.task = null;
  const why = applyOrder(0, 'levelRidge', [lv.id, line]);
  const s0 = stoneHave(), t0 = S.time;
  let steep = 0, tc = 0, onRidge = 0; const was = terrainChanged; globalThis.terrainChanged = () => { tc++; was(); };
  until(() => { if (S.tick % 60 === 0 && steepNow()) steep++; if (S.tick % 15 === 0 && P.ts.some((t, k) => S.elev[t] > e0[k] && tIdx(Math.floor(w.x), Math.floor(w.y)) === t)) onRidge++; return !lv.rgTs; }, 900);
  globalThis.terrainChanged = was;
  const after = findPath(X, Y - 3, X, Y + 2, 0);
  return { why, levels: P.levels, n: P.ts.length, crest: line.map((t) => S.elev[t]), rows: P.rows, reached: P.ts.every((t, k) => S.elev[t] === P.to[k]), maxUp: Math.max(...P.to.map((v, k) => v - e0[k])),
    mins: (S.time - t0) / 60, used: s0 - stoneHave(), steep, tc, onRidge, done: lv.rgDone, ridged: S.players[0].stats.ridged, status: lv.status,
    before: before ? before.length : -1, after: after ? after.length : -1, crosses: after ? after.some((t) => P.ts.includes(t)) : true, marked: P.ts.every((t) => S.tfTiles[t] === 1) };
`);
check('ridge: raised to its planned levels, 2 up in the middle and 1 at the ends, shoulders beside it; none where the plateau\'s edge leaves no room', ridge.why === '' && ridge.reached && ridge.done === 1 && ridge.maxUp === LVL.ridgeH &&
  ridge.crest[0] === 1 && ridge.crest[1] === 2 && ridge.crest[5] === 3 && ridge.crest[11] === 2 && /no room/.test(ridge.rows[0]) && ridge.ridged === ridge.levels && ridge.marked, ridge);
check('ridge: never a step of more than a level, a level every 4 s, one terrainChanged a batch of 4', ridge.steep === 0 && Math.abs(ridge.mins - (ridge.levels * LVL.ridgeEvery) / 60) < 0.5 && ridge.tc === Math.ceil(ridge.levels / LVL.batch), ridge);
check('ridge: 2 Stone a level taken from storage', ridge.used === ridge.levels * LVL.ridgeStone, ridge);
check('ridge: a Worker on the line steps aside; a route across it goes round it', ridge.onRidge === 0 && ridge.before > 0 && ridge.after > ridge.before + 4 && !ridge.crosses, ridge);

// ---- where a ridge can't go, and waiting for Stone
const refuse = run(mk(), `
  ${colony(5)}
  ${RIDGE}
  const at = (k) => line[k];
  S.road[at(3)] = 1; S.res[at(5)] = R_ORE; S.amt[at(5)] = 50; S.terrain[at(7)] = T_WATER;
  terrainChanged();
  S.owner[at(9)] = 1; // (a rival's land: after the territory is worked out again)
  const P = ridgePlan(lv, line), e = line.map((t) => S.elev[t]);
  const long = []; for (let i = L.x - 8; i <= L.x + 5; i++) long.push(tIdx(i, Y));
  const gap = [line[0], line[2]], far = [tIdx(L.x + 12, L.y + 4), tIdx(L.x + 13, L.y + 4)];
  const whyLong = applyOrder(0, 'levelRidge', [lv.id, long]), whyGap = applyOrder(0, 'levelRidge', [lv.id, gap]), whyFar = applyOrder(0, 'levelRidge', [lv.id, far]);
  const foe = applyOrder(1, 'levelRidge', [lv.id, line]);
  // no Stone to spare: it waits, burning no Fuel; Stone comes in and it goes on
  for (const b of S.buildings) if (b.owner === 0 && b.stock.stone) b.stock.stone = 0;
  const g = S.buildings.find((b) => b.type === 'generator' && b.owner === 0 && Math.abs(b.x - (L.x - 1)) < 1);
  const why = applyOrder(0, 'levelRidge', [lv.id, line]);
  const f0 = g.stock.fuel; until(() => false, 30);
  const waited = { status: lv.status, fuel: f0 - g.stock.fuel, up: line.some((t, k) => S.elev[t] !== e[k]), working: lv.working };
  L.stock.stone = 40; until(() => S.players[0].stats.ridged >= 4, 60);
  const left = [3, 5, 7, 9].map((k) => S.elev[line[k]] === e[k]);
  return { rows: P.rows, whyLong, whyGap, whyFar, foe, why, waited, ridged: S.players[0].stats.ridged, left, steep: steepNow() };
`);
check('ridge: not on a road, resources, water or a rival\'s land (each left out, the rest raised)', /road/.test(refuse.rows[3]) && /resources/.test(refuse.rows[5]) && /water/.test(refuse.rows[7]) && /rival/.test(refuse.rows[9]) &&
  refuse.why === '' && refuse.left.every(Boolean) && !refuse.steep, refuse);
check('ridge: refused too long, broken, out of reach, or by a rival', /at most/.test(refuse.whyLong) && /each beside the last/.test(refuse.whyGap) && /out of reach/.test(refuse.whyFar) && /gone/.test(refuse.foe), refuse);
check('ridge: with no Stone in storage it waits and burns no Fuel; with Stone it goes on', /Waiting for Stone/.test(refuse.waited.status) && refuse.waited.fuel === 0 && !refuse.waited.up && !refuse.waited.working && refuse.ridged >= 4, refuse);
const bld = run(mk(), `
  ${colony(5)}
  ${RIDGE}
  const d = addBuilding(0, 'depot', L.x - 3, Y, true);
  const P = ridgePlan(lv, line);
  return { rows: P.rows, at: line.indexOf(tIdx(L.x - 3, Y)), raised: P.ts.some((t) => S.bAt[t]) };
`);
check('ridge: not on a building (left out; nothing raised under it)', bld.at >= 0 && /building/.test(bld.rows[bld.at]) && !bld.raised, bld);

// ---- the greening meter: the same as a count by hand, and only from the layers
const cG = mk();
const meter = run(cG, `
  ${colony(5)}
  const byHand = () => { const rain = greenRain(); let of = 0, n = 0, k = [0, 0, 0, 0, 0]; for (let t = 0; t < S.W * S.H; t++) { if (S.terrain[t] !== T_GROUND || S.bAt[t] || S.road[t] || S.ramp[t] || (S.rail && S.rail[t]) || [R_BOULDER, R_ORE, R_CRYSTAL, R_OIL, R_URANIUM].includes(S.res[t])) continue; of++; const g = greenKind(t, rain); if (g) { n++; k[g]++; } } return { of, n, k }; };
  until(() => false, 2);
  const a0 = { of: S.gm.of, n: S.gm.n[0] }, h0 = byHand();
  // some of each: soil, a grove, wet ground, a shifted tile, graded ground
  const free = []; for (let t = 0; t < S.W * S.H && free.length < 40; t++) if (S.terrain[t] === T_GROUND && !S.bAt[t] && !S.road[t] && !S.res[t] && !S.ramp[t] && S.elev[t] === 1 && S.owner[t] === 0) free.push(t);
  for (const t of free.slice(0, 8)) t2Layer('soil')[t] = SOIL.rich;
  for (const t of free.slice(8, 14)) { t2Layer('grove')[t] = 50; t2Layer('grvO')[t] = 1; }
  for (const t of free.slice(14, 18)) t2Layer('shift')[t] = 1;
  for (const t of free.slice(18, 21)) { S.tfTiles = S.tfTiles || {}; S.tfTiles[t] = 1; }
  for (const t of free.slice(21, 22)) t2Layer('soil')[t] = SOIL.improving - 1; // (barren: not green)
  // a building on green ground takes it out of the open land
  const b = addBuilding(0, 'depot', free[0] % S.W, (free[0] / S.W) | 0, true);
  const before = S.gm.n[0];
  until(() => false, 1.1);
  const a1 = { of: S.gm.of, n: S.gm.n[0], k: S.gm.k }, h1 = byHand();
  // nothing changes, nothing more counted; and it is worked out once a second only
  let runs = 0; const was = greenTick; globalThis.greenTick = () => { runs++; was(); };
  until(() => false, 10);
  globalThis.greenTick = was;
  return { a0, h0, a1, h1, before, share: greenShare(0), runs };
`);
check('meter: counts the open land and the green on it the same as a count by hand, by kind', meter.a0.of === meter.h0.of && meter.a0.n === meter.h0.n && meter.a1.of === meter.h1.of && meter.a1.n === meter.h1.n && meter.a1.k.join() === meter.h1.k.join(), meter);
check('meter: soil, groves, shifted and graded ground count (barren soil and a depot\'s tile don\'t)', meter.a1.n - meter.a0.n === 20 && meter.a1.k[4] === 6 && meter.a1.k[3] === 4 && meter.a1.of === meter.a0.of - 1, meter);
check('meter: worked out once a second, not every tick', meter.runs >= 9 && meter.runs <= 11, meter);

// ---- the Colony goal: Made ready at GREEN.goal
const win = run(mk(), `
  newGame({ seed: 7, mode: 'colony', size: 0, rough: 0, greenWin: true });
  ${HELP.replace(/const L = getE[^;]*;/, 'const L = getE(S.players[0].lander);')}
  const on = !!S.settings.greenWin;
  until(() => false, 2);
  const s0 = greenShare(0), w0 = S.winner;
  // green all but a little of the open land, then the rest
  const open = []; for (let t = 0; t < S.W * S.H; t++) if (greenOpen(t)) open.push(t);
  const need = Math.ceil(open.length * GREEN.goal);
  for (const t of open.slice(0, need - 5)) t2Layer('soil')[t] = SOIL.rich;
  until(() => false, 2);
  const nearly = S.winner;
  for (const t of open.slice(need - 5, need + 2)) t2Layer('soil')[t] = SOIL.rich;
  until(() => S.winner >= 0, 3);
  return { on, s0, w0, nearly, winner: S.winner, how: S.endHow, share: greenShare(0) };
`);
check('Colony goal Made ready: on with the setting; the colony wins on reaching 60% of the open land, not before', win.on && win.w0 < 0 && win.nearly < 0 && win.winner === 0 && win.how === 'green' && win.share >= GREEN.goal && GREEN.goal === 0.6, win);
const nowin = run(mk(), `newGame({ seed: 7, mode: 'colony', size: 0, rough: 0 }); for (let t = 0; t < S.W * S.H; t++) if (greenOpen(t)) t2Layer('soil')[t] = SOIL.rich; for (let k = 0; k < 90; k++) simStep(SIM_STEP); return { w: S.winner, share: greenShare(0) };`);
check('Colony goal: without the setting, greening the land wins nothing (free play)', nowin.w < 0 && nowin.share > 0.9, nowin);

// ---- saves mid-fill and mid-cut, played on, come out as the game they came from
const mid = (c) => run(c, `
  ${colony(9)}
  const r = addBuilding(0, 'reservoir', L.x + 4, L.y - 5, true); gens(L.x + 4, L.y - 2, 2);
  const lv = addBuilding(0, 'leveller', MX + 2, MY + 4, true); gens(MX + 6, MY + 4, 1);
  applyOrder(0, 'levelAim', [lv.id, tIdx(Math.floor(MX), Math.floor(MY))]);
  until(() => r.rv && r.rv.st >= 1 && lv.lvN > 0, 400);
  return { st: r.rv.st, n: lv.lvN };
`);
const cA = mk(), cB = mk();
const m = mid(cA);
const saved = run(cA, 'return serializeGame();');
let saveOk = true;
try { run(cB, `checkSave(JSON.parse(${JSON.stringify(saved)})); return 1;`); } catch (e) { saveOk = String(e); }
const loaded = run(cB, `deserializeGame(${JSON.stringify(saved)}); return { h: hashState(), tick: S.tick };`);
const goOn = (c) => run(c, `for (let k = 0; k < 30 * 240; k++) { if (k % 30 === 0) for (const u of S.bots) u.bat = 100; simStep(SIM_STEP); } const r = S.buildings.find((b) => b.type === 'reservoir'), lv = S.buildings.find((b) => b.type === 'leveller'); return { h: hashState(), st: r.rv.st, cut: S.players[0].stats.levelled || 0, gm: S.gm && S.gm.n[0] };`);
const hA0 = run(cA, 'return hashState();');
const a = goOn(cA), b = goOn(cB);
check('a save made mid-fill and mid-cut passes checkSave and loads to the same state', saveOk === true && m.st >= 1 && m.n > 0 && loaded.h === hA0, { saveOk, m, loaded, hA0 });
check('...and plays on exactly as the game it came from', a.h === b.h && a.st === b.st && a.cut === b.cut && a.gm === b.gm && a.st >= 2, { a, b });

// ---- the same game twice
const twice = () => { const c = mk(); mid(c); return goOn(c); };
const t1 = twice(), t2 = twice();
check('the same game twice comes out the same (fill, cut, meter)', t1.h === t2.h && t1.cut === t2.cut, { t1, t2 });

// ---- a save mid-raise, played on; the same ridge twice
const midR = (c) => run(c, `
  ${colony(9)}
  ${RIDGE}
  const w = addBot(0, 'worker', L.x - 1.5, Y + 0.5); w.task = null;
  applyOrder(0, 'levelRidge', [lv.id, line]);
  until(() => S.players[0].stats.ridged >= 8 && lv.lvN > 0 && lv.rgPaid, 300);
  const h0 = hashState(); lv.rgTo[3]--; const h1 = hashState(); lv.rgTo[3]++;
  return { up: S.players[0].stats.ridged, n: lv.lvN, paid: lv.rgPaid, hashed: h0 !== h1 };
`);
const cRA = mk(), cRB = mk();
const mr = midR(cRA);
const savedR = run(cRA, 'return serializeGame();');
let saveROk = true;
try { run(cRB, `checkSave(JSON.parse(${JSON.stringify(savedR)})); return 1;`); } catch (e) { saveROk = String(e); }
const loadedR = run(cRB, `deserializeGame(${JSON.stringify(savedR)}); const lv = S.buildings.find((b) => b.type === 'leveller'); return { h: hashState(), ts: lv.rgTs.length, line: lv.rgLine.length };`);
const hR0 = run(cRA, 'return hashState();');
const goOnR = (c) => run(c, `for (let k = 0; k < 30 * 200; k++) { if (k % 30 === 0) for (const u of S.bots) u.bat = 100; simStep(SIM_STEP); } const lv = S.buildings.find((b) => b.type === 'leveller'); let e = 0; for (let t = 0; t < S.W * S.H; t++) if (S.tfTiles && S.tfTiles[t]) e += S.elev[t]; return { h: hashState(), up: S.players[0].stats.ridged, done: lv.rgDone, e };`);
const ra = goOnR(cRA), rb = goOnR(cRB);
check('a save made mid-raise (levels piled, Stone taken) passes checkSave and loads to the same state; the ridge is in the hash', saveROk === true && mr.n > 0 && mr.paid === 1 && mr.hashed && loadedR.h === hR0 && loadedR.ts > 0 && loadedR.line === 12, { saveROk, mr, loadedR, hR0 });
check('...and plays on exactly as the game it came from, to the finished ridge', ra.h === rb.h && ra.up === rb.up && ra.e === rb.e && ra.done === 1, { ra, rb });
const tw = () => { const c = mk(); midR(c); return goOnR(c); };
const r1 = tw(), r2 = tw();
check('the same ridge twice comes out the same', r1.h === r2.h && r1.up === r2.up && r1.e === r2.e, { r1, r2 });

console.log(fails ? `${fails} failed` : 'all passed');
process.exit(fails ? 1 : 0);

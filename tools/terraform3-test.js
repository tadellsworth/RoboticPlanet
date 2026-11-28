// Headless checks for Terraforming, stage 3: resources from the ground (SEAM, SEED, THERMAL in js/defs.js; the stage 3
// block in js/sim.js). No seams exist, and nothing changes, until a Seam Drill surveys; a drill's survey finds the
// hidden seams near it (for its colony only) and reaches further while it has power; it drills its seam slowly with
// power (none without), and a seam worked out is spent; a Seed Mast prepares and seeds beds round it, grows them
// through seeded, sprouting and ripe with power, its beds starve and stop without it, and a ripe bed's Crystal is
// gathered by a Crystal Tap and the bed prepared again; a growing field draws the Murmur a little; a Thermal Plant goes
// only beside hot ground and powers what's round it with no Fuel (a Maglev Terminal and a Mass Driver end too, a
// shot then costing no Fuel, but never a megastructure); a Seed Mast is refused on Argos; a save made
// mid-process passes checkSave and plays on exactly as the game it came from; and the same game twice comes out the
// same. Run: node tools/terraform3-test.js
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
const run = (c, code) => JSON.parse(vm.runInContext(`JSON.stringify((() => { ${code} })())`, c));
let fails = 0;
const { SEAM, SEED } = run(mk(), 'return { SEAM, SEED };');
const check = (name, ok, x) => { console.log((ok ? 'PASS ' : 'FAIL ') + name + (ok ? '' : '  ' + JSON.stringify(x))); if (!ok) fails++; };

const HELP = `
  const charged = () => { for (const u of S.bots) u.bat = 100; };
  const until = (fn, secs) => { for (let k = 0; k < 30 * secs && !fn(); k++) { if (k % 30 === 0) charged(); simStep(SIM_STEP); } return fn(); };
  // Open ground of ours (no resources, nothing on it) near (x, y), d0..d1 tiles out, with a square of side 2r + 1 open.
  const open = (x, y, r, d0, d1, pred) => { for (let d = d0; d <= d1; d++) for (let j = y - d; j <= y + d; j++) for (let i = x - d; i <= x + d; i++) {
    if (Math.max(Math.abs(i - x), Math.abs(j - y)) !== d) continue;
    let ok = true;
    for (let b = j - r; b <= j + r && ok; b++) for (let a = i - r; a <= i + r && ok; a++) { if (!inMap(a, b)) { ok = false; break; } const t = tIdx(a, b); if (!soilOpen(t, 0) || S.res[t] || S.fert[t] || S.plan[t] || (S.owner[t] !== 0 && S.owner[t] !== -1) || S.elev[t] !== S.elev[tIdx(i, j)] || S.zone[t] !== S.zone[tIdx(x, y)]) ok = false; }
    if (ok && (!pred || pred(i, j))) return tIdx(i, j); } return -1; };
  const fuel = (g) => { g.stock.fuel = BDEFS.generator.fuelCap; };
  Object.assign(globalThis, { until, open, charged, fuel });
`;
const colony = (seed, biome, shape) => `newGame({ seed: ${seed}, mode: 'colony', size: 1, rough: 2${shape ? `, shape: SHAPE_PRESETS.findIndex((s) => s.name === '${shape}')` : ''}${biome ? `, biome: '${biome}'` : ''} });
  ${HELP}
  const L = getE(S.players[0].lander); L.stock.stone = 300; L.stock.fiber = 300; L.stock.cement = 300; L.stock.alloy = 200; L.stock.chip = 60; L.stock.crystal = 60;`;

// ---- no seams, beds or anything else until a Seam Drill surveys (nothing made, saved or hashed)
const none = run(mk(), `${colony(5)} until(() => false, 40); return { seams: S.seams === undefined || S.seams === null, layers: T3_LAYERS.filter((k) => S[k]), any: t3Any(), save: !/"seams"|"sbed"/.test(serializeGame()) };`);
check('a game without stage 3 has no seams, no bed layers, and none in its save', none.seams && !none.layers.length && !none.any && none.save, none);

// ---- the seams come from the map's seed, the same each time, and making them changes nothing on the map
const seamsOf = (seed) => run(mk(), `${colony(seed)} const before = [Array.from(S.res).join(), Array.from(S.amt).join(), Array.from(S.terrain).join()].join('|'); t3SeamsMake();
  const after = [Array.from(S.res).join(), Array.from(S.amt).join(), Array.from(S.terrain).join()].join('|');
  return { n: S.seams.length, ore: S.seams.filter((s) => s.g === 'ore').length, cry: S.seams.filter((s) => s.g === 'crystal').length, same: before === after, key: S.seams.map((s) => s.x + ',' + s.y + s.g + s.m).join(';'), found: S.seams.filter((s) => s.f).length };`);
const sA = seamsOf(7), sB = seamsOf(7);
check('hidden seams: made from the map\'s seed (the same twice), Ore and Crystal, found by no-one yet, the map untouched', sA.n >= 4 && sA.ore > 0 && sA.cry > 0 && sA.key === sB.key && sA.same && sA.found === 0, { n: sA.n, ore: sA.ore, cry: sA.cry, same: sA.same });

// ---- a Seam Drill: survey, find, drill with power (not without), work a seam out
const cD = mk();
const drill = run(cD, `
  ${colony(7)}
  // a seam of ours a few tiles from open ground (made here only to choose where the drill stands; it would be the same)
  const seams = t3SeamsMake().slice();
  S.seams = null;
  let spot = -1, target = null;
  for (const s of seams) { if (S.owner[tIdx(s.x, s.y)] !== 0 && S.owner[tIdx(s.x, s.y)] !== -1) continue; const c = open(s.x, s.y, 1, 2, 3, (i, j) => Math.min(...s.t.map((t) => Math.hypot((t % S.W) - i, ((t / S.W) | 0) - j))) <= SEAM.survey[0] - 0.6); if (c >= 0) { spot = c; target = s; break; } }
  const dx = spot % S.W, dy = (spot / S.W) | 0;
  const d = addBuilding(0, 'seamdrill', dx, dy, true);
  until(() => d.svR > 0, 2);
  const made = !!S.seams, found = S.seams.filter((s) => seamFound(s, 0)).length, foundRival = S.seams.filter((s) => seamFound(s, 1)).length, tFound = seamFound(S.seams[target.id - 1], 0);
  // no power: nothing drilled, no deeper survey
  until(() => false, 40);
  const unpowered = { ore: (d.stock.ore || 0) + (d.stock.crystal || 0), svR: d.svR, status: d.status };
  // a Generator with Fuel beside it
  let gs = -1; for (const [a, b] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-1, -1], [1, -1], [-1, 1], [2, 0], [0, 2], [-2, 0], [0, -2]]) if (canPlace(0, 'generator', dx + a, dy + b).ok) { gs = tIdx(dx + a, dy + b); break; }
  const g = addBuilding(0, 'generator', gs % S.W, (gs / S.W) | 0, true); fuel(g);
  const s0 = seamOf(d), n0 = s0 ? s0.n : 0, g0 = s0 ? s0.g : '';
  until(() => { fuel(g); for (const k of ['ore', 'crystal']) d.stock[k] = 0; return false; }, 62);
  const s1 = S.seams[s0.id - 1], dug = n0 - s1.n, svR = d.svR;
  // a minute of drilling: SEAM.rate; then work it out (its last few)
  s1.n = 3;
  until(() => { fuel(g); for (const k of ['ore', 'crystal']) d.stock[k] = 0; return s1.n <= 0; }, 300);
  const spent = s1.n === 0, unlinked = d.seam !== s1.id, pips = seamPips(s1), msg = S.msgs.some((m) => /worked out/.test(m.text));
  return { made, found, foundRival, tFound, unpowered, dug, g0, svR, spent, unlinked, pips, msg, fuelUsed: S.players[0].used.fuel || 0, stats: S.players[0].stats.seams };
`);
check('a Seam Drill surveys as it stands: the seams near it are found for its colony, not a rival\'s', drill.made && drill.found >= 1 && drill.tFound && drill.foundRival === 0, drill);
check('without power it drills nothing and surveys no deeper', drill.unpowered.ore === 0 && drill.unpowered.svR === SEAM.survey[0] && /No power/.test(drill.unpowered.status), drill.unpowered);
check('with a Generator burning Fuel it drills its seam at SEAM.rate a minute and surveys further', Math.abs(drill.dug - SEAM.rate[drill.g0]) <= 1 && drill.svR === SEAM.survey[0] + 2 && drill.fuelUsed >= 1, drill);
check('a seam worked out is spent (no pips) and the drill lets it go, its owner told', drill.spent && drill.unlinked && drill.pips === 0 && drill.msg, drill);

// ---- a Seed Mast: prepare, seed, grow, ripen with power; starve without; a Crystal Tap gathers and the bed starts again
const cS = mk();
const seed = run(cS, `
  ${colony(5)}
  const c = open(L.x, L.y, 2, 6, 24), cx = c % S.W, cy = (c / S.W) | 0;
  const m = addBuilding(0, 'seedmast', cx, cy, true); m.stock.crystal = SEED.hopper;
  const g = addBuilding(0, 'generator', cx + 3, cy, true); fuel(g);
  const tp = addBuilding(0, 'tap', cx + 1, cy, true); // (a Crystal Tap beside the Mast reaches every bed; its worker comes later)
  tp.paused = true;
  const feed = () => { fuel(g); m.stock.crystal = SEED.hopper; };
  until(() => { feed(); return bedsOf(m).length >= SEED.most; }, 120);
  const beds = bedsOf(m).slice(), stages0 = beds.map(bedStage);
  until(() => { feed(); return beds.every((t) => bedStage(t) >= 3); }, 400);
  const sprout = beds.map(bedStage);
  // starve: no Fuel for a minute
  g.stock.fuel = 0; g.energy = 0;
  until(() => false, 8);
  const v0 = beds.map((t) => S.sbed[t]);
  until(() => false, 60);
  const v1 = beds.map((t) => S.sbed[t]), starved = beds.filter((t) => S.sbS[t]).length, sStatus = m.status;
  const murmur = bedsGrowing(m);
  until(() => { feed(); return beds.every((t) => bedStage(t) === 4); }, 600);
  const ripe = beds.filter((t) => S.res[t] === R_CRYSTAL && S.amt[t] === SEED.yield).length, unstarved = beds.filter((t) => S.sbS[t]).length;
  // a Crystal Tap with its worker gathers the grown Crystal; each bed is prepared again
  tp.paused = false; addBot(0, 'worker', cx + 1, cy + 1);
  const crystal0 = S.players[0].made.crystal || 0;
  until(() => { feed(); tp.stock.crystal = 0; return (S.players[0].stats.bedHarvests || 0) >= 6; }, 400);
  return { stages0, sprout, v0, v1, starved, sStatus, murmur, ripe, unstarved, again: beds.map(bedStage), gathered: (S.players[0].made.crystal || 0) - crystal0, harv: S.players[0].stats.bedHarvests || 0 };
`);
check('a Seed Mast prepares its beds (up to SEED.most) and seeds them, and with power they sprout', seed.stages0.length === 6 && seed.sprout.every((s) => s >= 3), seed);
check('without power its beds starve (marked) and stop growing', JSON.stringify(seed.v0) === JSON.stringify(seed.v1) && seed.starved === 6 && /Starved/.test(seed.sStatus), seed);
check('with power again they ripen: each holds SEED.yield Crystal as a cluster, no longer starved', seed.ripe === 6 && seed.unstarved === 0, seed);
check('a Crystal Tap gathers the grown Crystal, and the beds are seeded again', seed.gathered >= 6 * 3 && seed.harv >= 6 && seed.again.every((s) => s >= 1 && s <= 3), seed);
const mur = run(cS, `const m = S.buildings.find((b) => b.type === 'seedmast'); return { growing: bedsGrowing(m), worth: chargeWorth(m) };`);
check('a growing Crystal Seedbed draws the Murmur a little (charge, like a power plant\'s)', mur.growing > 0 && mur.worth === 3, mur);

// ---- the Thermal Plant: only beside hot ground; power with no Fuel
const cT = mk();
const th = run(cT, `
  ${colony(11, 'volcanic', 'Lakes')}
  let hot = -1, cold = -1;
  for (let j = 2; j < S.H - 2 && (hot < 0 || cold < 0); j++) for (let i = 2; i < S.W - 2; i++) {
    const t = tIdx(i, j);
    if (S.terrain[t] !== T_GROUND || S.res[t] || S.bAt[t] || S.road[t]) continue;
    if (hot < 0 && thermalHeat(t) && canPlace(0, 'thermal', i, j).ok) hot = t;
    if (cold < 0 && !thermalHeat(t) && dist2(i, j, L.x, L.y) > 9 && canPlace(0, 'generator', i, j).ok) cold = t;
  }
  const coldOk = canPlace(0, 'thermal', cold % S.W, (cold / S.W) | 0);
  if (hot < 0 || cold < 0) return { hot, cold };
  const hx = hot % S.W, hy = (hot / S.W) | 0, p = addBuilding(0, 'thermal', hx, hy, true);
  let ds = -1; for (let r = 1; r <= 3 && ds < 0; r++) for (let j = hy - r; j <= hy + r && ds < 0; j++) for (let i = hx - r; i <= hx + r; i++) if (inMap(i, j) && dist2(i, j, hx, hy) <= 9 && canPlace(0, 'seamdrill', i, j).ok) { ds = tIdx(i, j); break; }
  const d = addBuilding(0, 'seamdrill', ds % S.W, (ds / S.W) | 0, true);
  until(() => false, 70);
  return { hot: hot >= 0, coldOk: coldOk.ok, why: coldOk.reason, svR: d.svR, powered: t3Powered(d) || d.boostUntil > S.time - 2, thermalFuel: p.stock.fuel || 0, used: (S.players[0].used || {}).fuel || 0, status: p.status, working: p.useT > 0 };
`);
check('a Thermal Plant only goes beside lava or hot water', th.hot && !th.coldOk && /Thermal Plant/.test(th.why || ''), th);
check('a Thermal Plant powers a Seam Drill in reach with no Fuel (the drill surveys further)', th.svR > SEAM.survey[0] && th.thermalFuel === 0 && th.used === 0, th);
// ---- the Thermal Plant powers a Maglev Terminal and a Mass Driver (a shot on it costs no Fuel), never a megastructure
const tw = run(cT, `
  const p = S.buildings.find((b) => b.type === 'thermal'), hx = p.x, hy = p.y, R = THERMAL.radius;
  // a spot for type within the plant's reach (its own tile's distance, as thermalNear reads it), or -1
  const near = (type, ok) => { for (let r = 1; r <= R; r++) for (let j = hy - r; j <= hy + r; j++) for (let i = hx - r; i <= hx + r; i++) if (inMap(i, j) && dist2(i, j, hx, hy) <= R * R && (!ok || ok(i, j)) && canPlace(0, type, i, j).ok) return tIdx(i, j); return -1; };
  const at = (type, t) => addBuilding(0, type, t % S.W, (t / S.W) | 0, true);
  const mt = near('magterm'); const m = mt >= 0 ? at('magterm', mt) : null;
  const ct = near('mdriver'); const c = ct >= 0 ? at('mdriver', ct) : null; // (a Driver: a Catcher never fires, so needs no power)
  if (!m || !c) return { m: !!m, c: !!c };
  const magOn = magPowered(m), catOn = magPowered(c), byThermal = thermalNear(c) === p;
  // a fuelled Generator in reach of the Driver too: on the Thermal Plant a shot draws none of its Fuel
  let gt = -1; for (let r = 1; r <= 4 && gt < 0; r++) for (let j = c.y - r; j <= c.y + r && gt < 0; j++) for (let i = c.x - r; i <= c.x + r; i++) if (inMap(i, j) && dist2(i, j, c.x, c.y) <= 16 && canPlace(0, 'generator', i, j).ok) { gt = tIdx(i, j); break; }
  const g = at('generator', gt); g.stock.fuel = 10; g.energy = 0;
  const f0 = (S.players[0].used || {}).fuel || 0;
  for (let k = 0; k < 6; k++) mdShotPower(c);
  const freeShots = { fuel: g.stock.fuel, energy: g.energy, used: ((S.players[0].used || {}).fuel || 0) - f0 };
  // the plant turned off: the Generator powers it, half a Fuel a shot
  p.paused = true;
  const genOn = magPowered(c);
  for (let k = 0; k < 6; k++) mdShotPower(c);
  const paidShots = { fuel: g.stock.fuel, used: ((S.players[0].used || {}).fuel || 0) - f0 };
  g.stock.fuel = 0; g.energy = 0;
  const offOff = magPowered(c) || magPowered(m);
  p.paused = false;
  const backOn = magPowered(c) && magPowered(m);
  // a megastructure within its reach: never powered by it (no Generator Fuel, no boost, no Deep Core power)
  return { magOn, catOn, byThermal, freeShots, genOn, paidShots, offOff, backOn };
`);
check('a Thermal Plant powers a Maglev Terminal and a Mass Driver in its reach (magPowered)', tw.magOn && tw.catOn && tw.byThermal, tw);
check('a Mass Driver shot on a Thermal Plant costs no Fuel, though a fuelled Generator is in reach too', tw.freeShots && tw.freeShots.fuel === 10 && tw.freeShots.energy === 0 && tw.freeShots.used === 0, tw);
check('turned off, the Generator powers the Driver instead: half a Fuel a shot (six shots, three Fuel)', tw.genOn && tw.paidShots.fuel === 7 && tw.paidShots.used === 3, tw);
check('with neither, no power; the plant back on, power again', !tw.offOff && tw.backOn, tw);
// a megastructure within a Thermal Plant's reach, on its own (a fresh colony each: there's room for one by the plant)
const megaBy = (type) => run(mk(), `
  ${colony(11, 'volcanic', 'Lakes')}
  let hot = -1;
  for (let j = 2; j < S.H - 2 && hot < 0; j++) for (let i = 2; i < S.W - 2; i++) { const t = tIdx(i, j); if (S.terrain[t] === T_GROUND && !S.res[t] && !S.bAt[t] && !S.road[t] && thermalHeat(t) && canPlace(0, 'thermal', i, j).ok) { hot = t; break; } }
  const hx = hot % S.W, hy = (hot / S.W) | 0, R = THERMAL.radius, p = addBuilding(0, 'thermal', hx, hy, true);
  const t0 = S.time; S.time = Math.max(S.time, 21 * 60); // (the Deep Core opens 20 minutes in: placed as if then)
  for (let j = hy - 8; j <= hy + 8; j++) for (let i = hx - 8; i <= hx + 8; i++) if (inMap(i, j) && S.owner[tIdx(i, j)] === -1) S.owner[tIdx(i, j)] = 0; // (our land round it)
  const f = BDEFS['${type}'].foot;
  let spot = -1;
  for (let j = hy - R - f; j <= hy + R + 1 && spot < 0; j++) for (let i = hx - R - f; i <= hx + R + 1; i++) if (inMap(i, j) && canPlace(0, '${type}', i, j).ok && footDist({ x: i, y: j, type: '${type}' }, hx + 0.5, hy + 0.5) <= R + 0.5) { spot = tIdx(i, j); break; }
  S.time = t0;
  if (spot < 0) return { placed: false };
  const m = addBuilding(0, '${type}', spot % S.W, (spot / S.W) | 0, true);
  // a Seam Drill in reach too, so the plant runs (something in reach is working)
  let ds = -1; for (let r = 1; r <= R && ds < 0; r++) for (let j = hy - r; j <= hy + r && ds < 0; j++) for (let i = hx - r; i <= hx + r; i++) if (inMap(i, j) && dist2(i, j, hx, hy) <= R * R && canPlace(0, 'seamdrill', i, j).ok) { ds = tIdx(i, j); break; }
  if (ds >= 0) addBuilding(0, 'seamdrill', ds % S.W, (ds / S.W) | 0, true);
  let boosted = false;
  for (let k = 0; k < 30 * 8; k++) { charged(); simStep(SIM_STEP); if (m.boostUntil > S.time) boosted = true; }
  return { placed: true, drill: ds >= 0, boosted, gens: megaGens(m, 8).length, deep: '${type}' === 'deepcore' ? deepPower(m) : null, pst: p.status };
`);
const mLift = megaBy('lift'), mCore = megaBy('deepcore');
check('a megastructure in a Thermal Plant\'s reach is never powered by it (an Orbital Lift not boosted, a Deep Core without power)',
  mLift.placed && mCore.placed && mLift.drill && /Powering/.test(mLift.pst) && !mLift.boosted && mLift.gens === 0 && mCore.gens === 0 && mCore.deep === '', { mLift, mCore });
const lunar = run(mk(), `newGame({ seed: 5, mode: 'colony', size: 1, biome: 'lunar' }); return worldBan('seedmast');`);
check('no Seed Mast on Argos', /Argos/.test(lunar), lunar);

// ---- a save mid-process (a drill at work on its seam, beds growing) plays on exactly as the game it came from
const midSrc = `
  ${colony(7)}
  const c = open(L.x, L.y, 2, 6, 24), cx = c % S.W, cy = (c / S.W) | 0;
  const m = addBuilding(0, 'seedmast', cx, cy, true); m.stock.crystal = SEED.hopper;
  const g = addBuilding(0, 'generator', cx + 3, cy, true); fuel(g);
  const d = addBuilding(0, 'seamdrill', cx + 3, cy + 2, true);
  computeTerritory(); // (as a building finished in play claims its ground)
  globalThis.FEED = () => { const m = S.buildings.find((b) => b.type === 'seedmast'), g = S.buildings.find((b) => b.type === 'generator'); fuel(g); m.stock.crystal = SEED.hopper; };
  until(() => { FEED(); return bedsOf(m).filter((t) => bedStage(t) >= 2).length >= 3; }, 200);
`;
const cA = mk(), cB = mk();
const mid = run(cA, `${midSrc} globalThis.SAVE = serializeGame(); return { t: S.time, beds: S.sbed.filter((v) => v).length, seams: S.seams.length, found: S.seams.filter((s) => s.f).length };`);
cB.SAVE = vm.runInContext('SAVE', cA);
const loaded = run(cB, `checkSave(JSON.parse(SAVE)); deserializeGame(SAVE); ${HELP} globalThis.FEED = () => { const m = S.buildings.find((b) => b.type === 'seedmast'), g = S.buildings.find((b) => b.type === 'generator'); fuel(g); m.stock.crystal = SEED.hopper; }; return { t: S.time, beds: S.sbed.filter((v) => v).length, seams: S.seams.length, h: hashState() >>> 0 };`);
const hNow = run(cA, 'return hashState() >>> 0;');
const after = (c) => run(c, 'until(() => { FEED(); return false; }, 200); return { h: hashState() >>> 0, beds: S.sbed.filter((v) => v).length, left: S.seams.reduce((a, s) => a + s.n, 0) };');
const hA = after(cA), hB = after(cB);
check('a save made mid-process passes checkSave and loads with its beds and seams, the same hash', mid.beds >= 3 && mid.seams > 0 && loaded.t === mid.t && loaded.beds === mid.beds && loaded.seams === mid.seams && loaded.h === hNow, { mid, loaded, hNow });
check('the loaded game plays on exactly as the one it came from (same hash)', hA.h === hB.h && hA.beds >= 3, { hA, hB });
const bad = run(mk(), `${colony(5)} const o = JSON.parse(SAVE_T); o.seams[0].g = 'gold'; try { checkSave(o); return 'accepted'; } catch (e) { return 'refused'; }`.replace('SAVE_T', JSON.stringify(vm.runInContext('SAVE', cA))));
check('checkSave refuses a damaged seam', bad === 'refused', bad);

// ---- determinism: the same game twice comes out the same
const twin = () => run(mk(), `${midSrc} until(() => { FEED(); return false; }, 150); return hashState() >>> 0;`);
const h1 = twin(), h2 = twin();
check('determinism: the same game played twice gives the same hash', h1 === h2, { h1, h2 });

console.log(fails ? fails + ' FAILED' : 'ALL PASSED');
process.exit(fails ? 1 : 0);

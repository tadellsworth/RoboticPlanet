// Headless checks for Terraforming, stage 2: soil, plants and water (SOIL, GROVE, IRR, SHIFT in js/defs.js; the stage 2
// block in js/sim.js). A Composter enriching the ground in its reach over time, barren to improving to rich (rich soil is
// farmland), and crops on richer soil growing faster and giving more Fuel; a Tree Nursery's Agribot planting groves with
// lanes left open, the groves growing from saplings to young to mature, bearing Fiber the Agribot gathers, and slowing a
// foe's robots (not their owner's); napalm burning a grove to scorched ground; a Water Pump's water going along a pipe
// (green fringe, a sprinkler at its end) and along a dug canal, and a Bio Farm planting on wet desert with no fertile soil;
// the biome shift reaching its next step; the Grader's Reclaim clearing a crater and Spread soil enriching a tile; the
// stage 2 buildings refused to a rival's land and on Argos; a save made mid-process passing checkSave and playing on
// exactly as the game it came from; and the same game played twice coming out the same. Run: node tools/terraform2-test.js
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
const { SOIL, GROVE } = run(mk(), 'return { SOIL, GROVE };');
const check = (name, ok, x) => { console.log((ok ? 'PASS ' : 'FAIL ') + name + (ok ? '' : '  ' + JSON.stringify(x))); if (!ok) fails++; };

const HELP = `
  // (Batteries kept topped up: charging isn't what's tested.)
  const charged = () => { for (const u of S.bots) u.bat = 100; };
  const until = (fn, secs) => { for (let k = 0; k < 30 * secs && !fn(); k++) { if (k % 30 === 0) charged(); simStep(SIM_STEP); } return fn(); };
  const feed = (b) => { b.stock.fiber = SOIL.hopper; b.stock.stone = SOIL.hopper; };
  // Open, level ground of ours near (x, y): a square of side 2r + 1 all open (soilOpen, no resources), at least d from it.
  const open = (x, y, r, d0, d1) => { for (let d = d0; d <= d1; d++) for (let j = y - d; j <= y + d; j++) for (let i = x - d; i <= x + d; i++) {
    if (Math.max(Math.abs(i - x), Math.abs(j - y)) !== d) continue;
    let ok = true;
    for (let b = j - r; b <= j + r && ok; b++) for (let a = i - r; a <= i + r && ok; a++) { if (!inMap(a, b)) { ok = false; break; } const t = tIdx(a, b); if (!soilOpen(t, 0) || S.res[t] || S.fert[t] || S.owner[t] !== 0 || S.elev[t] !== S.elev[tIdx(i, j)] || S.zone[t] !== S.zone[tIdx(x, y)]) ok = false; }
    if (ok) return tIdx(i, j); } return -1; };
  Object.assign(globalThis, { until, feed, open, charged });
`;
const colony = (shape, seed, biome) => `newGame({ seed: ${seed}, mode: 'colony', size: 1, rough: 2${shape ? `, shape: SHAPE_PRESETS.findIndex((s) => s.name === '${shape}')` : ''}${biome ? `, biome: '${biome}'` : ''} });
  ${HELP}
  const L = getE(S.players[0].lander); L.stock.stone = 300; L.stock.fiber = 300;`;

// ---- a game without stage 2 has none of its layers (nothing hashed, nothing run)
const c0 = mk();
const none = run(c0, `${colony('', 5)} until(() => false, 30); return { layers: T2_LAYERS.filter((k) => S[k]), any: t2Any() };`);
check('a game with no stage 2 has none of its layers', !none.layers.length && !none.any, none);

// ---- the Composter: barren, improving, rich over time; rich soil is farmland; richer soil, faster crops and more Fuel
const c1 = mk();
const comp = run(c1, `
  ${colony('', 5)}
  const c = open(L.x, L.y, 1, 5, 14), cx = c % S.W, cy = (c / S.W) | 0;
  const b = addBuilding(0, 'composter', cx, cy, true); feed(b);
  const near = tIdx(cx + 1, cy), far = tIdx(cx + SOIL.reach + 2, cy), lv = [];
  for (let m = 0; m < 6; m++) { until(() => { feed(b); return false; }, 60); lv.push([soilLv(near), S.soil ? S.soil[near] : 0]); }
  const rich = soilLv(near) === 2, fert = !!S.fert[near], farOk = !S.soil[far] || inMap(cx + SOIL.reach + 2, cy) === false;
  // two crops side by side: one on the rich tile, one on barren ground out of reach
  const bar = open(cx, cy, 0, SOIL.reach + 3, 20);
  for (const t of [near, bar]) { S.res[t] = R_CROP; S.amt[t] = 1; S.grow[t] = 0; }
  until(() => false, 20);
  const gRich = S.grow[near], gBar = S.grow[bar];
  return { lv, rich, fert, farOk, gRich, gBar, rate: cropRate(near), yieldRich: SOIL.yield[soilLv(near)], yieldBar: SOIL.yield[soilLv(bar)], batches: b.batches };
`);
check('a Composter improves the soil in its reach: barren, then improving (about 2 minutes), then rich (about 5)',
  comp.lv[1][0] >= 1 && comp.lv[0][0] <= 1 && comp.rich && comp.batches >= 20, comp);
check('rich soil is farmland (S.fert), and ground out of reach is untouched', comp.fert && comp.farOk, comp);
check('a crop on rich soil grows faster than one on barren ground, and gives more Fuel (SOIL.crop, SOIL.yield)',
  comp.gRich > comp.gBar * 1.4 && comp.rate === SOIL.crop[2] * 1 && comp.yieldRich === 2 && comp.yieldBar === 1, comp);

// ---- a Bio Farm's Agribot harvests a crop on rich soil: 2 Fuel a trip
const farmRich = run(c1, `
  const L = getE(S.players[0].lander), comp = S.buildings.find((b) => b.type === 'composter');
  let f = -1; for (let j = comp.y - 1; j <= comp.y + 1 && f < 0; j++) for (let i = comp.x - 2; i <= comp.x + 2; i++) { const t = tIdx(i, j); if (i !== comp.x && soilOpen(t, 0) && !S.res[t] && S.soil[t] >= SOIL.rich) { f = t; break; } }
  const farm = addBuilding(0, 'farm', f % S.W, (f / S.W) | 0, true); addBot(0, 'agribot', farm.x, farm.y + 1);
  for (let j = farm.y - 3; j <= farm.y + 3; j++) for (let i = farm.x - 3; i <= farm.x + 3; i++) { const t = tIdx(i, j); if (inMap(i, j) && S.res[t] === R_CROP) S.grow[t] = 1; }
  let firstCarry = 0;
  until(() => { const u = S.bots.find((v) => v.type === 'agribot' && v.carry === 'fuel'); if (u && !firstCarry) firstCarry = u.carryN; return firstCarry > 0; }, 240);
  return { firstCarry, soil: soilLv(f) };
`);
check('a Bio Farm\'s Agribot brings 2 Fuel from a crop on rich soil', farmRich.firstCarry === 2, farmRich);

// ---- the Tree Nursery: planting with lanes open, growing, bearing Fiber, slowing a foe
const c2 = mk();
const nurs = run(c2, `
  ${colony('', 5)}
  const c = open(L.x, L.y, 1, 5, 16), cx = c % S.W, cy = (c / S.W) | 0;
  const b = addBuilding(0, 'nursery', cx, cy, true); addBot(0, 'agribot', cx, cy + 1);
  until(() => grovesOf(b) >= 6, 240);
  const planted = grovesOf(b);
  let onLane = 0, groves = [];
  for (let t = 0; t < S.W * S.H; t++) if (S.grove && S.grove[t]) { groves.push(t); if (groveLane(b, t % S.W, (t / S.W) | 0)) onLane++; }
  const g0 = groves[0], st0 = groveStage(g0);
  until(() => groveStage(g0) >= 2, GROVE.young * GROVE.step + 10); const st1 = groveStage(g0);
  until(() => groveStage(g0) >= 3, GROVE.mature * GROVE.step + 10); const st2 = groveStage(g0);
  const fib0 = S.players[0].stats.groveFiber || 0;
  until(() => (S.players[0].stats.groveFiber || 0) > fib0, GROVE.fiberEvery * GROVE.step + 60);
  const gathered = (S.players[0].stats.groveFiber || 0) - fib0;
  // A rival's warbot in the mature grove crawls; one of ours doesn't.
  const gi = g0 % S.W, gj = (g0 / S.W) | 0;
  const fp = S.players.findIndex((P, p) => p !== 0 && foes(0, p)), foe = addBot(fp, 'warbot', gi, gj), own = addBot(0, 'worker', gi, gj);
  const out = { planted, onLane, st0, st1, st2, gathered, slowFoe: groveSlow(foe), slowOwn: groveSlow(own), mulFoe: speedMul(foe), mulOwn: speedMul(own), stock: b.stock.fiber || 0, status: b.status };
  foe.dead = true; S.byId.delete(foe.id); // (it would only start a fight)
  return out;
`);
check('a Tree Nursery\'s Agribot plants groves in its reach, every one off the open lanes', nurs.planted >= 6 && nurs.onLane === 0, nurs);
check('a grove grows from saplings to young to mature', nurs.st0 === 1 && nurs.st1 === 2 && nurs.st2 === 3, nurs);
check('a mature grove bears Fiber the Agribot gathers (the trickle)', nurs.gathered >= 1, nurs);
check('a foe\'s robot in the grove is slowed (GROVE.slow), its owner\'s isn\'t', nurs.slowFoe === GROVE.slow[2] && nurs.slowOwn === 1 && nurs.mulFoe < nurs.mulOwn, nurs);

// ---- groves burn: napalm leaves scorched ground; Reclaim clears it for planting again
const burn = run(c2, `
  let g = -1; for (let t = 0; t < S.W * S.H; t++) if (S.grove[t]) { g = t; break; }
  const before = S.grove[g];
  napalmImpact({ x1: (g % S.W) + 0.5, y1: ((g / S.W) | 0) + 0.5, owner: 1 });
  const gone = !S.grove[g], scorched = burntSoil(g);
  addBot(0, 'grader', g % S.W, ((g / S.W) | 0) + 1);
  const r = applyOrder(0, 'terraform', ['reclaim', [g]]);
  until(() => !S.buildings.some((b) => !b.dead && b.tf && !b.built), 400);
  const site = S.buildings.find((b) => !b.dead && b.tf && !b.built);
  return { site: site && site.status, before, gone, scorched, placed: r.placed, cleared: !burntSoil(g), plantable: groveSpotOk(S.buildings.find((b) => b.type === 'nursery'), g) || groveLane(S.buildings.find((b) => b.type === 'nursery'), g % S.W, (g / S.W) | 0) };
`);
check('napalm burns a grove to scorched ground', burn.before > 0 && burn.gone && burn.scorched, burn);
check('the Grader\'s Reclaim clears the scorched ground so a Nursery can plant it again', burn.placed === 1 && burn.cleared && burn.plantable, burn);

// ---- the Water Pump: water along a pipe and a canal; a Bio Farm on wet desert
const c3 = mk();
const pump = run(c3, `
  ${colony('Lakes', 23, 'desert')}
  // a shore tile of ours beside a lake, with open ground running away from the water
  let at = -1, dir = null;
  for (let t = 0; t < S.W * S.H && at < 0; t++) {
    if (S.owner[t] !== 0 || !soilOpen(t, 0) || S.res[t] || S.fert[t]) continue;
    for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const i = t % S.W, j = (t / S.W) | 0;
      if (!inMap(i - di, j - dj) || S.terrain[tIdx(i - di, j - dj)] !== T_WATER) continue;
      let ok = true;
      for (let k = 1; k <= 7 && ok; k++) { const a = i + di * k, b = j + dj * k; if (!inMap(a, b)) { ok = false; break; } const u = tIdx(a, b); if (!soilOpen(u, 0) || S.res[u] || S.fert[u]) ok = false; }
      if (ok) { at = t; dir = [di, dj]; break; }
    }
  }
  const pi = at % S.W, pj = (at / S.W) | 0;
  const wp = addBuilding(0, 'wpump', pi, pj, true);
  const pipe = []; for (let k = 1; k <= 6; k++) pipe.push(tIdx(pi + dir[0] * k, pj + dir[1] * k));
  for (const t of pipe) S.pipe[t] = 1; S.pipeVer = (S.pipeVer || 0) + 1;
  until(() => false, IRR.every + 1);
  const end = pipe[pipe.length - 1], ei = end % S.W, ej = (end / S.W) | 0;
  const side = tIdx(pi + dir[0] * 3 + dir[1], pj + dir[1] * 3 + dir[0]);
  const beyond = tIdx(ei + dir[0] * 2, ej + dir[1] * 2), farAway = tIdx(pi + dir[0] * 3 + dir[1] * 4, pj + dir[1] * 3 + dir[0] * 4);
  const r1 = { wpN: wp.wpN, fringe: wetAt(side), sprinkler: pipeSprinkler(end) && S.wet[beyond] === 2, dryFar: !wetAt(farAway), status: wp.status };
  // a Bio Farm with no fertile soil, beside the wet pipe: its Agribot plants crops on the wet desert
  const fi = pi + dir[0] * 4 + dir[1] * 2, fj = pj + dir[1] * 4 + dir[0] * 2, ft = tIdx(fi, fj);
  let fert = 0; for (let j = fj - 3; j <= fj + 3; j++) for (let i = fi - 3; i <= fi + 3; i++) if (inMap(i, j) && S.fert[tIdx(i, j)]) fert++;
  const farm = addBuilding(0, 'farm', fi, fj, true); addBot(0, 'agribot', fi, fj + 1);
  until(() => { for (let t = 0; t < S.W * S.H; t++) if (S.res[t] === R_CROP && !S.fert[t] && wetAt(t)) return true; return false; }, 120);
  let wetCrops = 0; for (let t = 0; t < S.W * S.H; t++) if (S.res[t] === R_CROP && !S.fert[t] && wetAt(t)) wetCrops++;
  // the pipe cut off from the pump: its fringe dries out
  S.pipe[pipe[0]] = 0; S.pipeVer++;
  until(() => false, IRR.every + 1);
  const dried = !wetAt(side);
  S.pipe[pipe[0]] = 1; S.pipeVer++;
  return { ...r1, fert, wetCrops, dried, biome: biome() };
`);
check('a Water Pump\'s water goes along the pipe joined to it: the ground beside it is wet, a sprinkler waters round its end', pump.wpN >= 6 && pump.fringe && pump.sprinkler && pump.dryFar, pump);
check('a Bio Farm plants crops on wet desert with no fertile soil', pump.biome === 'desert' && pump.wetCrops >= 1, pump);
check('cut off from the pump, the pipe\'s ground dries out', pump.dried, pump);

const canal = run(c3, `
  // a canal dug in from the pump's water (S.tfTiles water, as Dig channel leaves it) carries the water too
  const wp = S.buildings.find((b) => b.type === 'wpump');
  for (const b of S.buildings) if (b.type === 'farm') b.paused = true;
  let w = -1; for (const u of tfSides(tIdx(wp.x, wp.y))) if (S.terrain[u] === T_WATER) w = u;
  // dig two tiles of canal along the shore from beside the pump (ground beside the water)
  const cand = tfSides(tIdx(wp.x, wp.y)).filter((u) => S.terrain[u] === T_GROUND && !S.pipe[u] && !S.bAt[u] && !S.res[u]);
  const c1 = cand[0];
  const c2 = tfSides(c1).find((u) => u !== tIdx(wp.x, wp.y) && S.terrain[u] === T_GROUND && !S.pipe[u] && !S.bAt[u] && !S.res[u]);
  for (const t of [c1, c2]) { S.terrain[t] = T_WATER; S.tfTiles = S.tfTiles || {}; S.tfTiles[t] = 1; }
  terrainChanged();
  until(() => false, IRR.every + 1);
  const beside = tfSides(c2).filter((u) => S.terrain[u] === T_GROUND && u !== tIdx(wp.x, wp.y));
  return { wpN: wp.wpN, wet: beside.filter((u) => wetAt(u)).length, n: beside.length };
`);
check('a canal the Grader dug carries the pump\'s water too: the ground beside it is wet', canal.wet >= 1 && canal.wpN >= 8, canal);

// ---- the biome shift: rich soil, water and grove cover take ground to its next step
const c4 = mk();
const shift = run(c4, `
  ${colony('', 5, 'desert')}
  const c = open(L.x, L.y, 1, 5, 14), ci = c % S.W, cj = (c / S.W) | 0;
  for (let j = cj - 1; j <= cj + 1; j++) for (let i = ci - 1; i <= ci + 1; i++) { const t = tIdx(i, j); t2Layer('soil')[t] = SOIL.rich; t2Layer('wet')[t] = 1; }
  for (const [i, j] of [[ci - 1, cj - 1], [ci + 1, cj + 1], [ci + 1, cj - 1]]) { const t = tIdx(i, j); t2Layer('grove')[t] = GROVE.mature; t2Layer('grvF')[t] = 0; t2Layer('grvO')[t] = 1; }
  const score = t2Score(c), next = t2NextBiome(c);
  const n = Math.ceil(SHIFT.full / score);
  let steps = 0;
  for (let k = 0; k < n + 2 && !(S.shift && S.shift[c]); k++) { t2Shift(); steps++; }
  return { score, next, steps, shifted: S.shift ? S.shift[c] : 0, now: t2TileBiome(c), minutes: steps * SHIFT.every / 60, soil: soilLv(tIdx(ci + 3, cj)) };
`);
check('the biome shift: rich soil, water and groves take the Rust a step, to the Long Grass, in about ten minutes',
  shift.score === 4 && shift.next === 'savanna' && shift.shifted === 1 && shift.now === 'savanna' && shift.minutes >= 8 && shift.minutes <= 15, shift);

// ---- Reclaim on a crater, and Spread soil
const c5 = mk();
const recl = run(c5, `
  ${colony('', 5)}
  S.settings.scars = 'full'; scarSetup();
  const c = open(L.x, L.y, 1, 5, 16), ci = c % S.W, cj = (c / S.W) | 0;
  scarBlast(ci + 0.5, cj + 0.5, 1.4);
  const crater = S.crater[c], ash = S.ash[c];
  addBot(0, 'grader', ci, cj + 1);
  const s = tIdx(ci + 1, cj);
  const r = applyOrder(0, 'terraform', ['reclaim', [c]]);
  const r2 = applyOrder(0, 'terraform', ['soil', [s]]);
  const clean = open(ci, cj, 0, 4, 12), refused = applyOrder(0, 'terraform', ['reclaim', [clean]]);
  until(() => !S.buildings.some((b) => !b.dead && b.tf && !b.built), 400);
  return { crater, ash, placed: r.placed, after: S.crater[c], ashAfter: S.ash[c], soilPlaced: r2.placed, fiber: r2.fiber, soil: S.soil ? S.soil[s] : 0, refused: refused.placed, stats: [S.players[0].stats.tfclear, S.players[0].stats.tfsoil] };
`);
check('Reclaim clears a crater and its ash back to usable ground', recl.crater > 0 && recl.placed === 1 && recl.after === 0 && recl.ashAfter === 0, recl);
check('Spread soil takes Fiber and Stone and makes the tile a step richer', recl.soilPlaced === 1 && recl.fiber === SOIL.spread.fiber && recl.soil === SOIL.spreadGain, recl);
check('Reclaim is refused on ground with nothing to clear', recl.refused === 0, recl);

// ---- where they can't go: a rival's land, Argos; the Water Pump needs water beside it
const c6 = mk();
const where = run(c6, `
  ${colony('', 5)}
  const R1 = getE(S.players[1].lander);
  const L0 = getE(S.players[0].lander);
  const c = open(L0.x, L0.y, 1, 5, 16);
  return { rival: R1 ? canPlace(0, 'composter', R1.x + 2, R1.y + 2).ok : false, dry: canPlace(0, 'wpump', c % S.W, (c / S.W) | 0).ok, ok: canPlace(0, 'composter', c % S.W, (c / S.W) | 0).ok };
`);
const lunar = run(mk(), `newGame({ seed: 5, mode: 'colony', size: 1, biome: 'lunar' }); return worldBan('nursery');`);
check('stage 2 buildings: not on a rival\'s land, a Water Pump only beside water, nothing on Argos', !where.rival && !where.dry && where.ok && /Argos/.test(lunar), { where, lunar });

// ---- a save mid-process (composting, groves growing, water flowing, a Reclaim under way) plays on exactly as the game it came from
const midSrc = `
  ${colony('Lakes', 23, 'desert')}
  const c = open(L.x, L.y, 1, 5, 16), cx = c % S.W, cy = (c / S.W) | 0;
  const cp = addBuilding(0, 'composter', cx, cy, true); feed(cp);
  const ns = addBuilding(0, 'nursery', cx + 1, cy + 1, true); addBot(0, 'agribot', cx + 1, cy + 2);
  addBot(0, 'grader', cx - 1, cy);
  until(() => { feed(cp); return grovesOf(ns) >= 3; }, 200);
  applyOrder(0, 'terraform', ['soil', [tIdx(cx - 2, cy)]]);
  until(() => { feed(cp); return S.buildings.some((b) => b.tf && b.progress > 0.2); }, 200);
`;
const cA = mk(), cB = mk();
const mid = run(cA, `${midSrc} globalThis.SAVE = serializeGame(); return { t: S.time, groves: S.grove ? S.grove.filter((v) => v).length : 0, soil: S.soil ? S.soil.filter((v) => v).length : 0, job: S.buildings.some((b) => !b.dead && b.tf && !b.built) };`);
cB.SAVE = vm.runInContext('SAVE', cA);
const loaded = run(cB, `checkSave(JSON.parse(SAVE)); deserializeGame(SAVE); ${HELP} return { t: S.time, groves: S.grove ? S.grove.filter((v) => v).length : 0, soil: S.soil ? S.soil.filter((v) => v).length : 0, h: hashState() >>> 0 };`);
const hNow = run(cA, 'return hashState() >>> 0;');
const after = (c) => run(c, `const cp = S.buildings.find((b) => b.type === 'composter'); until(() => { feed(cp); return false; }, 300); return { h: hashState() >>> 0, groves: S.grove.filter((v) => v).length, mature: S.grove.filter((v) => v >= GROVE.young).length };`);
const hA = after(cA), hB = after(cB);
check('a save made mid-process passes checkSave and loads with its soil, groves and job, the same hash', mid.groves >= 3 && mid.soil > 0 && mid.job && loaded.t === mid.t && loaded.groves === mid.groves && loaded.soil === mid.soil && loaded.h === hNow, { mid, loaded, hNow });
check('the loaded game plays on exactly as the one it came from (same hash)', hA.h === hB.h && hA.groves >= 3, { hA, hB });

// ---- determinism: the same game twice comes out the same
const twin = () => run(mk(), `${midSrc} until(() => { feed(cp); return false; }, 200); return hashState() >>> 0;`);
const h1 = twin(), h2 = twin();
check('determinism: the same game played twice gives the same hash', h1 === h2, { h1, h2 });

console.log(fails ? fails + ' FAILED' : 'ALL PASSED');
process.exit(fails ? 1 : 0);

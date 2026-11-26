// Headless checks for Terraforming, stage 1 (TERRA; tfJob, tfPlace, graderDispatch, completeEarthwork in js/sim.js):
// each tool (Raise, Lower, Flatten, Fill shallows, Dig channel) done by a Grader; what it costs and yields in Stone;
// the refusals (a rival's land, under a building, under a road, Workers never taking the job); robots' routes after a
// raise, a lower and a flatten; a land bridge a robot walks over to an island; Fill shallows stopping TERRA.reach tiles
// out from the original shore on open sea; a dug canal joining two lakes so a ship
// sails between them; a save loaded mid-job playing on exactly as the game it came from; and the same plan played
// twice coming out the same. Run: node tools/terraform-test.js
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
const check = (name, ok, x) => { console.log((ok ? 'PASS ' : 'FAIL ') + name + (ok ? '' : '  ' + JSON.stringify(x))); if (!ok) fails++; };

const HELP = `
  // (The Graders' batteries are kept topped up: these planets have no Fuel Station, and charging isn't what's tested.)
  const charged = () => { for (const u of S.bots) if (u.type === 'grader') u.bat = 100; };
  const until = (fn, secs) => { for (let k = 0; k < 30 * secs && !fn(); k++) { if (k % 30 === 0) charged(); simStep(SIM_STEP); } return fn(); };
  const sites = () => S.buildings.filter((b) => !b.dead && b.tf && !b.built).length;
  const stone = () => playerGoods(0).stone || 0;
  // Open, level ground of ours near (x, y), none of its neighbours worked on or built on, at least r from it.
  const open = (x, y, r, R) => { for (let d = r; d <= R; d++) for (let j = y - d; j <= y + d; j++) for (let i = x - d; i <= x + d; i++) {
    if (!inMap(i, j) || Math.max(Math.abs(i - x), Math.abs(j - y)) !== d) continue;
    const t = tIdx(i, j);
    if (tfWhere(0, t) || S.terrain[t] !== T_GROUND || tfSides(t).some((u) => tfWhere(0, u) || S.terrain[u] !== T_GROUND || S.elev[u] !== S.elev[t])) continue;
    return t; } return -1; };
  Object.assign(globalThis, { until, sites, stone, open, charged });
`;
const colony = (shape, seed) => `newGame({ seed: ${seed}, mode: 'colony', size: 1, rough: 2${shape ? `, shape: SHAPE_PRESETS.findIndex((s) => s.name === '${shape}')` : ''} });
  ${HELP}
  const L = getE(S.players[0].lander); L.stock.stone = 300;`;

// ---- each tool on open ground: Raise, Lower and Flatten, with what each costs and yields
const c1 = mk();
const tools = run(c1, `
  ${colony('', 5)}
  const g = addBot(0, 'grader', L.x, L.y + 2);
  const a = open(L.x, L.y + 5, 3, 9), e = S.elev[a];
  const s0 = stone();
  const r = applyOrder(0, 'terraform', ['raise', [a]]);
  const owed = Object.assign({}, getE(S.bAt[a]).cost);
  const workers = () => S.bots.some((u) => u.type === 'worker' && u.task && u.task.type === 'build' && getE(u.task.site)?.tf);
  let workerTook = false;
  until(() => { if (workers()) workerTook = true; return !sites(); }, 300);
  const raised = S.elev[a], s1 = stone();
  // Lower the same tile back: 2 Stone (TERRA.dug) comes out as crates, which Haulers carry to storage.
  const r2 = applyOrder(0, 'terraform', ['lower', [a]]);
  until(() => !sites(), 300);
  const lowered = S.elev[a];
  const crate = (S.loot || []).reduce((n, l) => n + (l.goods.stone || 0), 0);
  until(() => stone() >= s1 + 2, 300);
  const s2 = stone();
  return { r, owed, e, raised, lowered, s0, s1, s2, crate, workerTook, r2, grader: g.type, made: S.players[0].stats.tfup, low: S.players[0].stats.tfdown };
`);
check('Raise: a Grader raises a tile a level; it costs 4 Stone (TERRA.stone), brought to it', tools.r.placed === 1 && tools.owed.stone === 4 && tools.raised === tools.e + 1 && tools.s0 - tools.s1 >= 4, tools);
check('Lower: the tile goes back down a level and yields 2 Stone (TERRA.dug, half what raising costs) as crates, carried to storage', tools.r2.placed === 1 && tools.lowered === tools.e && tools.crate === 2 && tools.s2 - tools.s1 === 2, tools);
check('Workers never take an Earthworks job: only the Grader does', !tools.workerTook && tools.made === 1 && tools.low === 1, tools);

const flat = run(mk(), `
  ${colony('', 5)}
  addBot(0, 'grader', L.x, L.y + 2); addBot(0, 'grader', L.x + 1, L.y + 2);
  // A hill: raise one tile, so a flatten from beside it has a level to take off and the hill is cut off meanwhile.
  const a = open(L.x, L.y + 5, 3, 9), e = S.elev[a], i = a % S.W, j = (a / S.W) | 0;
  applyOrder(0, 'terraform', ['raise', [a]]);
  until(() => !sites(), 300);
  const nb = tfSides(a).find((u) => S.elev[u] === e);
  const stepUp = canStep(nb, a);
  const zoneSplit = S.zone[a] !== S.zone[nb];
  // Flatten the 3x3 round it to the level of the tile beside it (the drag's start).
  const rect = []; for (let y = j - 1; y <= j + 1; y++) for (let x = i - 1; x <= i + 1; x++) rect.push(tIdx(x, y));
  rect.sort((p, q) => (p === nb ? -1 : q === nb ? 1 : 0));
  const r = applyOrder(0, 'terraform', ['flatten', rect, e]);
  const one = r.placed;
  until(() => !sites(), 300);
  const level = rect.every((t) => S.elev[t] === e || tfWhere(0, t));
  const walk = findPath(nb % S.W, (nb / S.W) | 0, i, j, 0, { who: 0 });
  return { e, stepUp, zoneSplit, one, level, walk: walk ? walk.length : null, now: S.elev[a], joined: S.zone[a] === S.zone[nb] };
`);
check('pathing after a raise: the raised tile is a cliff a level up, cut off from the ground beside it', !flat.stepUp && flat.zoneSplit, flat);
check('Flatten: the hill comes down to the start tile\'s level (only the one tile needed work)', flat.one === 1 && flat.level && flat.now === flat.e, flat);
check('pathing after a flatten (and a lower): a robot walks straight onto the old hilltop', flat.joined && flat.walk === 1, flat);

// ---- refusals: under a building, under a road, a rival's land, too steep, no water to fill
const ref = run(mk(), `
  newGame({ seed: 7, mode: 'versus', size: 1 });
  ${HELP}
  const L = getE(S.players[0].lander), R1 = getE(S.players[1].lander);
  const road = S.road.findIndex((v, t) => v && S.owner[t] === 0 && !S.bAt[t]);
  const rival = (() => { for (let t = 0; t < S.W * S.H; t++) if (S.owner[t] === 1 && S.terrain[t] === T_GROUND && !S.bAt[t] && !S.road[t] && !S.res[t]) return t; return -1; })();
  const why = (tool, t) => tfJob(0, tool, t, 0).why || '';
  const land = open(L.x, L.y + 4, 3, 9);
  const r = applyOrder(0, 'terraform', ['raise', [tIdx(L.x, L.y), road, rival]]);
  // Raise the same tile twice in one plan: the second level would be a two-level cliff.
  const twice = tfJob(0, 'flatten', land, S.elev[land] + 2).why;
  return { base: why('raise', tIdx(L.x, L.y)), road: why('lower', road), rival: why('raise', rival), fill: why('fill', land), dig: why('dig', land), twice, placed: r.placed, sites: S.buildings.filter((b) => b.tf).length };
`);
check('refused under a building', /building stands here/.test(ref.base), ref);
check('refused under a road', /road runs here/.test(ref.road), ref);
check('refused on a rival\'s land (like a Wall)', /rival holds this ground/.test(ref.rival), ref);
check('refused: no water to fill, no water to dig to, a cliff over a level steep', /only water/.test(ref.fill) && /only land right beside water/.test(ref.dig) && /Too steep/.test(ref.twice), ref);
check('the order plans none of the refused tiles', ref.placed === 0 && ref.sites === 0, ref);

// ---- a land bridge to an island (Lakes, seed 23: 6 tiles of water east of (30, 51), the island at the same level)
const c4 = mk();
const bridge = run(c4, `
  ${colony('Lakes', 23)}
  const shore = tIdx(30, 51), far = tIdx(37, 51), hz = S.zone[shore], fill = [31, 32, 33, 34, 35, 36].map((x) => tIdx(x, 51));
  addBot(0, 'grader', 30, 51); addBot(0, 'grader', 29, 51);
  const before = { apart: S.zone[far] !== hz, path: !!findPath(30, 51, 37, 51, 0, { who: 0 }) };
  const s0 = stone();
  const r = applyOrder(0, 'terraform', ['fill', fill]);
  until(() => !sites(), 900);
  const w = addBot(0, 'worker', 29, 51);
  const ok = goTo(w, 37, 51); w.task = { type: 'cover' }; // (just walking there: see updateWorker)
  until(() => Math.floor(w.x) === 37 && Math.floor(w.y) === 51, 120);
  return { before, r, cost: s0 - stone(), land: fill.map((t) => S.terrain[t] === T_GROUND && S.elev[t] === S.elev[shore]), joined: S.zone[far] === S.zone[shore], ok, at: [Math.floor(w.x), Math.floor(w.y)] };
`);
check('Fill shallows: six tiles of water out from the shore become land at the shore\'s level, 8 Stone each from storage', bridge.before.apart && !bridge.before.path && bridge.r.placed === 6 && bridge.land.every(Boolean) && bridge.cost === 6 * 8, bridge);
check('a land bridge: a Worker walks across it to the island', bridge.joined && bridge.ok && bridge.at[0] === 37 && bridge.at[1] === 51, bridge);

// ---- open sea: Fill shallows reaches TERRA.reach tiles from the shore as the map was made, and no further (Islands, seed 7)
const sea = run(mk(), `
  ${colony('Islands', 7)}
  const L2 = getE(S.players[0].lander), hz = S.zone[tIdx(L2.x, L2.y + 2)];
  // A line straight out to sea from our shore with no other land near it: ten tiles of open water, the seventh on out of reach.
  let line = null;
  for (let t = 0; t < S.W * S.H && !line; t++) {
    if (S.zone[t] !== hz || !walkable(t) || S.terrain[t] !== T_GROUND) continue;
    const i = t % S.W, j = (t / S.W) | 0;
    for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const ts = []; for (let k = 1; k <= 10 && inMap(i + di * k, j + dj * k); k++) ts.push(tIdx(i + di * k, j + dj * k));
      if (ts.length === 10 && ts.every((u) => S.terrain[u] === T_WATER && !(S.tidal && S.tidal[u]) && !tfWhere(0, u, new Map(ts.map((v) => [v, { k: 'fill', to: 0 }])))) && ts.findIndex((u) => !tfInReach(u)) === TERRA.reach) { line = { t, ts }; break; }
    }
  }
  if (!line) return { line: null };
  const n = line.ts.findIndex((u) => !tfInReach(u)), dist = n + 1;
  addBot(0, 'grader', line.t % S.W, (line.t / S.W) | 0); addBot(0, 'grader', line.t % S.W, (line.t / S.W) | 0);
  const r = applyOrder(0, 'terraform', ['fill', line.ts]);
  until(() => !sites(), 900);
  const made = line.ts.slice(0, n).every((u) => S.terrain[u] === T_GROUND);
  // Out from the new land, the next tile is still too far from the shore the map was made with.
  const again = tfJob(0, 'fill', line.ts[n], 0).why || '';
  const r2 = applyOrder(0, 'terraform', ['fill', [line.ts[n]]]);
  // Saved and loaded, the game still knows where the shore was (S.tfTiles: the filled tiles were water).
  const json = serializeGame();
  deserializeGame(json);
  const loaded = tfJob(0, 'fill', line.ts[n], 0).why || '', was = line.ts.slice(0, n).map((u) => S.tfTiles[u]);
  return { line: line.t, n, dist, placed: r.placed, why: r.why, made, again, placed2: r2.placed, loaded, was };
`);
check('open sea: a fill dragged out to sea stops at TERRA.reach tiles from the original shore, the rest refused with the reason', sea.line !== null && sea.n === 6 && sea.placed === 6 && sea.made && /Too far out to sea: fill reaches 6 tiles from the original shore/.test(sea.why), sea);
check('open sea: new land doesn\'t move the shore: the next tile out is still refused once the fill is done, and after a save and load', /Too far out to sea/.test(sea.again) && sea.placed2 === 0 && /Too far out to sea/.test(sea.loaded) && sea.was.every((v) => v === 2), sea);

// ---- a canal joining two lakes (Lakes, seed 23: two tiles of land at (33, 56) and (33, 57) between them), a ship sails through
const canal = run(mk(), `
  ${colony('Lakes', 23)}
  const t = tIdx(33, 56), t2 = tIdx(33, 57), a = tIdx(33, 55), b = tIdx(33, 58);
  addBot(0, 'grader', 32, 56); addBot(0, 'grader', 32, 57);
  const before = seaNet().comp[a] !== seaNet().comp[b];
  // A Ferry on the first lake, told to sail to the second: it can't, yet.
  const f = addBot(0, 'ferry', 33, 55);
  const cant = applyOrder(0, 'sail', [f.id, 33, 58]);
  const r = applyOrder(0, 'terraform', ['dig', [t, t2]]);
  const s0 = stone();
  until(() => !sites(), 300);
  const net = seaNet(), joined = net.comp[a] === net.comp[b] && net.comp[t] === net.comp[a];
  // A ship's way: open water all along (the sea's own areas, seaNet).
  const route = (() => { const W = S.W, seen = new Set([a]), q = [a]; while (q.length) { const x = q.shift(); if (x === b) return true; for (const y of [x - 1, x + 1, x - W, x + W]) if (y >= 0 && y < S.W * S.H && !seen.has(y) && S.terrain[y] === T_WATER) { seen.add(y); q.push(y); } } return false; })();
  const sail = applyOrder(0, 'sail', [f.id, 33, 58]);
  until(() => Math.floor(f.y) >= 58, 120);
  const sailed = [Math.floor(f.x), Math.floor(f.y)];
  until(() => stone() >= s0 + 6, 300);
  return { before, r, joined, water: S.terrain[t] === T_WATER && S.terrain[t2] === T_WATER, route, yield: stone() - s0, big: net.size[net.comp[a]] >= SEA_MIN, cant, sail, sailed };
`);
check('Dig channel: the two tiles of land between two lakes become water, 3 Stone each (TERRA.dig)', canal.before && canal.r.placed === 2 && canal.water && canal.yield === 6, canal);
check('a dug canal: the two lakes are one body of water, and a Ferry that couldn\'t reach the second lake sails through to it', canal.joined && canal.route && canal.big && !!canal.cant && canal.sail === '' && canal.sailed[1] >= 58, canal);

// ---- a moat: a dug tile cuts a strip of land off; robots on it step off, routes over it change
const moat = run(mk(), `
  ${colony('Lakes', 23)}
  addBot(0, 'grader', 32, 56);
  const t = tIdx(33, 56);
  applyOrder(0, 'terraform', ['dig', [t]]);
  const w = addBot(0, 'worker', 33, 56); // (a robot right on the tile as it floods)
  until(() => !sites(), 300);
  return { off: Math.floor(w.x) !== 33 || Math.floor(w.y) !== 56, onLand: S.terrain[tIdx(Math.floor(w.x), Math.floor(w.y))] === T_GROUND };
`);
check('no robot is left standing in new water: it steps off onto dry land', moat.off && moat.onLand, moat);

// ---- save and load mid-job: the loaded game plays on exactly as the one it came from
const midSrc = `
  ${colony('Lakes', 23)}
  addBot(0, 'grader', 30, 51); addBot(0, 'grader', 32, 56);
  applyOrder(0, 'terraform', ['fill', [31, 32, 33].map((x) => tIdx(x, 51))]);
  applyOrder(0, 'terraform', ['dig', [tIdx(33, 56)]]);
  until(() => S.buildings.some((b) => b.tf && b.progress > 0.2), 200);
`;
const cA = mk(), cB = mk();
const mid = run(cA, `${midSrc} globalThis.SAVE = serializeGame(); return { busy: S.buildings.filter((b) => b.tf && b.progress > 0).length, t: S.time, sites: sites() };`);
const saved = vm.runInContext('SAVE', cA);
cB.SAVE = saved;
const loaded = run(cB, `checkSave(JSON.parse(SAVE)); deserializeGame(SAVE); ${HELP} return { sites: sites(), t: S.time };`);
const after = (c) => run(c, `until(() => false, 400); return { h: hashState() >>> 0, sites: sites(), land: S.terrain[tIdx(33, 51)], canal: S.terrain[tIdx(33, 56)] };`);
const hA = after(cA), hB = after(cB);
check('a save made mid-job passes checkSave and loads with its Earthworks', mid.busy >= 1 && loaded.sites >= 1 && loaded.t === mid.t, { mid, loaded });
check('the loaded game plays on exactly as the one it came from (same hash), the jobs done', hA.h === hB.h && hA.sites === 0 && hA.land === 0 && hA.canal === 1, { hA, hB });

// ---- determinism: the same plan in two fresh games comes out the same
const twin = () => run(mk(), `${midSrc} until(() => false, 300); return hashState() >>> 0;`);
const h1 = twin(), h2 = twin();
check('determinism: the same plan played twice gives the same hash', h1 === h2, { h1, h2 });

console.log(fails ? fails + ' FAILED' : 'ALL PASSED');
process.exit(fails ? 1 : 0);

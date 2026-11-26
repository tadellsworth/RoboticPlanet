#!/usr/bin/env node
// The Workforce ladder, headless (wfOrder and the rest in js/sim.js; its orders in js/orders.js). A colony of its own is
// set up the same way every time: a Colony game (no rival to end it, the Murmur off) that the computer plays for a while,
// then its stores topped up (so its factories have what they work with) and two building sites placed by its Command
// Base. That moment is copied (a save and a load) into a few games that go on side by side, each with other Workforce
// settings for colony 0:
//   - none, and settings set and then taken back: the same game, tick for tick (Auto is untouched);
//   - Manual with a row put on top: that row's buildings get their Workers before those of the rows under it;
//   - a cap: the row never has more Workers than it, once the extra have left;
//   - a minimum: the row gets that many as soon as it has buildings that could use them;
//   - pins and Keep staffed: no worker taken off those by the automatic moves (only by the player's own cap), except
//     at a full store (it can't work), and then it gets one back first once there's room;
//   - Manual with Building sites low keeps 1 Worker free for building, not 2 (none with its "at most" 0);
//   - a minimum with nobody free takes up to two Workers a pass off other buildings;
//   - the player's own presets: the same orders as setting it all by hand, and the same game;
//   - Rebalance now: Workers come off buildings that can't work or make what there's plenty of, and go to the jobs waiting;
//   - a save and a load keep the settings, and the game plays on the same.
// Every check runs on every seed (none is skipped for want of the right moment).
// Usage: node tools/workforce-test.js [seed] [minutes the computer plays first]
'use strict';
const fs = require('fs'), path = require('path'), vm = require('vm');
const files = ['util.js', 'defs.js', 'world.js', 'path.js', 'sim.js', 'ai.js', 'missions.js', 'orders.js'];
const src = files.map((f) => fs.readFileSync(path.join(__dirname, '..', 'js', f), 'utf8')).join('\n') +
  '\n;globalThis.__api = { newGame, simStep, hashState, serializeGame, deserializeGame, applyOrder, getS: () => S, wfCounts, wfAutoOrder, wfOrder, wfRowOf, wfRebalance, siteReady, removeBot, wantsStaff, stallWhy, BDEFS, WF_KEYS, isIdleWorker, wfKeepFree, wfSettings, wfPresetOrders, atLimit, siteCount, cancelTask, addBot, completeBuilding, getE };';
const seed = +(process.argv[2] || 4242), lead = +(process.argv[3] || 10);

function game() {
  const ctx = { console, Math, JSON, Map, Set, Array, Object, Number, String, Infinity, Uint8Array, Uint16Array, Int8Array, Int16Array, Int32Array, Uint32Array, Float32Array, Float64Array };
  ctx.sfx = () => {};
  vm.createContext(ctx);
  vm.runInContext(src, ctx);
  const api = ctx.__api;
  // (every building a colony's Worker comes off, and why: the automatic moves call unstaff)
  api.released = [];
  vm.runInContext('{ const was = unstaff; unstaff = function (b) { __api.released.push({ id: b.id, type: b.type, owner: b.owner, t: S.tick, lim: atLimit(b), why: (new Error().stack.split(\'\\n\')[2] || \'\').trim() }); return was(b); }; }', ctx);
  return api;
}
const run = (api, sec) => { const end = api.getS().time + sec; while (api.getS().time < end && api.getS().winner < 0) api.simStep(1 / 30); };
const P0 = 0;
const BDEFS = (g) => g.BDEFS;
let fails = 0;
const check = (ok, what) => { console.log(`  ${ok ? 'ok  ' : 'FAIL'} ${what}`); if (!ok) fails++; };

const kilnIds = []; // (the two Cement Works the test adds: see below)
// The game everything starts from: a Colony game, so no rival can end it, and the Murmur off.
const base = game();
base.newGame({ seed, difficulty: 'normal', autoplay: true, mode: 'colony', murmur: 'off' });
run(base, lead * 60);
// (Colony 0 is the player's from here on: its computer stops running it, as one of yours would be. Its builds and
// settings stay as they were.)
{
  const S = base.getS(), P = S.players[P0], L = S.buildings.find((b) => !b.dead && b.owner === P0 && b.type === 'lander');
  P.ai = false; delete P.triage;
  // Its stores topped up, so no factory waits for what it works with (the same every time).
  // (the raw goods only: a factory's own product stops at its stock limit)
  // (Stone to 30: a Quarry rests at 40)
  for (const g of ['fiber', 'stone', 'ore', 'crystal', 'crude']) L.stock[g] = Math.max(L.stock[g] || 0, g === 'stone' ? 30 : 60);
  // Two Cement Works more, finished, with Stone in them and no stock limit: a row with two buildings that can always work.
  const spots = [];
  for (let r = 2; r < 16; r++) for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) if (Math.max(Math.abs(dx), Math.abs(dy)) === r) spots.push([L.x + dx, L.y + dy]);
  let kilns = 0;
  for (const [x, y] of spots) {
    if (kilns >= 2) break;
    const o = base.applyOrder(P0, 'place', ['kiln', x, y]);
    if (!o || !o.ok) continue;
    const b = base.getE(o.id);
    base.completeBuilding(b);
    b.limit = -1; b.stock.stone = 6;
    kilnIds.push(b.id); kilns++;
  }
  // Two building sites by the Command Base, so there's building to keep Workers free for.
  let placed = 0;
  for (let r = 3; r < 14 && placed < 2; r++) for (let dy = -r; dy <= r && placed < 2; dy++) for (let dx = -r; dx <= r && placed < 2; dx++) {
    if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
    for (const t of ['lab', 'airfield', 'depot']) {
      if (S.buildings.some((b) => !b.dead && b.owner === P0 && !b.built && b.type === t)) continue;
      const o = base.applyOrder(P0, 'place', [t, L.x + dx, L.y + dy]);
      if (o && o.ok) { placed++; break; }
    }
  }
  run(base, 1);
}
const snap = base.serializeGame();
// (Loaded once more as the player's: a load settles a few things for a person's colony, a Foundry left on the computer's
// warbot mode say, so later saves and loads compare like with like.)
const copy = () => { const g = game(); g.deserializeGame(snap); g.deserializeGame(g.serializeGame()); return g; };
const S0 = base.getS();
const blds = (g, k) => g.getS().buildings.filter((b) => !b.dead && b.owner === P0 && b.built && g.wfRowOf(b.type) === k);
const staffed = (g, k) => g.wfCounts(P0)[k];
console.log(`seed ${seed}: copies at ${(S0.time / 60).toFixed(1)} min; colony 0 has ${S0.bots.filter((u) => !u.dead && u.owner === P0 && u.type === 'worker').length} Workers, ${S0.buildings.filter((b) => !b.dead && b.owner === P0 && b.built).length} buildings, ${base.siteCount(P0)} site(s)`);
if (S0.winner >= 0) { console.log('the game is over by then: try another seed or fewer minutes'); process.exit(2); }
if (!S0.bots.some((u) => !u.dead && u.owner === P0 && u.type === 'worker')) { console.log('colony 0 is out by then: try another seed or fewer minutes'); process.exit(2); }
console.log(`  rows now: ${JSON.stringify(base.wfCounts(P0))}`);
console.log(`  Auto order: ${base.wfAutoOrder(P0).order.join(' > ')}`);

// 1) Auto untouched: settings set and taken back before the next turn leave no trace, and the game plays on the same.
{
  const a = copy(), b = copy();
  b.applyOrder(P0, 'wfRow', ['fiber', 'min', 3]); b.applyOrder(P0, 'wfOrder', [['fiber', 'sites']]); b.applyOrder(P0, 'wfRow', ['ore', 'pin', true]);
  b.applyOrder(P0, 'wfRow', ['fiber', 'min', 0]); b.applyOrder(P0, 'wfOrder', [null]); b.applyOrder(P0, 'wfRow', ['ore', 'pin', false]);
  check(b.getS().players[P0].wf === undefined, 'taking every setting back leaves no Workforce settings');
  run(a, 90); run(b, 90);
  check(a.hashState() === b.hashState(), 'and the game plays on exactly as one never touched');
}

// 2) Manual: a raid leaves the colony five Workers, all freed, too few to run everything. The row Auto would staff last
// goes on top of a Manual ladder (the rest as Auto has them): eight seconds on, it's staffed, as it isn't on Auto.
{
  const waiting = (g, k) => blds(g, k).filter((b) => g.wantsStaff(b) && !g.stallWhy(b)).length;
  const a = copy(), m = copy();
  free(a, 5); free(m, 5);
  // (the row Auto puts lowest of those with a building that could work now: the one it would staff last)
  const auto = a.wfAutoOrder(P0).order;
  const top = auto.filter((k) => !['sites', 'repair', 'pave'].includes(k) && waiting(a, k)).pop();
  const ready = blds(m, top).filter((b) => m.wantsStaff(b) && !m.stallWhy(b)).map((b) => b.id); // (those that can work now)
  m.applyOrder(P0, 'wfOrder', [[top, ...auto.filter((k) => k !== top)]]);
  check(m.wfOrder(P0)[0] === top && m.wfOrder(P0).length === m.WF_KEYS.length, `Manual order set: ${top} first, every row in it`);
  run(a, 8); run(m, 8);
  const has = (q) => ready.filter((id) => { const b = q.getE(id); return b && (b.staff || b.staffInc); }).length;
  console.log(`  ${top}: ${blds(m, top).length} built, ${ready.length} could work at the raid; 8 s on Auto staffs ${has(a)} of those, Manual ${has(m)} (${staffed(a, top)} and ${staffed(m, top)} in the row)`);
  check(ready.length > 0 && has(m) === ready.length && has(m) > has(a), `Manual with ${top} on top staffs every one of it that could work, Auto fewer`);
}

// 3) A cap: the row with the most Workers gets "at most 1".
{
  const g = copy();
  const k = g.WF_KEYS.filter((q) => blds(g, q).length).sort((a, c) => staffed(g, c) - staffed(g, a))[0];
  const was = staffed(g, k);
  g.applyOrder(P0, 'wfRow', [k, 'cap', 1]);
  let most = 0;
  run(g, 2);
  for (let s = 0; s < 60; s++) { run(g, 1); most = Math.max(most, staffed(g, k)); }
  console.log(`  cap: ${k} had ${was}, at most 1: most seen after ${most}`);
  check(was > 1 && most <= 1, `a cap of 1 on ${k} holds it to 1 for a minute`);
}

// 4) A minimum, on Auto: after a raid that leaves six Workers, the row Auto would staff last of those waiting gets "at
// least" as many as it has waiting: it has them eight seconds on (on Auto alone it hasn't).
{
  const a = copy(), g = copy();
  free(a, 6); free(g, 6);
  const waiting = (q, k) => blds(q, k).filter((b) => q.wantsStaff(b) && !q.stallWhy(b)).length;
  const k = g.wfAutoOrder(P0).order.filter((q) => !['sites', 'repair', 'pave'].includes(q) && waiting(g, q)).pop();
  const want = waiting(g, k);
  g.applyOrder(P0, 'wfRow', [k, 'min', want]);
  check(!g.wfOrder(P0), 'a minimum leaves the ladder on Auto');
  run(a, 8); run(g, 8);
  console.log(`  min: ${k} at least ${want}: ${staffed(g, k)} 8 s on (on Auto alone ${staffed(a, k)})`);
  check(staffed(g, k) >= want, `a minimum of ${want} on ${k} is met`);
}

// 5) Pins and Keep staffed: the automatic moves never take those Workers (a whole minute, Rebalance pressed too).
{
  const g = copy();
  const k = g.WF_KEYS.filter((q) => blds(g, q).length && staffed(g, q)).sort((a, c) => staffed(g, c) - staffed(g, a))[0];
  g.applyOrder(P0, 'wfRow', [k, 'pin', true]);
  const keep = g.getS().buildings.filter((b) => !b.dead && b.owner === P0 && b.built && b.staff && g.wfRowOf(b.type) && g.wfRowOf(b.type) !== k);
  for (const b of keep.slice(0, 3)) g.applyOrder(P0, 'keepStaff', [b.id, true]);
  const kept = new Set(keep.slice(0, 3).map((b) => b.id));
  g.released.length = 0;
  g.applyOrder(P0, 'wfRebalance', []);
  run(g, 60);
  // (the automatic moves: dispatch's, Rebalance's, a stock limit's, that one only while it's full; not a field run dry, say)
  const bad = g.released.filter((r) => r.owner === P0 && (g.wfRowOf(r.type) === k || kept.has(r.id)) && (/dispatch|release|wfRebalance/.test(r.why) || (/produce/.test(r.why) && !r.lim)));
  console.log(`  pin ${k} and Keep staffed on ${kept.size}: ${g.released.filter((r) => r.owner === P0).length} Workers moved in a minute, ${bad.length} of them off those`);
  check(bad.length === 0, 'no Worker taken off a pinned row or a Keep staffed building');
  for (const r of bad.slice(0, 4)) console.log('     ', r.type, r.why);
}

// 6) Rebalance now: a raid leaves the colony six Workers, freed, and the player calls them to buildings that can't work
// (a factory held at its stock limit) or make what there's plenty of, while other jobs wait. Rebalance takes them off
// those, and the jobs waiting get them: more of them than in the same game with Rebalance not pressed.
{
  const g = copy(), c = copy();
  for (const q of [g, c]) {
    free(q, 6);
    run(q, 1);
    const S = q.getS(), want = q.wfAutoOrder(P0);
    // (one factory that can't work, for sure: held at a stock limit of 0)
    const full = S.buildings.find((b) => !b.dead && b.owner === P0 && b.built && BDEFS(q)[b.type].make && !BDEFS(q)[b.type].bots && q.wfRowOf(b.type) && !b.staff && !b.staffInc);
    if (full) full.limit = 0;
    const poor = S.buildings.filter((b) => !b.dead && b.owner === P0 && b.built && q.wfRowOf(b.type) && !b.staff && !b.staffInc && (q.stallWhy(b) || q.atLimit(b) || want.why[q.wfRowOf(b.type)] === 'plenty'));
    for (const b of poor.slice(0, 3)) q.applyOrder(P0, 'callWorker', [b.id]); // (Call a worker takes a busy one too)
    q.poor = poor.length; q.called = poor.slice(0, 3).map((b) => b.id);
    run(q, 1);
  }
  const waitingIds = (q) => q.getS().buildings.filter((b) => !b.dead && b.owner === P0 && (!b.built ? !b.builder && q.siteReady(b) : q.wantsStaff(b) && !q.stallWhy(b))).map((b) => b.id);
  const got = (q, ids) => ids.filter((id) => { const b = q.getS().buildings.find((e) => e.id === id); return b && !b.dead && (b.built ? b.staff || b.staffInc : b.builder); }).length;
  // (Workers at work: building, or running a building that could work, and didn't make what there was plenty of, when
  // Rebalance was pressed)
  const plenty = g.wfAutoOrder(P0).why;
  const poor = g.getS().buildings.filter((b) => !b.dead && b.owner === P0 && b.built && (g.stallWhy(b) || g.atLimit(b) || plenty[g.wfRowOf(b.type)] === 'plenty' || g.called.includes(b.id))).map((b) => b.id);
  const useful = (q) => q.getS().bots.filter((u) => !u.dead && u.owner === P0 && u.type === 'worker' && u.task && (u.task.type === 'build' || (u.task.type === 'staff' && !poor.includes(u.task.bld)))).length;
  const ids = waitingIds(g), would = g.wfRebalance(P0, true);
  check(JSON.stringify(ids) === JSON.stringify(waitingIds(c)), 'the two games are the same up to Rebalance');
  g.released.length = 0;
  const moved = g.applyOrder(P0, 'wfRebalance', []);
  const off = g.released.filter((r) => r.owner === P0).length;
  // (5 s: long enough for the dispatch to send them, short of a stock limit's own release in the other game)
  run(g, 5); run(c, 5);
  console.log(`  rebalance: ${g.poor} buildings stalled or with plenty, called to; ${ids.length} jobs waiting; ${moved} moved (dry run said ${would}); 5 s later ${useful(g)} Workers at work (${useful(c)} not pressing it), ${got(g, ids)} of those jobs have one (${got(c, ids)})`);
  check(would > 0 && moved === would && off === moved, 'Rebalance now frees Workers off them (as many as its dry run said)');
  check(useful(g) > useful(c), 'and they go to the jobs waiting: more Workers at work than not pressing it');
}

// 7) A save and a load keep the settings (and Keep staffed), and the game goes on the same.
{
  const g = copy();
  const b = g.getS().buildings.find((q) => !q.dead && q.owner === P0 && q.built && q.staff && g.wfRowOf(q.type));
  g.applyOrder(P0, 'wfPreset', ['war']); g.applyOrder(P0, 'wfRow', ['sites', 'cap', 2]); g.applyOrder(P0, 'wfRow', ['fiber', 'min', 1]); g.applyOrder(P0, 'keepStaff', [b.id, true]);
  run(g, 20);
  const h = g.serializeGame(), g2 = game();
  g2.deserializeGame(h);
  check(JSON.stringify(g2.getS().players[P0].wf) === JSON.stringify(g.getS().players[P0].wf) && g2.getS().buildings.find((q) => q.id === b.id).keepStaff === 1, 'a save keeps the ladder, the rows\' settings and Keep staffed');
  check(g2.hashState() === g.hashState(), 'the loaded game is the same game');
  run(g, 45); run(g2, 45);
  check(g2.hashState() === g.hashState(), 'and plays on the same');
  check(g.wfOrder(P0)[0] === 'repair' && g.wfOrder(P0)[1] === 'war', 'the War preset puts Repairs and Ammo and Missiles first');
  // A damaged save: a row's minimum that isn't a whole number is refused.
  const o = JSON.parse(h); o.players[P0].wf.rows.fiber.min = 'x';
  let refused = false;
  try { game().deserializeGame(JSON.stringify(o)); } catch (e) { refused = true; }
  check(refused, 'a save with a bad row setting is refused');
}

// 8) Builders kept free: on Auto, or with Building sites on top, two (with a site waiting); Manual with Building sites
// lower, one; Building sites' "at most" 0, none.
{
  const g = copy(), kf = () => g.wfKeepFree(P0, 2);
  const auto = kf();
  g.applyOrder(P0, 'wfPreset', ['build']); const top = kf();
  g.applyOrder(P0, 'wfPreset', ['economy']); const low = kf();
  g.applyOrder(P0, 'wfRow', ['sites', 'cap', 0]); const none = kf();
  g.applyOrder(P0, 'wfOrder', [null]); const autoNone = kf();
  console.log(`  kept free for building: Auto ${auto}, sites on top ${top}, sites low ${low}, sites at most 0 ${none} (Auto ${autoNone})`);
  check(auto === 2 && top === 2 && low === 1 && none === 0 && autoNone === 0, 'two kept free on Auto or with sites on top, one with sites low, none at a cap of 0');
  // In play: a raid leaves 6 Workers, buildings waiting for more than that. Manual with sites low runs one more building.
  // (Workers not running a building: free, building, carrying or charging; dispatch counts them all as free)
  const mine = (q) => q.getS().bots.filter((u) => !u.dead && u.owner === P0 && u.type === 'worker');
  const notStaff = (q) => mine(q).filter((u) => !(u.task && u.task.type === 'staff')).length;
  const building = (q) => mine(q).filter((u) => u.task && u.task.type === 'build').length;
  const a = copy(), m = copy(), z = copy();
  for (const q of [a, m, z]) free(q, 6);
  m.applyOrder(P0, 'wfPreset', ['economy']);
  z.applyOrder(P0, 'wfPreset', ['economy']); z.applyOrder(P0, 'wfRow', ['sites', 'cap', 0]);
  run(a, 10); run(m, 10); run(z, 10);
  const sites = a.siteCount(P0);
  const what = (q) => mine(q).filter((u) => !(u.task && u.task.type === 'staff')).map((u) => u.task ? u.task.type : 'free').join(',') || 'none';
  console.log(`  6 Workers, ${sites} site(s): not running a building 10 s on: Auto ${notStaff(a)} (${what(a)}), Manual sites low ${notStaff(m)} (${what(m)}), sites at most 0 ${notStaff(z)} (${what(z)})`);
  check(sites > 0, 'a building site is waiting');
  check(notStaff(a) >= 2 && notStaff(m) === 1 && notStaff(z) <= 1 && !building(z), 'in play: Auto keeps 2 off the buildings, Manual with sites low 1, a cap of 0 none (and nobody building)');
}

// 9) A minimum with nobody free: a raid leaves 6 Workers, all at work 10 s on; a row with two buildings waiting and
// nobody on it goes on top of a Manual ladder (the rest under it) with "at least 2". In one dispatch pass it has them,
// from two buildings in the rows under it (none from a pinned row).
{
  const g = copy();
  free(g, 6);
  run(g, 10);
  const waiting = (k) => blds(g, k).filter((b) => g.wantsStaff(b) && !g.stallWhy(b)).length;
  const rows = g.wfAutoOrder(P0).order.filter((q) => !['sites', 'repair', 'pave'].includes(q));
  let k = rows.filter((q) => waiting(q) >= 2 && !staffed(g, q)).pop();
  if (!k) {
    // (none just now: the row Auto staffs last of those with two buildings that could work has its Workers sent off)
    const could = (q) => blds(g, q).filter((b) => (b.staff || b.staffInc || g.wantsStaff(b)) && !g.stallWhy(b)).length;
    k = rows.filter((q) => could(q) >= 2).pop();
    for (const b of blds(g, k)) if (b.staff || b.staffInc) g.applyOrder(P0, 'pause', [b.id, true]), g.applyOrder(P0, 'pause', [b.id, false]);
  }
  check(!!k && waiting(k) >= 2 && !staffed(g, k), `a row with two buildings waiting and nobody on it: ${k}`);
  {
    // (nobody free: any Worker still free is gone)
    for (const u of g.getS().bots.filter((v) => !v.dead && v.owner === P0 && v.type === 'worker' && g.isIdleWorker(v))) g.removeBot(u);
    const idle = g.getS().bots.filter((u) => !u.dead && u.owner === P0 && u.type === 'worker' && g.isIdleWorker(u)).length;
    const pin = g.WF_KEYS.find((q) => q !== k && staffed(g, q) && !['sites', 'repair', 'pave'].includes(q));
    g.applyOrder(P0, 'wfRow', [pin, 'pin', true]);
    const pinned = staffed(g, pin), auto = g.wfAutoOrder(P0).order;
    g.applyOrder(P0, 'wfOrder', [[k, ...auto.filter((q) => q !== k)]]);
    g.applyOrder(P0, 'wfRow', [k, 'min', 2]);
    g.released.length = 0;
    // (each colony's dispatch runs once every 8 ticks)
    for (let t = 0; t < 8; t++) g.simStep(1 / 30);
    const off = g.released.filter((r) => r.owner === P0 && /dispatch|release/.test(r.why)).length, one = staffed(g, k);
    for (let t = 0; t < 8; t++) g.simStep(1 / 30);
    console.log(`  min with nobody free: ${idle} free; ${k} at least 2: ${one} after one pass (${off} taken off other buildings), ${staffed(g, k)} after two; pinned ${pin} ${pinned} -> ${staffed(g, pin)}`);
    check(idle === 0 && off === 2 && staffed(g, k) >= 2, 'a minimum with nobody free takes two Workers off other buildings in one pass');
    check(staffed(g, pin) >= pinned, 'none of them from a pinned row');
  }
}

// 10) Pins and a full store: a pinned row's factory at its stock limit lets its Worker go after the usual while, and gets
// one back first once it has room. (One of the two Cement Works the test added, with its Worker inside, at work.)
{
  const g = copy();
  const S = g.getS(), b = g.getE(kilnIds[0]);
  if (!b.staff && !b.staffInc) g.applyOrder(P0, 'callWorker', [b.id]);
  let t0 = 0;
  while (t0 < 30 * 30 && !(b.staff && g.getE(b.staff) && g.getE(b.staff).inside === b.id)) { g.simStep(1 / 30); t0++; }
  check(!!(b.staff && g.getE(b.staff).inside === b.id), `a Cement Works with its Worker inside (${(t0 / 30).toFixed(1)} s)`);
  g.applyOrder(P0, 'wfRow', [g.wfRowOf(b.type), 'pin', true]);
  b.limit = 0; // (its stock limit: at it at once)
  let t1 = 0;
  while (t1 < 30 * 30 && (b.staff || b.staffInc)) { g.simStep(1 / 30); t1++; }
  const off = !b.staff && !b.staffInc, back = b.wfBack === 1;
  b.limit = -1; // (room again: no limit at all)
  // (a Worker comes free just then, by the Command Base: the first job it gets is this one's)
  const L = S.buildings.find((q) => !q.dead && q.owner === P0 && q.type === 'lander');
  g.addBot(P0, 'worker', L.x, L.y);
  let t = 0;
  while (t < 90 && !(b.staff || b.staffInc)) { g.simStep(1 / 30); t++; }
  console.log(`  full store: pinned ${b.type} ${off ? `let its Worker go after ${(t1 / 30).toFixed(1)} s` : 'kept its Worker'} (marked to get one back: ${back}); with room, a Worker on its way after ${(t / 30).toFixed(2)} s`);
  check(off && back, 'a pinned building at its stock limit lets its Worker go, marked to get one back first');
  check(!!(b.staff || b.staffInc) && t <= 9 && !b.wfBack, 'and gets one back within a dispatch pass of having room');
}

// 11) The player's own presets: settings saved (wfSettings) and put back (wfPresetOrders: the same wfOrder and wfRow
// orders as by hand) give the same settings, and a game that takes them plays on the same as one set by hand.
{
  const g = copy(), h = copy();
  g.applyOrder(P0, 'wfPreset', ['war']); g.applyOrder(P0, 'wfRow', ['fiber', 'min', 2]); g.applyOrder(P0, 'wfRow', ['sites', 'cap', 3]); g.applyOrder(P0, 'wfRow', ['ore', 'pin', true]);
  const pre = JSON.parse(JSON.stringify(g.wfSettings(P0))); // (as the device keeps it)
  // h: other settings first, then the preset
  h.applyOrder(P0, 'wfRow', ['fiber', 'cap', 1]); h.applyOrder(P0, 'wfRow', ['stone', 'min', 4]); h.applyOrder(P0, 'wfRow', ['ore', 'pin', false]);
  const ords = h.wfPresetOrders(P0, pre);
  for (const [n, a] of ords) h.applyOrder(P0, n, a);
  console.log(`  preset: ${ords.length} orders put it back: ${ords.map(([n, a]) => n + ' ' + JSON.stringify(a)).join('; ').slice(0, 200)}`);
  check(JSON.stringify(h.wfSettings(P0)) === JSON.stringify(g.wfSettings(P0)), 'a preset put back gives the same ladder and rows');
  check(h.wfPresetOrders(P0, pre).length === 0, 'and once in place, putting it back again sends nothing');
  check(h.hashState() === g.hashState(), 'the game is the same as one set by hand');
  run(g, 30); run(h, 30);
  check(h.hashState() === g.hashState(), 'and plays on the same');
  // An Auto preset (no order) gives Auto back; a damaged one is read as no settings.
  const ao = h.wfPresetOrders(P0, { order: null, rows: {} });
  for (const [n, a] of ao) h.applyOrder(P0, n, a);
  check(!h.wfOrder(P0) && h.getS().players[P0].wf === undefined, 'a preset of Auto with nothing set clears it all');
  const bad = h.wfPresetOrders(P0, { order: 'x', rows: { fiber: { min: 'lots', cap: {}, pin: 'y' }, nope: { min: 3 } } });
  for (const [n, a] of bad) h.applyOrder(P0, n, a);
  check(!h.wfOrder(P0) && JSON.stringify(h.wfSettings(P0).rows) === JSON.stringify({ fiber: { min: 0, cap: 0, pin: true } }), 'a damaged preset gives only what it can mean');
}

/**
 * A raid: colony 0 keeps n Workers (those of the lowest ids), every building's freed, and those n left standing free,
 * charged full (none off to a charger, building or carrying a crate: what each does next is the dispatch's choice).
 */
function free(g, n) {
  for (const b of g.getS().buildings) if (!b.dead && b.owner === P0 && (b.staff || b.staffInc)) g.applyOrder(P0, 'pause', [b.id, true]), g.applyOrder(P0, 'pause', [b.id, false]);
  g.getS().bots.filter((u) => !u.dead && u.owner === P0 && u.type === 'worker').forEach((u, i) => {
    if (i >= n) { g.removeBot(u); return; }
    if (u.task) g.cancelTask(u);
    u.task = null; u.path = null; u.bat = 100;
  });
}

function waitingJobs(g) {
  let n = 0;
  for (const b of g.getS().buildings) {
    if (b.dead || b.owner !== P0) continue;
    if (!b.built ? !b.builder && g.siteReady(b) : g.wantsStaff(b) && !g.stallWhy(b)) n++;
  }
  return n;
}

console.log(fails ? `${fails} FAILED` : 'workforce: all OK');
if (fails) process.exitCode = 1;

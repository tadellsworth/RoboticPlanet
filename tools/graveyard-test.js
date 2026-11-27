// Headless checks for The Graveyard (space expansion, phase 2: GRAVE and DRIFT's salvage and junk in js/defs.js, graveMap in
// js/world.js, the rules in js/sim.js: graveTick, salvageIn, the Shuttle's Drop Outpost): the map made at every size, the same
// turned half round and fair to both colonies (starter fields, oil, the salvage and debris lanes, the hulks); the hulks landed
// on and built on (a Shuttle lands a Drop Outpost; then a Depot goes up beside it), the Arbiter's relay kept clear; salvage
// towed in and broken down for Alloy and Chips; the Arbiter taken, held, jammed, its salvage sent home, and Hold the Arbiter
// won; a craft clipped flying through a debris lane; a save made mid-tow; two runs of the same game alike; a rival's
// Dropship jamming the Arbiter; and on The Ring a rival's Shuttle landing a Drop Outpost by a derelict.
// Run: node tools/graveyard-test.js
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const files = ['util', 'defs', 'world', 'path', 'sim', 'ai', 'missions', 'orders'];
const source = files.map((f) => fs.readFileSync(path.join(__dirname, '..', 'js', f + '.js'), 'utf8')).join('\n');
const mk = () => {
  const c = { console, Math, JSON, Map, Set, Array, Object, Number, String, Infinity, Uint8Array, Int8Array, Int16Array, Int32Array, Uint32Array, Float32Array, Float64Array, Uint16Array, sfx: () => {} };
  vm.createContext(c);
  vm.runInContext(source, c);
  vm.runInContext(HELP, c);
  return c;
};
const run = (c, code) => JSON.parse(vm.runInContext(`(() => JSON.stringify((() => { ${code} })()))()`, c));
let fails = 0;
const check = (name, ok, x) => { console.log((ok ? 'PASS ' : 'FAIL ') + name + (ok ? '' : '  ' + JSON.stringify(x))); if (!ok) fails++; };

const HELP = `
  const SH_GRAVE = SHAPE_PRESETS.findIndex((s) => s.graveyard);
  const free = (t) => S.terrain[t] === T_GROUND && !S.bAt[t] && !S.res[t] && !S.road[t] && !S.ramp[t] && !graveCoreAt(t);
  const spot = (cx, cy, rmin, rmax, ok) => { let best = null, bd = 1e9; for (let j = 2; j < S.H - 2; j++) for (let i = 2; i < S.W - 2; i++) { const d = dist(i, j, cx, cy); if (d < rmin || d > rmax || !free(tIdx(i, j)) || (ok && !ok(i, j))) continue; if (d < bd) { bd = d; best = [i, j]; } } return best; };
  const until = (fn, secs) => { for (let k = 0; k < 30 * secs && !fn(); k++) simStep(SIM_STEP); return fn(); };
  const pad = (p, x, y) => { const z = S.zone[tIdx(x, y)]; const s = spot(x, y, 3, 14, (i, j) => [[i, j], [i + 1, j], [i, j + 1], [i + 1, j + 1]].every(([a, c]) => free(tIdx(a, c)) && S.zone[tIdx(a, c)] === z)); const b = addBuilding(p, 'launchpad', s[0], s[1], true); bump(b.stock, 'fuel', 20); computeTerritory(); return b; };
  const craft = (p, type, b) => { const u = addBot(p, type, b.x, b.y); u.bat = 100; parkCraft(u, b); return u; };
  const quiet = () => { for (const P of S.players) P.ai = false; };
  const hulk = (kind, k) => S.grave.hulks.filter((h) => h.kind === kind)[k || 0];
  const mid = (h) => [Math.floor((h.x0 + h.x1) / 2), Math.floor((h.y0 + h.y1) / 2)];
  Object.assign(globalThis, { SH_GRAVE, free, spot, until, pad, craft, quiet, hulk, mid });
`;

// ---- 1. The map: every size, the same turned half round, fair to both colonies
{
  const c = mk();
  const r = run(c, `
    const out = [];
    for (let size = 0; size < SIZE_PRESETS.length; size++) for (const seed of [11, 21, 37]) {
      newGame({ seed, mode: 'versus', shape: SH_GRAVE, size, players: 2 });
      const W = S.W, H = S.H, N = W * H, G = S.grave;
      let asym = 0; for (let t = 0; t < N; t++) if (S.terrain[t] !== S.terrain[N - 1 - t] || S.res[t] !== S.res[N - 1 - t] || (S.res[t] && S.amt[t] !== S.amt[N - 1 - t])) asym++;
      const Ls = S.players.map((P) => getE(P.lander));
      const onHome = Ls.map((L) => (graveHulkAt(L.x, L.y) || {}).kind);
      // starter fields: Ore and Crystal tiles, oil, within 16 tiles walked
      const reach = Ls.map((L) => { const z = S.zone[tIdx(L.x, L.y)], n = { ore: 0, crystal: 0, oil: 0 }; for (let t = 0; t < N; t++) { const i = t % W, j = (t / W) | 0; if (dist(i, j, L.x, L.y) > 16) continue; let inZ = false; for (const [a, b] of [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1]]) if (inMap(i + a, j + b) && S.zone[tIdx(i + a, j + b)] === z) inZ = true; if (!inZ) continue; if (S.res[t] === R_ORE) n.ore++; if (S.res[t] === R_CRYSTAL) n.crystal++; if (S.res[t] === R_OIL) n.oil++; } return n; });
      // the hulks: twins, the Arbiter its own; its relay bare ground, nothing on it
      const tw = G.hulks.every((h) => { const o = G.hulks[h.tw]; return o && o.x0 === W - 1 - h.x1 && o.y0 === H - 1 - h.y1 && o.kind === h.kind; });
      let core = 0, coreBad = 0; for (let j = G.core.y0; j <= G.core.y1; j++) for (let i = G.core.x0; i <= G.core.x1; i++) { core++; const t = tIdx(i, j); if (S.terrain[t] !== T_GROUND || S.res[t] || S.bAt[t]) coreBad++; }
      const coreSym = G.core.x0 === W - 1 - G.core.x1 && G.core.y0 === H - 1 - G.core.y1;
      // lanes: twin pairs over clear void; salvage and junk both there; each salvage rock as far from one base as its twin from the other
      const L = S.space.lanes, R2 = S.space.rocks;
      let laneBad = 0; for (let k = 0; k < L.length; k += 2) { const a = L[k], b = L[k + 1]; if (Math.abs(a.x0 - (W - b.x0)) > 1e-6 || Math.abs(a.y1 - (H - b.y1)) > 1e-6) laneBad++; for (let q = 0; q <= 20; q++) { const x = a.x0 + (a.x1 - a.x0) * q / 20, y = a.y0 + (a.y1 - a.y0) * q / 20; if (S.terrain[tIdx(Math.floor(x), Math.floor(y))] !== T_CHASM) laneBad++; } }
      const kinds = [...new Set(L.map((l) => l.k))].sort().join();
      const fair = R2.filter((r) => r.k === 'salvage').every((r) => { const t = R2.find((q) => q.id === r.tw), la = L[r.lane], lb = L[t.lane]; return Math.abs(segDist(la, Ls[0].x + 0.5, Ls[0].y + 0.5) - segDist(lb, Ls[1].x + 0.5, Ls[1].y + 0.5)) < 1e-6; });
      out.push({ size, seed, W, H, asym, onHome, reach, tw, core, coreBad, coreSym, laneBad, kinds, salvage: R2.filter((r) => r.k === 'salvage').length, junk: R2.filter((r) => r.k === 'junk').length, fair, hulks: G.hulks.length, posts: S.posts.length });
    }
    return out;
  `);
  check('Made at every size and seed: two colonies, each on its own home hulk', r.every((x) => x.onHome.join() === 'home,home'), r.map((x) => [x.size, x.seed, x.onHome]));
  check('The same turned half round, tile for tile (ground, deposits and their amounts)', r.every((x) => x.asym === 0), r.map((x) => [x.size, x.seed, x.asym]));
  check('The hulks come in twins by the half turn, the Arbiter its own twin in the middle', r.every((x) => x.tw && x.coreSym), r.map((x) => [x.size, x.seed, x.tw, x.coreSym]));
  check('Bridge and far wrecks past Small (5 to 7 hulks), only the homes and the Arbiter on Small', r.every((x) => (x.size === 0 ? x.hulks === 3 : x.hulks >= 5)), r.map((x) => [x.size, x.hulks]));
  check('The Arbiter\'s relay: bare open ground, nothing on it', r.every((x) => x.core >= 16 && x.coreBad === 0), r.map((x) => [x.size, x.coreBad]));
  check('Starter fields at home, the same for both: at least 5 Ore and 5 Crystal tiles and oil within 16 tiles walked', r.every((x) => x.reach.every((n) => n.ore >= 5 && n.crystal >= 5 && n.oil >= 1) && JSON.stringify(x.reach[0]) === JSON.stringify(x.reach[1])), r.map((x) => [x.size, x.reach]));
  check('Salvage and debris lanes in twin pairs, over the void all along', r.every((x) => x.laneBad === 0 && x.kinds === 'junk,salvage' && x.salvage >= 6 && x.junk >= 6), r.map((x) => [x.size, x.seed, x.laneBad, x.kinds, x.salvage, x.junk]));
  check('Fair: each salvage wreck\'s lane as far from one Command Base as its twin\'s from the other', r.every((x) => x.fair), r.map((x) => [x.size, x.fair]));
}

// ---- 2. Landing on a hulk and building there; the relay kept clear
{
  const c = mk();
  const r = run(c, `
    newGame({ seed: 21, mode: 'versus', shape: SH_GRAVE, size: 1 }); quiet();
    const L = getE(S.players[0].lander), P = pad(0, L.x, L.y), sh = craft(0, 'shuttle', P);
    bump(L.stock, 'cement', 20); bump(L.stock, 'alloy', 20);
    const br = hulk('bridge', 0), [bx, by] = mid(br), home = S.zone[tIdx(L.x, L.y)], z = S.zone[tIdx(bx, by)];
    const before = canPlace(0, 'depot', bx, by).ok;
    const why = orderShuttleOutpost(0, sh, bx, by);
    const landed = until(() => S.buildings.some((b) => !b.dead && b.owner === 0 && b.type === 'dropost'), 120);
    const d = S.buildings.find((b) => !b.dead && b.owner === 0 && b.type === 'dropost');
    const s = d ? spot(d.x, d.y, 1, 3, (i, j) => canPlace(0, 'depot', i, j).ok) : null;
    const after = !!s, placed = s ? !!applyOrder(0, 'place', ['depot', s[0], s[1]]) : false;
    const back = until(() => sh.inside === P.id, 60);
    const C = S.grave.core, ct = tIdx(C.x0 + 1, C.y0 + 1);
    return { why, landed, onBridge: d ? (graveHulkAt(d.x, d.y) || {}).kind : '', zoneApart: z !== home, before, after, placed, back,
      core: { place: canPlace(0, 'outpost', C.x0 + 1, C.y0 + 1).ok, road: canRoad(0, C.x0 + 1, C.y0 + 1), land: craftLandable(ct, sh) },
      walkable: walkable(tIdx(bx, by)), land: craftLandable(tIdx(bx, by), sh) };
  `);
  check('A bridge wreck is its own ground, apart from home (no walking there): landable', r.zoneApart && r.walkable && r.land, r);
  check('No building there before the land is yours', !r.before, r);
  check('A Shuttle lands a Drop Outpost on it: it unfolds there and the Shuttle flies home', r.why === '' && r.landed && r.onBridge === 'bridge' && r.back, r);
  check('Then the hulk is built on: a Depot goes up beside the Drop Outpost', r.after && r.placed, r);
  check('The Arbiter\'s relay: nothing built, laid or landed on it', !r.core.place && !r.core.road && !r.core.land, r.core);
}

// ---- 3. Salvage towed in: Alloy and Chips at the pad; debris is not towed
{
  const c = mk();
  const r = run(c, `
    newGame({ seed: 11, mode: 'versus', shape: SH_GRAVE, size: 1 }); quiet();
    const L = getE(S.players[0].lander), P = pad(0, L.x, L.y), sh = craft(0, 'shuttle', P);
    const rk = S.space.rocks.filter((q) => q.k === 'salvage').sort((a, b) => { const pa = rockPos(a), pb = rockPos(b); return dist2(pa.x, pa.y, P.x, P.y) - dist2(pb.x, pb.y, P.x, P.y); })[0];
    const junk = S.space.rocks.find((q) => q.k === 'junk');
    const a0 = P.stock.alloy || 0, c0 = P.stock.chip || 0;
    const jw = orderTow(0, sh, junk.id);
    const why = orderTow(0, sh, rk.id);
    const hooked = until(() => rk.tow === sh.id, 120);
    const done = until(() => rk.gone > 0, 240);
    const got = [(P.stock.alloy || 0) - a0, (P.stock.chip || 0) - c0];
    const t0 = rk.gone, back = until(() => !rk.gone, DRIFT.salvageBack + 5);
    return { jw, why, hooked, done, got, towed: S.players[0].stats.towed, field: S.res.some((v, t) => false), back, after: +(S.time - t0).toFixed(1) };
  `);
  check('A debris shard is not towed', /Loose debris/.test(r.jw), r);
  check('A Shuttle hooks a salvage wreck and tows it home', r.why === '' && r.hooked && r.done, r);
  check(`At the pad it is broken down: ${JSON.stringify([8, 5])} Alloy and Chips into the pad's store, counted`, r.got[0] === 8 && r.got[1] === 5 && r.towed === 1, r);
  check('Another wreck drifts in on its lane DRIFT.salvageBack s later', r.back && Math.abs(r.after - 150) < 1.5, r);
}

// ---- 4. The Arbiter: taken by land, held, its salvage sent home, jammed; Hold the Arbiter won
{
  const c = mk();
  const r = run(c, `
    newGame({ seed: 21, mode: 'versus', shape: SH_GRAVE, size: 1, victory: 'uplinks' }); quiet();
    const L = getE(S.players[0].lander), P = pad(0, L.x, L.y), sh = craft(0, 'shuttle', P), C = S.grave.core;
    bump(L.stock, 'cement', 20); bump(L.stock, 'alloy', 20);
    const up = S.uplinks.map((u) => [u.arb, u.x, u.y]);
    const m = graveMid();
    const why = orderShuttleOutpost(0, sh, Math.floor(m.x) - 3, Math.floor(m.y));
    const taken = until(() => arbHolder() === 0, 150);
    const a0 = L.stock.alloy, c0 = L.stock.chip, h0 = S.grave.paid;
    until(() => S.grave.paid > h0, GRAVE.arb.every + 2);
    const got = [L.stock.alloy - a0, L.stock.chip - c0];
    // an armed warbot of the rival's by the relay jams it
    const w = addBot(1, 'warbot', Math.floor(m.x), Math.floor(m.y) + 2); w.task = { type: 'hold', x: w.x, y: w.y };
    for (let k = 0; k < 40; k++) simStep(SIM_STEP);
    const jammed = arbHolder() === -1 && S.grave.jam === 2;
    killBot(w, true);
    for (let k = 0; k < 40; k++) simStep(SIM_STEP);
    const again = arbHolder();
    // online, and held for UPLINK.hold s in all: the game is won
    S.time = Math.max(S.time, UPLINK.online + 1);
    const won = until(() => S.winner >= 0, UPLINK.hold + 20);
    return { why, up, taken, got, jammed, again, won, winner: S.winner, how: S.endHow, clock: S.upClock };
  `);
  check('Hold the Arbiter: the one Uplink is the Arbiter', r.up.length === 1 && r.up[0][0] === 1, r.up);
  check('A Drop Outpost landed by its relay takes the Arbiter (most land on the relay)', r.why === '' && r.taken, r);
  check(`Held, it sends ${JSON.stringify([3, 2])} Alloy and Chips into the Command Base every ${30} s`, r.got[0] === 3 && r.got[1] === 2, r.got);
  check('A rival\'s armed robot by the relay jams it: no one holds it; gone, it is held again', r.jammed && r.again === 0, r);
  check('Held 5 minutes in all once online: Hold the Arbiter is won', r.won && r.winner === 0 && r.how === 'uplinks', r);
}

// ---- 5. A debris lane clips a craft flying through it
{
  const c = mk();
  const r = run(c, `
    newGame({ seed: 37, mode: 'versus', shape: SH_GRAVE, size: 1 }); quiet();
    const L = getE(S.players[0].lander), P = pad(0, L.x, L.y), g = craft(0, 'gunship', P);
    const j = S.space.rocks.find((q) => q.k === 'junk');
    const hp0 = g.hp;
    // up and holding right where the shards drift
    craftLaunch(g, L.x, L.y, false); g.task = { type: 'hold', x: L.x, y: L.y };
    until(() => (g.alt || 0) >= 1, 10);
    let hits = 0, k = 0;
    for (; k < 30 * 20 && !g.dead && hits < 3; k++) { const p = rockPos(j); g.x = p.x; g.y = p.y; g.task = { type: 'hold', x: p.x, y: p.y }; const h = g.hp; simStep(SIM_STEP); if (g.hp < h) hits++; }
    return { hits, lost: hp0 - g.hp, dead: !!g.dead, bump: SPACE.bump, secs: +(k / 30).toFixed(1) };
  `);
  check('A craft in a debris lane is clipped: SPACE.bump a hit, SPACE.bumpGap s apart (a light hazard: three hits take a Gunship under half)', r.hits === 3 && r.lost === r.hits * r.bump && !r.dead && r.secs >= 2 * 3 - 0.5, r);
}

// ---- 6. A save made mid-tow, and two runs alike
{
  const setup = `
    newGame({ seed: 17, mode: 'versus', shape: SH_GRAVE, size: 1, autoplay: true });
    const L = getE(S.players[0].lander), P = pad(0, L.x, L.y), sh = craft(0, 'shuttle', P);
    const rk = S.space.rocks.find((q) => q.k === 'salvage'); orderTow(0, sh, rk.id);
    until(() => sh.mission && sh.mission.phase === 'tow', 120);
  `;
  const a = mk(), b = mk();
  const ra = run(a, setup + `return { ph: sh.mission && sh.mission.phase, tow: rk.tow === sh.id, json: serializeGame() };`);
  run(b, setup + 'return 0;');
  const c = mk();
  const rc = run(c, `deserializeGame(${JSON.stringify(ra.json)}); const sh = S.bots.find((u) => u.type === 'shuttle' && u.owner === 0 && u.mission); const rk = S.space.rocks.find((q) => q.tow); return { ph: sh && sh.mission.phase, tow: !!rk && rk.tow === sh.id, ok: checkSave(JSON.parse(serializeGame())) === undefined, grave: !!S.grave && !!S.grave.core };`);
  const go = 'for (let k = 0; k < 30 * 120; k++) simStep(SIM_STEP); return { h: hashState() >>> 0, t: S.time, towed: S.players.map((P) => P.stats.towed || 0), arb: S.grave.owner };';
  const ha = run(a, go), hb = run(b, go), hc = run(c, go);
  check('A save made mid-tow loads and checks, still towing, the wreck still on its cable', ra.ph === 'tow' && ra.tow && rc.ph === 'tow' && rc.tow && rc.ok && rc.grave, { ra: { ph: ra.ph, tow: ra.tow }, rc });
  check('Deterministic: the same game run twice is the same, and so is the one saved and loaded mid-tow', ha.h === hb.h && ha.h === hc.h && ha.towed[0] >= 1, { ha, hb, hc });
}

// ---- 7. The mission: its setup on The Graveyard, the first goal met
{
  const c = mk();
  const r = run(c, `
    const k = MISSIONS.findIndex((m) => m.id === 'graveyard');
    newGame(missionOptions(k, 2));
    const P = S.buildings.find((b) => !b.dead && b.owner === 0 && b.type === 'launchpad' && b.built);
    const sh = P ? craft(0, 'shuttle', P) : null;
    const rk = S.space && S.space.rocks.find((q) => q.k === 'salvage');
    const why = sh && rk ? orderTow(0, sh, rk.id) : 'no pad';
    until(() => (S.players[0].stats.towed || 0) >= 1, 300);
    return { grave: !!S.grave, pad: !!P, space: !!S.space, why, towed: S.players[0].stats.towed || 0, st: missionStates(S.mission).map((g) => g.n + ':' + g.have) };
  `);
  check('The Graveyard mission: a Launch Pad ready, salvage drifting, a tow counted for its first goal', r.grave && r.pad && r.space && r.why === '' && r.towed >= 1, r);
}

// ---- 8. Rivals: a Dropship lands warbots to jam a rival's hold of the Arbiter; on The Ring a Shuttle lands a Drop Outpost by a derelict
{
  const c = mk();
  const r = run(c, `
    newGame({ seed: 21, mode: 'versus', shape: SH_GRAVE, size: 1 }); quiet();
    const L0 = getE(S.players[0].lander), L1 = getE(S.players[1].lander), P0 = pad(0, L0.x, L0.y), sh = craft(0, 'shuttle', P0);
    bump(L0.stock, 'cement', 20); bump(L0.stock, 'alloy', 20);
    const m = graveMid(); orderShuttleOutpost(0, sh, Math.floor(m.x) - 3, Math.floor(m.y));
    until(() => arbHolder() === 0, 150);
    const P1 = pad(1, L1.x, L1.y), ds = craft(1, 'dropship', P1);
    for (let k = 0; k < 6; k++) enterBuilding(addBot(1, 'warbot', L1.x, L1.y), L1);
    S.time = Math.max(S.time, 900);
    aiGraveJam(1, aiLevel(1));
    const ordered = !!ds.mission;
    const jammed = until(() => S.grave.jam === 2, 180);
    return { ordered, jammed, holder: arbHolder() };
  `);
  check('A rival lands warbots by Dropship beside the relay and jams the Arbiter', r.ordered && r.jammed && r.holder === -1, r);
  const c2 = mk();
  const r2 = run(c2, `
    newGame({ seed: 11, mode: 'versus', shape: SHAPE_PRESETS.findIndex((s) => s.asteroids), size: 1 }); quiet();
    const L = getE(S.players[1].lander), P = pad(1, L.x, L.y), sh = craft(1, 'shuttle', P);
    bump(L.stock, 'cement', 20); bump(L.stock, 'alloy', 20);
    S.time = 700;
    const me = S.buildings.filter((b) => !b.dead && b.owner === 1);
    aiSpacePost(1, me, L);
    const ordered = !!(sh.mission && sh.mission.kind === 'outpost');
    const down = until(() => S.buildings.some((b) => !b.dead && b.owner === 1 && b.type === 'dropost'), 180);
    return { ordered, down };
  `);
  check('The Ring: a rival\'s Shuttle lands a Drop Outpost beside a derelict it can\'t walk to', r2.ordered && r2.down, r2);
}

if (fails) { console.log(`${fails} failed`); process.exit(1); }
console.log('graveyard: all passed');

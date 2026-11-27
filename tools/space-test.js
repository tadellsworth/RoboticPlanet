// Headless checks for space expansion, phase 1 (SPACE, GUNSHIP, PDT, DRIFT, DERELICT; the rules in js/sim.js): no aircraft
// on The Ring and Orbital platforms (and no spacecraft anywhere else), a Launch Pad built and its yard's craft, a Shuttle
// supplying an Outpost on a deck no bridge reaches, a Dropship landing a squad past a raised drawbridge, a Gunship's
// lasers and Point-Defence's tracers, the drifting asteroids (curved orbits clear of the decks, twins in step, the same on
// every device and worked out from the time alone, mined in passing, towed home, a craft that clips one hurt), each derelict module's hold, a save made mid-flight,
// and two runs of the same game alike.
// Run: node tools/space-test.js
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
  const SH_RING = SHAPE_PRESETS.findIndex((s) => s.asteroids), SH_ORB = SHAPE_PRESETS.findIndex((s) => s.orbital);
  const free = (t) => S.terrain[t] === T_GROUND && !S.bAt[t] && !S.res[t] && !S.road[t] && !S.ramp[t] && !orbTile(t);
  const spot = (cx, cy, rmin, rmax, ok) => { let best = null, bd = 1e9; for (let j = 2; j < S.H - 2; j++) for (let i = 2; i < S.W - 2; i++) { const d = dist(i, j, cx, cy); if (d < rmin || d > rmax || !free(tIdx(i, j)) || (ok && !ok(i, j))) continue; if (d < bd) { bd = d; best = [i, j]; } } return best; };
  const until = (fn, secs) => { for (let k = 0; k < 30 * secs && !fn(); k++) simStep(SIM_STEP); return fn(); };
  // a built Launch Pad of p's on 2 by 2 free ground near (x, y), with Fuel, Alloy and Chips
  const pad = (p, x, y) => { const z = S.zone[tIdx(x, y)]; const s = spot(x, y, 3, 14, (i, j) => [[i, j], [i + 1, j], [i, j + 1], [i + 1, j + 1]].every(([a, c]) => free(tIdx(a, c)) && S.zone[tIdx(a, c)] === z)); const b = addBuilding(p, 'launchpad', s[0], s[1], true); bump(b.stock, 'fuel', 20); bump(b.stock, 'alloy', 20); bump(b.stock, 'chip', 20); computeTerritory(); return b; };
  const craft = (p, type, b) => { const u = addBot(p, type, b.x, b.y); u.bat = 100; parkCraft(u, b); return u; };
  const quiet = () => { for (const P of S.players) { P.ai = false; } }; // (no computer player meddling)
  Object.assign(globalThis, { SH_RING, SH_ORB, free, spot, until, pad, craft, quiet });
`;

// ---- 1. The air ban: out in space no aircraft, and the spacecraft only out there
{
  const c = mk();
  const r = run(c, `
    newGame({ seed: 5, mode: 'versus', shape: SH_RING }); quiet();
    const L = getE(S.players[0].lander), s = spot(L.x, L.y, 2, 6);
    const placed = applyOrder(0, 'place', ['airfield', s[0], s[1]]), placedFlak = applyOrder(0, 'place', ['flak', s[0], s[1]]);
    const ring = { af: worldBan('airfield'), mast: worldBan('mast'), flak: worldBan('flak'), pad: worldBan('launchpad'), pd: worldBan('pdturret'),
      bots: ['cargoplane', 'bomber', 'airship', 'shuttle', 'dropship', 'gunship'].map((k) => botBanned(0, k)), placed: !!(placed && placed.ok), placedFlak: !!(placedFlak && placedFlak.ok),
      missiles: worldBan('silo') + worldBan('nukesilo') + worldBan('munitions') };
    newGame({ seed: 5, mode: 'versus', shape: 0 });
    const std = { pad: worldBan('launchpad'), pd: worldBan('pdturret'), af: worldBan('airfield'), bots: ['cargoplane', 'shuttle', 'gunship'].map((k) => botBanned(0, k)) };
    return { ring, std };
  `);
  check('The Ring: no Airfield, Mooring Mast or Flak Gun; a Launch Pad and Point-Defence are allowed', !!r.ring.af && !!r.ring.mast && !!r.ring.flak && r.ring.pad === '' && r.ring.pd === '', r.ring);
  check('The Ring: Cargo Planes, Vulcan Bombers and Airships barred, spacecraft not; Missiles and nukes still fly', r.ring.bots.join() === 'true,true,true,false,false,false' && r.ring.missiles === '', r.ring);
  check('The Ring: an order to place an Airfield or a Flak Gun is refused', !r.ring.placed && !r.ring.placedFlak, r.ring);
  check('A planet map: no Launch Pad, Point-Defence or spacecraft; aircraft as ever', !!r.std.pad && !!r.std.pd && r.std.af === '' && r.std.bots.join() === 'false,true,true', r.std);
}

// ---- 2. A Launch Pad goes up, and its yard builds a Shuttle that parks on it
{
  const c = mk();
  const r = run(c, `
    newGame({ seed: 7, mode: 'versus', shape: SH_RING }); quiet();
    const L = getE(S.players[0].lander), z = S.zone[tIdx(L.x, L.y)];
    for (const g of ['cement', 'alloy', 'chip', 'fiber', 'fuel']) bump(L.stock, g, 60);
    const s = spot(L.x, L.y, 3, 9, (i, j) => [[i, j], [i + 1, j], [i, j + 1], [i + 1, j + 1]].every(([a, c]) => free(tIdx(a, c)) && S.zone[tIdx(a, c)] === z && S.owner[tIdx(a, c)] === 0));
    const res = applyOrder(0, 'place', ['launchpad', s[0], s[1]]);
    const P = S.buildings.find((b) => b.type === 'launchpad' && b.owner === 0);
    if (P) for (const t of roadRouteTo(0, P) || []) setRoad(t % S.W, (t / S.W) | 0, true, 0);
    const built = until(() => P && P.built, 300);
    applyOrder(0, 'yard', [P.id, 'shuttle', 1]);
    applyOrder(0, 'yard', [P.id, 'cargoplane', 1]); // (not a pad's)
    const sh = until(() => S.bots.some((u) => !u.dead && u.type === 'shuttle' && u.inside === P.id), 240);
    const u = S.bots.find((v) => !v.dead && v.type === 'shuttle');
    return { ok: !!(res && res.ok), built, sh, home: u && u.home === P.id, two: footTiles('launchpad', P.x, P.y).every(([i, j]) => S.bAt[tIdx(i, j)] === P.id), planes: S.bots.filter((v) => v.type === 'cargoplane').length };
  `);
  check('A Launch Pad site (2 by 2) is placed and built', r.ok && r.built && r.two, r);
  check('Its yard builds a Shuttle (not a Cargo Plane), based and parked on the pad', r.sh && r.home && r.planes === 0, r);
}

// ---- 3 and 4. Into the Void's cut-off deck: a Shuttle supplies its Outpost, a Dropship lands Workers on it
{
  const c = mk();
  const r = run(c, `
    const k = MISSIONS.findIndex((m) => m.id === 'spacefall');
    newGame(missionOptions(k, 2));
    const L = getE(S.players[0].lander), far = S.mission.farT, home = S.zone[tIdx(L.x, L.y)];
    const O = S.buildings.find((b) => b.type === 'dropost' && b.owner === 0 && S.zone[tIdx(b.x, b.y)] === S.zone[far]);
    const P = pad(0, L.x, L.y), sh = craft(0, 'shuttle', P), dr = craft(0, 'dropship', P);
    bump(P.stock, 'cement', 20); bump(P.stock, 'fiber', 10);
    const raised = S.orb.br.filter((B) => B.up).length, cut = S.zone[far] !== home;
    const flew = until(() => O && O.airIn !== undefined, 240);
    const inFlight = sh.sf ? sh.sf.ph : 'none';
    const why = orderSquad(0, dr, far % S.W, (far / S.W) | 0, null, 'worker', 4);
    const landed = until(() => S.bots.filter((u) => !u.dead && u.type === 'worker' && !u.inside && S.zone[tIdx(Math.floor(u.x), Math.floor(u.y))] === S.zone[far]).length >= 3, 240);
    const back = until(() => dr.inside === P.id, 120);
    return { outpost: !!O, raised, cut, flew, cement: O ? O.stock.cement || 0 : -1, why, landed, back, inFlight, mods: S.space.mods.length };
  `);
  check('Into the Void: the west deck is cut off by its raised drawbridges, with a derelict Solar Array beside it', r.outpost && r.raised >= 1 && r.cut && r.mods === 1, r);
  check('A Shuttle flies supplies to the Outpost on the deck no bridge reaches, and lands them', r.flew && r.cement > 0, r);
  check('A Dropship lands a squad of Workers past the raised drawbridge, and flies home', r.why === '' && r.landed && r.back, r);
}

// ---- 5. Gunships and Point-Defence
{
  const c = mk();
  const r = run(c, `
    newGame({ seed: 9, mode: 'versus', shape: SH_RING }); quiet();
    const L0 = getE(S.players[0].lander), L1 = getE(S.players[1].lander);
    const P = pad(0, L0.x, L0.y), g = craft(0, 'gunship', P);
    // a building of the rival's no Point-Defence covers
    const s = spot(L1.x, L1.y, 3, 8, (i, j) => S.zone[tIdx(i, j)] === S.zone[tIdx(L1.x, L1.y)]), D = addBuilding(1, 'depot', s[0], s[1], true), a0 = D.armor;
    const n = applyOrder(0, 'command', [[g.id], { b: D.id }]);
    const hit = until(() => D.dead || D.armor < a0 - 5, 120), lasers = S.fx.filter((f) => f.type === 'laser').length;
    const wrecked = until(() => D.dead, 120);
    // then a Point-Defence Turret by the rival's next building: the Gunship is shot down
    const s2 = spot(L1.x, L1.y, 3, 8, (i, j) => S.zone[tIdx(i, j)] === S.zone[tIdx(L1.x, L1.y)] && dist(i, j, s[0], s[1]) > 2), D2 = addBuilding(1, 'depot', s2[0], s2[1], true);
    const s3 = spot(D2.x, D2.y, 1, 3, (i, j) => S.zone[tIdx(i, j)] === S.zone[tIdx(L1.x, L1.y)]), PD = addBuilding(1, 'pdturret', s3[0], s3[1], true); bump(PD.stock, 'ammo', 4);
    g.hp = g.maxHp; g.bat = 100;
    applyOrder(0, 'command', [[g.id], { b: D2.id }]);
    const down = until(() => g.dead, 90), pdFired = (PD.rounds || 0) < PDT.rounds || (PD.stock.ammo || 0) < 4;
    // Point-Defence on the ground: an enemy warbot within reach is shot at
    const w = addBot(0, 'warbot', PD.x + 2, PD.y); const h0 = w.hp;
    const ground = until(() => w.dead || w.hp < h0, 20);
    return { n: n && n.kind, hit, lasers, wrecked, down, pdFired, ground, aloftSafe: (() => { const v = addBot(0, 'gunship', L1.x, L1.y); v.alt = 1; v.sf = { ph: 'hold', tx: v.x, ty: v.y }; const nb = nearestEnemyBot(1, v.x, v.y, 3); const hp = v.hp; damageBot(v, 5); return nb !== v && v.hp === hp; })() };
  `);
  check('A Gunship takes an army order (tap an enemy building) and hits it with lasers', r.n === 'craft' && r.hit && r.lasers > 0, r);
  check('Gunship lasers wreck an undefended building', r.wrecked, r);
  check('A Point-Defence Turret shoots a Gunship down, and fires on robots on the ground close by', r.down && r.pdFired && r.ground, r);
  check('A craft in the air is out of reach of guns on the ground', r.aloftSafe, r);
}

// ---- 6. Drifting asteroids: their orbits, the same on every device, mined in passing, towed home, a craft hurt
{
  const lanes = (shape, seed) => {
    const c = mk();
    return run(c, `
      newGame({ seed: ${seed}, mode: 'versus', shape: ${shape === 'ring' ? 'SH_RING' : 'SH_ORB'} }); quiet();
      let bad = 0, tw = 0, minD = 99;
      for (let t = 0; t < 360; t += 2) {
        S.time = t;
        for (const r of S.space.rocks) {
          const p = rockPos(r), i = Math.floor(p.x), j = Math.floor(p.y);
          if (!inMap(i, j) || !voidTile(tIdx(i, j))) bad++;
          for (let dj = -1; dj <= 1; dj++) for (let di = -1; di <= 1; di++) if (inMap(i + di, j + dj) && !voidTile(tIdx(i + di, j + dj))) minD = 0;
          const q = rockPos(S.space.rocks.find((o) => o.id === r.tw));
          if (Math.abs(q.x - (S.W - p.x)) > 1e-6 || Math.abs(q.y - (S.H - p.y)) > 1e-6) tw++;
        }
      }
      return { n: S.space.rocks.length, kinds: S.space.rocks.map((r) => r.k).join(), bad, tw, minD, mods: S.space.mods.length, pos: S.space.rocks.map((r) => { S.time = 123.4; const p = rockPos(r); return [p.x.toFixed(6), p.y.toFixed(6)]; }) };
    `);
  };
  // The orbits: curved (whole loops, or arcs where only a stretch fits), worked out from the time alone (the same point
  // at the same time, whatever came before), every point two tiles' steps from any ground, mirrored by the half turn;
  // across seeds and both maps.
  const orbits = (shape, seed) => run(mk(), `
    newGame({ seed: ${seed}, mode: 'versus', shape: ${shape === 'ring' ? 'SH_RING' : 'SH_ORB'} }); quiet();
    const near = (x, y) => { let m = 99; const i0 = Math.floor(x), j0 = Math.floor(y); for (let j = j0 - 3; j <= j0 + 3; j++) for (let i = i0 - 3; i <= i0 + 3; i++) if (!inMap(i, j) || !voidTile(tIdx(i, j)) || orbTile(tIdx(i, j))) m = Math.min(m, Math.max(Math.abs(i - i0), Math.abs(j - j0))); return m; };
    let close = 0, edge = 0, tw = 0, again = 0, curved = 0, loops = 0, straight = 0, kinds = new Set();
    for (const L of S.space.lanes) { if (L.x1 !== undefined) straight++; if (L.loop) loops++; kinds.add(L.k); }
    const P = (r, t) => { S.time = t; return rockPos(r); };
    for (const r of S.space.rocks) {
      const tw2 = S.space.rocks.find((o) => o.id === r.tw), L = S.space.lanes[r.lane];
      let turn = 0, prev = null, prevA = null;
      for (let t = 0; t < 900; t += 1.5) {
        const p = P(r, t), q = P(tw2, t);
        if (near(p.x, p.y) < DRIFT.clear) close++;
        if (p.x < DRIFT.edge || p.y < DRIFT.edge || p.x > S.W - DRIFT.edge || p.y > S.H - DRIFT.edge) edge++;
        if (Math.abs(q.x - (S.W - p.x)) > 1e-6 || Math.abs(q.y - (S.H - p.y)) > 1e-6) tw++;
        if (prev && dist(p.x, p.y, prev.x, prev.y) > 1e-3) { const a = Math.atan2(p.y - prev.y, p.x - prev.x); if (prevA !== null) { let d = a - prevA; while (d > Math.PI) d -= 2 * Math.PI; while (d < -Math.PI) d += 2 * Math.PI; if (Math.abs(d) < 2.5) turn += Math.abs(d); } prevA = a; }
        prev = p;
      }
      if (turn > 0.5) curved++;
      // from the time alone: the point at t = 700 is the same asked straight away, after other times, or after a step back
      const a = P(r, 700); P(r, 13); P(r, 999); const b = P(r, 700);
      if (a.x !== b.x || a.y !== b.y) again++;
    }
    return { n: S.space.rocks.length, close, edge, tw, again, curved, loops, straight, kinds: [...kinds].sort().join() };
  `);
  for (const sh of ['ring', 'orbital']) {
    const res = [1, 2, 3, 4, 5, 6, 7, 8].map((sd) => orbits(sh, sd));
    const bad = res.filter((o) => o.close || o.edge || o.tw || o.again || o.straight || o.curved < o.n || o.kinds !== 'crystal,ore,plain');
    check(`${sh}: the asteroids go round curved orbits (no straight lanes; ${res.reduce((n, o) => n + o.loops, 0)} of ${res.reduce((n, o) => n + o.n, 0)} whole loops over 8 seeds), every kind on every map`, !bad.length && res.some((o) => o.loops > 0), bad.length ? bad : res);
    check(`${sh}: each orbit stays two tiles from any ground and off the map's edge, mirrored by the half turn, and a rock's place follows from the time alone`, res.every((o) => !o.close && !o.edge && !o.tw && !o.again), res);
  }
  for (const sh of ['ring', 'orbital']) {
    const a = lanes(sh, 21), b = lanes(sh, 21);
    check(`${sh}: drifting asteroids in twin pairs (plain, Ore, Crystal), always over the void with a clear tile round them`, a.n >= 6 && /ore/.test(a.kinds) && /crystal/.test(a.kinds) && /plain/.test(a.kinds) && a.bad === 0 && a.tw === 0 && a.minD > 0, a);
    check(`${sh}: their drift is the same in two runs (deterministic), and six derelict modules lie mirrored`, JSON.stringify(a.pos) === JSON.stringify(b.pos) && a.mods === 6, { a: a.pos.slice(0, 2), b: b.pos.slice(0, 2), mods: a.mods });
  }
  const c = mk();
  const r = run(c, `
    newGame({ seed: 21, mode: 'versus', shape: SH_RING }); quiet();
    const L = getE(S.players[0].lander);
    // a staffed Mine on ground beside an Ore rock's lane
    const rk = S.space.rocks.find((q) => q.k === 'ore' && dist2(S.space.lanes[q.lane].cx, S.space.lanes[q.lane].cy, L.x, L.y) < dist2(S.space.lanes[q.lane].cx, S.space.lanes[q.lane].cy, S.W - L.x, S.H - L.y)), Ln = S.space.lanes[rk.lane];
    let best = null; for (let j = 1; j < S.H - 1; j++) for (let i = 1; i < S.W - 1; i++) { if (!free(tIdx(i, j))) continue; const d = laneDist(Ln, i + 0.5, j + 0.5); if (d <= DRIFT.reach - 0.8 && (!best || d < best[2])) best = [i, j, d]; }
    const M = addBuilding(0, 'mine', best[0], best[1], true), w = addBot(0, 'worker', M.x, M.y); enterBuilding(w, M); M.staff = w.id; w.task = { type: 'staff', bld: M.id, phase: 'work', node: -1, timer: 999 };
    const a0 = rk.amt, mined = until(() => (M.stock.ore || 0) > 0 && rk.amt < a0, 400);
    const dry = (updateDepleted(M, BDEFS.mine), M.depleted);
    // a Shuttle tows a Crystal rock home to its pad: broken up into Crystal tiles beside it
    const P = pad(0, L.x, L.y), sh = craft(0, 'shuttle', P), cr = S.space.rocks.find((q) => q.k === 'crystal' && !q.gone);
    const count = () => { let n = 0; for (let j = P.y - 5; j <= P.y + 6; j++) for (let i = P.x - 5; i <= P.x + 6; i++) if (inMap(i, j) && S.res[tIdx(i, j)] === R_CRYSTAL) n++; return n; };
    const c0 = count(), why = orderTow(0, sh, cr.id);
    const hooked = until(() => cr.tow === sh.id, 120), towed = until(() => cr.gone && count() > c0, 240);
    const back = until(() => sh.inside === P.id, 60);
    // a craft that clips a plain rock is hurt
    const pr = S.space.rocks.find((q) => q.k === 'plain'), g = addBot(0, 'gunship', 1, 1), p0 = rockPos(pr);
    g.alt = 1; g.x = p0.x; g.y = p0.y; g.sf = { ph: 'hold', tx: p0.x, ty: p0.y }; g.task = { type: 'hold', x: p0.x, y: p0.y };
    const hp0 = g.hp, bumped = until(() => g.hp < hp0, 6);
    const back2 = until(() => !rk.gone && rk.amt === DRIFT.amt.ore, DRIFT.respawn + 60) || rk.amt > 0;
    return { mined, ore: M.stock.ore || 0, dry, why, hooked, towed, back, bumped, hp: [hp0, g.hp], respawn: back2 };
  `);
  check('A staffed Mine by a lane mines a passing Ore rock (and is never "dry" while a lane passes)', r.mined && r.ore > 0 && !r.dry, r);
  check('A Shuttle hooks a Crystal rock and tows it home: broken up into Crystal tiles beside its pad', r.why === '' && r.hooked && r.towed && r.back, r);
  check('A craft that clips a drifting rock takes a little damage', r.bumped && r.hp[0] - r.hp[1] <= 4, r);
  check('A rock mined out or towed away drifts back in on its lane', r.respawn, r);
}

// ---- 7. The derelict modules: Solar Array power, Docking Ring speed, Salvage Hulk haul, jamming
{
  const c = mk();
  const r = run(c, `
    newGame({ seed: 13, mode: 'versus', shape: SH_ORB }); quiet();
    const hold = (m, p) => { const t = tIdx(m.x, m.y); const s = spot(m.x + 1, m.y + 1, 1, 5, (i, j) => true); const O = addBuilding(p, 'outpost', s[0], s[1], true); computeTerritory(); until(() => modHolder(m) === p, 3); return O; };
    const solar = S.space.mods.find((m) => m.k === 'solar' && m.id % 2), dock = S.space.mods.find((m) => m.k === 'dock' && m.id % 2), hulk = S.space.mods.find((m) => m.k === 'hulk' && m.id % 2);
    const L = getE(S.players[0].lander), alloy0 = L.stock.alloy || 0, chip0 = L.stock.chip || 0;
    // the Solar Array: a Smelter of the holder's beside it is powered (as by a Generator)
    hold(solar, 0);
    const sm = spot(solar.x + 1, solar.y + 1, 1, DERELICT.solar.reach - 1.5), Sm = addBuilding(0, 'smelter', sm[0], sm[1], true);
    until(() => Sm.boostUntil > S.time, 3);
    const powered = Sm.boostUntil > S.time && !!solarNear(Sm);
    // the Docking Ring: the holder's Shuttles fly faster
    const P = pad(0, L.x, L.y), sh = craft(0, 'shuttle', P), v0 = craftSpeed(sh);
    hold(dock, 0);
    const v1 = craftSpeed(sh);
    // the Salvage Hulk: its haul once, into the Command Base
    hold(hulk, 0);
    const got = [(L.stock.alloy || 0) - alloy0, (L.stock.chip || 0) - chip0], done = hulk.done;
    // jammed: a rival's armed warbot beside it, and no one holds it
    const w = addBot(1, 'warbot', solar.x + 1, solar.y + 1); w.x = solar.x + 1; w.y = solar.y - 0.5;
    const s = spot(solar.x + 1, solar.y + 1, 0, 3.5); if (s) { w.x = s[0] + 0.5; w.y = s[1] + 0.5; }
    w.task = { type: 'cover' }; w.path = [];
    until(() => solar.jam > 0, 3);
    const jammed = modHolder(solar) === -1 && solar.jam > 0;
    return { held: [modHolder(dock), modHolder(hulk)], powered, v: [v0, v1], got, done, jammed, mods: S.space.mods.map((m) => [m.k, m.x, m.y]) };
  `);
  check('A Solar Array held: the holder\'s factories beside it get power, as from a Generator with no Fuel', r.powered, r);
  check('A Docking Ring held: the holder\'s Shuttles fly faster', r.held[0] === 0 && Math.abs(r.v[1] / r.v[0] - 1.35) < 1e-9, r);
  check('A Salvage Hulk held: its haul of Alloy and Chips, once, into the Command Base', r.held[1] === 0 && r.got[0] === 18 && r.got[1] === 10 && r.done === 1, r);
  check('A rival\'s armed robot beside a module jams it: no one holds it', r.jammed, r);
  // fair: each module's twin by the half turn
  check('The modules come in twins by the map\'s half turn', r.mods.length === 6 && [0, 2, 4].every((k) => r.mods[k][0] === r.mods[k + 1][0]), r.mods);
}

// ---- 8. A save made mid-flight, and two runs alike
{
  const setup = `
    newGame({ seed: 17, mode: 'versus', shape: SH_ORB, autoplay: true });
    const L = getE(S.players[0].lander), P = pad(0, L.x, L.y), sh = craft(0, 'shuttle', P), g = craft(0, 'gunship', P), L1 = getE(S.players[1].lander);
    const far = spot(L.x, L.y, 12, 30, (i, j) => S.zone[tIdx(i, j)] !== S.zone[tIdx(L.x, L.y)] || true);
    applyOrder(0, 'command', [[g.id], { i: L1.x, j: L1.y - 8 }]);
    const rk = S.space.rocks.find((q) => q.k !== 'plain'); orderTow(0, sh, rk.id);
    until(() => sh.sf && sh.sf.ph === 'go' && g.sf && g.sf.ph === 'go', 30);
  `;
  const a = mk(), b = mk();
  const ra = run(a, setup + `return { ph: [sh.sf && sh.sf.ph, g.sf && g.sf.ph], json: serializeGame() };`);
  run(b, setup + 'return 0;');
  // b: saved and loaded in a fresh game, then both run on
  const c = mk();
  const rc = run(c, `deserializeGame(${JSON.stringify(ra.json)}); const sh = S.bots.find((u) => u.type === 'shuttle'); return { ph: sh.sf && sh.sf.ph, ok: checkSave(JSON.parse(serializeGame())) === undefined };`);
  const go = 'for (let k = 0; k < 30 * 90; k++) simStep(SIM_STEP); return { h: hashState() >>> 0, t: S.time, craft: S.bots.filter((u) => !u.dead && BOTS[u.type].craft).map((u) => [u.type, u.x.toFixed(4), u.y.toFixed(4), u.sf ? u.sf.ph : u.inside ? "in" : "-"]) };';
  const ha = run(a, go), hb = run(b, go), hc = run(c, go);
  check('A save made with craft in flight loads and checks, still flying', ra.ph.every((p) => p === 'go') && rc.ph === 'go' && rc.ok, { ra: ra.ph, rc });
  check('Deterministic: the same game run twice is the same, and so is the one saved and loaded mid-flight', ha.h === hb.h && ha.h === hc.h, { ha: ha.h, hb: hb.h, hc: hc.h, a: ha.craft, c: hc.craft });
}

// ---- 9. A rival goes after a derelict on a rock its Workers can't walk to: its Dropship lands two Workers there (no
// warbots), an Outpost site goes up beside them, its Shuttle flies the goods, and the module is taken. Landed Workers let
// you build where your bots couldn't reach before, on a space map only.
{
  const c = mk();
  const r = run(c, `
    newGame({ seed: 21, mode: 'versus', shape: SH_RING }); quiet();
    const L = getE(S.players[0].lander), P = pad(0, L.x, L.y), ds = craft(0, 'dropship', P), sh = craft(0, 'shuttle', P);
    bump(P.stock, 'fiber', 10); bump(P.stock, 'cement', 20);
    for (let k = 0; k < 8; k++) addBot(0, 'worker', L.x, L.y);
    for (let k = 0; k < 6; k++) addBot(0, 'warbot', L.x, L.y);
    bump(L.stock, 'cement', 40); bump(L.stock, 'alloy', 20);
    S.time = 600;
    // an Outpost of its on the home rock's rim, within reach of a module on another rock (its land short of the module)
    const hz = homeZone(0);
    let at = null, bd = 1e9;
    for (const m of S.space.mods) {
      if (S.zone[m.st] === hz) continue;
      const si = m.st % S.W, sj = (m.st / S.W) | 0, s2 = spot(si, sj, 7, 9, (i, j) => S.zone[tIdx(i, j)] === hz && S.owner[tIdx(i, j)] < 1 && S.space.mods.every((q) => dist(i, j, q.st % S.W, (q.st / S.W) | 0) > BDEFS.outpost.terr + 1.5));
      if (s2 && dist(s2[0], s2[1], si, sj) < bd) { bd = dist(s2[0], s2[1], si, sj); at = s2; }
    }
    addBuilding(0, 'outpost', at[0], at[1], true); computeTerritory();
    const T = aiGrabSpot(0, L), before = T ? canPlace(0, 'outpost', T.i, T.j, true).ok : null;
    const army0 = S.bots.filter((u) => !u.dead && u.owner === 0 && isArmy(u) && !u.task).length;
    let rode = 0, warbots = 0, took = null;
    for (let k = 0; k < 30 * 300 && !took; k++) {
      if (k % 450 === 0) aiSpaceGrab(0, S.buildings.filter((b) => !b.dead && b.owner === 0), DIFFICULTY.normal, L);
      if (ds.aboard && ds.aboard.length) { rode = Math.max(rode, ds.aboard.length); warbots = Math.max(warbots, ds.aboard.map(getE).filter((u) => u && isArmy(u)).length); }
      simStep(SIM_STEP);
      const m = S.space.mods.find((q) => modHolder(q) === 0);
      if (m) took = [m.k, S.zone[m.st] !== hz, Math.round(S.time - 600)];
    }
    const z = T && S.zone[tIdx(T.i, T.j)];
    // planet maps: Workers standing somewhere give no foothold (only a space map's)
    newGame({ seed: 4, mode: 'versus', shape: SHAPE_PRESETS.findIndex((s) => s.islands && s.naval && !s.tidal && !s.isles4) }); quiet();
    const L2 = getE(S.players[0].lander), hz2 = homeZone(0);
    let far = -1; for (let t = 0; t < S.W * S.H; t++) if (S.terrain[t] === T_GROUND && S.zone[t] !== hz2 && S.zone[t] >= 0) { far = t; break; }
    const w = addBot(0, 'worker', far % S.W, (far / S.W) | 0); w.x = far % S.W + 0.5; w.y = ((far / S.W) | 0) + 0.5;
    return { T: T && { k: T.m.k, foot: T.foot }, before, rode, warbots, took, landedZone: z !== hz, planet: buildZones(0).has(S.zone[far]) };
  `);
  check('A rival picks a derelict on a rock its Workers can\'t walk to (no Outpost may go there yet)', r.T && !r.T.foot && r.before === false, r);
  check('Its Dropship lands two Workers there (no warbots), the Outpost goes up and the module is taken', r.rode === 2 && r.warbots === 0 && r.took && r.took[1] && r.landedZone, r);
  check('Landed Workers give a foothold out in space only (not on a planet)', r.planet === false, r);
}

// ---- 10. The space art loads only on the space maps (ensureSpaceArt), its re-lit sets for the time of day with it, and
// the one-file build puts it in a bundle of its own (space-art.js)
{
  const files2 = ['art/art-manifest.js', 'art/tod/tod-keys.js', ...files.map((f) => 'js/' + f + '.js'), 'js/render.js', 'js/daynight.js', 'js/landmarks.js', 'js/space.js'];
  const art = (shape) => {
    const c = { console, Math, JSON, Map, Set, Array, Object, Number, String, Infinity, Uint8Array, Int8Array, Int16Array, Int32Array, Uint32Array, Float32Array, Float64Array, Uint16Array, sfx: () => {} };
    vm.createContext(c);
    vm.runInContext(files2.map((f) => fs.readFileSync(path.join(__dirname, '..', f), 'utf8')).join('\n;\n'), c);
    return run(c, `
      const got = [], srcs = [];
      loadArtKey = (k) => got.push(k); loadImg = (src) => srcs.push(src);
      newGame({ seed: 5, mode: 'versus', shape: ${shape} });
      loadArt(null); applyBiome(); todLoadSet('night');
      const want = Object.keys(ART_MANIFEST).filter(spaceArtKey);
      const todWant = SPACE_TOD_KEYS.map((k) => todSrc('night', k)).filter(Boolean);
      return { space: spaceMap(), want: want.length, got: got.filter(spaceArtKey).length, todWant: todWant.length, tod: srcs.filter((s) => todWant.includes(s)).length,
        other: got.filter((k) => !spaceArtKey(k)).length, todOther: srcs.filter((s) => !todWant.includes(s)).length, regex: String(SPACE_ART) };
    `);
  };
  const planet = art(0), ring = art('SHAPE_PRESETS.findIndex((s) => s.asteroids)'), orb = art('SHAPE_PRESETS.findIndex((s) => s.orbital)');
  check('A planet map loads none of the space art, nor its re-lit sets for the time of day (the rest as ever)', !planet.space && planet.want >= 40 && planet.got === 0 && planet.tod === 0 && planet.other > 500 && planet.todOther > 200, planet);
  check('The Ring and Orbital platforms load all of it, the re-lit sets too', [ring, orb].every((o) => o.space && o.got === o.want && o.todWant >= 40 && o.tod === o.todWant), { ring, orb });
  const build = fs.readFileSync(path.join(__dirname, 'build-single.js'), 'utf8');
  check('The one-file build sorts the same keys into a bundle of their own (space-art.js, SPACE_BUNDLE)', build.includes(planet.regex.slice(1, -1).replace(/\\/g, '\\')) && /space-art\.js/.test(build) && /SPACE_BUNDLE = true/.test(build), planet.regex);
}

if (fails) { console.log(`${fails} failed`); process.exit(1); }
console.log('space: all passed');

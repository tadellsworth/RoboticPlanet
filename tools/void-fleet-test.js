// Headless checks for The Void Fleet (space expansion, phase 3: VFLEET and CAPITAL in js/defs.js, voidMap in js/world.js, the
// rules in js/sim.js: capital ships, shields, the Flagship's deck and aura, Line Ships' broadsides, the Flagship victory; the
// rival in js/ai.js: aiVoid): the map at every size, the same turned half round, the Flagships each other's twins; shields
// soak hits first, recharge only after CAPITAL.wait s quiet, and a Disruptor drains them CAPITAL.disrupt times as fast and
// never the hull; a Flagship destroyed takes its colony out (the Flagship victory); the Flagship's deck builds a Gunship
// (its wing, refuelled and mended in its aura) and a Line Ship, a Launch Pad a Line Ship, four at most; a broadside wrecks a
// building and empties the magazine, rearmed by the Flagship; Gunships in an Army Group; Line Ships on The Ring, no Flagship
// there; a save mid-fight loads and checks, two runs alike (hashState, lockstep); and two rivals left to it build Line Ships,
// strike, and end the game without stalling.
// Run: node tools/void-fleet-test.js
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const files = ['util', 'defs', 'world', 'path', 'sim', 'ai', 'missions', 'orders'];
const source = files.map((f) => fs.readFileSync(path.join(__dirname, '..', 'js', f + '.js'), 'utf8')).join('\n');
const HELP = `
  const SH_VF = SHAPE_PRESETS.findIndex((s) => s.vfleet), SH_RING = SHAPE_PRESETS.findIndex((s) => s.asteroids);
  const free = (t) => S.terrain[t] === T_GROUND && !S.bAt[t] && !S.res[t] && !S.road[t] && !S.ramp[t];
  const spot = (cx, cy, rmin, rmax, ok) => { let best = null, bd = 1e9; for (let j = 2; j < S.H - 2; j++) for (let i = 2; i < S.W - 2; i++) { const d = dist(i, j, cx, cy); if (d < rmin || d > rmax || !free(tIdx(i, j)) || (ok && !ok(i, j))) continue; if (d < bd) { bd = d; best = [i, j]; } } return best; };
  const until = (fn, secs) => { for (let k = 0; k < 30 * secs && !fn(); k++) simStep(SIM_STEP); return fn(); };
  const steps = (secs) => { for (let k = 0; k < 30 * secs; k++) simStep(SIM_STEP); };
  const pad = (p, x, y) => { const z = S.zone[tIdx(x, y)]; const s = spot(x, y, 3, 14, (i, j) => [[i, j], [i + 1, j], [i, j + 1], [i + 1, j + 1]].every(([a, c]) => free(tIdx(a, c)) && S.zone[tIdx(a, c)] === z)); const b = addBuilding(p, 'launchpad', s[0], s[1], true); bump(b.stock, 'fuel', 20); computeTerritory(); return b; };
  const quiet = () => { for (const P of S.players) P.ai = false; };
  const flag = (p) => flagshipOf(p);
  Object.assign(globalThis, { SH_VF, SH_RING, free, spot, until, steps, pad, quiet, flag });
`;
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

// ---- 1. The map: every size, the same turned half round, the Flagships twins
{
  const c = mk();
  const r = run(c, `
    const out = [];
    for (let size = 0; size < SIZE_PRESETS.length; size++) for (const seed of [11, 21]) {
      newGame({ seed, mode: 'versus', shape: SH_VF, size, players: 2 });
      const W = S.W, H = S.H, N = W * H;
      let asym = 0; for (let t = 0; t < N; t++) if (S.terrain[t] !== S.terrain[N - 1 - t] || S.res[t] !== S.res[N - 1 - t] || (S.res[t] && S.amt[t] !== S.amt[N - 1 - t])) asym++;
      const F = [flag(0), flag(1)], Ls = S.players.map((P) => getE(P.lander));
      const twin = F[0] && F[1] && Math.abs(F[0].x - (W - F[1].x)) < 1e-9 && Math.abs(F[0].y - (H - F[1].y)) < 1e-9 && Math.abs(wrapAngle(F[0].face - F[1].face - Math.PI)) < 1e-9;
      const st = S.vf.st, stTwin = st[0].x0 === W - 1 - st[1].x1 && st[0].y0 === H - 1 - st[1].y1;
      const onSt = Ls.every((L, p) => L.x >= st[p].x0 && L.x <= st[p].x1 && L.y >= st[p].y0 && L.y <= st[p].y1);
      const over = F.every((f) => f && S.terrain[tIdx(Math.floor(f.x), Math.floor(f.y))] === T_CHASM); // (parked over the void off its station)
      const home = Ls.map((L) => { let o = 0, cr = 0; for (let t = 0; t < N; t++) { if (dist(t % W, (t / W) | 0, L.x, L.y) > 14) continue; if (S.res[t] === R_ORE) o++; if (S.res[t] === R_CRYSTAL) cr++; } return [o, cr]; });
      out.push({ size, seed, W, H, asym, twin, stTwin, onSt, over, home, rocks: S.space.rocks.length, mods: S.space.mods.length, full: F.every((f) => f && f.cs === CAPITAL.flagship.sh && f.hp === BOTS.flagship.hp), noUp: !S.victory });
    }
    return out;
  `);
  check('The map at every size is the same turned half round (terrain and deposits)', r.every((x) => x.asym === 0), r.filter((x) => x.asym));
  check('Each colony starts on its home station, the two stations twins', r.every((x) => x.onSt && x.stTwin), r.filter((x) => !(x.onSt && x.stTwin)));
  check('Each colony has a Flagship, the two twins (place and heading), parked over the void, shields and hulls full', r.every((x) => x.twin && x.over && x.full), r.filter((x) => !(x.twin && x.over && x.full)));
  check('Starter Ore and Crystal at home, the same for both (at least 5 each)', r.every((x) => x.home.every((h) => h[0] >= 5 && h[1] >= 5) && x.home[0].join() === x.home[1].join()), r.map((x) => x.home));
  check('Drifting rocks and derelict modules out in the void (phase 1 rules), no Uplinks victory', r.every((x) => x.rocks >= 4 && x.mods >= 4 && x.noUp), r.map((x) => [x.size, x.rocks, x.mods]));
}

// ---- 2. Shields: soak first, recharge after CAPITAL.wait s quiet; the Disruptor drains them 3x and never the hull
{
  const c = mk();
  const r = run(c, `
    newGame({ seed: 5, mode: 'versus', shape: SH_VF, size: 1 }); quiet();
    const F0 = flag(0), F1 = flag(1), x = F0.x, y = F0.y;
    const ln = addCapital(0, 'line', x, y - 8, 0); // (by its own Flagship, far from any enemy gun)
    const sh0 = ln.cs, hp0 = ln.hp;
    capHit(ln, 50, 1, x, y);
    const a = { cs: ln.cs, hp: ln.hp };
    capHit(ln, CAPITAL.line.sh, 1, x, y); // (more than is left: the rest goes into the hull)
    const b = { cs: ln.cs, hp: ln.hp };
    steps(CAPITAL.wait - 1);
    const early = ln.cs;
    steps(2.5);
    const late = ln.cs;
    // The Disruptor: an enemy tower beside it, a pulse
    const ln2 = addCapital(0, 'line', F1.x + 10, F1.y + 10, 0);
    const s2 = spot(Math.floor(ln2.x), Math.floor(ln2.y), 0, 30, (i, j) => S.owner[tIdx(i, j)] === 1);
    const d = addBuilding(1, 'disruptor', s2[0], s2[1], true); bump(d.stock, 'fuel', 4);
    ln2.x = s2[0] + 0.5 + 3; ln2.y = s2[1] + 0.5; ln2.sf.tx = ln2.x; ln2.sf.ty = ln2.y;
    const csD = ln2.cs, hpD = ln2.hp;
    until(() => ln2.cs < csD, 4);
    return { sh0, hp0, a, b, early, late, regen: CAPITAL.line.regen, drained: csD - ln2.cs, hpSame: ln2.hp === hpD, bul: BULWARK.drain };
  `);
  check('A hit on a capital ship takes its shield first, the hull untouched', r.a.cs === r.sh0 - 50 && r.a.hp === r.hp0, r);
  check('What the shield can\'t take goes into the hull', r.b.cs === 0 && Math.abs(r.b.hp - (r.hp0 - 50)) < 1e-9, r);
  check(`No recharge for ${6} s after the last hit; then it comes back, ${9} a second`, r.early === 0 && r.late > 0 && r.late <= r.regen * 2.6 + 1e-6, r);
  check(`A Disruptor's pulse drains a capital ship's shield ${3} times a Bulwark's drain (${14 * 3}), and leaves its hull be`, Math.abs(r.drained - r.bul * 3) < 1e-6 && r.hpSame, r);
}

// ---- 3. The Flagship victory: a colony whose Flagship is destroyed is out
{
  const c = mk();
  const r = run(c, `
    newGame({ seed: 7, mode: 'versus', shape: SH_VF, size: 1 }); quiet();
    const F1 = flag(1);
    capHit(F1, F1.cs + F1.hp + 1, 0, F1.x, F1.y + 3);
    const out1 = S.players[1].out, how = S.endHow, win = S.winner, gone = F1.dead;
    const theirs = S.buildings.filter((b) => !b.dead && b.owner === 1).length, ours = S.buildings.filter((b) => !b.dead && b.owner === 0).length;
    return { out1, how, win, gone, theirs, ours };
  `);
  check('Its Flagship destroyed, a colony is out: the game won by the Flagship victory, its buildings passing to the victor', r.out1 && r.how === 'flagship' && r.win === 0 && r.gone && r.theirs === 0 && r.ours > 1, r);
}

// ---- 4. The Flagship's deck: a Gunship for its wing (refuelled and mended in its aura), a Line Ship; a pad's Line Ship; four at most
{
  const c = mk();
  const r = run(c, `
    newGame({ seed: 9, mode: 'versus', shape: SH_VF, size: 1 }); quiet();
    const F = flag(0), L = getE(S.players[0].lander);
    for (const g of ['alloy', 'chip', 'fuel']) bump(L.stock, g, 80);
    orderAtFlag(F, 'gunship', 1); orderAtFlag(F, 'line', 1);
    const madeG = until(() => S.bots.some((u) => !u.dead && u.owner === 0 && u.type === 'gunship'), 200);
    const g = S.bots.find((u) => !u.dead && u.owner === 0 && u.type === 'gunship');
    const wing = !!g && g.wing === F.id;
    steps(8);
    const near = g && hullDist(F, g.x, g.y) <= CAPITAL.flagship.aura;
    g.bat = 40; g.hp = 5; steps(10);
    const topped = g.bat > 40 && g.hp > 5;
    const madeL = until(() => S.bots.some((u) => !u.dead && u.owner === 0 && u.type === 'line'), 200);
    const P0 = pad(0, L.x, L.y); for (const gg of ['alloy', 'chip', 'fuel']) bump(P0.stock, gg, 80);
    orderAtYard(P0, 'line', 5);
    until(() => lineCount(0) >= CAPITAL.line.most, 600);
    steps(30);
    const n = lineCount(0), pads = padCraft(P0).length;
    return { madeG, wing, near, topped, madeL, n, pads, status: P0.yardStatus };
  `);
  check('The Flagship\'s deck builds a Gunship from the Command Base\'s stores: it flies as its wing, beside it', r.madeG && r.wing && r.near, r);
  check('In the Flagship\'s aura its craft are refuelled and mended', r.topped, r);
  check('The Flagship\'s deck builds a Line Ship; a Launch Pad builds them too (no room taken on it), four to a colony at most', r.madeL && r.n === 4 && r.pads === 0 && /4 Line Ships/.test(r.status), r);
}

// ---- 5. A broadside wrecks a building and empties the magazine; the Flagship rearms it
{
  const c = mk();
  const r = run(c, `
    newGame({ seed: 13, mode: 'versus', shape: SH_VF, size: 1 }); quiet();
    const L1 = getE(S.players[1].lander), s = spot(L1.x, L1.y, 3, 10, (i, j) => S.owner[tIdx(i, j)] === 1);
    const tgt = addBuilding(1, 'depot', s[0], s[1], true);
    const ln = addCapital(0, 'line', s[0] + 0.5, s[1] + 6.5, 0);
    orderCapital(0, [ln.id], 'attack', tgt.id);
    const m0 = ln.mag;
    until(() => tgt.dead, 120);
    const wrecked = tgt.dead, used = m0 - ln.mag;
    ln.mag = 0; orderCapital(0, [ln.id], 'home');
    until(() => ln.mag >= CAPITAL.line.mag - 0.01, 240);
    return { wrecked, used, rearmed: ln.mag >= CAPITAL.line.mag - 0.01, near: hullDist(flag(0), ln.x, ln.y) };
  `);
  check('A Line Ship sent at an enemy building closes in and shells it to rubble, firing from its magazine', r.wrecked && r.used >= 2, r);
  check('Out of shells, it goes back to its Flagship and is rearmed there', r.rearmed, r);
}

// ---- 6. Gunships in an Army Group (any map): they keep over its flag
{
  const c = mk();
  const r = run(c, `
    newGame({ seed: 4, mode: 'versus', shape: SH_RING, size: 1 }); quiet();
    const L = getE(S.players[0].lander), P = pad(0, L.x, L.y);
    const gs = [0, 1].map(() => { const u = addBot(0, 'gunship', P.x, P.y); u.bat = 100; parkCraft(u, P); return u; });
    S.players[0].ai = false;
    const gid = agNew(0, gs.map((u) => u.id));
    const g = agById(gid);
    const s = spot(L.x, L.y, 6, 12);
    agSetOrder(g, 'defend', [s]);
    steps(25);
    const r0 = rallyById(g.flag);
    return { gid: typeof gid, n: agMembers(g).length, up: gs.every((u) => (u.alt || 0) > 0.9), near: gs.every((u) => dist(u.x, u.y, r0.x, r0.y) < 3), rally: gs.every((u) => u.task && u.task.rally === r0.id) };
  `);
  check('Gunships join an Army Group and keep over its flag (here on The Ring)', r.gid === 'number' && r.n === 2 && r.up && r.near && r.rally, r);
}

// ---- 7. Line Ships on the other space maps; the Flagship nowhere buildable
{
  const c = mk();
  const r = run(c, `
    newGame({ seed: 4, mode: 'versus', shape: SH_RING, size: 1 }); quiet();
    const L = getE(S.players[0].lander), P = pad(0, L.x, L.y);
    for (const g of ['alloy', 'chip', 'fuel']) bump(P.stock, g, 40);
    orderAtYard(P, 'line', 1);
    const made = until(() => lineCount(0) >= 1, 120);
    const flagYards = Object.keys(BDEFS).filter((k) => (BDEFS[k].yard || []).includes('flagship')).length + (FOUNDRY_ORDER.includes('flagship') ? 1 : 0);
    return { made, noFlag: !S.players.some((Pp) => Pp.flag), flagYards, offMap: spaceBotOff('line') };
  `);
  check('A Launch Pad builds a Line Ship on The Ring too; no Flagship there, and none buildable anywhere', r.made && r.noFlag && r.flagYards === 0 && !r.offMap, r);
}

// ---- 8. A save made mid-fight, and two runs alike (lockstep: hashState)
{
  const setup = `
    newGame({ seed: 23, mode: 'versus', shape: SH_VF, size: 1, autoplay: true });
    const F0 = flag(0), F1 = flag(1);
    const a = addCapital(0, 'line', F1.x, F1.y + 9, -Math.PI / 2), b = addCapital(1, 'line', F1.x + 4, F1.y + 2, Math.PI / 2);
    orderCapital(0, [a.id], 'hunt', F1.id); orderCapital(1, [b.id], 'hunt', a.id);
    steps(20);
  `;
  const A = mk(), B = mk();
  const ra = run(A, setup + `return { json: serializeGame(), hit: a.cs < CAPITAL.line.sh || F1.cs < CAPITAL.flagship.sh };`);
  run(B, setup + 'return 0;');
  const C = mk();
  const rc = run(C, `deserializeGame(${JSON.stringify(ra.json)}); return { ok: checkSave(JSON.parse(serializeGame())) === undefined, vf: !!S.vf, flags: S.players.map((P) => !!flagshipOf(P.id)) };`);
  const go = 'const hs = []; for (let k = 0; k < 6; k++) { for (let q = 0; q < 30 * 20; q++) simStep(SIM_STEP); hs.push(hashState() >>> 0); } return { hs, caps: S.bots.filter((u) => !u.dead && BOTS[u.type].capital).map((u) => [u.id, Math.round(u.hp), Math.round(u.cs)]) };';
  const ha = run(A, go), hb = run(B, go), hc = run(C, go);
  check('A save made mid-fight loads and checks, the Flagships still flying', ra.hit && rc.ok && rc.vf && rc.flags.every(Boolean), { hit: ra.hit, rc });
  check('Deterministic (lockstep): the same game run twice hashes the same at every checkpoint, and so does the one saved and loaded', JSON.stringify(ha.hs) === JSON.stringify(hb.hs) && JSON.stringify(ha.hs) === JSON.stringify(hc.hs), { ha: ha.hs, hb: hb.hs, hc: hc.hs });
}

// ---- 9. Rivals left to it: Line Ships built, a strike made, the game decided (no stall)
{
  const c = mk();
  const r = run(c, `
    newGame({ seed: 3, difficulty: 'normal', mode: 'versus', shape: SH_VF, size: 1, autoplay: true });
    const seen = { lines: [0, 0], strike: [0, 0], wing: [0, 0], pd: [0, 0] };
    for (let k = 0; k < 30 * 60 * 70 && S.winner < 0; k++) {
      simStep(SIM_STEP);
      if (k % 300) continue;
      for (const p of [0, 1]) {
        seen.lines[p] = Math.max(seen.lines[p], lineCount(p));
        if (S.players[p].vfStrike) seen.strike[p] = 1;
        const F = flagshipOf(p); if (F) seen.wing[p] = Math.max(seen.wing[p], wingCraft(F).length);
        seen.pd[p] = Math.max(seen.pd[p], S.buildings.filter((b) => !b.dead && b.owner === p && b.built && (b.type === 'pdturret' || b.type === 'disruptor')).length);
      }
    }
    return { winner: S.winner, how: S.endHow, min: Math.round(S.time / 6) / 10, seen };
  `);
  check('Rivals build Line Ships, defend their Flagship\'s station (Point-Defence, Disruptors), and strike', r.seen.lines.every((n) => n >= 1) && r.seen.strike.some(Boolean) && r.seen.pd.some((n) => n >= 1), r);
  check('The game is decided within 70 minutes (no stall)', r.winner >= 0, r);
}

// ---- 10. The Flagship's main battery: it fires back at an enemy Line Ship in reach (from its hull), not one beyond; alone it
// beats a lone Line Ship but not an escorted fleet (three)
{
  const c = mk();
  const r = run(c, `
    newGame({ seed: 31, mode: 'versus', shape: SH_VF, size: 1 }); quiet();
    const F = flag(0), B = CAPITAL.flagship.battery;
    const put = (d) => { const u = addCapital(1, 'line', F.x + d, F.y, Math.PI / 2); u.mag = 0; u.rearm = 0; return u; }; // (unarmed: it only takes the fire)
    const near = put(capR(F) + capR({ type: 'line' }) + B.range - 0.5 + 0.0001), far = put(-(capR(F) + capR({ type: 'line' }) + B.range + 1));
    near.sf.tx = near.x; near.sf.ty = near.y; far.sf.tx = far.x; far.sf.ty = far.y;
    const a0 = near.cs + near.hp, b0 = far.cs + far.hp;
    steps(12);
    const hitNear = near.cs + near.hp < a0, hitFar = far.cs + far.hp < b0, fx = S.fx.some((f) => f.type === 'battery' && f.u === F.id) || true;
    // Duels: the Flagship alone (its escorts away) against one Line Ship, and against three
    const duel = (n, seed) => {
      newGame({ seed, mode: 'versus', shape: SH_VF, size: 1 }); quiet();
      const G = flag(0), ls = [];
      for (let k = 0; k < n; k++) { const u = addCapital(1, 'line', G.x + (k - 1) * 5, G.y + 9, -Math.PI / 2); orderCapital(1, [u.id], 'hunt', G.id); ls.push(u); }
      for (let t = 0; t < 30 * 600 && !G.dead && ls.some((u) => !u.dead); t++) simStep(SIM_STEP);
      return { flag: !G.dead, lines: ls.filter((u) => !u.dead).length, min: Math.round(S.time / 6) / 10 };
    };
    return { hitNear, hitFar, one: duel(1, 31), three: duel(3, 31) };
  `);
  check('The Flagship\'s main battery fires at an enemy Line Ship within its reach (hull to hull), not at one beyond it', r.hitNear && !r.hitFar, r);
  check('Alone, the Flagship\'s battery beats a lone Line Ship', r.one.flag && r.one.lines === 0, r.one);
  check('Alone, it can\'t beat an escorted fleet: three Line Ships destroy it', !r.three.flag && r.three.lines >= 1, r.three);
}

// ---- 11. The siege: Line Ships ordered at a station shell its Point-Defence and Disruptors first, from beyond their reach
// (both stand between them and its Command Base, on the side they come from)
{
  const c = mk();
  const r = run(c, `
    newGame({ seed: 17, mode: 'versus', shape: SH_VF, size: 1 }); quiet();
    const L1 = getE(S.players[1].lander), st = S.vf.st[1];
    const on = (i, j) => i >= st.x0 && i <= st.x1 && j >= st.y0 && j <= st.y1 && S.owner[tIdx(i, j)] === 1;
    const s1 = spot(L1.x, L1.y + 4, 0, 8, on), pd = addBuilding(1, 'pdturret', s1[0], s1[1], true); bump(pd.stock, 'ammo', 4);
    const s2 = spot(L1.x + 3, L1.y + 3, 0, 8, on), ds = addBuilding(1, 'disruptor', s2[0], s2[1], true); bump(ds.stock, 'fuel', 4);
    // the geometry: a Line Ship's reach at a building against what reaches back at its hull
    const L = CAPITAL.line, reachPD = BDEFS.pdturret.range, reachDis = BDEFS.disruptor.range;
    const F1 = flag(1); F1.x = 3; F1.y = 3; F1.sf.tx = 3; F1.sf.ty = 3; // (its Flagship out of the way: its own guns are not the station's)
    const lines = [0, 1].map((k) => addCapital(0, 'line', L1.x - 4 + k * 8, L1.y + 26, -Math.PI / 2));
    orderCapital(0, lines.map((u) => u.id), 'attack', L1.id);
    let hitByPD = 0, hitByDis = 0, minPD = Infinity, minDis = Infinity, firstPD = -1;
    const cs = () => lines.reduce((n, u) => n + (u.dead ? 0 : u.cs + u.hp), 0);
    for (let k = 0; k < 30 * 180; k++) {
      simStep(SIM_STEP);
      for (const u of lines) if (!u.dead) {
        if (!pd.dead) minPD = Math.min(minPD, hullDist(u, bCentre(pd).x, bCentre(pd).y));
        if (!ds.dead) minDis = Math.min(minDis, hullDist(u, bCentre(ds).x, bCentre(ds).y));
      }
      if (pd.dead && firstPD < 0) firstPD = S.time;
      if (pd.dead && ds.dead) break;
    }
    return { pdDead: pd.dead, dsDead: ds.dead, minPD, minDis, reachPD, reachDis, alive: lines.filter((u) => !u.dead).length, firstPD, baseLeft: !L1.dead, full: lines.every((u) => u.hp === u.maxHp) };
  `);
  check(`A siege: Line Ships sent at a station shell its Point-Defence and Disruptor first, from beyond their reach (never within ${'7'} or ${'4.5'} tiles of their hulls)`, r.pdDead && r.dsDead && r.minPD > r.reachPD && r.minDis > r.reachDis && r.full, r);
}

// ---- 12. Gunships and the wing: a pad's Gunship joins the wing by itself while there is room; the Join order (and a
// right-click on the Flagship); leaving it; an Army Group set to Reinforce takes new Gunships (and new warbots first)
{
  const c = mk();
  const r = run(c, `
    newGame({ seed: 9, mode: 'versus', shape: SH_VF, size: 1 }); quiet();
    const F = flag(0), L = getE(S.players[0].lander), P = pad(0, L.x, L.y);
    for (const g of ['alloy', 'chip', 'fuel']) bump(P.stock, g, 200);
    orderAtYard(P, 'gunship', 1);
    until(() => S.bots.some((u) => !u.dead && u.owner === 0 && u.type === 'gunship'), 200);
    const g1 = S.bots.find((u) => !u.dead && u.owner === 0 && u.type === 'gunship');
    const auto = g1.wing === F.id;
    steps(20);
    const by = hullDist(F, g1.x, g1.y) <= CAPITAL.flagship.aura;
    // leave the wing, then join again through the order (as the panel's button), then by a right-click on the Flagship
    const left = applyOrder(0, 'wing', [[g1.id], 0]), out = !g1.wing;
    steps(10);
    const joined = applyOrder(0, 'wing', [[g1.id], F.id]), back = g1.wing === F.id;
    applyOrder(0, 'wing', [[g1.id], 0]);
    const rc = applyOrder(0, 'command', [[g1.id], { flag: F.id, i: Math.floor(F.x), j: Math.floor(F.y) }]);
    const viaClick = g1.wing === F.id && rc && rc.guns === 1;
    // a full wing takes no more
    const extra = []; for (let k = 0; k < CAPITAL.flagship.wing; k++) { const u = addBot(0, 'gunship', Math.floor(F.x), Math.floor(F.y) + 3); u.bat = 100; u.alt = 1; u.sf = { ph: 'hold', tx: u.x, ty: u.y, land: false }; extra.push(u); } // (up in the void, not on the pad: it holds two)
    const took = applyOrder(0, 'wing', [extra.map((u) => u.id), F.id]), full = wingCraft(F).length;
    // Reinforce: a group set to it takes the next Gunship from the pad (not the wing)
    for (const u of wingCraft(F).slice(1)) killBot(u, true); // (room in the wing again: the group still comes first)
    const gid = agNew(0, []), grp = agById(gid);
    const reinfOk = applyOrder(0, 'agReinf', [gid, 1]);
    grp.size = 4;
    orderAtYard(P, 'gunship', 1);
    const n0 = S.bots.filter((u) => !u.dead && u.owner === 0 && u.type === 'gunship').length;
    until(() => S.bots.filter((u) => !u.dead && u.owner === 0 && u.type === 'gunship').length > n0, 200);
    const g2 = S.bots.filter((u) => !u.dead && u.owner === 0 && u.type === 'gunship').pop();
    const inGrp = g2.grp === gid && !g2.wing;
    applyOrder(0, 'agReinf', [gid, 0]);
    // warbots: with two groups under strength, the Reinforce one is filled first
    const gid2 = agNew(0, []);
    agById(gid2).size = 3; applyOrder(0, 'agReinf', [gid2, 1]);
    const pick = agPickFor(0, L);
    return { auto, by, left, out, joined, back, viaClick, took, full, wingMax: CAPITAL.flagship.wing, reinfOk, inGrp, pickReinf: pick && pick.id === gid2, defOff: !agById(gid).reinf };
  `);
  check('A Gunship built at a Launch Pad joins the Flagship\'s wing by itself while it has room, and flies by it', r.auto && r.by, r);
  check('Gunships leave the wing and join it again by order (the panel\'s buttons, a right-click on the Flagship); a full wing takes no more', r.left === 1 && r.out && r.joined === 1 && r.back && r.viaClick && r.full === r.wingMax && r.took === r.wingMax - 1, r);
  check('An Army Group set to Reinforce (off by default) takes new Gunships from the pads instead of the wing, and new warbots before other groups', r.reinfOk && r.inGrp && r.pickReinf && r.defOff, r);
}

// ---- 13. Formation: escorts on a straight run keep the Flagship's heading (Line Ships and its wing, within 10 degrees)
{
  const c = mk();
  const r = run(c, `
    newGame({ seed: 9, mode: 'versus', shape: SH_VF, size: 1 }); quiet();
    const F = flag(0);
    const ls = [addCapital(0, 'line', F.x - 5, F.y + 3, 0.6), addCapital(0, 'line', F.x + 5, F.y + 3, 2.4)];
    const gs = [0, 1, 2].map((k) => { const u = addBot(0, 'gunship', Math.floor(F.x), Math.floor(F.y)); u.x = F.x + k - 1; u.y = F.y + 2; u.bat = 100; u.alt = 1; u.face = k; u.wing = F.id; u.sf = { ph: 'go', tx: u.x, ty: u.y, land: false }; return u; });
    steps(20); // (they form up)
    orderCapital(0, [F.id], 'move', 0, F.x, 10);
    steps(12); // (it gets under way)
    let worst = 0;
    for (let k = 0; k < 30 * 30; k++) {
      simStep(SIM_STEP);
      if (k % 15 || !(F.vel > 0.05)) continue;
      for (const u of [...ls, ...gs]) worst = Math.max(worst, Math.abs(wrapAngle(u.face - F.face)));
    }
    return { worst: Math.round(worst * 57.3 * 10) / 10, moving: F.y };
  `);
  check('In formation on a straight run, every escort (Line Ships and the wing) stays within 10 degrees of the Flagship\'s heading', r.worst <= 10, r);
}

console.log(fails ? `\n${fails} failed` : '\nAll passed');
process.exit(fails ? 1 : 0);

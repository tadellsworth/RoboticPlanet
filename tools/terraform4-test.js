// Headless checks for Terraforming, stage 4: military earthworks (EW, SLUICE, CAVE, SAP in js/defs.js; the stage 4
// block in js/sim.js). Nothing of it exists until it's used; a Grader heaps an Earth Bank, cuts a Fire Trench and sets
// Dragon's Teeth along a dragged line; a bank and teeth stop heavy robots (routes go round, and a heavy army shoots a way
// through a foe's), small robots cross slowly; a bank and a trench give their side's robots cover; blasts wear them to
// worn and breached, and a Grader repairs them; a Sluice opened floods the low ground beyond it through its stages
// (pouring, spreading, under water, wet mud, dried silt) and goes down again, knocking robots about, hurting and knocking
// out buildings, and closing the ground to routes while the water stands; a Cave in on a Murmur tunnel caves it to a
// groove the Murmur never dig through and cuts off the exits beyond it; a Sap Head digs its route a tile at a time (its
// owner alone sees it), a rival feels a tremor as it passes under, it breaks out into an exit its owner's robots go
// through, and the rival can shoot it down; warbots ordered to attack an earthwork tile shoot it (light ones at EW.light of
// a heavy robot's rate) till it breaks, then go back to their group or stand free; saves made mid-flood and mid-dig pass checkSave and play on exactly as the
// game they came from; and the same game twice comes out the same. Run: node tools/terraform4-test.js
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
const { EW, SLUICE, SAP, CAVE } = run(mk(), 'return { EW, SLUICE, SAP, CAVE };');

const HELP = `
  const charged = () => { for (const u of S.bots) u.bat = 100; };
  const until = (fn, secs) => { for (let k = 0; k < 30 * secs && !fn(); k++) { if (k % 30 === 0) charged(); simStep(SIM_STEP); } return fn(); };
  const sites = () => S.buildings.filter((b) => !b.dead && b.tf && !b.built).length;
  // A straight run of open, level ground of ours (no resources, roads or buildings) n tiles long, a row y from (x0..),
  // with the rows either side open too, d0..d1 rows from (x, y).
  const run = (x, y, n, d0, d1) => {
    for (let d = d0; d <= d1; d++) for (const s of [1, -1]) {
      const j = y + s * d;
      for (let i0 = x - n; i0 <= x; i0++) {
        let ok = true;
        for (let i = i0; i < i0 + n && ok; i++) for (let b = j - 1; b <= j + 1 && ok; b++) { if (!inMap(i, b)) { ok = false; break; } const t = tIdx(i, b); if (S.terrain[t] !== T_GROUND || S.res[t] || S.road[t] || S.bAt[t] || S.ramp[t] || S.plan[t] || S.elev[t] !== S.elev[tIdx(i0, j)] || (S.owner[t] !== 0 && S.owner[t] !== -1) || tfWhere(0, t)) ok = false; }
        if (ok) { const out = []; for (let i = i0; i < i0 + n; i++) out.push(tIdx(i, j)); return out; }
      }
    }
    return null;
  };
  const stock = () => { const L = getE(S.players[0].lander); L.stock.stone = 400; L.stock.cement = 200; L.stock.alloy = 200; L.stock.chip = 50; L.stock.ammo = 200; };
  Object.assign(globalThis, { until, sites, run, stock, charged });
`;
const colony = (seed, extra) => `newGame({ seed: ${seed}, mode: 'colony', size: 1, rough: 0${extra || ''} });
  ${HELP}
  const L = getE(S.players[0].lander); stock();`;

// ---- nothing of stage 4 until it's used (nothing made, saved or hashed)
const none = run(mk(), `${colony(5)} until(() => false, 30); return { layers: T4_LAYERS.filter((k) => S[k]), any: t4Any(), save: !/"ewK"|"fld"|"caveIn"/.test(serializeGame()) };`);
check('a game without stage 4 has no earthwork, flood or cave-in layers, and none in its save', !none.layers.length && !none.any && none.save, none);

// ---- the three earthworks: built by a Grader along a dragged line, what each costs
const cB = mk();
const build = run(cB, `
  ${colony(5)}
  addBot(0, 'grader', L.x, L.y + 2); addBot(0, 'grader', L.x + 1, L.y + 2);
  const line = run(L.x, L.y, 7, 5, 12);
  const r = applyOrder(0, 'terraform', ['bank', line.slice(0, 5)]);
  const cost = Object.assign({}, getE(S.bAt[line[0]]).cost);
  const workerTook = () => S.bots.some((u) => u.type === 'worker' && u.task && u.task.type === 'build' && getE(u.task.site)?.tf);
  let wt = false;
  until(() => { if (workerTook()) wt = true; return !sites(); }, 600);
  const banks = line.slice(0, 5).filter((t) => ewAt(t) === 1 && ewOwner(t) === 0 && S.ewH[t] === EW.kinds.bank.hp).length;
  // drag over the same tiles again: nothing to do (already standing)
  const again = applyOrder(0, 'terraform', ['bank', line.slice(0, 5)]);
  // a trench and teeth further along, then the other tools refused on an earthwork
  const r2 = applyOrder(0, 'terraform', ['trench', [line[5]]]), r3 = applyOrder(0, 'terraform', ['teeth', [line[6]]]);
  const tcost = Object.assign({}, getE(S.bAt[line[6]]).cost);
  until(() => !sites(), 600);
  const raise = tfJob(0, 'raise', line[0], 0, new Map()).why, road = canRoad(0, line[0] % S.W, (line[0] / S.W) | 0), place = canPlace(0, 'depot', line[0] % S.W, (line[0] / S.W) | 0).reason;
  globalThis.LINE = line;
  return { r, cost, banks, wt, again: again.placed, trench: ewAt(line[5]), teeth: ewAt(line[6]), tcost, raise, road, place, stats: S.players[0].stats.ewbank };
`);
check('Earth Bank: a dragged line of 5 is planned, a Grader heaps each tile (Workers never take it), 3 Stone a tile', build.r.placed === 5 && build.cost.stone === EW.kinds.bank.cost.stone && build.banks === 5 && !build.wt && build.stats === 5, build);
check('Fire Trench and Dragon\'s Teeth go up the same way; the Teeth cost Cement and Alloy', build.trench === 2 && build.teeth === 3 && build.tcost.cement === EW.kinds.teeth.cost.cement && build.tcost.alloy === EW.kinds.teeth.cost.alloy, build);
check('an earthwork standing in good repair: nothing more to plan there; no Raise, road or building on it', build.again === 0 && /earthwork/.test(build.raise) && !build.road && /earthwork/.test(build.place), build);

// ---- who an earthwork stops, slows and covers
const versus = (seed) => `newGame({ seed: ${seed}, mode: 'versus', players: 2, humans: [0], murmur: 'off', events: false, rough: 0 });
  ${HELP}
  for (const P of S.players) P.ai = false; // (no rival moves of its own: only what the checks order)
  const L = getE(S.players[0].lander); stock();`;
// A ring of earthworks of kind k (side 2r + 1) round tile c, set down at once (as a Grader leaves them).
const RING = `const ring = (c, r, k, o) => { const ci = c % S.W, cj = (c / S.W) | 0, out = []; for (const n of ['ewK', 'ewO', 'ewH']) t4Layer(n);
    for (let j = cj - r; j <= cj + r; j++) for (let i = ci - r; i <= ci + r; i++) if (Math.max(Math.abs(i - ci), Math.abs(j - cj)) === r && inMap(i, j)) { const t = tIdx(i, j); S.ewK[t] = k; S.ewO[t] = o + 1; S.ewH[t] = EW.kinds[EW_KINDS[k]].hp; out.push(t); }
    return out; };
  // (a clear patch of level ground some way above the base: its resources taken off, for the checks to stand on)
  const openSq = (x, y, r, d0) => { const cx = x, cy = Math.max(r + 1, y - d0 - 6); for (let j = cy - r - 1; j <= cy + r + 1; j++) for (let i = cx - r - 1; i <= cx + r + 1; i++) if (inMap(i, j)) { const t = tIdx(i, j); S.res[t] = 0; S.amt[t] = 0; S.terrain[t] = T_GROUND; S.elev[t] = S.elev[tIdx(cx, cy)]; } terrainChanged(); return tIdx(cx, cy); };`;
const who = run(mk(), `
  ${versus(11)}
  ${RING}
  const c = openSq(L.x, L.y, 4, 6), ci = c % S.W, cj = (c / S.W) | 0;
  const banks = ring(c, 2, 1, 0);
  const inside = (p) => p && p.some((t) => banks.includes(t));
  // a heavy robot (a Bulwark) can't get in; a Warbot can, over the bank
  const out = tIdx(ci + 4, cj);
  const heavy = findPath(ci + 4, cj, ci, cj, undefined, { who: 0, ew: 2 }), light = findPath(ci + 4, cj, ci, cj, undefined, { who: 0, ew: 1 });
  // teeth instead: still no way in for the heavy one; small robots go between them
  for (const t of banks) S.ewK[t] = 3;
  const heavyT = findPath(ci + 4, cj, ci, cj, undefined, { who: 0, ew: 2 }), lightT = findPath(ci + 4, cj, ci, cj, undefined, { who: 0, ew: 1 });
  // a trench: everyone crosses
  for (const t of banks) S.ewK[t] = 2;
  const heavyTr = findPath(ci + 4, cj, ci, cj, undefined, { who: 0, ew: 2 });
  // the rules a robot gets from its type: a Bulwark heavy, a Warbot not, a Grader heavy
  const b = addBot(1, 'bulwark', ci + 4, cj), w = addBot(1, 'warbot', ci + 4, cj);
  const kinds = { bulwark: routeOpts(b).ew, warbot: routeOpts(w).ew, grader: ewHeavy('grader'), truck: ewHeavy('truck'), skirmisher: ewHeavy('skirmisher') };
  // slowed: a warbot standing on each kind (and on bare ground)
  const slow = {};
  for (const k of [1, 2, 3]) { for (const t of banks) S.ewK[t] = k; w.x = (banks[0] % S.W) + 0.5; w.y = ((banks[0] / S.W) | 0) + 0.5; slow[k] = t4Slow(w); }
  w.x = ci + 0.5; w.y = cj + 0.5; slow[0] = t4Slow(w);
  return { heavy, lightIn: inside(light), heavyT, lightTIn: inside(lightT), heavyTrIn: inside(heavyTr), kinds, slow };
`);
check('an Earth Bank ring: a heavy robot finds no way in; a Warbot climbs over it', who.heavy === null && who.lightIn, who);
check('Dragon\'s Teeth: no way through for a heavy robot either; a small robot goes between them', who.heavyT === null && who.lightTIn, who);
check('a Fire Trench stops no one', who.heavyTrIn, who);
check('heavy robots by type: Bulwark, Grader, Freight Truck heavy; Warbot and Skirmisher not', who.kinds.bulwark >= 2 && who.kinds.warbot === 1 && who.kinds.grader && who.kinds.truck && !who.kinds.skirmisher, who.kinds);
check('slowed while crossing: bank 0.4, trench 0.6, teeth 0.85 of its speed; 1 off them', who.slow[1] === EW.slow.bank && who.slow[2] === EW.slow.trench && who.slow[3] === EW.slow.teeth && who.slow[0] === 1, who.slow);

const cover = run(mk(), `
  ${versus(11)}
  ${RING}
  const c = openSq(L.x, L.y, 4, 6), ci = c % S.W, cj = (c / S.W) | 0;
  const w = addBot(0, 'warbot', ci, cj);
  const hit = (sx, sy) => { w.hp = 12; damageBot(w, 4, sx, sy); return 12 - w.hp; };
  const open = hit(ci + 5.5, cj + 0.5);
  // our bank on the tile toward the shooter: cover from that side only
  for (const n of ['ewK', 'ewO', 'ewH']) t4Layer(n);
  const bt = tIdx(ci + 1, cj); S.ewK[bt] = 1; S.ewO[bt] = 1; S.ewH[bt] = EW.kinds.bank.hp;
  const behind = hit(ci + 5.5, cj + 0.5), wrongSide = hit(ci - 4.5, cj + 0.5), close = hit(ci + 1.2, cj + 0.5);
  // a foe's bank gives our robot no cover
  S.ewO[bt] = 2; const foeBank = hit(ci + 5.5, cj + 0.5);
  // in our trench: cover from anything, a shell included
  S.ewK[bt] = 0; const t = tIdx(ci, cj); S.ewK[t] = 2; S.ewO[t] = 1; S.ewH[t] = EW.kinds.trench.hp;
  const trench = hit(ci - 4.5, cj + 0.5), shell = hit(undefined, undefined);
  return { open, behind, wrongSide, close, foeBank, trench, shell };
`);
check('cover behind your Earth Bank: 0.6 of the damage from fire across it; none from the other side, point-blank or behind a foe\'s bank', Math.abs(cover.behind - cover.open * EW.cover.bank) < 1e-9 && cover.wrongSide === cover.open && cover.close === cover.open && cover.foeBank === cover.open, cover);
check('cover in your Fire Trench: half the damage, from any side and from shells', Math.abs(cover.trench - cover.open * EW.cover.trench) < 1e-9 && Math.abs(cover.shell - cover.open * EW.cover.trench) < 1e-9, cover);

// ---- breach and repair: blasts wear an earthwork to worn and breached; a Grader repairs it; a heavy army shoots a way through
const cR = mk();
const breach = run(cR, `
  ${versus(11)}
  ${RING}
  const c = openSq(L.x, L.y, 3, 5), ci = c % S.W, cj = (c / S.W) | 0;
  const t = tIdx(ci, cj); for (const n of ['ewK', 'ewO', 'ewH']) t4Layer(n); S.ewK[t] = 1; S.ewO[t] = 1; S.ewH[t] = EW.kinds.bank.hp;
  const hp = [S.ewH[t]];
  ewBlast(ci + 0.5, cj + 0.5, 1.1); hp.push(S.ewH[t]); // (a bomb's blast)
  ewBlast(ci + 0.5, cj + 0.5, 1.1); hp.push(S.ewH[t]);
  for (let k = 0; k < 4 && S.ewH[t]; k++) ewBlast(ci + 0.5, cj + 0.5, 1.1);
  hp.push(S.ewH[t]);
  const breached = S.ewK[t] === 1 && S.ewH[t] === 0 && ewAt(t) === 0, msg = S.msgs.some((m) => /breached/.test(m.text));
  const heavyThrough = findPath(ci - 1, cj, ci + 1, cj, undefined, { who: 0, ew: 2 });
  // the repair: drag the bank tool over it
  addBot(0, 'grader', L.x, L.y + 2);
  const fix = applyOrder(0, 'terraform', ['bank', [t]]), fixJob = getE(S.bAt[t])?.tf?.k, fixCost = Object.assign({}, getE(S.bAt[t])?.cost);
  until(() => !sites(), 300);
  return { hp, breached, msg, heavyThrough: !!heavyThrough && heavyThrough.includes(t), fix: fix.placed, fixJob, fixCost, after: S.ewH[t], fixed: S.players[0].stats.ewFixed };
`);
check('blasts wear an Earth Bank (worn below 60% after two bombs), then breach it (four or five): a gap anyone crosses, and its owner is told', breach.hp[1] < breach.hp[0] && breach.hp[2] < breach.hp[0] * EW.worn && breach.breached && breach.msg && breach.heavyThrough, breach);
check('a Grader repairs it: the bank tool dragged over it plans a repair for half the Stone, done back to full', breach.fix === 1 && breach.fixJob === 'ewfix' && breach.fixCost.stone === Math.max(1, Math.round(EW.kinds.bank.cost.stone * EW.fix)) && breach.after === EW.kinds.bank.hp && breach.fixed === 1, breach);

const army = run(mk(), `
  ${versus(11)}
  ${RING}
  const c = openSq(L.x, L.y, 4, 6), ci = c % S.W, cj = (c / S.W) | 0;
  const teeth = ring(c, 2, 3, 0);
  const b = addBot(1, 'bulwark', ci + 4, cj); b.ammo = 999;
  applyOrder(1, 'command', [[b.id], { i: ci, j: cj }]);
  let breachedT = -1;
  until(() => { if (breachedT < 0 && teeth.some((t) => S.ewH[t] === 0)) breachedT = S.time; b.ammo = 999; return Math.floor(b.x) === ci && Math.floor(b.y) === cj; }, 200);
  // and a Bulwark of ours never shoots through our own: it just has no way in
  const ours = addBot(0, 'bulwark', ci + 4, cj + 1); ours.ammo = 999;
  const r0 = routeOpts(ours), p0 = findPath(ci + 4, cj + 1, ci, cj + 1, undefined, r0);
  return { breachedT, at: [Math.floor(b.x), Math.floor(b.y)], c: [ci, cj], gaps: teeth.filter((t) => S.ewH[t] === 0).length, ownPath: p0 && p0.some((t) => teeth.includes(t) && S.ewH[t] > 0), breachStat: S.players[1].stats.ewBreached };
`);
check('a foe\'s heavy army robot shoots a way through Dragon\'s Teeth in its way and walks on through the gap', army.breachedT > 0 && army.at[0] === army.c[0] && army.at[1] === army.c[1] && army.gaps >= 1 && army.breachStat >= 1, army);
check('a heavy robot never plans through its own side\'s earthworks', !army.ownPath, army);

// ---- an Attack order on an earthwork tile: light warbots at EW.light of a heavy robot's shot, heavy ones at full; it ends at the breach
const ATK = `
  ${versus(11)}
  ${RING}
  const c = openSq(L.x, L.y, 4, 6), ci = c % S.W, cj = (c / S.W) | 0;
  for (const n of ['ewK', 'ewO', 'ewH']) t4Layer(n);
  const set = (i, j, k, o) => { const t = tIdx(i, j); S.ewK[t] = k; S.ewO[t] = o + 1; S.ewH[t] = EW.kinds[EW_KINDS[k]].hp; return t; };`;
const atk = run(mk(), `
  ${ATK}
  const foeBank = set(ci, cj, 1, 1);
  const ws = [0, 1, 2].map((k) => { const w = addBot(0, 'warbot', ci + 4, cj - 1 + k); w.ammo = 999; return w; });
  const r = applyOrder(0, 'command', [ws.map((w) => w.id), { i: ci, j: cj, ew: 1 }]);
  const tasks = ws.map((w) => w.task && w.task.type);
  let endT = -1;
  until(() => { for (const w of ws) w.ammo = Math.max(w.ammo, 900); if (S.ewH[foeBank] === 0 && endT < 0) endT = S.time; return endT >= 0; }, 300);
  const breached = S.ewH[foeBank] === 0;
  until(() => false, 1);
  const after = ws.map((w) => w.task ? w.task.type : null);
  return { r, tasks, breached, endT, after, stat: S.players[0].stats.ewBreached, msgTheirs: S.msgs.some((m) => m.p === 1 && /breached/.test(m.text)) };
`);
check('Attack on a foe\'s Earth Bank tile (right-click it): the selected warbots take it as an earthwork order', atk.r.kind === 'ewshoot' && atk.r.n === 3 && atk.tasks.every((k) => k === 'ewshoot'), atk);
check('...shoot it till it is breached, then the order ends (they stand free); it counts as a breach for us', atk.breached && atk.after.every((k) => k !== 'ewshoot') && atk.stat === 1, atk);
// the rate: one warbot in reach against a bank, shot by shot (EW.breach x EW.light), and a Bulwark at the full EW.breach
const rate = run(mk(), `
  ${ATK}
  const t = set(ci, cj, 1, 1), w = addBot(0, 'warbot', ci + 2.5, cj + 0.5); w.ammo = 999; w.bat = 100;
  applyOrder(0, 'command', [[w.id], { i: ci, j: cj, ew: 1 }]);
  const a0 = w.ammo, h0 = S.ewH[t];
  until(() => w.ammo <= a0 - 8, 30);
  const light = { shots: a0 - w.ammo, lost: h0 - S.ewH[t] };
  // a Bulwark of ours against our own Dragon's Teeth (Ctrl + right-click: the same order)
  const tt = set(ci, cj + 3, 3, 0), b = addBot(0, 'bulwark', ci + 2.5, cj + 3.5); b.bat = 100;
  applyOrder(0, 'command', [[b.id], { i: ci, j: cj + 3, ew: 1 }]);
  const g0 = S.ewH[tt]; let n = 0, cd = 0;
  until(() => { if (b.cd > cd) n++; cd = b.cd; return n >= 6; }, 30);
  const heavy = { shots: n, lost: g0 - S.ewH[tt], task: b.task && b.task.type };
  // no earthwork on the tile: the same right-click is a move order
  const m = applyOrder(0, 'command', [[w.id], { i: ci + 3, j: cj + 6, ew: 1 }]);
  // our trench breached by our own order: no "your trench is breached" message
  const tr = set(ci - 3, cj, 2, 0); S.ewH[tr] = 1; const w2 = addBot(0, 'warbot', ci - 1.5, cj + 0.5); w2.ammo = 99;
  applyOrder(0, 'command', [[w2.id], { i: ci - 3, j: cj, ew: 1 }]);
  until(() => S.ewH[tr] === 0, 30);
  return { light, heavy, move: m.kind, ownTrench: S.ewH[tr], ownMsg: S.msgs.some((m) => m.p === 0 && /Fire Trench is breached/.test(m.text)), EW: EW.light };
`);
check(`a light warbot shooting an earthwork takes off EW.light (${EW.light}) of a heavy robot's ${EW.breach} a shot`, rate.light.shots >= 8 && Math.abs(rate.light.lost - Math.floor(rate.light.shots * EW.breach * EW.light)) <= 1, rate);
check('a heavy robot (a Bulwark) ordered at our own Dragon\'s Teeth shoots them at the full rate', rate.heavy.task === 'ewshoot' && Math.abs(rate.heavy.lost - rate.heavy.shots * EW.breach) <= EW.breach, rate);
check('the order on a tile with no earthwork is a move; your own trench breached on your order: no warning about it', rate.move === 'move' && rate.ownTrench === 0 && !rate.ownMsg, rate);
// a group's unit goes back to its flag when the tile breaks
const grp = run(mk(), `
  ${ATK}
  const t = set(ci, cj, 1, 1);
  const ws = [0, 1].map((k) => { const w = addBot(0, 'warbot', ci + 3, cj + k); w.ammo = 999; return w; });
  const gid = applyOrder(0, 'agNew', [ws.map((w) => w.id)]);
  until(() => false, 3);
  S.ewH[t] = 4;
  applyOrder(0, 'command', [ws.map((w) => w.id), { i: ci, j: cj, ew: 1 }]);
  const on = ws.map((w) => w.task && w.task.type);
  until(() => S.ewH[t] === 0, 60);
  until(() => false, 1);
  const g = agById(gid);
  return { gid: typeof gid, on, back: ws.map((w) => w.task && w.task.type === 'hold' && w.task.rally === g.flag) };
`);
check('a group\'s warbots on the order go back to their group\'s flag once the tile is breached', grp.gid === 'number' && grp.on.every((k) => k === 'ewshoot') && grp.back.every(Boolean), grp);
// saved mid-order: checkSave passes, it loads and plays on the same; a damaged order is refused
const cE = mk(), cE2 = mk();
run(cE, `
  ${versus(11)}
  // (ground as the map made it, nothing changed by hand: a save only keeps what the game itself changed)
  const line = run(L.x, L.y, 7, 5, 12), ci = line[0] % S.W, cj = (line[0] / S.W) | 0;
  for (const n of ['ewK', 'ewO', 'ewH']) t4Layer(n);
  for (const t of [line[1], line[2]]) { S.ewK[t] = 1; S.ewO[t] = 2; S.ewH[t] = 8; } // (worn down already; Ammo as a warbot carries it)
  const ws = [0, 1, 2].map((k) => addBot(0, 'warbot', ci + 6.5, cj - 0.5 + k));
  applyOrder(0, 'command', [ws.map((w) => w.id), { i: ci + 2, j: cj, ew: 1 }]);
  until(() => S.ewH[line[2]] < 6, 60);
  globalThis.ESAVE = serializeGame(); return 0;`);
const ES = JSON.stringify(vm.runInContext('ESAVE', cE));
const eMid = run(cE2, `const o = JSON.parse(${ES}); checkSave(o); deserializeGame(${ES}); ${HELP} return { n: S.bots.filter((u) => u.task && u.task.type === 'ewshoot').length, h: hashState() >>> 0 };`);
const eNow = run(cE, 'return hashState() >>> 0;');
const eA = run(cE, 'until(() => false, 40); return { h: hashState() >>> 0, gap: S.ewH.some((v, t) => S.ewK[t] && !v) };'), eB = run(cE2, 'until(() => false, 40); return { h: hashState() >>> 0, gap: S.ewH.some((v, t) => S.ewK[t] && !v) };');
check('saved mid-order: it passes checkSave, loads with the order on, and plays on exactly as the game it came from', eMid.n === 3 && eMid.h === eNow && eA.h === eB.h && eA.gap, { eMid, eNow, eA, eB });
const eBad = run(mk(), `const o = JSON.parse(${ES}); o.bots.find((u) => u.task && u.task.type === 'ewshoot').task.tile = -5; try { checkSave(o); return 'accepted'; } catch (e) { return 'refused'; }`);
check('checkSave refuses a damaged earthwork order', eBad === 'refused', eBad);

// ---- the Sluice: where it goes, the flood's stages, what the water does, and it going down
const POND = `${RING}
  // a pond of w x h tiles at (px, py), and the Sluice on its south bank, the open ground beyond it lower than the bank
  const pond = (px, py, w, h) => { for (let j = py; j < py + h; j++) for (let i = px; i < px + w; i++) { const t = tIdx(i, j); S.terrain[t] = T_WATER; S.res[t] = 0; S.amt[t] = 0; } terrainChanged(); };`;
const cS = mk();
const sl = run(cS, `
  ${versus(11)}
  ${POND}
  const c = openSq(L.x, L.y, 7, 6), ci = c % S.W, cj = (c / S.W) | 0;
  pond(ci - 3, cj - 7, 6, 5);
  const sy = cj - 2;
  const dry = sluiceWhy(ci - 1, sy + 3, 'ew'), ok = sluiceWhy(ci - 1, sy, 'ew');
  const b = addBuilding(0, 'sluice', ci - 1, sy, true); setLongAxis(b, 'ew');
  // a Depot and a Warbot down in the low ground, a Warbot of ours on the far side to walk across
  const dep = addBuilding(1, 'depot', ci, sy + 3, true), a0 = dep.armor;
  const w = addBot(1, 'warbot', ci - 2.5, sy + 1.5), w0 = w.hp;
  const open = applyOrder(0, 'sluice', [b.id, 1]);
  const F = b.fl, near = F.ts[0], far = F.ts[F.ts.length - 1];
  w.x = (F.ts[1] % S.W) + 0.5; w.y = ((F.ts[1] / S.W) | 0) + 0.5; w.path = null; w.task = null;
  let midWhy = null, at30 = null;
  const seq = [], seqFar = [];
  const note = () => { const a = S.fld[near], z = S.fld[far]; if (seq[seq.length - 1] !== a) seq.push(a); if (seqFar[seqFar.length - 1] !== z) seqFar.push(z); };
  let blocked = null, depOut = null, slowed = null, msgs = 0;
  until(() => { note(); if (at30 === null && S.time - F.t0 >= 30) at30 = S.fld[near];
    if (blocked === null && S.fld[F.ts[3]] === 3) { blocked = findPath(ci - 4, sy + 6, ci + 3, sy + 1, undefined, { who: 0 }); blocked = !blocked || !blocked.includes(F.ts[3]); depOut = dep.fldT > S.time && /Flooded/.test(dep.status || ''); w.x = (F.ts[3] % S.W) + 0.5; w.y = ((F.ts[3] / S.W) | 0) + 0.5; slowed = t4Slow(w); midWhy = sluiceCan(b); }
    return !b.fl; }, 400);
  note();
  const reopen = sluiceCan(b), later = (() => { until(() => !sluiceCan(b), SLUICE.refill + 5); return sluiceCan(b); })();
  return { dry, ok: ok === '', why: ok, midWhy, at30, open, n: F.ts.length, seq, seqFar, blocked, depOut, slowed, depHurt: a0 - dep.armor, depFull: BDEFS.depot.armor, botHit: w0 - w.hp, layer: [...S.fld].some((v) => v), reopen, later, msgs: S.msgs.filter((m) => /Sluice|flood/.test(m.text)).length, ver: S.fldVer };
`);
check('a Sluice goes on the bank, water on one long side and lower or level ground on the other; not out on dry ground', sl.ok && /beside water/.test(sl.dry), sl);
check('opened, its water floods the low ground beyond it (nearest first, as far as the water behind it holds)', sl.open.why === '' && sl.n > 10 && sl.n <= SLUICE.most, sl);
check('each flooded tile goes pouring, spreading, under water, wet mud, dried silt, then ground again', JSON.stringify(sl.seq) === '[0,1,2,3,4,5,0]', sl.seq);
check('the water stands about SLUICE.stay seconds once the gates have opened (still under water 30 s in)', sl.at30 === 3, sl);
check('the far end floods last and goes down first (it never stands as long)', sl.seqFar.includes(3) && sl.seqFar[sl.seqFar.length - 1] === 0, sl.seqFar);
check('under water: no route goes through it; a robot caught there wades at 0.3 of its speed', sl.blocked && Math.abs(sl.slowed - SLUICE.slow.water) < 1e-9, sl);
check('a building the water reaches loses 35% of its strength and is knocked out while it stands; robots there are knocked about', sl.depOut && Math.abs(sl.depHurt - sl.depFull * SLUICE.hurt) < 1e-6 && sl.botHit >= SLUICE.botHit, sl);
check('the flood goes down for good (no flood layer left), then the Sluice refills before it can open again', !sl.layer && /Refilling|going down/.test(sl.midWhy) && sl.later === '', sl);

// ---- Cave in: a Murmur tunnel caved to a groove, the exits beyond it cut off
const cave = run(mk(), `
  newGame({ seed: 7, mode: 'colony', size: 1, rough: 0, murmur: 'quiet' });
  ${HELP}
  const L = getE(S.players[0].lander); stock();
  // a nest with a straight tunnel out toward the base and an exit at its end
  const nest = S.buildings.find((b) => !b.dead && isNestB(b));
  murmurLayer(); const k = murmurAdopt(nest);
  const dx = Math.sign(L.x - nest.x) || 1, tiles = [];
  for (let s = 1; s <= 12; s++) { const t = tIdx(nest.x + dx * s, nest.y); S.tun[t] = k; tiles.push(t); }
  const et = tiles[11], e = addBuilding(wildOwner(), 'burrow', et % S.W, (et / S.W) | 0, true); e.nest = nest.id; e.armor = MURMUR.exitArmor;
  for (const t of tiles) { S.owner[t] = -1; S.res[t] = 0; S.bAt[t] = S.bAt[t] === e.id ? e.id : 0; }
  // dig the cut in the middle (as if a Grader were done: the job's own completion)
  const cutAt = tiles[6], job = tfJob(0, 'cave', cutAt, 0, new Map());
  const site = addBuilding(0, 'earthwork', cutAt % S.W, (cutAt / S.W) | 0, false); site.tf = { k: 'cave', to: 0, n: 1 }; site.cost = {};
  completeEarthwork(site);
  const groove = tiles.filter((t) => S.caveIn && S.caveIn[t]).length, tunLeft = tiles.filter((t) => S.tun[t]).length;
  // the Murmur never dig through it again
  const dig = tunnelable(cutAt);
  // a cave in beside an exit collapses it
  return { job: job.k, why: job.why, groove, tunLeft, exitGone: e.dead, dig, stat: S.players[0].stats.caveIn, notTunnel: tfJob(0, 'cave', tIdx(L.x + 3, L.y + 3), 0, new Map()).why };
`);
check('Cave in: only on a Murmur tunnel (or beside an exit); planned as a Grader job', cave.job === 'cave' && /Murmur tunnel/.test(cave.notTunnel), cave);
check('done, the tunnel caves in for 3 tiles each way to a groove (the rest stays), the Murmur can never dig through it, and the exit it cut off from its nest caves in', cave.groove === 2 * CAVE.len + 1 && cave.tunLeft === 12 - cave.groove && !cave.dig && cave.exitGone && cave.stat === 1, cave);

// ---- the Sap Head: a route planned from it, dug a tile at a time, a tremor, the break-out, robots through, shot down
const SAPSRC = `
  ${versus(11)}
  ${RING}
  const c = openSq(L.x, L.y, 6, 6), ci = c % S.W, cj = (c / S.W) | 0;
  const h = addBuilding(0, 'saphead', ci - 5, cj, true);
  // a rival's Depot over the route, and the route: east along row cj under it, out to (ci + 5, cj - 2)
  const dep = addBuilding(1, 'depot', ci, cj, true);
  const route = []; for (let i = ci - 4; i <= ci + 5; i++) route.push(tIdx(i, cj)); route.push(tIdx(ci + 5, cj - 1), tIdx(ci + 5, cj - 2));
  globalThis.SAPC = { ci, cj, hid: h.id, route };`;
const cP = mk();
const sap = run(cP, `
  ${SAPSRC}
  const bad = applyOrder(0, 'sap', [h.id, [tIdx(ci - 3, cj + 1)]]), diag = applyOrder(0, 'sap', [h.id, [tIdx(ci - 4, cj + 1)]]);
  const notMine = applyOrder(1, 'sap', [h.id, route]);
  const r = applyOrder(0, 'sap', [h.id, route]);
  S.players[1].ai = true; // (a rival: its forts answer a tremor)
  const seen = { me: sapSeen(h, 0), rival: sapSeen(h, 1) };
  until(() => h.sap.dug >= 3, 60); const dug3 = S.time;
  let tremorAt = -1, tremorMsg = null;
  until(() => { if (tremorAt < 0 && S.players[1].tremor) { tremorAt = h.sap.dug; tremorMsg = S.players[1].stats.tremors; } return h.sap.exit; }, 200);
  const e = getE(h.sap.exit);
  return { bad: bad.why, diag: diag.why, notMine: notMine.why, r: r.why, seen, dug3, tremorAt, tremor: S.players[1].tremor, raided: !!S.players[1].raided, tremorMsg: !!tremorMsg, mine: S.msgs.some((m) => /tremor/.test(m.text) && m.p === 0),
    exit: e ? [e.x, e.y, e.owner, e.type] : null, end: [route[route.length - 1] % S.W, (route[route.length - 1] / S.W) | 0], t: S.time, status: h.status };
`);
check('a sap route runs a tile at a time from beside the Sap Head (no gaps, no diagonals), and only its owner can plan it', /hold together|a tile at a time/.test(sap.bad) && /a tile at a time/.test(sap.diag) && /isn't your/.test(sap.notMine) && sap.r === '', sap);
check('only its owner sees the sap\'s route', sap.seen.me && !sap.seen.rival, sap.seen);
check(`it digs a tile every ${SAP.dig} s`, Math.abs(sap.dug3 - 3 * SAP.dig) < 1, sap);
check('passing under a rival\'s building, the rival feels a tremor near it (told, and its forts answer); its owner hears nothing', sap.tremorAt >= 3 && sap.tremorAt <= 6 && sap.tremor && sap.raided && !!sap.tremorMsg && !sap.mine, sap);
check('at its end it breaks out: an exit of its owner\'s opens there', sap.exit && sap.exit[0] === sap.end[0] && sap.exit[1] === sap.end[1] && sap.exit[2] === 0 && sap.exit[3] === 'sapexit', sap);

const thru = run(cP, `
  const { ci, cj, hid } = SAPC, h = getE(hid), e = getE(h.sap.exit);
  // a Warbot of ours by the Sap Head, sent to the far side of the rival's ground: it takes the sap
  const w = addBot(0, 'warbot', ci - 6, cj + 1); w.ammo = 50;
  const p = findPath(ci - 6, cj + 1, e.x + 1, e.y, undefined, routeOpts(w));
  const viaSap = !!p && p.includes(tIdx(h.x, h.y)) && p.includes(tIdx(e.x, e.y));
  applyOrder(0, 'command', [[w.id], { i: e.x + 1, j: e.y }]);
  let hidden = false, hit = 0;
  const arrived = until(() => { if (w.sapT) { hidden = true; const hp = w.hp; damageBot(w, 5, w.x + 3, w.y); hit += hp - w.hp; } return Math.floor(w.x) === e.x + 1 && Math.floor(w.y) === e.y; }, 120);
  // the rival's robots can't use it, and can shoot its exit down
  const r = addBot(1, 'warbot', e.x + 1, e.y + 1), rp = findPath(e.x + 1, e.y + 1, h.x - 1, h.y, undefined, routeOpts(r));
  const rivalVia = !!rp && rp.includes(tIdx(e.x, e.y));
  hitBuilding(e, 100, 1, r);
  if (e.armor <= 0) destroyBuilding(e, true);
  const after = findPath(ci - 6, cj + 1, e.x + 1, e.y, undefined, routeOpts(w));
  return { viaSap, arrived, hidden, hit, rivalVia, dead: h.sap.dead, link: sapLink(tIdx(h.x, h.y), 0), afterVia: !!after && after.some((t, k) => k > 0 && Math.max(Math.abs((t % S.W) - (after[k - 1] % S.W)), Math.abs(((t / S.W) | 0) - ((after[k - 1] / S.W) | 0))) > 1), // (a jump: down the sap and up)
    msg: S.msgs.some((m) => /exit was lost/.test(m.text)), shut: S.players[1].stats.sapShut };
`);
check('its owner\'s robots go through the sap: down at the Sap Head, out of sight and out of reach, up at the exit', thru.viaSap && thru.arrived && thru.hidden && thru.hit === 0, thru);
check('a rival can\'t use it, but can shoot its exit down: the sap is shut and its owner is told', !thru.rivalVia && thru.dead === 1 && thru.link === -1 && !thru.afterVia && thru.msg && thru.shut === 1, thru);

// ---- saves made mid-flood and mid-dig play on exactly as the game they came from; the same game twice comes out the same
const MID = `
  ${versus(11)}
  ${POND}
  const c = openSq(L.x, L.y, 7, 6), ci = c % S.W, cj = (c / S.W) | 0;
  pond(ci - 3, cj - 7, 6, 5);
  const b = addBuilding(0, 'sluice', ci - 1, cj - 2, true); setLongAxis(b, 'ew');
  for (const n of ['ewK', 'ewO', 'ewH']) t4Layer(n);
  for (let i = ci - 4; i <= ci + 4; i++) { const t = tIdx(i, cj + 4); S.ewK[t] = 1; S.ewO[t] = 1; S.ewH[t] = 40; }
  const h = addBuilding(0, 'saphead', ci - 6, cj + 6, true);
  const route = []; for (let i = ci - 5; i <= ci + 3; i++) route.push(tIdx(i, cj + 6));
  addBuilding(1, 'depot', ci - 1, cj + 6, true);
  applyOrder(0, 'sap', [h.id, route]);
  applyOrder(0, 'sluice', [b.id, 1]);
  addBot(1, 'bulwark', ci + 6, cj + 5).ammo = 99;
  addBot(0, 'grader', ci + 2, cj + 8); applyOrder(0, 'terraform', ['bank', [tIdx(ci + 1, cj + 9), tIdx(ci + 2, cj + 9), tIdx(ci + 3, cj + 9)]]); // (Earthworks sites mid-job in the save too)
  terrainChanged(); // (the land the buildings set down here hold, as a loaded game works it out)
  until(() => false, 25);`;
const cA = mk(), cL = mk();
const mid = run(cA, `${MID} globalThis.SAVE = serializeGame(); return { t: S.time, fl: !!b.fl, dug: h.sap.dug, wet: [...S.fld].filter((v) => v).length };`);
const loaded = run(cL, `const o = JSON.parse(SAVE_T); checkSave(o); deserializeGame(SAVE_T); ${HELP} return { t: S.time, h: hashState() >>> 0, wet: [...S.fld].filter((v) => v).length, dug: S.buildings.find((b) => b.type === 'saphead').sap.dug };`.replace(/SAVE_T/g, JSON.stringify(vm.runInContext('SAVE', cA))));
const hNow = run(cA, 'return hashState() >>> 0;');
check('a save made mid-flood and mid-dig passes checkSave and loads with its flood and its sap, the same hash', mid.fl && mid.dug >= 2 && mid.wet > 5 && loaded.t === mid.t && loaded.wet === mid.wet && loaded.dug === mid.dug && loaded.h === hNow, { mid, loaded, hNow });
const play = (c) => run(c, 'until(() => false, 120); return { h: hashState() >>> 0, t: S.time };');
const pA = play(cA), pB = play(cL);
check('...and plays on exactly as the game it came from (the flood going down, the sap breaking out)', pA.h === pB.h && pA.t === pB.t, { pA, pB });
const badSave = run(mk(), `const o = JSON.parse(SAVE_T); o.buildings.find((b) => b.type === 'sluice').fl.st[0] = 9; try { checkSave(o); return 'accepted'; } catch (e) { return 'refused'; }`.replace('SAVE_T', JSON.stringify(vm.runInContext('SAVE', cA))));
check('checkSave refuses a damaged flood', badSave === 'refused', badSave);
const twin = () => run(mk(), `${MID} until(() => false, 120); return hashState() >>> 0;`);
const t1 = twin(), t2 = twin();
check('the same game twice comes out the same (determinism)', t1 === t2, { t1, t2 });

if (fails) { console.log(`\n${fails} check(s) failed.`); process.exit(1); }
console.log('\nAll terraforming stage 4 checks passed.');

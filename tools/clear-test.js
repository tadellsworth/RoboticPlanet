// Headless checks for Clear ground (Paths → Clear; CLEAR, clearWhy, stepClear, doClear in js/sim.js, ORDERS.paths'
// `clear` in js/orders.js): a Stalk grove, a boulder and an Ore vein marked to clear are cleared by free Workers, the
// resource destroyed and nothing given back, and a Wall then goes on each tile; a rival's land is refused, as is open
// ground; a mark is called off; ground no Worker can reach backs off (CLEAR.retry) rather than being tried every tick;
// a save made mid-job passes checkSave, loads and plays on exactly as the game it came from; and the same plan played
// twice comes out the same. Run: node tools/clear-test.js
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

// A Versus game (Walls are a war tool) with the rival asleep, so only player 0 acts. Batteries stay topped up: charging
// isn't what's tested.
const HELP = `
  const charged = () => { for (const u of S.bots) if (u.owner === 0) u.bat = 100; };
  const until = (fn, secs) => { for (let k = 0; k < 30 * secs && !fn(); k++) { if (k % 30 === 0) charged(); simStep(SIM_STEP); } return fn(); };
  // The nearest tile of resource r to the Command Base that player 0 may clear and could wall afterwards (open ground
  // all round, so the Wall walls nothing in).
  const L = getE(S.players[0].lander);
  const spot = (r, not) => {
    let best = -1, bd = Infinity;
    for (let t = 0; t < S.W * S.H; t++) {
      if (S.res[t] !== r || (not && not.includes(t)) || clearWhy(0, t)) continue;
      const i = t % S.W, j = (t / S.W) | 0, d = Math.abs(i - L.x) + Math.abs(j - L.y);
      if (d < 4 || d >= bd || S.owner[t] !== 0) continue;
      let ok = true;
      for (let y = j - 1; y <= j + 1 && ok; y++) for (let x = i - 1; x <= i + 1; x++) { const u = tIdx(x, y); if (!inMap(x, y) || S.bAt[u] || S.road[u] || S.terrain[u] !== T_GROUND || S.elev[u] !== S.elev[t]) { ok = false; break; } }
      if (ok) { best = t; bd = d; }
    }
    return best;
  };
  Object.assign(globalThis, { charged, until, spot, L });
`;
const versus = (seed) => `newGame({ seed: ${seed}, mode: 'versus', size: 1, rough: 1, rich: 3 });
  S.players[1].aiT = 1e9; // (the rival thinks no more)
  ${HELP}
  L.stock.stone = 400; L.stock.cement = 200; L.stock.fiber = 200;`;

// ---- a stalk grove, a boulder and an Ore vein: cleared by Workers, nothing back, then a Wall on each
const A = run(mk(), `
  ${versus(31)}
  const a = spot(R_STALK), b = spot(R_BOULDER, [a]), c = spot(R_ORE, [a, b]);
  const before = { a: S.res[a], b: S.res[b], c: S.res[c], ore: S.amt[c] };
  const wallFirst = canPlace(0, 'wall', c % S.W, (c / S.W) | 0).reason;
  const goods0 = JSON.stringify(playerGoods(0));
  const r = applyOrder(0, 'paths', [{ clear: [a, b, c] }]);
  const marked = S.clrN;
  let took = false, worked = false;
  until(() => { for (const u of S.bots) if (u.task && u.task.type === 'clear') { took = took || u.type === 'worker'; if (u.task.phase === 'work') worked = true; } return !S.clrN; }, 240);
  const goods1 = playerGoods(0);
  const gone = [a, b, c].every((t) => !S.res[t] && !S.amt[t]);
  // (nothing back: no Fiber, Stone or Ore came in from the clearing, as crates or into storage)
  const loot = (S.loot || []).filter((l) => [a, b, c].some((t) => Math.abs(l.x - t % S.W) <= 1 && Math.abs(l.y - ((t / S.W) | 0)) <= 1)).length;
  const walls = [a, b, c].map((t) => applyOrder(0, 'place', ['wall', t % S.W, (t / S.W) | 0]).ok);
  return { a, b, c, before, wallFirst, r, marked, took, worked, gone, loot, walls, cleared: S.players[0].stats.cleared, ore1: goods1.ore || 0, ore0: JSON.parse(goods0).ore || 0, hash: hashState() >>> 0 };
`);
check('three resource tiles found on our land: a stalk grove, a boulder and an Ore vein', A.a >= 0 && A.b >= 0 && A.c >= 0 && A.before.a === 1 && A.before.b === 2 && A.before.c === 3, A);
check('a Wall is refused on a resource tile before it is cleared', /resources/i.test(A.wallFirst), A.wallFirst);
check('the plan marks all three (S.clrN), as a lockstep order', A.r.cleared === 3 && A.marked === 3 && !A.r.clearWhy, A.r);
check('a Worker walks out and works each tile; all three are cleared', A.took && A.worked && A.gone && A.cleared === 3, A);
check('nothing comes back: no crates by the tiles, no Ore into storage', A.loot === 0 && A.ore1 <= A.ore0, A);
check('a Wall then goes on each cleared tile', A.walls.every(Boolean), A.walls);

// ---- refusals: a rival's land, open ground, a Trade Post's; calling a mark off
const B = run(mk(), `
  ${versus(31)}
  let rival = -1, open = -1;
  for (let t = 0; t < S.W * S.H && (rival < 0 || open < 0); t++) {
    if (rival < 0 && S.res[t] && S.res[t] !== R_CROP && S.owner[t] === 1 && !S.bAt[t]) rival = t;
    if (open < 0 && !S.res[t] && S.terrain[t] === T_GROUND && S.owner[t] === 0) open = t;
  }
  const r1 = applyOrder(0, 'paths', [{ clear: [rival] }]);
  const r2 = applyOrder(0, 'paths', [{ clear: [open] }]);
  const post = (S.posts || [])[0], pt = post ? tIdx(post.x, post.y) : -1;
  const r3 = pt >= 0 ? clearWhy(0, pt) : 'no post';
  const t = spot(R_STALK);
  applyOrder(0, 'paths', [{ clear: [t] }]);
  const on = S.clrN;
  const r4 = applyOrder(0, 'paths', [{ clearDel: [t] }]);
  until(() => false, 20);
  return { rival, r1, r2, r3, on, r4, after: S.clrN, still: S.res[t], bogus: applyOrder(0, 'paths', [{ clear: ['x', -5, 1e9, 2.5] }]).cleared };
`);
check('a rival\'s land is refused', B.rival >= 0 && B.r1.cleared === 0 && /rival/i.test(B.r1.clearWhy), B);
check('open ground (nothing to clear) is refused', B.r2.cleared === 0 && /nothing/i.test(B.r2.clearWhy), B);
check('a Trade Post\'s ground is refused', !!B.r3, B.r3);
check('a mark called off stays uncleared, its resource where it was', B.on === 1 && B.r4.unclear === 1 && B.after === 0 && B.still === 1, B);
check('bad tiles in an order are ignored', B.bogus === 0, B);

// ---- unreachable ground: a stalk tile walled in by Wall sites is tried a few times, not every tick
const C = run(mk(), `
  ${versus(31)}
  const t = spot(R_STALK), i = t % S.W, j = (t / S.W) | 0;
  for (let y = j - 1; y <= j + 1; y++) for (let x = i - 1; x <= i + 1; x++) if (x !== i || y !== j) addBuilding(0, 'wall', x, y, true);
  computeZones();
  const r = applyOrder(0, 'paths', [{ clear: [t] }]); // (the ring is buildings on open ground: no path in, though the zone is the same)
  let tries = 0;
  const of = findPath;
  globalThis.findPath = function (sx, sy, gx, gy, ...rest) { if (gx === i && gy === j) tries++; return of(sx, sy, gx, gy, ...rest); };
  until(() => false, 40);
  globalThis.findPath = of;
  return { t, r: r.cleared, tries, still: S.clrN, res: S.res[t], skip: (S.players[0].clrSkip || {})[t] > S.time - CLEAR.retry };
`);
check('ground no Worker can find a way to stays marked and is tried again only every CLEAR.retry s, not every tick', C.t >= 0 && C.r === 1 && C.still === 1 && C.res === 1 && C.tries >= 1 && C.tries <= 6, C);

// ---- save mid-job: it loads and plays on exactly as the game it came from
const midSrc = `
  ${versus(31)}
  const ts = [spot(R_STALK)]; ts.push(spot(R_BOULDER, ts)); ts.push(spot(R_ORE, ts));
  applyOrder(0, 'paths', [{ clear: ts }]);
  until(() => S.bots.some((u) => u.task && u.task.type === 'clear' && u.task.phase === 'work' && u.task.prog > 0.5), 200);
`;
const cA = mk(), cB = mk();
const mid = run(cA, `${midSrc} globalThis.SAVE = serializeGame(); return { busy: S.bots.filter((u) => u.task && u.task.type === 'clear').length, n: S.clrN, t: S.time };`);
cB.SAVE = vm.runInContext('SAVE', cA);
const loaded = run(cB, `checkSave(JSON.parse(SAVE)); deserializeGame(SAVE); ${HELP} return { n: S.clrN, busy: S.bots.filter((u) => u.task && u.task.type === 'clear').length, t: S.time };`);
const after = (c) => run(c, `until(() => false, 200); return { h: hashState() >>> 0, n: S.clrN };`);
const hA = after(cA), hB = after(cB);
check('a save made mid-job passes checkSave and loads with its marks and the Worker at work', mid.busy >= 1 && loaded.busy === mid.busy && loaded.n === mid.n && loaded.t === mid.t, { mid, loaded });
check('the loaded game plays on exactly as the one it came from (same hash), every tile cleared', hA.h === hB.h && hA.n === 0, { hA, hB });
const bad = run(mk(), `${versus(31)} const o = JSON.parse(${JSON.stringify(cB.SAVE)}); o.bots.find((u) => u.task && u.task.type === 'clear').task.tile = -4; try { checkSave(o); return false; } catch (e) { return true; }`);
check('checkSave turns down a clearing job off the map', bad, bad);

// ---- determinism: the same plan in two fresh games comes out the same
const twin = () => run(mk(), `${midSrc} until(() => false, 120); return hashState() >>> 0;`);
const h1 = twin(), h2 = twin();
check('determinism: the same plan played twice gives the same hash', h1 === h2, { h1, h2 });

console.log(fails ? fails + ' FAILED' : 'ALL PASSED');
process.exit(fails ? 1 : 0);

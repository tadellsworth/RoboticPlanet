// Passenger Town (the city map): the town is laid symmetric and joined on many seeds and sizes, stripping a building
// opens its ground and pays its salvage, a sentry holds its post and falls to warbots, a save replays the same, and
// (with --games [n] [minutes]) rival-against-rival games on it end.
// Usage: node tools/city-test.js [--games 6 75]
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const path = require('node:path');

const files = ['util', 'defs', 'world', 'path', 'sim', 'ai', 'missions', 'orders'];
const source = files.map((name) => readFileSync(path.join(__dirname, '..', 'js', name + '.js'), 'utf8')).join('\n');
const gi = process.argv.indexOf('--games'), games = gi > 0 ? +(process.argv[gi + 1] || 6) : 0, mins = gi > 0 ? +(process.argv[gi + 2] || 75) : 0;

const out = new Function('assert', 'sfx', 'GAMES', 'MINS', source + `
  const shape = SHAPE_PRESETS.findIndex((s) => s.city), log = [];
  assert.ok(shape > 0, 'the map type is listed');
  // 1) Laid symmetric (a half turn) and joined: every street tile reachable from both bases, on many seeds and sizes.
  let layouts = 0;
  for (let size = 0; size <= 4; size++) for (const seed of [1, 2, 3, 7, 11, 23, 42, 99]) {
    newGame({ shape, size, seed, players: 2, murmur: 'off' });
    const { W, H } = S, N = W * H, T = S.town, label = SIZE_PRESETS[size].name + ' seed ' + seed;
    assert.ok(T && T.r.length > 10, label + ': a town');
    for (let j = T.y0; j <= T.y1; j++) for (let i = 0; i < W; i++) { const t = j * W + i; assert.equal(S.terrain[t], S.terrain[N - 1 - t], label + ' symmetric at ' + i + ',' + j); assert.equal(!!townRuinAt(t), !!townRuinAt(N - 1 - t), label + ' buildings symmetric'); }
    const tw = (r) => T.r.find((q) => q.x === W - r.x - r.w && q.y === H - r.y - r.h && q.k === r.k);
    for (const r of T.r) { const q = tw(r); assert.ok(q, label + ' a twin for every building'); assert.deepEqual(q.g, r.g, label + ' same salvage'); assert.equal(q.sen, r.sen, label + ' same sentry'); assert.equal(q.cache, r.cache, label + ' same cache'); }
    const [a, b] = S.players.map((P) => getE(P.lander)).map((L) => S.zone[tIdx(L.x, L.y)]);
    assert.ok(a >= 0 && a === b, label + ': the bases joined');
    for (let j = T.y0; j <= T.y1; j++) for (let i = 0; i < W; i++) { const t = j * W + i; if (S.terrain[t] === 0) assert.equal(S.zone[t], a, label + ': street ' + i + ',' + j + ' reachable'); }
    for (const L of S.players.map((P) => getE(P.lander))) assert.ok(L.y < T.y0 - 3 || L.y > T.y1 + 3, label + ': bases clear of the town');
    if (size === 1 && seed === 1) { const g = { cement: 0, alloy: 0, chip: 0 }; for (const r of T.r) for (const k in g) g[k] += r.g[k]; log.push('Medium seed 1: ' + T.r.length + ' buildings, ' + T.r.filter((r) => r.k === 'arcade').length + ' arcades, ' + T.r.filter((r) => r.sen).length + ' sentries, ' + T.r.filter((r) => r.cache).length + ' caches; salvage each side ' + JSON.stringify({ cement: g.cement / 2, alloy: g.alloy / 2, chip: g.chip / 2 })); }
    layouts++;
  }
  log.push(layouts + ' layouts symmetric and joined');
  // 2) Stripping: ordered, the Workers take it apart, it pays, its ground opens; a guarded one can't be ordered.
  newGame({ shape, size: 1, seed: 5, players: 2, murmur: 'off' });
  const L = getE(S.players[0].lander), guarded = S.town.r.find((r) => r.sen > 0);
  assert.ok(applyOrder(0, 'townStrip', [guarded.id, true]).length > 0, 'a guarded building is refused');
  const r = S.town.r.filter((q) => !q.sen && q.k === 'flats' && townStands(q).some((t) => !hotFor(0, t))).sort((p, q) => dist2(p.x, p.y, L.x, L.y) - dist2(q.x, q.y, L.x, L.y))[0];
  const total = townLeft(r), store = () => S.buildings.filter((b) => b.owner === 0 && !b.dead).reduce((n, b) => n + (b.stock.cement || 0) + (b.stock.alloy || 0) + (b.stock.chip || 0), 0);
  const before = store(), z0 = S.zone[tIdx(r.x, r.y)];
  assert.equal(applyOrder(0, 'townStrip', [r.id, true]), '');
  let t0 = S.time;
  while (!r.gone && S.time < t0 + 400) simStep(SIM_STEP);
  assert.ok(r.gone, 'stripped bare in time');
  const took = Math.round(S.time - t0);
  for (let j = r.y; j < r.y + r.h; j++) for (let i = r.x; i < r.x + r.w; i++) { assert.equal(S.terrain[tIdx(i, j)], 0, 'its lot is open ground'); assert.ok(!townRuinAt(tIdx(i, j))); assert.ok(S.zone[tIdx(i, j)] === S.zone[tIdx(L.x, L.y)], 'and walkable from home'); }
  while (S.time < t0 + took + 240 && (S.loot || []).some((l) => l.town && lootLeft(l) > 0)) simStep(SIM_STEP);
  log.push('a ' + r.w + 'x' + r.h + ' apartment block (' + total + ' units) stripped in ' + took + ' s; ' + (store() - before) + ' units more in storage after the crates came home (spent meanwhile not counted)');
  assert.equal(S.players[0].stats.stripped, total, 'every unit stripped');
  assert.ok(store() - before > 0, 'the salvage reached storage');
  // 3) A sentry: shoots a robot that comes near; warbots beside it shoot it down; then it can be stripped.
  const g = S.town.r.find((q) => q.sen > 0 && q.y > S.H / 2), st = townStands(g).find((t) => !calmAt((t % S.W) + 0.5, ((t / S.W) | 0) + 0.5));
  const w = []; for (let k = 0; k < 5; k++) { const u = addBot(0, 'warbot', st % S.W, (st / S.W) | 0); w.push(u); }
  t0 = S.time;
  while (g.sen > 0 && S.time < t0 + 60) { for (const u of w) if (!u.dead) { u.x = (st % S.W) + 0.5; u.y = ((st / S.W) | 0) + 0.5; u.task = null; u.path = null; } simStep(SIM_STEP); }
  const hurt = w.filter((u) => u.dead || u.hp < BOTS.warbot.hp).length;
  log.push('sentry: armour ' + TOWN.sentry.hp + ', down in ' + (S.time - t0).toFixed(1) + ' s to 5 warbots beside it; ' + hurt + ' of them hit, ' + w.filter((u) => u.dead).length + ' lost');
  assert.equal(g.sen, 0, 'the sentry falls'); assert.ok(hurt > 0, 'it shot back');
  assert.equal(applyOrder(0, 'townStrip', [g.id, true]), '', 'then it can be stripped');
  // cover beside a building
  const u0 = w.find((u) => !u.dead); u0.x = (st % S.W) + 0.5; u0.y = ((st / S.W) | 0) + 0.5;
  assert.equal(townCover(u0), TOWN.cover, 'cover beside a building');
  // 4) A save replays the same.
  for (let k = 0; k < 600; k++) simStep(SIM_STEP);
  const saved = serializeGame();
  for (let k = 0; k < 1800; k++) simStep(SIM_STEP);
  const h1 = hashState(), gone1 = S.town.r.filter((q) => q.gone).length;
  deserializeGame(saved);
  for (let k = 0; k < 1800; k++) simStep(SIM_STEP);
  assert.equal(hashState(), h1, 'the save replays the same');
  assert.equal(S.town.r.filter((q) => q.gone).length, gone1);
  // ...and a bad one is refused
  const bad = JSON.parse(saved); bad.town.r[0].k = 'castle';
  assert.throws(() => deserializeGame(JSON.stringify(bad)), 'a damaged town is refused');
  log.push('save round trip replays the same; a damaged town is refused');
  // 5) Rival against rival: do the games end?
  for (let n = 0; n < GAMES; n++) {
    const seed = 101 + n * 17;
    newGame({ seed, difficulty: 'normal', mode: 'versus', autoplay: true, shape, size: n % 3 === 2 ? 2 : 1, style: 'random', murmur: n % 2 ? 'active' : 'off' });
    const styles = S.players.map((P) => P.style).join(' v ');
    while (S.winner < 0 && S.time < MINS * 60) simStep(SIM_STEP);
    log.push('game seed ' + seed + ' ' + SIZE_PRESETS[S.settings.size].name + (S.wildlife ? ' Murmur' : '') + ' (' + styles + '): ' + (S.winner >= 0 ? 'won by P' + S.winner + ' at ' + (S.time / 60).toFixed(1) + ' min' : 'no winner by ' + MINS + ' min') + '; stripped ' + S.town.r.filter((q) => q.gone).length + '/' + S.town.r.length + ' (P0 ' + (S.players[0].stats.stripped || 0) + ', P1 ' + (S.players[1].stats.stripped || 0) + ' units), sentries left ' + S.town.r.filter((q) => !q.gone && q.sen > 0).length);
  }
  return log;
`)(assert, () => {}, games, mins);
for (const l of out) console.log(l);
console.log('city-test: ALL PASSED');

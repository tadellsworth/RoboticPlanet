// Passenger Town (the city map): the town is laid fair and joined for two, three and four colonies on many seeds and
// sizes, its avenues are old roads a Hauler can drive, Trade Posts land only on its market squares, stripping a building
// opens its ground and pays its salvage, a sentry holds its post and falls to warbots, shoots the Murmur and is clawed by
// them, a save replays the same (and an older one loads), and (with --games [n] [minutes]) rival-against-rival games on
// it, two, three and four colonies, end.
// Usage: node tools/city-test.js [--games 6 75] [--only k]
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const path = require('node:path');

const files = ['util', 'defs', 'world', 'path', 'sim', 'ai', 'missions', 'orders'];
const source = files.map((name) => readFileSync(path.join(__dirname, '..', 'js', name + '.js'), 'utf8')).join('\n');
const oi = process.argv.indexOf('--only'), only = oi > 0 ? +process.argv[oi + 1] : -1; // (--only k: just the k-th game, to run them side by side)
const gi = process.argv.indexOf('--games'), games = gi > 0 ? +(process.argv[gi + 1] || 6) : 0, mins = gi > 0 ? +(process.argv[gi + 2] || 75) : 0;

const out = new Function('assert', 'sfx', 'GAMES', 'MINS', 'ONLY', source + `
  const shape = SHAPE_PRESETS.findIndex((s) => s.city), log = [];
  assert.ok(shape > 0, 'the map type is listed');
  // 1) Laid fair and joined, on many seeds and sizes: with two, the half turn tile for tile; with four, the quarter turn
  // (a colony on each edge, the avenues a #); with three, every third alike as near as a grid allows (the same
  // sentries, caches and arcades, salvage within a tenth). Every street tile reachable from every base, the bases clear
  // of the town, the avenues old roads no one owns, nothing standing on them.
  let layouts = 0;
  const ccx = (W) => (W - 1) / 2, SEC = (2 * Math.PI) / 3;
  const sector = (x, y) => { let a = Math.atan2(y - ccx(S.H), x - ccx(S.W)) - Math.PI / 6; a = ((a % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI); return Math.floor(a / SEC) % 3; };
  for (const players of [2, 3, 4]) for (let size = 0; size <= 4; size++) for (const seed of players === 2 ? [1, 2, 3, 7, 11, 23, 42, 99] : [1, 3, 7, 11, 42]) {
    newGame({ shape, size, seed, players, murmur: 'off' });
    const { W, H } = S, N = W * H, T = S.town, label = players + ' players ' + SIZE_PRESETS[S.settings.size].name + ' seed ' + seed;
    assert.ok(T && T.r.length > 10, label + ': a town');
    const turn = players === 4 ? (t) => (t % W) * W + (W - 1 - ((t / W) | 0)) : (t) => N - 1 - t;
    const turnR = players === 4 ? (r) => ({ x: W - r.y - r.h, y: r.x, w: r.h, h: r.w }) : (r) => ({ x: W - r.x - r.w, y: H - r.y - r.h, w: r.w, h: r.h });
    if (players !== 3) {
      for (let t = 0; t < N; t++) { assert.equal(S.terrain[t], S.terrain[turn(t)], label + ' terrain turned at ' + t); assert.equal(!!townRuinAt(t), !!townRuinAt(turn(t)), label + ' buildings turned'); assert.equal(S.road[t], S.road[turn(t)], label + ' avenues turned'); }
      for (const r of T.r) { const o = turnR(r), q = T.r.find((p) => p.x === o.x && p.y === o.y && p.w === o.w && p.h === o.h && p.k === r.k); assert.ok(q, label + ' a twin for every building'); assert.deepEqual(q.g, r.g, label + ' same salvage'); assert.equal(q.sen, r.sen, label + ' same sentry'); assert.equal(q.cache, r.cache, label + ' same cache'); }
    } else {
      const sum = [0, 0, 0], sen = [0, 0, 0], cache = [0, 0, 0], arc = [0, 0, 0], av = [0, 0, 0];
      for (const r of T.r) { const k = sector(r.x + r.w / 2 - 0.5, r.y + r.h / 2 - 0.5); if (r.k !== 'arcade') sum[k] += r.n0; if (r.sen) sen[k]++; if (r.cache) cache[k]++; if (r.k === 'arcade') arc[k]++; }
      for (const t of T.av) av[sector(t % W, (t / W) | 0)]++;
      assert.ok(Math.max(...sum) - Math.min(...sum) <= Math.max(3, Math.max(...sum) * 0.1), label + ': salvage alike in every third ' + sum);
      for (const a of [sen, cache, arc]) assert.ok(a[0] === a[1] && a[1] === a[2], label + ': every third alike ' + JSON.stringify({ sen, cache, arc }));
      assert.ok(Math.min(...av) >= Math.max(...av) * 0.6, label + ': an avenue into every third ' + av);
    }
    const homes = S.players.map((P) => getE(P.lander)), zs = homes.map((L) => S.zone[tIdx(L.x, L.y)]);
    assert.ok(zs[0] >= 0 && zs.every((z) => z === zs[0]), label + ': the bases joined');
    for (let j = T.y0; j <= T.y1; j++) for (let i = T.x0; i <= T.x1; i++) { const t = j * W + i; if (townIn(i, j) && S.terrain[t] === 0) assert.equal(S.zone[t], zs[0], label + ': street ' + i + ',' + j + ' reachable'); }
    for (const L of homes) for (let j = L.y - 3; j <= L.y + 3; j++) for (let i = L.x - 3; i <= L.x + 3; i++) assert.ok(!townIn(i, j), label + ': bases clear of the town');
    // the avenues: roads of TOWN.avenue's surface, no one's, nothing on them, joined up, and one comes to each colony's side
    assert.ok(T.av.length > 0, label + ': avenues');
    for (const t of T.av) { assert.ok(S.road[t] && S.pave[t] === TOWN.avenue && S.wown[t] === -1 && wayOwner(t) === S.owner[t], label + ': an avenue is a road no one laid'); assert.ok(!townRuinAt(t), label + ': nothing on an avenue'); }
    const avSet = new Set(T.av), seen = new Set([T.av[0]]), q = [T.av[0]];
    for (let h = 0; h < q.length; h++) { const t = q[h], i = t % W; for (const u of [i > 0 ? t - 1 : -1, i < W - 1 ? t + 1 : -1, t - W, t + W]) if (avSet.has(u) && !seen.has(u)) { seen.add(u); q.push(u); } }
    if (players !== 2) assert.equal(seen.size, T.av.length, label + ': the avenues meet');
    for (const L of homes) { const d = Math.min(...T.av.map((t) => dist2(t % W, (t / W) | 0, L.x, L.y))); assert.ok(Math.sqrt(d) <= Math.sqrt(dist2(L.x, L.y, (W - 1) / 2, (H - 1) / 2)) * 0.75, label + ': an avenue comes toward every base'); }
    // a Trade Post in the town only on a square or a parking lot, never by a sign
    for (const p of S.posts) { assert.ok(townPostOk(p.x, p.y), label + ': a Trade Post on the town market only'); if (townIn(p.x, p.y)) log.market = (log.market || 0) + 1; }
    if (size === 1 && seed === 1) { const g = { cement: 0, alloy: 0, chip: 0 }; for (const r of T.r) for (const k in g) g[k] += r.g[k]; log.push(label + ': ' + T.r.length + ' buildings, ' + T.r.filter((r) => r.k === 'arcade').length + ' arcades, ' + T.r.filter((r) => r.sen).length + ' sentries, ' + T.r.filter((r) => r.cache).length + ' caches, ' + T.av.length + ' avenue tiles; salvage each side ' + JSON.stringify({ cement: Math.round(g.cement / players), alloy: Math.round(g.alloy / players), chip: Math.round(g.chip / players) })); }
    layouts++;
  }
  log.push(layouts + ' layouts fair and joined (2, 3 and 4 players); ' + (log.market || 0) + ' Trade Posts on a town market');
  // A Hauler can drive an avenue end to end (roads only), at plain road speed.
  newGame({ shape, size: 1, seed: 4, players: 2, murmur: 'off' });
  {
    const T = S.town, W = S.W, ends = T.av.filter((t) => ((t / W) | 0) === T.y0 || ((t / W) | 0) === T.y1).sort((a, b) => a - b);
    const a = ends[0], b = ends[ends.length - 1], p = findPath(a % W, (a / W) | 0, b % W, (b / W) | 0, undefined, { roadOnly: true });
    assert.ok(p && p.length >= T.y1 - T.y0, 'a Hauler drives the avenue end to end');
    assert.equal(PAVE[TOWN.avenue].speed, PAVE[1].speed, 'at plain road speed');
  }
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
  // ...and the Murmur: a sentry shoots a creature that comes near, and one clawing beside it wears its armour down.
  newGame({ shape, size: 1, seed: 5, players: 2, murmur: 'active' });
  {
    const g2 = S.town.r.find((q) => q.sen > 0 && q.y > S.H / 2), st2 = townStands(g2)[0], wo = wildOwner();
    const sc = addBot(wo, 'scuttler', st2 % S.W, (st2 / S.W) | 0), hp0 = sc.hp, sen0 = g2.sen;
    sc.x = (st2 % S.W) + 0.5; sc.y = ((st2 / S.W) | 0) + 0.5;
    const bru = addBot(wo, 'brute', st2 % S.W, (st2 / S.W) | 0);
    t0 = S.time;
    while (S.time < t0 + 6) { for (const u of [sc, bru]) if (!u.dead) { u.x = (st2 % S.W) + 0.5; u.y = ((st2 / S.W) | 0) + 0.5; u.task = null; u.path = null; } simStep(SIM_STEP); }
    assert.ok(sc.dead || sc.hp < hp0, 'the sentry shoots the Murmur');
    assert.ok(g2.sen < sen0, 'a creature beside it claws at the post');
    log.push('sentry vs the Murmur: a Scuttler beside it ' + (sc.dead ? 'shot dead' : 'hit') + ', its armour ' + sen0 + ' -> ' + g2.sen.toFixed(1) + ' in 6 s with a Brute and a Scuttler clawing at it');
  }
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
  const older = JSON.parse(saved); delete older.town.av; delete older.town.rad;
  deserializeGame(JSON.stringify(older)); // (a town saved before the avenues: loads as it was)
  assert.ok(S.town && !S.town.av, 'an older town loads');
  log.push('save round trip replays the same; a damaged town is refused; an older one loads');
  // 5) Rival against rival: do the games end?
  for (let n = 0; n < GAMES; n++) {
    if (ONLY >= 0 && n !== ONLY) continue;
    const seed = 101 + n * 17;
    const players = [2, 3, 4][n % 3];
    newGame({ seed, difficulty: 'normal', mode: 'versus', autoplay: true, shape, players, size: players === 2 ? 2 : 1, style: 'random', murmur: n % 2 ? 'active' : 'off', teams: players === 4 && n % 2 === 1 });
    const styles = S.players.filter((P) => !isWild(P.id)).map((P) => P.style).join(' v ');
    while (S.winner < 0 && S.time < MINS * 60) simStep(SIM_STEP);
    const avOwned = S.town.av.filter((t) => S.road[t] && wayOwner(t) >= 0).length, avLeft = S.town.av.filter((t) => S.road[t]).length;
    log.push('game seed ' + seed + ' ' + S.players.filter((P) => !isWild(P.id)).length + 'p' + (S.teams ? ' 2v2' : '') + ' ' + SIZE_PRESETS[S.settings.size].name + (S.wildlife ? ' Murmur' : '') + ' (' + styles + '): ' + (S.winner >= 0 ? 'won by ' + (S.teams ? 'team ' + S.teams[S.winner] + ' (P' + S.winner + ')' : 'P' + S.winner) + ' at ' + (S.time / 60).toFixed(1) + ' min' : 'no winner by ' + MINS + ' min') + '; stripped ' + S.town.r.filter((q) => q.gone).length + '/' + S.town.r.length + ' (' + S.players.filter((P) => !isWild(P.id)).map((P, k) => 'P' + k + ' ' + (P.stats.stripped || 0)).join(', ') + ' units), sentries left ' + S.town.r.filter((q) => !q.gone && q.sen > 0).length + '; avenue tiles ' + avLeft + '/' + S.town.av.length + ' still road, ' + avOwned + ' on colony land');
  }
  return log;
`)(assert, () => {}, games, mins, only);
for (const l of out) console.log(l);
console.log('city-test: ALL PASSED');

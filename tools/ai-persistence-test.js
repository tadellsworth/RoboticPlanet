// Rivals that keep fighting late: the four findings of the rival-persistence and Warlord-recovery audits of Nov 27 2026
// (docs/rival-persistence-review-nov27.md), each checked with the real AI routines on a real map.
//  1. A Smelter already loaded finishes its batch while the colony is out of Alloy, and takes in no more Fiber.
//  2. A march with no parts left on either side goes with the band the depleted-economy rule allows (an exposed
//     target), and not against a target heavy guns cover.
//  3. The weather's clock and the ground storm's four-minute wait are separate.
//  4. A Mine's site its robots won't go near, with nothing coming in, is given up and its spot avoided; one with goods
//     on the way, or under a threat that passes, keeps its place.
// node tools/ai-persistence-test.js
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const path = require('node:path');

const modules = ['util', 'defs', 'world', 'path', 'sim', 'ai', 'missions', 'orders', 'landmarks', 'city', 'walker', 'dam'];
const code = modules.map((name) => readFileSync(path.join(__dirname, '..', 'js', name + '.js'), 'utf8')).join('\n');
const run = () => new Function('assert', 'sfx', code + `
  // A fresh duel of two rivals on Standard (seed 11), no Murmur, no events.
  function duel(difficulty) {
    newGame({ shape: SHAPE_PRESETS.findIndex((p) => p.name === 'Standard'), seed: 11, players: 2, humans: [], mode: 'versus',
      difficulty: difficulty || 'normal', murmur: 'off', events: false });
  }
  // A free spot for a building of this type on p's land, within r tiles of its Command Base, road-linked to it.
  function spotFor(p, type, rmin, rmax) {
    const base = getE(S.players[p].lander);
    for (let r = rmin; r <= rmax; r++) for (let y = base.y - r; y <= base.y + r; y++) for (let x = base.x - r; x <= base.x + r; x++) {
      if (Math.max(Math.abs(x - base.x), Math.abs(y - base.y)) !== r || !inMap(x, y) || S.owner[tIdx(x, y)] !== p) continue;
      if (!canPlace(p, type, x, y, true).ok) continue;
      return { x, y };
    }
    return null;
  }
  function linked(p, b) { const road = roadRouteTo(p, b); if (road) for (const t of road) setRoad(t % S.W, (t / S.W) | 0, true, p); return roadLinked(getE(S.players[p].lander), b); }
  const tick = () => { S.tick += 15; }; // (a fresh danger map: see dangerMap)
  const out = {};

  // 1) The Smelter and the Fiber reserve.
  {
    duel('easy');
    const p = 1, base = getE(S.players[p].lander);
    for (const g of GOODS) base.stock[g] = 0;
    base.stock.cement = 20;
    for (const b of playerBuildings(p)) if (b.type === 'harvester') destroyBuilding(b, true);
    const at = spotFor(p, 'smelter', 3, 8);
    const sm = addBuilding(p, 'smelter', at.x, at.y, true);
    assert.ok(linked(p, sm));
    sm.stock.ore = 6; sm.stock.fiber = 6;
    // A site short of Fiber: the reserve stands for it.
    const st = spotFor(p, 'depot', 3, 10), site = placeSite(p, 'depot', st.x, st.y).building;
    S.time = 600;
    aiThink(p);
    out.drain = { paused: !!sm.paused, drain: !!sm.drain, asks: needsOf(sm).filter(([, n]) => n > 0).length };
    // With Alloy in hand the old rule stands: it rests for the Fiber.
    base.stock.alloy = 10;
    S.time += 3; aiThink(p);
    out.rest = { paused: !!sm.paused, drain: !!sm.drain };
    // Out of Alloy again but with nothing loaded: it rests too.
    base.stock.alloy = 0; sm.stock.ore = 1; sm.stock.fiber = 1;
    S.time += 3; aiThink(p);
    out.empty = { paused: !!sm.paused, drain: !!sm.drain };
    // Kept off with 3 to 5 Fiber in storage (it wakes at 6), loaded again: it finishes the batch too (Standard 7,
    // Settler: off for 45 minutes with six Ore and five Fiber in it and 3 Fiber in storage).
    base.stock.fiber = 4; sm.stock.ore = 6; sm.stock.fiber = 5;
    S.time += 3; aiThink(p);
    out.band = { paused: !!sm.paused, drain: !!sm.drain };
    // Its batch done, still short of Fiber: it rests again.
    sm.stock.ore = 0; sm.stock.fiber = 1;
    S.time += 3; aiThink(p);
    out.done = { paused: !!sm.paused, drain: !!sm.drain };
    out.siteWants = (siteCost(site).fiber || 0) > 0;
  }

  // 2) Finishing with no parts: four armed warbots against two, at the enemy Command Base (beyond attack range, across
  // the map), bare, and with heavy guns over it.
  const march = (guns) => {
    duel('normal');
    const p = 1, enemy = 0, P = S.players[p];
    for (const u of S.bots) if (!u.dead && isArmy(u)) killBot(u);
    const home = getE(P.lander), eb = getE(S.players[enemy].lander);
    let placed = 0;
    if (guns) for (let r = 2; r <= 6 && placed < guns; r++) for (let y = eb.y - r; y <= eb.y + r && placed < guns; y++) for (let x = eb.x - r; x <= eb.x + r && placed < guns; x++) {
      if (!inMap(x, y) || Math.max(Math.abs(x - eb.x), Math.abs(y - eb.y)) !== r || !canPlace(enemy, 'turret', x, y, true).ok) continue;
      const t = addBuilding(enemy, 'turret', x, y, true); t.stock.ammo = 20; placed++;
    }
    assert.equal(placed, guns);
    for (let k = 0; k < 4; k++) enterBuilding(addBot(p, 'warbot', home.x, home.y), home);
    for (let k = 0; k < 2; k++) addBot(enemy, 'warbot', eb.x + 2, eb.y + 2 + k);
    S.time = 3000; P.lastMarch = -999;
    const lvl = { ...aiLevel(p), threshold: Math.min(aiLevel(p).threshold, 2) }; // (a dead planet: see aiThink)
    const spare = aiSpare(p, eb, 'flag').n;
    const old = aiMarch(p, lvl, enemy, 4, 2, true, 0); // (as it was: the planner asked twice the enemy's army and two more)
    P.march = 0; P.massFor = null; P.lastMarch = -999;
    const sent = aiMarch(p, lvl, enemy, 4, 2, true, 4);
    const f = sent ? (P.fights || []).slice(-1)[0] : null;
    return { old, sent, spare, target: f ? (f.x === eb.x && f.y === eb.y ? 'base' : f.x + ',' + f.y) : null, n: f ? f.n : 0, guns: placed,
      far: Math.round(dist(home.x, home.y, eb.x, eb.y)) };
  };
  out.exposed = march(0);
  out.covered = march(4);

  // 3) Two clocks: the weather's (P.wxT) and the storm's wait for the enemy base (P.stormT).
  {
    duel('warlord');
    const p = 1, P = S.players[p];
    const lander = getE(P.lander), e = { type: 'atmos', id: -1, built: true, aeStage: 2, aeSrc: 1, aeStormT: -1e9, owner: p, x: lander.x, y: lander.y, stock: {}, inc: {} };
    S.time = 1800; P.stormT = 1700;
    aiAtmosStorm(p, e);
    S.time = 1830; aiAtmosStorm(p, e);
    out.clocks = { stormT: P.stormT, wxT: P.wxT };
  }

  // 4) Unsafe Mine sites.
  const hotMine = (how) => {
    duel('warlord');
    const p = 1, enemy = 0, P = S.players[p];
    for (const u of S.bots) if (!u.dead && isArmy(u)) killBot(u);
    const at = spotFor(p, 'mine', 4, 12) || spotFor(p, 'depot', 4, 12);
    const type = canPlace(p, 'mine', at.x, at.y, true).ok ? 'mine' : 'depot';
    const site = placeSite(p, type, at.x, at.y).building;
    assert.ok(site && linked(p, site));
    site.born = 0;
    const foes = [];
    const threat = () => { for (let k = 0; k < 3; k++) foes.push(addBot(enemy, 'warbot', site.x + 1.5, site.y + 0.5 + k)); };
    const calm = () => { for (const u of foes.splice(0)) killBot(u); };
    threat();
    S.time = 200; tick();
    out[how + 'Shunned'] = shunned(site);
    const seen = [];
    for (let t = 200; t <= 400; t += 2) {
      S.time = t; tick();
      if (how === 'brief' && t === 220) calm();
      if (how === 'brief' && t === 240) { site.stock.cement = (site.stock.cement || 0) + 1; } // (a delivery once it's safe)
      if (how === 'incoming') site.inc.cement = 1;
      aiHotSites(p, playerBuildings(p));
      if (t === 240) seen.push(aiHotStalled(P, site));
    }
    return { type, dead: !!site.dead, stalledAt40s: seen[0], avoid: (P.avoid || []).some((a) => a.x === site.x && a.y === site.y) };
  };
  out.stuck = hotMine('stuck');
  out.incoming = hotMine('incoming');
  out.brief = hotMine('brief');
  out.hash = hashState();
  return out;
`)(assert, () => {});

const a = run(), b = run();
assert.equal(a.hash, b.hash, 'deterministic');
// 1) Smelter
assert.deepEqual(a.drain, { paused: false, drain: true, asks: 0 }, 'a loaded Smelter finishes its batch, taking in nothing more');
assert.equal(a.siteWants, true);
assert.deepEqual(a.rest, { paused: true, drain: false }, 'with Alloy in hand it rests for the Fiber, as before');
assert.deepEqual(a.empty, { paused: true, drain: false }, 'with nothing loaded it rests');
assert.deepEqual(a.band, { paused: false, drain: true }, 'kept off below 6 Fiber, a loaded Smelter finishes its batch');
assert.deepEqual(a.done, { paused: true, drain: false }, 'and rests again once it is done');
// 2) March
assert.equal(a.exposed.old, false, 'the old floor sent nobody');
assert.equal(a.exposed.spare, 4);
assert.equal(a.exposed.sent, true, 'four against two march on an exposed Command Base with no parts on either side');
assert.equal(a.exposed.target, 'base');
assert.equal(a.exposed.n, 4);
assert.equal(a.covered.guns, 4);
assert.equal(a.covered.sent, false, 'but not on one heavy guns cover');
// 3) Clocks
assert.deepEqual(a.clocks, { stormT: 1700, wxT: 1800 }, 'weather looks leave the storm deadline alone');
// 4) Unsafe sites
for (const k of ['stuck', 'incoming', 'brief']) assert.equal(a[k + 'Shunned'], true, k + ': the site starts unsafe');
assert.equal(a.stuck.stalledAt40s, true, 'an unsafe stalled site is no answer to a shortage');
assert.equal(a.stuck.dead, true, 'and is given up');
assert.equal(a.stuck.avoid, true, 'its spot avoided');
assert.equal(a.incoming.dead, false, 'goods on the way keep it');
assert.equal(a.incoming.stalledAt40s, false);
assert.equal(a.brief.dead, false, 'a threat that passes keeps it');
console.log('Rival persistence: loaded Smelters finish, depleted marches go, two clocks, unsafe stalled sites give way.');

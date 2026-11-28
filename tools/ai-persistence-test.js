// Rivals that keep fighting late: the four findings of the rival-persistence and Warlord-recovery audits of Nov 27 2026
// (docs/rival-persistence-review-nov27.md), each checked with the real AI routines on a real map.
//  1. A Smelter already loaded finishes its batch while the colony is out of Alloy, and takes in no more Fiber.
//  2. A march with no parts left on either side goes with the band the depleted-economy rule allows (an exposed
//     target), and not against a target heavy guns cover.
//  3. The weather's clock and the ground storm's four-minute wait are separate.
//  4. A Mine's site its robots won't go near, with nothing coming in, is given up and its spot avoided; one with goods
//     on the way, or under a threat that passes, keeps its place.
// And the three stalls it left open (the follow-up of the same day):
//  5. Robots that don't fight turn back only from where the Murmur bite: a way that grazes the padded ring round a
//     nest's guards goes on (GUARD_BITE); a gatherer that turns back on its way out waits longer each time in a row and
//     passes over that node (GATHER_SHY); a rival with a small army still sends two warbots against a lone Murmur that
//     keeps its gatherers in (aiRoadGuard).
//  6. A road planned over ground its Workers won't pave is planned again round it (aiRoadDetour), or, with no way round,
//     its site is given up; Workers pave the padded ring round a nest's guards.
//  7. A rival in triage keeps a few Haulers for its economy, and replaces one when goods wait with none free; and a
//     Hauler with no safe way to storage doesn't close it to the others.
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

  // 5) Where the Murmur bite.
  {
    newGame({ shape: SHAPE_PRESETS.findIndex((q) => q.name === 'Standard'), seed: 11, players: 2, humans: [], mode: 'versus',
      difficulty: 'easy', murmur: 'active', events: false });
    const p = 1, P = S.players[p], base = getE(P.lander), wild = S.players.findIndex((q) => isWild(q.id));
    const nest = getE(49);
    assert.ok(nest && isNestB(nest) && S.bots.some((v) => !v.dead && v.nest === nest.id && nestGuarding(v)));
    tick();
    const m = dangerMap(p);
    const ring = tIdx(nest.x, nest.y - 4), core = tIdx(nest.x, nest.y - 2); // (4 and 2 tiles from its middle)
    out.ring = [m[ring] & 2, m[ring] & 4, hotFor(p, ring), paveHot(p, ring)];
    out.core = [m[core] & 2, m[core] & 4, paveHot(p, core)];
    // A worker on its way home whose way runs over the ring, then one whose way runs into the core.
    let covers = 0;
    const cover = takeCover;
    takeCover = (u, caught) => { covers++; return cover(u, caught); };
    const w = addBot(p, 'worker', nest.x - 3.5, nest.y - 5.5);
    const walk = (to) => { w.task = { type: 'home', bld: base.id }; w.path = [tIdx(nest.x - 2, nest.y - 5), tIdx(nest.x - 1, nest.y - 4), to, tIdx(nest.x + 1, nest.y - 5)]; w.pi = 0; w.shyUntil = 0; w.coverT = 0; foeSweep(); };
    walk(ring);
    out.ringCovers = covers;
    walk(core);
    out.coreCovers = covers;
    takeCover = cover;
    killBot(w);
    // A Harvester's worker that turns back on its way out to a grove, from a lone Scuttler.
    const at = spotFor(p, 'harvester', 3, 8), hv = addBuilding(p, 'harvester', at.x, at.y, true);
    const node = tIdx(at.x + 2, at.y + 2);
    const sc = addBot(wild, 'scuttler', at.x + 4.5, at.y + 4.5);
    const g = addBot(p, 'worker', at.x + 1.5, at.y + 1.5);
    const out1 = () => { g.task = { type: 'staff', bld: hv.id, phase: 'toNode', node, wait: 0, timer: 0, trip: true, lay: -1 }; S.resRes[node] = 1; g.path = [node]; g.pi = 0; };
    S.time = 900; out1(); takeCover(g, false);
    out.shy1 = { wait: Math.round(hv.gatherWait - S.time), n: hv.gshyN, node: shyNode(hv, node), shy: murmurShy(hv), freed: S.resRes[node] };
    S.time = 900 + 6; out1(); takeCover(g, false);
    out.shy2 = { wait: Math.round(hv.gatherWait - S.time), n: hv.gshyN, shy: murmurShy(hv) };
    // ...it waits inside for that long
    g.task = { type: 'staff', bld: hv.id, phase: 'in', node: -1, wait: 0, timer: 0, trip: false }; g.path = null; enterBuilding(g, hv);
    doStaff(g, g.task, 0.1);
    out.waits = { phase: g.task.phase, status: /turned back/.test(hv.status || '') };
    // A small army: two of its four armed warbots go for the lone Scuttler; not for a nest's guards.
    for (const u of S.bots) if (!u.dead && u.owner === p && isArmy(u)) killBot(u);
    for (let k = 0; k < 4; k++) enterBuilding(addBot(p, 'warbot', base.x, base.y), base);
    out.guard = aiRoadGuard(p, false);
    out.squad = P.roadRally ? rallyMembers(P.roadRally.id).length : 0;
    // (with the Scuttler gone and the spot by the nest, among its guards: no squad for a small army)
    if (P.roadRally) { recallRally(P.roadRally.id); P.roadRally = null; }
    hv.shyX = nest.x; hv.shyY = nest.y - 1; killBot(sc);
    out.guardNest = aiRoadGuard(p, false);
  }

  // 6) A road planned under an enemy gun.
  const detour = (how) => {
    duel('normal');
    const p = 1, enemy = 0, P = S.players[p], base = getE(P.lander);
    for (const u of S.bots) if (!u.dead && isArmy(u)) killBot(u);
    base.stock.cement = 400;
    // A Depot site some way off, its road planned (not laid), and a loaded enemy Pulse Turret by the middle of it.
    let site = null, plan = null;
    // (its land stretched to 16 tiles round its Command Base, as Outposts would, and the spot there whose road is
    // longest, up to 16 tiles)
    for (let y = base.y - 16; y <= base.y + 16; y++) for (let x = base.x - 16; x <= base.x + 16; x++) if (inMap(x, y) && S.owner[tIdx(x, y)] < 0) S.owner[tIdx(x, y)] = p;
    let far = null, fl = 0;
    for (let y = base.y - 14; y <= base.y + 14; y += 2) for (let x = base.x - 14; x <= base.x + 14; x += 2) {
      if (!inMap(x, y) || S.owner[tIdx(x, y)] !== p || !canPlace(p, 'depot', x, y, true).ok) continue;
      const res = placeSite(p, 'depot', x, y);
      if (!res || !res.ok) continue;
      const route = roadRouteTo(p, res.building);
      if (route && route.length > fl && route.length <= 16) { fl = route.length; far = { x, y }; }
      demolish(res.building);
    }
    if (far && fl >= 12) { site = placeSite(p, 'depot', far.x, far.y).building; plan = roadRouteTo(p, site).slice(); }
    assert.ok(site, 'a site with a long road');
    for (const t of plan) buildRoad(p, t % S.W, (t / S.W) | 0);
    assert.ok(plan.every((t) => S.plan[t] === p + 1));
    site.born = 0;
    const mid = plan[plan.length >> 1], mx = mid % S.W, my = (mid / S.W) | 0;
    if (how === 'gun') {
      // (off to one side of it: covering part of the road, not the site, with a way round on the other side)
      let gun = null;
      for (let r = 3; r <= 9 && !gun; r++) for (let dy = -r; dy <= r && !gun; dy++) for (let dx = -r; dx <= r && !gun; dx++) {
        const x = mx + dx, y = my + dy;
        if (Math.max(Math.abs(dx), Math.abs(dy)) !== r || !inMap(x, y) || S.bAt[tIdx(x, y)] || S.plan[tIdx(x, y)] || !walkable(tIdx(x, y))) continue;
        const g = addBuilding(enemy, 'turret', x, y, true);
        g.stock.crystal = 40; g.shots = 10;
        tick();
        const alt = roadRouteTo(p, site, false, true);
        if (plan.some((t) => paveHot(p, t)) && !shunned(site) && alt && alt.length + alt.planned.length <= plan.length * AI_ROAD_DETOUR.most + AI_ROAD_DETOUR.extra &&
          !alt.some((t) => paveHot(p, t)) && !alt.planned.some((t) => paveHot(p, t))) gun = g;
        else destroyBuilding(g, true);
      }
      assert.ok(gun, 'a gun by the road');
    } else {
      // Its robots were shot down by the site: nowhere near it is paved, and no way round.
      P.danger = [{ x: site.x, y: site.y, until: 1e9, n: 1 }];
    }
    tick();
    const hot = plan.filter((t) => paveHot(p, t));
    const shunnedSite = shunned(site);
    S.time = 300; aiRoads(p, playerBuildings(p));
    const early = plan.filter((t) => S.plan[t] === p + 1).length;
    S.time = 300 + AI_ROAD_DETOUR.wait + 1; tick(); aiRoads(p, playerBuildings(p));
    const after = site.dead ? null : roadRouteTo(p, site);
    const res = { hot: hot.length, shunnedSite, kept: early === plan.length, dead: !!site.dead,
      cancelled: hot.filter((t) => S.plan[t] !== p + 1).length, safeNow: !!after && !after.planned.some((t) => paveHot(p, t)) && !after.some((t) => paveHot(p, t)) };
    if (how !== 'gun') { S.time = 300 + AI_HOT_SITE.stall + 1; tick(); aiRoads(p, playerBuildings(p)); res.deadLater = !!site.dead; res.avoid = (P.avoid || []).some((a) => a.x === site.x && a.y === site.y); }
    return res;
  };
  out.detour = detour('gun');
  out.noWay = detour('danger');

  // 7) Haulers in triage.
  {
    duel('warlord');
    const p = 1, P = S.players[p], base = getE(P.lander);
    const at = spotFor(p, 'foundry', 3, 10);
    const fd = addBuilding(p, 'foundry', at.x, at.y, true);
    linked(p, fd);
    const mines = [];
    for (let k = 0; k < 8; k++) { const m = spotFor(p, 'harvester', 3, 14); if (m) mines.push(addBuilding(p, 'harvester', m.x, m.y, true)); }
    const haulers = S.bots.filter((u) => !u.dead && u.owner === p && u.type === 'hauler');
    for (const u of haulers.slice(1)) killBot(u);
    const workers = S.bots.filter((u) => !u.dead && u.owner === p && u.type === 'worker');
    for (const u of workers.slice(4)) killBot(u);
    S.time = 600;
    const me = () => playerBuildings(p), kinds = () => { const k = {}; for (const u of S.bots) if (!u.dead && u.owner === p) k[u.type] = (k[u.type] || 0) + 1; return k; };
    out.triage1 = aiTriageHaulers(p, me(), kinds(), 8); // one Hauler, nine buildings making goods: short of the floor
    aiThink(p);
    out.triageOrder = { few: !!P.triage, mode: fd.mode, hauler: fd.orders && fd.orders.hauler };
    // three Haulers: the floor met; two Harvesters full and every Hauler busy: one more
    for (let k = 0; k < 2; k++) addBot(p, 'hauler', base.x + 0.5, base.y + 0.5);
    for (const u of S.bots) if (!u.dead && u.owner === p && u.type === 'hauler') u.task = { type: 'haul', phase: 'toSrc', src: base.id, dst: base.id, good: 'ore' };
    out.triage3 = aiTriageHaulers(p, me(), kinds(), 8);
    mines[0].stock.fiber = 99; mines[1].stock.fiber = 99;
    out.triageFull = aiTriageHaulers(p, me(), kinds(), 8);
    for (const u of S.bots) if (!u.dead && u.owner === p && u.type === 'hauler') { u.task = null; break; }
    out.triageIdle = aiTriageHaulers(p, me(), kinds(), 8);
    out.triageCap = aiTriageHaulers(p, me(), kinds(), 3);
    // A Hauler cut off from the Command Base by guns waits on its own; the base stays open to the others.
    const cut = S.bots.find((u) => !u.dead && u.owner === p && u.type === 'hauler');
    base.unreachUntil = 0;
    noSafeRoute(cut, tIdx(base.x, base.y));
    out.cutOff = { base: base.unreachUntil > S.time, self: cut.failGoal === tIdx(base.x, base.y) && cut.failUntil > S.time };
  }
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
// 5) Where the Murmur bite
assert.deepEqual(a.ring.map(Boolean), [true, false, true, false], 'the padded ring round a nest\'s guards: kept off, not where they bite, paved');
assert.deepEqual(a.core.map(Boolean), [true, true, true], 'where they bite: kept off, and not paved');
assert.equal(a.ringCovers, 0, 'a way over the ring goes on');
assert.equal(a.coreCovers, 1, 'a way into where they bite turns back');
assert.deepEqual(a.shy1, { wait: 5, n: 1, node: true, shy: false, freed: 0 }, 'a gatherer turned back waits, and passes over the node');
assert.deepEqual(a.shy2, { wait: 10, n: 2, shy: true }, 'the next turn-back in a row waits twice as long; two in a row: the Murmur keep its gatherers in');
assert.deepEqual(a.waits, { phase: 'in', status: true }, 'its worker waits inside, and says why');
assert.equal(a.guard, true, 'a small army sends a squad against a lone Scuttler');
assert.equal(a.squad, 2, 'two warbots');
assert.equal(a.guardNest, false, 'but not against a nest\'s guards');
// 6) Roads under guns
assert.ok(a.detour.hot > 0, 'some of the planned road is under the gun');
assert.equal(a.detour.shunnedSite, false, 'the site itself is not');
assert.equal(a.detour.kept, true, 'a moment under the gun changes nothing');
assert.equal(a.detour.cancelled, a.detour.hot, 'then the tiles under it are called off');
assert.equal(a.detour.safeNow, true, 'and the road planned round it');
assert.equal(a.detour.dead, false);
assert.ok(a.noWay.hot > 0);
assert.equal(a.noWay.dead, false, 'with no way round, the site waits a while');
assert.equal(a.noWay.deadLater, true, 'then is given up');
assert.equal(a.noWay.avoid, true, 'and its spot avoided');
// 7) Haulers in triage
assert.equal(a.triage1, true, 'one Hauler for nine buildings that make goods is too few');
assert.deepEqual(a.triageOrder, { few: true, mode: 'worker', hauler: 1 }, 'triage orders a Hauler with one left');
assert.equal(a.triage3, false, 'three are enough while nothing waits');
assert.equal(a.triageFull, true, 'goods waiting with every Hauler busy: one more');
assert.equal(a.triageIdle, false, 'not with one free');
assert.equal(a.triageCap, false, 'never past what the colony wants');
assert.deepEqual(a.cutOff, { base: false, self: true }, 'a Hauler cut off from storage waits on its own; storage stays open to the rest');
console.log('Rival persistence: loaded Smelters finish, depleted marches go, two clocks, unsafe stalled sites give way, workers pass the guards\' ring and back off, roads go round guns, triage keeps its Haulers.');

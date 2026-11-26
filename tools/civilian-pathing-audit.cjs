// Deterministic route tests for construction Workers and ground carriers.
const { readFileSync } = require('node:fs');
const path = require('node:path');
const { runInNewContext } = require('node:vm');
const assert = require('node:assert/strict');

const files = ['util', 'defs', 'world', 'path', 'sim', 'ai', 'missions', 'orders'];
const source = files.map((name) => readFileSync(path.join(__dirname, '..', 'js', name + '.js'), 'utf8')).join('\n');
runInNewContext(source + `
  function reset() {
    newGame({ seed: 43199, mode: 'versus', size: 1, murmur: 'off' });
    S.time = 100;
    S.buildings.length = S.bots.length = S.posts.length = 0;
    S.byId.clear();
    S.terrain.fill(T_GROUND); S.elev.fill(0); S.ramp.fill(0); S.res.fill(0);
    S.bAt.fill(0); S.road.fill(0); S.plan.fill(0); S.owner.fill(-1); S.zone.fill(0);
    S.players[0].lander = addBuilding(0, 'lander', 5, 32, true).id;
  }
  const armGun = () => {
    const gun = addBuilding(1, 'turret', 16, 22, true);
    gun.stock.crystal = 10;
    updateDanger();
  };
  const road = (x, y) => setRoad(x, y, true, 0);
  for (const type of ['worker', 'hauler', 'truck', 'tanker', 'roadtrain']) {
    reset();
    for (let x = 5; x <= 30; x++) road(x, 20);
    const u = addBot(0, type, 5, 20);
    u.task = { type: 'haul', phase: 'toDst' };
    assert.ok(goTo(u, 30, 20));
    armGun();
    const hot = (p) => p.some((t) => gunCovers(0, t));
    assert.ok(hot(u.path), type + ' route predates the gun');
    if (type !== 'worker') {
      assert.equal(routeCheck(u), false, type + ' waits if every road is covered');
      assert.equal(u.path, null);
    }
    for (let x = 5; x <= 30; x++) road(x, 12);
    for (let y = 12; y < 20; y++) { road(5, y); road(30, y); }
    u.task = { type: 'haul', phase: 'toDst' };
    u.failUntil = 0;
    assert.ok(goTo(u, 30, 20), type + ' finds a route round the gun');
    assert.ok(!hot(u.path));
    console.log(type + ': safe detour, ' + u.path.length + ' steps');
  }
  {
    reset();
    for (let x = 5; x <= 30; x++) road(x, 20);
    const truck = addBot(0, 'truck', 5, 20);
    truck.task = { type: 'home', bld: S.players[0].lander };
    assert.ok(goTo(truck, 30, 20));
    armGun();
    assert.equal(routeCheck(truck), false, 'return to parking also stops if the road becomes unsafe');
    assert.equal(truck.path, null);
    console.log('A truck returning to park stops when a turret covers its only remaining route.');
  }
  {
    reset();
    for (let x = 5; x <= 30; x++) setRail(tIdx(x, 20), true, 0);
    const train = addBot(0, 'freight', 5, 20);
    const src = addBuilding(0, 'station', 5, 21, true), dst = addBuilding(0, 'station', 30, 21, true);
    src.stock.alloy = 10;
    assert.ok(assignHaul(train, src, dst, 'alloy', 5));
    train.carry = 'alloy'; train.carryN = 5; train.task.phase = 'toDst';
    src.res.alloy = 0; src.stock.alloy = 5;
    assert.ok(goTo(train, dst.x, dst.y));
    armGun();
    assert.ok(railRoute(train, dst.x, dst.y, undefined, null).some((t) => gunCovers(0, t)));
    assert.equal(railRoute(train, dst.x, dst.y), null);
    dangerSweep();
    assert.equal(trainRouteCheck(train), false);
    assert.equal(train.task, null);
    assert.equal(train.path, null);
    assert.equal(train.carryN, 5);
    assert.equal(dst.inc.alloy || 0, 0);
    assert.equal(assignHaul(train, src, dst, 'alloy', 3), false);
    assert.equal(src.res.alloy || 0, 0);
    assert.ok(!(dst.unreachUntil > S.time), 'blocked rail does not close station to road freight');
    for (let x = 5; x <= 30; x++) setRail(tIdx(x, 12), true, 0);
    for (let y = 12; y < 20; y++) { setRail(tIdx(5, y), true, 0); setRail(tIdx(30, y), true, 0); }
    train.failUntil = 0;
    assert.ok(goTo(train, dst.x, dst.y));
    assert.ok(train.path.every((t) => !gunCovers(0, t)));
    console.log('A loaded train stops and keeps its cargo, then accepts a safe track detour.');
  }
  {
    reset();
    for (let y = 10; y <= 25; y++) road(10, y);
    for (let y = 10; y <= 30; y++) road(15, y);
    for (let x = 10; x <= 15; x++) road(x, 10);
    const src = addBuilding(0, 'lander', 16, 25, true), dst = addBuilding(0, 'depot', 16, 30, true);
    S.players[0].lander = src.id;
    src.stock.alloy = 30;
    dst.keep = { alloy: 2 };
    const near = addBot(0, 'hauler', 10, 25), far = addBot(0, 'hauler', 15, 17);
    const eta = [near, far].map((u) => cargoPickupTime(u, src));
    assert.ok(dist(near.x, near.y, src.x + 0.5, src.y + 0.5) < dist(far.x, far.y, src.x + 0.5, src.y + 0.5));
    assert.ok(eta[0] > 3 * eta[1], JSON.stringify(eta));
    dispatch(0);
    assert.equal(far.task?.src, src.id);
    assert.equal(far.task?.dst, dst.id);
    assert.ok(near.task?.type !== 'haul');
    console.log('Dispatch selects the quicker pickup: ' + eta.map((t) => t.toFixed(1)).join(' vs ') + ' estimated seconds.');
  }
  {
    reset();
    for (let y = 2; y < 42; y++) S.terrain[tIdx(20, y)] = T_WATER;
    S.elev[tIdx(22, 20)] = 1;
    const ramp = addBuilding(0, 'ramp', 21, 20, false);
    Object.assign(ramp.stock, BDEFS.ramp.cost);
    const near = addBot(0, 'worker', 18, 20), far = addBot(0, 'worker', 28, 20);
    computeZones();
    const nearest = rampApproach(near, ramp).steps, across = rampApproach(far, ramp).steps;
    assert.deepEqual([nearest, across], [40, 8]);
    dispatch(0);
    assert.equal(ramp.builder, far.id);
    cancelTask(far);
    assert.equal(callBuilder(0, ramp).u, far);
    console.log('Ramp worker choices: ' + nearest + ' versus ' + across + ' steps; automatic and manual orders use the short route.');
  }
`, { assert, console, sfx() {} });

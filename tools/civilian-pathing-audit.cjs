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
    armGun();
    const route = railRoute(train, 30, 20);
    assert.ok(route?.some((t) => gunCovers(0, t)));
    console.log('Audit limitation: Freight Train routing can plot a route through turret coverage.');
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

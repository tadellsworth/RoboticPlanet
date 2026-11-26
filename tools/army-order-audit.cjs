// Regression checks for the order-routing findings in docs/army-order-pathing-audit.md.
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
    S.buildings.length = S.bots.length = S.rallies.length = S.posts.length = 0;
    S.byId.clear();
    S.terrain.fill(T_GROUND); S.elev.fill(0); S.ramp.fill(0); S.res.fill(0);
    S.bAt.fill(0); S.road.fill(0); S.plan.fill(0); S.owner.fill(-1); S.zone.fill(0);
    SHIELDS.length = 0;
  }
  const unit = (p, x, y, type = 'warbot') => addBot(p, type, x, y);
  const command = (ids, spec) => applyOrder(0, 'command', [ids, spec]);
  {
    reset();
    const u = unit(0, 12, 20), rival = unit(1, 23, 20);
    const hunter = unit(0, 11, 20);
    assert.equal(command([u.id, hunter.id], { foe: rival.id }).n, 2);
    const huntFlag = rallyById(hunter.task.rally);
    const move = command([u.id], { i: 23, j: 21 });
    const flag = rallyById(u.task.rally);
    assert.equal(move.n, 1);
    assert.notEqual(flag.id, huntFlag.id);
    rival.x += 4;
    followRallies();
    assert.deepEqual([flag.x, flag.y], [23.5, 21.5]);
    assert.deepEqual([huntFlag.x, huntFlag.y, huntFlag.follow], [27.5, 20.5, rival.id]);
    console.log('Move holds its exact destination while the other Warbot continues its Hunt.');
  }
  {
    reset();
    for (let y = 0; y < S.H; y++) S.terrain[tIdx(20, y)] = T_WATER;
    computeZones();
    const u = unit(0, 17, 20), rival = unit(1, 23, 20);
    const target = addBuilding(1, 'depot', 24, 21, true);
    const outpost = addBuilding(0, 'outpost', 24, 23, true);
    const reachable = unit(0, 24, 19);
    command([u.id], { i: 16, j: 20 });
    const original = u.task;
    const move = command([u.id], { i: 23, j: 21 });
    const hunt = command([u.id], { foe: rival.id });
    const attack = command([u.id], { b: target.id });
    const station = command([u.id], { b: outpost.id });
    for (const r of [move, hunt, attack, station]) assert.deepEqual([r.n, r.blocked], [0, 1]);
    assert.equal(u.task, original);
    assert.equal(outpost.garInc, 0);
    const mixed = command([u.id, reachable.id], { b: outpost.id });
    assert.deepEqual([mixed.n, mixed.blocked, outpost.garInc], [1, 1, 1]);
    assert.equal(u.task, original);
    assert.equal(reachable.task.bld, outpost.id);
    const railgunner = unit(0, 19, 21, 'railgunner');
    const shoreTarget = addBuilding(1, 'depot', 21, 21, true);
    assert.equal(command([railgunner.id], { b: shoreTarget.id }).n, 1);
    assert.equal(railgunner.task.target, shoreTarget.id);
    console.log('Unreachable orders retain old jobs; mixed orders send reachable units and in-range shots still work.');
  }
  {
    reset();
    const w = unit(0, 25, 25, 'bulwark'), u = unit(0, 26, 26);
    u.x = 26.1; u.y = 26.1;
    const foe = unit(1, 26, 25);
    foe.x = 26.3; foe.y = 25.5;
    w.sh = BULWARK.shield; w.shAim = 0;
    SHIELDS.push(w);
    shieldCovers(w);
    assert.equal(w.covIds.size, 0);
    const start = [u.x, u.y];
    for (let k = 0; k < BULWARK.coverMax; k++) unit(0, 25, 25);
    shieldCovers(w);
    assert.equal(w.covIds.size, BULWARK.coverMax);
    assert.equal(firingCover(u, foe.x, foe.y, WARBOT_RANGE, SIM_STEP), false);
    assert.deepEqual([u.x, u.y], start);
    for (const v of S.bots) if (v !== u && v !== w && v.owner === 0) v.dead = true;
    shieldCovers(w);
    assert.equal(shieldProtects(w, u, foe.x, foe.y), false);
    assert.equal(firingCover(u, foe.x, foe.y, WARBOT_RANGE, SIM_STEP), true);
    assert.notDeepEqual([u.x, u.y], start);
    console.log('A Warbot moves into available firing cover and declines a full shield.');
  }
  {
    reset();
    const squad = Array.from({ length: 12 }, () => unit(0, 10, 20));
    const u = squad[0], start = u.x, dest = 24;
    const nativePath = findPath, searches = [];
    findPath = (...args) => { searches.push(args.slice(0, 4)); return nativePath(...args); };
    const move = command(squad.map((v) => v.id), { i: dest, j: 20 });
    assert.equal(move.n, 12);
    for (const v of squad) updateWarbot(v, SIM_STEP);
    const firstSearches = searches.filter((q) => q.join(',') === '10,20,24,20').length;
    assert.equal(firstSearches, 1);
    let reversals = 0;
    for (let k = 0; k < 600 && Math.floor(u.x) !== dest; k++) {
      const x = u.x;
      S.tick++; S.time += SIM_STEP;
      updateWarbot(u, SIM_STEP);
      if (u.x < x - 1e-6) reversals++;
    }
    findPath = nativePath;
    assert.equal(Math.floor(u.x), dest);
    assert.equal(reversals, 0);
    console.log('Open-ground control:', squad.length, 'units shared', firstSearches, 'initial route search;',
      'first unit advanced', (u.x - start).toFixed(1), 'tiles with', reversals, 'backward steps.');
  }
`, { assert, console, sfx() {} });

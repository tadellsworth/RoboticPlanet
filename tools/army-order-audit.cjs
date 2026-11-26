// Reproduce the order-routing findings in docs/army-order-pathing-audit.md on the audited revision.
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
    assert.equal(command([u.id], { foe: rival.id }).n, 1);
    const move = command([u.id], { i: 23, j: 21 });
    const flag = rallyById(u.task.rally);
    assert.equal(move.n, 1);
    assert.equal(flag.follow, rival.id);
    rival.x += 4;
    followRallies();
    assert.deepEqual([flag.x, flag.y], [27.5, 20.5]);
    console.log('Ground move to (23,21) reported success but inherited the hunt and moved to (27,20).');
  }
  {
    reset();
    for (let y = 0; y < S.H; y++) S.terrain[tIdx(20, y)] = T_WATER;
    computeZones();
    const u = unit(0, 17, 20), rival = unit(1, 23, 20);
    const target = addBuilding(1, 'depot', 24, 21, true);
    const outpost = addBuilding(0, 'outpost', 24, 23, true);
    const move = command([u.id], { i: 23, j: 21 });
    const hunt = command([u.id], { foe: rival.id });
    const attack = command([u.id], { b: target.id });
    const station = command([u.id], { b: outpost.id });
    assert.deepEqual([move.n, move.blocked, hunt.n, attack.n, station.n], [0, 1, 1, 1, 1]);
    updateWarbot(u, SIM_STEP);
    assert.equal(u.task, null);
    assert.equal(outpost.garInc, 0);
    console.log('Across water with no crossing: Move rejected; Hunt, Attack and Station each reported one unit sent.');
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
    assert.equal(firingCover(u, foe.x, foe.y, WARBOT_RANGE, SIM_STEP), false);
    // Same geometry, with an available shield slot granted for the proposed position.
    w.covIds.add(u.id);
    assert.equal(firingCover(u, foe.x, foe.y, WARBOT_RANGE, SIM_STEP), true);
    console.log('An empty Bulwark shield has a reachable firing position, but current membership blocks the move.');
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

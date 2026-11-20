// Headless checks for player recycling, rival selection, reservations and deterministic timing.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const files = ['util', 'defs', 'world', 'path', 'sim', 'ai', 'missions', 'orders', 'lockstep'];
const source = files.map((file) => fs.readFileSync(path.join(__dirname, '..', 'js', file + '.js'), 'utf8')).join('\n');
vm.runInNewContext(source + `
  const dt = 1 / 30;
  function setup() {
    newGame({ seed: 27, size: 0, rough: 0, humans: [0, 1], murmur: 'off' });
    const base = getE(S.players[0].lander);
    const y = base.y - 3, x = base.x;
    for (let i = x - 3; i <= x + 4; i++) {
      const t = tIdx(i, y);
      S.terrain[t] = T_GROUND; S.elev[t] = 0;
      S.res[t] = 0; S.amt[t] = 0;
      S.zone[t] = S.zone[tIdx(base.x, base.y)];
      setRoad(i, y, true, 0);
    }
    const foundry = addBuilding(0, 'foundry', x + 3, y, true);
    const farther = addBuilding(0, 'foundry', x - 3, y, true);
    foundry.mode = farther.mode = 'off';
    return { base, x, y, foundry, farther };
  }

  function finish(u, limit = 500) {
    let arrived = null;
    for (let tick = 1; tick <= limit; tick++) {
      S.tick++; S.time += dt;
      if (isArmy(u)) updateWarbot(u, dt); else updateWorker(u, dt);
      if (arrived === null && recyclingNow(u)) arrived = tick;
      if (u.dead) return { arrived, tick };
    }
    assert.fail('Recycle order did not finish');
  }

  function playerOrder(kind, alloy, chip, ticks) {
    const { x, y, foundry, farther } = setup();
    const u = addBot(0, kind, x + 1, y);
    assert.equal(typeof applyOrder(1, 'recycle', [[u.id]], 1), 'string');
    assert.equal(recycling(u), false);
    assert.equal(applyOrder(0, 'recycle', [[u.id]], 0), 1);
    assert.equal(u.task.bld, foundry.id);
    assert.equal(foundry.stock.alloy || 0, 0);
    assert.equal(applyOrder(0, 'unrecycle', [u.id], 0), true);
    assert.equal(recycling(u), false);
    assert.equal(applyOrder(0, 'recycle', [u.id], 0), 1);
    const { arrived, tick } = finish(u);
    assert.ok(arrived > 1);
    assert.equal(tick - arrived, ticks);
    assert.equal(foundry.stock.alloy || 0, alloy);
    assert.equal(foundry.stock.chip || 0, chip);
    assert.equal(supplyOf(foundry, 'alloy'), alloy);
    assert.equal(supplyOf(foundry, 'chip'), chip);
    assert.equal(farther.stock.alloy || 0, 0);
    assert.equal(getE(u.id), null);
    assert.equal(S.players[0].stats.recycled, 1);
    for (const b of S.buildings) if (b !== foundry) b.stock.alloy = 0;
    assert.equal(takeGood(0, 'alloy', alloy), true);
    foundry.stock.alloy = 1; // a normal production input is not itself a refund
    assert.equal(supplyOf(foundry, 'alloy'), 0);
    return [arrived, tick, hashState()];
  }

  const worker = playerOrder('worker', 1, 0, 60);
  const truck = playerOrder('truck', 1, 1, 120);
  const bulwark = playerOrder('bulwark', 2, 1, 180);
  {
    const { x, y, foundry } = setup();
    const pod = addBot(0, 'magpod', x, y);
    assert.equal(typeof applyOrder(0, 'recycle', [[pod.id]]), 'string');
    assert.equal(recycling(pod), false);
    const drone = addBot(0, 'worker', x + 1, y);
    const pathfinder = findPath;
    findPath = (sx, sy, gx, gy, ...rest) => gx === foundry.x && gy === foundry.y ? null : pathfinder(sx, sy, gx, gy, ...rest);
    assert.equal(applyOrder(0, 'recycle', [[drone.id]]), 1);
    assert.notEqual(drone.task.bld, foundry.id);
    findPath = pathfinder;
  }
  console.log('PASS owned recycle orders, cancellation, reachable Foundry, exact refunds and arrival timing');

  {
    const { x, y, foundry } = setup();
    S.players[0].ai = true;
    S.bots = [];
    S.time = 200;
    const workers = Array.from({ length: 14 }, () => addBot(0, 'worker', x + 1, y));
    const [loading, fighting, waiting, aboard, dropping, riding, staffing, old, ...recent] = workers;
    loading.carry = 'alloy'; loading.carryN = 1;
    fighting.fight = 1;
    waiting.ferryWait = { at: 0, ferry: 0 };
    aboard.ferryWait = { at: 0, ferry: 100 };
    dropping.dropping = 1;
    riding.ride = tIdx(x, y);
    staffing.task = { type: 'staff', bld: foundry.id };
    const train = addBot(0, 'freight', x + 1, y);
    old.idleSince = 1;
    recent.forEach((u) => { u.idleSince = 199; });
    const use = { worker: 3, hauler: 4, tanker: 0, truck: 0, roadtrain: 0 };
    const context = { me: [foundry], room: 20, use };
    aiScrap(0, context);
    assert.deepEqual(workers.filter(recycling).map((u) => u.id), [old.id]);
    assert.equal(recycling(train), false);
    S.time += 121;
    for (let i = 0; i < 3; i++) aiScrap(0, context);
    const onLand = workers.filter((u) => !u.ferryWait && !u.dropping && !(u.ride >= 0));
    assert.equal(onLand.filter((u) => !recycling(u)).length, use.worker + AI_SCRAP.workers);
  }
  console.log('PASS rivals recycle only long-idle surplus Workers and preserve the builder reserve');

  {
    const { x, y, foundry, farther } = setup();
    const worker = addBot(0, 'worker', x + 2, y);
    const tile = tIdx(x + 1, y);
    foundry.staff = worker.id; foundry.staffInc = worker.id;
    worker.task = { type: 'staff', bld: foundry.id, node: tile };
    S.resRes[tile] = 1;
    assert.equal(applyOrder(0, 'recycle', [[worker.id]]), 1);
    assert.equal(foundry.staff, 0);
    assert.equal(foundry.staffInc, 0);
    assert.equal(S.resRes[tile], 0);
    finish(worker);
    const hauler = addBot(0, 'hauler', x + 1, y);
    foundry.res.alloy = farther.inc.alloy = 1;
    hauler.task = { type: 'haul', src: foundry.id, dst: farther.id, good: 'alloy', phase: 'toSrc', n: 1 };
    assert.equal(applyOrder(0, 'recycle', [[hauler.id]]), 1);
    assert.equal(foundry.res.alloy || 0, 0);
    assert.equal(farther.inc.alloy || 0, 0);
    finish(hauler);
    const gun = addBot(0, 'rocket', x + 2, y);
    const carrier = addBot(0, 'hauler', x + 1, y);
    farther.res.ammo = 1;
    carrier.task = { type: 'arty', gun: gun.id, src: farther.id, phase: 'toSrc', n: 1 };
    assert.equal(applyOrder(0, 'recycle', [[gun.id]]), 1);
    assert.equal(carrier.task, null);
    assert.equal(farther.res.ammo || 0, 0);
  }
  console.log('PASS staff, resource claims and both kinds of Hauler reservations are released');

  assert.deepEqual(playerOrder('worker', 1, 0, 60), worker);
  assert.deepEqual(playerOrder('truck', 1, 1, 120), truck);
  assert.deepEqual(playerOrder('bulwark', 2, 1, 180), bulwark);
  console.log('PASS repeatable refund, dismantling tick and state hash');
  function receivedOrder(me) {
    const { x, y, foundry } = setup();
    const u = addBot(0, 'worker', x + 1, y);
    mpStart({ me, humans: [0, 1], send() {} });
    MP.packets.set(0, new Map([[0, [['recycle', [[u.id]], 1]]]]));
    assert.equal(mpBeginTurn(), true);
    while (!recyclingNow(u)) { S.tick++; S.time += dt; updateWorker(u, dt); assert.ok(S.tick < 500); }
    const save = serializeGame(), id = u.id, f = foundry.id;
    const elapsed = finish(u);
    const hash = hashState();
    deserializeGame(save);
    assert.deepEqual(finish(getE(id)), elapsed);
    assert.equal(hashState(), hash);
    assert.equal(getE(f).stock.alloy, 1);
    MP.on = false;
    return hash;
  }
  assert.equal(receivedOrder(0), receivedOrder(1));
  console.log('PASS the same lockstep packet and saved order give both peers the same refund and hash');

`, { assert, console, sfx() {} });

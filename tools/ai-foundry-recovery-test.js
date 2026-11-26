// Exercise Foundry supply with the real freight dispatcher and an isolated Hauler.
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const path = require('node:path');

const modules = ['util', 'defs', 'world', 'path', 'sim', 'ai', 'missions', 'orders', 'landmarks', 'city', 'walker', 'dam'];
const code = modules.map((name) => readFileSync(path.join(__dirname, '..', 'js', name + '.js'), 'utf8')).join('\n');
const scenario = new Function('assert', 'sfx', code + `
  return (ai, localHauler, workers) => {
    newGame({ seed: 25, mode: 'versus', players: 2, humans: [0], murmur: 'off', events: false });
    S.players[0].ai = ai;
    const base = getE(S.players[0].lander);
    let foundry;
    for (let y = base.y - 8; y <= base.y + 8 && !foundry; y++) for (let x = base.x - 8; x <= base.x + 8; x++) {
      if (!inMap(x, y) || S.owner[tIdx(x,y)] !== 0 || S.bAt[tIdx(x,y)] || !walkable(tIdx(x,y)) || S.road[tIdx(x,y)]) continue;
      const distance = dist2(base.x, base.y, x, y);
      if (distance < 9 || distance > 36) continue;
      const b = addBuilding(0, 'foundry', x, y, true);
      const road = roadRouteTo(0, b);
      if (!road) { demolish(b); continue; }
      for (const t of road) setRoad(t % S.W, (t / S.W) | 0, true, 0);
      foundry = b;
      break;
    }
    assert.ok(foundry && roadLinked(base, foundry));
    foundry.mode = 'warbot';
    foundry.stock.alloy = 3;
    foundry.staff = addBot(0, 'worker', foundry.x, foundry.y).id;
    const operator = getE(foundry.staff);
    enterBuilding(operator, foundry);
    operator.task = {type:'staff', bld:foundry.id};
    for (const u of playerBots(0)) if (!isArmy(u) && u !== operator) killBot(u);
    const available = Array.from({length:workers}, () => addBot(0, 'worker', base.x, base.y));
    for (const worker of available) enterBuilding(worker, base);
    const enemy = getE(S.players[1].lander);
    const hauler = addBot(0, 'hauler', enemy.x, enemy.y);
    enterBuilding(hauler, localHauler ? base : enemy);
    assert.equal(haulRoadConnected(hauler, base, foundry), localHauler);
    base.stock.chip = 3;
    dispatch(0);
    return {worker:available.some(u => u.task?.dst === foundry.id && u.task.good === 'chip' && u.task.n === 1),
      hauler:hauler.task?.dst === foundry.id, hash:hashState()};
  };
`)(assert, () => {});
const recovery = scenario(true, false, 2);
assert.equal(recovery.worker, true);
assert.equal(recovery.hauler, false);
assert.deepEqual(scenario(true, false, 2), recovery);
assert.equal(scenario(true, false, 1).worker, false);
assert.equal(scenario(false, false, 2).worker, false);
assert.equal(scenario(true, true, 2).hauler, true);
assert.equal(scenario(true, true, 2).worker, false);
console.log('Rival Foundries can recover with a nearby spare Worker if their road network has no hauler.');

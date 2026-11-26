// Run the actual dispatch and reloading code with one hauler and competing Alloy demand.
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const path = require('node:path');

const modules = ['util', 'defs', 'world', 'path', 'sim', 'ai', 'missions', 'orders', 'landmarks', 'city', 'walker', 'dam'];
const code = modules.map((name) => readFileSync(path.join(__dirname, '..', 'js', name + '.js'), 'utf8')).join('\n');
const scenario = new Function('assert', 'sfx', code + `
  return (ai, dry, ammo) => {
    newGame({ seed: 25, mode: 'versus', players: 2, humans: [0], murmur: 'off', events: false });
    S.players[0].ai = ai;
    const base = getE(S.players[0].lander);
    const army = playerBots(0).filter(isArmy);
    assert.equal(army.length, 4);
    army.forEach((u, i) => { u.ammo = i < dry ? 0 : botMag(u.type); });
    const sites = ['foundry', 'armory'].map((type) => {
      for (let y = base.y - 8; y <= base.y + 8; y++) for (let x = base.x - 8; x <= base.x + 8; x++) {
        if (!inMap(x, y) || S.owner[tIdx(x, y)] !== 0 || S.bAt[tIdx(x, y)] || !walkable(tIdx(x, y)) || S.road[tIdx(x, y)]) continue;
        if (dist2(base.x, base.y, x, y) < 9) continue;
        const b = addBuilding(0, type, x, y, true);
        const road = roadRouteTo(0, b);
        if (!road) { demolish(b); continue; }
        for (const t of road) setRoad(t % S.W, (t / S.W) | 0, true, 0);
        return b;
      }
      throw new Error('No connected ' + type);
    });
    const [foundry, plant] = sites;
    foundry.mode = 'worker';
    foundry.prio = 'high';
    foundry.stock.chip = 8;
    plant.prio = 'low';
    plant.stock.cement = 8;
    plant.stock.ammo = ammo;
    base.stock.alloy = 8;
    base.stock.ammo = 0;
    for (const u of playerBots(0)) if (!isArmy(u)) killBot(u);
    const carrier = addBot(0, 'hauler', base.x, base.y);
    enterBuilding(carrier, base);
    dispatch(0);
    return { destination: getE(carrier.task?.dst)?.type, n: carrier.task?.n, good: carrier.task?.good, hash: hashState() };
  };
`)(assert, () => {});

const emergency = scenario(true, 4, 0);
assert.equal(emergency.destination, 'armory');
assert.equal(emergency.good, 'alloy');
assert.equal(emergency.n, 1, 'prioritize just one batch');
assert.deepEqual(scenario(true, 4, 0), emergency, 'same seed makes the same dispatch and hash');
assert.equal(scenario(true, 3, 0).destination, 'foundry');
assert.equal(scenario(false, 4, 0).destination, 'foundry');
const reload = scenario(true, 4, 6);
assert.equal(reload.destination, 'lander');
assert.equal(reload.good, 'ammo');
console.log('Rival Ammo recovery prioritizes supplies and first reloads. Normal and human dispatch stay unchanged.');

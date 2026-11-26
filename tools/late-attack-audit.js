// Trace late-game attacks and production in a deterministic Versus match.
// TERRAFALL_ECONOMY_TRACE=1 adds one-minute factory input and staffing observations.
// TERRAFALL_ECONOMY_LOSS=colony:building:minute optionally simulates one targeted building loss.
// node tools/late-attack-audit.js Standard 25 4 75 [git-ref|-] [difficulty] [rival-doctrine] [hold-after-min]
const { execFileSync } = require('node:child_process');
const { readFileSync } = require('node:fs');
const path = require('node:path');

const [shape, seedArg, playersArg, minutesArg, revision, difficulty = 'normal', doctrine = 'balanced', holdArg = '0'] = process.argv.slice(2);
const seed = Number(seedArg), players = Number(playersArg), minutes = Number(minutesArg);
if (!shape || !Number.isInteger(seed) || seed < 0 || seed > 0xffffffff || ![2, 4].includes(players) ||
    !Number.isFinite(minutes) || minutes <= 0) {
  throw new Error('Use: node tools/late-attack-audit.js MAP SEED 2|4 MINUTES [git-ref|-] [difficulty] [rival-doctrine] [hold-after-min]');
}
const ref = revision === '-' ? null : revision;
const holdAfter = Number(holdArg);
const root = path.join(__dirname, '..');
const read = (file) => ref ? execFileSync('git', ['show', ref + ':' + file], { cwd: root, encoding: 'utf8', maxBuffer: 4e6 }) :
  readFileSync(path.join(root, file), 'utf8');
const modules = ['util', 'defs', 'world', 'path', 'sim', 'ai', 'missions', 'orders', 'landmarks', 'city', 'walker', 'dam'];
const source = modules.map((name) => read('js/' + name + '.js')).join('\n');
const game = new Function('sfx', source + `
  return ({ shape, seed, players, minutes, difficulty, doctrine, holdAfter, detail, economy, loss }) => {
    const shapeId = SHAPE_PRESETS.findIndex((p) => p.name.toLowerCase() === shape.toLowerCase());
    if (shapeId < 0) throw new Error('Unknown map ' + shape);
    if (!DIFFICULTY[difficulty] || !isDoctrine(doctrine) || !Number.isFinite(holdAfter) || holdAfter < 0 || (holdAfter && players !== 2)) throw new Error('Invalid scenario');
    newGame({ shape: shapeId, seed, players, humans: [], mode: 'versus', difficulty, style: doctrine,
      nuke: true, mega: true, events: false, murmur: 'active', victory: 'capture' });
    S.watch = true;
    const intervention = loss && /^([1-4]):(mine|smelter|charger|fab):([1-9][0-9]*)$/.exec(loss);
    if (loss && (!intervention || Number(intervention[1]) > players || Number(intervention[3]) >= minutes)) throw new Error('Invalid economic setback');
    const lossTick = intervention ? Math.round(Number(intervention[3]) * 60 / SIM_STEP) : -1;
    let setback = null;
    // Trace successful decisions from the running simulation. Samples do not issue orders.
    const events = [], strikes = Array.from({ length: players }, () => 0);
    const contacts = Array.from({ length: players }, () => []);
    const launch = sendAttack, march = aiMarch, hit = hitBuilding;
    let thinking = -1;
    const think = aiThink;
    aiThink = (p) => {
      thinking = p;
      const old = S.players[p].raid;
      think(p);
      if (S.players[p].raid && S.players[p].raid !== old) events.push({ p: p + 1, at: round(S.time), kind: 'raid' });
      thinking = -1;
    };
    sendAttack = (...args) => {
      const n = launch(...args);
      if (n && thinking === args[0]) events.push({ p: thinking + 1, at: round(S.time), kind: 'attack', n, target: args[1].type });
      return n;
    };
    aiMarch = (...args) => {
      const p = args[0], P = S.players[p], result = march(...args);
      if (result) events.push({ p: p + 1, at: round(S.time), kind: P.stormOn ? 'storm' : 'march',
        n: rallyMembers(P.march).length, enemy: args[2] + 1 });
      return result;
    };
    hitBuilding = (b, dmg, by, src) => {
      if (by >= 0 && by < players && b.owner >= 0 && b.owner < players && foes(by, b.owner) && dmg > 0) {
        strikes[by]++;
        if (detail) {
          const runs = contacts[by], last = runs[runs.length - 1], at = round(S.time);
          if (last && at - last.end <= 1) { last.end = at; last.hits++; }
          else runs.push({ start: at, end: at, hits: 1 });
        }
      }
      hit(b, dmg, by, src);
    };
    const size = SIZE_PRESETS[S.settings.size].name;
    function round(seconds) { return +(seconds / 60).toFixed(2); }
    const colonies = () => S.players.slice(0, players);
    const built = () => colonies().map((p) => p.stats.built);
    const snapshot = () => ({
      at: round(S.time), built: built(),
      alive: colonies().flatMap((p) => {
        const base = getE(p.lander);
        if (!base || base.dead || base.owner !== p.id) return [];
        const army = S.bots.filter((u) => !u.dead && u.owner === p.id && isArmy(u));
        const buildings = playerBuildings(p.id).filter((b) => b.built);
        const foundries = buildings.filter((b) => b.type === 'foundry');
        const inputs = foundries.map((b) => {
          const parts = ['alloy', 'chip'];
          const nearby = new Set(buildingGroups(b));
          const connected = buildings.filter((s) => s === b || buildingGroups(s).some((group) => nearby.has(group)));
          return { x: b.x, y: b.y, mode: b.mode, staffed: !!b.staff,
            hopper: parts.map((g) => b.stock[g] || 0), incoming: parts.map((g) => b.inc[g] || 0),
            stockOnNetwork: parts.map((g) => connected.reduce((n, s) => n + supplyOf(s, g), 0)) };
        });
        const goods = playerGoods(p.id);
        const enemy = rivalOf(p.id), target = enemy >= 0 ? getE(S.players[enemy].lander) : null;
        return { colony: p.id + 1, buildings: built()[p.id], army: army.length, garrisoned: army.filter((u) => u.inside).length,
          armed: army.filter(botArmed).length, produced: Object.entries(p.madeBots).reduce((n, [k, v]) => n + (BOTS[k]?.army ? v : 0), 0),
          ...(detail ? {
            pressure: {
              produced: ['crystal', 'chip', 'alloy', 'ammo'].map(g => p.made?.[g] || 0),
              used: ['crystal', 'chip', 'alloy', 'ammo'].map(g => p.used?.[g] || 0),
              smelters: buildings.filter(b => b.type === 'smelter').map(b => ({
                status: b.status, ore: b.stock.ore || 0, fiber: b.stock.fiber || 0, alloy: b.stock.alloy || 0,
              })),
              armoryParts: buildings.filter(b => b.type === 'armory').map(b => [b.stock.alloy || 0, b.inc.alloy || 0, b.stock.cement || 0, b.inc.cement || 0, b.stock.ammo || 0]),
              trade: buildings.filter(b => b.type === 'terminal').map(b => ({ route: b.route && { ...b.route }, runs: b.runs || 0, status: b.status })),
              fieldOrders: army.filter(u => !u.inside && botArmed(u)).map(u => [u.id, u.task?.type || 'idle', u.task?.rally || u.task?.bot || u.task?.bld || 0]),
            },
          } : {}),
          ammo: goods.ammo || 0, armories: buildings.filter((b) => b.type === 'armory').map((b) => b.status || ''),
          unarmedInDryGarrison: army.filter((u) => !botArmed(u) && u.inside && !(getE(u.inside)?.stock.ammo > 0)).length,
          ore: goods.ore || 0, alloy: goods.alloy || 0, chip: goods.chip || 0, hit: strikes[p.id],
          ...(economy ? {
            economy: {
              goods: Object.fromEntries(['ore', 'alloy', 'crystal', 'chip', 'fuel', 'cement'].map(g => [g, goods[g] || 0])),
              made: { ...p.made },
              buildings: buildings.filter(b => ['mine', 'smelter', 'tap', 'fab', 'foundry', 'armory', 'charger', 'kiln', 'farm', 'refinery'].includes(b.type))
                .map(b => {
                  const nearby = new Set(buildingGroups(b));
                  const connected = buildings.filter(source => source !== b && buildingGroups(source).some(group => nearby.has(group)));
                  const required = Object.keys(BDEFS[b.type].inp || (b.type === 'charger' ? { fuel: 1 } : {}));
                  const oreSources = b.type === 'smelter' && (b.stock.ore || 0) < BDEFS.smelter.inp.ore
                    ? buildings.filter(source => supplyOf(source, 'ore') > 0).map(source => {
                      const onNetwork = connected.includes(source);
                      const carrier = { type: 'hauler', owner: p.id, x: source.x + 0.5, y: source.y + 0.5, inside: source.id, bat: 100 };
                      return { type: source.type, x: source.x, y: source.y, amount: supplyOf(source, 'ore'), onNetwork,
                        dangerous: shunned(source), reachable: reachable(source),
                        deliveryPath: onNetwork && Number.isFinite(cargoPickupTime(carrier, b)) };
                    }) : [];
                  return { id: b.id, type: b.type, x: b.x, y: b.y, status: b.status, staffed: !!b.staff, paused: !!b.paused,
                    cut: !!b.cut, danger: shunned(b), oreSources, stock: { ...b.stock }, incoming: { ...b.inc },
                    supply: Object.fromEntries(required.map(g => [g, [
                      connected.reduce((n, source) => n + Math.max(0, supplyOf(source, g)), 0),
                      connected.reduce((n, source) => n + (shunned(source) || !reachable(source) ? 0 : Math.max(0, supplyOf(source, g))), 0),
                    ]])) };
                }),
            },
          } : {}),
          inputs, foundries: foundries.map((b) => b.status || (b.paused ? 'Paused' : '')),
          goal: p.massFor?.until > S.time ? p.massFor.need : 0,
          spareAtBase: target && !target.dead ? aiSpare(p.id, target, 'flag').n : null,
          homeThreat: p.homeCall > S.time, routeZone: target ? homeZone(p.id) === homeZone(enemy) : null };

      }),
    });
    const checkpoints = [];
    const checkEvery = economy || detail ? 1 : 5;
    let nextCheck = checkEvery;
    const cap = Math.round(minutes * 60 / SIM_STEP), holdTick = Math.round(holdAfter * 60 / SIM_STEP);
    while (S.winner < 0 && S.tick < cap) {
      // A defensive proxy keeps its economy and local defence. The other colony runs its regular AI.
      if (holdTick && S.tick === holdTick && !S.players[0].out) {
        S.players[0].passive = true;
        events.push({ p: 1, at: round(S.time), kind: 'hold' });
      }
      if (S.tick === lossTick) {
        const owner = Number(intervention[1]) - 1, type = intervention[2];
        const target = playerBuildings(owner).find(b => b.built && b.type === type);
        if (target) destroyBuilding(target);
        setback = { colony: owner + 1, type, at: round(S.time), id: target?.id ?? null };
      }
      simStep(SIM_STEP);
      if (S.tick === Math.round(nextCheck * 60 / SIM_STEP)) { checkpoints.push(snapshot()); nextCheck += checkEvery; }
    }
    if (S.winner >= 0 && snapshot().alive.length !== 1) throw new Error('Capture ended before only one colony remained');
    return {
      shape, size, seed, players, difficulty, doctrine, holdAfter, events, ...(loss ? { setback } : {}), ...(detail ? { contacts } : {}), winner: S.winner < 0 ? null : S.winner + 1, time: round(S.time), built: built(), checkpoints,
      end: snapshot().alive, eliminations: (S.log || []).filter((e) => e.k === 'out').map((e) => [e.p + 1, round(e.t)]),
      megastructuresSeized: colonies().map((p) => p.stats.megaSeized || 0), maglevRaids: colonies().map((p) => p.magCuts || 0),
    };
  };
`)(() => {});
console.log(JSON.stringify({ ref: ref || 'working tree', ...game({ shape, seed, players, minutes, difficulty, doctrine, holdAfter, detail: process.env.TERRAFALL_PRESSURE_TRACE === '1', economy: process.env.TERRAFALL_ECONOMY_TRACE === '1', loss: process.env.TERRAFALL_ECONOMY_LOSS }) }));

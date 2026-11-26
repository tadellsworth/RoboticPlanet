// Trace late-game attacks and production in a deterministic Versus match.
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
  return ({ shape, seed, players, minutes, difficulty, doctrine, holdAfter }) => {
    const shapeId = SHAPE_PRESETS.findIndex((p) => p.name.toLowerCase() === shape.toLowerCase());
    if (shapeId < 0) throw new Error('Unknown map ' + shape);
    if (!DIFFICULTY[difficulty] || !isDoctrine(doctrine) || !Number.isFinite(holdAfter) || holdAfter < 0 || (holdAfter && players !== 2)) throw new Error('Invalid scenario');
    newGame({ shape: shapeId, seed, players, humans: [], mode: 'versus', difficulty, style: doctrine,
      nuke: true, mega: true, events: false, murmur: 'active', victory: 'capture' });
    S.watch = true;
    // Trace successful decisions from the running simulation. Samples do not issue orders.
    const events = [], strikes = Array.from({ length: players }, () => 0);
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
      if (by >= 0 && by < players && b.owner >= 0 && b.owner < players && foes(by, b.owner) && dmg > 0) strikes[by]++;
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
          ammo: goods.ammo || 0, armories: buildings.filter((b) => b.type === 'armory').map((b) => b.status || ''),
          unarmedInDryGarrison: army.filter((u) => !botArmed(u) && u.inside && !(getE(u.inside)?.stock.ammo > 0)).length,
          ore: goods.ore || 0, alloy: goods.alloy || 0, chip: goods.chip || 0, hit: strikes[p.id],
          inputs, foundries: foundries.map((b) => b.status || (b.paused ? 'Paused' : '')),
          goal: p.massFor?.until > S.time ? p.massFor.need : 0,
          spareAtBase: target && !target.dead ? aiSpare(p.id, target, 'flag').n : null,
          homeThreat: p.homeCall > S.time, routeZone: target ? homeZone(p.id) === homeZone(enemy) : null };

      }),
    });
    const checkpoints = [];
    let nextCheck = 5;
    const cap = Math.round(minutes * 60 / SIM_STEP), holdTick = Math.round(holdAfter * 60 / SIM_STEP);
    while (S.winner < 0 && S.tick < cap) {
      // A defensive proxy keeps its economy and local defence. The other colony runs its regular AI.
      if (holdTick && S.tick === holdTick && !S.players[0].out) {
        S.players[0].passive = true;
        events.push({ p: 1, at: round(S.time), kind: 'hold' });
      }
      simStep(SIM_STEP);
      if (S.tick === Math.round(nextCheck * 60 / SIM_STEP)) { checkpoints.push(snapshot()); nextCheck += 5; }
    }
    if (S.winner >= 0 && snapshot().alive.length !== 1) throw new Error('Capture ended before only one colony remained');
    return {
      shape, size, seed, players, difficulty, doctrine, holdAfter, events, winner: S.winner < 0 ? null : S.winner + 1, time: round(S.time), built: built(), checkpoints,
      end: snapshot().alive, eliminations: (S.log || []).filter((e) => e.k === 'out').map((e) => [e.p + 1, round(e.t)]),
      megastructuresSeized: colonies().map((p) => p.stats.megaSeized || 0), maglevRaids: colonies().map((p) => p.magCuts || 0),
    };
  };
`)(() => {});
console.log(JSON.stringify({ ref: ref || 'working tree', ...game({ shape, seed, players, minutes, difficulty, doctrine, holdAfter }) }));

// Run one default Versus computer-only game at a fixed revision.
// node tools/ai-baseline-audit.js "Long haul" 21 2 20 [git-ref]
const { execFileSync } = require('node:child_process');
const { readFileSync } = require('node:fs');
const path = require('node:path');

const [shape, seedArg, playersArg, minutesArg, ref] = process.argv.slice(2);
const seed = Number(seedArg), players = Number(playersArg), minutes = Number(minutesArg);
if (!shape || !Number.isInteger(seed) || seed < 0 || seed > 0xffffffff || ![2, 4].includes(players) ||
    !Number.isFinite(minutes) || minutes <= 0) {
  throw new Error('Use: node tools/ai-baseline-audit.js MAP SEED 2|4 MINUTES [git-ref]');
}
const root = path.join(__dirname, '..');
const read = (file) => ref ? execFileSync('git', ['show', ref + ':' + file], { cwd: root, encoding: 'utf8', maxBuffer: 4e6 }) :
  readFileSync(path.join(root, file), 'utf8');
const modules = ['util', 'defs', 'world', 'path', 'sim', 'ai', 'missions', 'orders', 'landmarks', 'city', 'walker', 'dam'];
const source = modules.map((name) => read('js/' + name + '.js')).join('\n');
const game = new Function('sfx', source + `
  return ({ shape, seed, players, minutes }) => {
    const shapeId = SHAPE_PRESETS.findIndex((p) => p.name.toLowerCase() === shape.toLowerCase());
    if (shapeId < 0) throw new Error('Unknown map ' + shape);
    newGame({ shape: shapeId, seed, players, humans: [], mode: 'versus', difficulty: 'normal', style: 'balanced',
      nuke: true, mega: true, events: false, murmur: 'active', victory: 'capture' });
    S.watch = true; // play on when the first colony falls
    if (nColonies() !== players || S.players.slice(0, players).some((p) => !p.ai || p.style !== 'balanced')) {
      throw new Error('The requested computer-only matchup could not be created');
    }
    const size = SIZE_PRESETS[S.settings.size].name;
    const round = (n) => +(n / 60).toFixed(2);
    const colonies = () => S.players.slice(0, players);
    const built = () => colonies().map((p) => p.stats.built);
    const snapshot = () => ({
      at: round(S.time), built: built(),
      alive: colonies().flatMap((p) => {
        const base = getE(p.lander);
        if (!base || base.dead || base.owner !== p.id) return [];
        const army = S.bots.filter((u) => !u.dead && u.owner === p.id && isArmy(u)).length;
        const goods = playerGoods(p.id);
        const lastHit = Math.max(-1, ...Object.values(p.hitBy || {}));
        return [{ colony: p.id + 1, baseArmor: Math.round(base.armor), army, ore: Math.floor(goods.ore || 0),
          alloy: Math.floor(goods.alloy || 0), chip: Math.floor(goods.chip || 0), lastHit: lastHit < 0 ? null : round(lastHit) }];
      }),
    });
    const checkpoints = [];
    let nextCheck = 45;
    while (S.winner < 0 && S.tick < Math.round(minutes * 60 / SIM_STEP)) {
      simStep(SIM_STEP);
      if (S.tick === Math.round(nextCheck * 60 / SIM_STEP)) { checkpoints.push(snapshot()); nextCheck += 10; }
    }
    if (S.winner >= 0 && snapshot().alive.length !== 1) throw new Error('Capture ended before only one colony remained');
    return {
      shape, size, seed, players, winner: S.winner < 0 ? null : S.winner + 1, time: round(S.time), built: built(), checkpoints,
      end: snapshot().alive, eliminations: (S.log || []).filter((e) => e.k === 'out').map((e) => [e.p + 1, round(e.t)]),
      megastructuresSeized: colonies().map((p) => p.stats.megaSeized || 0), maglevRaids: colonies().map((p) => p.magCuts || 0),
    };
  };
`)(() => {});
console.log(JSON.stringify({ ref: ref || 'working tree', ...game({ shape, seed, players, minutes }) }));

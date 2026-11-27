// Where the Chips and Crystal go: one computer-only Versus game traced every 5 minutes (docs/economy-audit-nov26.md).
// node tools/economy-audit.js MAP SEED 2|4 MINUTES [doctrines] [git-ref]
//   doctrines: a comma list, one per colony (balanced, turtle, raider, rusher, tycoon); default all balanced.
// Prints one JSON line: the winner and time, and every 5 minutes for each colony its Chip and Crystal stock, made and
// used (used split by the function that spent it), its Crystal Taps and how many are dry, its Chip Fabs and what they
// wait for, the Crystal left in its land and in no one's land, and what its Trade Terminal and the market brought in.
// TERRAFALL_MD=1 adds each colony's Mass Driver lines (shots, goods thrown, Fuel stock).
const { execFileSync } = require('node:child_process');
const { readFileSync } = require('node:fs');
const path = require('node:path');

const [shape, seedArg, playersArg, minutesArg, docArg, ref] = process.argv.slice(2);
const seed = Number(seedArg), players = Number(playersArg), minutes = Number(minutesArg);
if (!shape || !Number.isInteger(seed) || ![2, 4].includes(players) || !Number.isFinite(minutes) || minutes <= 0) {
  throw new Error('Use: node tools/economy-audit.js MAP SEED 2|4 MINUTES [doctrines] [git-ref]');
}
const doctrines = docArg && docArg !== '-' ? docArg.split(',') : Array(players).fill('balanced');
const root = path.join(__dirname, '..');
const read = (file) => ref ? execFileSync('git', ['show', ref + ':' + file], { cwd: root, encoding: 'utf8', maxBuffer: 4e6 }) :
  readFileSync(path.join(root, file), 'utf8');
const modules = ['util', 'defs', 'world', 'path', 'sim', 'ai', 'missions', 'orders', 'landmarks', 'city', 'walker', 'dam'];
const source = modules.map((name) => read('js/' + name + '.js')).join('\n');
const game = new Function('sfx', source + `
  return ({ shape, seed, players, minutes, doctrines, md }) => {
    const shapeId = SHAPE_PRESETS.findIndex((p) => p.name.toLowerCase() === shape.toLowerCase());
    if (shapeId < 0) throw new Error('Unknown map ' + shape);
    if (doctrines.length !== players || !doctrines.every(isDoctrine)) throw new Error('Doctrines: one per colony');
    newGame({ shape: shapeId, seed, players, humans: [], mode: 'versus', difficulty: 'normal', style: 'balanced',
      nuke: true, mega: true, events: false, murmur: 'active', victory: 'capture' });
    S.watch = true;
    doctrines.forEach((k, p) => {
      const P = S.players[p], was = PERSONALITIES[P.style]?.econ || 1;
      P.mult = P.mult / was * (PERSONALITIES[k].econ || 1);
      P.style = k;
    });
    const WATCH = { chip: 1, crystal: 1, alloy: 1, fuel: 1, ore: 1 };
    const sinks = S.players.slice(0, players).map(() => ({ chip: {}, crystal: {}, alloy: {}, fuel: {}, ore: {} }));
    const was = usedGood;
    usedGood = function (owner, g, n) {
      if (WATCH[g] && sinks[owner]) {
        const line = (new Error().stack.split('\\n')[2] || '').trim().split(' ')[1] || '?';
        sinks[owner][g][line] = (sinks[owner][g][line] || 0) + n;
      }
      return was(owner, g, n);
    };
    const round = (n) => +(n / 60).toFixed(2);
    const own = (p) => S.buildings.filter((b) => !b.dead && b.owner === p);
    // Crystal and Ore left in the ground: in each colony's land, and in no one's ([players]).
    const groundIn = (r) => {
      const by = new Array(players + 1).fill(0);
      for (let t = 0; t < S.W * S.H; t++) if (S.res[t] === r && S.amt[t] > 0) {
        const o = S.owner[t];
        by[o >= 0 && o < players ? o : players] += S.amt[t];
      }
      return by;
    };
    const tally = (list) => { const o = {}; for (const b of list) { const k = (b.status || '').slice(0, 40); o[k] = (o[k] || 0) + 1; } return o; };
    const look = () => {
      const cr = groundIn(R_CRYSTAL), ore = groundIn(R_ORE);
      return S.players.slice(0, players).map((P, p) => {
        const bl = own(p), g = playerGoods(p);
        const taps = bl.filter((b) => b.type === 'tap' && b.built), fabs = bl.filter((b) => b.type === 'fab' && b.built);
        const why = tally(fabs), fdy = tally(bl.filter((b) => b.type === 'foundry' && b.built));
        const out = {
          alive: !!(getE(P.lander) && !getE(P.lander).dead && getE(P.lander).owner === p),
          stock: { chip: g.chip || 0, crystal: g.crystal || 0, alloy: g.alloy || 0, fuel: g.fuel || 0, ore: g.ore || 0, fiber: g.fiber || 0 },
          made: Object.fromEntries(['chip', 'crystal', 'alloy', 'fuel', 'ore', 'fiber'].map((k) => [k, Math.round(P.made[k] || 0)])),
          mines: bl.filter((b) => b.type === 'mine' && b.built).length, mineWhy: tally(bl.filter((b) => b.type === 'mine')), tapWhy: tally(bl.filter((b) => b.type === 'tap')), smelters: tally(bl.filter((b) => b.type === 'smelter' && b.built)), oreOwn: ore[p],
          harvesters: bl.filter((b) => b.type === 'harvester' && b.built).length,
          bots: S.bots.filter((u) => !u.dead && u.owner === p && !isArmy(u)).reduce((o, u) => (o[u.type] = (o[u.type] || 0) + 1, o), {}),
          staffed: bl.filter((b) => BDEFS[b.type].staff && !BDEFS[b.type].crew && b.built).length, saving: P.saveStart ? Math.round(S.time - P.saveStart) : 0, feed: !!P.feedMissiles, fmode: bl.filter((b) => b.type === 'foundry' && b.built).map((b) => b.mode + (b.paused ? ' paused' : '')).join(','), stats: { lost: P.stats.lost, killed: P.stats.killed }, sites: bl.filter((b) => !b.built).map((b) => b.type).join(','),
          used: { chip: Math.round((P.used && P.used.chip) || 0), crystal: Math.round((P.used && P.used.crystal) || 0) },
          taps: taps.length, dryTaps: taps.filter((b) => /left in reach/.test(b.status || '')).length,
          fabs: fabs.length, fabWhy: why, foundry: fdy,
          crystalOwn: cr[p], army: S.bots.filter((u) => !u.dead && u.owner === p && isArmy(u)).length,
          bld: bl.filter((b) => b.built).length, terminal: bl.filter((b) => b.type === 'terminal' && b.built).map((b) => (b.route ? b.route.give + '>' + b.route.get : '-') + ' runs ' + (b.runs || 0)).join(' '),
          outposts: bl.filter((b) => b.type === 'outpost' && b.built).length,
        };
        if (md) out.md = bl.filter((b) => (b.type === 'mdriver' || b.type === 'catcher') && b.built).map((b) => ({ type: b.type, sent: b.mdSent || 0, got: b.mdGot || 0, status: (b.status || '').slice(0, 50) }));
        return out;
      }).concat([{ crystalFree: cr[players], oreFree: ore[players] }]);
    };
    const points = [];
    const cap = Math.round(minutes * 60 / SIM_STEP);
    const alive = () => S.players.slice(0, players).filter((P, p) => { const b = getE(P.lander); return b && !b.dead && b.owner === p; }).length;
    while (S.tick < cap) {
      simStep(SIM_STEP);
      if (S.winner >= 0 && (players === 2 || alive() <= 1)) break;
      if (S.tick % Math.round((+process.env.TERRAFALL_EVERY || 300) / SIM_STEP)) continue;
      points.push({ at: Math.round(S.time / 60), colonies: look() });
    }
    const sinkOut = sinks.map((s) => Object.fromEntries(Object.entries(s).map(([g, o]) => [g, Object.fromEntries(Object.entries(o).sort((a, b) => b[1] - a[1]).slice(0, 10).map(([k, v]) => [k, Math.round(v)]))])));
    return { shape, seed, doctrines, winner: S.winner < 0 ? null : S.winner + 1, time: round(S.time), points, end: look(), sinks: sinkOut };
  };
`)(() => {});
console.log(JSON.stringify({ ref: ref || 'working tree', ...game({ shape, seed, players, minutes, doctrines, md: !!process.env.TERRAFALL_MD }) }));

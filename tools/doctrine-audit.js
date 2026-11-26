// One computer-only Versus game with a chosen doctrine on each side, for the doctrine and snowball audit and the
// investment payback measurements in docs/economy-balance-audit.md.
// node tools/doctrine-audit.js MAP SEED DOCTRINE1 DOCTRINE2 MINUTES [git-ref]
//   (doctrines: balanced, turtle, raider, rusher, tycoon; colony 1 gets DOCTRINE1, colony 2 DOCTRINE2)
// Prints one JSON line: the winner and time, and every 5 minutes each colony's buildings, army and goods made (in
// raw-material units, see VALUE), so an early lead can be checked against the result. `payback` gives each production
// building type's measured output per building per minute (minutes 6 to the end, averaged over the buildings standing
// each minute) and how many seconds of that output repay its build cost, both in raw-material units.
const { execFileSync } = require('node:child_process');
const { readFileSync } = require('node:fs');
const path = require('node:path');

const [shape, seedArg, d1, d2, minutesArg, ref] = process.argv.slice(2);
const seed = Number(seedArg), minutes = Number(minutesArg);
if (!shape || !Number.isInteger(seed) || !d1 || !d2 || !Number.isFinite(minutes) || minutes <= 0) {
  throw new Error('Use: node tools/doctrine-audit.js MAP SEED DOCTRINE1 DOCTRINE2 MINUTES [git-ref]');
}
const root = path.join(__dirname, '..');
const read = (file) => ref ? execFileSync('git', ['show', ref + ':' + file], { cwd: root, encoding: 'utf8', maxBuffer: 4e6 }) :
  readFileSync(path.join(root, file), 'utf8');
const modules = ['util', 'defs', 'world', 'path', 'sim', 'ai', 'missions', 'orders', 'landmarks', 'city', 'walker', 'dam'];
const source = modules.map((name) => read('js/' + name + '.js')).join('\n');
const game = new Function('sfx', source + `
  return ({ shape, seed, d1, d2, minutes }) => {
    const shapeId = SHAPE_PRESETS.findIndex((p) => p.name.toLowerCase() === shape.toLowerCase());
    if (shapeId < 0) throw new Error('Unknown map ' + shape);
    if (!isDoctrine(d1) || !isDoctrine(d2)) throw new Error('Unknown doctrine');
    newGame({ shape: shapeId, seed, players: 2, humans: [], mode: 'versus', difficulty: 'normal', style: 'balanced',
      nuke: true, mega: true, events: false, murmur: 'active', victory: 'capture' });
    S.watch = true;
    // Colony 1 is always a Steward in a computer-only game (newGame): set both doctrines here, with the Architect's
    // faster economy (PERSONALITIES.econ) moved with it.
    [d1, d2].forEach((k, p) => {
      const P = S.players[p], was = PERSONALITIES[P.style]?.econ || 1;
      P.mult = P.mult / was * (PERSONALITIES[k].econ || 1);
      P.style = k;
    });
    // Raw-material units: a gathered good is 1; a made good is what went into it, per unit made.
    const VALUE = { ore: 1, crystal: 1, stone: 1, fiber: 1, crude: 1, uranium: 1, cement: 0.5, alloy: 4 / 3, chip: 1 + 4 / 3, fuel: 1, ammo: (4 / 3 + 0.5) / 3 };
    const worth = (o) => Object.entries(o || {}).reduce((n, [g, k]) => n + (VALUE[g] || 0) * Math.max(0, k), 0);
    const MAKERS = { mine: 'ore', tap: 'crystal', quarry: 'stone', kiln: 'cement', smelter: 'alloy', fab: 'chip', refinery: 'fuel', armory: 'ammo', pump: 'crude' };
    const round = (n) => +(n / 60).toFixed(2);
    const col = [0, 1].map(() => ({ count: {}, minutes: {} }));
    let made6 = null;
    const points = [];
    const look = () => [0, 1].map((p) => {
      const P = S.players[p], base = getE(P.lander), alive = base && !base.dead && base.owner === p;
      return { built: P.stats.built, standing: playerBuildings(p).filter((b) => b.built).length,
        army: S.bots.filter((u) => !u.dead && u.owner === p && isArmy(u)).length, made: Math.round(worth(P.made)), alive: !!alive };
    });
    const cap = Math.round(minutes * 60 / SIM_STEP);
    while (S.winner < 0 && S.tick < cap) {
      simStep(SIM_STEP);
      if (S.tick % Math.round(60 / SIM_STEP)) continue;
      const m = Math.round(S.time / 60);
      if (m === 6) made6 = [0, 1].map((p) => ({ ...S.players[p].made }));
      if (m > 6) for (const p of [0, 1]) for (const b of playerBuildings(p)) if (b.built && MAKERS[b.type]) col[p].minutes[b.type] = (col[p].minutes[b.type] || 0) + 1;
      if (m % 5 === 0) points.push({ at: m, colonies: look() });
    }
    const payback = {};
    if (made6) for (const p of [0, 1]) for (const [t, g] of Object.entries(MAKERS)) {
      const bm = col[p].minutes[t] || 0;
      if (bm < 5) continue;
      const n = (S.players[p].made[g] || 0) - (made6[p][g] || 0), e = payback[t] || (payback[t] = { good: g, units: 0, buildingMinutes: 0 });
      e.units += n; e.buildingMinutes += bm;
    }
    for (const [t, e] of Object.entries(payback)) {
      e.perMin = +(e.units / e.buildingMinutes).toFixed(2);
      e.cost = +worth(BDEFS[t].cost).toFixed(1);
      e.paybackSec = e.perMin > 0 ? Math.round(e.cost / (e.perMin * VALUE[e.good]) * 60) : null;
    }
    return { shape, seed, doctrines: [d1, d2], winner: S.winner < 0 ? null : S.winner + 1, time: round(S.time), points, end: look(), payback };
  };
`)(() => {});
console.log(JSON.stringify({ ref: ref || 'working tree', ...game({ shape, seed, d1, d2, minutes }) }));

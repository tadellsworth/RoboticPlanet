// Runs a full AI-vs-AI game in Node without graphics, to sanity-check the simulation.
// Usage: node tools/headless-sim.js [seed] [difficulty] [maxMinutes] [versus|colony] [size 0-3] [terrain 0-4] [resources 0-4] [shape 0-1]
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const files = ['util.js', 'defs.js', 'world.js', 'path.js', 'sim.js', 'ai.js', 'missions.js'];
const ctx = { console, Math, JSON, Map, Array, Object, Number, String, Infinity, Uint8Array, Int8Array, Int32Array, Uint32Array, Float32Array };
ctx.sfx = () => {};
vm.createContext(ctx);
let src = files.map((f) => fs.readFileSync(path.join(__dirname, '..', 'js', f), 'utf8')).join('\n');
src += '\n;globalThis.__api = { newGame, simStep, playerGoods, landShare, getS: () => S };';
vm.runInContext(src, ctx);
const api = ctx.__api;
const seed = +(process.argv[2] || 12345), diff = process.argv[3] || 'normal', maxMin = +(process.argv[4] || 40);
const mode = process.argv[5] || 'versus';
const num = (k) => (process.argv[k] === undefined ? undefined : +process.argv[k]);
api.newGame({ seed, difficulty: diff, autoplay: true, mode, size: num(6), rough: num(7), rich: num(8), shape: num(9) });
const t0 = Date.now();
let lastReport = 0;
while (true) {
  api.simStep(1 / 30);
  const S = api.getS();
  if (S.time - lastReport >= 60) {
    lastReport = S.time;
    const line = [0, 1].map((p) => {
      const bl = S.buildings.filter((b) => !b.dead && b.owner === p);
      const bots = S.bots.filter((u) => !u.dead && u.owner === p);
      const g = api.playerGoods(p);
      const n = (t) => bots.filter((u) => u.type === t).length;
      return `P${p}: bld ${bl.filter((b) => b.built).length}/${bl.length} wk ${n('worker')}+${n('hauler')}h+${n('agribot')}a+${n('paver')}p wb ${n('warbot')} ` +
        Object.entries(g).map(([k, v]) => k.slice(0, 3) + v).join(' ');
    }).join(' | ');
    console.log(`t=${(S.time / 60).toFixed(0)}m ${line}` + (S.mode === 'colony' ? ` land ${Math.round(api.landShare(0) * 100)}%` : ''));
  }
  if (S.winner >= 0 || S.time > maxMin * 60) break;
}
const S = api.getS();
console.log('winner:', S.winner, 'time', (S.time / 60).toFixed(1), 'min', 'real', Date.now() - t0, 'ms');
console.log('types P0:', JSON.stringify(S.buildings.filter((b) => !b.dead && b.owner === 0).reduce((a, b) => (a[b.type] = (a[b.type] || 0) + 1, a), {})));
console.log('types P1:', JSON.stringify(S.buildings.filter((b) => !b.dead && b.owner === 1).reduce((a, b) => (a[b.type] = (a[b.type] || 0) + 1, a), {})));
console.log('stats', JSON.stringify(S.players.map((p) => p.stats)));

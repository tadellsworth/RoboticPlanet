// Passenger Town's lots (the sizes of building townSetup lays, js/world.js): every kind and footprint it lays over many
// seeds, sizes and 2, 3 and 4 colonies, with how often, as renderer/tools/town_footprints.json (what
// tools/render_town.sh renders: the town's art has a sprite for each). Run from renderer/ when the town's layout changes:
//   node tools/town_footprints.js > tools/town_footprints.json
const { readFileSync } = require('node:fs');
const path = require('node:path');
const js = path.join(__dirname, '..', '..', 'js');
const source = ['util', 'defs', 'world', 'path', 'sim', 'ai', 'missions', 'orders'].map((n) => readFileSync(path.join(js, n + '.js'), 'utf8')).join('\n');
const H = new Function('sfx', source + `
  const shape = SHAPE_PRESETS.findIndex((s) => s.city), H = {};
  for (const players of [2, 3, 4]) for (let size = 0; size <= 4; size++) for (const seed of [1, 2, 3, 5, 7, 11, 13, 23, 42, 99]) {
    newGame({ shape, size, seed, players, murmur: 'off' });
    for (const r of S.town.r) { const k = r.k + ' ' + r.w + 'x' + r.h; H[k] = (H[k] || 0) + 1; }
  }
  return H;`)(() => {});
const all = Object.values(H).reduce((a, b) => a + b, 0);
const out = Object.entries(H).sort((a, b) => b[1] - a[1]).map(([k, n]) => { const [kind, wh] = k.split(' '), [w, h] = wh.split('x').map(Number); return { k: kind, w, h, share: +(n / all).toFixed(5) }; });
console.log(JSON.stringify(out, null, 0).replace(/\},\{/g, '},\n{'));

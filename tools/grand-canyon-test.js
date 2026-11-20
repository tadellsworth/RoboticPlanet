const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const path = require('node:path');

const files = ['util', 'defs', 'world', 'path', 'sim', 'ai', 'missions', 'orders'];
const source = files.map(name => readFileSync(path.join(__dirname, '..', 'js', name + '.js'), 'utf8')).join('\n');

const cases = new Function('assert', 'sfx', source + `
  const shape = SHAPE_PRESETS.findIndex(s => s.grandCanyon);
  let cases = 0;
  for (let size = 0; size < SIZE_PRESETS.length; size++) {
    for (const seed of [1, 5, 11, 21, 25, 37, 99]) {
      for (const rough of [0, 2, 4]) {
        newGame({ shape, size, seed, rough, players: 2, nuke: true, murmur: 'off' });
        const { W, H, terrain, elev, ramp, ford, fert, zone } = S;
        const label = [SIZE_PRESETS[size].name, seed, rough].join(' ');
        const { comp, size: water } = seaNet();
        assert.equal(water.length, 1, label + ' continuous river');
        assert.ok(comp.some((c, t) => c === 0 && t % W === 0), label);
        assert.ok(comp.some((c, t) => c === 0 && t % W === W - 1), label);
        const [a, b] = S.players.slice(0, 2).map(p => getE(p.lander)).map(e => zone[tIdx(e.x, e.y)]);
        assert.ok(a >= 0 && a === b, label + ' descent and ford access');
        const starts = S.players.slice(0, 2).map(p => getE(p.lander));
        assert.equal(starts[0].x + starts[1].x, W - 1, label);
        assert.equal(starts[0].y + starts[1].y, H - 1, label);

        const seen = new Uint8Array(W * H);
        let islands = 0, fertileFloor = 0;
        for (let t = 0; t < W * H; t++) {
          const twin = W * H - 1 - t;
          assert.ok(terrain[t] === terrain[twin] && elev[t] === elev[twin] &&
            ramp[t] === ramp[twin] && ford[t] === ford[twin] && fert[t] === fert[twin], label + ' mirrored terrain');
          if (fert[t] && elev[t] === 0) fertileFloor++;
          if (seen[t] || terrain[t] !== T_GROUND) continue;
          const land = [t];
          seen[t] = 1;
          for (let i = 0; i < land.length; i++) {
            const at = land[i], col = at % W;
            for (const next of [col > 0 ? at - 1 : -1, col < W - 1 ? at + 1 : -1, at - W, at + W]) {
              if (next < 0 || next >= W * H || seen[next] || terrain[next] !== T_GROUND) continue;
              seen[next] = 1;
              land.push(next);
            }
          }
          if (land.length >= 3 && land.every(next => elev[next] === 0)) {
            assert.ok(land.some(next => fert[next]), label + ' fertile island');
            islands++;
          }
        }
        assert.equal(islands, 2, label + ' midstream islands');
        assert.ok(fertileFloor >= 12, label + ' fertile bottomland');
        cases++;
      }
    }
  }
  return cases;
`)(assert, () => {});
console.log(`Grand Canyon: ${cases} layouts verified for symmetry, island meadows, rim access and a continuous river.`);

'use strict';

const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const path = require('node:path');

const files = ['util', 'defs', 'world', 'path', 'sim', 'ai', 'missions', 'orders'];
const source = files.map((name) => readFileSync(path.join(__dirname, '..', 'js', name + '.js'), 'utf8')).join('\n');
const check = new Function('assert', 'sfx', source + `

  const fields = ['terrain', 'elev', 'ramp', 'ford', 'tidal', 'fault', 'lava', 'res', 'amt', 'fert'];
  const failures = [];
  let exact = 0, rounded = 0, shared = 0, drizzle = 0;

  function coordinates(tile, width) { return [tile % width, Math.floor(tile / width)]; }

  // Independent of the production orbit helper, including the two distinct four-colony transforms.
  function symmetry(shape, players, teams, width, height) {
    const half = (x, y) => [width - 1 - x, height - 1 - y];
    if (shape.haul4) return [(x, y) => [width - 1 - x, y], half, (x, y) => [x, height - 1 - y]];
    if (players === 2 || shape.twin || (shape.isles4 && teams)) return [half];
    if (shape.cross || shape.quad4 || ((shape.city || shape.walker || shape.dam) && players === 4)) return [(x, y) => [width - 1 - y, x], half, (x, y) => [y, height - 1 - x]];
    return [];
  }

  function startsOf(game) {
    return game.players.filter((p) => !p.absent).map((p) => {
      const b = game.byId.get(p.lander);
      return [b.x, b.y];
    });
  }

  function roundedStarts(starts, width, height) {
    const cx = (width - 1) / 2, cy = (height - 1) / 2;
    const [x, y] = starts[0], dx = x - cx, dy = y - cy;
    for (let k = 1; k < 3; k++) {
      const a = k * 2 * Math.PI / 3, c = Math.cos(a), s = Math.sin(a);
      assert.deepEqual(starts[k], [Math.round(cx + dx * c - dy * s), Math.round(cy + dx * s + dy * c)], 'rounded 120° start');
    }
  }

  function compareMap(game, shape, transforms, teams) {
    const { W: width, H: height } = game;
    const index = (x, y) => y * width + x;
    // Three-player quarter maps have an unoccupied, intentionally richer northwest corner.
    const spare = (x, y) => game.spare && x < width / 2 && y < height / 2;
    for (const turn of transforms) {
      for (let t = 0; t < width * height; t++) {
        const [x, y] = coordinates(t, width);
        const [a, b] = turn(x, y), u = index(a, b);
        for (const field of fields) {
          if ((field === 'res' || field === 'amt' || field === 'fert') && (spare(x, y) || spare(a, b))) continue;
          const values = game[field];
          if (!values || (field === 'amt' && !game.res[t] && !game.res[u])) continue;
          if (values[t] !== values[u]) throw new Error(field + ' (' + x + ',' + y + ')=' + values[t] +
            ' vs (' + a + ',' + b + ')=' + values[u]);
        }
      }
    }
    const starts = startsOf(game), seats = game.spare ? [...starts, [game.spare.x, game.spare.y]] : starts;
    assert.equal(new Set(seats.map(([x, y]) => index(x, y))).size, seats.length, 'distinct start spots');
    for (const [x, y] of seats) {
      assert.equal(game.terrain[index(x, y)], T_GROUND, 'start on ground');
      for (const turn of transforms) {
        const [a, b] = turn(x, y);
        assert.ok(seats.some(([i, j]) => i === a && j === b), 'start (' + x + ',' + y + ') missing twin (' + a + ',' + b + ')');
      }
    }
    if (!transforms.length) roundedStarts(starts, width, height);
    for (const field of ['posts', 'uplinks']) {
      const sites = game[field] || [], tiles = new Set(sites.map(({ x, y }) => index(x, y)));
      assert.equal(tiles.size, sites.length, 'duplicate ' + field);
      for (const { x, y } of sites) {
        assert.equal(game.terrain[index(x, y)], T_GROUND, field + ' on ground');
        assert.equal(game.res[index(x, y)], R_NONE, field + ' site cleared');
      }
    }
    // The sites keep their own layouts (placePosts, placeUplinks): the Trade Posts are placed fair by distance (as near
    // each colony), in half-turn pairs in Teams and on Long Haul 2v2 (whose first post is a shared one on the centre
    // plaza); the Uplinks come in complete sets of twins, but for one shared relay in the middle.
    const half = (x, y) => [width - 1 - x, height - 1 - y];
    const posts = game.posts || [], postTiles = new Set(posts.map(({ x, y }) => index(x, y)));
    const paired = (shape.haul4 && starts.length === 4) || (teams && !shape.haul4);
    if (paired && !(teams && posts.length === 1)) {
      posts.forEach(({ x, y }, k) => {
        const [a, b] = half(x, y);
        if (postTiles.has(index(a, b))) return;
        if (shape.haul4 && k === 0 && Math.hypot(x - (width - 1) / 2, y - (height - 1) / 2) <= 2.5) { shared++; return; }
        throw new Error('posts (' + x + ',' + y + ') missing half-turn twin (' + a + ',' + b + ')');
      });
    }
    const ups = game.uplinks || [], upTiles = new Set(ups.map(({ x, y }) => index(x, y)));
    let middle = 0;
    for (const { x, y } of ups) {
      const lone = transforms.some((turn) => { const [a, b] = turn(x, y); return !upTiles.has(index(a, b)); });
      if (!lone) continue;
      if (Math.hypot(x - (width - 1) / 2, y - (height - 1) / 2) <= 7.5 && !middle++) { shared++; continue; }
      throw new Error('uplinks (' + x + ',' + y + ') missing twin');
    }
    for (let t = 0; t < game.res.length; t++) {
      const [x, y] = coordinates(t, width);
      if (game.res[t] && calmAt(x + 0.5, y + 0.5)) throw new Error('deposit left on a Trade Post at (' + x + ',' + y + ')');
    }
    if (teams) assert.equal(game.uplinks, undefined, 'Teams use Capture');
  }

  function snapshot(game) {
    return [...fields.map((f) => game[f]), startsOf(game), game.spare, game.posts, game.uplinks];
  }

  for (const [shape, preset] of SHAPE_PRESETS.entries()) {
    for (let players = minPlayers(shape); players <= maxPlayers(shape); players++) {
      for (let size = 0; size < SIZE_PRESETS.length; size++) {
        if (mapSizeForPlayers(size, players) !== size) continue;
        for (const teams of players === 4 ? [false, true] : [false]) {
          for (const seed of [11, 21, 37]) {
            const mixed = size >= IMMENSE_SIZE && seed === 37 && !preset.hollow;
            const opts = { seed, shape, players, size, teams, mode: 'versus', victory: 'uplinks',
              murmur: preset.hollow || seed === 37 ? 'active' : 'off', biome: 'desert', biome2: mixed ? 'jungle' : undefined };
            const label = [preset.name, SIZE_PRESETS[size].name, players, teams ? 'Teams' : 'Versus', 'seed ' + seed].join(' / ');
            try {
              const game = newGame(opts);
              const transforms = symmetry(preset, players, teams, game.W, game.H);
              compareMap(game, preset, transforms, teams);
              const repeat = newGame(opts);
              assert.deepEqual(snapshot(repeat), snapshot(game), 'same settings and seed');
              if (mixed) {
                assert.equal(repeat.settings.biome2, 'jungle', 'mixed biome enabled');
                assert.deepEqual(snapshot(newGame({ ...opts, biome2: undefined })), snapshot(game), 'biomes leave competitive tiles unchanged');
              }
              if (transforms.length) exact++;
              else rounded++; // The 120° layouts cannot be compared tile for tile after rounding.
              if ((preset.cross && players !== 3) || preset.haul4) {
                const fall = drizzlePlan(makeRng(seed));
                if (fall) { drizzleLand({ fall, spots: [] }); compareMap(S, preset, transforms, teams); drizzle++; }
              }
            } catch (error) {
              failures.push(label + ' — ' + error.message.split('\\n')[0]);
            }
          }
        }
      }
    }
  }

  if (failures.length) {
    throw new Error(failures.length + ' layouts failed. First mismatches:\\n' + failures.slice(0, 20).join('\\n'));
  }
  assert.ok(drizzle > 0, 'drizzle check exercised');
  console.log(exact + ' exact and ' + rounded + ' rounded layouts repeat from seed. ' + drizzle +
    ' drizzle landings stayed symmetric. ' + shared + ' shared-site comparisons used the central-site exception.');
`);
check(assert, () => {});

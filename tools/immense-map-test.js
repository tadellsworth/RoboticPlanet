const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const path = require('node:path');

const files = ['util', 'defs', 'world', 'path', 'sim', 'ai', 'missions', 'orders', 'lockstep', 'net'];
const source = files.map((name) => readFileSync(path.join(__dirname, '..', 'js', name + '.js'), 'utf8')).join('\n');
// Each client gets its own simulation globals, just as the browser tabs do.
const createClient = new Function('assert', 'sfx', source + '\nreturn (code) => eval(code);');
const client = () => createClient(assert, () => {});

const host = client();
const result = host(`
  assert.deepEqual(mapDims({ size: IMMENSE_SIZE, shape: 0, players: 2 }), { W: 84, H: 118 });
  let layouts = 0;
  for (let shape = 0; shape < SHAPE_PRESETS.length; shape++) {
    const sh = SHAPE_PRESETS[shape];
    for (let players = minPlayers(shape); players <= maxPlayers(shape); players++) {
      for (const teams of players === 4 ? [false, true] : [false]) {
        for (const seed of [11, 21, 37]) {
          const label = [sh.name, players, teams ? 'Teams' : 'FFA', seed].join(' ');
          const opts = { seed, shape, size: IMMENSE_SIZE, players, teams,
            victory: 'uplinks', murmur: sh.hollow ? 'active' : 'off' };
          newGame(opts);
          const huge = mapDims({ ...S.settings, size: IMMENSE_SIZE - 1 });
          assert.ok(S.W / huge.W >= 1.37 && S.W / huge.W <= 1.44, label + ' width');
          assert.ok(S.H / huge.H >= 1.37 && S.H / huge.H <= 1.44, label + ' height');
          assert.equal(S.settings.players, players, label);
          assert.equal(!!S.teams, teams, label);
          const starts = S.players.filter((p) => !p.absent && !isWild(p.id)).map((p) => getE(p.lander));
          assert.equal(new Set(starts.map((b) => tIdx(b.x, b.y))).size, players, label);
          const openings = [];
          for (const b of starts) {
            assert.equal(S.terrain[tIdx(b.x, b.y)], T_GROUND, label);
            assert.deepEqual(b.stock, starts[0].stock, label + ' starting stock');
            const nearby = { [R_ORE]: 0, [R_BOULDER]: 0 };
            for (let y = Math.max(0, b.y - 12); y < Math.min(S.H, b.y + 13); y++) {
              for (let x = Math.max(0, b.x - 12); x < Math.min(S.W, b.x + 13); x++) {
                const t = tIdx(x, y);
                if (dist2(x, y, b.x, b.y) <= 144 && S.zone[t] === S.zone[tIdx(b.x, b.y)] && S.res[t] in nearby) nearby[S.res[t]] += S.amt[t];
              }
            }
            assert.ok(nearby[R_ORE] && nearby[R_BOULDER], label + ' accessible opening deposits');
            openings.push(nearby);
          }
          // Fully mirrored layouts have identical opening deposits. A three-way rotation rounds to the grid.
          if (players === 2 || quadMap(S.settings) || haul4Map(S.settings)) {
            for (const nearby of openings) assert.deepEqual(nearby, openings[0], label + ' mirrored opening deposits');
          }
          if (sh.hollow) {
            assert.equal(S.hollow.nests.length, 18, label);
            assert.equal(S.posts.length, 0, label);
            assert.equal(S.victory, undefined, label);
          } else {
            assert.ok(S.posts.length > 0, label + ' Trade Posts');
            if (!teams) assert.ok(S.uplinks.length >= 3, label + ' Uplinks');
            if (sh.isles4 && !teams) assert.equal(S.uplinks.length, 5, label + ' shore Uplinks');
          }
          for (const site of [...S.posts, ...(S.uplinks || [])]) {
            const t = tIdx(site.x, site.y);
            assert.equal(S.terrain[t], T_GROUND, label);
            assert.equal(S.res[t], R_NONE, label);
          }
          const meteors = meteorPlan(makeRng(seed), 0, 30);
          assert.ok(meteors.length > METEOR_HITS * players, label + ' Ringfall');
          assert.ok(meteors.every((m) => inMap(m.x, m.y)), label);
          layouts++;
        }
      }
    }
  }

  assert.equal(S.settings.biome2, undefined, 'single biome is the default');
  assert.equal(secondBiomeAllowed('jungle', 'desert', IMMENSE_SIZE - 1, 0), false);
  assert.equal(secondBiomeAllowed('tropical', 'desert', IMMENSE_SIZE, 0), false);
  assert.equal(secondBiomeAllowed('jungle', 'lunar', IMMENSE_SIZE, 0), false);
  assert.equal(secondBiomeAllowed('jungle', 'desert', IMMENSE_SIZE, SHAPE_PRESETS.findIndex(s => s.hollow)), false);
  const opts = { seed: 37, shape: SHAPE_PRESETS.findIndex((s) => s.cross), size: IMMENSE_SIZE, players: 4, teams: true, humans: [0, 1], murmur: 'active', biome: 'desert', biome2: 'jungle' };
  const locals = { opts, sent: [] };
  newGame(opts);
  mpStart({me: 0, humans: opts.humans, send: (msg) => locals.sent.push(msg)});
  const initial = hashState(), saved = serializeGame();
  checkSave(JSON.parse(saved));
  const unsupported = JSON.parse(saved);
  unsupported.settings.size = SIZE_PRESETS.length;
  assert.throws(() => checkSave(unsupported), /Unsupported save/);
  deserializeGame(saved);
  assert.equal(hashState(), initial, 'save round trip');
  assert.equal(S.settings.size, IMMENSE_SIZE);
  assert.equal(S.W, 146);
  assert.equal(S.settings.biome2, 'jungle');
  const mix = (seed, offset) => Float32Array.from(S.terrain, (_, t) =>
    biomeMixAt(t % S.W, (t / S.W) | 0, S.W, S.H, seed, offset));
  const checkCoverage = () => {
    const coverage = mix(S.seed, S.settings.biomeBoundary);
    let land = 0, primary = 0;
    for (let t = 0; t < coverage.length; t++) {
      if (S.terrain[t] !== T_GROUND && S.terrain[t] !== T_ROCK) continue;
      land++;
      if (coverage[t] < 0.5) primary++;
    }
    assert.ok(Math.abs(primary / land - 0.65) < 0.002, '65% of the land is primary');
    assert.ok(coverage.some(value => value > 0 && value < 1), 'smooth transition');
    assert.notDeepEqual(coverage, mix(S.seed + 1, S.settings.biomeBoundary));
  };
  checkCoverage();
  const legacy = JSON.parse(saved);
  delete legacy.settings.biomeBoundary;
  deserializeGame(JSON.stringify(legacy));
  assert.equal(S.settings.biomeBoundary, undefined, 'old games use their original centered boundary');
  for (const [name, seed] of [['Standard', 11], ['Islands', 21], ['Grand Canyon', 37]]) {
    newGame({ ...opts, shape: SHAPE_PRESETS.findIndex(s => s.name === name), players: 2, teams: false, seed });
    checkCoverage();
  }
  assert.equal(aiMarchTime({ x: 0, y: 0 }, { x: 0.5, y: 60.5 }, 150), 150);
  assert.ok(aiMarchTime({ x: 0, y: 0 }, { x: 0.5, y: 180.5 }, 150) > 300);
  // Ringfall mirrors every site even in a game with a Murmur slot.
  newGame({ seed: 11, size: IMMENSE_SIZE, murmur: 'active' });
  const impacts = meteorPlan(makeRng(11), 0, 30);
  assert.equal(impacts.length, 18);
  for (let i = 0; i < impacts.length; i += 2) {
    assert.equal(impacts[i].x + impacts[i + 1].x, S.W - 1);
    assert.equal(impacts[i].y + impacts[i + 1].y, S.H - 1);
  }
  newGame(opts);
  mpStart({me: 0, humans: opts.humans, send: (msg) => locals.sent.push(msg)});
  mpFrame(SIM_STEP * 3 / GAME_PACE);
  mpSendSnapshot(MP.turn, [1], true, hashState());
  const snapshot = locals.sent.at(-1), parts = [];
  NET.ws = { readyState: 1, send: (part) => parts.push(part) };
  netSend(snapshot);
  assert.ok(parts.length > 1, 'large snapshot split into messages');
  ({ layouts, opts, initial, parts, bytes: snapshot.data.length, after: hashState(), tick: S.tick });
`);

const guest = client();
assert.equal(guest(`
  newGame(${JSON.stringify(result.opts)});
  mpStart({me: 1, humans: [0, 1], send: () => {}});
  hashState();
`), result.initial, 'independent peer generation');
assert.equal(guest(`
  mpJoin({me: 1, send: () => {}});
  ${JSON.stringify(result.parts)}.forEach((part, i) => netIn(JSON.stringify({ ...JSON.parse(part), seq: i + 1 })));
  assert.equal(S.tick, ${result.tick});
  assert.equal(S.settings.size, IMMENSE_SIZE);
  hashState();
`), result.after, 'lockstep rejoin fingerprint');
console.log(`Immense: ${result.layouts} layouts, save round trip and lockstep snapshot verified (${result.bytes} bytes).`);

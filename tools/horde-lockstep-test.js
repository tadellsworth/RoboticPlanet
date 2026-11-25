#!/usr/bin/env node
// Co-op Horde over the lockstep, headless: two devices (each a whole game: js/sim.js and the rest, with js/lockstep.js)
// play one Horde game through a stand-in for the relay (every message to every device, numbered, in one order), both
// giving orders. Mid-wave, with the Murmur up, the second device reloads: a fresh one asks for the game (want), takes
// the host's snapshot and plays on, its colony the computer's until it has caught up and is back (rejoin). Every whole
// second the two games' fingerprints (hashState) must match, and neither device may see a mismatch (MP.desyncs).
// Usage: node tools/horde-lockstep-test.js [pair|crew|both] [minutes]
//   pair: co-op side by side (two allied colonies on Long Haul 2v2); crew: one colony run by both (shared colony co-op)
// The waves come quickly here (the level's countdowns cut to seconds, the same on both devices) so a few minutes of
// game time hold several waves and a boss wave.
'use strict';
const fs = require('fs'), path = require('path'), vm = require('vm');
const files = ['util.js', 'defs.js', 'world.js', 'path.js', 'sim.js', 'ai.js', 'missions.js', 'orders.js', 'lockstep.js'];
const src = files.map((f) => fs.readFileSync(path.join(__dirname, '..', 'js', f), 'utf8')).join('\n') +
  '\n;globalThis.__api = { newGame, simStep, getS: () => S, hashState, applyOrder, MP, mpStart, mpJoin, mpIn, mpFrame, getME: () => ME, setCrew: (c) => { S.crew = c; } };';
const shape = process.argv[2] || 'both', minutes = +(process.argv[3] || 5);

function device(send) {
  const ctx = { console, Math, JSON, Map, Set, Array, Object, Number, String, Infinity, Uint8Array, Uint16Array, Int8Array, Int32Array, Uint32Array, Float32Array, Float64Array, performance };
  ctx.sfx = () => {};
  vm.createContext(ctx);
  vm.runInContext(src, ctx);
  // (quick waves: the same on every device, so the game stays the same game)
  vm.runInContext('HORDE.levels.normal.gap = [25, 0, 30]; HORDE.warn = 8;', ctx);
  const api = ctx.__api;
  api.send = send;
  return api;
}

function run(kind) {
  const log = [], devs = [];
  let seq = 0;
  const send = (msg) => { log.push({ ...JSON.parse(JSON.stringify(msg)), seq: ++seq }); };
  const deliver = () => { while (log.length) { const m = log.shift(); for (const d of devs) if (d.live) d.mpIn(JSON.parse(JSON.stringify(m))); } };
  // The places people play: side by side, places 0 and 1 (a colony each); shared, places 0 and 2 (place 2 runs colony 0).
  const pair = kind === 'pair', me = pair ? [0, 1] : [0, 2], people = me.slice();
  const opts = { seed: 9090, difficulty: 'normal', mode: 'colony', murmur: 'active', humans: pair ? [0, 1] : [0], horde: { level: 'normal', goal: 'endless', pair, crew: pair ? 1 : 2 }, unlimited: true };
  for (const k of [0, 1]) {
    const d = device(send);
    d.newGame(opts);
    if (!pair) d.setCrew([{ n: 'Ada', c: 0 }, null, { n: 'Bo', c: 0 }]);
    d.mpStart({ me: me[k], humans: people, send });
    d.live = true;
    devs.push(d);
  }
  const S0 = devs[0].getS();
  console.log(`${kind}: map ${S0.W}x${S0.H}, colonies ${S0.horde.ps ? S0.horde.ps.join('+') : 0}, waves x${S0.horde.mul || 1}, wild owner ${S0.wildOwner}, lanes ${S0.horde.lanes.length}`);
  const prints = [new Map(), new Map()];
  let checks = 0, bad = 0, rejoined = false, reloaded = -1, orders = 0, peakUp = 0, back = -1;
  const ticks = minutes * 60 * 30;
  for (let step = 0; step < ticks * 1.6 && devs[0].getS().tick < ticks; step++) {
    for (const d of devs) if (d.live) d.mpFrame(1 / 30 / 0.85);
    deliver();
    const S = devs[0].getS();
    // Orders from both people now and then: guns and walls before their colony's base.
    if (step % 150 === 75) {
      for (let k = 0; k < devs.length; k++) {
        const d = devs[k];
        if (!d.live || !d.MP.on || d.MP.paused) continue;
        const Sd = d.getS(), col = d.getME(), L = Sd.buildings.find((b) => b.type === 'lander' && b.owner === col);
        if (!L) continue;
        const dir = Math.sign(Sd.horde.my - L.y) || -1, n = (step / 150) | 0;
        d.MP.order('place', [n % 3 === 0 ? 'wall' : n % 3 === 1 ? 'turret' : 'minigun', L.x - 6 + ((n * 5 + k * 3) % 13), L.y + dir * (5 + (n % 4))]);
        orders++;
      }
    }
    let up = 0;
    for (const u of S.bots) if (!u.dead && u.hw) up++;
    peakUp = Math.max(peakUp, up);
    // Mid-wave, with Murmur up: the second device reloads (a fresh page asks for the game).
    if (reloaded < 0 && S.horde.n >= 2 && S.horde.open.length && up >= 8) {
      reloaded = S.tick;
      devs[1].live = false;
      const d = device(send);
      d.mpJoin({ me: me[1], send, speed: 1 });
      d.live = true; d.fresh = true;
      devs[1] = d; prints[1] = new Map();
      console.log(`  t=${(S.time / 60).toFixed(2)}m: device 2 reloads during wave ${S.horde.n} (${up} Murmur up, ${S.horde.q.length} waiting)`);
    }
    if (devs[1].fresh && devs[1].MP.on && back < 0 && !devs[1].MP.ctl.get(me[1]).slice(-1)[0].ai) { back = S.tick; rejoined = true; console.log(`  t=${(S.time / 60).toFixed(2)}m: device 2 is back, running its colony again`); }
    // Fingerprints: each device's at every whole second it stands on (compared below, second by second).
    for (let k = 0; k < devs.length; k++) {
      const d = devs[k];
      if (!d.live || !d.MP.on) continue;
      const t = d.getS().tick;
      // (not the snapshot's own tick on the device that took it: who runs which colony is settled for the turn after it,
      // on every device, and the lockstep never compares that one either: mpHash's snapTurn)
      if (k === 1 && d.fresh && t <= d.MP.snapTurn * 3) continue;
      if (t % 30 === 0 && !prints[k].has(t)) prints[k].set(t, d.hashState());
    }
  }
  for (const [t, h] of prints[1]) {
    if (!prints[0].has(t)) continue;
    checks++;
    if (prints[0].get(t) !== h) { bad++; if (bad < 4) console.log(`  MISMATCH at tick ${t}: ${prints[0].get(t)} vs ${h}`); }
  }
  const S = devs[0].getS(), S1 = devs[1].getS();
  const desyncs = devs.map((d) => d.MP.desyncs);
  console.log(`  ran to ${(S.time / 60).toFixed(1)}m (device 2 at ${(S1.time / 60).toFixed(1)}m): wave ${S.horde.n}, cleared ${S.horde.cleared}, kills ${S.horde.kills}, peak up ${peakUp}, orders ${orders}, winner ${S.winner}`);
  console.log(`  fingerprints compared ${checks}, differing ${bad}; desyncs seen by the devices ${desyncs.join('/')}; ticks ${S.tick} / ${S1.tick}`);
  const ok = bad === 0 && desyncs.every((x) => x === 0) && rejoined && checks > 50 && reloaded > 0 && S.horde.n >= 3;
  console.log(`  ${ok ? 'OK' : 'FAILED'}${rejoined ? '' : ' (device 2 never rejoined)'}`);
  return ok;
}

let ok = true;
for (const kind of shape === 'both' ? ['pair', 'crew'] : [shape]) ok = run(kind) && ok;
if (!ok) process.exitCode = 1;

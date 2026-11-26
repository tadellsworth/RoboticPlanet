#!/usr/bin/env node
// The Workforce ladder over the lockstep, headless: two devices (each a whole game: js/sim.js and the rest, with
// js/lockstep.js) play one Versus game through a stand-in for the relay (every message to every device, numbered, in one
// order). The game is a computer colonies' game played a while first, then each device's person takes a colony and
// keeps changing its Workforce settings (and orders a Grader and Terraform jobs): presets, their own order, Back to Auto, rows' minimums, caps and pins, Keep
// staffed, Rebalance now. Halfway the second device reloads: a fresh one asks for the game, takes the host's snapshot
// (the settings in it) and plays on. Every whole second the two games' fingerprints (hashState) must match, and neither
// device may see a mismatch (MP.desyncs).
// Usage: node tools/workforce-lockstep-test.js [minutes]
'use strict';
const fs = require('fs'), path = require('path'), vm = require('vm');
const files = ['util.js', 'defs.js', 'world.js', 'path.js', 'sim.js', 'ai.js', 'missions.js', 'orders.js', 'lockstep.js'];
const src = files.map((f) => fs.readFileSync(path.join(__dirname, '..', 'js', f), 'utf8')).join('\n') +
  '\n;globalThis.__api = { newGame, simStep, getS: () => S, hashState, serializeGame, deserializeGame, MP, mpStart, mpJoin, mpIn, mpFrame, getME: () => ME, wfRowOf, WF_KEYS, tfWhere, tIdx, getE };';
const minutes = +(process.argv[2] || 4);

function device(send) {
  const ctx = { console, Math, JSON, Map, Set, Array, Object, Number, String, Infinity, Uint8Array, Uint16Array, Int8Array, Int16Array, Int32Array, Uint32Array, Float32Array, Float64Array, performance };
  ctx.sfx = () => {};
  vm.createContext(ctx);
  vm.runInContext(src, ctx);
  const api = ctx.__api;
  api.send = send;
  return api;
}

// The game: computer colonies for ten minutes, so each has an economy to staff.
const pre = device(() => {});
pre.newGame({ seed: 5150, difficulty: 'normal', autoplay: true, mode: 'versus' });
while (pre.getS().time < 600 && pre.getS().winner < 0) pre.simStep(1 / 30);
// (colonies 0 and 1 are the people's from here: their computer stops running them, as in a game they started)
for (const P of pre.getS().players.slice(0, 2)) { P.ai = false; delete P.triage; }
while (pre.getS().time < 620) pre.simStep(1 / 30);
const snap = pre.serializeGame();

const log = [], devs = [];
let seq = 0;
const send = (msg) => { log.push({ ...JSON.parse(JSON.stringify(msg)), seq: ++seq }); };
const deliver = () => { while (log.length) { const m = log.shift(); for (const d of devs) if (d.live) d.mpIn(JSON.parse(JSON.stringify(m))); } };
for (const k of [0, 1]) {
  const d = device(send);
  d.deserializeGame(snap);
  d.mpStart({ me: k, humans: [0, 1], send });
  d.live = true;
  devs.push(d);
}
console.log(`map ${devs[0].getS().W}x${devs[0].getS().H}, from ${(devs[0].getS().time / 60).toFixed(1)} min`);

// Each person's next change, in turn (rows by name; the building for Keep staffed is the first of theirs that has a Worker).
const changes = [
  (d, col) => ['wfPreset', ['war']],
  (d, col) => ['wfRow', ['fiber', 'cap', 1]],
  (d, col) => ['wfRow', ['stone', 'min', 2]],
  (d, col) => ['wfRebalance', []],
  (d, col) => ['wfRow', ['ore', 'pin', true]],
  (d, col) => { const b = d.getS().buildings.find((q) => !q.dead && q.owner === col && q.built && q.staff && d.wfRowOf(q.type)); return ['keepStaff', [b ? b.id : 0, true]]; },
  (d, col) => ['wfOrder', [d.WF_KEYS.slice().reverse()]],
  (d, col) => ['wfPreset', ['economy']],
  (d, col) => ['wfRow', ['sites', 'cap', 1]],
  (d, col) => ['wfRebalance', []],
  (d, col) => ['wfOrder', [null]],
  (d, col) => ['wfRow', ['fiber', 'cap', -1]],
  (d, col) => ['wfPreset', ['build']],
  (d, col) => ['wfRow', ['pave', 'min', 1]],
  // Terraforming over the lockstep too (TERRA): a Grader ordered, then ground raised and lowered near the base.
  (d, col) => { const f = d.getS().buildings.find((q) => !q.dead && q.owner === col && q.built && q.type === 'foundry'); return ['foundryOrder', [f ? f.id : 0, 'grader', 1]]; },
  (d, col) => ['terraform', ['raise', tfSpots(d, col)]],
  (d, col) => ['terraform', ['lower', tfSpots(d, col)]],
];
// Three tiles of open ground near colony col's Command Base that can be worked now.
function tfSpots(d, col) {
  const S = d.getS(), L = d.getE(S.players[col].lander), out = [];
  for (let r = 3; r < 12 && out.length < 3; r++) for (let j = L.y - r; j <= L.y + r && out.length < 3; j++) for (let i = L.x - r; i <= L.x + r && out.length < 3; i++) {
    if (i < 0 || j < 0 || i >= S.W || j >= S.H || Math.max(Math.abs(i - L.x), Math.abs(j - L.y)) !== r) continue;
    const t = d.tIdx(i, j);
    if (S.terrain[t] === 0 && !d.tfWhere(col, t)) out.push(t);
  }
  return out;
}
const prints = [new Map(), new Map()];
let checks = 0, bad = 0, reloaded = -1, orders = 0, rejoined = false;
const t0 = devs[0].getS().tick, ticks = minutes * 60 * 30;
for (let step = 0; step < ticks * 1.6 && devs[0].getS().tick - t0 < ticks; step++) {
  for (const d of devs) if (d.live) d.mpFrame(1 / 30 / 0.85);
  deliver();
  if (step % 120 === 60) {
    for (let k = 0; k < devs.length; k++) {
      const d = devs[k];
      if (!d.live || !d.MP.on || d.MP.paused || d.fresh && !rejoined) continue;
      const [name, args] = changes[(orders / 2 | 0) % changes.length](d, d.getME());
      d.MP.order(name, args);
      orders++;
    }
  }
  // Halfway: the second device reloads (a fresh page asks for the game).
  if (reloaded < 0 && devs[0].getS().tick - t0 > ticks / 2) {
    reloaded = devs[0].getS().tick;
    devs[1].live = false;
    const d = device(send);
    d.mpJoin({ me: 1, send, speed: 1 });
    d.live = true; d.fresh = true;
    devs[1] = d; prints[1] = new Map();
    console.log(`  t=${(devs[0].getS().time / 60).toFixed(2)}m: device 2 reloads (colony 0's settings ${JSON.stringify(devs[0].getS().players[0].wf || {})})`);
  }
  if (devs[1].fresh && devs[1].MP.on && !rejoined && !devs[1].MP.ctl.get(1).slice(-1)[0].ai) { rejoined = true; console.log(`  t=${(devs[0].getS().time / 60).toFixed(2)}m: device 2 is back`); }
  for (let k = 0; k < devs.length; k++) {
    const d = devs[k];
    if (!d.live || !d.MP.on) continue;
    const t = d.getS().tick;
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
const same = JSON.stringify(S.players.map((P) => P.wf || null)) === JSON.stringify(S1.players.map((P) => P.wf || null));
console.log(`  ran to ${(S.time / 60).toFixed(1)}m, ${orders} Workforce orders; settings now ${JSON.stringify(S.players.slice(0, 2).map((P) => P.wf || null))}`);
console.log(`  fingerprints compared ${checks}, differing ${bad}; desyncs seen by the devices ${desyncs.join('/')}; settings the same on both: ${same}`);
const tf = S.buildings.filter((b) => b.tf).length + Object.keys(S.tfTiles || {}).length;
console.log(`  terraforming: ${Object.keys(S.tfTiles || {}).length} tiles changed, ${S.buildings.filter((b) => !b.dead && b.tf).length} Earthworks open, ${S.bots.filter((u) => !u.dead && u.type === 'grader').length} Graders`);
const ok = tf > 0 && bad === 0 && desyncs.every((x) => x === 0) && rejoined && checks > 60 && same && orders >= 20;
console.log(ok ? 'workforce lockstep: OK' : 'workforce lockstep: FAILED');
if (!ok) process.exitCode = 1;

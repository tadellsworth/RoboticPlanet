#!/usr/bin/env node
// Co-op Colony's Goal over the lockstep, headless: the host's start settings (as mpHostStart sends them round, through
// JSON) carry the Goal (greenWin: Made ready, or Free play), and every device makes its game from them with the lobby's
// own mpGameOpts (js/mpui.js). Two devices then play one shared colony (places 0 and 2, place 2 running colony 0: S.crew)
// through a stand-in for the relay. Partway, the second device reloads and takes the host's snapshot. Then, the same
// tick on every device, most of the open land is graded (S.tfTiles): with Made ready the shared colony's share passes
// GREEN.goal and the game is won on both devices (winner 0, endHow 'green'; both run colony 0, so both see the VICTORY);
// with Free play nothing ends. Every whole second the fingerprints (hashState) must match, with no desyncs (MP.desyncs).
// Usage: node tools/coop-green-test.js
'use strict';
const fs = require('fs'), path = require('path'), vm = require('vm');
const read = (f) => fs.readFileSync(path.join(__dirname, '..', 'js', f), 'utf8');
const files = ['util.js', 'defs.js', 'world.js', 'path.js', 'sim.js', 'ai.js', 'missions.js', 'orders.js', 'lockstep.js'];
// (the lobby's own code for the game every device makes from the start's settings, and the doctrine key it uses)
const grab = (src, head) => { const a = src.indexOf(head); if (a < 0) throw new Error('not found: ' + head); return src.slice(a, src.indexOf('\n}\n', a) + 3); };
const ui = read('ui.js'), mpui = read('mpui.js');
const lobby = ui.split('\n').find((l) => l.startsWith('const docKeyOf')) + '\n' + grab(mpui, 'function mpGameOpts(');
const src = files.map(read).join('\n') + '\n' + lobby +
  '\n;globalThis.__api = { newGame, simStep, getS: () => S, hashState, MP, mpStart, mpJoin, mpIn, mpFrame, getME: () => ME, setCrew: (c) => { S.crew = c; }, mpGameOpts, playerCount, greenOpen, greenShare, GREEN };' +
  '\n;{ const step0 = simStep; simStep = function (dt) { step0(dt); if (globalThis.__hook) globalThis.__hook(); }; }';

let HOOK = null;
function device(send) {
  const ctx = { console, Math, JSON, Map, Set, Array, Object, Number, String, Infinity, Uint8Array, Uint16Array, Int8Array, Int16Array, Int32Array, Uint32Array, Float32Array, Float64Array, performance };
  ctx.sfx = () => {};
  vm.createContext(ctx);
  vm.runInContext(src, ctx);
  const api = ctx.__api;
  ctx.__hook = () => { if (HOOK) HOOK(api); };
  return api;
}

function run(goal) {
  const ready = goal === 'ready', log = [], devs = [];
  let seq = 0;
  const send = (msg) => { log.push({ ...JSON.parse(JSON.stringify(msg)), seq: ++seq }); };
  const deliver = () => { while (log.length) { const m = log.shift(); for (const d of devs) if (d.live) d.mpIn(JSON.parse(JSON.stringify(m))); } };
  // The start's settings, as the host sends them for co-op Colony (mpMenuSettings + mpHostStart), through JSON.
  const shape = 0, probe = device(() => {}), cols = probe.playerCount('colony', shape);
  const settings = JSON.parse(JSON.stringify({
    mode: 'colony', seed: 4242, diff: 'normal', size: 1, rough: 1, rich: 1, shape, biome: 'desert', players: 2, style: 0, styles: [0, 0, 0, 0],
    nuke: false, mega: true, upWin: false, events: false, victory: 'capture', murmur: 'off', scars: 'off', teams: false, teamOf: null, mods: [],
    greenWin: ready, coop: [1], cols, coopCol: 0, slotsN: cols + 1,
  }));
  const me = [0, cols], humans = [0]; // (the colonies people play: the host's; the partner's place, after the colonies, runs it too)
  const opts = probe.mpGameOpts(settings, humans);
  const crew = Array.from({ length: cols + 1 }, (_, k) => (k === 0 ? { n: 'Ada', c: 0 } : k === cols ? { n: 'Bo', c: 0 } : null));
  for (const k of [0, 1]) {
    const d = device(send);
    d.newGame(opts);
    d.setCrew(crew);
    d.mpStart({ me: me[k], humans: me.slice(), send });
    d.live = true;
    devs.push(d);
  }
  const S0 = devs[0].getS();
  console.log(`${goal}: map ${S0.W}x${S0.H}, colonies ${cols}, greenWin ${!!S0.settings.greenWin}, device 2 runs colony ${devs[1].getME()}`);
  // The script (game seconds), the same tick on every device: most of the open land graded at T.green.
  const T = { reload: 30, green: 60, end: 75 }, at = (s) => Math.round(s * 30);
  HOOK = (g) => {
    const S = g.getS();
    if (S.tick !== at(T.green)) return;
    S.tfTiles = S.tfTiles || {};
    let open = 0;
    for (let t = 0; t < S.W * S.H; t++) if (g.greenOpen(t) && open++ % 10 < 7) S.tfTiles[t] = 1; // (70% of it)
  };
  const prints = [new Map(), new Map()];
  let checks = 0, bad = 0, reloaded = false, rejoined = false;
  for (let step = 0; step < at(T.end) * 1.6 && devs[0].getS().time < T.end; step++) {
    for (const d of devs) if (d.live) d.mpFrame(1 / 30 / 0.85);
    deliver();
    const S = devs[0].getS();
    if (!reloaded && S.time >= T.reload) {
      reloaded = true;
      devs[1].live = false;
      const d = device(send);
      d.mpJoin({ me: me[1], send, speed: 1 });
      d.live = true; d.fresh = true;
      devs[1] = d; prints[1] = new Map();
    }
    if (devs[1].fresh && devs[1].MP.on && !rejoined) rejoined = true;
    for (let k = 0; k < devs.length; k++) {
      const d = devs[k];
      if (!d.live || !d.MP.on) continue;
      const t = d.getS().tick;
      if (k === 1 && d.fresh && t <= d.MP.snapTurn * 3) continue;
      if (t % 30 === 0 && !prints[k].has(t)) prints[k].set(t, d.hashState());
    }
  }
  // (the second device catches up to the first)
  for (let n = 0; n < 600 && devs[1].getS().tick < devs[0].getS().tick; n++) { devs[1].mpFrame(1 / 30 / 0.85); deliver(); }
  for (const [t, h] of prints[1]) {
    if (!prints[0].has(t)) continue;
    checks++;
    if (prints[0].get(t) !== h) { bad++; if (bad < 4) console.log(`  MISMATCH at tick ${t}`); }
  }
  const out = devs.map((d) => { const S = d.getS(); return { winner: S.winner, how: S.endHow, me: d.getME(), share: Math.round(d.greenShare(0) * 100), greenWin: !!S.settings.greenWin, desyncs: d.MP.desyncs }; });
  console.log(`  devices: ${out.map((o) => `winner ${o.winner} ${o.how || ''} (runs ${o.me}, ${o.share}% green, greenWin ${o.greenWin}, desyncs ${o.desyncs})`).join(' | ')}`);
  console.log(`  fingerprints compared ${checks}, differing ${bad}; device 2 reloaded and rejoined: ${rejoined}`);
  const won = out.every((o) => o.winner === 0 && o.how === 'green' && o.me === 0 && o.share >= 60);
  const ok = rejoined && bad === 0 && checks > 20 && out.every((o) => o.desyncs === 0 && o.greenWin === ready) && (ready ? won : out.every((o) => o.winner < 0));
  console.log(`  ${ok ? 'OK' : 'FAILED'}`);
  return ok;
}

let ok = true;
for (const goal of ['ready', 'free']) ok = run(goal) && ok;
if (!ok) process.exitCode = 1;

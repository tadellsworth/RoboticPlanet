#!/usr/bin/env node
// Co-op Horde over the lockstep, headless: two devices (each a whole game: js/sim.js and the rest, with js/lockstep.js)
// play one Horde game through a stand-in for the relay (every message to every device, numbered, in one order), both
// giving orders. Mid-wave, with the Murmur up, the second device reloads: a fresh one asks for the game (want), takes
// the host's snapshot and plays on, its colony the computer's until it has caught up and is back (rejoin). Every whole
// second the two games' fingerprints (hashState) must match, and neither device may see a mismatch (MP.desyncs).
// Usage: node tools/horde-lockstep-test.js [pair|crew|teams|both|all] [minutes]
//   pair: co-op side by side (two allied colonies on Long Haul 2v2); crew: one colony run by both (shared colony co-op);
//   teams: a Teams 2 vs 2 game (the two people allies, against two computer colonies). both: pair and crew; all: the three.
// pair and teams play out a fallen ally (FALLEN) on a script, the same tick on every device: colony 1's Command Base falls
// (Horde: battered down; Teams: captured by colony 2) → down, its person's orders refused; the survivor lets them help
// command (ORDERS.lend) and an order of theirs lands in the survivor's colony; the second device reloads while colony 1 is
// down; the survivor retakes the base (Horde: warbots holding the ruin; Teams: captured back) → colony 1 is back and its
// person's orders are its own again. Teams then has both of the team fall: the game is lost (colonies 2 and 3 win).
// The waves come quickly here (the level's countdowns cut to seconds, the same on both devices) so a few minutes of
// game time hold several waves and a boss wave.
'use strict';
const fs = require('fs'), path = require('path'), vm = require('vm');
const files = ['util.js', 'defs.js', 'world.js', 'path.js', 'sim.js', 'ai.js', 'missions.js', 'orders.js', 'lockstep.js'];
const src = files.map((f) => fs.readFileSync(path.join(__dirname, '..', 'js', f), 'utf8')).join('\n') +
  '\n;globalThis.__api = { newGame, simStep, getS: () => S, hashState, applyOrder, MP, mpStart, mpJoin, mpIn, mpFrame, getME: () => ME, setCrew: (c) => { S.crew = c; }, captureBuilding, addBot, killBot, getE, FALLEN };' +
  // (the script's own steps, run inside the game's step on every device at the same tick: globalThis.__hook)
  '\n;{ const step0 = simStep; simStep = function (dt) { step0(dt); if (globalThis.__hook) globalThis.__hook(); }; }';
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
  ctx.__hook = () => { if (HOOK) HOOK(api); };
  return api;
}
let HOOK = null;

/** A free ground tile near (x, y) for a site (none of the colony's buildings or goods on it), the n-th found. */
function freeNear(S, x, y, n) {
  let k = 0;
  for (let r = 3; r < 9; r++) for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) {
    if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
    const i = x + dx, j = y + dy, t = j * S.W + i;
    if (i < 1 || j < 1 || i >= S.W - 1 || j >= S.H - 1 || S.terrain[t] !== 0 || S.bAt[t] || S.res[t] || S.ramp[t] || S.road[t]) continue;
    if (k++ === n) return [i, j];
  }
  return null;
}

function run(kind) {
  const log = [], devs = [];
  let seq = 0;
  const send = (msg) => { log.push({ ...JSON.parse(JSON.stringify(msg)), seq: ++seq }); };
  const deliver = () => { while (log.length) { const m = log.shift(); for (const d of devs) if (d.live) d.mpIn(JSON.parse(JSON.stringify(m))); } };
  // The places people play: side by side, places 0 and 1 (a colony each); shared, places 0 and 2 (place 2 runs colony 0).
  const teams = kind === 'teams', pair = kind === 'pair', fall = pair || teams, me = fall ? [0, 1] : [0, 2], people = me.slice();
  const opts = teams ? { seed: 9090, difficulty: 'normal', mode: 'versus', teams: true, players: 4, shape: 0, humans: [0, 1], unlimited: true }
    : { seed: 9090, difficulty: 'normal', mode: 'colony', murmur: 'active', humans: pair ? [0, 1] : [0], horde: { level: 'normal', goal: 'endless', pair, crew: pair ? 1 : 2 }, unlimited: true };
  // The fallen ally's script (game seconds), the same on every device (HOOK, in the game's step), and its checks.
  const T = { fall: 40, lend: 50, help: 58, reload: 70, retake: 100, own: 150, fall2: 175, fall3: 180 }, at = (sec) => Math.round(sec * 30);
  const seen = {}, note = (k, v) => { if (seen[k] === undefined) seen[k] = v; };
  HOOK = !fall ? null : (g) => {
    const S = g.getS(), L0 = g.getE(S.players[0].lander), L1 = g.getE(S.players[1].lander);
    if (S.tick === at(T.fall)) { if (teams) g.captureBuilding(L1, 2); else L1.armor = 1; }
    if (S.tick === at(T.fall) + 45) note('down', !!(S.players[1].out && S.players[1].down && S.winner < 0));
    if (!teams && S.tick >= at(T.retake) && S.tick % 30 === 0 && S.players[1].down) {
      // (Horde: the survivor's warbots hold the ruin; the Murmur near it are cleared away, the same on every device)
      if (S.tick === at(T.retake)) { const ids = []; for (let k = 0; k < 6; k++) { const u = g.addBot(0, 'warbot', L1.x + 2, L1.y + (k % 3) - 1); u.ammo = 99; ids.push(u.id); } g.applyOrder(0, 'command', [ids, { i: L1.x + 2, j: L1.y }]); }
      for (const u of S.bots) if (!u.dead && u.hw && Math.abs(u.x - L1.x) < 7 && Math.abs(u.y - L1.y) < 7) g.killBot(u, true);
    }
    if (teams && S.tick === at(T.retake)) g.captureBuilding(L1, 0);
    if (S.tick === at(T.retake) + (teams ? 45 : at(g.FALLEN.retake.secs + 8))) note('back', !S.players[1].out && !S.players[1].down && S.players[1].help === undefined && L1.owner === 1);
    if (teams && S.tick === at(T.fall2)) g.captureBuilding(L1, 2);
    if (teams && S.tick === at(T.fall2) + 30) note('down2', !!S.players[1].down);
    if (teams && S.tick === at(T.fall3)) g.captureBuilding(L0, 3);
    if (teams && S.tick === at(T.fall3)) note('lost', S.winner >= 2 && !S.players[1].down && S.players[0].out && S.players[1].out);
  };
  const sent = {}, res = {};
  const tryPlace = (d, key, L) => {
    if (sent[key] !== undefined && (res[key] === undefined || res[key].ok || sent[key] > 6)) return;
    sent[key] = (sent[key] || 0) + 1;
    const spot = freeNear(d.getS(), L.x, L.y, sent[key] * 3);
    if (spot) d.MP.order('place', ['wall', spot[0], spot[1]], (r) => { res[key] = r ? { ok: r.ok, owner: r.ok ? d.getS().buildings.find((b) => b.id === r.id).owner : -1 } : { ok: false, refused: true }; });
  };
  for (const k of [0, 1]) {
    const d = device(send);
    d.newGame(opts);
    if (!pair) d.setCrew([{ n: 'Ada', c: 0 }, null, { n: 'Bo', c: 0 }]);
    d.mpStart({ me: me[k], humans: people, send });
    d.live = true;
    devs.push(d);
  }
  const S0 = devs[0].getS();
  console.log(S0.horde ? `${kind}: map ${S0.W}x${S0.H}, colonies ${S0.horde.ps ? S0.horde.ps.join('+') : 0}, waves x${S0.horde.mul || 1}, wild owner ${S0.wildOwner}, lanes ${S0.horde.lanes.length}` : `${kind}: map ${S0.W}x${S0.H}, teams ${S0.teams}`);
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
        if (Sd.players[col].out) continue; // (down: watching)
        const dir = (Sd.horde ? Math.sign(Sd.horde.my - L.y) : Math.sign(Sd.H / 2 - L.y)) || -1, n = (step / 150) | 0;
        d.MP.order('place', [n % 3 === 0 ? 'wall' : n % 3 === 1 ? 'turret' : 'minigun', L.x - 6 + ((n * 5 + k * 3) % 13), L.y + dir * (5 + (n % 4))]);
        orders++;
      }
    }
    let up = 0;
    for (const u of S.bots) if (!u.dead && u.hw) up++;
    peakUp = Math.max(peakUp, up);
    // The fallen ally's orders: refused while down; the survivor lends command; the helper's order lands in colony 0;
    // back, the helper's orders are its own again.
    if (fall) {
      const d0 = devs[0], d1 = devs[1], live1 = d1.live && d1.MP.on && !d1.MPJ && !(d1.fresh && back < 0);
      const t = S.time, L0 = S.buildings.find((b) => b.id === S.players[0].lander), L1 = S.buildings.find((b) => b.id === S.players[1].lander);
      if (t > T.fall + 3 && t < T.lend && live1 && step % 30 === 0) tryPlace(d1, 'refused', L1);
      if (t > T.lend && !sent.lend && d0.MP.on) { sent.lend = 1; d0.MP.order('lend', [1, true], (r) => { res.lend = r; }); }
      if (t > T.help && t < T.reload && live1 && step % 30 === 0) tryPlace(d1, 'helped', L0);
      if (t > T.own && t < T.fall2 && live1 && step % 30 === 0) tryPlace(d1, 'own', L1);
    }
    // Mid-wave, with Murmur up (side by side and Teams: while colony 1 is down): the second device reloads (a fresh page asks for the game).
    if (reloaded < 0 && (fall ? S.time >= T.reload : S.horde.n >= 2 && S.horde.open.length && up >= 8)) {
      reloaded = S.tick;
      devs[1].live = false;
      const d = device(send);
      d.mpJoin({ me: me[1], send, speed: 1 });
      d.live = true; d.fresh = true;
      devs[1] = d; prints[1] = new Map();
      console.log(S.horde ? `  t=${(S.time / 60).toFixed(2)}m: device 2 reloads during wave ${S.horde.n} (${up} Murmur up, ${S.horde.q.length} waiting)${S.players[1].down ? ', its colony down' : ''}`
        : `  t=${(S.time / 60).toFixed(2)}m: device 2 reloads${S.players[1].down ? ', its colony down' : ''}`);
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
  console.log(S.horde ? `  ran to ${(S.time / 60).toFixed(1)}m (device 2 at ${(S1.time / 60).toFixed(1)}m): wave ${S.horde.n}, cleared ${S.horde.cleared}, kills ${S.horde.kills}, peak up ${peakUp}, orders ${orders}, winner ${S.winner}`
    : `  ran to ${(S.time / 60).toFixed(1)}m (device 2 at ${(S1.time / 60).toFixed(1)}m): orders ${orders}, winner ${S.winner}`);
  console.log(`  fingerprints compared ${checks}, differing ${bad}; desyncs seen by the devices ${desyncs.join('/')}; ticks ${S.tick} / ${S1.tick}`);
  let fallOk = true;
  if (fall) {
    const want = { down: seen.down === true, refused: !!(res.refused && res.refused.refused), lend: res.lend === true, helped: !!(res.helped && res.helped.ok && res.helped.owner === 0),
      back: seen.back === true, own: !!(res.own && res.own.ok && res.own.owner === 1), ...(teams ? { down2: seen.down2 === true, lost: seen.lost === true } : {}) };
    fallOk = Object.values(want).every(Boolean);
    console.log(`  fallen ally: ${Object.entries(want).map(([k, v]) => `${k} ${v ? 'ok' : 'FAILED'}`).join(', ')}`);
  }
  const ok = fallOk && bad === 0 && desyncs.every((x) => x === 0) && rejoined && checks > 50 && reloaded > 0 && (!S.horde || S.horde.n >= 3);
  console.log(`  ${ok ? 'OK' : 'FAILED'}${rejoined ? '' : ' (device 2 never rejoined)'}`);
  return ok;
}

let ok = true;
for (const kind of shape === 'both' ? ['pair', 'crew'] : shape === 'all' ? ['pair', 'crew', 'teams'] : [shape]) ok = run(kind) && ok;
if (!ok) process.exitCode = 1;

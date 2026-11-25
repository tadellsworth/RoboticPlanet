#!/usr/bin/env node
// Horde mode, headless: plays a Horde game with the colony on autoplay and reports each wave (its size, how many of the
// waves' Murmur were up at most, when it was cleared), the sim's cost per tick with 30+ Murmur up, and how it ended.
// Usage: node tools/horde-test.js [level easy|medium|normal|hard|warlord] [maxMinutes] [seed] [fixed|endless] [--noai] [--fort] [--pair]
// --pair: co-op side by side (two allied colonies on Long Haul 2v2, the computer playing both).
// --fort: a test fort (not a real game): unlimited goods and a line of finished guns and warbots across the map in front
// of the base, so the later waves come (their sizes, the side tunnels, the boss waves, the sim's cost with many up).
'use strict';
const fs = require('fs'), path = require('path'), vm = require('vm');
const files = ['util.js', 'defs.js', 'world.js', 'path.js', 'sim.js', 'ai.js', 'missions.js', 'orders.js'];
const ctx = { console, Math, JSON, Map, Set, Array, Object, Number, String, Infinity, Uint8Array, Uint16Array, Int8Array, Int32Array, Uint32Array, Float32Array, Float64Array, performance };
ctx.sfx = () => {};
vm.createContext(ctx);
let src = files.map((f) => fs.readFileSync(path.join(__dirname, '..', 'js', f), 'utf8')).join('\n');
src += '\n;globalThis.__fort = (p, t, x, y) => addBuilding(p, t, x, y, true); globalThis.__bot = (p, t, x, y) => addBot(p, t, x, y); globalThis.__zones = () => { computeZones(); computeTerritory(); };';
src += '\n;globalThis.__api = { newGame, simStep, getS: () => S, hordeWaveSize, serializeGame, checkSave: typeof checkSave === "function" ? checkSave : null };';
vm.runInContext(src, ctx);
const api = ctx.__api;
const args = process.argv.slice(2).filter((a) => !a.startsWith('--')), noai = process.argv.includes('--noai'), fort = process.argv.includes('--fort'), pair = process.argv.includes('--pair');
const level = args[0] || 'normal', maxMin = +(args[1] || 40), seed = +(args[2] || 4242), goal = args[3] || 'fixed';
api.newGame({ seed, difficulty: 'normal', autoplay: !noai, horde: { level, goal, pair }, unlimited: fort });
let S = api.getS();
if (pair && !noai) S.players[1].ai = true;
if (fort) {
  const L = S.buildings.find((b) => b.type === 'lander' && b.owner === 0), dir = Math.sign(S.horde.my - L.y) || -1;
  for (const [dy, type, every] of [[9, 'minigun', 3], [11, 'turret', 4], [13, 'mortar', 5], [15, 'minigun', 3], [7, 'keep', 12]]) {
    for (let x = 2; x < S.W - 2; x += every) {
      const y = L.y + dir * dy, t = y * S.W + x;
      if (y < 0 || y >= S.H || S.terrain[t] !== 0 || S.bAt[t] || S.res[t] || S.ramp[t]) continue;
      const b = ctx.__fort(0, type, x, y);
      if (b) { b.stock.ammo = 40; b.stock.crystal = 40; }
    }
  }
  for (let k = 0; k < 30; k++) { const u = ctx.__bot(0, k % 3 === 0 ? 'railgunner' : 'warbot', L.x, L.y - 2 * dir); u.ammo = 99; }
  ctx.__zones();
}
const H = S.horde, L0 = S.buildings.find((b) => b.type === 'lander' && b.owner === 0), maw = S.buildings.find((b) => b.type === 'maw');
const L1 = pair ? S.buildings.find((b) => b.type === 'lander' && b.owner === 1) : null;
console.log(`Horde ${level} (${H.goal})${pair ? ' side by side x' + H.mul : ''} seed ${seed}: map ${S.W}x${S.H}, base (${L0.x},${L0.y})${L1 ? ` and (${L1.x},${L1.y}), teams ${S.teams}` : ''}, Maw ${maw ? `(${maw.x},${maw.y})` : 'MISSING'}, mouths ${S.buildings.filter((b) => b.type === 'burrow' && b.maw).length}, lanes ${H.lanes.map((l) => l.length).join('/')}${H.laneP ? ' to ' + H.laneP.join('') : ''}, autoplay ${!noai}`);
const waves = {}, t0 = Date.now();
const slow = [];
let busy = 0, busyMs = 0, busyMax = 0, peak = 0, lastN = 0, lastLog = 0;
while (S.winner < 0 && S.time < maxMin * 60) {
  let up = 0;
  for (const u of S.bots) if (!u.dead && u.hw) up++;
  const a = performance.now();
  api.simStep(1 / 30);
  const ms = performance.now() - a;
  S = api.getS();
  if (up >= 30) { busy++; busyMs += ms; busyMax = Math.max(busyMax, ms); if (ms > 50) slow.push(`${ms.toFixed(0)}ms@t${S.time.toFixed(1)} tick%30=${S.tick % 30}`); }
  peak = Math.max(peak, up);
  if (S.horde.n !== lastN) { lastN = S.horde.n; waves[lastN] = { size: api.hordeWaveSize(lastN, level, S.horde.mul || 1), at: S.time, peak: 0 }; }
  for (const n of Object.keys(waves)) { const w = waves[n]; if (w.cleared === undefined && S.horde.cleared >= +n && !S.horde.open.includes(+n)) w.cleared = S.time; }
  if (waves[lastN]) waves[lastN].peak = Math.max(waves[lastN].peak, up);
  if (S.time - lastLog >= 60) {
    lastLog = S.time;
    const mine = S.bots.filter((u) => !u.dead && u.owner === 0), war = mine.filter((u) => BOTSLIKE(u)).length;
    const col = (p) => { const L = S.buildings.find((b) => b.type === 'lander' && b.owner === p); return `${S.buildings.filter((b) => !b.dead && b.owner === p && b.built).length} bld, ${S.bots.filter((u) => !u.dead && u.owner === p && BOTSLIKE(u)).length} army, base armor ${L ? L.armor.toFixed(0) : '-'}`; };
    console.log(`  t=${(S.time / 60).toFixed(0)}m wave ${S.horde.n} cleared ${S.horde.cleared} up ${up} queued ${S.horde.q.length} kills ${S.horde.kills} | colony: ${col(0)}${pair ? ' | colony 1: ' + col(1) : ''}`);
  }
}
function BOTSLIKE(u) { return ['warbot', 'bulwark', 'torch', 'skirmisher', 'arccaster', 'railgunner'].includes(u.type); }
console.log('wave  size  peakUp  sent   cleared');
for (const n of Object.keys(waves)) { const w = waves[n]; console.log(`${String(n).padStart(4)} ${String(w.size).padStart(5)} ${String(w.peak).padStart(7)} ${(w.at / 60).toFixed(1).padStart(6)}m ${w.cleared !== undefined ? (w.cleared / 60).toFixed(1) + 'm' : '-'}`); }
console.log(`end: winner ${S.winner} (${S.endHow || 'none'}) ${S.horde.won || (S.horde.lost ? 'lost' : '')} at ${(S.time / 60).toFixed(1)} min; waves cleared ${S.horde.cleared}, kills ${S.horde.kills}`);
console.log(`sim cost with 30+ Murmur up: ${busy} ticks, mean ${(busyMs / Math.max(1, busy)).toFixed(2)} ms, max ${busyMax.toFixed(1)} ms; peak up ${peak}; real ${((Date.now() - t0) / 1000).toFixed(1)} s`);
if (slow.length) console.log(`ticks over 50 ms: ${slow.length}${process.argv.includes('--slow') ? ': ' + slow.slice(0, 40).join(', ') : ''}`);
// A save of the game as it ended loads back (checkSave passes on it).
if (api.checkSave) { try { api.checkSave(JSON.parse(api.serializeGame())); console.log('save check: ok'); } catch (e) { console.log('save check: FAILED', e.message); process.exitCode = 1; } }

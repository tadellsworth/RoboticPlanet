const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const source = readFileSync(path.join(__dirname, '..', 'js', 'lockstep.js'), 'utf8');
function client() {
  const context = vm.createContext({});
  vm.runInContext(`
    const SIM_STEP = 1 / 30, GAME_PACE = 1;
    let ME = 0, S = { tick: 0, winner: -1, players: [{id: 0}, {id: 1}], completed: ['before pause'] };
    const sent = [];
    const send = (msg) => sent.push(JSON.stringify(msg));
    const hashState = () => 0;
    const serializeGame = () => JSON.stringify(S);
    const deserializeGame = (json) => { S = JSON.parse(json); };
    const simStep = () => { S.tick++; };
    const applyOrder = (p, name) => S.completed.push(name);
  ` + source, context);
  return (code) => vm.runInContext(code, context);
}

const host = client(), guest = client();
const snapshot = host(`
  mpStart({me: 0, humans: [0, 1], send});
  S.tick = 31;
  MP.begun = 10; MP.turn = 11; MP.paused = true; MP.pausedBy = 0;
  MP.last = [11, 11];
  MP.packets.set(10, new Map([[0, [['before pause']]], [1, []]]));
  MP.packets.set(11, new Map([[0, [['after pause']]], [1, []]]));
  mpIn({t: 'want', p: 1, seq: 33});
  sent[0];
`);
guest(`
  mpJoin({me: 1, send});
  mpIn(${snapshot});
  mpFrame(0.5);
`);
assert.equal(guest('S.tick'), 31);
assert.equal(guest('MP.turn'), 11);
assert.equal(guest('MP.begun'), 10);
assert.equal(guest('MP.pausedBy'), 0);
assert.equal(guest('MP.t0'), 0);
assert.equal(guest('S.completed.join(",")'), 'before pause');
guest(`
  mpIn({t: 'pause', on: false, p: 0, seq: 34});
  mpFrame(0.18);
`);
assert.equal(guest('S.completed.join(",")'), 'before pause,after pause');
assert.equal(guest('S.tick'), 36);
console.log('A mid-turn paused rejoin preserved the tick and applied the queued order once after resuming.');

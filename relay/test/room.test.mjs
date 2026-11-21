// Tests of the relay's game rooms (src/index.js, Room) for what came with polish round 3: hello's caps, each seat's
// Ready and colour in the lobby, lobby chat, and in a game chat lines, pings and cursors passed on unnumbered (to: only
// those players) and never logged. The Worker's WebSocketPair and Response are played by small stand-ins.
// Usage: node relay/test/room.test.mjs
import assert from 'node:assert/strict';
import { Room } from '../src/index.js';

globalThis.Response = class { constructor(body, o) { this.status = o && o.status; } };

/** A device's connection: what the room sends it, and a way to speak to the room. */
function connect(room, q) {
  const L = { message: [], close: [], error: [] }, got = [];
  const server = { accept() {}, send(t) { got.push(JSON.parse(t)); }, close() { for (const f of L.close) f({}); }, addEventListener(k, f) { L[k].push(f); } };
  globalThis.WebSocketPair = function () { return { 0: {}, 1: server }; };
  room.fetch({ url: 'http://relay/room/ABCDE?' + new URLSearchParams(q), headers: { get: () => 'websocket' } });
  return { got, say: (m) => { for (const f of L.message) f({ data: JSON.stringify(m) }); }, last: (t) => [...got].reverse().find((m) => m.t === t), all: (t) => got.filter((m) => m.t === t) };
}

const room = new Room({}, {});
const A = connect(room, { id: 'a', name: 'Tad', create: '1' });
const B = connect(room, { id: 'b', name: 'Sam' });
const C = connect(room, { id: 'c', name: 'Kim' });
assert.deepEqual(A.last('hello').caps, ['chat', 'prefs'], 'hello lists what this relay does');

// Ready and colour: kept per seat, in the lobby's seats.
B.say({ t: 'prefs', ready: true, color: 2 });
let seats = A.last('lobby').seats;
assert.equal(seats[1].ready, true); assert.equal(seats[1].color, 2);
assert.equal(seats[0].ready, false); assert.equal(seats[0].color, -1);
B.say({ t: 'prefs', color: 9 }); // (out of range: ignored)
assert.equal(A.last('lobby').seats[1].color, 2);
B.say({ t: 'prefs', ready: false });
assert.equal(A.last('lobby').seats[1].ready, false, 'Ready can be taken back');

// Lobby chat: to the others (not back to the sender), cleaned, rate-limited.
B.say({ t: 'chat', text: 'hi\u0007 all', id: 'x1' });
assert.equal(A.last('chat').text, 'hi  all', 'arrives, a control character made a space');
assert.equal(A.last('chat').by, 1); assert.equal(A.last('chat').name, 'Sam');
assert.ok(!/\u0007/.test(A.last('chat').text), 'control characters go');
assert.equal(B.all('chat').length, 0, 'not echoed to the sender');
assert.equal(C.all('chat').length, 1);
for (let k = 0; k < 10; k++) B.say({ t: 'chat', text: 'spam ' + k });
assert.equal(A.all('chat').length, 6, 'six lines in five seconds at most');
B.say({ t: 'chat', text: '   ' });
assert.equal(A.all('chat').length, 6, 'an empty line is dropped');

// Start: three people, then a game.
A.say({ t: 'start', settings: { mode: 'versus' } });
assert.ok(A.last('start'));
const seq0 = room.seq;
// In a game: chat to the team only (players 0 and 2), unnumbered and not logged.
A.say({ t: 'chat', text: 'go north', team: true, to: [2], id: 'g1' });
assert.equal(C.last('chat').text, 'go north'); assert.equal(C.last('chat').p, 0); assert.equal(C.last('chat').seq, undefined);
assert.ok(!B.all('chat').some((m) => m.text === 'go north'), 'the rival never gets the team\'s line');
assert.equal(room.seq, seq0, 'chat takes no number'); assert.ok(!room.log.some(([, t]) => /go north/.test(t)), '...and is not logged');
// A ping to a teammate only; a cursor (no to) to everyone else.
A.say({ t: 'mark', x: 3, y: 4, to: [2] });
assert.equal(C.last('mark').x, 3); assert.equal(B.all('mark').length, 0);
A.say({ t: 'cur', x: 1, y: 1 });
assert.equal(B.all('cur').length, 1); assert.equal(C.all('cur').length, 1); assert.equal(A.all('cur').length, 0);
// Game messages are still numbered and logged.
A.say({ t: 'turn', turn: 1, o: [] });
assert.equal(room.seq, seq0 + 1); assert.equal(B.last('turn').seq, seq0 + 1);
console.log('room tests: all passed');

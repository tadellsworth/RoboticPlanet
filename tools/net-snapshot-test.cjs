const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const frames = [];
const received = [];
const context = vm.createContext({
  MP: {},
  send: (frame) => frames.push(frame),
  mpIn: (message) => received.push(message),
});
const source = readFileSync(path.join(__dirname, '..', 'js', 'net.js'), 'utf8');
vm.runInContext(source, context);

vm.runInContext(`
  NET.state = 'game';
  NET.seat = 0;
  NET.ws = { readyState: 1, send };
  const boundary = 'x'.repeat(NET_PIECE - JSON.stringify({t: 'snap', data: ''}).length);
  netSend({t: 'snap', data: boundary});
`, context);
assert.equal(frames.length, 1);
assert.equal(frames[0].length, 200000);
assert.equal(JSON.parse(frames.shift()).t, 'snap');

const data = '"\\🚚'.repeat(150000);
context.data = data;
vm.runInContext(`
  NET.ws = null;
  netSend({t: 'snap', data});
  netSend({t: 'turn', turn: 12});
`, context);
assert.equal(frames.length, 0);
vm.runInContext(`
  NET.ws = { readyState: 1, send };
  netIn(JSON.stringify({t: 'hello', seat: 0, host: 0, started: true}));
`, context);

const packets = frames.map((frame) => {
  assert.ok(Buffer.byteLength(frame) < 1 << 20);
  return JSON.parse(frame);
});
const parts = packets.slice(0, -1);
assert.ok(parts.length > 1);
for (const [k, part] of parts.entries()) {
  assert.equal(part.t, 'part');
  assert.equal(part.id, parts[0].id);
  assert.equal(part.k, k);
  assert.equal(part.n, parts.length);
}
assert.ok(frames[0].length > 200000);
assert.equal(packets.at(-1).t, 'turn');
for (const [k, packet] of packets.entries()) {
  context.frame = JSON.stringify({ ...packet, seq: k + 1 });
  vm.runInContext('netIn(frame); netIn(frame);', context);
}
assert.equal(received.length, 2);
assert.equal(received[0].t, 'snap');
assert.equal(received[0].data, data);
assert.equal(received[1].t, 'turn');
console.log('Snapshot framing passed at the boundary and after an offline queue flush.');

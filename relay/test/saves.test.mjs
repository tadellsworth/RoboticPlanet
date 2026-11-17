// Tests of the relay's cloud saves (src/saves.js), through the Worker's own routing (src/index.js), with the Durable
// Object's storage played by an in-memory SQLite database (node:sqlite, Node 22.13 or later).
// Usage: node relay/test/saves.test.mjs
import assert from 'node:assert/strict';
import { gzipSync, gunzipSync } from 'node:zlib';
import { randomBytes } from 'node:crypto';
import { DatabaseSync } from 'node:sqlite';
import worker from '../src/index.js';
import { Saves, saveCode } from '../src/saves.js';

/** The Durable Object's storage: `sql.exec` (as Cloudflare's, ArrayBuffers stored as BLOBs) and the alarm. */
function fakeState() {
  const db = new DatabaseSync(':memory:');
  let alarm = null;
  const sql = {
    exec(q, ...binds) {
      const st = db.prepare(q), b = binds.map((x) => (x instanceof ArrayBuffer ? new Uint8Array(x) : x));
      const rows = /^\s*SELECT/i.test(q) ? st.all(...b) : (st.run(...b), []);
      return { toArray: () => rows, one: () => rows[0] };
    },
  };
  return { db, storage: { sql, getAlarm: async () => alarm, setAlarm: async (t) => { alarm = t; }, deleteAlarm: async () => { alarm = null; } } };
}

function setup() {
  const state = fakeState(), obj = new Saves(state);
  const ns = { idFromName: (n) => n, get: () => ({ fetch: (url, init) => obj.fetch(new Request(url, init)) }) };
  return { state, obj, env: { SAVES: ns } };
}

const SITE = 'https://terrafall.app';
let now = Date.UTC(2026, 10, 17, 12);
const realNow = Date.now;
Date.now = () => now;

function call(env, method, path, { body, key, origin = SITE, ip = '203.0.113.5', gzip = true, headers = {} } = {}) {
  const h = { 'cf-connecting-ip': ip, ...headers };
  if (origin) h.origin = origin;
  if (key) h.authorization = 'Bearer ' + key;
  if (gzip) h['accept-encoding'] = 'gzip, br';
  if (body) h['content-type'] = 'application/gzip';
  return worker.fetch(new Request('https://relay.example' + path, { method, headers: h, body }), env);
}

const saveFile = (minutes = 12, extra = {}) => JSON.stringify({ terrafall: 1, savedAt: '2026-11-17T12:00:00.000Z', mode: 'versus', minutes, game: JSON.stringify({ v: 1, W: 40, H: 56, filler: 'x'.repeat(5000) }), ...extra });
const gz = (text) => gzipSync(Buffer.from(text));
const json = async (r) => r.json();

const tests = [];
const test = (name, fn) => tests.push([name, fn]);

test('the code: 10 letters of the alphabet, with or without the dash, any case', () => {
  assert.equal(saveCode('k7pq4-xmr2b'), 'K7PQ4XMR2B');
  assert.equal(saveCode(' K7PQ4 XMR2B '), 'K7PQ4XMR2B');
  assert.equal(saveCode('K7PQ4-XMR2'), '');
  assert.equal(saveCode('K7PQ4-XMR2O'), ''); // (no O, 0, I, L or 1)
  assert.equal(saveCode('K7PQ4-XMR21'), '');
});

test('create, then read it back (gzipped as sent, JSON, nosniff), by the code in any form', async () => {
  const { env } = setup();
  const text = saveFile();
  const r = await call(env, 'POST', '/save', { body: gz(text) });
  assert.equal(r.status, 201);
  assert.equal(r.headers.get('access-control-allow-origin'), SITE);
  const o = await json(r);
  assert.match(o.code, /^[A-HJKMNP-Z2-9]{10}$/);
  assert.match(o.key, /^[0-9a-f]{32}$/);
  assert.equal(o.expires, now + 30 * 86400e3);
  for (const c of [o.code, o.code.slice(0, 5) + '-' + o.code.slice(5), o.code.toLowerCase()]) {
    const g = await call(env, 'GET', '/save/' + c);
    assert.equal(g.status, 200);
    assert.equal(g.headers.get('content-type'), 'application/json; charset=utf-8');
    assert.equal(g.headers.get('x-content-type-options'), 'nosniff');
    assert.equal(g.headers.get('content-encoding'), 'gzip');
    assert.match(g.headers.get('content-security-policy'), /sandbox/);
    assert.equal(gunzipSync(Buffer.from(await g.arrayBuffer())).toString(), text);
  }
  // A client that doesn't take gzip gets the JSON itself.
  const p = await call(env, 'GET', '/save/' + o.code, { gzip: false });
  assert.equal(p.status, 200);
  assert.equal(p.headers.get('content-encoding'), null);
  assert.equal(await p.text(), text);
});

test('the store keeps the gzipped body, a hash of the key, when it was written and the size', async () => {
  const { env, state } = setup();
  const body = gz(saveFile());
  const o = await json(await call(env, 'POST', '/save', { body }));
  const row = state.db.prepare('SELECT * FROM saves').get();
  assert.equal(row.code, o.code);
  assert.deepEqual(Buffer.from(row.body), body);
  assert.equal(row.size, body.length);
  assert.equal(row.at, now);
  assert.notEqual(row.keyhash, o.key);
  assert.match(row.keyhash, /^[0-9a-f]{64}$/);
});

test('update with the key: same code, new game, 30 days from now', async () => {
  const { env } = setup();
  const o = await json(await call(env, 'POST', '/save', { body: gz(saveFile(1)) }));
  now += 5 * 86400e3;
  const r = await call(env, 'PUT', '/save/' + o.code, { body: gz(saveFile(99)), key: o.key });
  assert.equal(r.status, 200);
  const u = await json(r);
  assert.equal(u.code, o.code);
  assert.equal(u.expires, now + 30 * 86400e3);
  const g = await call(env, 'GET', '/save/' + o.code);
  assert.equal(JSON.parse(gunzipSync(Buffer.from(await g.arrayBuffer()))).minutes, 99);
});

test('update or delete with the wrong key (or none) is refused and changes nothing', async () => {
  const { env } = setup();
  const o = await json(await call(env, 'POST', '/save', { body: gz(saveFile(1)) }));
  const wrong = randomBytes(16).toString('hex');
  assert.equal((await call(env, 'PUT', '/save/' + o.code, { body: gz(saveFile(2)), key: wrong })).status, 403);
  assert.equal((await call(env, 'PUT', '/save/' + o.code, { body: gz(saveFile(2)) })).status, 403);
  assert.equal((await call(env, 'DELETE', '/save/' + o.code, { key: wrong })).status, 403);
  assert.equal((await call(env, 'DELETE', '/save/' + o.code, { key: 'nope' })).status, 403);
  const g = await call(env, 'GET', '/save/' + o.code);
  assert.equal(JSON.parse(gunzipSync(Buffer.from(await g.arrayBuffer()))).minutes, 1);
});

test('delete with the key: gone', async () => {
  const { env } = setup();
  const o = await json(await call(env, 'POST', '/save', { body: gz(saveFile()) }));
  const d = await call(env, 'DELETE', '/save/' + o.code, { key: o.key });
  assert.equal(d.status, 200);
  const g = await call(env, 'GET', '/save/' + o.code);
  assert.equal(g.status, 404);
  assert.equal((await json(g)).why, 'none');
  assert.equal((await call(env, 'PUT', '/save/' + o.code, { body: gz(saveFile()), key: o.key })).status, 404);
});

test('a code nobody has: 404', async () => {
  const { env } = setup();
  const r = await call(env, 'GET', '/save/K7PQ4-XMR2B');
  assert.equal(r.status, 404);
  assert.equal((await json(r)).why, 'none');
  assert.equal(r.headers.get('content-type'), 'application/json');
  assert.equal(r.headers.get('x-content-type-options'), 'nosniff');
});

test('expiry: 30 days after the last write (reads don\'t renew it), then gone; the daily sweep clears the rest', async () => {
  const { env, obj, state } = setup();
  const a = await json(await call(env, 'POST', '/save', { body: gz(saveFile()) }));
  const b = await json(await call(env, 'POST', '/save', { body: gz(saveFile()) }));
  assert.ok((await state.storage.getAlarm()) > now, 'a sweep is booked');
  now += 29 * 86400e3;
  assert.equal((await call(env, 'GET', '/save/' + a.code)).status, 200);
  now += 1 * 86400e3 + 1;
  const g = await call(env, 'GET', '/save/' + a.code);
  assert.equal(g.status, 410);
  assert.equal((await json(g)).why, 'expired');
  assert.equal((await call(env, 'GET', '/save/' + a.code)).status, 404, 'dropped once found expired');
  assert.equal((await call(env, 'PUT', '/save/' + b.code, { body: gz(saveFile()), key: b.key })).status, 410, 'no reviving an expired one');
  // b was dropped by that PUT; a third, written now, outlives the sweep.
  await call(env, 'POST', '/save', { body: gz(saveFile()) });
  const c2 = await json(await call(env, 'POST', '/save', { body: gz(saveFile()) }));
  now += 31 * 86400e3;
  const d = await json(await call(env, 'POST', '/save', { body: gz(saveFile()) }));
  await obj.alarm();
  const left = state.db.prepare('SELECT code FROM saves').all().map((r) => r.code);
  assert.deepEqual(left, [d.code]);
  assert.ok(!left.includes(c2.code));
  assert.ok((await state.storage.getAlarm()) > now, 'the next sweep is booked');
});

test('size: over 256 KB gzipped is refused (by its stated length, and by what actually comes)', async () => {
  const { env } = setup();
  const big = gz(saveFile(1, { noise: randomBytes(300 * 1024).toString('base64') }));
  assert.ok(big.length > 256 * 1024);
  const r = await call(env, 'POST', '/save', { body: big });
  assert.equal(r.status, 413);
  assert.equal((await json(r)).why, 'big');
  const said = await call(env, 'POST', '/save', { body: gz(saveFile()), headers: { 'content-length': String(300 * 1024) } });
  assert.equal(said.status, 413);
  // Sent in pieces with no length given: stopped once past 256 KB.
  const stream = new ReadableStream({ start(c) { for (let k = 0; k < big.length; k += 16384) c.enqueue(big.subarray(k, k + 16384)); c.close(); } });
  const piece = await worker.fetch(new Request('https://relay.example/save', { method: 'POST', headers: { origin: SITE }, body: stream, duplex: 'half' }), env);
  assert.equal(piece.status, 413);
  // Just under the limit is kept.
  const ok = gz(saveFile(1, { noise: randomBytes(240 * 1024).toString('base64') }));
  assert.ok(ok.length < 256 * 1024 && ok.length > 230 * 1024);
  assert.equal((await call(env, 'POST', '/save', { body: ok })).status, 201);
});

test('bad bodies: not gzip, not JSON, not a save file, a gzip bomb, empty', async () => {
  const { env, state } = setup();
  const bad = [
    Buffer.from(saveFile()), // not gzipped
    gz('<html><script>alert(1)</script></html>'),
    gz(JSON.stringify({ hello: 1 })),
    gz(JSON.stringify({ terrafall: 1 })),
    gz(JSON.stringify({ terrafall: 2, game: '{}' })),
    gz(JSON.stringify({ terrafall: 1, game: { v: 1 } })),
    gz(JSON.stringify([1, 2, 3])),
    gzipSync(Buffer.alloc(20 << 20, 32)), // 20 MB of spaces: past what it may unpack to
    Buffer.alloc(0),
  ];
  for (const body of bad) {
    const r = await call(env, 'POST', '/save', { body: body.length ? body : undefined, headers: body.length ? {} : { 'content-type': 'application/gzip' } });
    assert.equal(r.status, 400, 'refused: ' + body.subarray(0, 20).toString('hex'));
    assert.equal((await json(r)).why, 'body');
  }
  assert.equal(state.db.prepare('SELECT COUNT(*) AS n FROM saves').get().n, 0);
  const o = await json(await call(env, 'POST', '/save', { body: gz(saveFile()) }));
  assert.equal((await call(env, 'PUT', '/save/' + o.code, { body: gz('nope'), key: o.key })).status, 400);
});

test('rate limits: 20 writes and 200 reads a day from one address (wrong codes count), others unaffected', async () => {
  const { env } = setup();
  const ip = '198.51.100.7';
  let first = null;
  for (let k = 0; k < 20; k++) {
    const r = await call(env, 'POST', '/save', { body: gz(saveFile()), ip });
    assert.equal(r.status, 201, 'write ' + (k + 1));
    if (!first) first = await json(r);
  }
  const over = await call(env, 'POST', '/save', { body: gz(saveFile()), ip });
  assert.equal(over.status, 429);
  assert.equal((await json(over)).why, 'often');
  assert.equal((await call(env, 'PUT', '/save/' + first.code, { body: gz(saveFile()), key: first.key, ip })).status, 429);
  assert.equal((await call(env, 'POST', '/save', { body: gz(saveFile()), ip: '198.51.100.8' })).status, 201, 'another address');
  for (let k = 0; k < 150; k++) assert.equal((await call(env, 'GET', '/save/K7PQ4XMR2B', { ip })).status, 404);
  for (let k = 0; k < 50; k++) assert.equal((await call(env, 'GET', '/save/' + first.code, { ip })).status, 200);
  assert.equal((await call(env, 'GET', '/save/' + first.code, { ip })).status, 429);
  assert.equal((await call(env, 'GET', '/save/' + first.code, { ip: '198.51.100.8' })).status, 200, 'another address');
  now += 86400e3; // the next day
  assert.equal((await call(env, 'GET', '/save/' + first.code, { ip })).status, 200);
  assert.equal((await call(env, 'POST', '/save', { body: gz(saveFile()), ip })).status, 201);
});

test('CORS: terrafall.app, www and localhost; any other site is refused', async () => {
  const { env } = setup();
  for (const origin of [SITE, 'https://www.terrafall.app', 'http://localhost:8800', 'http://127.0.0.1:8787']) {
    const pre = await call(env, 'OPTIONS', '/save', { origin });
    assert.equal(pre.status, 204);
    assert.equal(pre.headers.get('access-control-allow-origin'), origin);
    assert.match(pre.headers.get('access-control-allow-methods'), /PUT/);
    assert.match(pre.headers.get('access-control-allow-methods'), /DELETE/);
    assert.match(pre.headers.get('access-control-allow-headers'), /authorization/);
    assert.match(pre.headers.get('access-control-allow-headers'), /content-type/);
    const r = await call(env, 'POST', '/save', { body: gz(saveFile()), origin });
    assert.equal(r.status, 201);
    assert.equal(r.headers.get('access-control-allow-origin'), origin);
    assert.match(r.headers.get('vary'), /Origin/);
  }
  for (const origin of ['https://evil.example', 'http://terrafall.app', 'https://terrafall.app.evil.example', 'null']) {
    const pre = await call(env, 'OPTIONS', '/save/K7PQ4XMR2B', { origin });
    assert.equal(pre.status, 403, origin);
    assert.equal(pre.headers.get('access-control-allow-origin'), null);
    const r = await call(env, 'POST', '/save', { body: gz(saveFile()), origin });
    assert.equal(r.status, 403);
    assert.equal((await json(r)).why, 'origin');
  }
  // No Origin at all (not a browser): allowed, with no CORS headers.
  const r = await call(env, 'POST', '/save', { body: gz(saveFile()), origin: null });
  assert.equal(r.status, 201);
  assert.equal(r.headers.get('access-control-allow-origin'), null);
});

test('routing: bad codes, wrong methods, other paths; the relay\'s other answers are as they were', async () => {
  const { env } = setup();
  assert.equal((await call(env, 'GET', '/save/K7PQ4')).status, 400);
  assert.equal((await call(env, 'GET', '/save/K7PQ4-XMR2O')).status, 400);
  assert.equal((await call(env, 'GET', '/save')).status, 405);
  assert.equal((await call(env, 'POST', '/save/K7PQ4XMR2B', { body: gz(saveFile()) })).status, 405);
  assert.equal((await call(env, 'GET', '/save/K7PQ4XMR2B/x')).status, 404);
  assert.equal((await call({}, 'GET', '/save/K7PQ4XMR2B')).status, 503);
  const health = await worker.fetch(new Request('https://relay.example/'), env);
  assert.equal(await health.text(), 'Terrafall relay: ok');
  assert.equal((await worker.fetch(new Request('https://relay.example/saves'), env)).status, 404);
  const fb = await worker.fetch(new Request('https://relay.example/feedback', { method: 'POST', body: '{}' }), env);
  assert.equal(fb.status, 503); // (feedback not set up here: as before)
});

let failed = 0;
for (const [name, fn] of tests) {
  try { await fn(); console.log('ok   ' + name); } catch (e) { failed++; console.log('FAIL ' + name + '\n     ' + (e && e.stack || e)); }
}
Date.now = realNow;
console.log(failed ? `${failed} of ${tests.length} failed` : `all ${tests.length} passed`);
process.exit(failed ? 1 : 0);

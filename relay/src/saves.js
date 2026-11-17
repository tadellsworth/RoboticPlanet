/*
 * Cloud saves: a game carried between devices by a code instead of a file (the game's Save to the cloud in the pause
 * menu and Load from a code on the main menu, js/cloud.js). An entry is the save file Download save file writes
 * (saveFileText in js/ui.js: JSON { terrafall: 1, savedAt, mode, minutes, game }), gzipped in the browser.
 *
 *   POST   /save          body: the gzipped save file              → 201 { ok, code, key, expires }
 *   GET    /save/<code>                                            → 200 the save file (JSON), 404 { why: 'none' },
 *                                                                    410 { why: 'expired' }
 *   PUT    /save/<code>   Authorization: Bearer <key>; body as POST → 200 { ok, code, expires }, 403 { why: 'key' }, 404, 410
 *   DELETE /save/<code>   Authorization: Bearer <key>              → 200 { ok: true }, 403, 404, 410
 *   Any other answer is JSON { ok: false, why }; OPTIONS answers the browser's CORS preflight.
 *
 *   code     10 characters of the room-code alphabet (no I, L, O, 0 or 1), shown as XXXXX-XXXXX and taken with or
 *            without the dash, in any case. About 50 bits and never listed: the code is the only way in, as with a
 *            shared file.
 *   key      32 hex characters (128 bits), given once to the device that made the entry, which can then overwrite or
 *            delete it; only a hash of it is kept.
 *   expires  ms since 1970: 30 days after the entry was last written (reading it doesn't renew it).
 *
 * Kept: a body of at most 256 KB that gunzips (to at most 16 MB) to JSON with terrafall: 1 and a game (a string);
 * otherwise 400 { why: 'body' } (413 { why: 'big' } over 256 KB). An entry is served as application/json with nosniff and
 * a sandboxing policy, so it can't be a web page; gzipped as it was sent (content-encoding: gzip) to a browser that takes
 * that, which every browser does. CORS for terrafall.app and www.terrafall.app, and http://localhost (any port) for
 * testing; a request from any other site is refused (403 { why: 'origin' }).
 *
 * Abuse: from one address (counted by a hash of it, never stored) at most 20 writes (POST, PUT, DELETE) and 200 reads
 * (GET, a wrong code too) a day, then 429 { why: 'often' }. Writes are counted in the object's storage; reads in its
 * memory, as the feedback Gate does (a restart forgets, which only ever lets a few more through).
 *
 * Storage: one Durable Object (Saves, SQLite-backed: binding SAVES, migration v3 in wrangler.toml) holds every entry,
 * { code, body (the gzipped bytes), keyhash, at (when written), size }. Unlike Workers KV it is consistent at once: a
 * save is there for the next device straight away. An entry past its 30 days is dropped when it is asked for, and an
 * alarm once a day sweeps out the rest.
 */

const ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'; // (as the rooms' codes: js/net.js NET_CODES)
const CODE_LEN = 10;
const MAX_BODY = 256 << 10;   // bytes, gzipped
const MAX_JSON = 16 << 20;    // bytes, unpacked (a long game's save file is about 300 KB)
const DAY = 86400e3;
const KEEP = 30 * DAY;        // an entry lives this long after its last write
const WRITES_A_DAY = 20, READS_A_DAY = 200;
/** Where the game is published (a fork on its own address adds it here). */
export const SAVE_ORIGINS = ['https://terrafall.app', 'https://www.terrafall.app'];
const LOCAL = /^http:\/\/(localhost|127\.0\.0\.1|\[::1\])(:\d+)?$/;

/** A code as typed (any case, with or without the dash or spaces) → its 10 characters, or '' if it can't be one. */
export function saveCode(s) {
  const c = String(s || '').toUpperCase().replace(/[\s-]/g, '');
  return c.length === CODE_LEN && [...c].every((ch) => ALPHABET.includes(ch)) ? c : '';
}

function corsFor(origin) {
  if (!origin || !(SAVE_ORIGINS.includes(origin) || LOCAL.test(origin))) return null;
  return { 'access-control-allow-origin': origin, vary: 'Origin' };
}

const PLAIN = { 'x-content-type-options': 'nosniff', 'cache-control': 'no-store' };

function reply(status, body, cors) {
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json', ...PLAIN, ...(cors || {}) } });
}

async function sha(s) {
  const d = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s));
  return [...new Uint8Array(d)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

/** A stream read into one array of bytes, or null once it passes `max` bytes. */
async function readCapped(stream, max) {
  const reader = stream.getReader(), parts = [];
  let n = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    n += value.byteLength;
    if (n > max) { reader.cancel().catch(() => {}); return null; }
    parts.push(value);
  }
  const out = new Uint8Array(n);
  let at = 0;
  for (const p of parts) { out.set(p, at); at += p.byteLength; }
  return out;
}

async function gunzip(bytes, max) {
  return readCapped(new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip')), max);
}

/** Is this gzipped body a Terrafall save file? (It gunzips, within the limit, to JSON with terrafall: 1 and a game.) */
async function isSaveFile(bytes) {
  try {
    const raw = await gunzip(bytes, MAX_JSON);
    if (!raw) return false;
    const o = JSON.parse(new TextDecoder().decode(raw));
    return !!o && typeof o === 'object' && o.terrafall === 1 && typeof o.game === 'string' && o.game.length > 0;
  } catch (e) { return false; }
}

/** The request's body as validated bytes, or an error reply. */
async function saveBody(request, cors) {
  if (+(request.headers.get('content-length') || 0) > MAX_BODY) return reply(413, { ok: false, why: 'big' }, cors);
  const body = request.body ? await readCapped(request.body, MAX_BODY) : new Uint8Array(0);
  if (!body) return reply(413, { ok: false, why: 'big' }, cors);
  if (!body.byteLength || !(await isSaveFile(body))) return reply(400, { ok: false, why: 'body' }, cors);
  return body;
}

/** The relay's /save and /save/<code> (index.js sends them here). */
export async function handleSaves(request, env) {
  const origin = request.headers.get('origin');
  const cors = corsFor(origin);
  if (origin && !cors) return reply(403, { ok: false, why: 'origin' });
  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: { ...cors, 'access-control-allow-methods': 'GET, POST, PUT, DELETE, OPTIONS', 'access-control-allow-headers': 'content-type, authorization', 'access-control-max-age': '86400' } });
  }
  const m = new URL(request.url).pathname.match(/^\/save(?:\/([^/]*))?\/?$/);
  if (!m) return reply(404, { ok: false, why: 'path' }, cors);
  if (!env.SAVES) return reply(503, { ok: false, why: 'off' }, cors);
  const method = request.method;
  const whole = m[1] === undefined || m[1] === '';
  if (whole ? method !== 'POST' : !['GET', 'PUT', 'DELETE'].includes(method)) return reply(405, { ok: false, why: 'method' }, cors);
  const code = whole ? '' : saveCode(decodeURIComponent(m[1]));
  if (!whole && !code) return reply(400, { ok: false, why: 'code' }, cors);
  const key = (request.headers.get('authorization') || '').replace(/^Bearer\s+/i, '').trim();
  if ((method === 'PUT' || method === 'DELETE') && !/^[0-9a-f]{32}$/.test(key)) return reply(403, { ok: false, why: 'key' }, cors);

  let body = null;
  if (method === 'POST' || method === 'PUT') {
    body = await saveBody(request, cors);
    if (body instanceof Response) return body;
  }
  const who = (await sha((request.headers.get('cf-connecting-ip') || 'local') + ':terrafall-saves')).slice(0, 24);
  const op = { POST: 'new', GET: 'get', PUT: 'put', DELETE: 'del' }[method];
  const store = env.SAVES.get(env.SAVES.idFromName('saves'));
  const r = await store.fetch(`https://saves/${op}${code ? '/' + code : ''}`, {
    method: 'POST',
    headers: { 'x-who': who, 'x-key': key ? await sha(key) : '' },
    body,
  });
  if (op !== 'get' || r.status !== 200) return reply(r.status, await r.json().catch(() => ({ ok: false, why: 'store' })), cors);

  // The save itself: gzipped as it came (every browser takes that), or unpacked here for a client that doesn't.
  const gz = new Uint8Array(await r.arrayBuffer());
  const headers = { 'content-type': 'application/json; charset=utf-8', ...PLAIN, 'content-security-policy': "default-src 'none'; sandbox", ...(cors || {}) };
  headers.vary = cors ? 'Origin, Accept-Encoding' : 'Accept-Encoding';
  if (/\bgzip\b/i.test(request.headers.get('accept-encoding') || '')) {
    return new Response(gz, { status: 200, headers: { ...headers, 'content-encoding': 'gzip' }, encodeBody: 'manual' });
  }
  const raw = await gunzip(gz, MAX_JSON);
  return raw ? new Response(raw, { status: 200, headers }) : reply(500, { ok: false, why: 'store' }, cors);
}

function answer(status, body) {
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
}

function newCode() {
  for (;;) {
    let s = '';
    for (const x of crypto.getRandomValues(new Uint8Array(24))) {
      if (x < 248) s += ALPHABET[x % 31]; // (248 = 31 × 8: every character as likely)
      if (s.length === CODE_LEN) return s;
    }
  }
}

function newKey() {
  return [...crypto.getRandomValues(new Uint8Array(16))].map((b) => b.toString(16).padStart(2, '0')).join('');
}

/** The store: every cloud save, in one SQLite-backed Durable Object (handleSaves has checked what comes in). */
export class Saves {
  constructor(state) {
    this.state = state;
    this.sql = state.storage.sql;
    this.sql.exec('CREATE TABLE IF NOT EXISTS saves (code TEXT PRIMARY KEY, body BLOB NOT NULL, keyhash TEXT NOT NULL, at INTEGER NOT NULL, size INTEGER NOT NULL)');
    this.sql.exec('CREATE INDEX IF NOT EXISTS saves_at ON saves (at)');
    this.sql.exec('CREATE TABLE IF NOT EXISTS writes (who TEXT NOT NULL, day INTEGER NOT NULL, n INTEGER NOT NULL, PRIMARY KEY (who, day))');
    this.reads = new Map(); // who → [day, reads that day]
  }

  async fetch(request) {
    const [, op, code = ''] = new URL(request.url).pathname.split('/');
    const who = request.headers.get('x-who') || '', keyhash = request.headers.get('x-key') || '';
    const now = Date.now(), day = Math.floor(now / DAY);
    if (op === 'get') {
      if (!this.read(who, day)) return answer(429, { ok: false, why: 'often' });
      const row = this.find(code, now);
      if (!row || row === 'expired') return answer(row ? 410 : 404, { ok: false, why: row || 'none' });
      return new Response(row.body, { headers: { 'content-type': 'application/octet-stream' } });
    }
    if (!['new', 'put', 'del'].includes(op)) return answer(404, { ok: false, why: 'path' });
    if (!this.write(who, day)) return answer(429, { ok: false, why: 'often' });
    let out;
    if (op === 'new') {
      const body = await request.arrayBuffer();
      let c = newCode();
      while (this.sql.exec('SELECT 1 FROM saves WHERE code = ?', c).toArray().length) c = newCode();
      const key = newKey();
      this.sql.exec('INSERT INTO saves (code, body, keyhash, at, size) VALUES (?, ?, ?, ?, ?)', c, body, await sha(key), now, body.byteLength);
      out = answer(201, { ok: true, code: c, key, expires: now + KEEP });
    } else {
      const row = this.find(code, now);
      if (!row || row === 'expired') return answer(row ? 410 : 404, { ok: false, why: row || 'none' });
      if (!keyhash || row.keyhash !== keyhash) return answer(403, { ok: false, why: 'key' });
      if (op === 'put') {
        const body = await request.arrayBuffer();
        this.sql.exec('UPDATE saves SET body = ?, at = ?, size = ? WHERE code = ?', body, now, body.byteLength, code);
        out = answer(200, { ok: true, code, expires: now + KEEP });
      } else {
        this.sql.exec('DELETE FROM saves WHERE code = ?', code);
        out = answer(200, { ok: true });
      }
    }
    if ((await this.state.storage.getAlarm()) == null) await this.state.storage.setAlarm(now + DAY);
    return out;
  }

  /** The entry under a code: its row, 'expired' (dropped now), or null. */
  find(code, now) {
    const row = this.sql.exec('SELECT body, keyhash, at FROM saves WHERE code = ?', code).toArray()[0];
    if (!row) return null;
    if (row.at + KEEP > now) return row;
    this.sql.exec('DELETE FROM saves WHERE code = ?', code);
    return 'expired';
  }

  /** One more read from this sender today: false past the day's reads. */
  read(who, day) {
    const r = this.reads.get(who);
    if (!r || r[0] !== day) {
      if (this.reads.size > 5000) for (const [k, v] of this.reads) if (v[0] !== day) this.reads.delete(k);
      this.reads.set(who, [day, 1]);
      return true;
    }
    if (r[1] >= READS_A_DAY) return false;
    r[1]++;
    return true;
  }

  /** One more write from this sender today: false past the day's writes. */
  write(who, day) {
    const r = this.sql.exec('SELECT n FROM writes WHERE who = ? AND day = ?', who, day).toArray()[0];
    if (r && r.n >= WRITES_A_DAY) return false;
    this.sql.exec('INSERT INTO writes (who, day, n) VALUES (?, ?, 1) ON CONFLICT (who, day) DO UPDATE SET n = n + 1', who, day);
    return true;
  }

  /** Once a day: entries past their 30 days go, and the counts from before yesterday. */
  async alarm() {
    const now = Date.now();
    this.sql.exec('DELETE FROM saves WHERE at <= ?', now - KEEP);
    this.sql.exec('DELETE FROM writes WHERE day < ?', Math.floor(now / DAY) - 1);
    const left = this.sql.exec('SELECT 1 FROM saves LIMIT 1').toArray().length || this.sql.exec('SELECT 1 FROM writes LIMIT 1').toArray().length;
    if (left) await this.state.storage.setAlarm(now + DAY);
  }
}

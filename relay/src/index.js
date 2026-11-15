/*
 * Terrafall relay: a Cloudflare Worker that passes multiplayer messages between the players of a game.
 *
 * Each game is a room with a short code (ABCDE). A room is one Durable Object: one place, one copy, so every
 * message in it gets a number (seq) in a single order and goes to every player in that order (the sender too).
 * That shared order is all the game needs from the relay (see js/lockstep.js): the game itself runs on every
 * player's device. The room also seats the players (up to four), keeps the lobby (names, the host's settings),
 * and keeps a log of the game's messages, so a device whose connection drops picks up where it left off.
 *
 * A device connects with a WebSocket to  /room/<CODE>?id=<device id>&name=<name>&v=<game version>[&create=1][&since=<seq>][&fresh=1]
 *   create  start a new room with this code (refused if it's in use)
 *   since   reconnecting: send me the log after this message
 *   fresh   reconnecting with nothing (a reloaded page): skip the log, I'll ask for the game
 *
 * From the relay:  hello {seat, code, host, started, seq}   lobby {seats, host, settings}   error {why}
 *                  start {settings, players (null: a computer's colony)}   and every game message, with seq and by
 *                  (the sender's seat).
 * To the relay:    in the lobby: name, settings and start (the host), leave, ping; in a game: anything (passed on).
 */

const MAX_SEATS = 4;
const MAX_MSG = 1 << 20;     // bytes: bigger messages (a whole game) come in pieces
const MAX_LOG = 48 << 20;    // bytes of log kept (the oldest pieces of whole games go first)
const CODE = /^[A-Z2-9]{4,8}$/;

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname === '/' || url.pathname === '/health') {
      return new Response('Terrafall relay: ok', { headers: { 'content-type': 'text/plain', 'access-control-allow-origin': '*' } });
    }
    const m = url.pathname.match(/^\/room\/([A-Za-z0-9]+)$/);
    if (!m || !CODE.test(m[1].toUpperCase())) return new Response('Not found', { status: 404 });
    if (request.headers.get('Upgrade') !== 'websocket') return new Response('Expected a WebSocket', { status: 426 });
    const room = env.ROOMS.get(env.ROOMS.idFromName(m[1].toUpperCase()));
    return room.fetch(request);
  },
};

export class Room {
  constructor(state, env) {
    this.state = state;
    this.code = '';
    this.seats = [];        // seat → { id, name, ws, on } (null: an empty seat)
    this.started = false;
    this.players = [];      // once started: the seats playing, in player order
    this.settings = null;   // the host's settings
    this.seq = 0;
    this.log = [];          // [seq, text] of the game's messages
    this.logBytes = 0;
  }

  async fetch(request) {
    const url = new URL(request.url);
    const q = url.searchParams;
    this.code = this.code || url.pathname.split('/').pop().toUpperCase();
    const pair = new WebSocketPair();
    const [client, ws] = Object.values(pair);
    ws.accept();
    const id = (q.get('id') || '').slice(0, 40), name = clean(q.get('name')) || 'Player', v = (q.get('v') || '').replace(/[^a-z0-9]/gi, '').slice(0, 16);
    const fail = (why) => { send(ws, { t: 'error', why }); ws.close(1000, why); return new Response(null, { status: 101, webSocket: client }); };
    if (!id) return fail('bad');
    let seat = this.seats.findIndex((s) => s && s.id === id);
    const empty = !this.seats.some((s) => s);
    if (q.get('create') === '1' && seat < 0 && !empty) return fail('taken');
    if (q.get('create') !== '1' && empty) return fail('none');
    if (seat < 0) {
      if (this.started) return fail('started');
      seat = this.seats.findIndex((s) => !s);
      if (seat < 0) seat = this.seats.length;
      if (seat >= MAX_SEATS) return fail('full');
      this.seats[seat] = { id, name, v, ws: null, on: false };
    }
    const S = this.seats[seat];
    if (S.ws && S.ws !== ws) { try { S.ws.close(1000, 'replaced'); } catch (e) { /* gone already */ } }
    S.ws = ws; S.on = true;
    if (!this.started && name) S.name = name;
    S.v = v || S.v;
    ws.addEventListener('message', (e) => this.onMessage(seat, ws, e.data));
    const bye = () => { if (S.ws === ws) { S.ws = null; S.on = false; this.presence(); } };
    ws.addEventListener('close', bye);
    ws.addEventListener('error', bye);
    send(ws, { t: 'hello', seat, code: this.code, host: this.host(), started: this.started, seq: this.seq });
    if (this.started) {
      // Back in a game: the start, then (unless it has nothing to catch up from) the log since its last message.
      send(ws, this.startMsg);
      if (q.get('fresh') !== '1') { const since = +q.get('since') || 0; for (const [s, text] of this.log) if (s > since) ws.send(text); }
    }
    this.presence();
    return new Response(null, { status: 101, webSocket: client });
  }

  /** The host: the first seat that's connected (it sets the game up, and starts it). */
  host() { const k = this.seats.findIndex((s) => s && s.on); return k; }

  /** Everyone's told who's here (the lobby, or who's connected in a game). */
  presence() {
    const seats = this.seats.map((s, k) => (s ? { seat: k, name: s.name, on: s.on, v: s.v } : null)).filter(Boolean);
    this.broadcast({ t: 'lobby', code: this.code, host: this.host(), started: this.started, seats, settings: this.settings });
  }

  onMessage(seat, ws, data) {
    if (typeof data !== 'string' || data.length > MAX_MSG) return;
    let msg;
    try { msg = JSON.parse(data); } catch (e) { return; }
    if (!msg || typeof msg !== 'object' || typeof msg.t !== 'string') return;
    const S = this.seats[seat];
    if (!S || S.ws !== ws) return;
    if (msg.t === 'ping') { send(ws, { t: 'pong', at: msg.at }); return; }
    if (!this.started) {
      // The lobby.
      if (msg.t === 'name') { S.name = clean(msg.name) || S.name; this.presence(); return; }
      if (msg.t === 'leave') { this.seats[seat] = null; try { ws.close(1000, 'left'); } catch (e) { /* closed */ } this.presence(); return; }
      if (seat !== this.host()) return;
      if (msg.t === 'settings') { this.settings = msg.settings || null; this.presence(); return; }
      if (msg.t === 'start') {
        const on = this.seats.map((s, k) => (s && s.on ? k : -1)).filter((k) => k >= 0);
        if (!on.length) return;
        // Who plays which colony: the seats in order, or (teams) the host's arrangement, -1 for a computer's colony.
        let slots = on;
        if (Array.isArray(msg.slots) && msg.slots.length <= MAX_SEATS) {
          const sl = msg.slots.map((k) => (Number.isInteger(k) && k >= 0 ? k : -1)), used = sl.filter((k) => k >= 0);
          if (used.length === on.length && new Set(used).size === used.length && on.every((k) => used.includes(k))) slots = sl;
        }
        this.players = slots;
        this.started = true;
        this.settings = msg.settings || this.settings;
        this.startMsg = { t: 'start', settings: this.settings, players: slots.map((k) => (k >= 0 ? { seat: k, name: this.seats[k].name } : null)) };
        // (seats nobody took up are let go: no-one new joins a game under way)
        this.seats = this.seats.map((s, k) => (this.players.includes(k) ? s : null));
        this.broadcast(this.startMsg);
        this.presence();
      }
      return;
    }
    // A game under way: stamp it and pass it on to everyone, in order. A player only speaks for itself.
    const me = this.players.indexOf(seat);
    if (me < 0) return;
    if (msg.t === 'turn' || msg.t === 'want' || msg.t === 'rejoin') msg.p = me;
    msg.by = seat;
    msg.seq = ++this.seq;
    const text = JSON.stringify(msg);
    this.log.push([msg.seq, text]);
    this.logBytes += text.length;
    // (a long game: the oldest big pieces go first, then the oldest of anything)
    while (this.logBytes > MAX_LOG && this.log.length > 1) { const [, t] = this.log.shift(); this.logBytes -= t.length; }
    for (const s of this.seats) if (s && s.ws) { try { s.ws.send(text); } catch (e) { /* closing */ } }
  }

  broadcast(msg) {
    const text = JSON.stringify(msg);
    for (const s of this.seats) if (s && s.ws) { try { s.ws.send(text); } catch (e) { /* closing */ } }
  }
}

function send(ws, msg) { try { ws.send(JSON.stringify(msg)); } catch (e) { /* closed */ } }
function clean(s) { return String(s || '').replace(/[^\p{L}\p{N} _.'-]/gu, '').trim().slice(0, 16); }

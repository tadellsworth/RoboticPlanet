'use strict';
/*
 * Terrafall — the connection to the multiplayer relay (relay/ in the repository: a small Cloudflare Worker). It makes
 * and joins rooms (a five-letter code), keeps the lobby, and carries the game's messages (lockstep.js) both ways.
 * A dropped connection (a phone locked for a moment, a train going into a tunnel) comes back by itself and picks up
 * the messages it missed; a reloaded page rejoins the game it was in (see netRejoinInfo) and asks for the game.
 * The screens (ui.js, the Multiplayer section) hang their hooks on NET.on*.
 */

/** The relay's address (deployed by .github/workflows/relay.yml; see README, Multiplayer); ?relay=<address> overrides it. */
const RELAY_DEFAULT = 'wss://terrafall-relay.tadellsworth.workers.dev';

const NET = {
  url: '', ws: null, state: 'off', // off | connecting | lobby | game
  code: '', id: '', name: '', me: -1, seat: -1, host: -1, seats: [], settings: null, started: false,
  seq: 0,            // the latest relay message taken in
  outbox: [],        // game messages waiting for the connection to come back
  tries: 0, timer: 0, lastIn: 0, pingT: 0, ping: 0, error: '', fresh: false, startMsg: null,
  parts: new Map(),  // big messages coming in pieces: id → parts
  partId: 0,
  onLobby: null, onStart: null, onError: null, onLink: null,
};
const NET_PIECE = 200000; // characters a piece, for messages bigger than that (a whole game)
const NET_CODES = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'; // (no I, L, O, 0 or 1: easy to read out)

/** The relay's address (wss://...), or '' if multiplayer isn't set up. */
function relayUrl() {
  let u = '';
  try { u = new URLSearchParams(location.search).get('relay') || localStorage.getItem('terrafall.relay') || ''; } catch (e) { /* storage blocked */ }
  try { if (new URLSearchParams(location.search).get('relay')) localStorage.setItem('terrafall.relay', u); } catch (e) { /* storage blocked */ }
  u = (u || RELAY_DEFAULT).trim().replace(/\/+$/, '');
  if (!u) return '';
  if (!/^wss?:\/\//.test(u)) u = u.replace(/^https?:\/\//, (m) => (m === 'http://' ? 'ws://' : 'wss://'));
  if (!/^wss?:\/\//.test(u)) u = 'wss://' + u;
  return u;
}

/**
 * This copy of the game, as a short fingerprint of the code that plays it (devices with different versions would play
 * different games): shown in the lobby, so everyone can make sure they have the same one.
 */
function gameVersion() {
  if (NET.ver) return NET.ver;
  const src = [simStep, newGame, aiSearchSpot, applyOrder, hashState, serializeGame, deserializeGame, mpBeginTurn].map(String).join('|') + Object.keys(ORDERS).join(',') + JSON.stringify(BDEFS).length + JSON.stringify(BOTS).length + JSON.stringify(SIZE_PRESETS);
  let h = 2166136261;
  for (let k = 0; k < src.length; k++) h = Math.imul(h ^ src.charCodeAt(k), 16777619);
  NET.ver = (h >>> 0).toString(36);
  return NET.ver;
}

function netRandomCode() { let s = ''; for (let k = 0; k < 5; k++) s += NET_CODES[Math.floor(Math.random() * NET_CODES.length)]; return s; }
function netRandomId() { return Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4); }

/** This device's player name (remembered). */
function netName() { try { return localStorage.getItem('terrafall.name') || ''; } catch (e) { return ''; } }
function netSetName(n) { try { localStorage.setItem('terrafall.name', n); } catch (e) { /* storage blocked */ } }

/** The game this device was in (room code, id, when), for rejoining after the page reloads. */
function netRejoinInfo() {
  try {
    const o = JSON.parse(sessionStorage.getItem('terrafall.mp') || localStorage.getItem('terrafall.mp') || 'null');
    return o && o.code && o.id && Date.now() - o.at < 3 * 3600e3 ? o : null;
  } catch (e) { return null; }
}
function netRemember(on) {
  try {
    if (!on) { sessionStorage.removeItem('terrafall.mp'); localStorage.removeItem('terrafall.mp'); return; }
    const o = JSON.stringify({ code: NET.code, id: NET.id, at: Date.now() });
    sessionStorage.setItem('terrafall.mp', o); localStorage.setItem('terrafall.mp', o);
  } catch (e) { /* storage blocked */ }
}

/** Start a new room (create) or join one by its code. fresh: rejoining a game with nothing (a reloaded page). */
function netConnect(code, opts) {
  netClose(true);
  const o = opts || {};
  Object.assign(NET, {
    url: relayUrl(), code: String(code || '').toUpperCase(), id: o.id || netRandomId(), name: o.name || netName() || 'Player',
    state: 'connecting', me: -1, seat: -1, host: -1, seats: [], settings: null, started: false, seq: 0, outbox: [],
    tries: 0, error: '', fresh: !!o.fresh, create: !!o.create, joined: false, startMsg: null, parts: new Map(),
  });
  if (!NET.url) { NET.state = 'off'; NET.error = 'norelay'; if (NET.onError) NET.onError('norelay'); return; }
  netOpen();
}

function netOpen() {
  clearTimeout(NET.timer);
  const q = new URLSearchParams({ id: NET.id, name: NET.name, v: gameVersion() });
  if (NET.create && !NET.joined) q.set('create', '1'); // (only the first time: after that the room is there, or gone)
  if (NET.seq) q.set('since', String(NET.seq));
  if (NET.fresh && !NET.seq) q.set('fresh', '1');
  let ws;
  try { ws = new WebSocket(`${NET.url}/room/${NET.code}?${q}`); } catch (e) { netRetry(); return; }
  NET.ws = ws;
  ws.onmessage = (e) => { if (NET.ws === ws) netIn(e.data); };
  ws.onclose = () => { if (NET.ws === ws) { NET.ws = null; netLink(); netRetry(); } };
  ws.onerror = () => { /* (onclose follows) */ };
}

/** The connection dropped: try again soon (a little longer each time, up to 4 s), unless we've left. */
function netRetry() {
  if (NET.state === 'off') return;
  NET.tries++;
  // Never got in at all after a few tries: the relay can't be reached from here.
  if (!NET.joined && NET.tries >= 4) { netClose(true); NET.error = 'unreachable'; if (NET.onError) NET.onError('unreachable'); return; }
  clearTimeout(NET.timer);
  NET.timer = setTimeout(() => { if (NET.state !== 'off' && !NET.ws) netOpen(); }, Math.min(4000, 300 * NET.tries));
}

/** Leave the room (quietly: no message). */
function netClose(quiet) {
  clearTimeout(NET.timer);
  const ws = NET.ws;
  NET.ws = null; NET.state = 'off';
  if (ws) { try { ws.close(1000, 'bye'); } catch (e) { /* closed */ } }
  if (!quiet) netLink();
}

function netRaw(text) { if (NET.ws && NET.ws.readyState === 1) { NET.ws.send(text); return true; } return false; }

/** Send a message: in the lobby straight away (or not at all); in a game, kept until the connection's back. */
function netSend(msg) {
  const text = JSON.stringify(msg);
  if (text.length > NET_PIECE) {
    const id = NET.seat + '.' + ++NET.partId, n = Math.ceil(text.length / NET_PIECE);
    for (let k = 0; k < n; k++) {
      const part = { t: 'part', id, k, n, s: text.slice(k * NET_PIECE, (k + 1) * NET_PIECE) };
      netSendFrame(JSON.stringify(part));
    }
    return;
  }
  netSendFrame(text);
}

// Send an already framed message. A part's JSON framing can exceed the split threshold.
function netSendFrame(text) {
  if (NET.state === 'game') { if (NET.outbox.length || !netRaw(text)) NET.outbox.push(text); } else netRaw(text);
}

/** The lobby: my name, and (the host) the game's settings and the start. */
function netLobbySend(msg) { netRaw(JSON.stringify(msg)); }

/** Is the relay getting through (connected, and something heard lately)? */
function netLinkOK() { return !!NET.ws && NET.ws.readyState === 1 && Date.now() - NET.lastIn < 4000; }
function netLink() { MP.linkOK = netLinkOK(); if (NET.onLink) NET.onLink(MP.linkOK); }

function netIn(text) {
  NET.lastIn = Date.now();
  let m;
  try { m = JSON.parse(text); } catch (e) { return; }
  switch (m.t) {
    case 'hello':
      NET.seat = m.seat; NET.host = m.host; NET.started = m.started; NET.tries = 0; NET.joined = true;
      if (!m.started) NET.state = 'lobby';
      else {
        NET.state = 'game';
        if (NET.fresh && !NET.seq) NET.seq = m.seq; // (a reloaded page: the game comes as a snap, not from the log)
        while (NET.outbox.length && netRaw(NET.outbox[0])) NET.outbox.shift();
      }
      netLink();
      return;
    case 'lobby':
      NET.seats = m.seats || []; NET.host = m.host; NET.settings = m.settings; NET.started = m.started;
      if (NET.onLobby) NET.onLobby();
      return;
    case 'error':
      NET.error = m.why;
      netClose(true);
      if (NET.onError) NET.onError(m.why);
      return;
    case 'start':
      NET.state = 'game'; NET.started = true; NET.startMsg = m;
      NET.me = m.players.findIndex((p) => p && p.seat === NET.seat);
      netRemember(true);
      if (NET.onStart) NET.onStart(m);
      return;
    case 'pong':
      NET.ping = Date.now() - (m.at || Date.now());
      return;
    default:
  }
  // The game's messages, in the relay's order (once each: a reconnect can bring some again).
  if (m.seq) { if (m.seq <= NET.seq) return; NET.seq = m.seq; }
  if (m.t === 'part') {
    if (!NET.parts.has(m.id)) NET.parts.set(m.id, []);
    const ps = NET.parts.get(m.id);
    ps[m.k] = m.s;
    if (ps.filter((x) => x !== undefined).length < m.n) return;
    NET.parts.delete(m.id);
    try { m = { ...JSON.parse(ps.join('')), seq: m.seq }; } catch (e) { return; }
  }
  if (typeof mpIn === 'function') mpIn(m);
}

/** Every frame: keep the link alive (a ping now and then), and tell the game whether it's getting through. */
function netTick() {
  if (NET.state === 'off') return;
  const now = Date.now();
  if (now - NET.pingT > 4000) { NET.pingT = now; netRaw(JSON.stringify({ t: 'ping', at: now })); }
  // (a socket that went quiet without closing, as a phone's can: start again)
  if (NET.ws && NET.ws.readyState === 1 && now - NET.lastIn > 12000) { const ws = NET.ws; NET.ws = null; try { ws.close(); } catch (e) { /* gone */ } netRetry(); }
  if (MP.on) MP.linkOK = netLinkOK();
}

// Back from the background (a phone unlocked): reconnect at once rather than wait for the retry.
if (typeof document !== 'undefined') {
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && NET.state !== 'off' && (!NET.ws || NET.ws.readyState > 1)) { NET.tries = 0; NET.ws = null; netOpen(); }
  });
}

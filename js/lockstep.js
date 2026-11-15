'use strict';
/*
 * Terrafall — lockstep multiplayer. Every device runs the whole game; only the players' orders (orders.js) travel.
 * Time is cut into turns of LS.TURN ticks (a tenth of a second). An order given now is put off LS.DELAY turns and
 * sent to everyone in a packet for that turn; a turn starts only once every player's packet for it is in, and then
 * the orders in them are carried out, player by player, on every device at the same tick. So every device plays the
 * same game, as long as the game itself always does the same thing given the same orders (no Math.random, no
 * clocks, exact maths: see util.js).
 *
 * Messages go through a relay that hands every one to every device in the same order (the sender included): that
 * shared order settles who goes first whenever it matters (a player dropped as their last packet arrives, say).
 * The transport is anything with send(msg); the relay's messages come back in through mpReceive(msg).
 *
 *   turn   { t: 'turn', p, turn, o: [[name, args, seq]...], h: [turn, hash] }  a player's orders for a turn
 *   drop   { t: 'drop', p, from }    the player's colony is run by the computer from that turn (gone quiet, or left)
 *   snap   { t: 'snap', turn, data, hash }  the host's game, at the start of a turn, for a device that went astray
 *   pause  { t: 'pause', on, p }     everyone stops (or goes on) together
 *
 * Every LS.HASH_EVERY turns (once a second, on a tick that's a whole second) each device works out a fingerprint of
 * the game (hashState) and sends it with its next packet. If they differ, the host sends its game at the start of
 * the next such turn, and everyone carries on from there. A player whose packets stop coming for LS.STALL_S seconds
 * is dropped by the host (and their colony is run by the computer, on every device, from the same turn).
 */
const LS = { TURN: 3, DELAY: 3, DELAY_MAX: 15, HASH_EVERY: 10, STALL_S: 12, KEEP: 120, MAX_STEPS: 30 };

const MP = {
  on: false, me: 0, humans: [], send: null, speed: 1,
  t0: 0,            // the turn the game started (or was resumed) on: the first LS.DELAY turns need no packets
  turn: 0,          // the next turn to start
  begun: -1,        // the turn whose ticks are running
  acc: 0,           // seconds of game time owed
  stalled: 0,       // seconds spent waiting for a packet
  waitFor: [],      // who we're waiting for (when stalled)
  q: [],            // my orders not sent yet: [name, args, seq]
  seq: 0, cbs: new Map(), // my orders' callbacks, by seq
  packets: new Map(), // turn → Map(player → orders)
  last: [],         // per player: the latest turn a packet has come in for
  hashes: new Map(), // turn → Map(player → hash)
  sentTo: -1,       // the latest turn I've sent a packet for
  d: LS.DELAY,      // how many turns ahead I send my orders: long enough for them to reach everyone in time (see mpAdapt)
  clock: 0,         // real seconds since the start (for timing the relay)
  sentAt: new Map(), // turn → when I sent my packet for it
  rtt: 0,           // how long my packets take to come back from the relay (seconds, smoothed)
  peerD: [],        // each player's delay, from their packets
  dropped: new Map(), // player → the turn their colony is run by the computer from
  paused: false, desyncs: 0, snapAt: -1, snapTurn: -1, snaps: 0,
  onSnap: null,     // (the screens' hook: the game was replaced by the host's)
  onEvent: null,    // (the screens' hook: a player dropped, a pause, a desync)
};

/**
 * Start a multiplayer game, once every device has made the same new game (same settings and seed). me: this device's
 * player; humans: the players people play (the rest are the computer's); send(msg): the transport.
 */
function mpStart(opts) {
  Object.assign(MP, {
    on: true, me: opts.me, humans: opts.humans.slice().sort((a, b) => a - b), send: opts.send, speed: opts.speed || 1,
    turn: S.tick / LS.TURN | 0, begun: -1, acc: 0, stalled: 0, waitFor: [], q: [], seq: 0, cbs: new Map(),
    packets: new Map(), last: S.players.map(() => -1), hashes: new Map(), sentTo: -1, dropped: new Map(),
    paused: false, desyncs: 0, snapAt: -1, snapTurn: -1, snaps: 0,
    d: LS.DELAY, clock: 0, sentAt: new Map(), rtt: 0, adaptT: 0, peerD: S.players.map(() => LS.DELAY),
  });
  MP.t0 = MP.turn;
  ME = opts.me;
  for (const P of S.players) P.ai = !MP.humans.includes(P.id);
  // The first LS.DELAY turns have no orders: nobody could have given any yet.
  MP.sentTo = MP.turn + LS.DELAY - 1;
}

function mpStop() { MP.on = false; MP.send = null; MP.q = []; MP.cbs.clear(); }

/** The host: the first player still here. It sends its game when a device goes astray, and drops players gone quiet. */
function mpHost() { return MP.humans.find((p) => !MP.dropped.has(p)) ?? -1; }
function mpIsHost() { return mpHost() === MP.me; }

/** An order of mine (see act in ui.js): sent with my next packet, carried out LS.DELAY turns later. */
MP.order = (name, args, cb) => {
  if (!MP.on || MP.dropped.has(MP.me)) return; // (dropped: watching now, the computer runs my colony)
  const seq = ++MP.seq;
  MP.q.push([name, args, seq]);
  if (cb) MP.cbs.set(seq, cb);
};

function mpSend(msg) { if (MP.send) MP.send(msg); }

/** A message from the relay (mine too), in the relay's order. */
function mpReceive(msg) {
  if (!MP.on || !msg) return;
  switch (msg.t) {
    case 'turn': {
      const p = msg.p, T = msg.turn;
      if (!MP.humans.includes(p) || (MP.dropped.has(p) && T >= MP.dropped.get(p))) return; // (too late: run by the computer now)
      if (!MP.packets.has(T)) MP.packets.set(T, new Map());
      MP.packets.get(T).set(p, Array.isArray(msg.o) ? msg.o : []);
      MP.last[p] = Math.max(MP.last[p], T);
      if (msg.d) MP.peerD[p] = msg.d;
      if (p === MP.me && MP.sentAt.has(T)) {
        // My own packet back from the relay: how long the trip took (the others' copies take about as long).
        const rtt = MP.clock - MP.sentAt.get(T);
        MP.sentAt.delete(T);
        MP.rtt = !MP.rtt ? rtt : rtt > MP.rtt ? MP.rtt * 0.5 + rtt * 0.5 : MP.rtt * 0.97 + rtt * 0.03; // (quick to grow, slow to shrink)
      }
      if (msg.h && p !== MP.me) mpHash(msg.h[0], p, msg.h[1]); // (mine went in when I worked it out)
      return;
    }
    case 'drop': {
      const p = msg.p;
      if (!MP.humans.includes(p) || MP.dropped.has(p)) return;
      // From the turn after the last packet of theirs that came in before this: the same on every device (they all
      // have the same packets of theirs at this point in the relay's stream), and no device can be past it yet.
      const from = Math.max(MP.last[p] + 1, MP.t0 + LS.DELAY);
      MP.dropped.set(p, from);
      for (const [T, m] of MP.hashes) if (T >= from) m.delete(p);
      if (MP.onEvent) MP.onEvent('drop', { p, from });
      return;
    }
    case 'snap': {
      if (msg.from === MP.me) return; // (the host has the game already)
      const groups = S && S.groups;
      deserializeGame(msg.data);
      S.msgs = []; // (the host's messages were for the host)
      if (groups) S.groups = groups; else delete S.groups; // (my own control groups stay mine)
      MP.snapTurn = msg.turn;
      for (const P of S.players) P.ai = !MP.humans.includes(P.id) || (MP.dropped.has(P.id) && MP.dropped.get(P.id) <= msg.turn);
      MP.turn = msg.turn; MP.begun = -1; MP.acc = 0; MP.snaps++;
      for (const T of [...MP.hashes.keys()]) if (T < msg.turn) MP.hashes.delete(T);
      // (packets already sent for the turns ahead are in the relay's stream: they're used again from here)
      MP.sentTo = Math.max(MP.sentTo, MP.turn + LS.DELAY - 1);
      if (MP.onSnap) MP.onSnap(msg);
      return;
    }
    case 'pause':
      MP.paused = !!msg.on;
      if (MP.onEvent) MP.onEvent('pause', { on: MP.paused, p: msg.p });
      return;
    default:
  }
}

/** Fingerprints for turn T: once everyone's is in, do they match? The host notes a mismatch, and sends its game. */
function mpHash(T, p, h) {
  if (!MP.hashes.has(T)) MP.hashes.set(T, new Map());
  const m = MP.hashes.get(T);
  m.set(p, h);
  const live = MP.humans.filter((q) => !(MP.dropped.has(q) && MP.dropped.get(q) <= T));
  if (!live.every((q) => m.has(q))) return;
  const vals = live.map((q) => m.get(q));
  MP.hashes.delete(T);
  for (const k of MP.hashes.keys()) if (k < T - LS.KEEP) MP.hashes.delete(k);
  if (vals.every((v) => v === vals[0])) return;
  // (a device ahead of the host may have worked out this one before it took the host's game: that's already put right)
  if (T <= MP.snapTurn) return;
  MP.desyncs++;
  if (MP.onEvent) MP.onEvent('desync', { turn: T, hashes: live.map((q, k) => [q, vals[k]]) });
  // The host sends its game at the start of the next whole-second turn that hasn't started yet.
  if (mpIsHost() && MP.snapAt < MP.turn) MP.snapAt = Math.ceil((MP.turn + 1) / LS.HASH_EVERY) * LS.HASH_EVERY;
}

/** Can turn T start: is every player's packet for it in (or are they run by the computer by then)? Who's missing. */
function mpMissing(T) {
  if (T < MP.t0 + LS.DELAY) return [];
  const m = MP.packets.get(T);
  return MP.humans.filter((p) => !(MP.dropped.has(p) && MP.dropped.get(p) <= T) && !(m && m.has(p)));
}

/** Start turn MP.turn: the fingerprint (on a whole second), my packet for LS.DELAY turns on, then everyone's orders. */
function mpBeginTurn() {
  const T = MP.turn;
  if (mpMissing(T).length) return false;
  // Players dropped by this turn: the computer runs their colony, here and everywhere, from the same turn.
  for (const [p, from] of MP.dropped) if (from <= T && S.players[p]) S.players[p].ai = true;
  let h = null;
  if (T % LS.HASH_EVERY === 0) {
    const hv = hashState();
    h = [T, hv];
    if (MP.snapAt === T && mpIsHost()) { mpSend({ t: 'snap', from: MP.me, turn: T, data: serializeGame(), hash: hv }); MP.snaps++; MP.snapTurn = T; }
  }
  // My packet for turn T + my delay (and any missed on the way: after a jump forward, or when the delay grows).
  const upto = T + MP.d;
  if (!(MP.dropped.has(MP.me))) {
    while (MP.sentTo < upto) {
      MP.sentTo++;
      const last = MP.sentTo === upto;
      mpSend({ t: 'turn', p: MP.me, turn: MP.sentTo, d: MP.d, o: last ? MP.q : [], h: last && h ? h : undefined });
      if (last) { MP.q = []; MP.sentAt.set(upto, MP.clock); }
    }
    for (const k of MP.sentAt.keys()) if (k < T - LS.KEEP) MP.sentAt.delete(k);
  }
  if (h) mpHash(h[0], MP.me, h[1]); // (my own, for the comparison: the relay sends my packet back with it a bit later, too)
  // Everyone's orders for this turn, player by player, in the order given.
  const m = MP.packets.get(T);
  if (m) {
    for (const p of [...m.keys()].sort((a, b) => a - b)) {
      for (const o of m.get(p)) {
        if (!Array.isArray(o)) continue;
        const r = applyOrder(p, o[0], o[1]);
        if (p === MP.me && MP.cbs.has(o[2])) {
          const cb = MP.cbs.get(o[2]);
          MP.cbs.delete(o[2]);
          try { cb(r); } catch (e) { if (typeof console !== 'undefined') console.warn('Order callback failed:', e && e.message); }
        }
      }
    }
  }
  // (packets are kept a while: the host's game, if it comes, starts a little way back)
  for (const k of MP.packets.keys()) if (k < T - LS.KEEP) MP.packets.delete(k);
  MP.begun = T;
  MP.turn = T + 1;
  return true;
}

/** How far ahead of us the quickest other player is, in turns (we run a little faster to catch up). */
function mpBehind() {
  let best = -1;
  for (const p of MP.humans) if (p !== MP.me && !MP.dropped.has(p)) best = Math.max(best, MP.last[p] - (MP.peerD[p] || LS.DELAY));
  return Math.max(0, best - MP.turn);
}

/**
 * Once a second: my delay, from how long my packets take to come back from the relay. Each device picks its own
 * (a packet says which turn it's for, so nobody else needs to know): long enough for my orders to reach everyone
 * before they get to that turn, with a turn to spare, and no longer (orders feel slow).
 */
function mpAdapt() {
  if (!MP.rtt) return;
  const turnS = (LS.TURN * SIM_STEP) / (GAME_PACE * MP.speed);
  MP.d = clamp(Math.ceil((MP.rtt * 1.15) / turnS) + 1, 2, LS.DELAY_MAX);
}

/**
 * Called every frame with the real time passed: runs as many ticks as are owed and allowed (a turn can't start until
 * its packets are in). The host drops a player it has waited on for LS.STALL_S seconds.
 */
function mpFrame(dt) {
  if (!MP.on) return;
  MP.clock += dt;
  if (MP.clock - MP.adaptT >= 1) { MP.adaptT = MP.clock; mpAdapt(); }
  if (MP.paused || S.winner >= 0) return;
  const behind = mpBehind();
  MP.acc += dt * GAME_PACE * MP.speed * (behind > 2 ? 1 + Math.min(1, (behind - 2) / 4) : 1);
  let n = 0;
  while (MP.acc >= SIM_STEP && n < LS.MAX_STEPS) {
    if (S.tick % LS.TURN === 0 && MP.begun !== S.tick / LS.TURN) {
      if (MP.turn !== S.tick / LS.TURN) MP.turn = S.tick / LS.TURN; // (in step with the game's own clock)
      if (!mpBeginTurn()) {
        MP.waitFor = mpMissing(MP.turn);
        MP.stalled += dt;
        MP.acc = Math.min(MP.acc, SIM_STEP * LS.TURN);
        if (MP.stalled > LS.STALL_S && mpIsHost()) {
          for (const p of MP.waitFor) if (p !== MP.me) mpSend({ t: 'drop', p, from: MP.turn });
          MP.stalled = 0;
        }
        return;
      }
    }
    simStep(SIM_STEP);
    MP.acc -= SIM_STEP;
    n++;
  }
  if (n >= LS.MAX_STEPS) MP.acc = Math.min(MP.acc, SIM_STEP * LS.TURN);
  MP.stalled = 0; MP.waitFor = [];
}

/** Pause (or go on) for everyone. */
function mpPause(on) { mpSend({ t: 'pause', on: !!on, p: MP.me }); }
/** Leave the game: the others' computers run my colony from here on. */
function mpLeave() { mpSend({ t: 'drop', p: MP.me, from: MP.turn }); mpStop(); }

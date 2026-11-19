'use strict';
/*
 * Terrafall — lockstep multiplayer. Every device runs the whole game; only the players' orders (orders.js) travel.
 * Time is cut into turns of LS.TURN ticks (a tenth of a second). An order given now is put off a few turns and sent
 * to everyone in a packet for that turn; a turn starts only once every player's packet for it is in, and then the
 * orders in them are carried out, player by player, on every device at the same tick. So every device plays the
 * same game, as long as the game itself always does the same thing given the same orders (no Math.random, no
 * clocks, exact maths: see util.js).
 *
 * Messages go through a relay (relay/, and net.js here) that hands every one to every device in the same order, the
 * sender's included, numbered (seq). That shared order settles who goes first whenever it matters: a player dropped
 * as their last packet arrives, say, is dropped from the same turn everywhere. mpReceive(msg) takes them in.
 *
 *   turn    { t, p, turn, d, o: [[name, args, seq]...], h: [turn, hash] }  a player's orders for a turn
 *   drop    { t, p }        the computer runs the player's colony, from the turn after their last packet (gone
 *                           quiet, or left)
 *   rejoin  { t, p }        the player is back: theirs again, from the turn after anyone's latest packet
 *   want    { t, p }        a device with no game (a reloaded page) asks for it
 *   snap    { t, to, turn, data, hash, full }  a game, at the start of a turn: to the devices that went astray (or
 *                           asked for it); a full one carries the players' state and the packets for the turns ahead
 *   pause   { t, on, p }    everyone stops (or goes on) together
 *
 * Once a second (every LS.HASH_EVERY turns, on a tick that's a whole second) each device works out a fingerprint of
 * the game (hashState) and sends it with its next packet. If they differ, the host sends its game at the start of the
 * next such turn, and everyone carries on from there. A player whose packets stop coming for LS.STALL_S seconds is
 * dropped, and their colony is run by the computer, on every device from the same turn, until they're back.
 */
const LS = { TURN: 3, DELAY: 3, DELAY_MAX: 15, HASH_EVERY: 10, STALL_S: 12, KEEP: 120, MAX_STEPS: 30, CATCH_STEPS: 240, CATCH_MS: 24 };

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
  ctl: new Map(),   // player → [{ from, ai }]: from which turn the computer runs their colony (ai), or they do again
  seen: 0,          // the latest relay message (seq) taken in
  d: LS.DELAY,      // how many turns ahead I send my orders: long enough for them to reach everyone in time (see mpAdapt)
  clock: 0,         // real seconds since the start (for timing the relay)
  sentAt: new Map(), // turn → when I sent my packet for it
  rtt: 0,           // how long my packets take to come back from the relay (seconds, smoothed)
  peerD: [],        // each player's delay, from their packets
  paused: false, pausedBy: -1, desyncs: 0, snapAt: -1, snapTo: null, snapTurn: -1, snaps: 0,
  linkOK: true,     // (the transport: is the relay getting through? a device that's cut off drops nobody)
  onSnap: null,     // (the screens' hook: the game was replaced)
  onEvent: null,    // (the screens' hook: a player dropped or back, a pause, a mismatch)
};

/**
 * Start a multiplayer game, once every device has made the same new game (same settings and seed). me: this device's
 * player; humans: the players people play (the rest are the computer's); send(msg): the transport.
 */
function mpStart(opts) {
  Object.assign(MP, {
    on: true, me: opts.me, humans: opts.humans.slice().sort((a, b) => a - b), send: opts.send, speed: opts.speed || 1,
    turn: S.tick / LS.TURN | 0, begun: -1, acc: 0, stalled: 0, waitFor: [], q: [], seq: 0, cbs: new Map(),
    packets: new Map(), last: S.players.map(() => -1), hashes: new Map(), sentTo: -1, ctl: new Map(), seen: 0,
    paused: false, pausedBy: -1, desyncs: 0, snapAt: -1, snapTo: null, snapFull: false, snapTurn: -1, snaps: 0, linkOK: true, rejoinT: -99,
    d: LS.DELAY, clock: 0, sentAt: new Map(), rtt: 0, adaptT: 0, peerD: S.players.map(() => LS.DELAY),
  });
  MP.t0 = MP.turn;
  ME = opts.me;
  for (const P of S.players) P.ai = !P.absent && !MP.humans.includes(P.id); // (the Murmur's slot is nobody's: see murmurStart)
  // The first LS.DELAY turns have no orders: nobody could have given any yet.
  MP.sentTo = MP.turn + LS.DELAY - 1;
}

/**
 * Join a game from a full snapshot. A paused sender may have already started the current turn.
 * The relay's messages after msg.seen are taken in next.
 */
function mpStartFrom(msg, opts) {
  deserializeGame(msg.data);
  S.msgs = [];
  mpStart({ ...opts, humans: msg.humans });
  MP.turn = msg.turn;
  MP.t0 = msg.t0 ?? msg.turn;
  MP.begun = msg.begun ?? -1;
  MP.ctl = new Map(msg.ctl.map(([p, list]) => [p, list.map((e) => ({ ...e }))]));
  MP.last = msg.last.slice();
  MP.peerD = msg.peerD.slice();
  MP.seen = msg.seen;
  MP.paused = !!msg.paused;
  MP.pausedBy = MP.paused ? (msg.pausedBy ?? -1) : -1;
  MP.snapTurn = msg.turn; MP.snaps = 1;
  MP.packets = new Map(msg.packets.map(([T, list]) => [T, new Map(list)]));
  MP.sentTo = MP.last[MP.me]; // (the server ran turn - 1 with my packets: everything after the last that reached it goes out from here)
  mpSetAI(MP.paused && MP.begun >= 0 ? MP.begun : MP.turn);
}

function mpStop() { MP.on = false; MP.send = null; MP.q = []; MP.cbs.clear(); MPJ.on = false; MPJ.held = []; }

/**
 * A device with no game joining one under way (a reloaded page): it asks for the game (want), holds on to the relay's
 * messages until a full snap for it comes, starts from that, then takes in the messages the snap didn't cover.
 */
const MPJ = { on: false, opts: null, held: [], t: 0 };
function mpJoin(opts) {
  Object.assign(MPJ, { on: true, opts, held: [], t: 0 });
  opts.send({ t: 'want', p: opts.me });
}

/** Every message from the relay comes in here. */
function mpIn(msg) {
  if (!msg) return;
  if (MPJ.on) {
    if (msg.t === 'snap' && msg.full && msg.to && msg.to.includes(MPJ.opts.me)) {
      MPJ.on = false;
      mpStartFrom(msg, MPJ.opts);
      for (const m of MPJ.held) if ((m.seq || 0) > msg.seen && m !== msg) mpReceive(m);
      MPJ.held = [];
      if (MP.onSnap) MP.onSnap(msg);
    } else MPJ.held.push(msg);
    return;
  }
  mpReceive(msg);
}

/** Does the computer run player p's colony at turn T (they're a person's, but dropped then)? */
function mpAI(p, T) {
  const list = MP.ctl.get(p);
  if (!list) return false;
  let ai = false;
  for (const e of list) if (e.from <= T) ai = e.ai;
  return ai;
}
/** ...and as things stand now (the latest word on it)? */
function mpAINow(p) { const list = MP.ctl.get(p); return !!list && list.length > 0 && list[list.length - 1].ai; }
/** The people still playing (not handed to the computer). */
function mpLive() { return MP.humans.filter((p) => !mpAINow(p)); }
/** The host: the first player still playing. It sends its game when a device goes astray. */
function mpHost() { return mpLive()[0] ?? -1; }
function mpIsHost() { return mpHost() === MP.me; }
/** Am I watching (my colony run by the computer: dropped, or out of the game)? */
function mpWatching() { return !MP.on || mpAINow(MP.me) || !!(S.players[MP.me] && S.players[MP.me].out); }

/** Every player's colony: the computer's or theirs, as at turn T (the same turn on every device). */
function mpSetAI(T) { for (const p of MP.humans) if (S.players[p]) S.players[p].ai = mpAI(p, T); }

/** An order of mine (see act in ui.js): sent with my next packet, carried out a few turns later. */
MP.order = (name, args, cb) => {
  if (!MP.on || mpAINow(MP.me)) return; // (watching: the computer runs my colony)
  const seq = ++MP.seq;
  MP.q.push([name, args, seq]);
  if (cb) MP.cbs.set(seq, cb);
};

function mpSend(msg) { if (MP.send) MP.send(msg); }

/** A message from the relay (mine too), in the relay's order. */
function mpReceive(msg) {
  if (!MP.on || !msg) return;
  if (msg.seq) MP.seen = Math.max(MP.seen, msg.seq);
  switch (msg.t) {
    case 'turn': {
      const p = msg.p, T = msg.turn;
      if (!MP.humans.includes(p) || mpAI(p, T)) return; // (too late: run by the computer then)
      if (!MP.packets.has(T)) MP.packets.set(T, new Map());
      const m = MP.packets.get(T);
      if (m.has(p)) return; // (the first packet for a turn is the one: a second, from a reloaded page say, is ignored everywhere)
      m.set(p, Array.isArray(msg.o) ? msg.o : []);
      MP.last[p] = Math.max(MP.last[p], T);
      if (p === MP.me) MP.sentTo = Math.max(MP.sentTo, T); // (mine went out already)
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
    case 'drop':
      mpDrop(msg.p);
      return;
    case 'rejoin': {
      const p = msg.p;
      if (!MP.humans.includes(p) || !mpAINow(p)) return;
      // From the turn after anyone's latest packet (no device can have got there yet): theirs again from then.
      let from = MP.t0 + LS.DELAY;
      for (const q of MP.humans) from = Math.max(from, MP.last[q] + 1);
      MP.ctl.get(p).push({ from, ai: false });
      MP.last[p] = from - 1;
      if (p === MP.me) { MP.sentTo = from - 1; MP.q = []; }
      if (MP.onEvent) MP.onEvent('rejoin', { p, from });
      return;
    }
    case 'want': {
      // A device with no game (a reloaded page): its colony is the computer's until it's caught up and back (rejoin),
      // and the first player still playing (but the one asking) sends it the game, at the next whole second.
      mpDrop(msg.p);
      const server = mpLive().find((q) => q !== msg.p);
      if (server !== MP.me) return;
      if (MP.paused && S.winner < 0) {
        // Send the frozen tick and its order cursor without running any simulation to make a snapshot.
        mpSendSnapshot(MP.turn, [msg.p], true, hashState());
        return;
      }
      MP.snapTo = (MP.snapTo || []).concat(msg.p);
      MP.snapFull = true;
      if (MP.snapAt < MP.turn) MP.snapAt = Math.ceil((MP.turn + 1) / LS.HASH_EVERY) * LS.HASH_EVERY;
      return;
    }
    case 'snap': {
      if (msg.full && msg.paused) return; // A paused join snapshot is for a freshly loaded page only.
      if (msg.from === MP.me || (msg.to && !msg.to.includes(MP.me))) return;
      const groups = S && S.groups, bgroups = S && S.bgroups;
      // (the narrator's first nightfall is said on each device by its interface, not the simulation: the sender's game
      // doesn't know we've had it, so it's kept, or it would be said again: see nightfallLine)
      const night = S && S.lore ? S.lore['n.night.' + MP.me] : undefined;
      deserializeGame(msg.data);
      S.msgs = []; // (the sender's messages were for the sender)
      if (night !== undefined) (S.lore || (S.lore = {}))['n.night.' + MP.me] = night;
      if (groups) S.groups = groups; else delete S.groups; // (my own control groups stay mine)
      if (bgroups) S.bgroups = bgroups; else delete S.bgroups; // (and the buildings on my number keys)
      MP.snapTurn = msg.turn;
      MP.turn = msg.turn; MP.begun = -1; MP.acc = 0; MP.snaps++;
      if (msg.full) for (const [T, list] of msg.packets) { if (!MP.packets.has(T)) MP.packets.set(T, new Map()); for (const [p, o] of list) MP.packets.get(T).set(p, o); }
      mpSetAI(msg.turn);
      for (const T of [...MP.hashes.keys()]) if (T < msg.turn) MP.hashes.delete(T);
      // (packets already sent for the turns ahead are in the relay's stream: they're used again from here)
      if (!mpAINow(MP.me)) MP.sentTo = Math.max(MP.sentTo, MP.turn + LS.DELAY - 1);
      if (MP.onSnap) MP.onSnap(msg);
      return;
    }
    case 'pause':
      MP.paused = !!msg.on;
      MP.pausedBy = msg.on ? msg.p : -1;
      if (MP.onEvent) MP.onEvent('pause', { on: MP.paused, p: msg.p });
      return;
    default:
  }
}

/**
 * Player p's colony is the computer's from the turn after the last packet of theirs that came in before this: the
 * same on every device (they all have the same packets of theirs at this point in the relay's stream), and no device
 * can be past it yet.
 */
function mpDrop(p) {
  if (!MP.humans.includes(p) || mpAINow(p)) return;
  const from = Math.max(MP.last[p] + 1, MP.t0 + LS.DELAY);
  if (!MP.ctl.has(p)) MP.ctl.set(p, []);
  MP.ctl.get(p).push({ from, ai: true });
  for (const [T, m] of MP.hashes) if (T >= from) m.delete(p);
  if (MP.onEvent) MP.onEvent('drop', { p, from });
}

/** Fingerprints for turn T: once everyone's is in, do they match? The host notes a mismatch, and sends its game. */
function mpHash(T, p, h) {
  if (!MP.hashes.has(T)) MP.hashes.set(T, new Map());
  const m = MP.hashes.get(T);
  m.set(p, h);
  const live = MP.humans.filter((q) => !mpAI(q, T));
  if (!live.every((q) => m.has(q))) return;
  const vals = live.map((q) => m.get(q));
  MP.hashes.delete(T);
  for (const k of MP.hashes.keys()) if (k < T - LS.KEEP) MP.hashes.delete(k);
  if (vals.every((v) => v === vals[0])) return;
  // (a device ahead of the sender may have worked out this one before it took the sender's game: that's already put right)
  if (T <= MP.snapTurn) return;
  MP.desyncs++;
  if (MP.onEvent) MP.onEvent('desync', { turn: T, hashes: live.map((q, k) => [q, vals[k]]) });
  // The host sends its game (to the devices that differ from it) at the start of the next whole-second turn.
  if (mpIsHost()) {
    const mine = m.get(MP.me) ?? vals[live.indexOf(MP.me)];
    MP.snapTo = (MP.snapTo || []).concat(live.filter((q, k) => q !== MP.me && vals[k] !== mine));
    if (MP.snapAt < MP.turn) MP.snapAt = Math.ceil((MP.turn + 1) / LS.HASH_EVERY) * LS.HASH_EVERY;
  }
}

/** Can turn T start: is every player's packet for it in (or are they run by the computer by then)? Who's missing. */
function mpMissing(T) {
  if (T < MP.t0 + LS.DELAY) return [];
  const m = MP.packets.get(T);
  return MP.humans.filter((p) => !mpAI(p, T) && !(m && m.has(p)));
}

function mpSendSnapshot(turn, to, full, hash) {
  const msg = { t: 'snap', from: MP.me, to, turn, data: serializeGame(), hash };
  if (full) Object.assign(msg, {
    full: true, humans: MP.humans, ctl: [...MP.ctl], last: MP.last, peerD: MP.peerD, seen: MP.seen,
    t0: MP.t0, begun: MP.begun, paused: MP.paused, pausedBy: MP.pausedBy,
    packets: [...MP.packets].filter(([k]) => k >= turn).map(([k, m]) => [k, [...m]]),
  });
  mpSend(msg);
  MP.snaps++;
}

/** Start turn MP.turn: the fingerprint (on a whole second), my packet for a few turns on, then everyone's orders. */
function mpBeginTurn() {
  const T = MP.turn;
  if (mpMissing(T).length) return false;
  // Who runs each colony from this turn: the same turn on every device.
  mpSetAI(T);
  let h = null;
  if (T % LS.HASH_EVERY === 0) {
    const hv = hashState();
    h = [T, hv];
    if (MP.snapAt === T) {
      mpSendSnapshot(T, MP.snapTo && MP.snapTo.length ? [...new Set(MP.snapTo)] : null, MP.snapFull, hv);
      MP.snapTurn = T; MP.snapTo = null; MP.snapFull = false;
    }
  }
  // My packet for turn T + my delay (and any missed on the way: after a jump forward, or when the delay grows).
  const upto = T + MP.d;
  if (!mpAINow(MP.me)) {
    while (MP.sentTo < upto) {
      MP.sentTo++;
      const last = MP.sentTo === upto;
      mpSend({ t: 'turn', p: MP.me, turn: MP.sentTo, d: MP.d, o: last ? MP.q : [], h: last && h ? h : undefined });
      if (last) { MP.q = []; MP.sentAt.set(upto, MP.clock); }
    }
    for (const k of MP.sentAt.keys()) if (k < T - LS.KEEP) MP.sentAt.delete(k);
  }
  if (h && !mpAI(MP.me, T)) mpHash(h[0], MP.me, h[1]); // (my own, for the comparison)
  // Everyone's orders for this turn, player by player, in the order given.
  const m = MP.packets.get(T);
  if (m) {
    for (const p of [...m.keys()].sort((a, b) => a - b)) {
      if (mpAI(p, T)) continue;
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
  // (packets are kept a while: a game sent to put a device right starts a little way back)
  for (const k of MP.packets.keys()) if (k < T - LS.KEEP) MP.packets.delete(k);
  MP.begun = T;
  MP.turn = T + 1;
  return true;
}

/** How far ahead of us the quickest other player is, in turns (we run faster to catch up). */
function mpBehind() {
  let best = -1;
  for (const p of mpLive()) if (p !== MP.me) best = Math.max(best, MP.last[p] - (MP.peerD[p] || LS.DELAY));
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

/** (real milliseconds, for keeping catching up from freezing the screen: any clock will do, it's not in the game) */
function mpNow() { return typeof performance !== 'undefined' ? performance.now() : 0; }

/**
 * Called every frame with the real time passed: runs as many ticks as are owed and allowed (a turn can't start until
 * its packets are in). Well behind the others (back from a pause in the background, say) it runs flat out until it's
 * caught up. Waiting on a player for LS.STALL_S seconds, it drops them (the host first; the others a little later,
 * in case it's the host that's gone).
 */
function mpFrame(dt) {
  if (MPJ.on) { MPJ.t += dt; if (MPJ.t > 10) { MPJ.t = 0; MPJ.opts.send({ t: 'want', p: MPJ.opts.me }); } return; } // (asking again)
  if (!MP.on) return;
  MP.clock += dt;
  // Back after being dropped (and caught up): take my colony back from the computer.
  if (mpAINow(MP.me) && MP.autoRejoin !== false && !(S.players[MP.me] && S.players[MP.me].out) && mpBehind() <= 2 && MP.clock - (MP.rejoinT || -99) > 10) {
    MP.rejoinT = MP.clock;
    mpRejoin();
  }
  if (MP.clock - MP.adaptT >= 1) { MP.adaptT = MP.clock; mpAdapt(); }
  if (MP.paused || S.winner >= 0) return;
  const behind = mpBehind(), fast = behind > 6;
  MP.acc += dt * GAME_PACE * MP.speed * (behind > 2 ? 1 + Math.min(1, (behind - 2) / 4) : 1);
  const t0 = mpNow();
  let n = 0;
  for (;;) {
    if (fast ? n >= LS.CATCH_STEPS || (n && mpNow() - t0 > LS.CATCH_MS) || mpBehind() <= 2 : MP.acc < SIM_STEP || n >= LS.MAX_STEPS) break;
    if (S.tick % LS.TURN === 0 && MP.begun !== S.tick / LS.TURN) {
      if (MP.turn !== S.tick / LS.TURN) MP.turn = S.tick / LS.TURN; // (in step with the game's own clock)
      if (!mpBeginTurn()) {
        MP.waitFor = mpMissing(MP.turn);
        MP.stalled += dt;
        MP.acc = Math.min(MP.acc, SIM_STEP * LS.TURN);
        const patience = LS.STALL_S + (mpIsHost() ? 0 : 6);
        if (MP.stalled > patience && MP.linkOK && !mpAINow(MP.me)) {
          for (const p of MP.waitFor) if (p !== MP.me) mpSend({ t: 'drop', p });
          MP.stalled = LS.STALL_S / 2; // (and again in a while, if that didn't do it)
        }
        return;
      }
    }
    simStep(SIM_STEP);
    if (!fast) MP.acc -= SIM_STEP;
    n++;
  }
  MP.acc = Math.min(MP.acc, SIM_STEP * LS.TURN);
  MP.stalled = 0; MP.waitFor = [];
}

/** Pause (or go on) for everyone. */
function mpPause(on) { mpSend({ t: 'pause', on: !!on, p: MP.me }); }
/** Back after being dropped: take my colony back from the computer (once I've caught up). */
function mpRejoin() { mpSend({ t: 'rejoin', p: MP.me }); }
/** Leave the game: the others' computers run my colony from here on. */
function mpLeave() { mpSend({ t: 'drop', p: MP.me }); mpStop(); }

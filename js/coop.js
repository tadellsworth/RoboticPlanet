'use strict';
/*
 * Terrafall — shared colony co-op: two people run one colony together (a multiplayer game whose settings share a
 * colony: see mpHostStart). Everything in the colony is both of theirs: either can build, order and change anything.
 * The game itself only knows who runs which colony (S.crew, by lockstep player: their name and colony) and who placed
 * each construction site (b.by: see addBuilding). The rest is here, on each device, and never touches the game:
 *
 * - the partner's cursor, a coloured dot with their name, sent a few times a second as a `cur` message;
 * - pings (the . key, Alt+click on the map or minimap, a long press on the minimap, or Ping on the bar): a spot marked
 *   for the team, with a sound, on the map and the minimap (`mark`). Pings are team-only: they go to the people running
 *   my colony and my allies' (a 2 vs 2 game's teammate), never to a rival; a game with no teammates has none;
 * - the partner's orders noted: a line in the message log ("Sam placed a Smelter site"), the army's sent as alerts,
 *   and a badge with their name where their plans and army orders went (MP.onOrder);
 * - a badge on each construction site with the initial of whoever placed it, and its name in the site's panel;
 * - a role (Economy, Military or Both, picked in the lobby) that only filters which alerts pop up on this device;
 * - Dismantle on a site or building the partner placed less than a minute ago asks first (siteConfirm in ui.js).
 */

const COOP = {
  peers: new Map(), // person → { x, y, tx, ty, at }: their cursor (drawn eased toward where it was last heard)
  pings: [],        // { x, y, q, t0 }: spots marked, by whom, when (performance.now)
  marks: [],        // { x, y, q, t0, text }: badges where a partner's plans and army orders went
  sentAt: 0, sx: NaN, sy: NaN,
};
const COOP_COLORS = ['#ffd84a', '#5be3ff', '#ff7ad9', '#9dff6a', '#ffa64a', '#c9a2ff', '#ff6b6b', '#ffffff'];
const COOP_CURSOR_MS = 120; // a cursor goes out at most this often (and only when it moved)
const COOP_PING_MS = 6000, COOP_MARK_MS = 5000, COOP_CURSOR_FADE = 20000;
const COOP_CONFIRM_S = 60; // Dismantle asks first on what the partner placed less than this long ago (game seconds)
const COOP_ROLES = { both: 'Both', econ: 'Economy', mil: 'Military' };
const PING_RATE = [3, 5000]; // pings this device may send in that many ms

/** Is this a co-op game (a multiplayer game with a shared colony)? */
function coopOn() { return typeof MP !== 'undefined' && MP.on && !!(S && S.crew); }
/** The others running my colony with me (their lockstep players). */
function coopMates() { return coopOn() ? mpCrewOf(ME).filter((q) => q !== MP.me) : []; }
function coopName(q) { const c = S && S.crew && S.crew[q]; return c ? c.n : 'Your partner'; }
function coopColor(q) { return COOP_COLORS[(q | 0) % COOP_COLORS.length]; }
/** Was this placed by someone else running my colony (not me)? */
function coopByMate(b) { return coopOn() && b && b.by !== undefined && b.by !== MP.me; }

/** Is person q on my team (running my colony with me, or an ally's: 2 vs 2)? Pings and team chat go to them only. */
function mpTeammate(q) {
  if (typeof MP === 'undefined' || !MP.on || !S || q === MP.me || !MP.humans.includes(q)) return false;
  const c = mpCol(q);
  return c === ME || allies(c, ME);
}
/** The people on my team (lockstep players), for pings and team chat. */
function mpTeammates() { return typeof MP !== 'undefined' && MP.on && S ? MP.humans.filter(mpTeammate) : []; }
/** Can I ping (a multiplayer game with someone on my team, and I'm playing)? */
function pingOn() { return !!(typeof MP !== 'undefined' && MP.on && UI.inGame && S && mpTeammates().length && !mpWatching()); }
/** A ping's colour: the person's in co-op (each has their own), else their colony's. */
function pingColor(q) { return coopOn() ? coopColor(q) : PLAYER_COLORS[mpCol(q)] || '#ffd84a'; }

/** This device's role in co-op (Both, Economy or Military): kept on the device. */
function coopRole() { let r = 'both'; try { r = localStorage.getItem('terrafall.role') || 'both'; } catch (e) { /* storage blocked */ } return COOP_ROLES[r] ? r : 'both'; }
function coopSetRole(r) { try { localStorage.setItem('terrafall.role', COOP_ROLES[r] ? r : 'both'); } catch (e) { /* storage blocked */ } }

/** A message about the war (an attack, warbots, a raid...), as opposed to the colony's work. */
const COOP_WAR_RE = /\b(attack\w*|under fire|raid\w*|warbots?|army|enem\w+|rivals?|turrets?|garrison\w*|missiles?|bomb\w*|napalm|siege|howitzers?|flak|nuk\w+|captur\w+|surrender\w*|walls?|gates?|keeps?|bulwarks?|torch\w*|skirmishers?|arc casters?|railgunners?|strikes?|airfield|bombers?|outposts?|defen[cs]\w*|war)\b/i;
/**
 * Should this alert stay in the message log without popping up, for my role? Economy: the war's news, Military: the
 * colony's chatter. Losses, the Command Base, the story and anything not about either always pop up.
 */
function coopQuiet(text, kind) {
  if (!coopOn()) return false;
  const role = coopRole();
  if (role === 'both' || kind === 'lost' || kind === 'narr' || kind === 'voice' || /Command Base/.test(text)) return false;
  const war = COOP_WAR_RE.test(text);
  return role === 'econ' ? war && kind !== 'bad' : !war && kind !== 'bad' && kind !== 'warn';
}

/** A line in the message log only (no pop-up), as toast() keeps them. */
function coopLog(text, kind, x, y) {
  if (!UI.inGame || !S) return;
  const where = x !== undefined && (x || y);
  UI.msgLog.push({ text, kind: kind || 'info', x: where ? x : -1, y: where ? y : -1, t: S.time, n: 1 });
  if (UI.msgLog.length > MSG_KEEP) UI.msgLog.shift();
  if (UI.sheetKind === 'msgs') openMsgSheet();
}
/** A partner's doing: popped up (pop, and my role cares) or only logged. */
function coopNote(text, x, y, pop) {
  if (pop && !coopQuiet(text, 'info')) toast(text, 'info', x, y);
  else coopLog(text, 'info', x, y);
}

/* ------------------------------------------------------------------ cursors and pings */

function coopSend(msg) { if (typeof netRaw === 'function' && NET.state === 'game') netRaw(JSON.stringify(msg)); } // (gone if the link is down: they're only of the moment)

/** Every frame (uiTick): my cursor to my partner, now and then. */
function coopTick() {
  const bar = $('btn-ping');
  if (bar) bar.hidden = !pingOn();
  if (!coopOn() || !coopMates().length || !R.mouse || !UI.inGame) return;
  const now = performance.now();
  if (now - COOP.sentAt < COOP_CURSOR_MS) return;
  const w = screenToWorld(R.mouse.x, R.mouse.y);
  if (!(w.x >= 0 && w.y >= 0 && w.x <= S.W && w.y <= S.H)) return;
  if (Math.abs(w.x - COOP.sx) + Math.abs(w.y - COOP.sy) < 0.15) return;
  COOP.sentAt = now; COOP.sx = w.x; COOP.sy = w.y;
  coopSend({ t: 'cur', p: MP.me, x: Math.round(w.x * 10) / 10, y: Math.round(w.y * 10) / 10 });
}

/** A partner's cursor or ping (MP.onPeer): a cursor only from someone running my colony, a ping from my team. */
function coopPeer(msg) {
  const q = msg.p;
  if (!Number.isInteger(q) || q === MP.me || !S) return;
  const x = +msg.x, y = +msg.y;
  if (!(x >= 0 && y >= 0 && x <= S.W && y <= S.H)) return;
  if (msg.t === 'mark' && mpTeammate(q) && !coopOn()) {
    coopAddPing(x, y, q);
    toast(`${mpWho(q)} pinged a spot.`, 'info', Math.floor(x), Math.floor(y));
    return;
  }
  if (!coopOn() || !S.crew[q] || mpCol(q) !== ME) return;
  if (msg.t === 'cur') {
    const c = COOP.peers.get(q);
    if (c) Object.assign(c, { tx: x, ty: y, at: performance.now() });
    else COOP.peers.set(q, { x, y, tx: x, ty: y, at: performance.now() });
  } else if (msg.t === 'mark') {
    coopAddPing(x, y, q);
    toast(`${coopName(q)} pinged a spot.`, 'info', Math.floor(x), Math.floor(y));
  }
}

function coopAddPing(x, y, q) {
  COOP.pings.push({ x, y, q, t0: performance.now() });
  if (COOP.pings.length > 8) COOP.pings.shift();
  sfx('ping');
}

/**
 * Ping a spot for my team (the . key or Alt+click: under the mouse; a long press on the minimap: there; Ping on the
 * bar: the middle of the view). A few at a time: more than PING_RATE asks to wait. False: no ping (nobody to see it).
 */
function coopPing(x, y) {
  if (!pingOn()) { if (typeof MP !== 'undefined' && MP.on && UI.inGame) toast('Pings go to your team only: nobody on your team to see one in this game.', 'info'); return false; }
  const now = performance.now();
  COOP.sent = (COOP.sent || []).filter((t) => now - t < PING_RATE[1]);
  if (COOP.sent.length >= PING_RATE[0]) { toast('Easy on the pings: wait a moment.', 'warn'); return false; }
  COOP.sent.push(now);
  x = clamp(x, 0, S.W); y = clamp(y, 0, S.H);
  coopAddPing(x, y, MP.me);
  coopSend({ t: 'mark', p: MP.me, x: Math.round(x * 10) / 10, y: Math.round(y * 10) / 10, to: mpTeammates() });
  return true;
}
function coopPingHere(atMouse) {
  if (typeof MP === 'undefined' || !MP.on) return false;
  const w = atMouse && R.mouse ? screenToWorld(R.mouse.x, R.mouse.y) : { x: R.cam.x, y: R.cam.y };
  return coopPing(w.x, w.y);
}

/* ------------------------------------------------------------------ the partner's orders */

/** An order carried out (MP.onOrder): a partner's, for our colony, goes in the log, with a badge where it went. */
function coopOrder(q, c, name, args, r) {
  if (!coopOn() || c !== ME || q === MP.me) return;
  const who = coopName(q), a = Array.isArray(args) ? args : [];
  const mark = (x, y, text) => { COOP.marks.push({ x, y, q, t0: performance.now(), text }); if (COOP.marks.length > 24) COOP.marks.shift(); };
  const bName = (id) => { const b = getE(id); return b && BDEFS[b.type] ? BDEFS[b.type].name : 'building'; };
  switch (name) {
    case 'place':
      if (r && r.ok) { const b = getE(r.id); if (b) coopNote(`${who} placed a ${BDEFS[b.type].name} site.`, b.x, b.y, false); }
      return;
    case 'demolish':
      if (r) { const b = getE(a[0]); coopNote(`${who} dismantled ${b && BDEFS[b.type] ? 'the ' + BDEFS[b.type].name : 'a building'}.`, b ? b.x : undefined, b ? b.y : undefined, true); }
      return;
    case 'paths': {
      const t = (Array.isArray(a[0] && a[0].add) && a[0].add[0]) ?? (Array.isArray(a[0] && a[0].walls) && a[0].walls[0] && a[0].walls[0][0]);
      const n = r ? (r.laid || 0) + (r.walls || 0) + (r.gates || 0) + (r.ramps || 0) + (r.rails || 0) + (r.pipes || 0) : 0;
      if (!n || !Number.isInteger(t)) return;
      const x = t % S.W, y = (t / S.W) | 0;
      mark(x + 0.5, y + 0.5, 'plan');
      coopNote(`${who} planned ${n} tile${n === 1 ? '' : 's'} of ${r.walls || r.gates ? 'walls and paths' : r.rails ? 'track' : r.pipes ? 'pipeline' : 'road'}.`, x, y, false);
      return;
    }
    case 'command': {
      if (!r || !r.n || !['attack', 'hunt', 'move', 'station', 'repair'].includes(r.kind)) return;
      const s = a[1] || {}, b = s.b ? getE(s.b) : null, u = s.foe ? getE(s.foe) : null;
      const x = b ? b.x + 0.5 : u ? u.x : (s.i | 0) + 0.5, y = b ? b.y + 0.5 : u ? u.y : (s.j | 0) + 0.5;
      const what = { attack: `to attack the ${b ? bName(b.id) : 'target'}`, hunt: 'after an enemy robot', move: 'to hold ground', station: `into the ${b ? bName(b.id) : 'garrison'}`, repair: 'to be repaired' }[r.kind];
      mark(x, y, 'order');
      coopNote(`${who} ordered ${r.n} robot${r.n === 1 ? '' : 's'} ${what}.`, Math.floor(x), Math.floor(y), true);
      return;
    }
    case 'sendAttack': case 'assault': {
      const n = r, b = getE(a[0]);
      if (!n || !b) return;
      mark(b.x + 0.5, b.y + 0.5, 'order');
      coopNote(`${who} sent ${n} warbot${n === 1 ? '' : 's'} to attack the ${bName(b.id)}.`, b.x, b.y, true);
      return;
    }
    case 'rally': case 'hunt': {
      if (!r || !r.sent) return;
      const e = name === 'hunt' ? getE(a[0]) : null, x = e ? e.x : (a[0] | 0) + 0.5, y = e ? e.y : (a[1] | 0) + 0.5;
      mark(x, y, 'order');
      coopNote(`${who} sent ${r.sent} warbot${r.sent === 1 ? '' : 's'} ${name === 'hunt' ? 'after an enemy robot' : 'to hold ground'}.`, Math.floor(x), Math.floor(y), true);
      return;
    }
    case 'fireMissile': case 'missileAt': case 'nukeAt':
      if (r) coopNote(`${who} fired a ${name === 'nukeAt' ? 'nuclear missile' : 'Missile'}.`, undefined, undefined, true);
      return;
    case 'recallAll':
      if (r) coopNote(`${who} called the army home.`, undefined, undefined, true);
      return;
    case 'research':
      if (r === '' && a[0] && TECHS[a[0]]) coopNote(`${who} started researching ${TECHS[a[0]].name}.`, undefined, undefined, false);
      return;
    default:
  }
}

/* ------------------------------------------------------------------ drawing (render.js calls these) */

/** A rounded name tag (or an initial in a disc) at screen point (x, y). */
function coopTag(ctx, x, y, text, col, alpha) {
  ctx.globalAlpha = alpha;
  ctx.font = '600 11px system-ui, sans-serif';
  ctx.textBaseline = 'middle';
  const w = ctx.measureText(text).width + 10, h = 16;
  ctx.fillStyle = 'rgba(14,12,18,0.82)';
  ctx.beginPath();
  if (ctx.roundRect) ctx.roundRect(x, y - h / 2, w, h, 5); else ctx.rect(x, y - h / 2, w, h);
  ctx.fill();
  ctx.strokeStyle = col; ctx.lineWidth = 1.5; ctx.stroke();
  ctx.fillStyle = col;
  ctx.fillText(text, x + 5, y + 0.5);
  ctx.globalAlpha = 1;
  ctx.textBaseline = 'alphabetic';
}

/** The map's co-op layer: site badges, order badges, pings and the partner's cursor. */
function drawCoop(ctx, ox, oy, z) {
  const co = coopOn();
  if (!co && !COOP.pings.length) return;
  const now = performance.now();
  // A badge on each of my colony's construction sites: the placer's initial, in their colour.
  if (co && z >= 9) {
    ctx.font = `700 ${Math.round(clamp(z * 0.3, 9, 13))}px system-ui, sans-serif`;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    const r = clamp(z * 0.2, 6, 9);
    for (const b of S.buildings) {
      if (b.dead || b.built || b.owner !== ME || b.by === undefined) continue;
      const x = ox + (b.x + 0.95) * z - r * 0.4, y = oy + (b.y + 0.05) * z + r * 0.4;
      if (x < -20 || y < -20 || x > R.w + 20 || y > R.h + 20) continue;
      ctx.fillStyle = 'rgba(14,12,18,0.85)';
      ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = coopColor(b.by); ctx.lineWidth = 1.6; ctx.stroke();
      ctx.fillStyle = coopColor(b.by);
      ctx.fillText(coopName(b.by).slice(0, 1).toUpperCase(), x, y + 0.5);
    }
    ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
  }
  // Where a partner's plans and army orders went: a badge with their name, fading.
  COOP.marks = COOP.marks.filter((m) => now - m.t0 < COOP_MARK_MS);
  for (const m of COOP.marks) {
    const k = (now - m.t0) / COOP_MARK_MS, x = ox + m.x * z, y = oy + m.y * z, col = coopColor(m.q);
    ctx.globalAlpha = 1 - k;
    ctx.strokeStyle = col; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(x, y, z * 0.45, 0, Math.PI * 2); ctx.stroke();
    coopTag(ctx, x + z * 0.45, y - z * 0.45, `${coopName(m.q)} · ${m.text}`, col, 1 - k);
  }
  // Pings: rings spreading from the spot, and who pinged it.
  COOP.pings = COOP.pings.filter((p) => now - p.t0 < COOP_PING_MS);
  for (const p of COOP.pings) {
    const age = (now - p.t0) / 1000, k = age / (COOP_PING_MS / 1000), x = ox + p.x * z, y = oy + p.y * z, col = p.col || pingColor(p.q); // (p.col: an order to a computer ally, js/ally.js)
    for (let n = 0; n < 2; n++) {
      const f = ((age * 0.9 + n * 0.5) % 1);
      ctx.globalAlpha = (1 - f) * (1 - k * 0.6);
      ctx.strokeStyle = col; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.arc(x, y, 6 + f * Math.max(28, z * 1.8), 0, Math.PI * 2); ctx.stroke();
    }
    ctx.globalAlpha = 1 - k * 0.5;
    ctx.fillStyle = col;
    ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x - 7, y - 16); ctx.lineTo(x + 7, y - 16); ctx.closePath(); ctx.fill();
    ctx.beginPath(); ctx.arc(x, y - 19, 7.5, 0, Math.PI * 2); ctx.fill();
    coopTag(ctx, x + 12, y - 19, p.tag || (p.q === MP.me ? 'You' : co ? coopName(p.q) : mpWho(p.q)), col, 1 - k * 0.5);
  }
  if (!co) { ctx.globalAlpha = 1; return; }
  // The partner's cursor: a dot in their colour with their name, eased toward where it was last heard.
  const ease = 1 - Math.pow(0.001, Math.min(0.1, R.dt || 0.016));
  for (const [q, c] of COOP.peers) {
    const idle = now - c.at;
    if (idle > COOP_CURSOR_FADE || !S.crew[q] || mpAINow(q)) continue;
    c.x += (c.tx - c.x) * ease; c.y += (c.ty - c.y) * ease;
    const x = ox + c.x * z, y = oy + c.y * z, col = coopColor(q), a = idle > COOP_CURSOR_FADE - 4000 ? (COOP_CURSOR_FADE - idle) / 4000 : 1;
    ctx.globalAlpha = a;
    ctx.fillStyle = col; ctx.strokeStyle = 'rgba(14,12,18,0.9)'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(x, y, 5.5, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    coopTag(ctx, x + 9, y + 11, coopName(q), col, a);
  }
  ctx.globalAlpha = 1;
}

/** The minimap's: pings (pulsing) and the partner's cursor. */
function drawCoopMini(ctx, sx, sy) {
  const co = coopOn();
  if (!co && !COOP.pings.length) return;
  const now = performance.now();
  for (const p of COOP.pings) {
    if (now - p.t0 > COOP_PING_MS) continue;
    const f = ((now - p.t0) / 700) % 1;
    ctx.strokeStyle = p.col || pingColor(p.q); ctx.lineWidth = 1.5; ctx.globalAlpha = 1 - f;
    ctx.beginPath(); ctx.arc(p.x * sx, p.y * sy, 2 + f * 9, 0, Math.PI * 2); ctx.stroke();
    ctx.globalAlpha = 1; ctx.fillStyle = p.col || pingColor(p.q);
    ctx.fillRect(p.x * sx - 1.5, p.y * sy - 1.5, 3, 3);
  }
  if (!co) { ctx.globalAlpha = 1; return; }
  for (const [q, c] of COOP.peers) {
    if (now - c.at > COOP_CURSOR_FADE || mpAINow(q)) continue;
    ctx.fillStyle = coopColor(q);
    ctx.beginPath(); ctx.arc(c.x * sx, c.y * sy, 2.2, 0, Math.PI * 2); ctx.fill();
  }
  ctx.globalAlpha = 1;
}

/** A new co-op game (or none): forget the last one's cursors and pings. */
function coopReset() { COOP.peers.clear(); COOP.pings.length = 0; COOP.marks.length = 0; COOP.sx = COOP.sy = NaN; }

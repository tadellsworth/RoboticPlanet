'use strict';
/*
 * Polish round 3: interface only. Nothing here is read by js/sim.js or kept in hashState: the Daily Planet starts an
 * ordinary game from settings worked out from the date (the same on every device), and chat, pings, Ready and the
 * colour picks go through the relay as messages that are not orders (see relay/src/index.js, caps).
 *  - The Daily Planet: one planet a day (UTC), the same for everyone: a card on the main menu, and the best time to win
 *    it kept on this device (DAILY_KEY).
 *  - Chat in a multiplayer game (Enter, or Chat on the bar) and in the lobby: everyone or (with teammates) the team,
 *    the last lines kept, Mute on the chat box. Plain text only.
 *  - Pings for the team (js/coop.js): Alt+click on the map or the minimap, a long press on the minimap, . or Ping.
 *  - The lobby: Ready for each player (the host starts when everyone's ready, or taps twice to start anyway) and each
 *    player's colour, no two the same; the host's start carries them (settings.look) so every device agrees.
 *  - Reconnecting: who the relay says has lost their connection, on the waiting banner and in a line when they're back.
 */

const P3 = { chat: [], chatOpen: false, team: false, seen: new Set(), lastShown: 0, readyArm: 0, look: '0123', away: new Map(), lp: null };
const DAILY_KEY = 'terrafall.daily', DAILY_KEEP = 60;
const CHAT_KEEP = 40, CHAT_SHOW = 6, CHAT_FADE = 12000, CHAT_MAX = 140;
const CHAT_MUTE_KEY = 'terrafall.chatMute';
/** The colours a player can pick in the lobby: the four teams' (art for each exists: TEAM_ART). */
const LOOK_BASE = { colors: PLAYER_COLORS.slice(), names: RIVAL_NAMES.slice(), signs: CALLSIGNS.slice() };

/* ------------------------------------------------------------------ the Daily Planet */

/** Today's date (UTC), as 2026-11-21: the Daily Planet changes at midnight UTC, for everyone at once. */
function dailyDate(ms) { return new Date(ms === undefined ? Date.now() : ms).toISOString().slice(0, 10); }
function dailyHash(s) {
  let h = 2166136261;
  for (let k = 0; k < s.length; k++) h = Math.imul(h ^ s.charCodeAt(k), 16777619);
  h ^= h >>> 15; h = Math.imul(h, 2246822507); h ^= h >>> 13;
  return h >>> 0;
}
/** The map types a Daily Planet can be on: any that takes two or three colonies (not the 2 vs 2 ones). */
function dailyShapes() { return SHAPE_PRESETS.map((s, k) => k).filter((k) => minPlayers(k) <= 3 && !SHAPE_PRESETS[k].teamDefault && !SHAPE_PRESETS[k].twin); }
/**
 * The day's game: the options startNewGame takes, all from the date. Versus on Normal, one or two computer rivals,
 * the map type, biome, ground, resources and doctrines picked by the date's hash; no challenge modifiers.
 */
function dailySetup(date) {
  const r = (k, n) => dailyHash(date + '|' + k) % n;
  const shapes = dailyShapes(), shape = shapes[r('shape', shapes.length)], sh = SHAPE_PRESETS[shape];
  const lo = minPlayers(shape), hi = maxPlayers(shape);
  const players = lo >= 3 ? lo : hi >= 3 && r('ffa', 3) === 0 ? 3 : 2;
  // (each rival a different doctrine: the doctrines in an order from the date)
  const styles = PERSONALITY_ORDER.slice().sort((x, y) => dailyHash(date + '|doc|' + x) - dailyHash(date + '|doc|' + y)).slice(0, 3);
  return {
    seed: 1 + r('seed', 999998), difficulty: 'normal', mode: 'versus', size: mapSizeForPlayers(DEFAULT_SIZE.versus, players),
    rough: Math.max((sh.minLevels || 1) - 1, r('rough', 5)), rich: 1 + r('rich', 3), shape, nuke: true, mega: true, upWin: false,
    biome: BIOME_ORDER[r('biome', BIOME_ORDER.length)], biome2: null, players, style: styles[0], styles,
    events: r('events', 3) === 0, murmur: 'active', unlimited: false, victory: 'capture', teams: false, mods: [], scars: scarsPref(),
  };
}
/** The day's planet in a line: "Crater · Jungle · 2 rivals: the Warden and the Raider". */
function dailyLine(o) {
  const rivals = o.styles.slice(0, o.players - 1).map((k) => (PERSONALITIES[k] ? PERSONALITIES[k].name : k));
  return `${SHAPE_PRESETS[o.shape].name} · ${BIOMES[o.biome] ? BIOMES[o.biome].name : o.biome} · ${rivals.length > 1 ? `two rivals: ${rivals.join(' and ')}` : `rival: ${rivals[0]}`}`;
}
function dailyRecords() {
  try { const o = JSON.parse(localStorage.getItem(DAILY_KEY) || '{}'); return o && typeof o === 'object' ? o : {}; } catch (e) { return {}; }
}
function dailySave(all) {
  const keep = Object.keys(all).sort().slice(-DAILY_KEEP), o = {};
  for (const k of keep) o[k] = all[k];
  try { localStorage.setItem(DAILY_KEY, JSON.stringify(o)); } catch (e) { /* storage blocked or full: kept for this session only */ }
}
/** The day's date for people: "Saturday 21 November" (its UTC date). */
function dailyNice(date) {
  try { return new Date(date + 'T12:00:00Z').toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC' }); } catch (e) { return date; }
}

/** ...and short, for the main menu's tile: "Sun 22 Nov". */
function dailyShort(date) {
  try { return new Date(date + 'T12:00:00Z').toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' }); } catch (e) { return date; }
}

/** The main menu's Daily Planet tile: today's date, the planet in a line, and the best time on it so far (once played). */
function syncDaily() {
  const card = $('m-daily');
  if (!card) return;
  const d = dailyDate(), o = dailySetup(d), rec = dailyRecords()[d];
  card.dataset.date = d;
  $('m-daily-date').textContent = dailyShort(d);
  $('m-daily-line').textContent = dailyLine(o);
  $('m-daily-best').textContent = rec && rec.best != null ? `Your best: won in ${fmtTime(rec.best)}${rec.tries > 1 ? ` · ${rec.tries} tries` : ''}`
    : rec && rec.tries ? `Not won yet · ${rec.tries} ${rec.tries > 1 ? 'tries' : 'try'}` : ''; // (nothing yet: the card's title says what it is)
}

function startDaily() {
  const d = dailyDate(), opts = dailySetup(d);
  audioUnlock();
  sfx('click');
  startNewGame(opts);
  UI.daily = { date: d, opts, done: null };
  postMsg(ME, `The Daily Planet, ${dailyNice(d)}: the same planet and rivals for everyone today. Win as fast as you can: your best time today is kept on this device.`, 0, 0, 'info');
}

/** The end screen of a Daily Planet game (or its Rematch): count the try, and the time if it's a win and the best. */
function dailyOver(won) {
  const D = UI.daily, L = UI.lastGame;
  if (!D || !L || L.opts !== D.opts || L.s !== S || D.done === S || MP.on) return;
  D.done = S;
  const all = dailyRecords(), rec = all[D.date] || { tries: 0, wins: 0, best: null };
  let line;
  if (typeof metaAssisted === 'function' && metaAssisted()) line = 'Daily Planet: Boosts or Unlimited resources were used, so this game isn\'t counted.';
  else {
    rec.tries++;
    if (won) {
      const t = Math.floor(S.time), was = rec.best;
      rec.wins = (rec.wins || 0) + 1;
      if (was == null || t < was) rec.best = t;
      line = was == null ? `Daily Planet won in ${fmtTime(t)}: your time for today.` : t < was ? `Daily Planet: a new best for today, ${fmtTime(t)} (was ${fmtTime(was)}).` : `Daily Planet won in ${fmtTime(t)}; your best today is ${fmtTime(was)}.`;
    } else line = `Daily Planet: not this time (${rec.tries} ${rec.tries > 1 ? 'tries' : 'try'} today). Rematch plays it again.`;
    rec.at = Date.now();
    all[D.date] = rec;
    dailySave(all);
  }
  const box = $('o-meta');
  if (box) { box.insertAdjacentHTML('beforeend', `<div class="om-rec"><i aria-hidden="true">★</i><span>${esc(line)}</span></div>`); box.hidden = false; }
}

/* ------------------------------------------------------------------ colours (the lobby's picks, applied) */

/** A look string ('2013': colony k wears team look[k]'s colour and art), or '0123' if it isn't a good one. */
function lookOf(look) {
  if (!Array.isArray(look) || look.length > 4) return '0123';
  const a = [0, 1, 2, 3].map((k) => (Number.isInteger(look[k]) && look[k] >= 0 && look[k] < 4 ? look[k] : -1));
  // (colonies the look leaves out take the colours left, in order)
  for (let k = 0; k < 4; k++) if (a[k] < 0 || a.indexOf(a[k]) !== k) a[k] = [0, 1, 2, 3].find((c) => !a.includes(c));
  return a.join('');
}
/** Wear a look: colours, colour names, callsigns and team art by colony. Before the game is made (mpOnStart). */
function applyLook(look) {
  const s = typeof look === 'string' ? look : lookOf(look);
  if (s === P3.look) return;
  P3.look = s;
  for (let k = 0; k < 4; k++) {
    const c = +s[k];
    PLAYER_COLORS[k] = LOOK_BASE.colors[c]; RIVAL_NAMES[k] = LOOK_BASE.names[c]; CALLSIGNS[k] = LOOK_BASE.signs[c]; TEAM_ART[k] = c;
  }
  if (typeof R !== 'undefined') R.terrVer = -1;
  if (typeof MM !== 'undefined') MM.dirty = true;
  if (typeof UI !== 'undefined' && UI.icons) UI.icons = {};
}
/** Every frame: a multiplayer game wears its start's look; anything else the usual one. */
function lookTick() {
  const st = NET.startMsg && NET.startMsg.settings;
  applyLook((MP.on || MPJ.on) && st && st.look ? st.look : '0123');
}

/**
 * (the host, at the start) Each colony's colour: a person's pick where it's free (in seat order), then the rest of the
 * colours to the others, each its usual one if it's free. slots: player slot → seat (-1: a computer's colony).
 */
function mpLook(slots, cols) {
  const look = new Array(cols).fill(-1);
  for (let p = 0; p < cols; p++) {
    const s = NET.seats.find((x) => x.seat === slots[p]), c = s && Number.isInteger(s.color) ? s.color : -1;
    if (c >= 0 && c < 4 && !look.includes(c)) look[p] = c;
  }
  for (let p = 0; p < cols; p++) if (look[p] < 0) look[p] = look.includes(p) ? [0, 1, 2, 3].find((c) => !look.includes(c)) : p;
  return look;
}
/** The colours seats have picked (seat → colour), and who has each. */
function mpPicks() { const m = new Map(); for (const s of NET.seats) if (Number.isInteger(s.color) && s.color >= 0 && s.color < 4) m.set(s.seat, s.color); return m; }
/** The colour a person's row shows in the lobby: their pick, else the colour of the place they'd have. */
function mpSeatColor(s, fallback) { const c = mpPicks().get(s.seat); return c !== undefined ? LOOK_BASE.colors[c] : fallback; }
/**
 * The colour a computer's place shows: its usual one, or the first nobody picked and no earlier computer place took
 * (P3.cpuUsed, emptied as the lobby list is drawn), as mpLook will hand them out.
 */
function mpCpuColor(slot) {
  const taken = new Set(mpPicks().values()), used = P3.cpuUsed || (P3.cpuUsed = new Set());
  let c = !taken.has(slot) && !used.has(slot) ? slot : [0, 1, 2, 3].find((x) => !taken.has(x) && !used.has(x));
  if (c === undefined) c = slot;
  used.add(c);
  return LOOK_BASE.colors[c];
}

/* ------------------------------------------------------------------ the lobby: Ready and colours */

function mpMe() { return NET.seats.find((s) => s.seat === NET.seat) || null; }
/** The people who must be Ready before the host starts: everyone here but the host. */
function mpNotReady() { return netCan('prefs') ? NET.seats.filter((s) => s.on && s.seat !== NET.host && !s.ready) : []; }

/** The lobby's row of colours and the Ready button (a relay that does them: netCan('prefs')). */
function renderPrefs() {
  const row = $('mp-prefs');
  if (!row) return;
  row.hidden = !netCan('prefs') || NET.state !== 'lobby';
  if (row.hidden) return;
  const me = mpMe(), mine = me && Number.isInteger(me.color) ? me.color : -1, picks = mpPicks();
  const coop = (NET.settings && NET.settings.coop) || [];
  const sw = $('mp-colors');
  let html = '';
  for (let c = 0; c < 4; c++) {
    const by = [...picks].find(([seat, x]) => x === c && seat !== NET.seat), who = by ? (NET.seats.find((s) => s.seat === by[0]) || {}).name : '';
    html += `<button type="button" role="radio" class="mp-sw${mine === c ? ' on' : ''}" data-c="${c}" style="--sw:${LOOK_BASE.colors[c]}" aria-checked="${mine === c}" aria-label="${LOOK_BASE.names[c]}${who ? ': ' + esc(who) + '\'s' : ''}"${by ? ' disabled' : ''} title="${by ? esc(who) + ' has picked ' + LOOK_BASE.names[c].toLowerCase() : LOOK_BASE.names[c]}"></button>`;
  }
  if (sw.dataset.h !== html) { sw.innerHTML = html; sw.dataset.h = html; }
  for (const b of sw.children) b.onclick = () => { const c = +b.dataset.c; sfx('click'); netLobbySend({ t: 'prefs', color: mine === c ? -1 : c }); };
  $('mp-colors-hint').textContent = coop.includes(NET.seat) ? 'You share the host\'s colony: it wears the host\'s colour.' : mine < 0 ? 'Pick one, or leave it to the host.' : '';
  const rb = $('mp-ready'), host = NET.seat === NET.host, ready = !!(me && me.ready);
  rb.hidden = host;
  rb.classList.toggle('on', ready);
  rb.setAttribute('aria-pressed', ready ? 'true' : 'false');
  rb.textContent = ready ? 'Ready ✓' : 'Ready?';
  rb.onclick = () => { sfx('click'); netLobbySend({ t: 'prefs', ready: !ready }); };
}

/** A tag for a person's row: Ready (or not yet), on a relay that does it. */
function mpReadyTag(s) { return netCan('prefs') && s.on && s.seat !== NET.host ? (s.ready ? 'ready' : 'not ready') : ''; }

/** (the host) Start: everyone Ready, or a second tap within five seconds to start anyway. True: go ahead. */
function mpReadyGate() {
  const wait = mpNotReady();
  if (!wait.length) return true;
  if (performance.now() - P3.readyArm < 5000) { P3.readyArm = 0; return true; }
  P3.readyArm = performance.now();
  mpMsg(`${wait.map((s) => s.name).join(' and ')} ${wait.length > 1 ? 'aren\'t' : 'isn\'t'} ready yet: tap Start again to start anyway.`);
  $('mp-start').textContent = 'Start anyway';
  setTimeout(() => { if (performance.now() - P3.readyArm >= 4900) $('mp-start').textContent = 'Start game'; }, 5000);
  return false;
}

/* ------------------------------------------------------------------ chat */

function chatMuted() { try { return localStorage.getItem(CHAT_MUTE_KEY) === '1'; } catch (e) { return false; } }
function chatSetMute(on) { try { localStorage.setItem(CHAT_MUTE_KEY, on ? '1' : '0'); } catch (e) { /* storage blocked */ } }
/** Is chat open to me here: a multiplayer game (playing or watching), or the lobby on a relay that carries it? */
function chatOn() { return (MP.on && UI.inGame && NET.state === 'game') || (NET.state === 'lobby' && netCan('chat')); }
/** In a game with teammates, Team or All can be picked; otherwise chat goes to everyone. */
function chatTeamOk() { return MP.on && UI.inGame && mpTeammates().length > 0 && S.players.some((P, k) => !P.absent && foes(k, ME) && mpCrewOf(k).length); }
/** A line of text made safe to send: no control characters, trimmed, CHAT_MAX at most. */
function chatClean(t) { return String(t || '').replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, CHAT_MAX); }

function chatSend(text) {
  text = chatClean(text);
  if (!text || !chatOn()) return false;
  const now = performance.now();
  P3.sent = (P3.sent || []).filter((t) => now - t < 5000);
  if (P3.sent.length >= 5) { chatAdd({ sys: true, text: 'Easy on the chat: wait a moment.' }); return false; }
  P3.sent.push(now);
  const id = NET.seat + '.' + Date.now().toString(36) + Math.floor(Math.random() * 1e4).toString(36);
  const game = NET.state === 'game', team = game && P3.team && chatTeamOk();
  const msg = { t: 'chat', text, id };
  if (team) { msg.team = true; msg.to = mpTeammates(); }
  P3.seen.add(id);
  // (in a game, a line said while the connection is down waits for it, as orders do; in the lobby it's now or never)
  if (game) netSend(msg);
  else if (!netRaw(JSON.stringify(msg))) { chatAdd({ sys: true, text: 'Not sent: the connection is down.' }); return false; }
  chatAdd({ me: true, name: game && !MP.linkOK ? 'You (sent when the connection is back)' : 'You', text, team });
  return true;
}

/** A chat line from the relay (NET.onChat). */
function chatIn(m) {
  if (!m || typeof m.text !== 'string') return;
  if (m.by === NET.seat) return; // (my own, back from a relay that sends it to everyone)
  if (m.id && P3.seen.has(m.id)) return;
  if (m.id) P3.seen.add(m.id);
  let name = '';
  if (NET.state === 'game' && MP.on && S) {
    const p = NET.startMsg ? NET.startMsg.players.findIndex((P) => P && P.seat === m.by) : -1;
    if (p < 0) return;
    if (m.team && !(Array.isArray(m.to) && m.to.includes(MP.me))) return; // (a team's line through a relay that sends it to everyone)
    name = mpWho(p);
  } else name = ((NET.seats.find((s) => s.seat === m.by) || {}).name) || String(m.name || 'Player').slice(0, 16);
  if (chatMuted()) { P3.missed = (P3.missed || 0) + 1; syncChat(); return; }
  chatAdd({ name, text: chatClean(m.text), team: !!m.team });
  sfx('click');
}

function chatAdd(line) {
  line.at = performance.now();
  P3.chat.push(line);
  if (P3.chat.length > CHAT_KEEP) P3.chat.shift();
  renderChat();
}

/** The chat lines: in the game's chat box (the last few, fading, or all of them while it's open) and in the lobby's. */
function renderChat() {
  const row = (l) => l.sys ? `<li class="sys">${esc(l.text)}</li>` : `<li${l.me ? ' class="me"' : ''}>${l.team ? '<i>[Team]</i> ' : ''}<b>${esc(l.name)}:</b> ${esc(l.text)}</li>`;
  const now = performance.now(), open = P3.chatOpen;
  const lines = open ? P3.chat : P3.chat.slice(-CHAT_SHOW).filter((l) => now - l.at < CHAT_FADE);
  const log = $('chat-log');
  if (log) {
    const html = lines.map(row).join('');
    if (log.dataset.h !== html) { log.innerHTML = html; log.dataset.h = html; log.scrollTop = log.scrollHeight; }
  }
  const lb = $('mp-chatlog');
  if (lb) {
    const html = P3.chat.map(row).join('');
    if (lb.dataset.h !== html) { lb.innerHTML = html; lb.dataset.h = html; lb.scrollTop = lb.scrollHeight; }
  }
}

function syncChat() {
  const box = $('chat'), on = chatOn() && NET.state === 'game';
  if (!box) return;
  if (!on && P3.chatOpen) chatClose();
  const now = performance.now(), recent = P3.chat.some((l) => now - l.at < CHAT_FADE);
  box.hidden = !on || (!P3.chatOpen && !recent);
  box.classList.toggle('open', P3.chatOpen);
  $('btn-chat').hidden = !on;
  const n = $('chat-n');
  if (n) { n.hidden = !P3.missed || !chatMuted(); n.textContent = P3.missed > 99 ? '99+' : P3.missed || ''; }
  const teamOk = chatTeamOk();
  $('chat-to').hidden = !teamOk;
  $('chat-to').textContent = P3.team && teamOk ? 'Team' : 'All';
  $('chat-to').title = P3.team && teamOk ? 'To your team only (tap for everyone)' : 'To everyone (tap for your team only)';
  const mute = chatMuted();
  $('chat-mute').textContent = mute ? 'Unmute' : 'Mute';
  $('chat-mute').setAttribute('aria-pressed', mute ? 'true' : 'false');
  const lob = $('mp-chat');
  if (lob) lob.hidden = !(NET.state === 'lobby' && netCan('chat'));
  if (box.hidden === false && !P3.chatOpen && now - P3.lastShown > 500) { P3.lastShown = now; renderChat(); }
}

function chatOpen() {
  if (!chatOn() || NET.state !== 'game') return false;
  P3.chatOpen = true;
  P3.missed = 0;
  syncChat();
  renderChat();
  $('chat-form').hidden = false;
  setTimeout(() => $('chat-in').focus(), 0);
  return true;
}
function chatClose() {
  P3.chatOpen = false;
  $('chat-form').hidden = true;
  $('chat-in').blur();
  renderChat();
  syncChat();
}

/* ------------------------------------------------------------------ pings: Alt+click, a long press on the minimap */

function pingAtEvent(e, mini) {
  if (mini) {
    const r = $('mm-canvas').getBoundingClientRect();
    return coopPing(((e.clientX - r.left) / r.width) * S.W, ((e.clientY - r.top) / r.height) * S.H);
  }
  const rect = $('game').getBoundingClientRect(), w = screenToWorld(e.clientX - rect.left, e.clientY - rect.top);
  return coopPing(w.x, w.y);
}

function initPings() {
  // Alt+click (a mouse) on the map or the minimap: a ping there, and nothing else.
  window.addEventListener('pointerdown', (e) => {
    const t = e.target, map = t && t.id === 'game', mini = t && t.id === 'mm-canvas';
    if (!(map || mini) || !UI.inGame || !MP.on) return;
    if (e.altKey && e.pointerType === 'mouse' && e.button === 0) {
      e.preventDefault(); e.stopImmediatePropagation();
      pingAtEvent(e, mini);
      return;
    }
    // A long press on the minimap (a touch screen): a ping where the finger is.
    if (mini && e.pointerType !== 'mouse') {
      clearTimeout(P3.lp && P3.lp.timer);
      const at = { x: e.clientX, y: e.clientY, id: e.pointerId };
      at.timer = setTimeout(() => { if (P3.lp === at) { P3.lp = null; if (pingAtEvent(at, true)) haptic('tap'); } }, 550);
      P3.lp = at;
    }
  }, true);
  const lpMove = (e) => { if (P3.lp && e.pointerId === P3.lp.id && Math.hypot(e.clientX - P3.lp.x, e.clientY - P3.lp.y) > 12) { clearTimeout(P3.lp.timer); P3.lp = null; } };
  const lpEnd = (e) => { if (P3.lp && e.pointerId === P3.lp.id) { clearTimeout(P3.lp.timer); P3.lp = null; } };
  window.addEventListener('pointermove', lpMove, true);
  window.addEventListener('pointerup', lpEnd, true);
  window.addEventListener('pointercancel', lpEnd, true);
}

/* ------------------------------------------------------------------ reconnecting */

/**
 * Who's connected (the relay's word, in a game: NET.onLobby): a person whose connection dropped is noted, so the
 * waiting banner says they're reconnecting, and a line says when they're back.
 */
function mpPresence3() {
  if (!MP.on || !UI.inGame || !NET.startMsg) return;
  const now = performance.now();
  NET.startMsg.players.forEach((P, p) => {
    if (!P || p === MP.me) return;
    const s = NET.seats.find((x) => x.seat === P.seat), off = !s || !s.on;
    if (off && !P3.away.has(p)) P3.away.set(p, now);
    else if (!off && P3.away.has(p)) {
      const gone = now - P3.away.get(p);
      P3.away.delete(p);
      if (gone > 1500 && !mpAINow(p)) toast(`${mpWho(p)} reconnected.`, 'good');
    }
  });
}
/** Is person p's connection down (the relay says so)? */
function mpReconnecting(p) { return P3.away.has(p); }

/* ------------------------------------------------------------------ every frame, and the start */

function polish3Tick() {
  lookTick();
  syncChat();
  if (!MP.on && P3.away.size) P3.away.clear();
  // (the menu's Daily Planet card: today's, with its best time, looked at now and then: the day turns at midnight UTC)
  const now = performance.now();
  if (!UI.inGame && now - (P3.dailyAt || 0) > 2000) { P3.dailyAt = now; syncDaily(); }
}

function initPolish3() {
  syncDaily();
  $('m-daily').onclick = startDaily;
  NET.onChat = chatIn;
  initPings();
  // Chat: Enter opens it in a multiplayer game (unless the map's banner takes Enter), Enter sends, Esc closes.
  window.addEventListener('keydown', (e) => {
    if (e.key !== 'Enter' || e.defaultPrevented || e.altKey || e.ctrlKey || e.metaKey || !UI.inGame || P3.chatOpen) return;
    const tag = (e.target && e.target.tagName) || '';
    if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || tag === 'BUTTON') return;
    if (typeof topScreen === 'function' && topScreen()) return;
    if (chatOpen()) e.preventDefault();
  });
  $('chat-in').addEventListener('keydown', (e) => {
    e.stopPropagation();
    if (e.key === 'Enter') { e.preventDefault(); const v = $('chat-in').value; $('chat-in').value = ''; if (v.trim()) chatSend(v); chatClose(); }
    else if (e.key === 'Escape') { e.preventDefault(); $('chat-in').value = ''; chatClose(); }
    else if (e.key === 'Tab' && !$('chat-to').hidden) { e.preventDefault(); P3.team = !P3.team; syncChat(); }
  });
  $('chat-form').addEventListener('submit', (e) => { e.preventDefault(); const v = $('chat-in').value; $('chat-in').value = ''; if (v.trim()) chatSend(v); chatClose(); });
  $('chat-send').onclick = () => { const v = $('chat-in').value; $('chat-in').value = ''; if (v.trim()) chatSend(v); chatClose(); };
  $('chat-to').onclick = () => { P3.team = !P3.team; sfx('click'); syncChat(); $('chat-in').focus(); };
  $('chat-mute').onclick = () => { chatSetMute(!chatMuted()); P3.missed = 0; sfx('click'); syncChat(); };
  $('btn-chat').onclick = () => { if (P3.chatOpen) chatClose(); else chatOpen(); };
  // The lobby's chat line.
  const lobbySend = () => { const v = $('mp-chatin').value; $('mp-chatin').value = ''; if (v.trim()) chatSend(v); };
  $('mp-chatin').addEventListener('keydown', (e) => { e.stopPropagation(); if (e.key === 'Enter') { e.preventDefault(); lobbySend(); } });
  $('mp-chatsend').onclick = lobbySend;
}

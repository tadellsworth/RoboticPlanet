'use strict';
/*
 * Terrafall — the multiplayer screens: host or join a game (a room code), the lobby (who's here, the host's settings,
 * Start), joining a game under way after a reload, and in the game the banner (waiting for a player, paused by
 * someone, catching up, watching), the shared pause and leaving. The connection is net.js; the game, lockstep.js.
 */

const MP_ERRORS = {
  none: 'No game with that code: check it with the host (codes are five letters and numbers).',
  full: 'That game is full: four players at most.',
  started: 'That game has already started.',
  norelay: 'Multiplayer isn\'t switched on for this copy of the game yet: it needs its relay server address (see the README).',
  bad: 'Something went wrong there: try again.',
  unreachable: 'Can\'t reach the multiplayer server from here: check the internet connection. (Playing inside another app? Open the game\'s own web page instead.)',
};

/** Open the Multiplayer screen (code: a room to join, from a shared link). */
function openMulti(code) {
  $('screen-mp').hidden = false;
  $('mp-name').value = netName();
  if (code) $('mp-code').value = code;
  mpView(NET.state === 'lobby' ? 'lobby' : 'connect');
  if (!relayUrl()) mpMsg(MP_ERRORS.norelay);
  else mpMsg('');
  if (NET.state === 'lobby') renderLobby();
  setTimeout(() => (code ? $('mp-join') : NET.state === 'lobby' ? $('mp-start') : $('mp-host')).focus(), 0);
}
function closeMulti() { $('screen-mp').hidden = true; }

function mpView(v) {
  for (const k of ['connect', 'lobby', 'joining']) $('mp-' + k).hidden = k !== v;
  $('mp-title').textContent = v === 'lobby' ? 'Game lobby' : v === 'joining' ? 'Joining the game' : 'Multiplayer';
  $('mp-back').hidden = v === 'joining';
}
function mpMsg(text, ok) {
  const el = $(NET.state === 'lobby' ? 'mp-lmsg' : 'mp-msg');
  el.textContent = text || '';
  el.classList.toggle('ok', !!ok);
}

/** The name in the box (remembered), or null (and a word about it) if there isn't one. */
function mpName() {
  const n = $('mp-name').value.replace(/[^\p{L}\p{N} _.'-]/gu, '').trim().slice(0, 16);
  if (!n) { mpMsg('Type a name first: it\'s how the others will know you.'); $('mp-name').focus(); return null; }
  netSetName(n);
  return n;
}

function initMulti() {
  $('m-multi').onclick = () => { sfx('click'); openMulti(); };
  $('mp-back').onclick = () => { sfx('click'); if (NET.state === 'lobby' || NET.state === 'connecting') mpLeaveLobby(); closeMulti(); };
  $('mp-host').onclick = () => {
    const n = mpName();
    if (!n) return;
    audioUnlock();
    netConnect(netRandomCode(), { create: true, name: n });
    if (NET.error !== 'norelay') mpMsg('Making a room…', true);
  };
  const join = () => {
    const n = mpName();
    if (!n) return;
    const code = $('mp-code').value.trim().toUpperCase();
    if (!/^[A-Z2-9]{5}$/.test(code)) { mpMsg('Type the five-character room code the host gave you.'); $('mp-code').focus(); return; }
    audioUnlock();
    const info = netRejoinInfo();
    if (info && info.code === code) { mpRejoinGame(); return; } // (a game this device was in: back into it)
    netConnect(code, { name: n });
    if (NET.error !== 'norelay') mpMsg('Joining…', true);
  };
  $('mp-join').onclick = join;
  $('mp-code').addEventListener('keydown', (e) => { e.stopPropagation(); if (e.key === 'Enter') join(); });
  $('mp-code').addEventListener('input', () => { const el = $('mp-code'); el.value = el.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 5); });
  $('mp-name').addEventListener('keydown', (e) => e.stopPropagation());
  $('mp-name').addEventListener('change', () => {
    const n = $('mp-name').value.replace(/[^\p{L}\p{N} _.'-]/gu, '').trim().slice(0, 16);
    if (!n) return;
    netSetName(n);
    if (NET.state === 'lobby') netLobbySend({ t: 'name', name: n });
  });
  $('mp-share').onclick = async () => {
    const link = mpJoinLink();
    const text = `Join my Terrafall game: room code ${NET.code}`;
    try {
      if (navigator.share) { await navigator.share({ title: 'Terrafall', text, url: link }); return; }
      await navigator.clipboard.writeText(`${text}\n${link}`);
      mpMsg('Copied: the code and a link that opens the game straight to it.', true);
    } catch (e) { mpMsg(`The code is ${NET.code}${link ? `, or send this link: ${link}` : ''}`, true); }
  };
  $('mp-settings').onclick = () => { sfx('click'); mpOpenSetup(); };
  $('mp-start').onclick = () => { sfx('click'); mpHostStart(); };
  $('mp-leave').onclick = () => { sfx('click'); mpLeaveLobby(); };
  $('mp-joincancel').onclick = () => { sfx('click'); mpStop(); netClose(); netRemember(false); mpView('connect'); closeMulti(); syncRejoin(); };
  $('m-rejoin').onclick = () => { sfx('click'); audioUnlock(); mpRejoinGame(); };
  $('p-mppause').onclick = () => { sfx('click'); mpPause(!MP.paused); };
  $('mp-banner-btn').onclick = () => { sfx('click'); if (MP.paused) mpPause(false); };

  NET.onError = (why) => {
    if (why === 'taken' && NET.create) { netConnect(netRandomCode(), { create: true, name: NET.name }); return; } // (that code's in use: another)
    if (MPJ.on || UI.mpRejoining) { UI.mpRejoining = false; mpStop(); netRemember(false); mpView('connect'); syncRejoin(); }
    if ($('screen-mp').hidden && !UI.inGame) openMulti();
    mpMsg(why === 'none' && UI.mpWasRejoin ? 'That game has ended (or everyone left it).' : MP_ERRORS[why] || MP_ERRORS.bad);
    UI.mpWasRejoin = false;
  };
  NET.onLobby = () => {
    if (!NET.started) { if (!UI.mpSetup) { if ($('screen-mp').hidden) openMulti(); mpView('lobby'); } renderLobby(); return; }
    mpPresence();
  };
  NET.onStart = (m) => mpOnStart(m);

  // A shared link (…?join=CODE) opens the Multiplayer screen with the code filled in.
  let code = '';
  try { code = (new URLSearchParams(location.search).get('join') || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 5); } catch (e) { /* no URL */ }
  if (code) {
    // (used once: a reload doesn't bring it up again)
    try { const u = new URL(location.href); u.searchParams.delete('join'); history.replaceState(null, '', u.toString()); } catch (e) { /* no history */ }
    const info = netRejoinInfo();
    setTimeout(() => (info && info.code === code ? mpRejoinGame() : openMulti(code)), 0);
  }
  syncRejoin();
}

/** A link that opens the game straight to this room (the page's own address with ?join=CODE). */
function mpJoinLink() {
  try {
    if (!/^https?:$/.test(location.protocol)) return '';
    const u = new URL(location.href);
    u.search = ''; u.hash = '';
    u.searchParams.set('join', NET.code);
    return u.toString();
  } catch (e) { return ''; }
}

/** The main menu's Rejoin button: shown when this device was in a game that may still be going. */
function syncRejoin() {
  const info = netRejoinInfo(), b = $('m-rejoin');
  if (!b) return;
  b.hidden = !info || MP.on || !relayUrl();
  if (info) b.textContent = `Rejoin multiplayer game ${info.code}`;
}

/** Back into the game this device was in (the page reloaded): the relay seats us again, and the game comes from the others. */
function mpRejoinGame() {
  const info = netRejoinInfo();
  if (!info) { syncRejoin(); return; }
  UI.mpRejoining = true; UI.mpWasRejoin = true;
  openMulti();
  mpView('joining');
  $('mp-joinmsg').textContent = `Joining game ${info.code}: getting it from the other players…`;
  netConnect(info.code, { id: info.id, fresh: true, name: netName() });
}

/* ------------------------------------------------------------------ the lobby */

/** The host's settings, as they're sent round (final: Random picked, for the start). */
function mpMenuSettings(final, people) {
  const m = UI.menu, total = clamp(Math.max(Math.round(m.players) || 2, people || 2), 2, 4);
  const keep = m.players;
  m.players = total;
  const pick = final ? resolveRandom() : { shape: m.shape || 0, biome: m.biome || 0 };
  m.players = keep;
  return {
    seed: m.seed, diff: m.diff, size: m.size.versus ?? DEFAULT_SIZE.versus, rough: m.rough, rich: m.rich,
    shape: pick.shape, shapeRnd: !final && !!m.shapeRnd, biome: BIOME_ORDER[pick.biome], biomeRnd: !final && !!m.biomeRnd,
    players: clamp(Math.round(m.players) || 2, 2, 4), style: m.style, nuke: !!m.nuke, events: !!m.events, victory: m.victory || 'capture',
    sum: mpSummary(),
  };
}

/** The game in a line, for the lobby. */
function mpSummary() {
  const m = UI.menu, bits = [];
  bits.push(m.shapeRnd ? 'Random map' : SHAPE_PRESETS[m.shape || 0].name, m.biomeRnd ? 'random biome' : biomeName(m.biome || 0), SIZE_PRESETS[m.size.versus ?? DEFAULT_SIZE.versus].name.toLowerCase());
  if (m.victory && m.victory !== 'capture') bits.push(VICTORY[m.victory].name);
  if (m.nuke) bits.push('Nuclear race');
  if (m.events) bits.push('Planet events');
  return bits.join(' · ');
}

/** (the host) Send the settings round, so the others see them. */
function mpSendSettings() { if (NET.state === 'lobby' && NET.seat === NET.host) netLobbySend({ t: 'settings', settings: mpMenuSettings(false) }); }

/** How many places a map type has room for (Random: any). */
function mpRoom(st) { return st && st.shapeRnd ? 4 : maxPlayers(st ? st.shape : 0); }

function renderLobby() {
  if ($('mp-lobby').hidden && !$('screen-mp').hidden) mpView('lobby');
  const host = NET.seat === NET.host, st = NET.settings;
  $('mp-roomcode').textContent = NET.code;
  const people = NET.seats.filter((s) => s.on);
  const total = Math.max(st ? st.players : 2, people.length), ai = Math.max(0, total - people.length);
  // Everyone needs the same version of the game (an installed app can hold an older one).
  const hostV = (NET.seats.find((s) => s.seat === NET.host) || {}).v || gameVersion();
  const odd = people.filter((s) => s.v && s.v !== hostV);
  let k = 0, html = '';
  for (const s of NET.seats) {
    const col = s.on ? PLAYER_COLORS[k++ % PLAYER_COLORS.length] : '#555';
    html += `<li class="${s.on ? '' : 'off'}"><span class="dot" style="background:${col}"></span><span class="nm">${esc(s.name)}</span>` +
      `<small>${[s.seat === NET.host ? 'host' : '', s.seat === NET.seat ? 'you' : '', s.on ? '' : 'away', s.v && s.v !== hostV ? 'different version' : ''].filter(Boolean).join(' · ')}</small></li>`;
  }
  for (let a = 0; a < ai; a++) {
    const col = PLAYER_COLORS[k++ % PLAYER_COLORS.length];
    html += `<li class="ai"><span class="dot" style="background:${col}"></span><span class="nm">Computer rival</span><small>${st ? DIFFICULTY[st.diff].label : ''}</small></li>`;
  }
  $('mp-players').innerHTML = html;
  $('mp-sum').textContent = st ? st.sum : host ? mpSummary() : 'The host is setting up the game…';
  $('mp-settings').hidden = !host;
  $('mp-start').hidden = !host;
  const room = mpRoom(st || { shape: UI.menu.shape || 0, shapeRnd: UI.menu.shapeRnd });
  let why = '';
  if (people.length < 2) why = `Waiting for the others: give them the room code ${NET.code}.`;
  else if (odd.length) why = `${odd.map((s) => s.name).join(' and ')} ${odd.length > 1 ? 'have' : 'has'} a different version of the game: close it and open it again (with the internet on) to update, then rejoin.`;
  else if (total > room) why = `${st && !st.shapeRnd ? SHAPE_PRESETS[st.shape].name : 'That map type'} has room for ${room}: pick another map type in Change settings (Crossroads takes four).`;
  $('mp-start').disabled = !!why;
  $('mp-lmsg').classList.remove('ok');
  $('mp-lmsg').textContent = host || people.length < 2 || odd.length ? why : 'Waiting for the host to start the game…';
  // The host's first look at the lobby: send the settings round.
  if (host && !st) mpSendSettings();
}

function esc(s) { return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }

/** (the host) Change the settings: the usual new-game screen, set for a multiplayer game. */
function mpOpenSetup() {
  UI.mpSetup = true;
  UI.menu.mode = 'versus';
  UI.menu.unlimited = 0;
  $('screen-mp').hidden = true;
  showMenuView('setup', true);
}
/** ...and back to the lobby with them. */
function mpSetupDone() {
  UI.mpSetup = false;
  saveSettings();
  showMenuView('home');
  openMulti();
  mpSendSettings();
  renderLobby();
}

/** (the host) Start: the settings with Random picked; everyone makes the same game from them. */
function mpHostStart() {
  const people = NET.seats.filter((s) => s.on).length;
  if (people < 2) return;
  UI.menu.mode = 'versus';
  netLobbySend({ t: 'start', settings: mpMenuSettings(true, people) });
}

function mpLeaveLobby() {
  if (NET.state === 'lobby') netLobbySend({ t: 'leave' });
  netClose();
  mpView('connect');
  mpMsg('');
}

/* ------------------------------------------------------------------ the game */

/** The start (from the relay): make the game, or (a reloaded page) ask for it. */
function mpOnStart(m) {
  if (MP.on || MPJ.on) return; // (a reconnect brings the start again)
  const me = NET.me;
  if (me < 0) return;
  const humans = m.players.map((_, k) => k);
  MP.onSnap = mpSnapLoaded;
  MP.onEvent = mpEvent;
  if (NET.fresh) {
    // A reloaded page: the game comes from the others (the computer runs our colony till we've caught up).
    UI.mpRejoining = false;
    openMulti();
    mpView('joining');
    MP.onSnap = mpSnapLoaded;
    mpJoin({ me, send: netSend, speed: 1 });
    MP.onSnap = mpSnapLoaded; MP.onEvent = mpEvent;
    return;
  }
  const s = m.settings;
  closeMulti();
  closePicker(false);
  newGame({
    seed: s.seed, difficulty: s.diff, mode: 'versus', size: s.size, rough: s.rough, rich: s.rich, shape: s.shape, nuke: !!s.nuke,
    biome: s.biome, players: Math.max(s.players, humans.length), style: s.style ? PERSONALITY_ORDER[s.style - 1] : 'random',
    events: !!s.events, wildlife: false, victory: s.victory, humans,
  });
  m.players.forEach((P, k) => { S.players[k].name = P.name; });
  ME = me;
  mpStart({ me, humans, send: netSend });
  MP.onSnap = mpSnapLoaded; MP.onEvent = mpEvent;
  enterGame();
  updateHUD();
  placeMinimap();
  const others = m.players.filter((_, k) => k !== me).map((P) => P.name);
  const ai = S.players.length - humans.length;
  postMsg(ME, `Multiplayer: you against ${others.join(' and ')}${ai ? ` and ${ai} computer rival${ai > 1 ? 's' : ''}` : ''}. Your bots have landed: build up fast!`, 0, 0, 'info');
}

/** The game was replaced (a reloaded page got it, or this device went astray and got the host's). */
function mpSnapLoaded() {
  if (!UI.inGame) {
    closeMulti();
    enterGame();
    updateHUD();
    placeMinimap();
    toast('You\'re back in the game: the computer kept your colony going and hands it back once you\'ve caught up.', 'info');
    return;
  }
  bakeMap();
  closeSheet();
}

/** Something happened to a player: tell everyone. */
function mpEvent(kind, x) {
  if (!UI.inGame) return;
  const who = x && x.p >= 0 ? playerName(x.p) : '';
  if (kind === 'drop') toast(x.p === ME ? 'Your connection dropped: the computer runs your colony until you\'re back.' : `${who} has gone quiet (or left): the computer runs their colony until they're back.`, 'warn');
  else if (kind === 'rejoin') toast(x.p === ME ? 'You\'re back: your colony is yours again.' : `${who} is back and running their colony again.`, 'good');
  else if (kind === 'desync' && typeof console !== 'undefined') console.warn('Terrafall: the games differed; the host is sending its game.', x);
}

/** Who's connected changed (in a game): nothing to show here (the banner and the drops cover it). */
function mpPresence() { /* (the lobby list is for before the start) */ }

/** Every frame in a game: the banner over the map. */
function mpBannerTick() {
  const el = $('mp-banner');
  if (!MP.on || !UI.inGame) { el.hidden = true; return; }
  let text = '', btn = '', wait = false;
  const P = S.players[ME];
  if (MP.paused) { text = `Paused by ${MP.pausedBy >= 0 ? playerName(MP.pausedBy) : 'a player'}`; btn = 'Resume'; }
  else if (MPJ.on) { text = 'Joining the game…'; wait = true; }
  else if (P && P.out) text = 'Your colony has fallen: you\'re watching the rest of the game.';
  else if (mpAINow(ME)) { text = mpBehind() > 2 ? 'Catching up with the others…' : 'Taking your colony back…'; wait = true; }
  else if (!MP.linkOK && NET.state === 'game') { text = 'Reconnecting…'; wait = true; }
  else if (MP.stalled > 0.8 && MP.waitFor.length) {
    const names = MP.waitFor.map((p) => playerName(p)).join(' and ');
    const left = Math.max(0, Math.ceil(LS.STALL_S - MP.stalled));
    text = `Waiting for ${names}` + (MP.stalled > 4 ? ` (the computer takes over in ${left} s)` : '…');
    wait = true;
  }
  el.hidden = !text;
  if (!text) return;
  $('mp-banner-text').textContent = text;
  el.classList.toggle('wait', wait);
  $('mp-banner-btn').hidden = !btn;
  if (btn) $('mp-banner-btn').textContent = btn;
}

/** The pause menu in a multiplayer game: it doesn't stop the game (Pause for everyone does). */
function mpSyncPauseMenu() {
  const on = MP.on;
  $('p-title').textContent = on ? 'Menu' : 'Paused';
  $('p-resume').textContent = on ? 'Back to the game' : 'Resume';
  $('p-mppause').hidden = !on;
  if (on) $('p-mppause').textContent = MP.paused ? 'Resume the game for everyone' : 'Pause the game for everyone';
  $('p-quit').textContent = on ? (UI.mpQuitArm ? 'Tap again to leave: the computer takes over your colony' : 'Leave the game') : 'Save & quit to menu';
  $('p-saved').hidden = on;
}

/** Leave a multiplayer game for the main menu (the others' computers run my colony from here). */
function mpQuit() {
  if (MP.on && !(S && S.winner >= 0)) mpLeave(); else mpStop();
  setTimeout(() => netClose(), 300); // (a moment for the word to get out)
  netRemember(false);
  UI.mpQuitArm = false;
}

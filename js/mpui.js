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
  // A computer's doctrine, in a line under the list (mpDocNote): with a mouse, the row under it (the line keeps its
  // height, so nothing moves); on a touch screen, the row tapped (tap it again to close the line). How it plays opens
  // the whole description; a click on another row closes it again.
  const rowOf = (e) => { const li = e.target.closest && e.target.closest('li.ai[data-k]'); return li ? +li.dataset.k : null; };
  $('mp-players').addEventListener('pointerover', (e) => { const k = rowOf(e); if (e.pointerType === 'mouse' && k !== null && !UI.mpDocOpen && UI.mpDocK !== k) { UI.mpDocK = k; mpDocNote(); } });
  $('mp-players').addEventListener('click', (e) => {
    const k = rowOf(e);
    if (k === null) return;
    const onSelect = e.target.closest('select');
    if (!canHover() && UI.mpDocK === k && !onSelect) UI.mpDocK = null; // (the same row again: close)
    else { if (UI.mpDocK !== k) UI.mpDocOpen = false; UI.mpDocK = k; }
    mpDocNote();
  });
  $('mp-players').addEventListener('focusin', (e) => { const k = rowOf(e); if (k !== null && e.target.matches(':focus-visible') && UI.mpDocK !== k) { UI.mpDocK = k; UI.mpDocOpen = false; mpDocNote(); } });
  $('mp-docnote').addEventListener('click', (e) => {
    const b = e.target.closest && e.target.closest('button[data-doc]');
    if (!b) return;
    sfx('click');
    if (b.dataset.doc === 'close') UI.mpDocK = null; else UI.mpDocOpen = b.dataset.doc === 'more';
    mpDocNote();
  });
  $('mp-start').onclick = () => { sfx('click'); mpHostStart(); };
  $('mp-leave').onclick = () => { sfx('click'); mpLeaveLobby(); };
  $('mp-joincancel').onclick = () => {
    sfx('click'); mpStop(); netClose();
    UI.mpRejoining = false; UI.mpWasRejoin = false;
    mpView('connect'); closeMulti(); syncRejoin();
  };
  $('m-rejoin').onclick = () => { sfx('click'); audioUnlock(); mpRejoinGame(); };
  $('p-mppause').onclick = () => { sfx('click'); mpPause(!MP.paused); };
  $('mp-banner-btn').onclick = () => { sfx('click'); if (MP.paused) mpPause(false); };

  NET.onError = (why) => {
    if (why === 'taken' && NET.create) { netConnect(netRandomCode(), { create: true, name: NET.name }); return; } // (that code's in use: another)
    if (MPJ.on || UI.mpRejoining) {
      UI.mpRejoining = false; mpStop();
      if (why === 'none' || why === 'started') netRemember(false);
      mpView('connect'); syncRejoin();
    }
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
  const m = UI.menu, least = m.shapeRnd ? 2 : minPlayers(m.shape || 0), total = clamp(Math.max(Math.round(m.players) || 2, people || 2, least), 2, 4);
  const keep = m.players;
  m.players = total;
  const pick = final ? resolveRandom() : { shape: m.shape || 0, biome: m.biome || 0 };
  m.players = keep;
  return {
    seed: m.seed, diff: m.diff, size: m.size.versus ?? DEFAULT_SIZE.versus, rough: m.rough, rich: m.rich,
    shape: pick.shape, shapeRnd: !final && !!m.shapeRnd, biome: BIOME_ORDER[pick.biome], biomeRnd: !final && !!m.biomeRnd,
    players: clamp(Math.max(Math.round(m.players) || 2, least), 2, 4), style: m.style, styles: [0, 1, 2, 3].map((p) => menuSlotStyle(p)), nuke: !!m.nuke, events: !!m.events, victory: m.victory || 'capture',
    murmur: murmurLevelOk(m.murmur) ? m.murmur : 'active', // (Off, Quiet or Active: every device makes the same Murmur)
    scars: scarsPref(), // (War scars: the host's, so every device scars the land alike)
    teams: !!m.teams && total === 4, teamOf: m.teams && total === 4 ? mpTeamSeats() : null, mods: modList(m.mods, 'versus'),
    sum: mpSummary(),
  };
}

/**
 * (the host) Teams: which team each person in the lobby is on (seat → 0 or 1). New arrivals join the smaller team;
 * no more than two a side; the host moves people across by tapping them.
 */
function mpTeamSeats() {
  const people = NET.seats.map((s) => s.seat), T = UI.mpTeamOf || (UI.mpTeamOf = {}); // (everyone seated, away for a moment or not)
  for (const k of Object.keys(T)) if (!people.includes(+k)) delete T[k];
  for (const seat of people) if (T[seat] === undefined) { const a = people.filter((q) => T[q] === 0).length, b = people.filter((q) => T[q] === 1).length; T[seat] = a <= b ? 0 : 1; }
  for (const t of [0, 1]) { const on = people.filter((q) => T[q] === t); while (on.length > 2) T[on.pop()] = 1 - t; }
  return { ...T };
}

/** The game in a line, for the lobby. */
function mpSummary() {
  const m = UI.menu, bits = [];
  // (four colonies: as many as asked for, or as the map type is made for: Twin Valleys and Long Haul 2v2 take four)
  if (m.teams && Math.max(Math.round(m.players) || 2, m.shapeRnd ? 2 : minPlayers(m.shape || 0)) >= 4) bits.push('Teams, 2 vs 2');
  bits.push(m.shapeRnd ? 'Random map' : SHAPE_PRESETS[m.shape || 0].name, m.biomeRnd ? 'random biome' : biomeName(m.biome || 0), SIZE_PRESETS[m.size.versus ?? DEFAULT_SIZE.versus].name.toLowerCase());
  if (m.victory && m.victory !== 'capture') bits.push(VICTORY[m.victory].name);
  if (m.nuke) bits.push('Nuclear race');
  if (m.events) bits.push('Planetary events');
  bits.push(menuMurmurLevel() === 'off' ? 'no Murmur' : `Murmur: ${MURMUR_NAMES[menuMurmurLevel()]}`);
  const mods = modList(m.mods, 'versus');
  if (mods.length) bits.push('Challenge: ' + mods.map((k) => MODS[k].name).join(', '));
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
  const teams = !!(st && st.teams && st.teamOf);
  const tags = (s) => [s.seat === NET.host ? 'host' : '', s.seat === NET.seat ? 'you' : '', s.on ? '' : 'away', s.v && s.v !== hostV ? 'different version' : ''].filter(Boolean).join(' · ');
  const person = (s, col, also) => `<li class="${s.on ? '' : 'off'}${host && teams ? ' mp-swap' : ''}" data-seat="${s.seat}"><span class="dot" style="background:${col}"></span><span class="nm">${esc(s.name)}</span><small>${[tags(s), also].filter(Boolean).join(' · ')}</small></li>`;
  // The computer's places, each with its doctrine: the host picks it here (a dropdown), and it goes round with the
  // settings (st.styles, by player slot: a choice stays with its colony), so every device deals the same. The rows are
  // the places the game will have: people away at the start get none (see mpHostStart), so they're listed apart.
  const slots = [];
  // (each place by its callsign, the Accord's name for its colour: VERMILION for red...)
  const cpu = (slot, ally) => {
    slots.push(slot);
    const v = mpSeatDoc(slot), sign = CALLSIGNS[slot] || 'Computer', who = `${sign}, computer ${ally ? 'player' : 'rival'}`;
    const doc = host ? `<select class="mp-doc" data-k="${slot}" aria-label="${who}: doctrine">${['Random', ...PERSONALITY_ORDER.map((d) => PERSONALITIES[d].name)].map((n, x) => `<option value="${x}"${x === v ? ' selected' : ''}>${n}</option>`).join('')}</select>`
      : `<small class="mp-docname">${docNameOf(v)}</small>`;
    return `<li class="ai" data-k="${slot}" title="${esc(docInfo(docKeyOf(v)))}"><span class="dot" style="background:${PLAYER_COLORS[slot]}"></span><span class="nm">${sign}</span><small>computer${st ? ' · ' + DIFFICULTY[st.diff].label : ''}</small>${doc}</li>`;
  };
  if (teams) {
    // Two a side: the people on each team, then the computer in the empty places (in the colours they'll land in).
    for (const t of [0, 1]) {
      html += `<li class="mp-team"><span>Team ${t ? 'B' : 'A'}</span>${host ? '<small>tap a player to move them across</small>' : ''}</li>`;
      const on = people.filter((s) => st.teamOf[s.seat] === t);
      for (let n = 0; n < 2; n++) html += n < on.length ? person(on[n], PLAYER_COLORS[t * 2 + n]) : cpu(t * 2 + n, true);
    }
    const away = NET.seats.filter((s) => !s.on);
    if (away.length) html += '<li class="mp-team"><span>Away</span></li>' + away.map((s) => person(s, '#555', `Team ${st.teamOf[s.seat] ? 'B' : 'A'}`)).join('');
  } else {
    for (const s of NET.seats) html += person(s, s.on ? PLAYER_COLORS[k++ % PLAYER_COLORS.length] : '#555');
    for (let a = 0; a < ai; a++) html += cpu(k++ % PLAYER_COLORS.length, false);
  }
  if (UI.mpLobbyHTML !== html || !$('mp-players').children.length) { $('mp-players').innerHTML = html; UI.mpLobbyHTML = html; }
  UI.mpCpuSlots = slots;
  if (host) for (const sel of $('mp-players').querySelectorAll('select.mp-doc')) sel.onchange = () => {
    const p = +sel.dataset.k;
    UI.menu.styles[p] = +sel.value; UI.mpDocK = p; UI.mpDocOpen = false;
    saveSettings(); sfx('click'); mpSendSettings(); renderLobby();
  };
  mpDocNote();
  // (someone seated since the teams were last sent round: put them on one)
  if (host && teams && NET.seats.some((s) => st.teamOf[s.seat] === undefined)) mpSendSettings();
  if (host && teams) for (const li of $('mp-players').querySelectorAll('li.mp-swap')) li.onclick = () => {
    const seat = +li.dataset.seat, T = UI.mpTeamOf || {}, to = 1 - (T[seat] ?? 0);
    if (NET.seats.filter((s) => T[s.seat] === to).length >= 2) { mpMsg('That team has two players already: move one of them across first.'); return; }
    T[seat] = to; UI.mpTeamOf = T; sfx('click'); mpSendSettings();
  };
  $('mp-sum').textContent = st ? st.sum : host ? mpSummary() : 'The host is setting up the game…';
  $('mp-settings').hidden = !host;
  $('mp-start').hidden = !host;
  const room = mpRoom(st || { shape: UI.menu.shape || 0, shapeRnd: UI.menu.shapeRnd });
  let why = '';
  if (people.length < 2) why = `Waiting for the others: give them the room code ${NET.code}.`;
  else if (odd.length) why = `${odd.map((s) => s.name).join(' and ')} ${odd.length > 1 ? 'have' : 'has'} a different version of the game: close it and open it again (with the internet on) to update, then rejoin.`;
  else if (total > room) why = `${st && !st.shapeRnd ? SHAPE_PRESETS[st.shape].name : 'That map type'} has room for ${room}: pick another map type in Change settings (one marked “3–4 players” takes four).`;
  $('mp-start').disabled = !!why;
  $('mp-lmsg').classList.remove('ok');
  $('mp-lmsg').textContent = host || people.length < 2 || odd.length ? why : 'Waiting for the host to start the game…';
  // The host's first look at the lobby: send the settings round.
  if (host && !st) mpSendSettings();
}

/** Player slot p's doctrine in the lobby (0 Random, 1 to 5): the host's own choice, or the settings it sent round. */
function mpSeatDoc(p) {
  if (NET.seat === NET.host) return menuSlotStyle(p);
  const st = NET.settings;
  if (st && Array.isArray(st.styles) && Number.isInteger(st.styles[p])) return st.styles[p];
  return st && Number.isInteger(st.style) ? st.style : 1;
}

/**
 * The places (player slots) the computer will take, as mpHostStart and the relay seat the game: the people in the lobby
 * first, in the order they sat down, or (teamOf: a team game) two a side, Team A in places 0 and 1; people away at the
 * start get no place. `total`: the colonies the settings ask for.
 */
function mpCpuSlots(total, teamOf) {
  const on = NET.seats.filter((s) => s.on), n = Math.max(total, on.length);
  if (teamOf && n === 4) {
    const used = new Set();
    for (const t of [0, 1]) on.filter((s) => teamOf[s.seat] === t).slice(0, 2).forEach((s, i) => used.add(t * 2 + i));
    return [0, 1, 2, 3].filter((p) => !used.has(p));
  }
  return Array.from({ length: n - on.length }, (_, i) => on.length + i);
}

/** Can the lobby's doctrine line follow the mouse (see canHover)? */
const mpHover = () => typeof canHover === 'function' && canHover();

/**
 * The line under the lobby's list: the doctrine of the computer place last pointed at or tapped, in a sentence, with
 * How it plays for the whole of it. With a mouse it is always there (the first computer's until another is pointed
 * at) and keeps the height of the longest sentence, so pointing along the rows moves nothing; on a touch screen it
 * shows once a row is tapped, and closes again.
 */
function mpDocNote() {
  const el = $('mp-docnote'), slots = UI.mpCpuSlots || [], hover = mpHover();
  if (!slots.includes(UI.mpDocK)) { UI.mpDocK = hover && slots.length ? slots[0] : null; UI.mpDocOpen = false; }
  const k = UI.mpDocK;
  el.hidden = k == null;
  if (k == null) return;
  const d = docKeyOf(mpSeatDoc(k)), sign = CALLSIGNS[k] || 'Computer';
  const btn = (what, label) => `<button type="button" class="m-docmore" data-doc="${what}">${label}</button>`;
  // (on a touch screen the row just tapped is right above: no callsign, and a × to close the line)
  const html = (hover ? `<span class="mp-docwho">${sign}</span> ` : '') + (UI.mpDocOpen ? docHTML(d) + ' ' + btn('less', 'Less') : mpDocLine(d) + ' ' + btn('more', 'How it plays')) +
    (hover ? '' : ` <button type="button" class="m-docmore" data-doc="close" aria-label="Close">×</button>`);
  if (el.innerHTML !== html) el.innerHTML = html;
  // (with a mouse: the height of the longest line, measured at this width)
  const key = hover ? el.offsetWidth + '|' + (UI.mpDocOpen ? 1 : 0) : '';
  if (el.dataset.sizedFor === key) return;
  el.dataset.sizedFor = key;
  el.style.minHeight = '';
  if (!hover || !el.offsetWidth) return;
  const probe = el.cloneNode(false);
  probe.removeAttribute('id'); probe.hidden = false;
  probe.style.cssText = `position:absolute;visibility:hidden;left:-9999px;top:0;min-height:0;width:${el.offsetWidth}px`;
  el.parentNode.appendChild(probe);
  let h = 0;
  for (const x of ['random', ...PERSONALITY_ORDER]) { probe.innerHTML = `<span class="mp-docwho">VERMILION</span> ${mpDocLine(x)} ${btn('more', 'How it plays')}`; h = Math.max(h, probe.offsetHeight); }
  probe.remove();
  el.style.minHeight = h + 'px';
}
/** A doctrine in a few words, for the lobby's line: "Warden (turtle): walls in, then comes late in force." */
function mpDocLine(d) {
  return d === 'random' ? `<b>Random:</b> ${DOCTRINE_RANDOM_TAG}.` : `<b>${docLabel(d)}:</b> ${PERSONALITIES[d].tag}.`;
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
  const settings = mpMenuSettings(true, people);
  // Teams: Team A takes the first two colonies (one side of the map), Team B the other two; the computer fills the rest.
  let slots;
  if (settings.teams && settings.teamOf) {
    slots = [-1, -1, -1, -1];
    for (const t of [0, 1]) NET.seats.filter((s) => s.on && settings.teamOf[s.seat] === t).forEach((s, n) => { slots[t * 2 + n] = s.seat; });
  }
  netLobbySend({ t: 'start', settings, slots });
}

function mpLeaveLobby() {
  if (NET.state === 'lobby') netLobbySend({ t: 'leave' });
  netClose();
  mpView('connect');
  mpMsg('');
}

/* ------------------------------------------------------------------ the game */

/**
 * The game every device builds from the start's settings `s` and the player slots people play (`humans`). The
 * doctrines the host picked are by place (player slot, `s.styles`); newGame takes them for its computer players in turn.
 */
function mpGameOpts(s, humans) {
  const total = Math.max(s.players, humans.length), cpus = Array.from({ length: total }, (_, p) => p).filter((p) => !humans.includes(p));
  return {
    seed: s.seed, difficulty: s.diff, mode: 'versus', size: s.size, rough: s.rough, rich: s.rich, shape: s.shape, nuke: !!s.nuke,
    biome: s.biome, players: total, style: docKeyOf(s.style),
    styles: Array.isArray(s.styles) ? cpus.map((p) => (Number.isInteger(s.styles[p]) ? docKeyOf(s.styles[p]) : undefined)) : undefined,
    // (The Murmur: as the host set them; a host from before the setting sent none, and had none.)
    events: !!s.events, murmur: murmurLevelOk(s.murmur) ? s.murmur : 'off', victory: s.victory, humans, teams: !!s.teams, mods: s.mods,
    scars: scarsOk(s.scars) ? s.scars : 'off', // (a host from before War scars sent none, and had none)
  };
}

/** The start (from the relay): make the game, or (a reloaded page) ask for it. */
function mpOnStart(m) {
  if (MP.on || MPJ.on) return; // (a reconnect brings the start again)
  const me = NET.me;
  if (me < 0) return;
  const humans = m.players.map((P, k) => (P ? k : -1)).filter((k) => k >= 0);
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
  newGame(mpGameOpts(s, humans));
  m.players.forEach((P, k) => { if (P) S.players[k].name = P.name; });
  ME = me;
  mpStart({ me, humans, send: netSend });
  MP.onSnap = mpSnapLoaded; MP.onEvent = mpEvent;
  enterGame();
  updateHUD();
  placeMinimap();
  const others = m.players.filter((P, k) => P && k !== me && foes(k, me)).map((P) => P.name);
  const ai = S.players.filter((P) => P.ai && !P.absent && foes(P.id, me)).length;
  const ally = S.teams ? S.players.find((P) => allies(P.id, me)) : null;
  postMsg(ME, `Multiplayer: you against ${[...others, ai ? `${ai} computer rival${ai > 1 ? 's' : ''}` : ''].filter(Boolean).join(' and ')}${ally ? `, with ${ally.name || 'a computer ally, ' + callsign(ally.id, true) + ','} on your side` : ''}. Your bots have landed: build up fast!`, 0, 0, 'info');
  doctrineLines();
  modsBriefing();
  $('br-title').textContent = 'Before you start';
  showBriefing(landingLog());
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
  $('p-quit').textContent = on ? (UI.mpQuitArm ? 'Tap again to leave: the computer takes over your colony' : 'Leave the game') : 'Save & quit';
  $('p-quit').classList.toggle('p-arm', on && !!UI.mpQuitArm); // (the long line: a row of its own)
  $('p-saved').hidden = on;
}

/** Leave a multiplayer game for the main menu (the others' computers run my colony from here). */
function mpQuit() {
  if (MP.on && !(S && S.winner >= 0)) mpLeave(); else mpStop();
  setTimeout(() => netClose(), 300); // (a moment for the word to get out)
  netRemember(false);
  UI.mpQuitArm = false;
}

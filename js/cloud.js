'use strict';
/*
 * Terrafall — cloud saves: a game carried to another device by a code instead of a file (#screen-cloud in index.html).
 *
 * Save to the cloud (pause menu) packs this game's save file (saveFileText, the text Download save file writes) with
 * gzip (CompressionStream) and sends it to the relay's /save (relay/src/saves.js, whose header has the contract). The
 * dialog then shows the code (XXXXX-XXXXX), a link that opens it (https://terrafall.app/#save=XXXXX-XXXXX) with a QR code
 * of the link (js/qr.js, made here, offline), Copy link, Share (where the device can) and when it expires: 30 days
 * after the last save to it. The device keeps { code, key, at, game } (CLOUD_KEY in localStorage): saving the same game
 * again updates its code (PUT, with the key), so one code follows a game; New code makes another and lets the old one go.
 *
 * Load from a code (main menu) fetches /save/<code> and loads it as Load a save file does (loadSaveText in ui.js:
 * checkSave, then the device's own save kept as the backup). Opening a link with #save=<code> (on the main menu, or
 * in the installed app while it's open: hashchange, launchQueue) asks first, then clears it from the address.
 *
 * It is only interface: it sends no order and leaves S alone until a game is loaded. A multiplayer game isn't saved to
 * the cloud (it lives on everyone's devices, and isn't saved for Continue either), nor is Observer mode: the pause
 * menu's button is hidden there.
 */

const CLOUD_KEY = 'terrafall.cloud';     // this device's latest cloud save: { code, key, at, game }
const CLOUD_MAX = 256 << 10;             // bytes, gzipped (the relay's limit)
const CLOUD_DAYS = 30;                   // an entry lives this long after its last save
const CLOUD_HOME = 'https://terrafall.app/';
const CLOUD_ABC = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'; // (the rooms' alphabet, NET_CODES: no I, L, O, 0 or 1)
const CLOUD_EXAMPLE = 'K7PQ4-XMR2B';

/**
 * The dialog's state. view: 'save' | 'load' | 'ask' (a link's code, to confirm); busy: a request on its way; done: the
 * saved entry shown ({ code, expires, kept }); ask: the code a link brought; ctl: the load's AbortController; paused:
 * whether the game was paused before a link's question paused it.
 */
const CLOUD = { view: '', busy: false, done: null, failed: false, ask: '', ctl: null, paused: null };

/** The relay's address for cloud saves (its wss:// as https://, with /save), or '' if there's none. */
function cloudBase() {
  if (!/^https?:$/.test(location.protocol)) return ''; // (the one-file build opened from a disk: the relay takes the game's own sites only)
  const u = typeof relayUrl === 'function' ? relayUrl() : '';
  return u ? u.replace(/^wss:/i, 'https:').replace(/^ws:/i, 'http:') + '/save' : '';
}

/** A code as typed (any case, with or without the dash or spaces) → its 10 characters, or '' if it can't be one. */
function cloudCode(s) {
  const c = String(s || '').toUpperCase().replace(/[\s-]/g, '');
  return c.length === 10 && [...c].every((ch) => CLOUD_ABC.includes(ch)) ? c : '';
}
function cloudShow(c) { return c.slice(0, 5) + '-' + c.slice(5); }

/**
 * The link that opens a code: terrafall.app's, or this page's own address where the game runs somewhere else over
 * the web (a test server, a fork's own Pages), since that copy's relay is the one holding the save.
 */
function cloudLink(c) {
  let base = CLOUD_HOME;
  try {
    const h = location.hostname;
    if (/^https?:$/.test(location.protocol) && !/(^|\.)terrafall\.app$/.test(h) && (/^(localhost|127\.0\.0\.1|\[::1\])$/.test(h) || /\.github\.io$/.test(h))) base = location.origin + location.pathname;
  } catch (e) { /* no location: the published game's */ }
  return base + '#save=' + cloudShow(c);
}

/** This device's latest cloud save ({ code, key, at, game }), or null. */
function cloudMine() {
  try {
    const o = JSON.parse(localStorage.getItem(CLOUD_KEY) || 'null');
    return o && cloudCode(o.code) && /^[0-9a-f]{32}$/.test(o.key) ? o : null;
  } catch (e) { return null; }
}
function cloudKeep(o) {
  try { localStorage.setItem(CLOUD_KEY, JSON.stringify(o)); return true; } catch (e) { return false; }
}

/** Which game this is, to tell whether a saved code is this game's (its planet, mode and players). */
function cloudGameId() {
  const st = S.settings || {};
  return [S.seed, S.mission ? 'mission ' + S.mission.id : S.mode, st.shape, st.biome, S.W + 'x' + S.H, S.players.length].join('|');
}

/** Can this game go to the cloud? (A game of one's own: not multiplayer, not Observer mode; and a relay to send it to.) */
function cloudCanSave() {
  return !!(S && UI.inGame && !UI.watch && !(typeof MP !== 'undefined' && MP.on) && cloudBase());
}

/** The pause menu's Save to the cloud, and the main menu's Load from a code: shown where they can work. */
function syncCloud() {
  if ($('p-cloud')) $('p-cloud').hidden = !cloudCanSave();
  if ($('m-cloud')) $('m-cloud').hidden = !cloudBase();
}

/* ------------------------------------------------------------------ the screen */

function initCloud() {
  $('p-cloud').onclick = () => { sfx('click'); openCloud('save'); };
  $('m-cloud').onclick = () => { sfx('click'); audioUnlock(); $('m-import-msg').hidden = true; openCloud('load'); };
  $('cl-close').onclick = () => { sfx('click'); closeCloud(); };
  $('cl-done').onclick = () => { sfx('click'); closeCloud(); };
  $('cl-cancel').onclick = () => { sfx('click'); closeCloud(); };
  $('cl-retry').onclick = () => { sfx('click'); cloudSave(false); };
  $('cl-new').onclick = () => { sfx('click'); cloudSave(true); };
  $('cl-copy').onclick = () => { sfx('click'); cloudCopy(); };
  $('cl-share').onclick = () => { sfx('click'); cloudShare(); };
  $('cl-link').addEventListener('focus', () => $('cl-link').select());
  $('cl-form').addEventListener('submit', (e) => { e.preventDefault(); cloudLoad(CLOUD.view === 'ask' ? CLOUD.ask : $('cl-input').value); });
  // The code as it's typed: capitals, only its alphabet's letters and digits, and the dash put in after five.
  $('cl-input').addEventListener('input', () => {
    const el = $('cl-input'), c = el.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 10);
    el.value = c.length > 5 ? cloudShow(c) : c;
    if (!CLOUD.busy) cloudSay('');
  });
  // Every key pressed in the dialog is its own (a letter typed isn't a hotkey); Esc closes it.
  $('screen-cloud').addEventListener('keydown', (e) => {
    e.stopPropagation();
    if (e.key === 'Escape' && !e.isComposing) { e.preventDefault(); closeCloud(); }
  });
  // A phone's (or the browser's) Back closes it on the main menu (opening added a history entry); in a game the
  // game's own Back steps back through escapeKey, which closes it first.
  window.addEventListener('popstate', () => { if (!UI.inGame) closeCloud(true); });
  // A link with #save=<code>: when the game opens on it, and when the open game (the installed app) is sent one.
  window.addEventListener('hashchange', () => cloudFromLink(location.hash));
  try { if (window.launchQueue && typeof launchQueue.setConsumer === 'function') launchQueue.setConsumer((p) => { try { if (p && p.targetURL) cloudFromLink(new URL(p.targetURL).hash); } catch (e) { /* not a link of ours */ } }); } catch (e) { /* no launch queue */ }
  syncCloud();
  setTimeout(() => cloudFromLink(location.hash), 0); // (once the rest of the game is set up, as a ?join= link is)
}

/** Open the dialog: 'save' (the pause menu: send this game), 'load' (type a code) or 'ask' (a link's code: confirm). */
function openCloud(view, code) {
  const scr = $('screen-cloud');
  if (view === 'save' && !cloudCanSave()) return;
  const was = !scr.hidden;
  if (CLOUD.ctl) { CLOUD.ctl.abort(); CLOUD.ctl = null; }
  CLOUD.view = view;
  CLOUD.ask = view === 'ask' ? code : '';
  if (view === 'load' && !CLOUD.busy) { $('cl-input').value = code ? cloudShow(code) : ''; }
  cloudSay('');
  scr.hidden = false;
  if (!was && !UI.inGame) try { history.pushState({ cloud: 1 }, ''); } catch (e) { /* no history to add to (a sandboxed frame) */ }
  if (view === 'save') cloudSave(false); else cloudSync();
  // (after the dialog's own focus, initDialogs: with a keyboard the code box takes the keys at once)
  setTimeout(() => {
    if (scr.hidden) return;
    if (CLOUD.view === 'load' && canHover()) $('cl-input').focus({ preventScroll: true });
    else if (CLOUD.view === 'ask') $('cl-go').focus({ preventScroll: true });
  }, 0);
}

function closeCloud(fromBack) {
  const scr = $('screen-cloud');
  if (scr.hidden) return;
  scr.hidden = true;
  if (CLOUD.ctl) { CLOUD.ctl.abort(); CLOUD.ctl = null; } // (a load not wanted any more doesn't land later)
  if (CLOUD.paused !== null) { if (UI.inGame && $('screen-pause').hidden) UI.paused = CLOUD.paused; CLOUD.paused = null; }
  CLOUD.view = '';
  if (!fromBack) try { if (history.state && history.state.cloud) history.back(); } catch (e) { /* as above */ }
}

/** The dialog as CLOUD has it: which part shows, the title, what's busy, and the saved code's details. */
function cloudSync() {
  const v = CLOUD.view, save = v === 'save', d = CLOUD.done;
  $('cl-title').textContent = save ? 'Save to the cloud' : 'Load from a code';
  $('cl-save').hidden = !save;
  $('cl-form').hidden = save;
  const busy = save && CLOUD.busy;
  $('cl-busy').hidden = !busy;
  $('cl-out').hidden = !(save && !busy && d);
  // Under it: New code and Done once it's saved; Try again (and Close) when it didn't go.
  $('cl-retry').hidden = !(save && !busy && !d && CLOUD.failed);
  $('cl-new').hidden = !(save && !busy && d);
  $('cl-done').hidden = busy;
  $('cl-done').textContent = d ? 'Done' : 'Close';
  if (save && d) {
    const link = cloudLink(d.code);
    $('cl-code').textContent = cloudShow(d.code);
    $('cl-link').value = link;
    if ($('cl-qr').dataset.link !== link) {
      try { $('cl-qr').innerHTML = qrSvg(link); } catch (e) { $('cl-qr').textContent = ''; }
      $('cl-qr').dataset.link = link;
      $('cl-qr').setAttribute('aria-label', `QR code of the link to ${cloudShow(d.code)}: scan it with another device's camera`);
    }
    $('cl-share').hidden = typeof navigator.share !== 'function';
    $('cl-exp').textContent = `Kept until ${cloudDate(d.expires)}, ${CLOUD_DAYS} days after the last save to it. Save to the cloud again to update it with this game as it is then.`
      + (d.kept ? '' : ' (This browser isn\'t keeping data, so that will make a new code.)');
  }
  // Loading: the code box, or a link's question.
  const ask = v === 'ask';
  $('cl-ask').hidden = !ask;
  if (ask) $('cl-ask').textContent = `Load the cloud save ${cloudShow(CLOUD.ask)}? The save on this device is kept as a backup.`;
  $('cl-lead').hidden = ask;
  $('cl-field').hidden = ask;
  $('cl-cancel').hidden = !ask;
  $('cl-input').readOnly = CLOUD.busy;
  $('cl-go').disabled = CLOUD.busy;
  $('cl-go').textContent = CLOUD.busy && !save ? 'Loading…' : 'Load';
  $('screen-cloud').setAttribute('aria-busy', CLOUD.busy ? 'true' : 'false');
}

/** A date as the player reads it: "17 December 2026" (in their own language's order). */
function cloudDate(ms) {
  try { return new Date(ms).toLocaleDateString(undefined, { day: 'numeric', month: 'long', year: 'numeric' }); } catch (e) { return new Date(ms).toDateString(); }
}

/** A line in the dialog: '' clears it; kind 'warn' (something to fix first), 'bad' (it didn't work) or 'good'. */
function cloudSay(text, kind) {
  const el = $('cl-msg');
  el.textContent = text;
  el.className = 'cl-msg' + (text && kind ? ' ' + kind : '');
  // (the line sits with whichever part is showing)
  const home = CLOUD.view === 'save' ? $('cl-save') : $('cl-form');
  if (el.parentNode !== home) home.insertBefore(el, home.querySelector('.cl-msg-here'));
}

/** Why a request to the relay didn't work, in the player's words. */
function cloudWhy(res, out, loading) {
  if (!res) {
    if (navigator.onLine === false) return 'You\'re offline: connect to the internet and try again.';
    const home = /(^|\.)terrafall\.app$|^(localhost|127\.0\.0\.1|\[::1\])$/.test(location.hostname);
    return 'Couldn\'t reach the cloud save server: check your connection and try again.' + (home ? '' : ' (Cloud saves work in the game at terrafall.app.)');
  }
  const why = (out && out.why) || '';
  if (res.status === 404 && loading) return `No save has that code. Check it and try again (a code is 10 letters and digits, like ${CLOUD_EXAMPLE}).`;
  if (res.status === 410) return `That cloud save has expired: a code lasts ${CLOUD_DAYS} days after the last save to it.`;
  if (res.status === 400 && why === 'code') return `That isn't a code: a code is 10 letters and digits, like ${CLOUD_EXAMPLE}.`;
  if (res.status === 429) return 'That\'s a lot of cloud saves from here today: please try again tomorrow.';
  if (res.status === 413) return 'This game is too big for a cloud save (over 256 KB packed): use Download save file instead.';
  if (res.status === 503 && why === 'off') return 'Cloud saves aren\'t switched on yet: the game\'s maker is still setting them up. Please try again in a few days.';
  if (res.status === 403 && why === 'origin') return 'Cloud saves work in the game at terrafall.app: this copy of the game can\'t use them.';
  return `Something went wrong (error ${res.status}). Please try again later.`;
}

/** fetch, with a time limit; null if it never got an answer (offline, the server unreachable, too slow, cancelled). */
async function cloudFetch(url, init, ms, ctl) {
  ctl = ctl || (typeof AbortController === 'function' ? new AbortController() : null);
  const timer = ctl ? setTimeout(() => ctl.abort(), ms) : 0;
  try {
    const res = await fetch(url, { ...init, cache: 'no-store', signal: ctl ? ctl.signal : undefined });
    return res;
  } catch (e) { return null; } finally { clearTimeout(timer); }
}

/* ------------------------------------------------------------------ saving */

/** This game's save file, gzipped (null if this browser can't). */
async function cloudPack(text) {
  if (typeof CompressionStream !== 'function') return null;
  const stream = new Blob([text]).stream().pipeThrough(new CompressionStream('gzip'));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

/**
 * Send this game to the cloud: to this device's code for it if it has one (PUT), or a new code (POST). `fresh` (New
 * code): a new code whatever, and the old one is let go (DELETE).
 */
async function cloudSave(fresh) {
  if (CLOUD.busy || !cloudCanSave()) return;
  const base = cloudBase();
  CLOUD.busy = true; CLOUD.failed = false;
  if (!fresh) CLOUD.done = null;
  $('cl-busy').textContent = fresh ? 'Making a new code for this game…' : 'Saving your game to the cloud…';
  cloudSay('');
  cloudSync();
  const fail = (m) => { CLOUD.busy = false; CLOUD.failed = !CLOUD.done; cloudSync(); cloudSay(m, 'bad'); };
  let text = '', gz = null;
  try { text = saveFileText(); } catch (e) { fail('This game couldn\'t be put together for saving. Please try again.'); return; }
  if (!UI.saveHold) saveGame(); // (the save on this device is up to date too, as with Download save file)
  try { gz = await cloudPack(text); } catch (e) { gz = null; }
  if (!gz) { CLOUD.failed = false; CLOUD.busy = false; cloudSync(); cloudSay('This browser can\'t pack a game for the cloud: use Download save file instead (or update the browser).', 'bad'); return; }
  if (gz.byteLength > CLOUD_MAX) { CLOUD.busy = false; cloudSync(); cloudSay('This game is too big for a cloud save (over 256 KB packed): use Download save file instead.', 'bad'); return; }
  const game = cloudGameId(), mine = cloudMine(), ours = mine && mine.game === game ? mine : null;
  const send = { headers: { 'content-type': 'application/gzip' }, body: gz };
  let res = null, out = {};
  // This game's code: update it (gone, expired or not ours any more: a new one instead).
  if (ours && !fresh) {
    res = await cloudFetch(`${base}/${ours.code}`, { method: 'PUT', ...send, headers: { ...send.headers, authorization: 'Bearer ' + ours.key } }, 60000);
    out = res ? await res.json().catch(() => ({})) : {};
    if (res && res.ok && out.ok) { cloudSaved({ ...ours, at: Date.now() }, out.expires); return; }
    if (res && ![403, 404, 410].includes(res.status)) { fail(cloudWhy(res, out)); return; }
    if (!res) { fail(cloudWhy(null)); return; }
  }
  res = await cloudFetch(base, { method: 'POST', ...send }, 60000);
  out = res ? await res.json().catch(() => ({})) : {};
  if (!(res && res.ok && out.ok && cloudCode(out.code) && /^[0-9a-f]{32}$/.test(out.key || ''))) { fail(cloudWhy(res, out)); return; }
  // New code: the old one goes (so a code shared before stops working).
  if (fresh && ours) cloudFetch(`${base}/${ours.code}`, { method: 'DELETE', headers: { authorization: 'Bearer ' + ours.key } }, 30000);
  cloudSaved({ code: out.code, key: out.key, at: Date.now(), game }, out.expires);
}

/** The relay has it: the device remembers the code (and key), and the dialog shows it. */
function cloudSaved(rec, expires) {
  const kept = cloudKeep(rec);
  CLOUD.busy = false;
  CLOUD.done = { code: rec.code, expires: +expires || Date.now() + CLOUD_DAYS * 86400e3, kept };
  if ($('screen-cloud').hidden || CLOUD.view !== 'save') {
    // (closed before the answer came: in a game, a message says so instead)
    if (UI.inGame) toast(`Saved to the cloud: code ${cloudShow(rec.code)} (main menu, Load from a code, on another device).`, 'good');
    return;
  }
  cloudSay('');
  cloudSync();
  $('cl-copy').focus({ preventScroll: true });
}

async function cloudCopy() {
  const d = CLOUD.done;
  if (!d) return;
  const link = cloudLink(d.code);
  try {
    await navigator.clipboard.writeText(link);
    cloudSay('Link copied.', 'good');
  } catch (e) {
    // (no clipboard here: the link is picked out, ready to copy by hand)
    $('cl-link').focus(); $('cl-link').select();
    cloudSay('Copy the link above by hand (it\'s selected), or type the code on the other device.', 'warn');
  }
}

async function cloudShare() {
  const d = CLOUD.done;
  if (!d || typeof navigator.share !== 'function') return;
  try { await navigator.share({ title: 'Terrafall', text: `My Terrafall game: code ${cloudShow(d.code)}`, url: cloudLink(d.code) }); } catch (e) { /* cancelled */ }
}

/* ------------------------------------------------------------------ loading */

/** A link's #save=<code>: clear it from the address, then ask whether to load it. */
function cloudFromLink(hash) {
  const m = /^#save=([^&]*)/i.exec(String(hash || ''));
  if (!m) return;
  try { if (/^#save=/i.test(location.hash)) history.replaceState(history.state, '', location.pathname + location.search); } catch (e) { /* no history */ }
  let raw = '';
  try { raw = decodeURIComponent(m[1]); } catch (e) { raw = m[1]; }
  const c = cloudCode(raw);
  if (!$('screen-cloud').hidden && CLOUD.view === 'ask' && CLOUD.ask === c) return; // (the same link twice)
  if (UI.inGame && ((typeof MP !== 'undefined' && MP.on) || (typeof MPJ !== 'undefined' && MPJ.on))) {
    toast('A cloud save link: leave this multiplayer game first (menu, Leave the game), then open the link again.', 'warn');
    return;
  }
  if (UI.inGame && CLOUD.paused === null) { CLOUD.paused = UI.paused; UI.paused = true; }
  if (!c) { openCloud('load'); $('cl-input').value = raw.toUpperCase().slice(0, 11); cloudSay(`That link's code isn't right: a code is 10 letters and digits, like ${CLOUD_EXAMPLE}.`, 'bad'); return; }
  openCloud('ask', c);
}

/** Load the save under a code, as Load a save file loads a file; the dialog says why if it can't. */
async function cloudLoad(typed) {
  if (CLOUD.busy) return;
  const c = cloudCode(typed);
  if (!c) { cloudSay(`A code is 10 letters and digits, like ${CLOUD_EXAMPLE}.`, 'warn'); $('cl-input').focus(); return; }
  const base = cloudBase();
  if (!base) { cloudSay('This copy of the game has no cloud save server.', 'bad'); return; }
  const ctl = typeof AbortController === 'function' ? new AbortController() : null;
  CLOUD.ctl = ctl;
  CLOUD.busy = true;
  cloudSay('');
  cloudSync();
  const res = await cloudFetch(`${base}/${c}`, { method: 'GET' }, 60000, ctl);
  let text = '';
  if (res && res.ok) { try { text = await res.text(); } catch (e) { text = ''; } }
  const cancelled = ctl && ctl.signal.aborted && $('screen-cloud').hidden;
  CLOUD.busy = false;
  if (CLOUD.ctl === ctl) CLOUD.ctl = null;
  if (cancelled) { cloudSync(); return; }
  if (!(res && res.ok && text)) {
    const out = res ? await res.json().catch(() => ({})) : {};
    CLOUD.view = 'load';
    $('cl-input').value = cloudShow(c);
    cloudSync();
    cloudSay(res && res.ok ? 'That cloud save came through empty. Please try again.' : cloudWhy(res, out, true), 'bad');
    return;
  }
  // A save that won't load leaves everything as it was (a game being played too): checked before anything is closed.
  const bad = () => {
    CLOUD.view = 'load';
    $('cl-input').value = cloudShow(c);
    cloudSync();
    cloudSay('That save couldn\'t be loaded: it\'s damaged, or from a newer version of the game. Nothing on this device has changed.', 'bad');
  };
  try {
    let json = text;
    const o = JSON.parse(json);
    if (o && o.terrafall && typeof o.game === 'string') json = o.game;
    checkSave(JSON.parse(json));
  } catch (e) { bad(); return; }
  // From a game (a link opened in the installed app while playing): that game is saved first, so it becomes the backup.
  if (UI.inGame) {
    if (UI.photo) photoExit();
    if (UI.watch) watchEnd(); else if (!UI.saveHold) saveGame();
    for (const id of ['screen-pause', 'screen-over', 'screen-help', 'screen-stats']) $(id).hidden = true;
  }
  // (the dialog's place in the history becomes the game's, as a game started from the menu has)
  let marked = false;
  try { if (history.state && history.state.cloud) { history.replaceState({ terrafall: 1 }, ''); marked = true; } } catch (e) { /* no history */ }
  if (!loadSaveText(text, `Cloud save ${cloudShow(c)} loaded. Welcome back.`)) {
    if (marked && !UI.inGame) try { history.replaceState({ cloud: 1 }, ''); } catch (e) { /* as above */ }
    bad();
    return;
  }
  CLOUD.paused = null;
  closeCloud(true);
}

'use strict';
/*
 * Terrafall — Send feedback: the short form behind Feedback on the main menu and Send feedback in the pause menu
 * (#screen-feedback in index.html). It posts what the player writes to the relay's /feedback (relay/src/feedback.js,
 * which files it as an issue for the game's maker), with a few facts about this copy of the game, the device and the
 * game being played (feedbackMeta) and, only if the player ticks Attach my current game, that game's save file
 * (saveFileText, as Download save file writes it).
 *
 * It is only interface: it sends no game order and leaves the game as it was (paused under the pause menu, or running
 * on under the multiplayer menu), so it can't touch a multiplayer game. What the player wrote stays in the form until
 * it has been sent: an error, closing the form or a reply that comes back after it was closed never loses it.
 */

/** The relay's limits (relay/src/feedback.js): characters of text, contact, meta (as JSON) and save. */
const FB_MIN_TEXT = 3, FB_MAX_TEXT = 5000, FB_MAX_CONTACT = 200, FB_MAX_META = 4000, FB_MAX_SAVE = 8 << 20;
const FB_TYPES = ['bug', 'idea', 'balance', 'other'];
/** The text box's prompt for each kind of report. */
const FB_PROMPT = {
  bug: 'What went wrong? What were you doing just before, and what did you expect to happen?',
  idea: 'What would you like to see in the game?',
  balance: 'What feels too strong, too weak, too fast or too slow?',
  other: 'Anything else you would like to say about the game.',
};
/** The last few messages of the game (toast's log) that go with a report from a game. */
const FB_LOG = 5;

/**
 * The form's state. type: the kind picked; busy: a report on its way; saveSet: the player has ticked or unticked
 * Attach my current game themselves (until then it follows the type: on for a Bug); sent: the thanks to show (a report
 * filed: { n, note }), until the form is next closed.
 */
const FB = { type: 'bug', busy: false, saveSet: false, sent: null };

/** The relay's feedback address: its wss:// (ws://) address as https:// (http://), with /feedback; '' if there's none. */
function feedbackUrl() {
  const u = typeof relayUrl === 'function' ? relayUrl() : '';
  return u ? u.replace(/^wss:/i, 'https:').replace(/^ws:/i, 'http:') + '/feedback' : '';
}

/** Is a game running (the pause menu's Send feedback): its map and time go with a report, and its save can. */
function feedbackGame() { return !!(UI.inGame && S && S.players); }

/**
 * What a report says about this copy of the game, the device and (in a game) the game: kept small (the relay keeps it
 * only while its JSON is at most FB_MAX_META characters, and shows each value cut to 300).
 */
function feedbackMeta() {
  const m = {};
  try { m.version = gameVersion(); } catch (e) { m.version = 'unknown'; }
  if (window.TOD_BUNDLE) m.version += ' (one-file build)';
  m.device = String(navigator.userAgent || 'unknown').slice(0, 280);
  let touch = false, app = false;
  try { touch = onTouch(); } catch (e) { /* (no input yet) */ }
  try { app = matchMedia('(display-mode: standalone)').matches || navigator.standalone === true; } catch (e) { /* as above */ }
  m.screen = `${innerWidth}x${innerHeight} @${+(window.devicePixelRatio || 1).toFixed(2)}x, ${touch ? 'touch' : 'mouse'}${app ? ', installed app' : ''}`;
  if (feedbackGame()) {
    const st = S.settings || {}, M = S.mission;
    m.mode = M ? `mission ${M.id} (${MISSION_DIFFS[M.diff] || M.diff})` : S.mode;
    if (typeof MP !== 'undefined' && MP.on) m.multiplayer = `${MP.humans.length} people, this device is player ${MP.me + 1}`;
    m.map = (SHAPE_PRESETS[st.shape || 0] || {}).name || String(st.shape);
    m.biome = st.biome || 'desert';
    m.size = (SIZE_PRESETS[st.size] || {}).name || String(st.size);
    m.seed = S.seed;
    m.players = S.players.length;
    if (S.mode === 'versus' && !M) m.difficulty = S.difficulty;
    m.time = fmtTime(S.time);
    const log = (UI.msgLog || []).slice(-FB_LOG);
    log.forEach((x, k) => { m['message ' + (k + 1)] = `${fmtTime(x.t)} ${x.text}${x.n > 1 ? ' ×' + x.n : ''}`.slice(0, 240); });
  }
  // Too big (a long message log): the oldest messages go first, then the device's description is cut.
  for (let k = 1; JSON.stringify(m).length > FB_MAX_META && m['message ' + k] !== undefined; k++) delete m['message ' + k];
  if (JSON.stringify(m).length > FB_MAX_META) m.device = m.device.slice(0, 120);
  return m;
}

/* ------------------------------------------------------------------ the screen */

function initFeedback() {
  $('m-feedback').onclick = () => { sfx('click'); openFeedback(); };
  $('p-feedback').onclick = () => { sfx('click'); openFeedback(); };
  $('fb-close').onclick = () => { sfx('click'); closeFeedback(); };
  $('fb-ok').onclick = () => { sfx('click'); closeFeedback(); };
  for (const b of $('fb-type').children) b.onclick = () => { if (FB.busy) return; sfx('click'); fbSetType(b.dataset.v); };
  // The kinds are one radio group: ← → (↑ ↓) move through them, as anywhere else.
  $('fb-type').addEventListener('keydown', (e) => {
    const d = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }[e.key];
    if (!d || FB.busy) return;
    e.preventDefault();
    fbSetType(FB_TYPES[(FB_TYPES.indexOf(FB.type) + d + FB_TYPES.length) % FB_TYPES.length]);
    $('fb-type').querySelector('.on').focus();
  });
  $('fb-text').addEventListener('input', fbCount);
  $('fb-save').onchange = () => { FB.saveSet = true; };
  $('fb-form').addEventListener('submit', (e) => { e.preventDefault(); sendFeedback(); });
  // Every key pressed in the form is the form's: none reaches the game's own keys (a letter typed is not a hotkey,
  // Space does not resume the game behind it). Esc closes it; Ctrl+Enter (⌘Enter) sends.
  $('screen-feedback').addEventListener('keydown', (e) => {
    e.stopPropagation();
    if (e.isComposing) return;
    if (e.key === 'Escape') { e.preventDefault(); closeFeedback(); return; }
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey) && !FB.sent) { e.preventDefault(); sendFeedback(); }
  });
  // A phone's (or the browser's) Back closes it on the main menu (opening added a history entry); in a game the
  // game's own Back (initBack) steps back through escapeKey, which closes it first.
  window.addEventListener('popstate', () => { if (!UI.inGame) closeFeedback(true); });
  fbSync();
}

/** Open the form: from the main menu, or from the pause menu over a game (which stays as it is). */
function openFeedback() {
  const scr = $('screen-feedback');
  if (!scr.hidden) return;
  const game = feedbackGame();
  $('fb-save-row').hidden = !game;
  if (!FB.saveSet) $('fb-save').checked = game && FB.type === 'bug';
  if (!FB.busy && !/\bbad\b/.test($('fb-msg').className)) fbSay(''); // (why the last try failed stays said, beside the text it kept)
  fbSync();
  scr.hidden = false;
  if (!UI.inGame) try { history.pushState({ feedback: 1 }, ''); } catch (e) { /* no history to add to (a sandboxed frame) */ }
  // With a keyboard the text box takes the keys at once (not under a finger: the on-screen keyboard would cover the
  // form before it has been read). After the dialog's own focus (initDialogs).
  setTimeout(() => {
    if (scr.hidden) return;
    if (FB.sent) $('fb-ok').focus({ preventScroll: true });
    else if (!FB.busy && canHover()) $('fb-text').focus({ preventScroll: true });
  }, 0);
}

function closeFeedback(fromBack) {
  const scr = $('screen-feedback');
  if (scr.hidden) return;
  scr.hidden = true;
  if (FB.sent) { FB.sent = null; fbSync(); } // (thanked: next time, a fresh form)
  if (!fromBack) try { if (history.state && history.state.feedback) history.back(); } catch (e) { /* as above */ }
}

function fbSetType(t) {
  if (!FB_TYPES.includes(t)) return;
  FB.type = t;
  if (!FB.saveSet) $('fb-save').checked = feedbackGame() && t === 'bug';
  fbSync();
}

/** The form as FB has it: the kind picked, the prompt, what is sent, the counter, and the form or the thanks. */
function fbSync() {
  for (const b of $('fb-type').children) {
    const on = b.dataset.v === FB.type;
    b.classList.toggle('on', on);
    b.setAttribute('aria-checked', on ? 'true' : 'false');
    b.tabIndex = on ? 0 : -1;
  }
  $('fb-text').placeholder = FB_PROMPT[FB.type];
  $('fb-what').textContent = feedbackGame()
    ? 'Sent with it: your message, your email or name if you give one, the game\'s version, your device and screen size, and this game\'s map, seed, time and last few messages (and the game itself, only if ticked). Nothing else.'
    : 'Sent with it: your message, your email or name if you give one, the game\'s version, and your device and screen size. Nothing else.';
  fbCount();
  $('fb-form').hidden = !!FB.sent;
  $('fb-done').hidden = !FB.sent;
  if (FB.sent) $('fb-thanks').textContent = (FB.sent.n > 0 ? `Thanks! Report #${FB.sent.n} is filed.` : 'Thanks! Your report is filed.') + (FB.sent.note ? ' ' + FB.sent.note : '');
}

function fbCount() {
  const n = $('fb-text').value.length, el = $('fb-count');
  el.textContent = `${n} / ${FB_MAX_TEXT}`;
  el.classList.toggle('near', n > FB_MAX_TEXT - 500);
}

/** A line under the form: '' clears it; kind 'warn' (something to fix first) or 'bad' (it didn't go). */
function fbSay(text, kind) {
  const el = $('fb-msg');
  el.textContent = text;
  el.className = 'fb-msg' + (text && kind ? ' ' + kind : '');
}

function fbBusy(on) {
  FB.busy = on;
  const send = $('fb-send');
  send.disabled = on;
  send.textContent = on ? 'Sending…' : 'Send';
  $('fb-text').readOnly = on;
  $('fb-contact').readOnly = on;
  $('fb-save').disabled = on;
  for (const b of $('fb-type').children) b.disabled = on;
  $('fb-form').setAttribute('aria-busy', on ? 'true' : 'false');
}

/* ------------------------------------------------------------------ sending */

/**
 * Send the report: { type, text, contact?, meta, save?, website } as JSON to feedbackUrl(). The text box is emptied
 * only once the relay says the report is filed; on any other answer the form says why, and everything stays as typed.
 */
async function sendFeedback() {
  if (FB.busy || FB.sent) return;
  const text = $('fb-text').value.trim();
  if (text.length < FB_MIN_TEXT) { fbSay(`Write a few words first (at least ${FB_MIN_TEXT} characters).`, 'warn'); $('fb-text').focus(); return; }
  const url = feedbackUrl();
  if (!url) { fbSay('This copy of the game has no server to send feedback to.', 'bad'); return; }
  const body = { type: FB.type, text: text.slice(0, FB_MAX_TEXT), meta: feedbackMeta(), website: $('fb-website').value };
  const contact = $('fb-contact').value.trim().slice(0, FB_MAX_CONTACT);
  if (contact) body.contact = contact;
  let note = '';
  if (feedbackGame() && $('fb-save').checked) {
    let save = '';
    try { save = saveFileText(); } catch (e) { note = 'Your game couldn\'t be attached, so it went without it.'; }
    if (save.length > FB_MAX_SAVE) note = 'Your game was too big to attach (over 8 MB), so it went without it.';
    else if (save) body.save = save;
  }
  let json = JSON.stringify(body);
  // (The relay turns away anything much bigger than the biggest save it takes: a save that only just fits goes too.)
  if (body.save && new Blob([json]).size > FB_MAX_SAVE + 60 * 1024) {
    delete body.save;
    json = JSON.stringify(body);
    note = 'Your game was too big to attach (over 8 MB), so it went without it.';
  }
  fbBusy(true);
  fbSay('');
  let res = null, out = {};
  const ctl = typeof AbortController === 'function' ? new AbortController() : null;
  const timer = ctl ? setTimeout(() => ctl.abort(), body.save ? 120000 : 30000) : 0;
  try {
    res = await fetch(url, { method: 'POST', headers: { 'content-type': 'application/json' }, body: json, signal: ctl ? ctl.signal : undefined });
    out = await res.json().catch(() => ({}));
  } catch (e) { res = null; }
  clearTimeout(timer);
  fbBusy(false);
  if (res && res.ok && out && out.ok) { fbFiled(+out.n || 0, note); return; }
  const kept = ' Your message is still here.';
  if (!res) fbSay((navigator.onLine === false ? 'You\'re offline: connect to the internet and try again.' : 'Couldn\'t reach the feedback server: check your connection and try again.') + kept, 'bad');
  else if (res.status === 503 && out.why === 'off') fbSay('Feedback isn\'t switched on yet: the game\'s maker is still setting it up. Please try again in a few days.' + kept, 'bad');
  else if (res.status === 429) fbSay('That\'s a lot of reports from here in a short time: please try again in an hour or so.' + kept, 'bad');
  else if (res.status === 413) fbSay('That was too big to send: untick Attach my current game and try again.' + kept, 'bad');
  else if (res.status === 400 && out.why === 'short') fbSay(`Write a few words first (at least ${FB_MIN_TEXT} characters).`, 'warn');
  else fbSay(`Something went wrong sending it (error ${res.status}). Please try again later.` + kept, 'bad');
}

/** The relay filed report #n: thanks, and a fresh form next time (the email or name stays: the same person). */
function fbFiled(n, note) {
  $('fb-text').value = '';
  FB.saveSet = false;
  FB.sent = { n, note };
  fbSay('');
  if ($('screen-feedback').hidden) {
    // (sent, then the form was closed before the answer came: in a game the thanks are a message instead)
    if (UI.inGame) { toast(n > 0 ? `Thanks! Report #${n} is filed.` : 'Thanks! Your report is filed.', 'good'); FB.sent = null; }
    fbSync();
    return;
  }
  fbSync();
  $('fb-ok').focus({ preventScroll: true });
}
